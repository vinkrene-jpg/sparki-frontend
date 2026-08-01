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
import { isTestIdentity } from "../engines/data-origin/classification";
import { buildScheduledTasks } from "../lib/scheduled-tasks";
import { libraryBackfillState } from "../lib/library-backfill";
import {
  securityAuditLogTable,
  analysisFeedbackTable,
  billingSubscriptionsTable,
  stripeWebhookEventsTable,
} from "@workspace/db";
import { getBillingState } from "../lib/billing";
import { AI_PURPOSES } from "../lib/ai/gateway";
import { rateLimitStats } from "../lib/security/rate-limit";
import { userEntitlementsTable } from "@workspace/db";
import {
  resolveEntitlements,
  isValidMode,
  isValidVariant,
  isValidEntitlementType,
} from "../lib/entitlements";
import { writeAudit } from "../lib/security/audit";
import {
  aggregateBuildRatings,
  weakComponents,
} from "../lib/build-ratings";
import {
  readSystemMode,
  writeSystemMode,
  systemBusinessModes,
} from "../lib/system-mode";
import { adminOpsLogTable } from "@workspace/db";
import { runObservationCleanup } from "../jobs/observation-cleanup";

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

// GET /api/admin/sync-diagnostics — automatische datasync-diagnostiek.
// Echte rijen uit sync_runs + webhook_events: per platform de laatste runs,
// foutpercentages en webhook-verwerking. Geen aannames — alleen wat er
// aantoonbaar gebeurd is.
router.get(
  "/sync-diagnostics",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const [perProvider, recentRuns, webhookStats, recentWebhookFailures] =
        await Promise.all([
          db.execute(sql`
            SELECT provider,
                   count(*)::int AS "totalRuns",
                   count(*) FILTER (WHERE status = 'failed')::int AS "failedRuns",
                   count(*) FILTER (WHERE status = 'partial')::int AS "partialRuns",
                   max(started_at) AS "lastRunAt",
                   max(started_at) FILTER (WHERE status = 'success') AS "lastSuccessAt"
            FROM sync_runs
            GROUP BY provider
            ORDER BY provider
          `),
          db.execute(sql`
            SELECT sr.id, sr.provider, sr.trigger, sr.status,
                   sr.started_at AS "startedAt", sr.finished_at AS "finishedAt",
                   sr.counts, sr.error, up.display_name AS "userName"
            FROM sync_runs sr
            LEFT JOIN user_profiles up ON up.clerk_id = sr.clerk_id
            ORDER BY sr.started_at DESC
            LIMIT 30
          `),
          db.execute(sql`
            SELECT provider, status, count(*)::int AS "count"
            FROM webhook_events
            GROUP BY provider, status
            ORDER BY provider, status
          `),
          db.execute(sql`
            SELECT id, provider, event_id AS "eventId", status, attempts,
                   last_error AS "lastError", received_at AS "receivedAt"
            FROM webhook_events
            WHERE status = 'failed'
            ORDER BY received_at DESC
            LIMIT 20
          `),
        ]);
      res.json({
        providers: perProvider.rows,
        recentRuns: recentRuns.rows,
        webhooks: webhookStats.rows,
        failedWebhooks: recentWebhookFailures.rows,
      });
    } catch (err) {
      req.log.error({ err }, "admin.syncDiagnostics failed");
      res.status(500).json({ error: "Kon de sync-diagnostiek niet laden" });
    }
  },
);

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

      // ── job:sync — nieuwste GEPLANDE koppelingen-inhaalsync + aantal echt
      //    gekoppelde platforms (bepaalt of afwezigheid eerlijk "grijs" is). ──
      const connectorSyncTrace = await db.execute(sql`
        SELECT
          (SELECT max(started_at) FROM sync_runs WHERE trigger = 'scheduled') AS last_at,
          (SELECT count(*) FROM connector_connections WHERE status = 'connected')::int AS connected
      `);
      const connectorSyncRow = connectorSyncTrace.rows[0] as
        | { last_at?: string | Date | null; connected?: number }
        | undefined;

      const libraryTrace = await db.execute(sql`
        SELECT max(created_at) AS last_at FROM route_library
      `);
      const libraryRow = libraryTrace.rows[0] as
        | { last_at?: string | Date | null }
        | undefined;
      const libraryState = await libraryBackfillState();

      // ── observatie-opschoning — nieuwste observation_cleanup-event ─────────
      const cleanupTrace = await db.execute(sql`
        SELECT max(created_at) AS last_at
        FROM ai_memory_events
        WHERE event_type = 'observation_cleanup'
      `);
      const cleanupRow = cleanupTrace.rows[0] as
        | { last_at?: string | Date | null }
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
        connectorSyncLast: toDate(connectorSyncRow?.last_at),
        connectedConnections: Number(connectorSyncRow?.connected ?? 0),
        libraryLast: toDate(libraryRow?.last_at),
        libraryHomes: libraryState.homes,
        libraryOpenCells: libraryState.openCells,
        observationCleanupLast: toDate(cleanupRow?.last_at),
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

