import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, userProfilesTable, validRoles, type Role } from "@workspace/db";
import {
  requireAuth,
  getClerkUserId,
  hasRealSession,
  getClerkVerifiedEmail,
} from "../lib/auth";
import { ensureAccount } from "../lib/account";
import { isAdmin } from "../lib/flags";
import { assignHeadTesterNumber } from "../engines/insights";

const router = Router();

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
    const healed = await withHeadTesterNumber(profile, req.log);
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

    const healed = await withHeadTesterNumber(profile, req.log);
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

    const [updated] = await db
      .update(userProfilesTable)
      .set({ activeRole: role as string, updatedAt: new Date() })
      .where(eq(userProfilesTable.clerkId, clerkId))
      .returning();

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "auth.me.role failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
