import { Router } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  featureFlagsTable,
  userFlagOverridesTable,
  userProfilesTable,
  FEATURE_KEYS,
  FEATURE_DESCRIPTIONS,
  validRoles,
  type FeatureKey,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { resolveFlags, isAdmin } from "../lib/flags";

const router = Router();

// ─────────────────────────────────────────────
// GET /api/flags
// Returns resolved flag map for the authenticated user.
// ─────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [profile] = await db
      .select({
        activeRole: userProfilesTable.activeRole,
        isHeadTester: userProfilesTable.isHeadTester,
      })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkId));

    const activeRole = profile?.activeRole ?? "athlete";
    const flags = await resolveFlags(clerkId, activeRole, {
      isHeadTester: profile?.isHeadTester === true,
    });
    res.json(flags);
  } catch (err) {
    req.log.error({ err }, "flags.get failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// Admin middleware
// ─────────────────────────────────────────────
function requireAdmin(
  req: Parameters<typeof requireAuth>[0],
  res: Parameters<typeof requireAuth>[1],
  next: Parameters<typeof requireAuth>[2],
) {
  const clerkId = getClerkUserId(req);
  if (!clerkId || !isAdmin(clerkId)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

// ─────────────────────────────────────────────
// GET /api/flags/admin/definitions
// ─────────────────────────────────────────────
router.get("/admin/definitions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(featureFlagsTable);
    const result = FEATURE_KEYS.map((key) => {
      const row = rows.find((r) => r.key === key);
      return {
        key,
        description: FEATURE_DESCRIPTIONS[key as FeatureKey],
        enabledGlobally: row?.enabledGlobally ?? false,
        enabledRoles: row?.enabledRoles ?? [],
        updatedAt: row?.updatedAt ?? null,
      };
    });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "flags.admin.definitions failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// PUT /api/flags/admin/definitions/:key
// Body: { enabledGlobally?: boolean; enabledRoles?: string[]; description?: string }
// ─────────────────────────────────────────────
router.put("/admin/definitions/:key", requireAuth, requireAdmin, async (req, res) => {
  const key = String(req.params.key) as FeatureKey;
  if (!FEATURE_KEYS.includes(key)) {
    res.status(400).json({ error: `Unknown flag key: ${key}` });
    return;
  }

  const { enabledGlobally, enabledRoles, description } = req.body as {
    enabledGlobally?: boolean;
    enabledRoles?: string[];
    description?: string;
  };

  if (enabledRoles !== undefined) {
    const invalid = enabledRoles.filter(
      (r) => !validRoles.includes(r as (typeof validRoles)[number]),
    );
    if (invalid.length) {
      res.status(400).json({ error: `Invalid roles: ${invalid.join(", ")}` });
      return;
    }
  }

  try {
    const [updated] = await db
      .insert(featureFlagsTable)
      .values({
        key,
        description: description ?? FEATURE_DESCRIPTIONS[key],
        enabledGlobally: enabledGlobally ?? false,
        enabledRoles: enabledRoles ?? [],
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: featureFlagsTable.key,
        set: {
          ...(enabledGlobally !== undefined && { enabledGlobally }),
          ...(enabledRoles !== undefined && { enabledRoles }),
          ...(description !== undefined && { description }),
          updatedAt: new Date(),
        },
      })
      .returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "flags.admin.definitions.put failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// GET /api/flags/admin/overrides/:clerkId
// ─────────────────────────────────────────────
router.get("/admin/overrides/:clerkId", requireAuth, requireAdmin, async (req, res) => {
  const clerkId = String(req.params.clerkId);
  try {
    const rows = await db
      .select()
      .from(userFlagOverridesTable)
      .where(eq(userFlagOverridesTable.clerkId, clerkId));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "flags.admin.overrides.get failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// PUT /api/flags/admin/overrides/:clerkId/:key
// Body: { enabled: boolean; reason?: string }
// ─────────────────────────────────────────────
router.put(
  "/admin/overrides/:clerkId/:key",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const clerkId = String(req.params.clerkId);
    const key = String(req.params.key);
    const adminClerkId = getClerkUserId(req)!;

    if (!FEATURE_KEYS.includes(key as FeatureKey)) {
      res.status(400).json({ error: `Unknown flag key: ${key}` });
      return;
    }

    const { enabled, reason } = req.body as { enabled: boolean; reason?: string };
    if (typeof enabled !== "boolean") {
      res.status(400).json({ error: "enabled (boolean) is required" });
      return;
    }

    try {
      const [row] = await db
        .insert(userFlagOverridesTable)
        .values({
          clerkId,
          flagKey: key,
          enabled,
          setBy: adminClerkId,
          reason: reason ?? null,
          setAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [userFlagOverridesTable.clerkId, userFlagOverridesTable.flagKey],
          // Do NOT include clerkId/flagKey in set — they are the PK conflict columns.
          set: {
            enabled,
            setBy: adminClerkId,
            reason: reason ?? null,
            setAt: new Date(),
          },
        })
        .returning();
      res.json(row);
    } catch (err) {
      req.log.error({ err }, "flags.admin.overrides.put failed");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ─────────────────────────────────────────────
// DELETE /api/flags/admin/overrides/:clerkId/:key
// ─────────────────────────────────────────────
router.delete(
  "/admin/overrides/:clerkId/:key",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const clerkId = String(req.params.clerkId);
    const key = String(req.params.key);
    if (!FEATURE_KEYS.includes(key as FeatureKey)) {
      res.status(400).json({ error: `Unknown flag key: ${key}` });
      return;
    }
    try {
      await db
        .delete(userFlagOverridesTable)
        .where(
          and(
            eq(userFlagOverridesTable.clerkId, clerkId),
            eq(userFlagOverridesTable.flagKey, key),
          ),
        );
      res.status(204).end();
    } catch (err) {
      req.log.error({ err }, "flags.admin.overrides.delete failed");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ─────────────────────────────────────────────
// GET /api/flags/admin/resolve/:clerkId
// Preview resolved flags for any user (debugging).
// ─────────────────────────────────────────────
router.get(
  "/admin/resolve/:clerkId",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const clerkId = String(req.params.clerkId);
    try {
      const [profile] = await db
        .select({
          activeRole: userProfilesTable.activeRole,
          isHeadTester: userProfilesTable.isHeadTester,
        })
        .from(userProfilesTable)
        .where(eq(userProfilesTable.clerkId, clerkId));

      const activeRole = String(profile?.activeRole ?? "athlete");
      const flags = await resolveFlags(clerkId, activeRole, {
        isHeadTester: profile?.isHeadTester === true,
      });
      res.json({ clerkId, activeRole, flags });
    } catch (err) {
      req.log.error({ err }, "flags.admin.resolve failed");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