// ── GET /api/admin/build-ratings ─────────────────────────────────────────────
// Sterren-beoordelingen op door Sparki gebouwde onderdelen — vaste audit-input.
// Uitsluitend aggregaten (gemiddelde, aantal, trend) per onderdeel; nooit wie
// welke score gaf. Zwak scorende onderdelen staan bovenaan (audit-agenda).
router.get("/build-ratings", requireAuth, requireAdmin, async (req, res) => {
  try {
    const aggregates = await aggregateBuildRatings();
    const weak = weakComponents(aggregates).map((a) => a.subjectType);
    // Zwakste eerst: audit-agenda-volgorde (laag gemiddelde vooraan, daarna
    // onderdelen zonder signaal, alfabetisch stabiel).
    const sorted = [...aggregates].sort((a, b) => {
      const av = a.average ?? Number.POSITIVE_INFINITY;
      const bv = b.average ?? Number.POSITIVE_INFINITY;
      if (av !== bv) return av - bv;
      return a.subjectType.localeCompare(b.subjectType);
    });
    res.json({ aggregates: sorted, weakSubjectTypes: weak });
  } catch (err) {
    req.log.error({ err }, "admin.build-ratings failed");
    res.status(500).json({ error: "Beoordelingsoverzicht laden mislukt" });
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


// GET /api/admin/ai-insights — inzicht in de centrale AI-gateway (Golf 25).
// Toont het doelenregister (configuratie) + echte aggregaties uit ai_call_logs.
// Uitsluitend metadata — nooit prompt- of antwoordinhoud, nooit geheimen.
router.get("/ai-insights", requireAuth, requireAdmin, async (req, res) => {
  try {
    const [perPurpose, perStatus, recentProblems, last24h] = await Promise.all([
      db.execute(sql`
        SELECT purpose,
               count(*)::int AS "totalCalls",
               count(*) FILTER (WHERE status = 'ok')::int AS "okCalls",
               count(*) FILTER (WHERE status LIKE 'blocked%')::int AS "blockedCalls",
               count(*) FILTER (WHERE status IN ('error','timeout','fallback','rejected'))::int AS "failedCalls",
               round(avg(latency_ms) FILTER (WHERE latency_ms IS NOT NULL))::int AS "avgLatencyMs",
               sum(input_tokens)::bigint AS "inputTokens",
               sum(output_tokens)::bigint AS "outputTokens",
               sum(cost_micro_usd)::bigint AS "costMicroUsd",
               count(*) FILTER (WHERE redaction_applied)::int AS "redactedCalls",
               max(created_at) AS "lastCallAt"
        FROM ai_call_logs
        GROUP BY purpose
        ORDER BY purpose
      `),
      db.execute(sql`
        SELECT status, count(*)::int AS "count"
        FROM ai_call_logs
        GROUP BY status
        ORDER BY status
      `),
      db.execute(sql`
        SELECT id, purpose, provider, model, status, error_code AS "errorCode",
               retries, latency_ms AS "latencyMs", created_at AS "createdAt"
        FROM ai_call_logs
        WHERE status NOT IN ('ok')
        ORDER BY created_at DESC
        LIMIT 25
      `),
      db.execute(sql`
        SELECT count(*)::int AS "calls",
               sum(cost_micro_usd)::bigint AS "costMicroUsd"
        FROM ai_call_logs
        WHERE created_at > now() - interval '24 hours'
      `),
    ]);
    const purposes = Object.entries(AI_PURPOSES).map(([key, cfg]) => ({
      purpose: key,
      label: cfg.label,
      provider: cfg.provider,
      model: cfg.model,
      promptVersion: cfg.promptVersion,
      inputCategories: cfg.inputCategories,
      consent: cfg.consent,
      sensitive: cfg.sensitive,
      minorBlocked: cfg.minorBlocked,
      timeoutMs: cfg.timeoutMs,
      maxRetries: cfg.maxRetries,
    }));
    res.json({
      purposes,
      usage: perPurpose.rows,
      statuses: perStatus.rows,
      recentProblems: recentProblems.rows,
      last24h: last24h.rows[0] ?? { calls: 0, costMicroUsd: null },
    });
  } catch (err) {
    req.log.error({ err }, "admin.aiInsights failed");
    res.status(500).json({ error: "AI-inzichten laden mislukt" });
  }
});

// ── GET /api/admin/data-provenance ──────────────────────────────────────────
// Gegevensbroncontrole (alleen admin/testers): laat per zichtbaar gegevensblok
// zien waar de informatie vandaan komt — brontabel, record-id's, laatste
// update en aan welke gebruiker (clerkId) de rijen gebonden zijn. Alles komt
// LIVE uit de database; er wordt niets berekend of verzonnen. Een leeg blok
// betekent eerlijk: geen brondata aanwezig voor deze gebruiker.
const PROVENANCE_SURFACES: {
  key: string;
  label: string;
  table: string;
  clerkCol: string;
  updatedCol: string;
  berekening: string;
}[] = [
  { key: "profiel", label: "Profiel (Jij)", table: "athlete_profiles", clerkCol: "clerk_id", updatedCol: "updated_at", berekening: "Directe gebruikersinvoer + connector-import; geen afleiding." },
  { key: "kalender", label: "Kalender & trainingen", table: "planned_workouts", clerkCol: "clerk_id", updatedCol: "updated_at", berekening: "Plan-engine of handmatige invoer; koppellijst leest dezelfde rijen." },
  { key: "sessies", label: "Activiteiten (sessies)", table: "training_sessions", clerkCol: "clerk_id", updatedCol: "updated_at", berekening: "Import (Strava/bestand) of handmatig; belasting (TSS) afgeleid uit vermogen+FTP indien aanwezig." },
  { key: "doelen", label: "Doelen", table: "athlete_goals", clerkCol: "clerk_id", updatedCol: "updated_at", berekening: "Gebruikersinvoer; afgeleide doelen dragen hun bron in de rij." },
  { key: "routes", label: "Routes", table: "routes", clerkCol: "clerk_id", updatedCol: "updated_at", berekening: "ORS-generatie of GPX-import." },
  { key: "wedstrijden", label: "Wedstrijden", table: "races", clerkCol: "clerk_id", updatedCol: "updated_at", berekening: "Gebruikersinvoer of kalenderimport; verrijking alleen uit echte bronnen." },
  { key: "voeding", label: "Voeding", table: "nutrition_hydration_logs", clerkCol: "clerk_id", updatedCol: "created_at", berekening: "Eigen registraties; richtwaarden deterministisch uit duur/intensiteit." },
  { key: "meldingen", label: "Meldingen", table: "notifications", clerkCol: "clerk_id", updatedCol: "created_at", berekening: "Gebeurtenis-gedreven; nooit gegenereerd zonder aanleiding." },
  { key: "observaties", label: "Sparki-observaties", table: "ai_observations", clerkCol: "clerk_id", updatedCol: "created_at", berekening: "Deterministische engine over echte sessies/profiel; confidence < 100." },
  { key: "chat", label: "Vraag Sparki (chat)", table: "sparki_input_messages", clerkCol: "clerk_id", updatedCol: "created_at", berekening: "Eigen gesprekshistorie; alleen zichtbaar binnen de sessie." },
];

router.get("/data-provenance", requireAuth, requireAdmin, async (req, res) => {
  const target = String(req.query["clerkId"] ?? "").trim();
  if (!target) {
    res.status(400).json({ error: "clerkId is verplicht" });
    return;
  }
  try {
    const [user] = (
      await db.execute(
        sql`SELECT clerk_id, email, display_name FROM user_profiles WHERE clerk_id = ${target}`,
      )
    ).rows as { clerk_id: string; email: string; display_name: string }[];
    if (!user) {
      res.status(404).json({ error: "Gebruiker niet gevonden" });
      return;
    }
    const surfaces = [];
    for (const s of PROVENANCE_SURFACES) {
      try {
        const rows = (
          await db.execute(
            sql`SELECT count(*)::int AS n,
                       max(${sql.raw(s.updatedCol)}) AS latest,
                       (SELECT id FROM ${sql.raw(s.table)}
                        WHERE ${sql.raw(s.clerkCol)} = ${target}
                        ORDER BY ${sql.raw(s.updatedCol)} DESC NULLS LAST LIMIT 1) AS latest_id
                FROM ${sql.raw(s.table)}
                WHERE ${sql.raw(s.clerkCol)} = ${target}`,
          )
        ).rows as { n: number; latest: string | null; latest_id: number | null }[];
        const row = rows[0];
        surfaces.push({
          key: s.key,
          label: s.label,
          bron: `${s.table} (kolom ${s.clerkCol})`,
          berekening: s.berekening,
          aantalRecords: row?.n ?? 0,
          laatsteRecordId: row?.latest_id ?? null,
          laatsteUpdate: row?.latest ?? null,
          gebruiker: target,
          herkomst:
            (row?.n ?? 0) > 0
              ? "directe of afgeleide echte gebruikersdata"
              : "geen brondata",
          // Centrale data-trust-classificatie (DATA_TRUST_01): testidentiteit
          // is zichtbaar in het adminoverzicht. Per-waarde-klassen komen uit
          // de explain-endpoints; een surface-brede klasse zou hier gokken
          // zijn, dus die geven we eerlijk alleen wanneer hij vaststaat.
          klasse: isTestIdentity(target)
            ? ("TEST_ONLY" as const)
            : (row?.n ?? 0) === 0
              ? ("UNKNOWN" as const)
              : null,
          testAccount: isTestIdentity(target),
        });
      } catch (err) {
        // Eerlijke fout per blok — nooit vervangen door verzonnen cijfers.
        req.log.error({ err, surface: s.key }, "admin.dataProvenance surface failed");
        surfaces.push({
          key: s.key,
          label: s.label,
          bron: `${s.table} (kolom ${s.clerkCol})`,
          berekening: s.berekening,
          aantalRecords: null,
          laatsteRecordId: null,
          laatsteUpdate: null,
          gebruiker: target,
          herkomst: "controle mislukt — bron niet bereikbaar",
        });
      }
    }
    res.json({
      gebruiker: {
        clerkId: user.clerk_id,
        email: user.email,
        naam: user.display_name,
      },
      surfaces,
    });
  } catch (err) {
    req.log.error({ err }, "admin.dataProvenance failed");
    res.status(500).json({ error: "Gegevensbroncontrole mislukt" });
  }
});

// ── POST /api/admin/data-trust/cleanup ──────────────────────────────────────
// Gerichte opschoning van aantoonbare datavervuiling voor één gebruiker
// (alleen admin). Standaard een DROOGDRAAI die exact laat zien wat er weg zou
// gaan; pas met apply=true wordt er echt verwijderd. Raakt NOOIT echte
// gebruikersdata: alleen (a) Engelstalige observaties van vóór de
// taal-correctie in de prompts en (b) dubbele ftp_history-rijen die door een
// import zonder unieke sleutel dubbel zijn weggeschreven (de oudste blijft).
router.post(
  "/data-trust/cleanup",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { clerkId, apply } = req.body as {
      clerkId?: string;
      apply?: boolean;
    };
    const target = String(clerkId ?? "").trim();
    if (!target) {
      res.status(400).json({ error: "clerkId is verplicht" });
      return;
    }
    try {
      // (a) Engelstalige observaties: bevatten duidelijke Engelse woorden en
      // géén Nederlandse functiewoorden. De droogdraai toont de titels zodat
      // de beheerder dit controleert vóór verwijderen.
      const englishObs = (
        await db.execute(
          sql`SELECT id, title, created_at
              FROM ai_observations
              WHERE clerk_id = ${target}
                AND (title || ' ' || coalesce(observation_text, '')) ~* '\\y(you|your|yours|weekly|increase|decrease|improving|consistency|sessions)\\y'
                AND (title || ' ' || coalesce(observation_text, '')) !~* '\\y(je|jouw|jij|een|het|deze|niet|wordt|meer)\\y'
              ORDER BY created_at`,
        )
      ).rows as { id: number; title: string; created_at: string }[];

      // (b) Dubbele ftp_history-IMPORTrijen (zelfde gebruiker+datum+type+watts):
      // alles behalve de rij met het laagste id is een importduplicaat.
      // Alleen import-bronnen (strava) komen in aanmerking — handmatige of
      // coach-invoer wordt hier NOOIT aangeraakt, ook niet als die dubbel is.
      const dupFtp = (
        await db.execute(
          sql`SELECT id, measured_at, test_type, ftp_watts
              FROM ftp_history
              WHERE clerk_id = ${target}
                AND test_type = 'strava'
                AND id NOT IN (
                  SELECT min(id) FROM ftp_history
                  WHERE clerk_id = ${target}
                    AND test_type = 'strava'
                  GROUP BY measured_at, test_type, ftp_watts
                )
              ORDER BY measured_at`,
        )
      ).rows as {
        id: number;
        measured_at: string;
        test_type: string;
        ftp_watts: number;
      }[];

      // (c) FTP-actualisatie: staat het profiel nog op een afgeleide schatting
      // terwijl er een NIEUWERE echte invoer (handmatig/import) in ftp_history
      // staat, dan hoort die echte waarde het profiel te zijn. De droogdraai
      // toont wat er zou gebeuren; apply draait het bestaande zelfherstel
      // (recalibrateEstimatedFtp) dat de echte waarde overneemt, ftpEstimated
      // op false zet en oudere afgeleide rijen als [achterhaald] markeert —
      // zonder ook maar één historierij te verwijderen.
      const ftpState = (
        await db.execute(
          sql`SELECT p.ftp, p.ftp_estimated,
                     r.ftp_watts AS echte_watts, r.measured_at AS echte_datum,
                     d.id AS afgeleide_id, d.ftp_watts AS afgeleide_watts,
                     d.measured_at AS afgeleide_datum
              FROM athlete_profiles p
              LEFT JOIN LATERAL (
                SELECT ftp_watts, measured_at FROM ftp_history
                WHERE clerk_id = p.clerk_id AND test_type <> 'derived'
                ORDER BY measured_at DESC LIMIT 1
              ) r ON true
              LEFT JOIN LATERAL (
                SELECT id, ftp_watts, measured_at FROM ftp_history
                WHERE clerk_id = p.clerk_id AND test_type = 'derived'
                  AND coalesce(notes, '') NOT LIKE '[achterhaald]%'
                ORDER BY measured_at DESC LIMIT 1
              ) d ON true
              WHERE p.clerk_id = ${target}`,
        )
      ).rows[0] as
        | {
            ftp: number | null;
            ftp_estimated: boolean;
            echte_watts: number | null;
            echte_datum: string | null;
            afgeleide_id: number | null;
            afgeleide_watts: number | null;
            afgeleide_datum: string | null;
          }
        | undefined;
      const ftpActualisatie =
        ftpState &&
        ftpState.ftp_estimated === true &&
        ftpState.echte_watts != null &&
        (ftpState.afgeleide_datum == null ||
          ftpState.echte_datum! >= ftpState.afgeleide_datum)
          ? {
              nodig: true as const,
              profielNu: { ftp: ftpState.ftp, geschat: true },
              wordt: { ftp: ftpState.echte_watts, geschat: false },
              teMarkerenAlsAchterhaald:
                ftpState.afgeleide_id == null
                  ? []
                  : [
                      {
                        id: ftpState.afgeleide_id,
                        watts: ftpState.afgeleide_watts,
                        datum: ftpState.afgeleide_datum,
                      },
                    ],
            }
          : { nodig: false as const };

      // (d) Fiets-autokoppeling: ritten van vóór de registratiedatum van een
      // fiets die tóch automatisch gekoppeld staan (oude bug). De droogdraai
      // telt ze; apply draait het bestaande zelfherstel (autoLinkSessions)
      // dat alleen auto-koppelingen losmaakt — handmatige keuzes blijven.
      const historischGekoppeld = (
        await db.execute(
          sql`SELECT count(*)::int AS aantal,
                     coalesce(round(sum(s.distance_km)::numeric, 0), 0)::float AS km
              FROM training_sessions s
              JOIN garage_bikes b ON b.id = s.bike_id
              WHERE s.clerk_id = ${target}
                AND s.bike_link_source = 'auto'
                AND s.session_date < b.created_at::date`,
        )
      ).rows[0] as { aantal: number; km: number };

      let removed = { observaties: 0, ftpHistorie: 0 };
      let ftpGeactualiseerd = false;
      let fietsOntkoppeld = 0;
      if (apply === true) {
        if (englishObs.length > 0) {
          const r = await db.execute(
            sql`DELETE FROM ai_observations
                WHERE clerk_id = ${target}
                  AND id IN (${sql.join(
                    englishObs.map((o) => sql`${o.id}`),
                    sql`, `,
                  )})`,
          );
          removed.observaties = r.rowCount ?? englishObs.length;
        }
        if (dupFtp.length > 0) {
          const r = await db.execute(
            sql`DELETE FROM ftp_history
                WHERE clerk_id = ${target}
                  AND id IN (${sql.join(
                    dupFtp.map((o) => sql`${o.id}`),
                    sql`, `,
                  )})`,
          );
          removed.ftpHistorie = r.rowCount ?? dupFtp.length;
        }
        if (ftpActualisatie.nodig) {
          // Bestaand zelfherstel doet dit atomair: profiel-FTP + paspoort-
          // event + [achterhaald]-markering in één transactie.
          const { recalibrateEstimatedFtp } = await import(
            "../lib/derived-load-backfill"
          );
          const r = await recalibrateEstimatedFtp(target);
          ftpGeactualiseerd = r.changed;
        }
        if (historischGekoppeld.aantal > 0) {
          const { autoLinkSessions } = await import("../lib/bike-usage");
          await autoLinkSessions(target);
          const na = (
            await db.execute(
              sql`SELECT count(*)::int AS aantal
                  FROM training_sessions s
                  JOIN garage_bikes b ON b.id = s.bike_id
                  WHERE s.clerk_id = ${target}
                    AND s.bike_link_source = 'auto'
                    AND s.session_date < b.created_at::date`,
            )
          ).rows[0] as { aantal: number };
          fietsOntkoppeld = historischGekoppeld.aantal - na.aantal;
        }
      }

      res.json({
        modus: apply === true ? "uitgevoerd" : "droogdraai",
        kandidaten: {
          engelstaligeObservaties: englishObs.map((o) => ({
            id: o.id,
            titel: o.title,
            aangemaakt: o.created_at,
          })),
          dubbeleFtpHistorie: dupFtp,
          ftpActualisatie,
          historischeFietskoppelingen: historischGekoppeld,
        },
        verwijderd: removed,
        ftpGeactualiseerd,
        fietsOntkoppeld,
      });
    } catch (err) {
      req.log.error({ err }, "admin.dataTrustCleanup failed");
      res.status(500).json({ error: "Opschoning mislukt" });
    }
  },
);

// ── GET /api/admin/data-trust/dashboard ─────────────────────────────────────
// Data Trust Dashboard (alleen admin): platformbreed overzicht van
// geïmporteerde datasets, ontbrekende gegevens, conflicten, duplicaten,
// synchronisatiefouten en onbekende bronnen. Alles LIVE geteld uit echte
// tabellen — geen cache, geen schattingen. Een mislukt blok meldt zich
// eerlijk als fout in plaats van nullen te tonen.
const KNOWN_SESSION_SOURCES = [
  "manual",
  "strava",
  "garmin",
  "wahoo",
  "file",
  "gpx",
  "fit",
  "tcx",
  "mobiel",
  "sparki",
  "coach",
];

router.get(
  "/data-trust/dashboard",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      // (1) Datasets per bron: sessies + ruwe connector-activiteiten.
      const datasets = (
        await db.execute(
          sql`SELECT source AS bron, count(*)::int AS sessies,
                     count(*) FILTER (WHERE tss IS NULL)::int AS zonder_belastingscore,
                     max(updated_at) AS laatste_update
              FROM training_sessions
              GROUP BY source
              ORDER BY sessies DESC`,
        )
      ).rows;

      // (2) Ontbrekende gegevens (platformbreed, eerlijke telling).
      const missing = (
        await db.execute(
          sql`SELECT count(*)::int AS totaal,
                     count(*) FILTER (WHERE avg_power IS NULL AND normalized_power IS NULL)::int AS zonder_vermogen,
                     count(*) FILTER (WHERE avg_hr IS NULL)::int AS zonder_hartslag,
                     count(*) FILTER (WHERE duration_min IS NULL)::int AS zonder_duur,
                     count(*) FILTER (WHERE tss IS NULL)::int AS zonder_belastingscore
              FROM training_sessions`,
        )
      ).rows[0];

      // (3) Conflicten: sessies waar meerdere bronnen zijn samengevoegd
      // (merge_log gevuld) — dat zijn de plekken waar waarden konden botsen.
      const conflicts = (
        await db.execute(
          sql`SELECT count(*)::int AS sessies_met_merge,
                     coalesce(sum(jsonb_array_length(merge_log)), 0)::int AS merge_gebeurtenissen
              FROM training_sessions
              WHERE merge_log IS NOT NULL AND jsonb_array_length(merge_log) > 0`,
        )
      ).rows[0];

      // (4) Duplicaten: meerdere sessies met dezelfde dedupe-sleutel per
      // gebruiker (horen samengevoegd te zijn).
      const duplicates = (
        await db.execute(
          sql`SELECT count(*)::int AS groepen,
                     coalesce(sum(n - 1), 0)::int AS overtollige_rijen
              FROM (
                SELECT clerk_id, dedupe_key, count(*)::int AS n
                FROM training_sessions
                WHERE dedupe_key IS NOT NULL
                GROUP BY clerk_id, dedupe_key
                HAVING count(*) > 1
              ) g`,
        )
      ).rows[0];

      // (5) Synchronisatiefouten: mislukte sync_runs + recentste meldingen.
      const syncErrors = (
        await db.execute(
          sql`SELECT count(*)::int AS totaal,
                     count(*) FILTER (WHERE started_at > now() - interval '7 days')::int AS laatste_7_dagen
              FROM sync_runs WHERE status = 'error'`,
        )
      ).rows[0];
      const recentSyncErrors = (
        await db.execute(
          sql`SELECT id, provider, trigger, started_at, error
              FROM sync_runs WHERE status = 'error'
              ORDER BY started_at DESC LIMIT 10`,
        )
      ).rows;

      // (6) Onbekende bronnen: source-waarden buiten de vaste lijst.
      const unknownSources = (
        await db.execute(
          sql`SELECT source AS bron, count(*)::int AS sessies
              FROM training_sessions
              WHERE source NOT IN (${sql.join(
                KNOWN_SESSION_SOURCES.map((s) => sql`${s}`),
                sql`, `,
              )})
              GROUP BY source ORDER BY sessies DESC`,
        )
      ).rows;

      // (7) Herleidbaarheid: geregistreerde berekeningen (computation_traces).
      const traces = (
        await db.execute(
          sql`SELECT subject_type AS type, engine, count(*)::int AS aantal,
                     max(computed_at) AS laatste
              FROM computation_traces
              GROUP BY subject_type, engine
              ORDER BY aantal DESC`,
        )
      ).rows;

      res.json({
        datasets,
        ontbrekend: missing ?? null,
        conflicten: conflicts ?? null,
        duplicaten: duplicates ?? null,
        syncfouten: {
          telling: syncErrors ?? null,
          recent: recentSyncErrors,
        },
        onbekendeBronnen: unknownSources,
        berekeningen: traces,
        opgehaald: new Date().toISOString(),
      });
    } catch (err) {
      req.log.error({ err }, "admin.dataTrustDashboard failed");
      res.status(500).json({ error: "Data Trust Dashboard laden mislukt" });
    }
  },
);

