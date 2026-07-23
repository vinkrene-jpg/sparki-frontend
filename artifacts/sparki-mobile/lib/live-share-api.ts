import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

import type { FriendPosition } from "@/lib/live-share";

// API-laag voor "Vrienden live op de kaart" (Opdracht 4). Alle autorisatie
// zit server-side; dit is alleen transport. Delen staat standaard UIT en
// wordt per navigatiesessie expliciet gestart.

export type LiveShareAudience = "vrienden" | "groep";

export type LiveShareSession = {
  id: number;
  audience: LiveShareAudience;
  clubTrainingId: number | null;
  startedAt: string;
  viewerCount: number;
};

export type ShareFriend = { clerkId: string; name: string };

/** Geaccepteerde vrienden om uit te kiezen (bestaande social-API). */
export function useShareableFriends(enabled: boolean) {
  return useQuery({
    enabled,
    staleTime: 5 * 60_000,
    queryKey: ["live-share-friends-list"],
    queryFn: () =>
      customFetch<{ friends: Array<{ clerkId: string; displayName: string | null }> }>(
        "/api/social/friends",
        { responseType: "json" },
      ).then((r) =>
        (r.friends ?? []).map(
          (f): ShareFriend => ({
            clerkId: f.clerkId,
            name: f.displayName?.trim() || "Sparki-vriend",
          }),
        ),
      ),
  });
}

export type GroupRideOption = {
  clubTrainingId: number;
  title: string;
  startTime: string | null;
};

/** Groepsritten van vandaag waarvoor je bent aangemeld. */
export function useGroupRideOptions(enabled: boolean) {
  return useQuery({
    enabled,
    staleTime: 5 * 60_000,
    queryKey: ["live-share-group-options"],
    queryFn: () =>
      customFetch<{ options: GroupRideOption[] }>(
        "/api/live-location/group-options",
        { responseType: "json" },
      ).then((r) => r.options),
  });
}

export function useStartLiveShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      audience: LiveShareAudience;
      friendClerkIds?: string[];
      clubTrainingId?: number;
    }) =>
      customFetch<{ session: LiveShareSession }>("/api/live-location/sessions", {
        method: "POST",
        responseType: "json",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      }).then((r) => r.session),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["live-share-session"] });
    },
  });
}

export function useStopLiveShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      customFetch<{ ok: boolean }>("/api/live-location/sessions/current", {
        method: "DELETE",
        responseType: "json",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["live-share-session"] });
      void qc.invalidateQueries({ queryKey: ["live-share-positions"] });
    },
  });
}

/** Best-effort stoppen buiten React om (unmount/einde rit/uitloggen). */
export async function stopLiveShareNow(): Promise<void> {
  try {
    await customFetch("/api/live-location/sessions/current", {
      method: "DELETE",
      responseType: "json",
    });
  } catch {
    // best-effort; de server laat de sessie ook vanzelf verlopen (idle-verval)
  }
}

/**
 * Eigen positie delen; mislukken blokkeert navigatie nooit. Geeft terug of
 * het versturen lukte, zodat de verzendlus eerlijk kan pauzeren bij
 * netwerkverlies (er wordt nooit een wachtrij met oude posities opgebouwd).
 */
export async function postLivePosition(input: {
  lat: number;
  lon: number;
  speedMps: number | null;
  headingDeg: number | null;
}): Promise<boolean> {
  try {
    await customFetch("/api/live-location/positions", {
      method: "POST",
      responseType: "json",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    return true;
  } catch {
    return false;
  }
}

/** Actieve eigen deelsessie (voor de zichtbare indicator). */
export function useLiveShareSession(enabled: boolean) {
  return useQuery({
    enabled,
    refetchInterval: 60_000,
    queryKey: ["live-share-session"],
    queryFn: () =>
      customFetch<{ session: LiveShareSession | null }>(
        "/api/live-location/sessions/current",
        { responseType: "json" },
      ).then((r) => r.session),
  });
}

/** Vriendposities die IK mag zien (server her-controleert elke lezing). */
export function useFriendLivePositions(enabled: boolean) {
  return useQuery({
    enabled,
    refetchInterval: 15_000,
    queryKey: ["live-share-positions"],
    queryFn: () =>
      customFetch<{ friends: FriendPosition[] }>("/api/live-location/friends", {
        responseType: "json",
      }).then((r) => r.friends),
  });
}
