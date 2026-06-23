import { eq } from "drizzle-orm";
import { db, privacySettingsTable, type PrivacySettings } from "@workspace/db";

// Effective privacy settings: the stored row, or schema-equivalent defaults when
// the user has no row yet. Centralised so AI/coach/parent code never has to
// special-case "no settings yet".
export type EffectivePrivacy = Pick<
  PrivacySettings,
  | "aiMemoryEnabled"
  | "aiSensitiveAnalysisEnabled"
  | "shareActivityWithFriends"
  | "dataSharingCoach"
  | "dataSharingParent"
  | "parentConsentRequired"
  | "parentConsentStatus"
  | "exportAllowed"
>;

const DEFAULTS: EffectivePrivacy = {
  aiMemoryEnabled: true,
  aiSensitiveAnalysisEnabled: true,
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
    shareActivityWithFriends: row.shareActivityWithFriends,
    dataSharingCoach: row.dataSharingCoach,
    dataSharingParent: row.dataSharingParent,
    parentConsentRequired: row.parentConsentRequired,
    parentConsentStatus: row.parentConsentStatus,
    exportAllowed: row.exportAllowed,
  };
}
