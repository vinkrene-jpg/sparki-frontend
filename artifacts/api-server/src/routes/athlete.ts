import { Router } from "express";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  athleteProfilesTable,
  trainingSessionsTable,
  plannedWorkoutsTable,
  workoutFeedbackTable,
  athleteDailyMetricsTable,
  ftpHistoryTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { generateThreeWeekPlan, autoAdaptPlan } from "../engines/training-plan";
import { computeZones } from "../engines/profile";
import { computeLoad } from "../engines/recovery-load";

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
    weightKg,
    discipline,
    goals,
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
    weightKg?: string;
    discipline?: string;
    goals?: string;
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
  const cleanCoaching =
    coachingMode != null && COACHING.includes(coachingMode)
      ? coachingMode
      : undefined;
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
        ...(weightKg != null && { weightKg }),
        ...(discipline != null && { discipline }),
        ...(goals != null && { goals }),
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

    res.status(201).json({ feedback });
  } catch (err) {
    req.log.error({ err }, "athlete.workouts.feedback failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

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

    const rows = generateThreeWeekPlan({
      ftp: athlete.ftp,
      weeklyHourTarget: athlete.weeklyHourTarget,
      discipline: athlete.discipline,
      goals: athlete.goals,
      startDate: start,
      weeks: blocks,
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

  try {
    const [session] = await db
      .insert(trainingSessionsTable)
      .values({
        clerkId,
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
        source: "manual",
      })
      .returning();
    triggerPlanRefresh(req, clerkId);
    res.status(201).json(session);
  } catch (err) {
    req.log.error({ err }, "athlete.sessions POST failed");
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

    // Also sync FTP to athlete profile
    await db
      .update(athleteProfilesTable)
      .set({ ftp: ftpWatts, updatedAt: new Date() })
      .where(eq(athleteProfilesTable.clerkId, clerkId));

    res.status(201).json(entry);
  } catch (err) {
    req.log.error({ err }, "athlete.ftp POST failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
