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
import {
  scoreTester,
  buildCoverage,
  coveragePct,
  coverageStatus,
  COVERAGE_SCREENS,
  type TesterRawData,
} from "../lib/test-dashboard/scoring";
import { isConnectorAvailable } from "../lib/connectors/registry";
import { buildScheduledTasks } from "../lib/scheduled-tasks";
import { securityAuditLogTable, analysisFeedbackTable } from "@workspace/db";
import { rateLimitStats } from "../lib/security/rate-limit";

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
        (SELECT count(*) FROM user_profiles WHERE at > now() - interval '7 days')::int AS new_registrations,
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

// GET /api/admin/test-dashboard — the full Test Management Dashboard. Every
// number is derived from REAL data: usage from tester_events, coverage from
// screen_view events, onboarding from onboarding_state, connectors from
// connector_connections, feedback from bug_reports. Testers with no telemetry
// get honest zeroes + reliability "geen" so the UI shows "nog niet gemeten",
// never a fabricated value.
router.get("/test-dashboard", requireAuth, requireAdmin, async (req, res) => {
  try {
    // 1) Roster: head testers + everyone who accepted an invitation.
    const rosterRes = await db.execute(sql`
      SELECT up.clerk_id            AS "clerkId",
             up.display_name        AS "displayName",
             up.email               AS "email",
             up.roles               AS "roles",
             up.is_head_tester      AS "isHeadTester",
             up.head_tester_number  AS "headTesterNumber",
             up.last_seen_at        AS "lastSeenAt",
             up.last_platform       AS "lastPlatform",
             up.app_version         AS "appVersion",
             up.tester_completed_at AS "testerCompletedAt",
             up.created_at          AS "createdAt"
      FROM user_profiles up
      WHERE up.is_head_tester = true
         OR up.clerk_id IN (
              SELECT accepted_by_clerk_id FROM invitations
              WHERE accepted_by_clerk_id IS NOT NULL
            )
      ORDER BY up.created_at ASC
    `);
    const roster = rosterRes.rows as Array<Record<string, unknown>>;

    // 2) Usage per tester (sessions, time-in-app, active days, last activity).
    const usageRes = await db.execute(sql`
      WITH sess AS (
        SELECT clerk_id, session_id,
               EXTRACT(EPOCH FROM (max(created_at) - min(created_at))) AS dur
        FROM tester_events
        GROUP BY clerk_id, session_id
      ),
      sess_agg AS (
        SELECT clerk_id,
               count(*)::int AS sessions,
               COALESCE(sum(dur), 0)::int AS total_seconds
        FROM sess GROUP BY clerk_id
      ),
      ev_agg AS (
        SELECT clerk_id,
               count(DISTINCT (created_at AT TIME ZONE 'UTC')::date)
                 FILTER (WHERE at > now() - interval '30 days')::int
                 AS active_days_30,
               max(created_at) AS last_activity_at,
               count(*) FILTER (WHERE type = 'feature_use')::int AS feature_uses
        FROM tester_events GROUP BY clerk_id
      )
      SELECT COALESCE(sa.clerk_id, ea.clerk_id) AS "clerkId",
             COALESCE(sa.sessions, 0)           AS "sessions",
             COALESCE(sa.total_seconds, 0)      AS "totalSeconds",
             COALESCE(ea.active_days_30, 0)     AS "activeDays30",
             ea.last_activity_at                AS "lastActivityAt",
             COALESCE(ea.feature_uses, 0)       AS "featureUses"
      FROM sess_agg sa FULL OUTER JOIN ev_agg ea ON sa.clerk_id = ea.clerk_id
    `);
    const usageByClerk = new Map<string, Record<string, unknown>>();
    for (const row of usageRes.rows as Array<Record<string, unknown>>) {
      usageByClerk.set(String(row.clerkId), row);
    }

    // 3) Coverage per tester per screen (screen_view counts).
    const coverageRes = await db.execute(sql`
      SELECT clerk_id AS "clerkId", screen, count(*)::int AS views
      FROM tester_events
      WHERE type = 'screen_view' AND screen IS NOT NULL
      GROUP BY clerk_id, screen
    `);
    const coverageByClerk = new Map<string, Record<string, number>>();
    for (const row of coverageRes.rows as Array<Record<string, unknown>>) {
      const id = String(row.clerkId);
      const map = coverageByClerk.get(id) ?? {};
      map[String(row.screen)] = Number(row.views);
      coverageByClerk.set(id, map);
    }

    // 4) Onboarding per tester.
    const onboardingRes = await db.execute(sql`
      SELECT clerk_id AS "clerkId",
             core_completed_at        AS "coreCompletedAt",
             onboarding_completed_at  AS "onboardingCompletedAt",
             is_complete              AS "isComplete",
             completed_steps          AS "completedSteps"
      FROM onboarding_state
    `);
    const onboardingByClerk = new Map<string, Record<string, unknown>>();
    for (const row of onboardingRes.rows as Array<Record<string, unknown>>) {
      onboardingByClerk.set(String(row.clerkId), row);
    }

    // 5) Connectors per tester.
    const connectorsRes = await db.execute(sql`
      SELECT clerk_id AS "clerkId", provider, status,
             last_sync_at        AS "lastSyncAt",
             imported_data_types AS "importedDataTypes",
             permission_revoked  AS "permissionRevoked",
             error_status        AS "errorStatus"
      FROM connector_connections
    `);
    const connectorsByClerk = new Map<string, Array<Record<string, unknown>>>();
    for (const row of connectorsRes.rows as Array<Record<string, unknown>>) {
      const id = String(row.clerkId);
      const list = connectorsByClerk.get(id) ?? [];
      list.push(row);
      connectorsByClerk.set(id, list);
    }

    // 6) Feedback per tester (bug_reports breakdown).
    const feedbackRes = await db.execute(sql`
      SELECT clerk_id AS "clerkId",
             count(*)::int                                  AS total,
             count(*) FILTER (WHERE kind = 'bug')::int      AS bugs,
             count(*) FILTER (WHERE kind = 'idea')::int     AS ideas,
             count(*) FILTER (WHERE kind = 'other')::int    AS others,
             count(*) FILTER (WHERE status = 'new')::int    AS "openCount",
             count(*) FILTER (WHERE status = 'fixed')::int  AS "fixedCount",
             COALESCE(round(avg(length(description))), 0)::int AS "avgDescLen"
      FROM bug_reports GROUP BY clerk_id
    `);
    const feedbackByClerk = new Map<string, Record<string, unknown>>();
    for (const row of feedbackRes.rows as Array<Record<string, unknown>>) {
      feedbackByClerk.set(String(row.clerkId), row);
    }

    // ── Assemble per-tester dashboard rows ──────────────────────────────────
    const testers = roster.map((p) => {
      const clerkId = String(p.clerkId);
      const usage = usageByClerk.get(clerkId);
      const coverageMap = coverageByClerk.get(clerkId) ?? {};
      const onb = onboardingByClerk.get(clerkId);
      const connRows = connectorsByClerk.get(clerkId) ?? [];
      const fb = feedbackByClerk.get(clerkId);

      const connectedConnectors = connRows.filter(
        (c) => c.status === "connected" && !c.permissionRevoked,
      ).length;

      const sessions = Number(usage?.sessions ?? 0);
      const totalSeconds = Number(usage?.totalSeconds ?? 0);
      const activeDays30 = Number(usage?.activeDays30 ?? 0);
      const featureUses = Number(usage?.featureUses ?? 0);
      const lastActivityAt = usage?.lastActivityAt
        ? new Date(String(usage.lastActivityAt))
        : null;

      const feedback = {
        total: Number(fb?.total ?? 0),
        bugs: Number(fb?.bugs ?? 0),
        ideas: Number(fb?.ideas ?? 0),
        others: Number(fb?.others ?? 0),
        avgDescLen: Number(fb?.avgDescLen ?? 0),
      };

      const raw: TesterRawData = {
        sessions,
        totalSeconds,
        activeDays30,
        lastActivityAt,
        featureUses,
        coverage: coverageMap,
        onboarding: onb
          ? {
              coreCompletedAt: onb.coreCompletedAt
                ? new Date(String(onb.coreCompletedAt))
                : null,
              isComplete: onb.isComplete === true,
              completedSteps: Array.isArray(onb.completedSteps)
                ? onb.completedSteps.length
                : 0,
            }
          : null,
        connectedConnectors,
        feedback,
      };

      const scores = scoreTester(raw);

      return {
        clerkId,
        displayName: p.displayName ?? null,
        email: p.email ?? null,
        roles: p.roles ?? [],
        isHeadTester: p.isHeadTester === true,
        headTesterNumber: p.headTesterNumber ?? null,
        lastPlatform: p.lastPlatform ?? null,
        appVersion: p.appVersion ?? null,
        testerCompletedAt: p.testerCompletedAt ?? null,
        invitedAt: p.createdAt ?? null,
        usage: {
          sessions,
          totalSeconds,
          avgSeconds: sessions > 0 ? Math.round(totalSeconds / sessions) : 0,
          activeDays30,
          featureUses,
          lastActivityAt: lastActivityAt ? lastActivityAt.toISOString() : null,
          hasData: sessions > 0 || featureUses > 0,
        },
        coverage: buildCoverage(coverageMap),
        coveragePct: coveragePct(coverageMap),
        onboarding: onb
          ? {
              coreCompleted: !!onb.coreCompletedAt,
              fullyComplete: onb.isComplete === true,
              completedSteps: Array.isArray(onb.completedSteps)
                ? onb.completedSteps.length
                : 0,
            }
          : null,
        connectors: connRows.map((c) => ({
          provider: c.provider,
          status: c.status,
          available: isConnectorAvailable(String(c.provider)),
          lastSyncAt: c.lastSyncAt ?? null,
          importedDataTypes: Array.isArray(c.importedDataTypes)
            ? c.importedDataTypes
            : [],
          permissionRevoked: c.permissionRevoked === true,
          errorStatus: c.errorStatus ?? null,
        })),
        connectedConnectors,
        feedback: {
          total: feedback.total,
          bugs: feedback.bugs,
          ideas: feedback.ideas,
          others: feedback.others,
          openCount: Number(fb?.openCount ?? 0),
          fixedCount: Number(fb?.fixedCount ?? 0),
          avgDescLen: feedback.avgDescLen,
        },
        scores,
      };
    });

    // ── Summary across all testers ──────────────────────────────────────────
    const total = testers.length;
    const activeTesters = testers.filter((t) => t.usage.hasData).length;
    const notStarted = total - activeTesters;
    const completedOnboarding = testers.filter(
      (t) => t.onboarding?.coreCompleted,
    ).length;
    const completedTesting = testers.filter(
      (t) => t.testerCompletedAt != null,
    ).length;

    // Average only over testers with real usage — a tester without telemetry has
    // a testscore of 0 by design, so including them would understate the true
    // average and contradict the "—" shown on their card.
    const avgTestscore =
      activeTesters > 0
        ? Math.round(
            testers
              .filter((t) => t.usage.hasData)
              .reduce((acc, t) => acc + t.scores.testscore, 0) / activeTesters,
          )
        : 0;
    const totalFeedback = testers.reduce((acc, t) => acc + t.feedback.total, 0);
    const openBugs = testers.reduce((acc, t) => acc + t.feedback.openCount, 0);

    // Coverage per screen across all testers: how many opened it (never/viewed/
    // active) and the share that opened it at least once.
    const coveragePerScreen = COVERAGE_SCREENS.map((s) => {
      let never = 0;
      let viewed = 0;
      let active = 0;
      for (const t of testers) {
        const c = t.coverage.find((x) => x.key === s.key);
        const st = c ? c.status : coverageStatus(0);
        if (st === "never") never += 1;
        else if (st === "viewed") viewed += 1;
        else active += 1;
      }
      const opened = viewed + active;
      return {
        key: s.key,
        label: s.label,
        never,
        viewed,
        active,
        openedPct: total > 0 ? Math.round((opened / total) * 100) : 0,
      };
    });

    // Smart signals — deterministic, honest observations an admin should act on.
    const signals: Array<{
      tone: "info" | "warn" | "good";
      message: string;
    }> = [];

    if (total === 0) {
      signals.push({
        tone: "info",
        message: "Er zijn nog geen testers. Nodig testers uit om te beginnen.",
      });
    } else {
      if (notStarted > 0) {
        signals.push({
          tone: "warn",
          message: `${notStarted} van de ${total} testers ${
            notStarted === 1 ? "is" : "zijn"
          } nog niet gestart (geen meetbare activiteit).`,
        });
      }
      const neverOpened = coveragePerScreen.filter(
        (s) => s.viewed + s.active === 0,
      );
      for (const s of neverOpened) {
        signals.push({
          tone: "warn",
          message: `"${s.label}" is door geen enkele tester geopend.`,
        });
      }
      const activeNoFeedback = testers.filter(
        (t) => t.usage.hasData && t.feedback.total === 0,
      ).length;
      if (activeNoFeedback > 0) {
        signals.push({
          tone: "info",
          message: `${activeNoFeedback} actieve ${
            activeNoFeedback === 1 ? "tester gaf" : "testers gaven"
          } nog geen feedback.`,
        });
      }
      if (openBugs > 0) {
        signals.push({
          tone: "warn",
          message: `${openBugs} openstaande ${
            openBugs === 1 ? "melding wacht" : "meldingen wachten"
          } op opvolging.`,
        });
      }
      const grondig = testers.filter(
        (t) => t.scores.phase === "grondig",
      ).length;
      if (grondig > 0) {
        signals.push({
          tone: "good",
          message: `${grondig} ${
            grondig === 1 ? "tester test" : "testers testen"
          } grondig — sterke dekking en activiteit.`,
        });
      }
    }

    res.json({
      summary: {
        total,
        activeTesters,
        notStarted,
        completedOnboarding,
        completedTesting,
        avgTestscore,
        totalFeedback,
        openBugs,
        coveragePerScreen,
        signals,
      },
      testers,
    });
  } catch (err) {
    req.log.error({ err }, "admin.testDashboard failed");
    res.status(500).json({ error: "Kon het testdashboard niet laden" });
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

// GET /api/admin/scheduled-tasks — "Geplande taken"-overzicht.
//
// Honesty contract: the server cannot read the Replit deployment config, so it
// can NEVER confirm a Scheduled Deployment truly exists. What it CAN do is look
// at the real data traces each job leaves behind and honestly report the last
// visible run. No trace within the expected cadence → warn plainly that the
// Scheduled Deployment may not be created yet. Nothing is ever a fake green.
router.get(
  "/scheduled-tasks",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      // ── job:health — last AUTOMATIC (scheduler-triggered) engine batch ──────
      const [lastAutoBatch] = await db
        .select()
        .from(healthCheckBatchesTable)
        .where(eq(healthCheckBatchesTable.triggeredBy, "scheduler"))
        .orderBy(desc(healthCheckBatchesTable.startedAt))
        .limit(1);

      // ── job:goal-review — newest goal proposal + whether there is anything
      //    to propose at all (active goals). ──────────────────────────────────
      const goalTrace = await db.execute(sql`
        SELECT
          (SELECT max(created_at) FROM goal_proposals) AS last_at,
          (SELECT count(*) FROM goal_proposals)::int AS total,
          (SELECT count(*) FROM athlete_goals WHERE status = 'active')::int AS active_goals
      `);
      const goalRow = goalTrace.rows[0] as
        | { last_at?: string | Date | null; total?: number; active_goals?: number }
        | undefined;

      // ── job:reminders — newest scheduled reminder notification ─────────────
      const reminderTrace = await db.execute(sql`
        SELECT max(created_at) AS last_at, count(*)::int AS total
        FROM notifications
        WHERE dedupe_key LIKE 'reminder:%'
      `);
      const reminderRow = reminderTrace.rows[0] as
        | { last_at?: string | Date | null; total?: number }
        | undefined;

      // ── knowledge-scan — newest knowledge item fetched ─────────────────────
      const knowledgeTrace = await db.execute(sql`
        SELECT max(coalesce(fetched_at, created_at)) AS last_at, count(*)::int AS total
        FROM knowledge_items
      `);
      const knowledgeRow = knowledgeTrace.rows[0] as
        | { last_at?: string | Date | null; total?: number }
        | undefined;

      const toDate = (v: string | Date | null | undefined): Date | null =>
        v ? new Date(v) : null;

      const healthLast = lastAutoBatch?.startedAt
        ? new Date(lastAutoBatch.startedAt)
        : null;

      const { tasks, missing } = buildScheduledTasks({
        healthLast,
        goalLast: toDate(goalRow?.last_at),
        activeGoals: Number(goalRow?.active_goals ?? 0),
        reminderLast: toDate(reminderRow?.last_at),
        knowledgeLast: toDate(knowledgeRow?.last_at),
      });

      res.json({ tasks, missing });
    } catch (err) {
      req.log.error({ err }, "admin.scheduled-tasks failed");
      res
        .status(500)
        .json({ error: "Kon het overzicht van geplande taken niet laden" });
    }
  },
);

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

// GET /api/admin/security — beveiligingsoverzicht: recente auditgebeurtenissen
// (onveranderbaar log) + actuele rate-limit-teller. Alleen voor beheerders.
router.get("/security", requireAuth, requireAdmin, async (req, res) => {
  try {
    const limitRaw = Number.parseInt(String(req.query.limit ?? "100"), 10);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(Math.max(limitRaw, 1), 500)
      : 100;
    const event = req.query.event ? String(req.query.event) : null;
    const rows = await db
      .select()
      .from(securityAuditLogTable)
      .where(event ? eq(securityAuditLogTable.event, event) : undefined)
      .orderBy(desc(securityAuditLogTable.at))
      .limit(limit);
    const [counts] = (
      await db.execute(sql`
        SELECT
          count(*)::int AS totaal,
          count(*) FILTER (WHERE at > now() - interval '24 hours')::int AS laatste24u,
          count(*) FILTER (WHERE event = 'rate_limited' AND at > now() - interval '24 hours')::int AS geblokkeerd24u
        FROM security_audit_log
      `)
    ).rows as Array<Record<string, unknown>>;
    res.json({
      audit: rows,
      samenvatting: counts ?? { totaal: 0, laatste24u: 0, geblokkeerd24u: 0 },
      rateLimits: rateLimitStats,
    });
  } catch (err) {
    req.log.error({ err }, "admin.security failed");
    res.status(500).json({ error: "Beveiligingsoverzicht kon niet geladen worden." });
  }
});

// ── GET /api/admin/quality ───────────────────────────────────────────────────
// Kwaliteitsdashboard van de feedbacklus: totalen per oordeel, kwaliteit per
// engine/regel/versie (aandeel "onjuist"), en de recentste onjuist-meldingen
// met hun berekeningscontext. Puur lezend — feedback wijzigt nooit regels.
router.get("/quality", requireAuth, requireAdmin, async (req, res) => {
  try {
    const totalsRows = await db
      .select({
        verdict: analysisFeedbackTable.verdict,
        count: sql<number>`count(*)::int`,
      })
      .from(analysisFeedbackTable)
      .groupBy(analysisFeedbackTable.verdict);

    const byEngine = (
      await db.execute(sql`
        SELECT
          COALESCE(context->>'engine', 'onbekend') AS engine,
          COALESCE(context->>'engineVersion', 'onbekend') AS engine_version,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE verdict = 'onjuist')::int AS onjuist,
          COUNT(*) FILTER (WHERE verdict = 'nuttig')::int AS nuttig,
          COUNT(*) FILTER (WHERE verdict IN ('opgevolgd','niet_opgevolgd'))::int AS opvolging,
          COUNT(*) FILTER (WHERE verdict = 'opgevolgd')::int AS opgevolgd
        FROM analysis_feedback
        GROUP BY 1, 2
        ORDER BY total DESC
        LIMIT 50
      `)
    ).rows;

    const byRule = (
      await db.execute(sql`
        SELECT
          COALESCE(context->>'engine', 'onbekend') AS engine,
          COALESCE(context->>'ruleKey', 'onbekend') AS rule_key,
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE verdict = 'onjuist')::int AS onjuist
        FROM analysis_feedback
        GROUP BY 1, 2
        ORDER BY onjuist DESC, total DESC
        LIMIT 50
      `)
    ).rows;

    const recentIncorrect = await db
      .select({
        id: analysisFeedbackTable.id,
        subjectType: analysisFeedbackTable.subjectType,
        subjectKey: analysisFeedbackTable.subjectKey,
        actorRole: analysisFeedbackTable.actorRole,
        reasonCode: analysisFeedbackTable.reasonCode,
        reasonText: analysisFeedbackTable.reasonText,
        context: analysisFeedbackTable.context,
        updatedAt: analysisFeedbackTable.updatedAt,
      })
      .from(analysisFeedbackTable)
      .where(eq(analysisFeedbackTable.verdict, "onjuist"))
      .orderBy(desc(analysisFeedbackTable.updatedAt))
      .limit(25);

    const totals: Record<string, number> = {};
    for (const r of totalsRows) totals[r.verdict] = r.count;

    res.json({ totals, byEngine, byRule, recentIncorrect });
  } catch (err) {
    req.log.error({ err }, "admin.quality failed");
    res.status(500).json({ error: "Kwaliteitsoverzicht laden mislukt" });
  }
});

export default router;
