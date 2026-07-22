import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type ShareInfo = {
  text: string;
  generated: boolean;
  capabilities: {
    strava: {
      connected: boolean;
      hasWriteScope: boolean;
      canUpload: boolean;
      reason: string | null;
    };
    platformNote: string;
  };
  session: {
    id: number;
    title: string | null;
    sessionDate: string;
    distanceKm: string | null;
    durationMin: number | null;
    elevationM: number | null;
    avgPower: number | null;
    avgSpeedKph: string | null;
  };
};

// Deeltekst + mogelijkheden voor één rit. Wordt pas opgehaald zodra de
// renner het deelpaneel opent (enabled), want de tekstopbouw kost een aanroep.
export function useShareInfo(sessionId: number | null) {
  return useQuery({
    queryKey: ["share", "session", sessionId],
    queryFn: () => apiFetch<ShareInfo>(`/api/share/session/${sessionId}`),
    enabled: sessionId != null,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useShareToStrava() {
  return useMutation({
    mutationFn: (input: { sessionId: number; description: string | null }) =>
      apiFetch<{ ok: boolean; url: string }>(
        `/api/share/session/${input.sessionId}/strava`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: input.description }),
        },
      ),
  });
}
