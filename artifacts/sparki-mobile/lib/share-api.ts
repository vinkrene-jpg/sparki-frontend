import { useMutation, useQuery } from "@tanstack/react-query";
import { ApiError, customFetch } from "@workspace/api-client-react";

// Deeltekst + mogelijkheden voor één rit, uit dezelfde backend als het web.
// De tekst is opgebouwd uit uitsluitend echte ritwaarden.
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
};

export function useShareInfo(sessionId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: ["share", "session", sessionId],
    queryFn: () =>
      customFetch<ShareInfo>(`/api/share/session/${sessionId}`, {
        responseType: "json",
      }),
    enabled: enabled && sessionId != null,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

// Eerlijke foutmelding uit de backend halen (die stuurt plain-Dutch `error`).
export function shareErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const data = err.data as { error?: unknown } | null;
    if (data && typeof data.error === "string") return data.error;
  }
  return "Uploaden naar Strava is niet gelukt.";
}

export function useShareToStrava() {
  return useMutation({
    mutationFn: (input: { sessionId: number; description: string | null }) =>
      customFetch<{ ok: boolean; url: string }>(
        `/api/share/session/${input.sessionId}/strava`,
        {
          method: "POST",
          responseType: "json",
          body: JSON.stringify({ description: input.description }),
        },
      ),
  });
}