// ── Entitlement-beheer (commerciële rechten, gescheiden van flags) ──────────

// GET /api/admin/entitlements/users?query= — zoek gebruikers op e-mail/naam/
// clerkId en toon modus + variant.
router.get(
  "/entitlements/users",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const query = String(req.query.query ?? "").trim();
      const like = `%${query}%`;
      const result = await db.execute(sql`
        SELECT clerk_id, email, display_name, entitlement_mode, product_variant
        FROM user_profiles
        WHERE ${query === "" ? sql`true` : sql`(email ILIKE ${like} OR display_name ILIKE ${like} OR clerk_id ILIKE ${like})`}
        ORDER BY created_at DESC
        LIMIT 25
      `);
      res.json({ users: result.rows });
    } catch (err) {
      req.log.error({ err }, "admin.entitlements.users failed");
      res.status(500).json({ error: "Kon gebruikers niet laden" });
    }
  },
);

// GET /api/admin/entitlements/:clerkId — volledige entitlementstatus van één
// gebruiker (gelogd in het auditlog).
router.get(
  "/entitlements/:clerkId",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const subject = String(req.params.clerkId);
      const resolved = await resolveEntitlements(subject);
      const rows = await db
        .select({
          id: userEntitlementsTable.id,
          entitlementKey: userEntitlementsTable.entitlementKey,
          entitlementType: userEntitlementsTable.entitlementType,
          status: userEntitlementsTable.status,
          source: userEntitlementsTable.source,
          startsAt: userEntitlementsTable.startsAt,
          endsAt: userEntitlementsTable.endsAt,
        })
        .from(userEntitlementsTable)
        .where(eq(userEntitlementsTable.clerkId, subject))
        .orderBy(desc(userEntitlementsTable.createdAt));
      await writeAudit({
        event: "entitlements_viewed_by_admin",
        actorClerkId: getClerkUserId(req),
        subjectClerkId: subject,
        req,
      });
      res.json({
        entitlement_mode: resolved.entitlementMode,
        product_variant: resolved.productVariant,
        commercial_features: resolved.commercialFeatures,
        // Keuze 19 (beslist 01-08-2026): degraded-status verplicht zichtbaar
        // voor beheer/support — true betekent dat minstens één rechtenbron
        // onleesbaar was en fail-closed niet meetelde.
        degraded: resolved.degraded,
        entitlements: rows,
      });
    } catch (err) {
      req.log.error({ err }, "admin.entitlements.get failed");
      res.status(500).json({ error: "Kon rechten niet laden" });
    }
  },
);

