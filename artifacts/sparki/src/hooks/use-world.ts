import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";
import type {
  WorldAthleteProfile,
  WorldComment,
  WorldFeedResponse,
  WorldSuggestionsResponse,
  WorldSavedResponse,
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

// Voorgestelde renners (herkenbaar + inspiratie), getailleerd op de gebruiker.
export function useWorldRecommended() {
  return useQuery({
    queryKey: queryKeys.world.recommended(),
    queryFn: () => apiFetch<WorldSuggestionsResponse>(`/api/world/recommended`),
    staleTime: STALE.session,
  });
}

// Toonaangevende figuren in de wereld.
export function useWorldHeroes() {
  return useQuery({
    queryKey: queryKeys.world.heroes(),
    queryFn: () => apiFetch<WorldSuggestionsResponse>(`/api/world/heroes`),
    staleTime: STALE.session,
  });
}

// De berichten die de gebruiker heeft bewaard.
export function useWorldSaved() {
  return useQuery({
    queryKey: queryKeys.world.saved(),
    queryFn: () => apiFetch<WorldSavedResponse>(`/api/world/saved`),
    staleTime: STALE.live,
  });
}

// Bewaar / haal-uit-bewaard (toggle).
export function useToggleSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: number) =>
      apiFetch<{ saved: boolean }>(`/api/world/posts/${postId}/save`, {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.world.saved() });
      void qc.invalidateQueries({ queryKey: queryKeys.world.feed() });
    },
  });
}

// Deel een bericht (stille leersignaal).
export function useRecordShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: number) =>
      apiFetch<{ shared: boolean; firstTime: boolean }>(
        `/api/world/posts/${postId}/share`,
        { method: "POST" },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.world.feed() });
    },
  });
}

// Registreer dat een bericht in beeld kwam (stil leersignaal, één keer per post).
// Fire-and-forget: faalt het, dan blijft de feed gewoon werken.
export function useRecordView() {
  return useMutation({
    mutationFn: (postId: number) =>
      apiFetch<{ viewed: boolean; firstTime: boolean }>(
        `/api/world/posts/${postId}/view`,
        { method: "POST" },
      ),
  });
}
