import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@clerk/react";
import { DEV_PREVIEW } from "@/lib/dev";
import { apiFetch } from "@/lib/api";
import { queryKeys } from "@/lib/query-keys";

export type PrivacySettings = {
  consentVersion: string;
  acceptedTermsAt: string | null;
  acceptedPrivacyAt: string | null;
  parentConsentRequired: boolean;
  parentConsentStatus: "not_required" | "pending" | "granted" | "revoked";
  dataSharingCoach: "none" | "summary" | "full";
  dataSharingParent: "none" | "safety_only" | "summary";
  aiMemoryEnabled: boolean;
  aiSensitiveAnalysisEnabled: boolean;
  aiHealthAnalysisEnabled: boolean;
  aiVisionEnabled: boolean;
  aiDocumentAnalysisEnabled: boolean;
  aiCoachingEnabled: boolean;
  marketingConsent: boolean;
  exportAllowed: boolean;
  deleteRequestedAt: string | null;
};

export function usePrivacySettings(enabled = true) {
  const { isSignedIn } = useUser();
  return useQuery({
    queryKey: queryKeys.privacy.settings(),
    queryFn: () => apiFetch<{ privacy: PrivacySettings }>("/api/privacy"),
    enabled: (isSignedIn === true || DEV_PREVIEW) && enabled,
    staleTime: 5 * 60_000,
  });
}

export function useUpdatePrivacySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<PrivacySettings>) =>
      apiFetch<{ privacy: PrivacySettings }>("/api/privacy", {
        method: "PUT",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.privacy.settings() });
    },
  });
}