// PUT /api/admin/entitlements/:clerkId/mode — wijzig entitlementmodus en/of
// productvariant. subscription vereist een geldige variant (fail-closed).
router.put(
  "/entitlements/:clerkId/mode",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const subject = String(req.params.clerkId);
      const mode = req.body?.entitlementMode;
      const rawVariant = req.body?.productVariant ?? null;
      if (!isValidMode(mode)) {
        res.status(400).json({ error: "Ongeldige entitlementmodus" });
        return;
      }
      if (rawVariant !== null && !isValidVariant(rawVariant)) {
        res.status(400).json({ error: "Ongeldige productvariant" });
        return;
      }
      if (mode === "subscription" && rawVariant === null) {
        res.status(400).json({
          error: "Abonnementsmodus vereist een productvariant",
        });
        return;
      }
      const [before] = await db
        .select({
          entitlementMode: userProfilesTable.entitlementMode,
          productVariant: userProfilesTable.productVariant,
        })
        .from(userProfilesTable)
        .where(eq(userProfilesTable.clerkId, subject));
      if (!before) {
        res.status(404).json({ error: "Gebruiker niet gevonden" });
        return;
      }
      await db
        .update(userProfilesTable)
        .set({
          entitlementMode: mode,
          productVariant: rawVariant,
          updatedAt: new Date(),
        })
        .where(eq(userProfilesTable.clerkId, subject));
      await writeAudit({
        event: "entitlement_mode_changed",
        actorClerkId: getClerkUserId(req),
        subjectClerkId: subject,
        meta: {
          from: { mode: before.entitlementMode, variant: before.productVariant },
          to: { mode, variant: rawVariant },
        },
        req,
      });
      res.json({ ok: true, entitlement_mode: mode, product_variant: rawVariant });
    } catch (err) {
      req.log.error({ err }, "admin.entitlements.mode failed");
      res.status(500).json({ error: "Kon modus niet wijzigen" });
    }
  },
);

