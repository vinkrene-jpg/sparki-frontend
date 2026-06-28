import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { DEV_PREVIEW } from "@/lib/dev";
import { soundManager } from "@/lib/sound/manager";
import { eventUrl, resolveAlarm, type SoundEvent } from "@/lib/sound/registry";
import { WekkerOverlay } from "@/components/sparki/wekker-overlay";

// App-wide audio. The SoundProvider owns: (1) the athlete's preferences (synced
// with the backend), (2) keeping the Sound Manager's master switch/volume in
// step, (3) the autoplay unlock on first gesture, and (4) the in-app wekker
// scheduler + overlay. Mounted high enough to cover both the Development Preview
// branch and the real signed-in app.

export type AudioPrefs = {
  enabled: boolean;
  volume: number;
  pack: string;
  alarmEnabled: boolean;
  alarmTime: string;
  alarmDays: number[];
  alarmSound: string;
};

const DEFAULTS: AudioPrefs = {
  enabled: true,
  volume: 70,
  pack: "performance",
  alarmEnabled: false,
  alarmTime: "07:00",
  alarmDays: [],
  alarmSound: "wekker-energie",
};

type SoundCtx = {
  prefs: AudioPrefs;
  isLoading: boolean;
  saving: boolean;
  /** Play a registered event sound for the active pack (no-op if unmapped). */
  play: (event: SoundEvent) => void;
  /** Play a specific file url once, ignoring the master switch (settings test). */
  preview: (url: string) => void;
  /** Persist a partial preference change (optimistic). */
  update: (patch: Partial<AudioPrefs>) => void;
};

const Ctx = createContext<SoundCtx | null>(null);

export function useSound(): SoundCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSound must be used within SoundProvider");
  return v;
}

const SNOOZE_MS = 9 * 60 * 1000;

export function SoundProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { isSignedIn } = useUser();
  // Only hit the API when there is a real session (or in Development Preview,
  // where the backend resolves a dev user). Avoids a guaranteed 401 on landing.
  const apiEnabled = DEV_PREVIEW || !!isSignedIn;

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.audio.preferences(),
    queryFn: () =>
      apiFetch<{ preferences: AudioPrefs }>("/api/audio/preferences"),
    enabled: apiEnabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
  const prefs = data?.preferences ?? DEFAULTS;

  const mutation = useMutation({
    mutationFn: (patch: Partial<AudioPrefs>) =>
      apiFetch<{ preferences: AudioPrefs }>("/api/audio/preferences", {
        method: "PUT",
        body: JSON.stringify(patch),
      }),
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: queryKeys.audio.preferences() });
      const prev = qc.getQueryData<{ preferences: AudioPrefs }>(
        queryKeys.audio.preferences(),
      );
      const base = prev?.preferences ?? prefs;
      qc.setQueryData(queryKeys.audio.preferences(), {
        preferences: { ...base, ...patch },
      });
      // Always capture a concrete value to restore on failure — even on the very
      // first write (no prior cache) — so a failed PUT never leaves the optimistic
      // change stuck on screen.
      return { restore: prev ?? { preferences: base } };
    },
    onError: (_e, _patch, context) => {
      if (context?.restore) {
        qc.setQueryData(queryKeys.audio.preferences(), context.restore);
      }
    },
    onSuccess: (res) => {
      qc.setQueryData(queryKeys.audio.preferences(), res);
    },
    onSettled: () => {
      // Reconcile with the server after either outcome (no-op while the query is
      // disabled, e.g. signed-out).
      void qc.invalidateQueries({ queryKey: queryKeys.audio.preferences() });
    },
  });

  // Keep the manager in step with the master switch + volume.
  useEffect(() => {
    soundManager.setEnabled(prefs.enabled);
    soundManager.setVolume(prefs.volume / 100);
  }, [prefs.enabled, prefs.volume]);

  // Browser autoplay policy: audio stays blocked until the first user gesture.
  useEffect(() => {
    const unlock = () => {
      soundManager.markUnlocked();
      soundManager.resumeAlarm();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const play = useCallback(
    (event: SoundEvent) => {
      const url = eventUrl(prefs.pack, event);
      if (url) soundManager.play(url);
    },
    [prefs.pack],
  );

  const preview = useCallback((url: string) => {
    soundManager.play(url, { force: true });
  }, []);

  // ---- In-app wekker ----
  const [firing, setFiring] = useState(false);
  const firingRef = useRef(false);
  firingRef.current = firing;
  // "YYYY-MM-DD HH:MM" already handled, so the same minute never double-fires.
  const firedKeyRef = useRef<string | null>(null);
  const snoozeUntilRef = useRef<number | null>(null);

  const startAlarm = useCallback(() => {
    const a = resolveAlarm(prefs.pack, prefs.alarmSound);
    if (a) soundManager.playAlarm(a.url, a.loop);
    setFiring(true);
  }, [prefs.pack, prefs.alarmSound]);

  useEffect(() => {
    if (!prefs.alarmEnabled) {
      snoozeUntilRef.current = null;
      return;
    }
    const tick = () => {
      if (firingRef.current) return;
      const nowMs = Date.now();
      if (snoozeUntilRef.current != null && nowMs >= snoozeUntilRef.current) {
        snoozeUntilRef.current = null;
        startAlarm();
        return;
      }
      const now = new Date();
      const cur = `${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes(),
      ).padStart(2, "0")}`;
      if (cur !== prefs.alarmTime) return;
      // Empty alarmDays = every day (a daily wekker). getDay(): 0=zo..6=za.
      const daysOk =
        prefs.alarmDays.length === 0 || prefs.alarmDays.includes(now.getDay());
      if (!daysOk) return;
      // Dedupe on the LOCAL date (not UTC) so the "already fired today" guard
      // matches the local-time trigger + the day model the UI shows.
      const localDate = `${now.getFullYear()}-${String(
        now.getMonth() + 1,
      ).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const key = `${localDate} ${cur}`;
      if (firedKeyRef.current === key) return;
      firedKeyRef.current = key;
      startAlarm();
    };
    tick();
    const id = window.setInterval(tick, 15000);
    return () => window.clearInterval(id);
  }, [prefs.alarmEnabled, prefs.alarmTime, prefs.alarmDays, startAlarm]);

  const handleStop = useCallback(() => {
    soundManager.stopAlarm();
    snoozeUntilRef.current = null;
    setFiring(false);
  }, []);

  const handleSnooze = useCallback(() => {
    soundManager.stopAlarm();
    snoozeUntilRef.current = Date.now() + SNOOZE_MS;
    setFiring(false);
  }, []);

  const value: SoundCtx = {
    prefs,
    isLoading,
    saving: mutation.isPending,
    play,
    preview,
    update: (patch) => mutation.mutate(patch),
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      {firing && (
        <WekkerOverlay
          alarmLabel={resolveAlarm(prefs.pack, prefs.alarmSound)?.label ?? "Wekker"}
          onStop={handleStop}
          onSnooze={handleSnooze}
        />
      )}
    </Ctx.Provider>
  );
}
