import { Router } from "express";
import { sql, desc, eq } from "drizzle-orm";
import {
  db,
  onboardingStateTable,
  healthCheckResultsTable,
  healthCheckRunsTable,
  healthCheckBatchesTable,
  userProfilesTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { isAdmin } from "../lib/flags";
import { runHealthChecks, runSingleCheck } from "../lib/health/engine";
import {
  healthCheckDefinitions,
  getCheckDefinition,
} from "../lib/health/checks";

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

// POST /api/admin/reset-onboarding — replays the onboarding flow for the calling
// admin so it can be tested on demand. Clears the completion flags + adaptive
// fact state; the athlete profile is left intact (quick-start re-upserts it).
router.post("/reset-onboarding", requireAuth, requireAdmin, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    await db
      .insert(onboardingStateTable)
      .values({ clerkId, isComplete: false })
      .onConflictDoUpdate({
        target: onboardingStateTable.clerkId,
        set: {
          isComplete: false,
          onboardingCompletedAt: null,
          coreCompletedAt: null,
          completedSteps: [],
          skippedSteps: [],
          currentStep: 0,
          progressiveFacts: {},
          updatedAt: new Date(),
        },
      });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "admin.reset-onboarding failed");
    res.status(500).json({ error: "Kon onboarding niet resetten" });
  }
});

// ── Health dashboard ──────────────────────────────────────────────────────────

// Build the plain-language dashboard snapshot: per-check latest status (joined
// against the definition registry so checks that never ran show as "grey/onbekend"),
// grouped by category, plus the operational aggregates an admin watches daily.
router.get("/health", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(healthCheckResultsTable);
    const byKey = new Map(rows.map((r) => [r.checkKey, r]));

    // Always render every defined check, even before its first run.
    const checks = healthCheckDefinitions.map((def) => {
      const r = byKey.get(def.key);
      if (!r) {
        return {
          checkKey: def.key,
          category: def.category,
          title: def.title,
          description: def.description,
          responsibleModule: def.responsibleModule,
          statusColor: "grey" as const,
          passed: false,
          responseTimeMs: null,
          lastRunAt: null,
          lastSuccessAt: null,
          errorMessage: "Nog niet gecontroleerd.",
          technicalDetails: null,
          userImpact: def.userImpact,
          urgency: def.urgency,
          remediation: def.remediation,
          resolvedAt: null,
        };
      }
      return {
        checkKey: r.checkKey,
        category: r.category,
        title: r.title,
        description: r.description,
        responsibleModule: r.responsibleModule,
        statusColor: r.statusColor,
        passed: r.passed,
        responseTimeMs: r.responseTimeMs,
        lastRunAt: r.lastRunAt,
        lastSuccessAt: r.lastSuccessAt,
        errorMessage: r.errorMessage,
        technicalDetails: r.technicalDetails,
        userImpact: r.userImpact,
        urgency: r.urgency,
        remediation: r.remediation,
        resolvedAt: r.resolvedAt,
      };
    });

    // Worst non-grey status drives the overall headline.
    const severity = { green: 0, grey: 0, orange: 1, red: 2 } as const;
    let overall: "green" | "orange" | "red" | "grey" = "green";
    for (const c of checks) {
      if (severity[c.statusColor] > severity[overall]) overall = c.statusColor;
    }

    // Open failures = red/orange that are not acknowledged.
    const openErrors = checks
      .filter(
        (c) =>
          (c.statusColor === "red" || c.statusColor === "orange") &&
          !c.resolvedAt,
      )
      .sort(
        (a, b) =>
          (b.statusColor === "red" ? 1 : 0) - (a.statusColor === "red" ? 1 : 0),
      );

    const [lastBatch] = await db
      .select()
      .from(healthCheckBatchesTable)
      .orderBy(desc(healthCheckBatchesTable.startedAt))
      .limit(1);

    const lastRunAt =
      checks.reduce<Date | null>((acc, c) => {
        if (!c.lastRunAt) return acc;
        return !acc || c.lastRunAt > acc ? c.lastRunAt : acc;
      }, null) ?? null;
    const lastSuccessAt =
      checks.reduce<Date | null>((acc, c) => {
        if (!c.lastSuccessAt) return acc;
        return !acc || c.lastSuccessAt > acc ? c.lastSuccessAt : acc;
      }, null) ?? null;

    // Operational aggregates (plain-language friendly numbers).
    const agg = await db.execute(sql`
      SELECT
        (SELECT count(*) FROM user_profiles)::int AS active_users,
        (SELECT count(*) FROM user_profiles WHERE created_at > now() - interval '7 days')::int AS new_registrations,
        (SELECT count(*) FROM bug_reports WHERE status = 'new')::int AS open_bug_reports,
        (SELECT count(*) FROM workout_feedback)::int AS feedback_messages,
        (SELECT count(*) FROM activity_imports WHERE status = 'failed')::int AS failed_imports,
        (SELECT count(*) FROM invitations WHERE status = 'pending' AND expires_at < now())::int AS expired_tokens
    `);

    res.json({
      overall,
      lastRunAt,
      lastSuccessAt,
      checks,
      openErrors,
      lastBatch: lastBatch ?? null,
      aggregates: agg.rows[0] ?? {},
    });
  } catch (err) {
    req.log.error({ err }, "admin.health failed");
    res.status(500).json({ error: "Kon de gezondheidsstatus niet laden" });
  }
});