// POST /api/admin/entitlements/:clerkId — ken een persoonlijk recht toe
// (add-on, proefrecht, contentrecht of tijdelijk pakket). Altijd gelogd.
router.post(
  "/entitlements/:clerkId",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const subject = String(req.params.clerkId);
      const entitlementKey = String(req.body?.entitlementKey ?? "").trim();
      const entitlementType = req.body?.entitlementType;
      const source = String(req.body?.source ?? "admin").trim() || "admin";
      const endsAtRaw = req.body?.endsAt ?? null;
      if (!entitlementKey) {
        res.status(400).json({ error: "entitlementKey is verplicht" });
        return;
      }
      if (!isValidEntitlementType(entitlementType)) {
        res.status(400).json({ error: "Ongeldig entitlementtype" });
        return;
      }
      let endsAt: Date | null = null;
      if (endsAtRaw !== null && endsAtRaw !== "") {
        endsAt = new Date(String(endsAtRaw));
        if (Number.isNaN(endsAt.getTime())) {
          res.status(400).json({ error: "Ongeldige einddatum" });
          return;
        }
      }
      // Tijdelijke rechten vereisen een einddatum (anders zijn ze permanent).
      if (
        (entitlementType === "temporary_addon" ||
          entitlementType === "trial" ||
          entitlementType === "temporary_package") &&
        !endsAt
      ) {
        res.status(400).json({
          error: "Tijdelijke rechten vereisen een einddatum",
        });
        return;
      }
      const [profile] = await db
        .select({ clerkId: userProfilesTable.clerkId })
        .from(userProfilesTable)
        .where(eq(userProfilesTable.clerkId, subject));
      if (!profile) {
        res.status(404).json({ error: "Gebruiker niet gevonden" });
        return;
      }
      const actor = getClerkUserId(req);
      const [row] = await db
        .insert(userEntitlementsTable)
        .values({
          clerkId: subject,
          entitlementKey,
          entitlementType: String(entitlementType),
          status: "active",
          source,
          endsAt,
          createdBy: actor,
        })
        .returning();
      await writeAudit({
        event: "entitlement_granted",
        actorClerkId: actor,
        subjectClerkId: subject,
        meta: {
          id: row.id,
          key: entitlementKey,
          type: String(entitlementType),
          source,
          endsAt: endsAt ? endsAt.toISOString() : null,
        },
        req,
      });
      res.json({ ok: true, entitlement: row });
    } catch (err) {
      req.log.error({ err }, "admin.entitlements.grant failed");
      res.status(500).json({ error: "Kon recht niet toekennen" });
    }
  },
);

