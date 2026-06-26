import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type ReminderPreferences = {
  enabled: boolean;
  checkins: boolean;
  followups: boolean;
  training: boolean;
  races: boolean;
};

export function useReminderPreferences(enabled = true) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.reminderPreferences.settings(),
    queryFn: () =>
      apiFetch<{ preferences: ReminderPreferences }>(
        "/api/notifications/preferences",
      ),
    enabled: (isSignedIn === true || DEV_PREVIEW) && enabled,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateReminderPreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<ReminderPreferences>) =>
      apiFetch<{ preferences: ReminderPreferences }>(
        "/api/notifications/preferences",
        {
          method: "PUT",
          body: JSON.stringify(patch),
        },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({
        queryKey: queryKeys.reminderPreferences.settings(),
      });
    },
  });
}
