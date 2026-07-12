import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import type { TrainingSession } from "@/lib/athlete-types";

// Rit-verhaal (Fase 1 "De keten") — data hooks, all gated on the `rit_verhaal`
// flag so the entire chain is reversible by flipping one flag.

export type SyncStatus = {
  status: "geen" | "bezig" | "mislukt" | "gereed";
  lastActivity: {
    sessionId: number | null;
    provider: string;
    importedAt: string;
    startedAt: string | null;
    title: string | null;
    sessionDate: string | null;
  } | null;
  lastSync: {
    provider: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
    error: string | null;
  } | null;
  hasConnection: boolean;
  analysis: "geen" | "bezig" | "gereed";
};

export type RideConsequence = {
  status: "voorstel" | "geen" | "onbekend" | "wedstrijd";
  reason: string;
  causeLine: string | null;
  missing: string[];
  canPropose: boolean;
};

export type RideStoryWorkout = {
  id: number;
  title: string;
  scheduledDate: string;
  targetTSS: number | null;
  targetDurationMin: number | null;
  status: string;
};

export type RideStory = {
  session: TrainingSession;
  workout: RideStoryWorkout | null;
  feedback: { feedbackType: string; note: string | null; createdAt: string }[];
  consequence: RideConsequence;
  race: { id: number; name: string } | null;
  predictionAvailable: boolean;
};

export type RideMoment = {
  suppressed: boolean;
  suppressReason: "health" | null;
  story: RideStory | null;
  sync: SyncStatus;
};

export function useRideStoryFlag(): boolean {
  return useFeatureFlag("rit_verhaal");
}

export function useSyncStatus() {
  const { isSignedIn } = useUser();
  const flagOn = useRideStoryFlag();
  return useQuery({
    queryKey: queryKeys.rideStory.syncStatus(),
    queryFn: () => apiFetch<SyncStatus>("/api/ride-story/sync-status"),
    enabled: (isSignedIn === true || DEV_PREVIEW) && flagOn,
    staleTime: 60_000,
  });
}

export function useRideMoment() {
  const { isSignedIn } = useUser();
  const flagOn = useRideStoryFlag();
  return useQuery({
    queryKey: queryKeys.rideStory.moment(),
    queryFn: () => apiFetch<RideMoment>("/api/ride-story/moment"),
    enabled: (isSignedIn === true || DEV_PREVIEW) && flagOn,
    staleTime: 60_000,
  });
}

export function useRideStory(sessionId: number | null) {
  const { isSignedIn } = useUser();
  const flagOn = useRideStoryFlag();
  return useQuery({
    queryKey:
      sessionId != null
        ? queryKeys.rideStory.session(sessionId)
        : ["ride-story", "session", "none"],
    queryFn: () => apiFetch<RideStory>(`/api/ride-story/session/${sessionId}`),
    enabled:
      (isSignedIn === true || DEV_PREVIEW) && flagOn && sessionId != null,
    staleTime: 60_000,
  });
}
