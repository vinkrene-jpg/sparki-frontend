import { eq } from "drizzle-orm";
import { db, privacySettingsTable, type PrivacySettings } from "@workspace/db";

// Effective privacy settings: the stored row, or schema-equivalent defaults when
// the user has no row yet. Centralised so AI/coach/parent code never has to
// special-case "no settings yet".
export type EffectivePrivacy = Pick<
  PrivacySettings,
  | "aiMemoryEnabled"
  | "aiSensitiveAnalysisEnabled"
  | "aiHealthAnalysisEnabled"
  | "aiVisionEnabled"
  | "aiDocumentAnalysisEnabled"
  | "aiCoachingEnabled"
  | "shareActivityWithFriends"
  | "dataSharingCoach"
  | "dataSharingParent"
  | "parentConsentRequired"
  | "parentConsentStatus"
  | "exportAllowed"
>;

// Fail-closed: zonder opgeslagen rij is er géén bewijs van toestemming, dus
// alle externe-verwerkingstoestemmingen staan standaard UIT.
const DEFAULTS: EffectivePrivacy = {
  aiMemoryEnabled: false,
  aiSensitiveAnalysisEnabled: false,
  aiHealthAnalysisEnabled: false,
  aiVisionEnabled: false,
  aiDocumentAnalysisEnabled: false,
  aiCoachingEnabled: false,
  shareActivityWithFriends: false,
  dataSharingCoach: "summary",
  dataSharingParent: "safety_only",
  parentConsentRequired: false,
  parentConsentStatus: "not_required",
  exportAllowed: true,
};

export async function getEffectivePrivacy(
  clerkId: string,
): Promise<EffectivePrivacy> {
  const [row] = await db
    .select()
    .from(privacySettingsTable)
    .where(eq(privacySettingsTable.clerkId, clerkId));
  if (!row) return { ...DEFAULTS };
  return {
    aiMemoryEnabled: row.aiMemoryEnabled,
    aiSensitiveAnalysisEnabled: row.aiSensitiveAnalysisEnabled,
    aiHealthAnalysisEnabled: row.aiHealthAnalysisEnabled,
    aiVisionEnabled: row.aiVisionEnabled,
    aiDocumentAnalysisEnabled: row.aiDocumentAnalysisEnabled,
    aiCoachingEnabled: row.aiCoachingEnabled,
    shareActivityWithFriends: row.shareActivityWithFriends,
    dataSharingCoach: row.dataSharingCoach,
    dataSharingParent: row.dataSharingParent,
    parentConsentRequired: row.parentConsentRequired,
    parentConsentStatus: row.parentConsentStatus,
    exportAllowed: row.exportAllowed,
  };
}
