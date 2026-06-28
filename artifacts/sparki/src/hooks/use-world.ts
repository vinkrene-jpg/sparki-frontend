import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";
import type {
  WorldAthleteProfile,
  WorldComment,
  WorldFeedResponse,
} from "@/lib/world-types";

// The personalised Sparki World feed of validated, transparently-fictional posts.
export function useWorldFeed(limit = 24) {
  return useQuery({
    queryKey: queryKeys.world.feed(),
    queryFn: () => apiFetch<WorldFeedResponse>(`/api/world/feed?limit=${limit}`),
    staleTime: STALE.session,
  });
}

// A single Virtual Athlete's profile + their recent posts.
export function useWorldAthlete(slug: string | null) {
  return useQuery({
    queryKey: slug ? queryKeys.world.athlete(slug) : ["world", "athlete", "none"],
    queryFn: () => apiFetch<WorldAthleteProfile>(`/api/world/athletes/${slug}`),
    enabled: !!slug,
    staleTime: STALE.session,
  });
}

export function useWorldComments(postId: number | null) {
  return useQuery({
    queryKey: postId != null ? queryKeys.world.comments(postId) : ["world", "comments", "none"],
    queryFn: () =>
      apiFetch<{ comments: WorldComment[] }>(`/api/world/posts/${postId}/comments`),
    enabled: postId != null,
    staleTime: STALE.live,
  });
}

// Follow / favorite a Virtual Athlete. favorite=true upgrades a follow to a
// favorite; passing following=false unfollows entirely.
export function useSetFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { athleteId: number; following: boolean; favorite?: boolean }) =>
      vars.following
        ? apiFetch<{ following: boolean; favorite: boolean }>(
            `/api/world/athletes/${vars.athleteId}/follow`,
            {
              method: "POST",
              body: JSON.stringify({ favorite: vars.favorite === true }),
            },
          )
        : apiFetch<{ following: boolean; favorite: boolean }>(
            `/api/world/athletes/${vars.athleteId}/follow`,
            { method: "DELETE" },
          ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.world.all() });
    },
  });
}

export function useToggleLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: number) =>
      apiFetch<{ liked: boolean; likeCount: number }>(
        `/api/world/posts/${postId}/like`,
        { method: "POST" },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.world.feed() });
    },
  });
}

export function useAddComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { postId: number; body: string }) =>
      apiFetch<{ comment: WorldComment }>(
        `/api/world/posts/${vars.postId}/comments`,
        { method: "POST", body: JSON.stringify({ body: vars.body }) },
      ),
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: queryKeys.world.comments(vars.postId) });
      void qc.invalidateQueries({ queryKey: queryKeys.world.feed() });
    },
  });
}