// POST /api/admin/entitlements/:clerkId/:id/revoke — trek een recht in
// (status revoked; rij blijft bestaan voor herleidbaarheid).
router.post(
  "/entitlements/:clerkId/:id/revoke",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    try {
      const subject = String(req.params.clerkId);
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ error: "Ongeldig id" });
        return;
      }
      const [row] = await db
        .update(userEntitlementsTable)
        .set({ status: "revoked", updatedAt: new Date() })
        .where(
          sql`${userEntitlementsTable.id} = ${id} AND ${userEntitlementsTable.clerkId} = ${subject} AND ${userEntitlementsTable.status} = 'active'`,
        )
        .returning();
      if (!row) {
        res.status(404).json({ error: "Recht niet gevonden of al ingetrokken" });
        return;
      }
      await writeAudit({
        event: "entitlement_revoked",
        actorClerkId: getClerkUserId(req),
        subjectClerkId: subject,
        meta: { id: row.id, key: row.entitlementKey, type: row.entitlementType },
        req,
      });
      res.json({ ok: true, entitlement: row });
    } catch (err) {
      req.log.error({ err }, "admin.entitlements.revoke failed");
      res.status(500).json({ error: "Kon recht niet intrekken" });
    }
  },
);

// ─── Systeemmodus ────────────────────────────────────────────────────────────

