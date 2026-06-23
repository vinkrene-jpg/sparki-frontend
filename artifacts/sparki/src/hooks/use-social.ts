import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";

// ── Types (mirror the api-server social engine) ──────────────────────────────
export type FriendSummary = {
  clerkId: string;
  displayName: string;
  sport: string | null;
  club: string | null;
  team: string | null;
  availableDays: string[];
  isTrainingBuddy: boolean;
};

export type FriendRequestSummary = {
  id: number;
  direction: "incoming" | "outgoing";
  clerkId: string;
  displayName: string;
  createdAt: string;
};

export type AthleteSearchResult = {
  clerkId: string;
  displayName: string;
  sport: string | null;
  club: string | null;
  relation: "none" | "pending" | "friends";
};

export type FeedItemKind =
  | "training_done"
  | "race_planned"
  | "looking_for_buddy"
  | "rest_day";

export type FriendFeedItem = {
  id: string;
  kind: FeedItemKind;
  clerkId: string;
  displayName: string;
  title: string;
  detail: string | null;
  at: string;
};

export type JointTrainingSuggestion =
  | {
      available: true;
      message: string;
      dayKey: string;
      dayLabel: string;
      suggestedType: string;
      suggestedDurationMin: number;
      buddies: { clerkId: string; displayName: string }[];
    }
  | { available: false; reason: string };

export type ProposalInvitee = {
  clerkId: string;
  displayName: string;
  status: string;
};

export type SentProposal = {
  id: number;
  scheduledAt: string;
  trainingType: string;
  durationMin: number | null;
  area: string | null;
  intensity: string | null;
  note: string | null;
  status: string;
  invitees: ProposalInvitee[];
};

export type ReceivedProposal = {
  id: number;
  proposerClerkId: string;
  proposerName: string;
  scheduledAt: string;
  trainingType: string;
  durationMin: number | null;
  area: string | null;
  intensity: string | null;
  note: string | null;
  myStatus: string;
};

export type TeamIdentity = {
  clerkId: string;
  clubName: string | null;
  teamName: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  sport: string | null;
  category: string | null;
  shirtBadge: string | null;
  role: string | null;
} | null;

const enabledInPreview = (isSignedIn: boolean | undefined) =>
  isSignedIn === true || DEV_PREVIEW;

// ── Queries ──────────────────────────────────────────────────────────────────
export function useFriends() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.social.friends(),
    queryFn: () => apiFetch<{ friends: FriendSummary[] }>("/api/social/friends"),
    enabled: enabledInPreview(isSignedIn),
    staleTime: STALE.session,
  });
}

export function useFriendRequests() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.social.requests(),
    queryFn: () =>
      apiFetch<{ requests: FriendRequestSummary[] }>("/api/social/requests"),
    enabled: enabledInPreview(isSignedIn),
    staleTime: STALE.session,
  });
}

export function useAthleteSearch(query: string) {
  const { isSignedIn } = useUser();
  const q = query.trim();
  return useQuery({
    queryKey: queryKeys.social.search(q),
    queryFn: () =>
      apiFetch<{ results: AthleteSearchResult[] }>(
        `/api/social/search?q=${encodeURIComponent(q)}`,
      ),
    enabled: enabledInPreview(isSignedIn) && q.length >= 2,
    staleTime: STALE.live,
  });
}

export function useFriendFeed() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.social.feed(),
    queryFn: () => apiFetch<{ items: FriendFeedItem[] }>("/api/social/feed"),
    enabled: enabledInPreview(isSignedIn),
    staleTime: STALE.session,
  });
}

export type CircleFeedItem = {
  id: string;
  type:
    | "follow_up"
    | "my_race"
    | "friend_training"
    | "friend_race"
    | "friend_buddy"
    | "friend_rest";
  at: string;
  title: string;
  detail: string | null;
  displayName: string | null;
  clerkId: string | null;
  memoryId: number | null;
  prompt: string | null;
};

export function useCircleFeed() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.social.circleFeed(),
    queryFn: () =>
      apiFetch<{ items: CircleFeedItem[] }>("/api/social/circle-feed"),
    enabled: enabledInPreview(isSignedIn),
    staleTime: STALE.session,
  });
}

export function useJointTrainingSuggestion() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.social.suggestion(),
    queryFn: () =>
      apiFetch<{ suggestion: JointTrainingSuggestion }>(
        "/api/social/suggestion",
      ),
    enabled: enabledInPreview(isSignedIn),
    staleTime: STALE.session,
  });
}

export function useProposals() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.social.proposals(),
    queryFn: () =>
      apiFetch<{ sent: SentProposal[]; received: ReceivedProposal[] }>(
        "/api/social/proposals",
      ),
    enabled: enabledInPreview(isSignedIn),
    staleTime: STALE.session,
  });
}

export function useTeamIdentity() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.social.team(),
    queryFn: () => apiFetch<{ team: TeamIdentity }>("/api/social/team"),
    enabled: enabledInPreview(isSignedIn),
    staleTime: STALE.profile,
  });
}

// ── Mutations ────────────────────────────────────────────────────────────────
function useInvalidate() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: queryKeys.social.all() });
}

export function useSendFriendRequest() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (addresseeClerkId: string) =>
      apiFetch("/api/social/requests", {
        method: "POST",
        body: JSON.stringify({ addresseeClerkId }),
      }),
    onSuccess: invalidate,
  });
}

export function useRespondFriendRequest() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, accept }: { id: number; accept: boolean }) =>
      apiFetch(`/api/social/requests/${id}/respond`, {
        method: "POST",
        body: JSON.stringify({ accept }),
      }),
    onSuccess: invalidate,
  });
}

export function useSetTrainingBuddy() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      clerkId,
      selected,
    }: {
      clerkId: string;
      selected: boolean;
    }) =>
      apiFetch(`/api/social/friends/${clerkId}/buddy`, {
        method: "POST",
        body: JSON.stringify({ selected }),
      }),
    onSuccess: invalidate,
  });
}

export function useRemoveFriend() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (clerkId: string) =>
      apiFetch(`/api/social/friends/${clerkId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export type CreateProposalInput = {
  scheduledAt: string;
  trainingType: string;
  durationMin?: number | null;
  area?: string | null;
  intensity?: string | null;
  note?: string | null;
  inviteeClerkIds: string[];
};

export function useCreateProposal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: CreateProposalInput) =>
      apiFetch("/api/social/proposals", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}

export function useRespondToProposal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, accept }: { id: number; accept: boolean }) =>
      apiFetch(`/api/social/proposals/${id}/respond`, {
        method: "POST",
        body: JSON.stringify({ accept }),
      }),
    onSuccess: invalidate,
  });
}

export type TeamIdentityInput = {
  clubName?: string | null;
  teamName?: string | null;
  logoUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  sport?: string | null;
  category?: string | null;
  shirtBadge?: string | null;
  role?: string | null;
};

export function useSaveTeamIdentity() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: TeamIdentityInput) =>
      apiFetch<{ team: TeamIdentity }>("/api/social/team", {
        method: "PUT",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}
