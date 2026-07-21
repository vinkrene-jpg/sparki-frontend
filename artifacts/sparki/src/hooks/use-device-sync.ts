import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { STALE } from "@/lib/query-keys";

// ── Fietscomputer-sync (Garmin / Wahoo) ──────────────────────────────────────
// Cloud-to-cloud route delivery, the Komoot model. Honest states per provider:
// configured=false → the manufacturer hasn't approved API access yet;
// connected=false → athlete hasn't linked their account; connected=true →
// "Zet op mijn Garmin/Wahoo" pushes for real.

export type DeviceProvider = "garmin" | "wahoo";

export type DeviceSyncProviderStatus = {
  provider: DeviceProvider;
  label: string;
  configured: boolean;
  connected: boolean;
  connectedAt: string | null;
};

const STATUS_KEY = ["device-sync", "status"] as const;

/**
 * After the OAuth round-trip the callback redirects back with ?garmin= /
 * ?wahoo= status flags. Refresh the status immediately and strip the params
 * so the result is visible without a manual reload.
 */
export function useDeviceSyncOAuthReturn() {
  const qc = useQueryClient();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flags = ["garmin", "wahoo"].filter((p) => params.has(p));
    if (flags.length === 0) return;
    void qc.invalidateQueries({ queryKey: STATUS_KEY });
    for (const p of flags) params.delete(p);
    const q = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${q ? `?${q}` : ""}`,
    );
  }, [qc]);
}

export function useDeviceSyncStatus() {
  return useQuery({
    queryKey: STATUS_KEY,
    queryFn: () =>
      apiFetch<{ providers: DeviceSyncProviderStatus[] }>(
        "/api/device-sync/status",
      ),
    staleTime: STALE.session,
  });
}

/** Start the OAuth link: fetch the authorize URL and navigate to it. */
export function useConnectDevice() {
  return useMutation({
    mutationFn: async (provider: DeviceProvider) => {
      const returnTo = window.location.href;
      const { url } = await apiFetch<{ url: string }>(
        `/api/device-sync/${provider}/authorize?returnTo=${encodeURIComponent(returnTo)}`,
      );
      window.location.assign(url);
    },
  });
}

export function useDisconnectDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: DeviceProvider) =>
      apiFetch<{ ok: true }>(`/api/device-sync/${provider}/disconnect`, {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: STATUS_KEY });
    },
  });
}

/** Push a saved route to the athlete's Garmin/Wahoo cloud account. */
export function useSendRouteToDevice() {
  return useMutation({
    mutationFn: (input: { routeId: number; provider: DeviceProvider }) =>
      apiFetch<{ ok: true; message: string }>("/api/device-sync/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
  });
}
