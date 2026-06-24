import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export interface SaveFtpEstimateInput {
  ftp: number;
  experienceLevel?: string;
}

/**
 * Persist an estimated FTP. Always marks ftpEstimated=true so the value is
 * honestly flagged as a quick-start estimate and can be refined later with a
 * real test.
 */
export function useSaveFtpEstimate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveFtpEstimateInput) =>
      apiFetch("/api/athlete/profile", {
        method: "PUT",
        body: JSON.stringify({
          ftp: data.ftp,
          ftpEstimated: true,
          ...(data.experienceLevel && { experienceLevel: data.experienceLevel }),
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.profile() });
      void qc.invalidateQueries({ queryKey: queryKeys.athlete.dashboard() });
    },
  });
}
