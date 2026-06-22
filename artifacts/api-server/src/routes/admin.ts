import { Router } from "express";
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { isAdmin } from "../lib/flags";

const router = Router();

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

// GET /api/admin/whoami — lets the client know if the caller is an admin so it
// can conditionally render the admin area (the real guard is server-side).
router.get("/whoami", requireAuth, (req, res) => {
  const clerkId = getClerkUserId(req)!;
  res.json({ clerkId, isAdmin: isAdmin(clerkId) });
});

// GET /api/admin/status — high-level system status counts (admin only).
router.get("/status", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        (SELECT count(*) FROM user_profiles)::int AS users,
        (SELECT count(*) FROM user_profiles WHERE 'coach' = ANY(roles))::int AS coaches,
        (SELECT count(*) FROM user_profiles WHERE 'parent' = ANY(roles))::int AS parents,
        (SELECT count(*) FROM ai_observations)::int AS observations,
        (SELECT count(*) FROM ai_observations WHERE status IN ('new','acknowledged','saved'))::int AS active_observations,
        (SELECT count(*) FROM privacy_settings WHERE ai_memory_enabled = true)::int AS ai_memory_enabled,
        (SELECT count(*) FROM coach_athlete_links WHERE status = 'accepted')::int AS coach_links,
        (SELECT count(*) FROM parent_athlete_links WHERE status = 'accepted')::int AS parent_links,
        (SELECT count(*) FROM nutrition_hydration_logs)::int AS nutrition_logs,
        (SELECT count(*) FROM activity_imports)::int AS activity_imports,
        (SELECT count(*) FROM notifications)::int AS notifications,
        (SELECT count(*) FROM bug_reports)::int AS bug_reports,
        (SELECT count(*) FROM bug_reports WHERE status = 'new')::int AS bug_reports_new
    `);
    res.json({ status: result.rows[0] ?? {} });
  } catch (err) {
    req.log.error({ err }, "admin.status failed");
    res.status(500).json({ error: "Kon status niet laden" });
  }
});

export default router;
