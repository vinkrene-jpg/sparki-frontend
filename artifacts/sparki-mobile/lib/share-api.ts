import { useMutation, useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

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
    queryFn: async () => {
      const res = await customFetch(`/api/share/session/${sessionId}`);
      if (!res.ok) throw new Error("Deeltekst kon niet worden opgesteld");
      return (await res.json()) as ShareInfo;
    },
    enabled: enabled && sessionId != null,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

export function useShareToStrava() {
  return useMutation({
    mutationFn: async (input: { sessionId: number; description: string | null }) => {
      const res = await customFetch(`/api/share/session/${input.sessionId}/strava`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: input.description }),
      });
      const data = (await res.json().catch(() => null)) as
        | { ok?: boolean; url?: string; error?: string }
        | null;
      if (!res.ok || !data?.ok || typeof data.url !== "string") {
        throw new Error(data?.error ?? "Uploaden naar Strava is niet gelukt");
      }
      return { url: data.url };
    },
  });
}
