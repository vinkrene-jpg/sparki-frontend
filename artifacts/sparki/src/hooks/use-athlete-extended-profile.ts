import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";
import type { AthleteProfile } from "@/lib/athlete-types";

export function useAthleteExtendedProfile() {
  const { isSignedIn } = useUser();

  return useQuery({
    queryKey: queryKeys.athlete.profile(),
    queryFn: () => apiFetch<AthleteProfile>("/api/athlete/profile"),
    enabled: isSignedIn === true || DEV_PREVIEW,
    staleTime: STALE.profile,
  });
}

export function useUpdateAthleteProfile() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<AthleteProfile>) =>
      apiFetch<AthleteProfile>("/api/athlete/profile", {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.profile() });
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.dashboard() });
    },
  });
}