// POST /api/admin/health/run — run the engine now ("Controleer nu").
// Body: { mode?: "manual"|"weekly", key?: string } — key runs a single check.
router.post("/health/run", requireAuth, requireAdmin, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as { mode?: string; key?: string };
  try {
    if (body.key) {
      if (!getCheckDefinition(String(body.key))) {
        res.status(404).json({ error: "Onbekende controle" });
        return;
      }
      const outcome = await runSingleCheck(String(body.key), clerkId);
      res.json({ ok: true, outcome });
      return;
    }
    const mode = body.mode === "weekly" ? "weekly" : "manual";
    const { batchId, outcomes } = await runHealthChecks({
      mode,
      triggeredBy: clerkId,
    });
    res.json({ ok: true, batchId, outcomes });
  } catch (err) {
    req.log.error({ err }, "admin.health.run failed");
    res.status(500).json({ error: "De controle kon niet worden uitgevoerd" });
  }
});

// GET /api/admin/health/check/:key — single check detail + recent history.
router.get(
  "/health/check/:key",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const key = String(req.params.key);
    const def = getCheckDefinition(key);
    if (!def) {
      res.status(404).json({ error: "Onbekende controle" });
      return;
    }
    try {
      const [result] = await db
        .select()
        .from(healthCheckResultsTable)
        .where(eq(healthCheckResultsTable.checkKey, key));

      const history = await db
        .select()
        .from(healthCheckRunsTable)
        .where(eq(healthCheckRunsTable.checkKey, key))
        .orderBy(desc(healthCheckRunsTable.ranAt))
        .limit(50);

      res.json({
        check: result
          ? {
              checkKey: result.checkKey,
              category: result.category,
              title: result.title,
              description: result.description,
              responsibleModule: result.responsibleModule,
              statusColor: result.statusColor,
              passed: result.passed,
              responseTimeMs: result.responseTimeMs,
              lastRunAt: result.lastRunAt,
              lastSuccessAt: result.lastSuccessAt,
              errorMessage: result.errorMessage,
              technicalDetails: result.technicalDetails,
              userImpact: result.userImpact,
              urgency: result.urgency,
              remediation: result.remediation,
              resolvedAt: result.resolvedAt,
              resolvedBy: result.resolvedBy,
            }
          : {
              // Never-run check: show the definition's metadata honestly.
              checkKey: def.key,
              category: def.category,
              title: def.title,
              description: def.description,
              responsibleModule: def.responsibleModule,
              statusColor: "grey",
              passed: false,
              responseTimeMs: null,
              lastRunAt: null,
              lastSuccessAt: null,
              errorMessage: "Nog niet gecontroleerd.",
              technicalDetails: null,
              userImpact: def.userImpact,
              urgency: def.urgency,
              remediation: def.remediation,
              resolvedAt: null,
              resolvedBy: null,
            },
        history,
      });
    } catch (err) {
      req.log.error({ err }, "admin.health.check failed");
      res.status(500).json({ error: "Kon de controle niet laden" });
    }
  },
);

// POST /api/admin/health/check/:key/resolve — acknowledge a failure as handled.
router.post(
  "/health/check/:key/resolve",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const clerkId = getClerkUserId(req)!;
    const key = String(req.params.key);
    if (!getCheckDefinition(key)) {
      res.status(404).json({ error: "Onbekende controle" });
      return;
    }
    try {
      const [row] = await db
        .update(healthCheckResultsTable)
        .set({ resolvedAt: new Date(), resolvedBy: clerkId, updatedAt: new Date() })
        .where(eq(healthCheckResultsTable.checkKey, key))
        .returning({ checkKey: healthCheckResultsTable.checkKey });
      if (!row) {
        res.status(404).json({ error: "Deze controle is nog niet uitgevoerd" });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      req.log.error({ err }, "admin.health.resolve failed");
      res.status(500).json({ error: "Kon niet als opgelost markeren" });
    }
  },
);

// ── Tester overview ───────────────────────────────────────────────────────────

