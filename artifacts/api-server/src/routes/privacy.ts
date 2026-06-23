import { Router } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  privacySettingsTable,
  consentAuditLogTable,
  dataSharingCoachLevels,
  dataSharingParentLevels,
  parentConsentStatuses,
  type PrivacySettings,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";

const router = Router();

// Schema-equivalent defaults returned when a user has no privacy row yet.
function defaults(clerkId: string) {
  return {
    clerkId,
    consentVersion: "1",
    acceptedTermsAt: null,
    acceptedPrivacyAt: null,
    parentConsentRequired: false,
    parentConsentStatus: "not_required",
    dataSharingCoach: "summary",
    dataSharingParent: "safety_only",
    aiMemoryEnabled: true,
    aiSensitiveAnalysisEnabled: true,
    shareActivityWithFriends: false,
    marketingConsent: false,
    exportAllowed: true,
    deleteRequestedAt: null,
  };
}

// Fields a user may change, with their validators.
const BOOLEAN_FIELDS = [
  "parentConsentRequired",
  "aiMemoryEnabled",
  "aiSensitiveAnalysisEnabled",
  "shareActivityWithFriends",
  "marketingConsent",
  "exportAllowed",
] as const;

const ENUM_FIELDS: Record<string, readonly string[]> = {
  dataSharingCoach: dataSharingCoachLevels,
  dataSharingParent: dataSharingParentLevels,
  parentConsentStatus: parentConsentStatuses,
};

router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [row] = await db
      .select()
      .from(privacySettingsTable)
      .where(eq(privacySettingsTable.clerkId, clerkId));
    res.json({ privacy: row ?? defaults(clerkId) });
  } catch (err) {
    req.log.error({ err }, "privacy.get failed");
    res.status(500).json({ error: "Failed to load privacy settings" });
  }
});

router.put("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = req.body as Record<string, unknown>;

  // Validate provided fields.
  const updates: Record<string, unknown> = {};
  for (const f of BOOLEAN_FIELDS) {
    if (f in body) {
      if (typeof body[f] !== "boolean") {
        res.status(400).json({ error: `${f} must be boolean` });
        return;
      }
      updates[f] = body[f];
    }
  }
  for (const [f, allowed] of Object.entries(ENUM_FIELDS)) {
    if (f in body) {
      if (!allowed.includes(String(body[f]))) {
        res.status(400).json({ error: `invalid ${f}` });
        return;
      }
      updates[f] = String(body[f]);
    }
  }
  // Accept-now actions (set timestamp to now).
  if (body.acceptTerms === true) updates.acceptedTermsAt = new Date();
  if (body.acceptPrivacy === true) updates.acceptedPrivacyAt = new Date();

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "no valid fields to update" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(privacySettingsTable)
      .where(eq(privacySettingsTable.clerkId, clerkId));
    const before = (existing ?? defaults(clerkId)) as Record<
      string,
      unknown
    > & PrivacySettings;

    const [row] = await db
      .insert(privacySettingsTable)
      .values({ clerkId, ...updates, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: privacySettingsTable.clerkId,
        set: { ...updates, updatedAt: new Date() },
      })
      .returning();

    // Append-only audit trail for each changed field.
    const auditRows = Object.entries(updates)
      .filter(([k]) => k !== "updatedAt")
      .map(([field, newValue]) => ({
        clerkId,
        field,
        oldValue: before[field] != null ? String(before[field]) : null,
        newValue: newValue != null ? String(newValue) : null,
        changedBy: clerkId,
      }))
      .filter((a) => a.oldValue !== a.newValue);
    if (auditRows.length > 0) {
      await db.insert(consentAuditLogTable).values(auditRows);
    }

    res.json({ privacy: row });
  } catch (err) {
    req.log.error({ err }, "privacy.put failed");
    res.status(500).json({ error: "Failed to save privacy settings" });
  }
});

export default router;
