import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";
import { useFeatureFlag } from "@/hooks/use-feature-flag";

export type KnowledgeItem = {
  id: number;
  type: "research" | "news";
  provider: string;
  title: string;
  authors: string[];
  source: string | null;
  url: string;
  doi: string | null;
  publishedAt: string | null;
  abstract: string | null;
  summary: string | null;
  disciplines: string[];
  fetchedAt: string;
};

export type KnowledgeMeta = {
  disciplines: string[];
  types: string[];
  total: number;
};

export function useKnowledgeMeta() {
  const { isSignedIn } = useUser();
  const enabled = useFeatureFlag("knowledge_base");
  return useQuery({
    queryKey: queryKeys.knowledge.meta(),
    queryFn: () => apiFetch<KnowledgeMeta>("/api/knowledge/meta"),
    enabled: (isSignedIn === true || DEV_PREVIEW) && enabled,
    staleTime: STALE.flags,
  });
}

export function useKnowledge(opts: {
  q?: string;
  discipline?: string;
  type?: string;
  limit?: number;
  enabled?: boolean;
}) {
  const { isSignedIn } = useUser();
  const flagOn = useFeatureFlag("knowledge_base");
  const q = opts.q?.trim() ?? "";
  const discipline = opts.discipline ?? "";
  const type = opts.type ?? "";

  return useQuery({
    queryKey: queryKeys.knowledge.list(q, discipline, type),
    queryFn: () => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (discipline) params.set("discipline", discipline);
      if (type) params.set("type", type);
      if (opts.limit) params.set("limit", String(opts.limit));
      const qs = params.toString();
      return apiFetch<{ items: KnowledgeItem[] }>(
        `/api/knowledge${qs ? `?${qs}` : ""}`,
      );
    },
    enabled:
      (isSignedIn === true || DEV_PREVIEW) &&
      flagOn &&
      (opts.enabled ?? true),
    staleTime: STALE.session,
  });
}
