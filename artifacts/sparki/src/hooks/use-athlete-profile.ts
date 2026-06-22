/**
 * Example TanStack Query hook — establishes the pattern all future
 * domain hooks (coach, athlete, AI) should follow.
 *
 * Note: UserContext already maintains the canonical profile via JIT sync.
 * This hook is additive: it lets any component subscribe directly to profile
 * data through the Query cache without coupling to UserContext internals.
 */
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";
import type { UserProfile } from "@/contexts/UserContext";

export function useAthleteProfile() {
  const { isSignedIn } = useUser();

  return useQuery({
    queryKey: queryKeys.user.profile(),
    queryFn: () => apiFetch<UserProfile>("/api/auth/me"),
    enabled: isSignedIn === true,
    staleTime: STALE.profile,
  });
}