/** GET /admin/system-mode — huidige modus (leesbaar voor elke ingelogde admin). */
router.get(
  "/system-mode",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      const data = await readSystemMode();
      res.json(data);
    } catch (err) {
      req.log.error({ err }, "admin.system-mode.get failed");
      res.status(500).json({ error: "Kon systeemmodus niet lezen" });
    }
  },
);

/** POST /admin/system-mode — stel modus in. Body: { mode, reason? } */
router.post(
  "/system-mode",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const { mode, reason } = req.body ?? {};
    if (!mode || !systemBusinessModes.includes(mode)) {
      res.status(400).json({ error: "Ongeldige modus", allowed: systemBusinessModes });
      return;
    }
    const actorClerkId = getClerkUserId(req)!;
    const fwd = req.headers["x-forwarded-for"];
    const actorIp = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim() ?? req.socket?.remoteAddress ?? undefined;
    try {
      await writeSystemMode(mode, {
        reason: typeof reason === "string" ? reason : undefined,
        actorClerkId,
        actorIp,
      });
      res.json({ ok: true, mode });
    } catch (err) {
      req.log.error({ err }, "admin.system-mode.post failed");
      res.status(500).json({ error: "Kon systeemmodus niet opslaan" });
    }
  },
);

/** GET /admin/ops-log — recente admin-acties (max 50). */
router.get(
  "/ops-log",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    try {
      const log = await db
        .select()
        .from(adminOpsLogTable)
        .orderBy(desc(adminOpsLogTable.createdAt))
        .limit(50);
      res.json({ log });
    } catch (err) {
      req.log.error({ err }, "admin.ops-log.get failed");
      res.status(500).json({ error: "Kon log niet laden" });
    }
  },
);

