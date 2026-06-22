import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, userProfilesTable, athleteProfilesTable, validRoles, type Role } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { isAdmin } from "../lib/flags";

const router = Router();

// POST /api/auth/sync
// Idempotent first-login provisioning.
// Body: { email: string; displayName?: string }
router.post("/sync", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const { email, displayName } = req.body as { email: string; displayName?: string };

  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  try {
    await db
      .insert(userProfilesTable)
      .values({ clerkId, email, displayName: displayName ?? null, roles: ["athlete"], activeRole: "athlete" })
      .onConflictDoNothing();

    await db
      .insert(athleteProfilesTable)
      .values({ clerkId })
      .onConflictDoNothing();

    const [profile] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkId));

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
