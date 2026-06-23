import { useQuery, useMutation } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

// Real cited literature returned alongside AI coaching output (knowledge_base
// flag). Each source is a genuine stored library item with a working URL.
export type AiSource = {
  id: number;
  title: string;
  url: string;
  source: string | null;
  authors: string[];
  publishedAt: string | null;
  summary: string | null;
  disciplines: string[];
};

export function useAiBrief(enabled = true) {
  const { isSignedIn } = useUser();

  return useQuery({
    queryKey: queryKeys.athlete.brief(),
    queryFn: () =>
      apiFetch<{ brief: string; sources?: AiSource[] }>("/api/ai/brief", {
        method: "POST",
      }),
    enabled: (isSignedIn === true || DEV_PREVIEW) && enabled,
    staleTime: 10 * 60_000,
  });
}

export function useAskSparki() {
  return useMutation({
    mutationFn: (question: string) =>
      apiFetch<{ answer: string; sources?: AiSource[] }>("/api/ai/ask", {
        method: "POST",
        body: JSON.stringify({ question }),
      }),
  });
}
