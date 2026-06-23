import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";

export type FeedNewsItem = {
  id: number;
  title: string;
  url: string;
  source: string | null;
  authors: string[];
  doi: string | null;
  summary: string | null;
  abstract: string | null;
  publishedAt: string | null;
  disciplines: string[];
};

export type FeedNewsResponse = {
  items: FeedNewsItem[];
  personalized: boolean;
};

// Personalised sports-news stream for the Feed. Backed by real stored news rows
// ranked server-side against the athlete's profile — no mock content.
export function useFeedNews(limit = 24) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.feed.news(),
    queryFn: () =>
      apiFetch<FeedNewsResponse>(`/api/feed/news?limit=${limit}`),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.session,
  });
}
