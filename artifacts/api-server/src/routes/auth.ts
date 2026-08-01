import { Router, type Request } from "express";
import { eq } from "drizzle-orm";
import { db, userProfilesTable, validRoles, type Role } from "@workspace/db";
import {
  requireAuth,
  getClerkUserId,
  hasRealSession,
  getClerkVerifiedEmail,
} from "../lib/auth";
import { writeAudit } from "../lib/security/audit";
import {
  nutritionSpecialistRequiredTier,
  resolveEntitlements,
} from "../lib/entitlements";
import { ensureAccount } from "../lib/account";
import { isAdmin } from "../lib/flags";
import { assignHeadTesterNumber } from "../engines/insights";

const router = Router();

// Map a User-Agent string to a coarse, plain-language device label for the
// tester overview. Returns null (honest "onbekend") when it can't be told —
// never guesses.
function platformFromUserAgent(ua: string | undefined): string | null {
  if (!ua) return null;
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android";
  if (/Macintosh|Windows NT|Linux|CrOS/i.test(ua)) return "Desktop";
  return null;
}

// Refresh lightweight session telemetry (last seen, device, app version) on
// every authenticated read. Returns the updated row so the response reflects
// the new values immediately. Device/version are only written when actually
// present — a missing signal leaves the prior honest value untouched.
async function recordTelemetry<
  T extends { clerkId: string },
>(req: Request, profile: T): Promise<T> {
  const platform = platformFromUserAgent(req.get("user-agent") ?? undefined);
  const headerVersion = req.get("x-sparki-app-version");
  const appVersion =
    headerVersion && headerVersion.trim() ? headerVersion.trim() : null;

  const set: Record<string, unknown> = { lastSeenAt: new Date() };
  if (platform) set["lastPlatform"] = platform;
  if (appVersion) set["appVersion"] = appVersion;

  try {
    const [row] = await db
      .update(userProfilesTable)
      .set(set)
      .where(eq(userProfilesTable.clerkId, profile.clerkId))
      .returning();
    return row ? ({ ...profile, ...row } as T) : profile;
  } catch (err) {
    req.log.error({ err }, "auth: telemetry update failed");
    return profile;
  }
}

// Self-heal the Hoofdtester badge number. The invite-accept path assigns it
// best-effort *after* the accept commits, so a transient hiccup could leave a
// profile with isHeadTester=true but headTesterNumber=null. assignHeadTesterNumber
// is idempotent (returns the existing number if already set), so calling it here
// whenever the number is missing closes that gap on the next sync/read — the head
// tester never gets stuck without a number.
async function withHeadTesterNumber<
  T extends {
    clerkId: string;
    isHeadTester?: boolean | null;
    headTesterNumber?: number | null;
  },
>(profile: T, log: { error: (obj: unknown, msg?: string) => void }): Promise<T> {
  if (!profile.isHeadTester || profile.headTesterNumber != null) return profile;
  try {
    const n = await assignHeadTesterNumber(profile.clerkId);
    return { ...profile, headTesterNumber: n };
  } catch (err) {
    log.error({ err }, "auth: head-tester number backfill failed");
    return profile;
  }
}

// POST /api/auth/sync
// Idempotent first-login provisioning AND every-login self-healing. Identity
// (email) is read from Clerk server-side; only `displayName` comes from the body.
// Body: { displayName?: string }
router.post("/sync", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const { displayName } = req.body as { email?: string; displayName?: string };

  // Identity MUST come from Clerk, never from the request body. The re-link in
  // ensureAccount reassigns an existing profile to the caller's clerkId, so
  // trusting a client-supplied email would be an account-takeover vector. In dev
  // (auth bypass, no real Clerk session) we fall back to the body email — dev is
  // not a security boundary and there is no Clerk user to query.
  const verifiedEmail = await getClerkVerifiedEmail(req);
  const email = hasRealSession(req)
    ? verifiedEmail
    : ((req.body as { email?: string })?.email ?? null);

  if (!email) {
    res.status(400).json({ error: "Geen geverifieerd e-mailadres gevonden." });
    return;
  }

  try {
    const profile = await ensureAccount(
      clerkId,
      email,
      displayName ?? null,
      req.log,
    );
    if (!profile) {
      res.status(500).json({ error: "Kon je account niet aanmaken." });
      return;
    }
    const tracked = await recordTelemetry(req, profile);
    const healed = await withHeadTesterNumber(tracked, req.log);
    res.json({ ...healed, isAdmin: isAdmin(clerkId) });
  } catch (err) {
    req.log.error({ err }, "auth.sync failed");
    res
      .status(500)
      .json({ error: "Er ging iets mis bij het klaarzetten van je account." });
  }
});

// GET /api/auth/me — read-only for provisioning (sync is the provisioning path;
// a missing profile here means sync has not run/succeeded yet). The one narrow
// exception is the idempotent Hoofdtester-number backfill below, which closes a
// best-effort gap from invite-accept without re-provisioning anything else.
router.get("/me", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;

  try {
    const [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkId));

    if (!profile) {
      res.status(404).json({ error: "Profile not found. Call /sync first." });
      return;
    }

    const tracked = await recordTelemetry(req, profile);
    const healed = await withHeadTesterNumber(tracked, req.log);
    res.json({ ...healed, isAdmin: isAdmin(clerkId) });
  } catch (err) {
    req.log.error({ err }, "auth.me failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/auth/me/role
router.put("/me/role", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const { role } = req.body as { role: unknown };

  if (!role || !validRoles.includes(role as Role)) {
    res
      .status(400)
      .json({ error: `role must be one of: ${validRoles.join(", ")}` });
    return;
  }

  try {
    const [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkId));

    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    if (!profile.roles.includes(role as Role)) {
      res.status(403).json({ error: "User does not have this role" });
      return;
    }

    // BB-14 (besluit 01-08-2026): commerciële plaatsing van
    // nutrition_specialist is configureerbaar met lege waarde. Alleen wanneer
    // een tier expliciet geconfigureerd is, eist wisselen naar deze rol in
    // subscription-modus precies die tier — nooit een terugval op trainer- of
    // Complete-rechten. Leeg (default) = geen commerciële voorwaarde.
    if (role === "nutrition_specialist") {
      const vereisteTier = nutritionSpecialistRequiredTier();
      if (vereisteTier) {
        const rechten = await resolveEntitlements(clerkId);
        if (rechten.entitlementMode === "subscription") {
          const [rij] = await db
            .select({ commercialTier: userProfilesTable.commercialTier })
            .from(userProfilesTable)
            .where(eq(userProfilesTable.clerkId, clerkId));
          if (rij?.commercialTier !== vereisteTier) {
            res.status(403).json({
              error: `Deze rol vereist het ${vereisteTier}-abonnement`,
            });
            return;
          }
        }
      }
    }

    const [updated] = await db
      .update(userProfilesTable)
      .set({ activeRole: role as string, updatedAt: new Date() })
      .where(eq(userProfilesTable.clerkId, clerkId))
      .returning();

    void writeAudit({
      event: "role_change",
      actorClerkId: clerkId,
      subjectClerkId: clerkId,
      meta: { van: profile.activeRole, naar: role },
      req,
    });
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "auth.me.role failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
