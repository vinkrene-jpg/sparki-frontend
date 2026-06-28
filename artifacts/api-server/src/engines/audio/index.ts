// Audio / Sound Studio preferences — read/write helpers with safe defaults.
//
// A missing row means "sound on, no wekker armed": an athlete who never touched
// the settings still hears event feedback, but is never woken unexpectedly. All
// writes are validated/sanitised here so a malformed value can never reach the
// client (pack/alarmSound ids become file-path segments on the frontend, so they
// are constrained to a safe charset — never trust raw input).

import { eq } from "drizzle-orm";
import {
  db,
  audioPreferencesTable,
  type AudioPreferences,
} from "@workspace/db";

export type EffectiveAudioPrefs = {
  enabled: boolean;
  volume: number;
  pack: string;
  alarmEnabled: boolean;
  alarmTime: string;
  alarmDays: number[];
  alarmSound: string;
};

export const DEFAULT_AUDIO_PREFS: EffectiveAudioPrefs = {
  enabled: true,
  volume: 70,
  pack: "performance",
  alarmEnabled: false,
  alarmTime: "07:00",
  alarmDays: [],
  alarmSound: "wekker-energie",
};

function toEffective(row: AudioPreferences | undefined): EffectiveAudioPrefs {
  if (!row) return { ...DEFAULT_AUDIO_PREFS };
  return {
    enabled: row.enabled,
    volume: row.volume,
    pack: row.pack,
    alarmEnabled: row.alarmEnabled,
    alarmTime: row.alarmTime,
    alarmDays: [...row.alarmDays],
    alarmSound: row.alarmSound,
  };
}

export async function getAudioPrefs(
  clerkId: string,
): Promise<EffectiveAudioPrefs> {
  const [row] = await db
    .select()
    .from(audioPreferencesTable)
    .where(eq(audioPreferencesTable.clerkId, clerkId))
    .limit(1);
  return toEffective(row);
}

export type AudioPrefsPatch = Partial<EffectiveAudioPrefs>;

// id used as a file-path segment on the frontend — strict safe charset.
const ID_RE = /^[a-z0-9-]{1,40}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Sanitise a partial patch: drop anything malformed so a bad field is ignored
// rather than corrupting the row. Returns only the valid keys.
export function sanitizeAudioPatch(body: Record<string, unknown>): AudioPrefsPatch {
  const patch: AudioPrefsPatch = {};
  if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body.volume === "number" && Number.isFinite(body.volume)) {
    patch.volume = Math.max(0, Math.min(100, Math.round(body.volume)));
  }
  if (typeof body.pack === "string" && ID_RE.test(body.pack)) {
    patch.pack = body.pack;
  }
  if (typeof body.alarmEnabled === "boolean") {
    patch.alarmEnabled = body.alarmEnabled;
  }
  if (typeof body.alarmTime === "string" && TIME_RE.test(body.alarmTime)) {
    patch.alarmTime = body.alarmTime;
  }
  if (Array.isArray(body.alarmDays)) {
    const days = Array.from(
      new Set(
        body.alarmDays
          .map((d) => Number(d))
          .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
      ),
    ).sort((a, b) => a - b);
    patch.alarmDays = days;
  }
  if (typeof body.alarmSound === "string" && ID_RE.test(body.alarmSound)) {
    patch.alarmSound = body.alarmSound;
  }
  return patch;
}

export async function updateAudioPrefs(
  clerkId: string,
  patch: AudioPrefsPatch,
): Promise<EffectiveAudioPrefs> {
  const current = await getAudioPrefs(clerkId);
  const next: EffectiveAudioPrefs = { ...current, ...patch };
  await db
    .insert(audioPreferencesTable)
    .values({ clerkId, ...next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: audioPreferencesTable.clerkId,
      set: { ...next, updatedAt: new Date() },
    });
  return next;
}
