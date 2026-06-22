import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { apiFetch } from "@/lib/api";
import { queryKeys, STALE } from "@/lib/query-keys";
import type { FtpHistoryEntry } from "@/lib/athlete-types";

export function useFtpHistory() {
  const { isSignedIn } = useUser();

  return useQuery({
    queryKey: queryKeys.athlete.ftpHistory(),
    queryFn: () => apiFetch<FtpHistoryEntry[]>("/api/athlete/ftp"),
    enabled: isSignedIn === true,
    staleTime: STALE.profile,
  });
}

export function useLogFtp() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: { ftpWatts: number; testType?: string; notes?: string }) =>
      apiFetch<FtpHistoryEntry>("/api/athlete/ftp", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.ftpHistory() });
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.profile() });
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.dashboard() });
    },
  });
}
