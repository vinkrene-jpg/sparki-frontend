import { useQuery, useMutation } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export function useAiBrief(enabled = true) {
  const { isSignedIn } = useUser();

  return useQuery({
    queryKey: queryKeys.athlete.brief(),
    queryFn: () =>
      apiFetch<{ brief: string }>("/api/ai/brief", { method: "POST" }),
    enabled: isSignedIn === true && enabled,
    staleTime: 10 * 60_000,
  });
}

export function useAskSparki() {
  return useMutation({
    mutationFn: (question: string) =>
      apiFetch<{ answer: string }>("/api/ai/ask", {
        method: "POST",
        body: JSON.stringify({ question }),
      }),
  });
}
