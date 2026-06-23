import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db, userProfilesTable, athleteProfilesTable, validRoles, type Role } from "@workspace/db";
import { requireAuth, getClerkUserId, hasRealSession, getClerkVerifiedEmail } from "../lib/auth";
import { isAdmin } from "../lib/flags";

const router = Router();

// POST /api/auth/sync
// Idempotent first-login provisioning. Identity (email) is read from Clerk
// server-side; only `displayName` is taken from the body.
// Body: { displayName?: string }
router.post("/sync", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const { displayName } = req.body as { email?: string; displayName?: string };

  // Identity MUST come from Clerk, never from the request body. The re-link
  // below reassigns an existing profile to the caller's clerkId, so trusting a
  // client-supplied email would be an account-takeover vector. In dev (auth
  // bypass, no real Clerk session) we fall back to the body email — dev is not a
  // security boundary and there is no Clerk user to query.
  const verifiedEmail = await getClerkVerifiedEmail(req);
  const email = hasRealSession(req)
    ? verifiedEmail
    : ((req.body as { email?: string })?.email ?? null);

  if (!email) {
    res.status(400).json({ error: "Geen geverifieerd e-mailadres gevonden." });
    return;
  }

  try {
    await db
      .insert(userProfilesTable)
      .values({ clerkId, email, displayName: displayName ?? null, roles: ["athlete"], activeRole: "athlete" })
      .onConflictDoNothing();

    // Confirm the row for THIS clerkId exists before touching athlete_profiles.
    // The user_profiles insert can no-op when `email` is already taken by a
    // different clerkId (the email unique constraint). That happens when the same
    // person re-creates their Clerk account (new clerkId, same verified email):
    // their old profile row is left pointing at the now-defunct clerkId.
    let [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkId));

    if (!profile) {
      // Re-link the orphaned profile to the current clerkId. Safe because the
      // email is Clerk-verified (above) and Clerk enforces unique verified
      // emails per instance, so the previous clerkId is provably defunct. Child
      // rows follow via ON UPDATE CASCADE, preserving the user's history. The
      // conditional update + row-count check guards against any race.
      const [byEmail] = await db
        .select()
        .from(userProfilesTable)
        .where(eq(userProfilesTable.email, email));

      if (byEmail && byEmail.clerkId !== clerkId) {
        req.log.warn(
          { fromClerkId: byEmail.clerkId, toClerkId: clerkId },
          "auth.sync: re-linking profile to re-created account",
        );
        const relinked = await db
          .update(userProfilesTable)
          .set({
            clerkId,
            displayName: displayName ?? byEmail.displayName,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(userProfilesTable.clerkId, byEmail.clerkId),
              eq(userProfilesTable.email, email),
            ),
          )
          .returning({ clerkId: userProfilesTable.clerkId });

        if (relinked.length === 1) {
          [profile] = await db
            .select()
            .from(userProfilesTable)
            .where(eq(userProfilesTable.clerkId, clerkId));
        }
      }
    }

    if (!profile) {
      req.log.error({ clerkId }, "auth.sync: could not provision profile");
      res.status(500).json({ error: "Kon je account niet aanmaken." });
      return;
    }

    await db
      .insert(athleteProfilesTable)
      .values({ clerkId })
      .onConflictDoNothing();

    res.json(profile);
  } catch (err) {
    req.log.error({ err }, "auth.sync failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/me
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

    res.json({ ...profile, isAdmin: isAdmin(clerkId) });
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
    res.status(400).json({ error: `role must be one of: ${validRoles.join(", ")}` });
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
