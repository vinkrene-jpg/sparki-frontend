import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

// Sparki World — veilige sociale laag. Alles wat hier binnenkomt is echt en
// server-side gefilterd op zichtbaarheid, blokkades en leeftijdsregels.

export type WorldVisibility =
  | "prive"
  | "coach_ouders"
  | "club"
  | "team"
  | "volgers"
  | "openbaar";

export type WorldSourceType =
  | "bericht"
  | "journey_media"
  | "journey_item"
  | "session"
  | "race";

export type WorldFeedItem = {
  id: number;
  eigenaar: { clerkId: string; naam: string; isZelf: boolean };
  sourceType: WorldSourceType;
  visibility: WorldVisibility;
  message: string | null;
  caption: string | null;
  presentatie: Record<string, unknown>;
  waarderingen: number;
  reacties: number;
  createdAt: string;
};

export type WorldPrefs = {
  notifyReactions: boolean;
  notifyMentions: boolean;
  notifyRequests: boolean;
  notifyClubMessages: boolean;
  notifyModeration: boolean;
  muteDuringRide: boolean;
};

export type WorldMineItem = {
  id: number;
  sourceType: WorldSourceType;
  sourceId: number | null;
  message: string | null;
  caption: string | null;
  visibility: WorldVisibility;
  status: "actief" | "verborgen" | "verwijderd";
  hiddenReason: string | null;
  sharedFields: string[];
  presentatie: Record<string, unknown>;
  createdAt: string;
};

const KEY = {
  feed: ["world-social", "feed"] as const,
  mine: ["world-social", "mine"] as const,
  prefs: ["world-social", "prefs"] as const,
  blocks: ["world-social", "blocks"] as const,
};

export function useWorldFeed() {
  return useQuery({
    queryKey: KEY.feed,
    queryFn: () => apiFetch<{ items: WorldFeedItem[] }>("/api/world-social/feed"),
    staleTime: 30_000,
  });
}

export function useWorldMine() {
  return useQuery({
    queryKey: KEY.mine,
    queryFn: () => apiFetch<WorldMineItem[]>("/api/world-social/items/mine"),
    staleTime: 30_000,
  });
}

export function useWorldShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      sourceType: WorldSourceType;
      sourceId?: number;
      message?: string;
      caption?: string;
      visibility: WorldVisibility;
      sharedFields?: string[];
      locationPrivacy?: {
        hideStartEnd: boolean;
        privacyZone: boolean;
        simplify: boolean;
      };
      confirmPublic?: boolean;
    }) =>
      apiFetch("/api/world-social/items", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY.feed });
      void qc.invalidateQueries({ queryKey: KEY.mine });
    },
  });
}

export function useWorldWithdraw() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/world-social/items/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY.feed });
      void qc.invalidateQueries({ queryKey: KEY.mine });
    },
  });
}

export function useWorldReact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { itemId: number; kind: "waardering" | "reactie"; body?: string }) =>
      apiFetch(`/api/world-social/items/${input.itemId}/reactions`, {
        method: "POST",
        body: JSON.stringify({ kind: input.kind, body: input.body }),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY.feed }),
  });
}

export function useWorldBlocks() {
  return useQuery({
    queryKey: KEY.blocks,
    queryFn: () =>
      apiFetch<{ id: number; clerkId: string; naam: string; sinds: string }[]>(
        "/api/world-social/blocks",
      ),
    staleTime: 30_000,
  });
}

export function useWorldBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (blockedClerkId: string) =>
      apiFetch("/api/world-social/blocks", {
        method: "POST",
        body: JSON.stringify({ blockedClerkId }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY.blocks });
      void qc.invalidateQueries({ queryKey: KEY.feed });
    },
  });
}

export function useWorldUnblock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clerkId: string) =>
      apiFetch(`/api/world-social/blocks/${clerkId}`, { method: "DELETE" }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: KEY.blocks });
      void qc.invalidateQueries({ queryKey: KEY.feed });
    },
  });
}

export function useWorldReport() {
  return useMutation({
    mutationFn: (input: {
      targetType: "item" | "reactie" | "account";
      targetId: string;
      reason: string;
    }) =>
      apiFetch("/api/world-social/reports", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

export function useWorldPrefs() {
  return useQuery({
    queryKey: KEY.prefs,
    queryFn: () => apiFetch<WorldPrefs>("/api/world-social/prefs"),
    staleTime: 60_000,
  });
}

export function useSaveWorldPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prefs: WorldPrefs) =>
      apiFetch("/api/world-social/prefs", {
        method: "PUT",
        body: JSON.stringify(prefs),
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY.prefs }),
  });
}