// GET /api/admin/testers — one row per invitation (the tester roster), joined to
// the accepter's profile (when accepted) + their feedback counts. Everything is
// real, aggregated data: pending invites show only what's known (email + date),
// accepted testers add name, number, role, last login, device, app version and
// feedback/bug/idea counts. Missing telemetry stays NULL (honest "—"), never faked.
router.get("/testers", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        i.id                       AS "invitationId",
        i.email                    AS "inviteEmail",
        i.relationship             AS "relationship",
        i.target_role              AS "targetRole",
        i.status                   AS "inviteStatus",
        i.created_at               AS "invitedAt",
        i.accepted_by_clerk_id     AS "acceptedByClerkId",
        up.display_name            AS "displayName",
        up.email                   AS "profileEmail",
        up.roles                   AS "roles",
        up.is_head_tester          AS "isHeadTester",
        up.head_tester_number      AS "headTesterNumber",
        up.last_seen_at            AS "lastSeenAt",
        up.last_platform           AS "lastPlatform",
        up.app_version             AS "appVersion",
        up.tester_completed_at     AS "testerCompletedAt",
        COALESCE(br.total, 0)::int AS "feedbackTotal",
        COALESCE(br.bugs, 0)::int  AS "bugs",
        COALESCE(br.ideas, 0)::int AS "ideas"
      FROM invitations i
      LEFT JOIN user_profiles up ON up.clerk_id = i.accepted_by_clerk_id
      LEFT JOIN (
        SELECT clerk_id,
               count(*)                              AS total,
               count(*) FILTER (WHERE kind = 'bug')  AS bugs,
               count(*) FILTER (WHERE kind = 'idea') AS ideas
        FROM bug_reports
        GROUP BY clerk_id
      ) br ON br.clerk_id = i.accepted_by_clerk_id
      ORDER BY i.created_at DESC
    `);
    res.json({ testers: result.rows });
  } catch (err) {
    req.log.error({ err }, "admin.testers failed");
    res.status(500).json({ error: "Kon het testeroverzicht niet laden" });
  }
});

// POST /api/admin/testers/:clerkId/complete — mark a tester as "Klaar" (done)
// or reopen them. Body: { completed: boolean }. Only works on accepted testers
// (a real profile must exist).
router.post(
  "/testers/:clerkId/complete",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const clerkId = String(req.params["clerkId"] ?? "");
    const { completed } = (req.body ?? {}) as { completed?: unknown };
    if (!clerkId) {
      res.status(400).json({ error: "Geen tester opgegeven" });
      return;
    }
    if (typeof completed !== "boolean") {
      res.status(400).json({ error: "completed moet true of false zijn" });
      return;
    }
    try {
      const [row] = await db
        .update(userProfilesTable)
        .set({ testerCompletedAt: completed ? new Date() : null })
        .where(eq(userProfilesTable.clerkId, clerkId))
        .returning({ clerkId: userProfilesTable.clerkId });
      if (!row) {
        res.status(404).json({ error: "Deze tester is nog niet actief" });
        return;
      }
      res.json({ ok: true });
    } catch (err) {
      req.log.error({ err }, "admin.testers.complete failed");
      res.status(500).json({ error: "Kon de testerstatus niet bijwerken" });
    }
  },
);

// GET /api/admin/feedback — recent training feedback from athletes (admin only).
router.get("/feedback", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT wf.id, wf.feedback_type, wf.note, wf.created_at AS "createdAt",
             up.display_name AS "reporterName"
      FROM workout_feedback wf
      LEFT JOIN user_profiles up ON up.clerk_id = wf.clerk_id
      ORDER BY wf.created_at DESC
      LIMIT 50
    `);
    res.json({ feedback: result.rows });
  } catch (err) {
    req.log.error({ err }, "admin.feedback failed");
    res.status(500).json({ error: "Kon de feedback niet laden" });
  }
});

// GET /api/admin/failed-imports — recent failed activity imports (admin only).
router.get("/failed-imports", requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT ai.id, ai.file_name AS "fileName", ai.file_type AS "fileType",
             ai.status, ai.error_message AS "errorMessage",
             ai.uploaded_at AS "uploadedAt", up.display_name AS "reporterName"
      FROM activity_imports ai
      LEFT JOIN user_profiles up ON up.clerk_id = ai.clerk_id
      WHERE ai.status = 'failed'
      ORDER BY ai.uploaded_at DESC
      LIMIT 50
    `);
    res.json({ imports: result.rows });
  } catch (err) {
    req.log.error({ err }, "admin.failedImports failed");
    res.status(500).json({ error: "Kon de mislukte imports niet laden" });
  }
});

// GET /api/admin/health/batches — test history (all runs) + release history.
router.get("/health/batches", requireAuth, requireAdmin, async (req, res) => {
  try {
    const batches = await db
      .select()
      .from(healthCheckBatchesTable)
      .orderBy(desc(healthCheckBatchesTable.startedAt))
      .limit(40);
    res.json({
      batches,
      releaseChecks: batches.filter((b) => b.runMode === "release"),
    });
  } catch (err) {
    req.log.error({ err }, "admin.health.batches failed");
    res.status(500).json({ error: "Kon de testgeschiedenis niet laden" });
  }
});

export default router;
