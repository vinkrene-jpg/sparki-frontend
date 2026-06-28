import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type NotificationType =
  | "ai_observation"
  | "training_reminder"
  | "recovery_warning"
  | "race_reminder"
  | "coach_update"
  | "parent_update"
  | "system";

export type AppNotification = {
  id: number;
  clerkId: string;
  athleteClerkId: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  priority: "low" | "normal" | "high";
  readAt: string | null;
  actionUrl: string | null;
  createdAt: string;
};

// The bell folds notifications into at-most-one entry per calendar day. A day
// with a single notification arrives unwrapped; a day with several arrives as a
// combined entry with its members listed underneath.
export type NotificationGroup =
  | { kind: "single"; notification: AppNotification }
  | {
      kind: "day";
      dayKey: string;
      dayLabel: string;
      isToday: boolean;
      title: string;
      priority: "low" | "normal" | "high";
      count: number;
      unreadCount: number;
      members: AppNotification[];
    };

export function useNotifications() {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: () =>
      apiFetch<{ groups: NotificationGroup[]; unreadCount: number }>(
        "/api/notifications?limit=50",
      ),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: 60_000,
    refetchInterval: 2 * 60_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      apiFetch<{ ok: true }>(`/api/notifications/${id}/read`, {
        method: "PATCH",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
  });
}

export function useMarkNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) =>
      apiFetch<{ ok: true }>("/api/notifications/read-batch", {
        method: "POST",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ ok: true }>("/api/notifications/read-all", {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.notifications.all() });
    },
  });
}
