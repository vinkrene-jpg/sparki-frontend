import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type EngagementConfidence = "none" | "low" | "medium" | "high";

// An HONEST read-out of what Sparki learned about the athlete's own usage rhythm.
// Everything here is derived from their real telemetry and only informs WHEN a
// nudge may land — never what content they see.
export type EngagementRhythm = {
  hasData: boolean;
  eventCount: number;
  distinctActiveDays: number;
  distinctSessions: number;
  opensPerWeek: number;
  lastOpenAt: string | null;
  hoursSinceLastOpen: number | null;
  receptiveHour: number | null;
  receptiveWindow: { startHour: number; endHour: number };
  windowSource: "learned" | "default";
  activeHours: { hour: number; weight: number }[];
  topContent: { key: string; kind: "screen" | "feature"; count: number }[];
  confidence: EngagementConfidence;
};

export function useEngagementRhythm(enabled = true) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.engagement.rhythm(),
    queryFn: () =>
      apiFetch<{ rhythm: EngagementRhythm }>("/api/engagement/rhythm"),
    enabled: (isSignedIn === true || DEV_PREVIEW) && enabled,
    staleTime: 10 * 60_000,
  });
}