/** POST /admin/observation-cleanup — markeer verouderde/dubbele observaties als
 *  "outdated" voor één gebruiker (clerkId verplicht). Droogdraai tenzij
 *  apply=true. Alleen toegankelijk voor admins. */
router.post(
  "/observation-cleanup",
  requireAuth,
  requireAdmin,
  async (req, res): Promise<void> => {
    const { clerkId, apply } = req.body as {
      clerkId?: string;
      apply?: boolean;
    };
    const target = String(clerkId ?? "").trim();
    if (!target) {
      res.status(400).json({ error: "clerkId is verplicht" });
      return;
    }
    try {
      const report = await runObservationCleanup(target, apply === true);
      res.json({ ok: true, apply: apply === true, ...report });
    } catch (err) {
      req.log.error({ err }, "admin.observation-cleanup failed");
      res.status(500).json({ error: "Observatie-opschoning mislukt" });
    }
  },
);

// ── ABONNEMENT_01 §1.9 — admininzicht per gebruiker ─────────────────────────
// Huidige pakketstatus + bron, abonnementsrijen, laatste webhooks (tijdstip +
// resultaat) en openstaande events. Géén betaalgegevens die hier niet horen
// (er staan er ook geen in de database: alleen Stripe-id's en statusvelden).
// Let op de eerlijke beperking: een MISLUKTE verwerking rolt de registratie
// volledig terug (herleverbaar), dus mislukte events staan bewust niet in de
// tabel — dat wordt hieronder expliciet gemeld in plaats van verzonnen.
router.get(
  "/billing/:clerkId",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const clerkId = String(req.params.clerkId);
    try {
      const state = await getBillingState(clerkId);
      const subs = await db
        .select()
        .from(billingSubscriptionsTable)
        .where(eq(billingSubscriptionsTable.clerkId, clerkId));
      const subIds = subs.map((s) => s.stripeSubscriptionId);
      // Webhookresultaten vermelden het subscription-id in het resultaatveld;
      // events zonder gebruikerskoppeling (bv. genegeerd) blijven buiten beeld.
      // Drizzle ALL/ANY-array-trap (zie memory): bouw de filter veilig met OR.
      let events: (typeof stripeWebhookEventsTable.$inferSelect)[] = [];
      if (subIds.length > 0) {
        const conds = subIds.map(
          (id) => sql`${stripeWebhookEventsTable.result} LIKE ${"%" + id + "%"}`,
        );
        let combined = conds[0]!;
        for (const c of conds.slice(1)) combined = sql`${combined} OR ${c}`;
        events = await db
          .select()
          .from(stripeWebhookEventsTable)
          .where(sql`(${combined})`)
          .orderBy(desc(stripeWebhookEventsTable.createdAt))
          .limit(20);
      }
      const open = events.filter((e) => e.processedAt == null);
      res.json({
        clerkId,
        status: state,
        statusBron:
          state.status === "legacy_unrestricted"
            ? "entitlement_mode (legacy)"
            : state.hasStripeSubscription
              ? "billing_subscriptions (Stripe-webhooks)"
              : state.status === "trialing" || state.status === "expired"
                ? "user_entitlements (Sparki-proef)"
                : "geen abonnementsgegevens (Gratis)",
        subscriptions: subs.map((s) => ({
          stripeSubscriptionId: s.stripeSubscriptionId,
          tier: s.tier,
          interval: s.interval,
          status: s.status,
          currentPeriodEnd: s.currentPeriodEnd,
          graceUntil: s.graceUntil,
          plannedDowngradeTier: s.plannedDowngradeTier,
          lastEventCreated: s.lastEventCreated,
          updatedAt: s.updatedAt,
        })),
        laatsteWebhooks: events.map((e) => ({
          eventId: e.eventId,
          type: e.type,
          receivedAt: e.createdAt,
          processedAt: e.processedAt,
          result: e.result,
        })),
        openstaandeEvents: open.map((e) => e.eventId),
        toelichtingMislukt:
          "Een mislukte verwerking rolt volledig terug en laat geen rij achter; Stripe levert het event opnieuw. Mislukte pogingen staan daarom in de serverlogs, niet in deze tabel.",
      });
    } catch (err) {
      req.log.error({ err }, "admin.billing failed");
      res.status(500).json({ error: "Kon billinginzicht niet laden" });
    }
  },
);

export default router;
