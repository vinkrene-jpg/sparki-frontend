import { Router } from "express";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  athleteProfilesTable,
  trainingSessionsTable,
  activityImportsTable,
  plannedWorkoutsTable,
  workoutFeedbackTable,
  athleteDailyMetricsTable,
  ftpHistoryTable,
  lifeEventsTable,
  LIFE_EVENT_IMPACTS,
  LIFE_EVENT_KINDS,
} from "@workspace/db";
import type { BusyDay } from "../lib/training/plan-generator";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { generateThreeWeekPlan, autoAdaptPlan } from "../engines/training-plan";
import {
  computeZones,
  deriveFromCheckin,
  deriveFromTraining,
} from "../engines/profile";
import { computeLoad } from "../engines/recovery-load";
import { captureContext } from "../engines/context-memory";
import { ingestManualSession } from "../lib/manual-session-ingest";

const router = Router();

// Fire the autonomous provisional re-adaptation after a recovery/health signal
// changes. Best-effort and non-blocking for the originating write: the helper
// never throws, and we only log when it reports a failure.
function triggerPlanRefresh(
  req: import("express").Request,
  clerkId: string,
): void {
  void autoAdaptPlan(clerkId).then((r) => {
    if (r.error)
      req.log.error({ err: r.error }, "auto plan adaptation failed");
  });
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

function daysAgoStr(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split("T")[0]!;
}

// ── GET /api/athlete/profile ─────────────────────────────────────────────────
router.get("/profile", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [user] = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkId));
    const [athlete] = await db
      .select()
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId));

    if (!user || !athlete) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const zones = athlete.ftp ? computeZones(athlete.ftp) : null;
    const wkg =
      athlete.ftp && athlete.weightKg
        ? Math.round((athlete.ftp / Number(athlete.weightKg)) * 100) / 100
        : null;

    res.json({ ...user, ...athlete, zones, wkg });
  } catch (err) {
    req.log.error({ err }, "athlete.profile GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/athlete/profile ─────────────────────────────────────────────────
router.put("/profile", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const {
    ftp,
    ftpEstimated,
    weightKg,
    heightCm,
    birthYear,
    birthDate,
    discipline,
    goals,
    developmentGoal,
    weeklyHourTarget,
    displayName,
    experienceLevel,
    availableDays,
    loadCapacity,
    injuryHistory,
    trainingPreferences,
    coachingMode,
    homeLat,
    homeLon,
    homeLabel,
  } = req.body as {
    ftp?: number;
    ftpEstimated?: boolean;
    weightKg?: string;
    heightCm?: number | string | null;
    birthYear?: number | string | null;
    birthDate?: string | null;
    discipline?: string;
    goals?: string;
    developmentGoal?: string | null;
    weeklyHourTarget?: number;
    displayName?: string;
    experienceLevel?: string | null;
    availableDays?: string[] | null;
    loadCapacity?: string | null;
    injuryHistory?: string | null;
    trainingPreferences?: string | null;
    coachingMode?: string | null;
    homeLat?: number | string | null;
    homeLon?: number | string | null;
    homeLabel?: string | null;
  };

  // Whitelisted enum values for the planning inputs (never trust raw input).
  const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const EXPERIENCE = ["beginner", "intermediate", "advanced", "elite"];
  const LOAD = ["low", "moderate", "high"];
  const COACHING = ["self", "coach"];
  const DEVELOPMENT_GOALS = [
    "recreatief",
    "granfondo",
    "topamateur",
    "elite_u23",
    "prof",
    "persoonlijk",
  ];
  const cleanCoaching =
    coachingMode != null && COACHING.includes(coachingMode)
      ? coachingMode
      : undefined;
  // developmentGoal: explicit null clears it; a valid enum key sets it; anything
  // else (unknown string) is ignored rather than trusted.
  let cleanDevelopmentGoal: string | null | undefined;
  if (developmentGoal === null) {
    cleanDevelopmentGoal = null;
  } else if (
    developmentGoal != null &&
    DEVELOPMENT_GOALS.includes(developmentGoal)
  ) {
    cleanDevelopmentGoal = developmentGoal;
  }
  const cleanDays =
    availableDays != null
      ? Array.from(new Set(availableDays.filter((d) => WEEKDAYS.includes(d))))
      : undefined;
  const cleanExperience =
    experienceLevel != null && EXPERIENCE.includes(experienceLevel)
      ? experienceLevel
      : undefined;
  const cleanLoad =
    loadCapacity != null && LOAD.includes(loadCapacity)
      ? loadCapacity
      : undefined;
  // Lengte (cm) and geboortejaar — integer columns; only persisted when present
  // and within a plausible human range (never trust raw input). Sending `null`
  // explicitly clears the value; omitting the field leaves it untouched.
  const nowYear = new Date().getFullYear();
  let cleanHeightCm: number | null | undefined;
  if (heightCm === null) {
    cleanHeightCm = null;
  } else if (heightCm !== undefined && heightCm !== "") {
    const h = Math.round(Number(heightCm));
    cleanHeightCm = Number.isFinite(h) && h >= 100 && h <= 250 ? h : undefined;
  }
  let cleanBirthYear: number | null | undefined;
  if (birthYear === null) {
    cleanBirthYear = null;
  } else if (birthYear !== undefined && birthYear !== "") {
    const y = Math.round(Number(birthYear));
    cleanBirthYear =
      Number.isFinite(y) && y >= 1920 && y <= nowYear ? y : undefined;
  }
  // Full date of birth (YYYY-MM-DD) — the source of truth for exact age. Sending
  // `null` clears it; a valid, non-future date within a plausible range is kept
  // and also derives birthYear so year-only fallbacks stay consistent.
  const todayIso = new Date().toISOString().slice(0, 10);
  let cleanBirthDate: string | null | undefined;
  if (birthDate === null) {
    cleanBirthDate = null;
  } else if (birthDate !== undefined && birthDate !== "") {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
    if (m) {
      const y = Number(m[1]);
      const parsed = new Date(`${birthDate}T00:00:00Z`);
      const validCalendar =
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === birthDate;
      if (validCalendar && y >= 1920 && birthDate <= todayIso) {
        cleanBirthDate = birthDate;
        // Full DOB is authoritative — always derive birthYear from it so the
        // year-only fallback can never drift out of sync with the exact date,
        // even if the caller sent a conflicting birthYear in the same payload.
        cleanBirthYear = y;
      }
    }
  }

  const latNum = homeLat != null && homeLat !== "" ? Number(homeLat) : null;
  const lonNum = homeLon != null && homeLon !== "" ? Number(homeLon) : null;
  const homeValid =
    latNum != null &&
    lonNum != null &&
    Number.isFinite(latNum) &&
    Number.isFinite(lonNum) &&
    latNum >= -90 &&
    latNum <= 90 &&
    lonNum >= -180 &&
    lonNum <= 180;

  try {
    if (displayName != null) {
      await db
        .update(userProfilesTable)
        .set({ displayName, updatedAt: new Date() })
        .where(eq(userProfilesTable.clerkId, clerkId));
    }

    const [updated] = await db
      .update(athleteProfilesTable)
      .set({
        ...(ftp != null && { ftp }),
        ...(typeof ftpEstimated === "boolean" && { ftpEstimated }),
        ...(weightKg != null && { weightKg }),
        ...(cleanHeightCm !== undefined && { heightCm: cleanHeightCm }),
        ...(cleanBirthYear !== undefined && { birthYear: cleanBirthYear }),
        ...(cleanBirthDate !== undefined && { birthDate: cleanBirthDate }),
        ...(discipline != null && { discipline }),
        ...(goals != null && { goals }),
        ...(cleanDevelopmentGoal !== undefined && {
          developmentGoal: cleanDevelopmentGoal,
        }),
        ...(weeklyHourTarget != null && { weeklyHourTarget }),
        ...(cleanExperience !== undefined && {
          experienceLevel: cleanExperience,
        }),
        ...(cleanDays !== undefined && { availableDays: cleanDays }),
        ...(cleanLoad !== undefined && { loadCapacity: cleanLoad }),
        ...(injuryHistory !== undefined && { injuryHistory }),
        ...(trainingPreferences !== undefined && { trainingPreferences }),
        ...(cleanCoaching !== undefined && { coachingMode: cleanCoaching }),
        ...(homeLat !== undefined &&
          homeLon !== undefined && {
            homeLat: homeValid ? String(latNum) : null,
            homeLon: homeValid ? String(lonNum) : null,
            homeLabel: homeValid ? (homeLabel ?? null) : null,
          }),
        updatedAt: new Date(),
      })
      .where(eq(athleteProfilesTable.clerkId, clerkId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const zones = updated.ftp ? computeZones(updated.ftp) : null;
    const wkg =
      updated.ftp && updated.weightKg
        ? Math.round((updated.ftp / Number(updated.weightKg)) * 100) / 100
        : null;

    res.json({ ...updated, zones, wkg });
  } catch (err) {
    req.log.error({ err }, "athlete.profile PUT failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/athlete/health-status ───────────────────────────────────────────
// Athlete-set health status (blueprint §4 #1). Setting "sick"/"injured" routes
// Home to the calm Emergency recovery-only view; "ok" clears it.
router.put("/health-status", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const { healthStatus } = req.body as { healthStatus?: string };

  const allowed = ["ok", "sick", "injured"] as const;
  if (!healthStatus || !allowed.includes(healthStatus as (typeof allowed)[number])) {
    res.status(400).json({ error: "healthStatus must be one of: ok, sick, injured" });
    return;
  }

  try {
    const [updated] = await db
      .update(athleteProfilesTable)
      .set({ healthStatus, updatedAt: new Date() })
      .where(eq(athleteProfilesTable.clerkId, clerkId))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    triggerPlanRefresh(req, clerkId);

    // Doelen-engine: a reported injury/illness immediately marks the impact on
    // every active goal (idempotent per day). Best-effort — never blocks.
    if (healthStatus === "injured" || healthStatus === "sick") {
      import("../engines/goals")
        .then(({ reassessGoalsOnHealthChange }) =>
          reassessGoalsOnHealthChange(clerkId, healthStatus),
        )
        .catch((err) =>
          req.log.error({ err }, "goals.reassessOnHealthChange failed"),
        );
    }

    res.json({ healthStatus: updated.healthStatus });
  } catch (err) {
    req.log.error({ err }, "athlete.health-status PUT failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/athlete/dashboard ───────────────────────────────────────────────
router.get("/dashboard", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const today = todayStr();
  const ninetyDaysAgo = daysAgoStr(90);

  try {
    const [athleteProfile] = await db
      .select()
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId));

    const [todayWorkout] = await db
      .select()
      .from(plannedWorkoutsTable)
      .where(
        and(
          eq(plannedWorkoutsTable.clerkId, clerkId),
          eq(plannedWorkoutsTable.scheduledDate, today),
        ),
      )
      .limit(1);

    const [todayMetrics] = await db
      .select()
      .from(athleteDailyMetricsTable)
      .where(
        and(
          eq(athleteDailyMetricsTable.clerkId, clerkId),
          eq(athleteDailyMetricsTable.metricDate, today),
        ),
      );

    const allSessions = await db
      .select({
        sessionDate: trainingSessionsTable.sessionDate,
        tss: trainingSessionsTable.tss,
      })
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.clerkId, clerkId),
          gte(trainingSessionsTable.sessionDate, ninetyDaysAgo),
        ),
      );

    const loadData = computeLoad(allSessions);

    // 7-day TSS per day
    const sevenDaysAgo = daysAgoStr(7);
    const weekTSSByDay: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      weekTSSByDay[d.toISOString().split("T")[0]!] = 0;
    }
    for (const s of allSessions) {
      if (s.tss != null && s.sessionDate >= sevenDaysAgo && weekTSSByDay[s.sessionDate] !== undefined) {
        weekTSSByDay[s.sessionDate] = (weekTSSByDay[s.sessionDate] ?? 0) + s.tss;
      }
    }
    const weekTSS = Object.entries(weekTSSByDay).map(([date, tss]) => ({
      date,
      tss,
    }));

    res.json({
      todayWorkout: todayWorkout ?? null,
      todayMetrics: todayMetrics ?? null,
      load: loadData,
      weekTSS,
      athleteProfile: athleteProfile ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "athlete.dashboard failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/athlete/workouts/today ──────────────────────────────────────────
router.get("/workouts/today", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const today = todayStr();
  try {
    const [workout] = await db
      .select()
      .from(plannedWorkoutsTable)
      .where(
        and(
          eq(plannedWorkoutsTable.clerkId, clerkId),
          eq(plannedWorkoutsTable.scheduledDate, today),
        ),
      )
      .limit(1);
    res.json(workout ?? null);
  } catch (err) {
    req.log.error({ err }, "athlete.workouts.today failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/athlete/workouts ────────────────────────────────────────────────
router.get("/workouts", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const { from, to } = req.query as { from?: string; to?: string };
  try {
    const workouts = await db
      .select()
      .from(plannedWorkoutsTable)
      .where(
        and(
          eq(plannedWorkoutsTable.clerkId, clerkId),
          gte(plannedWorkoutsTable.scheduledDate, from ?? daysAgoStr(14)),
          lte(plannedWorkoutsTable.scheduledDate, to ?? todayStr()),
        ),
      )
      .orderBy(desc(plannedWorkoutsTable.scheduledDate));
    res.json(workouts);
  } catch (err) {
    req.log.error({ err }, "athlete.workouts GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/athlete/workouts ───────────────────────────────────────────────
router.post("/workouts", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const {
    scheduledDate,
    type,
    title,
    description,
    targetDurationMin,
    targetTSS,
    structure,
    source,
  } = req.body as {
    scheduledDate: string;
    type?: string;
    title: string;
    description?: string;
    targetDurationMin?: number;
    targetTSS?: number;
    structure?: unknown;
    source?: string;
  };

  if (!scheduledDate || !title) {
    res.status(400).json({ error: "scheduledDate and title are required" });
    return;
  }

  // Day-type engine distinguishes coach- vs Sparki-planned workouts
  // (blueprint §4); default to "sparki" for anything else.
  const workoutSource = source === "coach" ? "coach" : "sparki";

  try {
    const [workout] = await db
      .insert(plannedWorkoutsTable)
      .values({
        clerkId,
        scheduledDate,
        type: type ?? "ride",
        title,
        description: description ?? null,
        targetDurationMin: targetDurationMin ?? null,
        targetTSS: targetTSS ?? null,
        structure: structure ?? null,
        status: "planned",
        source: workoutSource,
      })
      .returning();
    res.status(201).json(workout);
  } catch (err) {
    req.log.error({ err }, "athlete.workouts POST failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/athlete/workouts/:id ────────────────────────────────────────────
router.put("/workouts/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid workout id" });
    return;
  }

  const {
    status,
    title,
    description,
    scheduledDate,
    targetDurationMin,
    targetTSS,
    structure,
    sessionId,
  } = req.body as {
    status?: string;
    title?: string;
    description?: string;
    scheduledDate?: string;
    targetDurationMin?: number;
    targetTSS?: number;
    structure?: unknown;
    sessionId?: number;
  };

  // Validate proposal-applied fields so a bad LLM payload can't corrupt a workout.
  if (scheduledDate != null && !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    res.status(400).json({ error: "Invalid scheduledDate (expected YYYY-MM-DD)" });
    return;
  }
  if (
    targetDurationMin != null &&
    (!Number.isFinite(targetDurationMin) ||
      targetDurationMin < 0 ||
      targetDurationMin > 1440)
  ) {
    res.status(400).json({ error: "Invalid targetDurationMin" });
    return;
  }
  if (
    targetTSS != null &&
    (!Number.isFinite(targetTSS) || targetTSS < 0 || targetTSS > 1000)
  ) {
    res.status(400).json({ error: "Invalid targetTSS" });
    return;
  }

  try {
    // Coachautoriteit: een training van de coach mag Sparki/de sporter hier
    // niet inhoudelijk herschrijven. Status (gedaan/overgeslagen) en het
    // koppelen van een uitgevoerde sessie blijven wél toegestaan — dat is
    // registratie, geen herprogrammering.
    const [current] = await db
      .select({
        id: plannedWorkoutsTable.id,
        source: plannedWorkoutsTable.source,
      })
      .from(plannedWorkoutsTable)
      .where(
        and(
          eq(plannedWorkoutsTable.id, id),
          eq(plannedWorkoutsTable.clerkId, clerkId),
        ),
      );
    if (!current) {
      res.status(404).json({ error: "Workout not found" });
      return;
    }
    const touchesContent =
      title != null ||
      description != null ||
      scheduledDate != null ||
      targetDurationMin != null ||
      targetTSS != null ||
      structure != null;
    if (current.source === "coach" && touchesContent) {
      res.status(403).json({
        error:
          "Deze training komt van je coach. Sparki past die niet aan — bespreek een wijziging met je coach.",
        coachOwned: true,
      });
      return;
    }

    const [updated] = await db
      .update(plannedWorkoutsTable)
      .set({
        ...(status != null && { status }),
        ...(title != null && { title }),
        ...(description != null && { description }),
        ...(scheduledDate != null && { scheduledDate }),
        ...(targetDurationMin != null && { targetDurationMin }),
        ...(targetTSS != null && { targetTSS }),
        ...(structure != null && { structure }),
        ...(sessionId != null && { sessionId }),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(plannedWorkoutsTable.id, id),
          eq(plannedWorkoutsTable.clerkId, clerkId),
        ),
      )
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Workout not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "athlete.workouts PUT failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/athlete/workouts/:id ────────────────────────────────────────────
// Single workout + its feedback history. Ownership enforced via clerkId.
router.get("/workouts/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid workout id" });
    return;
  }
  try {
    const [workout] = await db
      .select()
      .from(plannedWorkoutsTable)
      .where(
        and(
          eq(plannedWorkoutsTable.id, id),
          eq(plannedWorkoutsTable.clerkId, clerkId),
        ),
      );
    if (!workout) {
      res.status(404).json({ error: "Workout not found" });
      return;
    }
    const feedback = await db
      .select()
      .from(workoutFeedbackTable)
      .where(
        and(
          eq(workoutFeedbackTable.workoutId, id),
          eq(workoutFeedbackTable.clerkId, clerkId),
        ),
      )
      .orderBy(desc(workoutFeedbackTable.createdAt));
    res.json({ ...workout, feedback });
  } catch (err) {
    req.log.error({ err }, "athlete.workouts.detail failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/athlete/workouts/:id/feedback ──────────────────────────────────
// Record athlete feedback. Certain feedback also moves the workout status so the
// day-type engine + load tracking stay in sync (done→completed, missed→skipped).
const FEEDBACK_TYPES = [
  "done",
  "missed",
  "too_hard",
  "too_light",
  "pain",
  "tired",
  "move",
] as const;

router.post("/workouts/:id/feedback", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid workout id" });
    return;
  }
  const { feedbackType, note } = req.body as {
    feedbackType?: string;
    note?: string;
  };
  if (
    !feedbackType ||
    !(FEEDBACK_TYPES as readonly string[]).includes(feedbackType)
  ) {
    res.status(400).json({
      error: `feedbackType must be one of: ${FEEDBACK_TYPES.join(", ")}`,
    });
    return;
  }

  try {
    // Ownership check before recording.
    const [workout] = await db
      .select()
      .from(plannedWorkoutsTable)
      .where(
        and(
          eq(plannedWorkoutsTable.id, id),
          eq(plannedWorkoutsTable.clerkId, clerkId),
        ),
      );
    if (!workout) {
      res.status(404).json({ error: "Workout not found" });
      return;
    }

    const [feedback] = await db
      .insert(workoutFeedbackTable)
      .values({ clerkId, workoutId: id, feedbackType, note: note ?? null })
      .returning();

    // Let Sparki pick up a personal-context moment from the feedback note
    // (e.g. "niet getraind, examen morgen"). Best-effort + privacy-gated inside
    // captureContext — never blocks or fails the feedback response.
    if (note && note.trim()) {
      captureContext(clerkId, note.trim()).catch((err) =>
        req.log.error({ err }, "athlete.workouts.feedback context capture failed"),
      );
    }

    // Mirror terminal feedback to the workout status.
    const newStatus =
      feedbackType === "done"
        ? "completed"
        : feedbackType === "missed"
          ? "skipped"
          : null;
    if (newStatus) {
      await db
        .update(plannedWorkoutsTable)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(
          and(
            eq(plannedWorkoutsTable.id, id),
            eq(plannedWorkoutsTable.clerkId, clerkId),
          ),
        );
    }

    // Behavioural signal for the coaching profile: completing a planned session
    // as planned vs deviating informs the begeleidingsprofiel. "missed" carries
    // no how-they-train signal, so it is left out.
    if (feedbackType !== "missed") {
      void deriveFromTraining(clerkId, {
        hadPlannedSession: true,
        completedAsPlanned: feedbackType === "done",
      }).catch((err) => req.log.error({ err }, "deriveFromTraining failed"));
    }

    res.status(201).json({ feedback });
  } catch (err) {
    req.log.error({ err }, "athlete.workouts.feedback failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Leefagenda (life events) ─────────────────────────────────────────────────
// Real athlete-entered context (toetsweek, familieweekend, drukke werkweek).
// Sparki's plan generator reads these and builds the schedule around them.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/athlete/life-events — upcoming + recent events (last 7 days back).
router.get("/life-events", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const cutoff = (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - 7);
      return d.toISOString().split("T")[0]!;
    })();
    // Overlap semantics: an event counts as long as it hasn't been over for
    // more than a week — including long-running events that started earlier.
    const events = await db
      .select()
      .from(lifeEventsTable)
      .where(
        and(
          eq(lifeEventsTable.clerkId, clerkId),
          gte(
            sql`coalesce(${lifeEventsTable.endDate}, ${lifeEventsTable.startDate})`,
            cutoff,
          ),
        ),
      )
      .orderBy(lifeEventsTable.startDate);
    res.json({ events });
  } catch (err) {
    req.log.error({ err }, "athlete.lifeEvents.list failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/athlete/life-events
router.post("/life-events", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = req.body as {
    kind?: string;
    title?: string;
    startDate?: string;
    endDate?: string | null;
    impact?: string;
    notes?: string | null;
  };
  const kind = String(body.kind ?? "");
  const title = String(body.title ?? "").trim().slice(0, 120);
  const impact = String(body.impact ?? "");
  const startDate = String(body.startDate ?? "");
  const endDate = body.endDate ? String(body.endDate) : null;

  if (!(LIFE_EVENT_KINDS as readonly string[]).includes(kind)) {
    res.status(400).json({ error: "invalid_kind" });
    return;
  }
  if (!(LIFE_EVENT_IMPACTS as readonly string[]).includes(impact)) {
    res.status(400).json({ error: "invalid_impact" });
    return;
  }
  if (!title) {
    res.status(400).json({ error: "title_required", message: "Geef een korte omschrijving." });
    return;
  }
  if (!DATE_RE.test(startDate) || (endDate !== null && !DATE_RE.test(endDate))) {
    res.status(400).json({ error: "invalid_date" });
    return;
  }
  if (endDate !== null && endDate < startDate) {
    res.status(400).json({ error: "invalid_range", message: "Einddatum ligt vóór de startdatum." });
    return;
  }

  try {
    const [event] = await db
      .insert(lifeEventsTable)
      .values({
        clerkId,
        kind: kind as (typeof LIFE_EVENT_KINDS)[number],
        title,
        startDate,
        endDate,
        impact: impact as (typeof LIFE_EVENT_IMPACTS)[number],
        notes: body.notes ? String(body.notes).slice(0, 500) : null,
      })
      .returning();
    res.status(201).json({ event });
  } catch (err) {
    req.log.error({ err }, "athlete.lifeEvents.create failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/athlete/life-events/:id
router.delete("/life-events/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "invalid_id" });
    return;
  }
  try {
    const deleted = await db
      .delete(lifeEventsTable)
      .where(
        and(eq(lifeEventsTable.id, id), eq(lifeEventsTable.clerkId, clerkId)),
      )
      .returning({ id: lifeEventsTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "athlete.lifeEvents.delete failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Build the per-date busy map the plan generator understands, from the
// athlete's life events overlapping [start, end]. Strongest impact wins when
// events overlap (geen_training > alleen_licht > minder_tijd).
async function loadBusyDays(
  clerkId: string,
  start: string,
  end: string,
): Promise<Record<string, BusyDay>> {
  const events = await db
    .select()
    .from(lifeEventsTable)
    .where(
      and(
        eq(lifeEventsTable.clerkId, clerkId),
        lte(lifeEventsTable.startDate, end),
      ),
    );
  const rank: Record<BusyDay["impact"], number> = {
    minder_tijd: 1,
    alleen_licht: 2,
    geen_training: 3,
  };
  const map: Record<string, BusyDay> = {};
  for (const ev of events) {
    const evEnd = ev.endDate ?? ev.startDate;
    if (evEnd < start) continue;
    const d = new Date(
      (ev.startDate > start ? ev.startDate : start) + "T00:00:00Z",
    );
    const stop = evEnd < end ? evEnd : end;
    while (true) {
      const iso = d.toISOString().split("T")[0]!;
      if (iso > stop) break;
      const existing = map[iso];
      if (!existing || rank[ev.impact] > rank[existing.impact]) {
        map[iso] = { impact: ev.impact, label: ev.title };
      }
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }
  return map;
}

// ── POST /api/athlete/plan/generate ──────────────────────────────────────────
// Generate a real periodized 3-week plan from the athlete's own numbers. Clears
// any future Sparki-planned, not-yet-done workouts in the window first so the
// plan is idempotent. Coach-planned and already-completed workouts are kept.
router.post("/plan/generate", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const { startDate, weeks } = req.body as {
    startDate?: string;
    weeks?: number;
  };

  try {
    const [athlete] = await db
      .select()
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId));

    if (!athlete?.ftp || !athlete?.weeklyHourTarget) {
      res.status(422).json({
        error: "profile_incomplete",
        message:
          "Stel eerst je FTP en wekelijkse uren in zodat Sparki een schema kan opbouwen.",
      });
      return;
    }

    const start = startDate ?? todayStr();
    const blocks = weeks && weeks > 0 && weeks <= 6 ? weeks : 3;
    const end = (() => {
      const d = new Date(start + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() + blocks * 7 - 1);
      return d.toISOString().split("T")[0]!;
    })();

    const busyDays = await loadBusyDays(clerkId, start, end);

    const rows = generateThreeWeekPlan({
      ftp: athlete.ftp,
      weeklyHourTarget: athlete.weeklyHourTarget,
      discipline: athlete.discipline,
      goals: athlete.goals,
      startDate: start,
      weeks: blocks,
      busyDays,
    });

    const inserted = await db.transaction(async (tx) => {
      // Remove the previous Sparki proposal in this window — but never touch
      // coach plans or workouts the athlete already engaged with.
      await tx
        .delete(plannedWorkoutsTable)
        .where(
          and(
            eq(plannedWorkoutsTable.clerkId, clerkId),
            eq(plannedWorkoutsTable.source, "sparki"),
            eq(plannedWorkoutsTable.status, "planned"),
            gte(plannedWorkoutsTable.scheduledDate, start),
            lte(plannedWorkoutsTable.scheduledDate, end),
          ),
        );
      if (rows.length === 0) return [];
      return tx
        .insert(plannedWorkoutsTable)
        .values(rows.map((r) => ({ ...r, clerkId })))
        .returning();
    });

    res.status(201).json({ workouts: inserted, from: start, to: end });
  } catch (err) {
    req.log.error({ err }, "athlete.plan.generate failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/athlete/sessions ────────────────────────────────────────────────
router.get("/sessions", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const limit = Math.min(
    parseInt(String(req.query["limit"] ?? "20"), 10),
    100,
  );
  try {
    const sessions = await db
      .select()
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.clerkId, clerkId))
      .orderBy(desc(trainingSessionsTable.sessionDate))
      .limit(limit);
    res.json(sessions);
  } catch (err) {
    req.log.error({ err }, "athlete.sessions GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/athlete/sessions/:id ────────────────────────────────────────────
// One session in full (all measured fields + notes) plus the REAL ridden track
// when the session came from an activity file whose import stored the parsed
// route geometry. Sessions without a stored track honestly return track: null
// — the mobile detail screen then says there is no map data, never a fake line.
router.get("/sessions/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Ongeldige rit" });
    return;
  }
  try {
    const [session] = await db
      .select()
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.id, id),
          eq(trainingSessionsTable.clerkId, clerkId),
        ),
      )
      .limit(1);
    if (!session) {
      res.status(404).json({ error: "Rit niet gevonden" });
      return;
    }

    // The ridden track lives on the linked activity import (parsedSummary.route
    // stored at ingest). Owner-scoped by clerkId as defense-in-depth.
    const [imp] = await db
      .select({
        id: activityImportsTable.id,
        parsedSummary: activityImportsTable.parsedSummary,
      })
      .from(activityImportsTable)
      .where(
        and(
          eq(activityImportsTable.linkedTrainingSessionId, session.id),
          eq(activityImportsTable.clerkId, clerkId),
        ),
      )
      .limit(1);

    const summaryBlob = imp?.parsedSummary as {
      route?: {
        geometry?: unknown;
        profile?: unknown;
        climbs?: unknown;
      } | null;
      segments?: unknown;
      streams?: unknown;
    } | null;
    const stored = summaryBlob?.route ?? null;

    // Het geplande blokkenschema dat aan deze sessie hangt (indien de sessie
    // uit een geplande training kwam) — voor de interval-vergelijking.
    const [plannedRow] = await db
      .select({
        title: plannedWorkoutsTable.title,
        type: plannedWorkoutsTable.type,
        structure: plannedWorkoutsTable.structure,
      })
      .from(plannedWorkoutsTable)
      .where(
        and(
          eq(plannedWorkoutsTable.sessionId, session.id),
          eq(plannedWorkoutsTable.clerkId, clerkId),
        ),
      )
      .limit(1);
    const plannedWorkout = plannedRow ?? null;

    // Real downsampled per-sample streams stored at ingest (FIT/TCX/GPX).
    // Lightly validated: must carry a time axis of ≥2 buckets; otherwise null.
    const rawStreams = summaryBlob?.streams as {
      t?: unknown;
    } | null;
    const streams =
      rawStreams &&
      Array.isArray(rawStreams.t) &&
      rawStreams.t.length >= 2 &&
      rawStreams.t.every((v) => typeof v === "number" && Number.isFinite(v))
        ? (summaryBlob!.streams as Record<string, unknown>)
        : null;
    // Only accept real numeric [lat, lon(, ele)] tuples — guards against
    // malformed historical JSON rather than trusting the stored shape blindly.
    const geometry = Array.isArray(stored?.geometry)
      ? (stored!.geometry as unknown[]).filter(
          (p): p is [number, number] =>
            Array.isArray(p) &&
            p.length >= 2 &&
            Number.isFinite(p[0]) &&
            Number.isFinite(p[1]) &&
            Math.abs(p[0] as number) <= 90 &&
            Math.abs(p[1] as number) <= 180,
        )
      : [];
    const track =
      geometry.length >= 2
        ? geometry.map((p) => [p[0], p[1]] as [number, number])
        : null;

    // Real elevation profile (downsampled metres) stored at ingest. Only
    // finite numbers pass; anything else means no honest profile → null.
    const rawProfile = Array.isArray(stored?.profile)
      ? (stored!.profile as unknown[]).filter(
          (v): v is number => typeof v === "number" && Number.isFinite(v),
        )
      : [];
    const profile = rawProfile.length >= 2 ? rawProfile : null;

    // Detected climbs from the same ingest parse — validated per entry, never
    // passed through blindly (older rows may miss fields).
    const climbs = Array.isArray(stored?.climbs)
      ? (stored!.climbs as unknown[])
          .flatMap((raw) => {
            if (typeof raw !== "object" || raw === null) return [];
            const cl = raw as {
              name?: unknown;
              lengthKm?: unknown;
              avgGradePct?: unknown;
              summitKm?: unknown;
            };
            if (
              typeof cl.lengthKm !== "number" ||
              !Number.isFinite(cl.lengthKm) ||
              typeof cl.avgGradePct !== "number" ||
              !Number.isFinite(cl.avgGradePct)
            ) {
              return [];
            }
            return [
              {
                name:
                  typeof cl.name === "string" && cl.name.trim()
                    ? cl.name.trim()
                    : null,
                lengthKm: cl.lengthKm,
                avgGradePct: cl.avgGradePct,
                summitKm:
                  typeof cl.summitKm === "number" &&
                  Number.isFinite(cl.summitKm)
                    ? cl.summitKm
                    : null,
              },
            ];
          })
      : [];

    // Rit-segmenten (klimmen/afdalingen met echte prestatie) — stored at GPX
    // ingest. Validated per entry; rides without them honestly return null.
    const segments = Array.isArray(summaryBlob?.segments)
      ? (summaryBlob!.segments as unknown[]).flatMap((raw) => {
          if (typeof raw !== "object" || raw === null) return [];
          const s = raw as Record<string, unknown>;
          const num = (v: unknown): number | null =>
            typeof v === "number" && Number.isFinite(v) ? v : null;
          const kind = s["kind"];
          if (kind !== "klim" && kind !== "afdaling") return [];
          const lengthKm = num(s["lengthKm"]);
          const avgGradePct = num(s["avgGradePct"]);
          const elevationDeltaM = num(s["elevationDeltaM"]);
          if (lengthKm == null || avgGradePct == null || elevationDeltaM == null)
            return [];
          return [
            {
              kind,
              name:
                typeof s["name"] === "string" && s["name"].trim()
                  ? s["name"].trim()
                  : kind === "klim"
                    ? "Klim"
                    : "Afdaling",
              startKm: num(s["startKm"]),
              endKm: num(s["endKm"]),
              lengthKm,
              avgGradePct,
              elevationDeltaM,
              timeSec: num(s["timeSec"]),
              avgKmh: num(s["avgKmh"]),
              maxKmh: num(s["maxKmh"]),
              avgPowerW: num(s["avgPowerW"]),
              avgHr: num(s["avgHr"]),
              vamMPerH: num(s["vamMPerH"]),
            },
          ];
        })
      : [];

    res.json({
      session,
      track,
      profile,
      climbs,
      segments: segments.length > 0 ? segments : null,
      streams,
      plannedWorkout,
    });
  } catch (err) {
    req.log.error({ err }, "athlete.sessions detail GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/athlete/sessions ───────────────────────────────────────────────
router.post("/sessions", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const {
    sessionDate,
    type,
    title,
    durationMin,
    distanceKm,
    elevationM,
    normalizedPower,
    avgPower,
    avgHR,
    tss,
    intensityFactor,
    notes,
    feelScore,
  } = req.body as {
    sessionDate: string;
    type?: string;
    title?: string;
    durationMin?: number;
    distanceKm?: string;
    elevationM?: number;
    normalizedPower?: number;
    avgPower?: number;
    avgHR?: number;
    tss?: number;
    intensityFactor?: string;
    notes?: string;
    feelScore?: number;
  };

  if (!sessionDate) {
    res.status(400).json({ error: "sessionDate is required" });
    return;
  }
  // Harde numerieke validatie: ongeldige cijfers mogen nooit de dedupe- of
  // belastingscoreberekening in (NaN maakt vergelijkingen betekenisloos).
  const numeriek: [string, unknown][] = [
    ["durationMin", durationMin],
    ["elevationM", elevationM],
    ["normalizedPower", normalizedPower],
    ["avgPower", avgPower],
    ["avgHR", avgHR],
    ["tss", tss],
    ["feelScore", feelScore],
  ];
  for (const [veld, waarde] of numeriek) {
    if (waarde != null && (typeof waarde !== "number" || !Number.isFinite(waarde))) {
      res.status(400).json({ error: `Ongeldige waarde voor ${veld}` });
      return;
    }
  }
  if (
    distanceKm != null &&
    distanceKm !== "" &&
    !Number.isFinite(Number(distanceKm))
  ) {
    res.status(400).json({ error: "Ongeldige waarde voor distanceKm" });
    return;
  }

  try {
    // Via de Data Hub-regels: dag-niveau dedupe (zelfde dag + zelfde type +
    // plausibel dezelfde rit ⇒ samenvoegen, nooit dubbel tellen) en een
    // afgeleide belastingscore waar vermogen + FTP dat toelaten.
    const { session, merged } = await ingestManualSession(clerkId, {
      sessionDate,
      type: type ?? "ride",
      title: title ?? null,
      durationMin: durationMin ?? null,
      distanceKm: distanceKm ?? null,
      elevationM: elevationM ?? null,
      normalizedPower: normalizedPower ?? null,
      avgPower: avgPower ?? null,
      avgHR: avgHR ?? null,
      tss: tss ?? null,
      intensityFactor: intensityFactor ?? null,
      notes: notes ?? null,
      feelScore: feelScore ?? null,
    });

    // Pick up a personal-context moment from the logbook notes (best-effort,
    // privacy-gated inside captureContext — never blocks the session response).
    if (notes && notes.trim()) {
      captureContext(clerkId, notes.trim()).catch((err) =>
        req.log.error({ err }, "athlete.sessions context capture failed"),
      );
    }

    triggerPlanRefresh(req, clerkId);
    res.status(merged ? 200 : 201).json({ ...session, merged });
  } catch (err) {
    req.log.error({ err }, "athlete.sessions POST failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── PUT /api/athlete/sessions/:id ────────────────────────────────────────────
// Attach the subjective gap (feel + notes) to a session Sparki already has —
// e.g. an activity imported from a connector. Only these two fields are
// updatable here: the objective data (duur/vermogen/afstand) comes from the
// source and is never re-entered or overwritten via this route.
router.put("/sessions/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid session id" });
    return;
  }

  const { feelScore, notes, title } = req.body as {
    feelScore?: number | null;
    notes?: string | null;
    title?: string | null;
  };

  if (feelScore != null && (feelScore < 1 || feelScore > 5)) {
    res.status(400).json({ error: "feelScore must be 1-5" });
    return;
  }

  // Normalise the title: trim, treat empty as cleared, cap length so a stray
  // paste can't bloat the row. Only title/notes/feel are user-editable here —
  // objective data stays owned by its source.
  let normalizedTitle: string | null | undefined = undefined;
  if (title !== undefined) {
    const trimmed = (title ?? "").trim();
    if (trimmed.length > 120) {
      res.status(400).json({ error: "title must be 120 characters or fewer" });
      return;
    }
    normalizedTitle = trimmed === "" ? null : trimmed;
  }

  try {
    // Ownership check — only update the caller's own session.
    const [existing] = await db
      .select()
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.id, id),
          eq(trainingSessionsTable.clerkId, clerkId),
        ),
      )
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    // Handmatige correcties markeren: velden die de sporter hier zelf aanpast
    // mogen bij een latere connector-merge nooit opnieuw gevuld/overschreven
    // worden. Herkomst per veld wordt eerlijk op "handmatig" gezet.
    const touched: string[] = [];
    if (notes !== undefined) touched.push("notes");
    if (normalizedTitle !== undefined) touched.push("title");
    const manualFields = [
      ...new Set([...(existing.manualFields ?? []), ...touched]),
    ];
    const fieldSources = { ...(existing.fieldSources ?? {}) };
    for (const f of touched) fieldSources[f] = "handmatig";

    const [session] = await db
      .update(trainingSessionsTable)
      .set({
        ...(feelScore !== undefined ? { feelScore: feelScore ?? null } : {}),
        ...(notes !== undefined ? { notes: notes ?? null } : {}),
        ...(normalizedTitle !== undefined ? { title: normalizedTitle } : {}),
        ...(touched.length > 0 ? { manualFields, fieldSources } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(trainingSessionsTable.id, id),
          eq(trainingSessionsTable.clerkId, clerkId),
        ),
      )
      .returning();

    if (notes && notes.trim()) {
      captureContext(clerkId, notes.trim()).catch((err) =>
        req.log.error({ err }, "athlete.sessions PUT context capture failed"),
      );
    }

    res.json(session);
  } catch (err) {
    req.log.error({ err }, "athlete.sessions PUT failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/athlete/metrics ─────────────────────────────────────────────────
router.get("/metrics", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const days = Math.min(parseInt(String(req.query["days"] ?? "14"), 10), 90);
  try {
    const metrics = await db
      .select()
      .from(athleteDailyMetricsTable)
      .where(
        and(
          eq(athleteDailyMetricsTable.clerkId, clerkId),
          gte(athleteDailyMetricsTable.metricDate, daysAgoStr(days)),
        ),
      )
      .orderBy(desc(athleteDailyMetricsTable.metricDate));
    res.json(metrics);
  } catch (err) {
    req.log.error({ err }, "athlete.metrics GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/athlete/metrics ────────────────────────────────────────────────
router.post("/metrics", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const {
    metricDate,
    hrv,
    restingHR,
    sleepHours,
    sleepQuality,
    fatigueScore,
    feelScore,
    notes,
    weightKg,
  } = req.body as {
    metricDate?: string;
    hrv?: number;
    restingHR?: number;
    sleepHours?: string;
    sleepQuality?: number;
    fatigueScore?: number;
    feelScore?: number;
    notes?: string;
    weightKg?: string;
  };

  const date = metricDate ?? todayStr();

  try {
    const [metric] = await db
      .insert(athleteDailyMetricsTable)
      .values({
        clerkId,
        metricDate: date,
        hrv: hrv ?? null,
        restingHR: restingHR ?? null,
        sleepHours: sleepHours ?? null,
        sleepQuality: sleepQuality ?? null,
        fatigueScore: fatigueScore ?? null,
        feelScore: feelScore ?? null,
        notes: notes ?? null,
        weightKg: weightKg ?? null,
      })
      .onConflictDoUpdate({
        target: [
          athleteDailyMetricsTable.clerkId,
          athleteDailyMetricsTable.metricDate,
        ],
        set: {
          hrv: hrv ?? null,
          restingHR: restingHR ?? null,
          sleepHours: sleepHours ?? null,
          sleepQuality: sleepQuality ?? null,
          fatigueScore: fatigueScore ?? null,
          feelScore: feelScore ?? null,
          notes: notes ?? null,
          weightKg: weightKg ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    triggerPlanRefresh(req, clerkId);
    // Behavioural signal for the coaching profile: a logged check-in nudges the
    // begeleidingsprofiel (engagement + mental-support need). Best-effort.
    if (metric) {
      void deriveFromCheckin(clerkId, metric).catch((err) =>
        req.log.error({ err }, "deriveFromCheckin failed"),
      );
    }
    res.status(201).json(metric);
  } catch (err) {
    req.log.error({ err }, "athlete.metrics POST failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/athlete/load ────────────────────────────────────────────────────
router.get("/load", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const sessions = await db
      .select({
        sessionDate: trainingSessionsTable.sessionDate,
        tss: trainingSessionsTable.tss,
      })
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.clerkId, clerkId),
          gte(trainingSessionsTable.sessionDate, daysAgoStr(90)),
        ),
      );

    const tssByDate = new Map<string, number>();
    for (const s of sessions) {
      if (s.tss != null) {
        tssByDate.set(
          s.sessionDate,
          (tssByDate.get(s.sessionDate) ?? 0) + s.tss,
        );
      }
    }

    const today = new Date();
    let ctl = 0;
    let atl = 0;

    // Pre-warm: days 90 → 43
    for (let i = 90; i > 42; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const tss = tssByDate.get(d.toISOString().split("T")[0]!) ?? 0;
      ctl = ctl + (tss - ctl) / 42;
      atl = atl + (tss - atl) / 7;
    }

    // Chart data: last 42 days
    const chartData: Array<{
      date: string;
      ctl: number;
      atl: number;
      tsb: number;
      tss: number;
    }> = [];
    for (let i = 42; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i);
      const dateStr = d.toISOString().split("T")[0]!;
      const tss = tssByDate.get(dateStr) ?? 0;
      ctl = ctl + (tss - ctl) / 42;
      atl = atl + (tss - atl) / 7;
      chartData.push({
        date: dateStr,
        ctl: Math.round(ctl),
        atl: Math.round(atl),
        tsb: Math.round(ctl - atl),
        tss,
      });
    }

    res.json({
      ctl: Math.round(ctl),
      atl: Math.round(atl),
      tsb: Math.round(ctl - atl),
      chartData,
    });
  } catch (err) {
    req.log.error({ err }, "athlete.load failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/athlete/power-bests ─────────────────────────────────────────────
// Best average power per fixed window (5s/10s/20s/60s/5min/20min), aggregated
// over all sessions that carry REAL per-sample power bests (computed at
// FIT/TCX file ingest). Windows without any real data are simply absent —
// never estimated from session averages.
router.get("/power-bests", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const rows = await db
      .select({
        sessionDate: trainingSessionsTable.sessionDate,
        powerBests: trainingSessionsTable.powerBests,
      })
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.clerkId, clerkId));

    const recentCutoff = daysAgoStr(42);
    const allTime: Record<string, { watts: number; date: string }> = {};
    const recent: Record<string, { watts: number; date: string }> = {};
    let sessionsWithBests = 0;

    for (const row of rows) {
      const bests = row.powerBests;
      if (!bests || typeof bests !== "object") continue;
      sessionsWithBests += 1;
      for (const [win, watts] of Object.entries(bests)) {
        if (typeof watts !== "number" || !Number.isFinite(watts)) continue;
        const cur = allTime[win];
        if (!cur || watts > cur.watts) {
          allTime[win] = { watts, date: row.sessionDate };
        }
        if (row.sessionDate >= recentCutoff) {
          const curR = recent[win];
          if (!curR || watts > curR.watts) {
            recent[win] = { watts, date: row.sessionDate };
          }
        }
      }
    }

    res.json({ allTime, recent, sessionsWithBests });
  } catch (err) {
    req.log.error({ err }, "athlete.power-bests GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/athlete/ftp ─────────────────────────────────────────────────────
router.get("/ftp", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const history = await db
      .select()
      .from(ftpHistoryTable)
      .where(eq(ftpHistoryTable.clerkId, clerkId))
      .orderBy(desc(ftpHistoryTable.measuredAt));
    res.json(history);
  } catch (err) {
    req.log.error({ err }, "athlete.ftp GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/athlete/ftp ────────────────────────────────────────────────────
router.post("/ftp", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const { ftpWatts, testType, measuredAt, notes } = req.body as {
    ftpWatts: number;
    testType?: string;
    measuredAt?: string;
    notes?: string;
  };

  if (!ftpWatts || ftpWatts < 50 || ftpWatts > 600) {
    res.status(400).json({ error: "ftpWatts must be between 50 and 600" });
    return;
  }

  try {
    const [entry] = await db
      .insert(ftpHistoryTable)
      .values({
        clerkId,
        ftpWatts,
        testType: testType ?? "manual",
        measuredAt: measuredAt ?? todayStr(),
        notes: notes ?? null,
      })
      .returning();

    // Also sync FTP to athlete profile. A manual FTP log is a real user-asserted
    // measurement, so it must clear `ftpEstimated` — otherwise the post-sync
    // `recalibrateEstimatedFtp` self-heal treats the value as an estimate and
    // silently re-raises it to the proven floor (e.g. back to 410W), undoing the
    // athlete's correction on every sync.
    await db
      .update(athleteProfilesTable)
      .set({ ftp: ftpWatts, ftpEstimated: false, updatedAt: new Date() })
      .where(eq(athleteProfilesTable.clerkId, clerkId));

    res.status(201).json(entry);
  } catch (err) {
    req.log.error({ err }, "athlete.ftp POST failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
