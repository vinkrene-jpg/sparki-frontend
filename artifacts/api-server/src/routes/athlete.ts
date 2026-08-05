import { Router } from "express";
import { eq, and, gte, lte, desc, sql, inArray } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  athleteProfilesTable,
  trainingSessionsTable,
  activityImportsTable,
  plannedWorkoutsTable,
  plannedWorkoutChangesTable,
  workoutFeedbackTable,
  athleteDailyMetricsTable,
  ftpHistoryTable,
  lifeEventsTable,
  analysisRequestsTable,
  LIFE_EVENT_IMPACTS,
  LIFE_EVENT_KINDS,
} from "@workspace/db";
import type { BusyDay } from "../lib/training/plan-generator";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { computeAge } from "../lib/age";
import {
  POWER_ZONES,
  HR_ZONES,
  powerZoneSecondsFromStreams,
  hrZoneSecondsFromStreams,
} from "../lib/activity-streams";
import {
  localDateStr,
  shiftDateStr,
  powerBestPeriods,
  mondayOf,
} from "../lib/analysis-periods";
import { requireCommercialFeature } from "../lib/entitlements";
import { maybeScheduleStravaCatchUp } from "../engines/data-hub/strava-sync";
import {
  deriveSourceConflicts,
  type MergeLogEntry,
} from "../engines/data-hub/dedupe";
import { ensureLibraryRoutes } from "../lib/route-library";
import { generateThreeWeekPlan, autoAdaptPlan } from "../engines/training-plan";
import {
  computeZones,
  deriveFromCheckin,
  deriveFromTraining,
} from "../engines/profile";
import { computeLoad } from "../engines/recovery-load";
import { computeLoadSeries } from "../lib/recovery-load";
import {
  MEASUREMENT_LEVEL_INFO,
  isMeasurementLevel,
  measurementGapNote,
} from "../lib/measurement-level";
import { refreshMeetniveau, observeSporen } from "../engines/meetniveau";
import { captureContext } from "../engines/context-memory";
import { ingestManualSession } from "../lib/manual-session-ingest";
import { sessionOrigin, findSessionSyncRun } from "../engines/data-origin";
import { sanitizePlanDetails } from "../lib/plan-details";
import { parseBuilderSteps, buildZwo, buildFitWorkout } from "../lib/workout-builder";
import {
  computeTrimPreview,
  sliceProfile,
  validateTrimRange,
  type TrimGeometryPoint,
} from "../lib/ride-trim";
import {
  autoLinkSession,
  classifyExecution,
  logWorkoutChange,
  markOverdueAsMissed,
} from "../lib/workout-execution";

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

    // WP-K2: herkomststatus per kernwaarde meesturen zodat kaarten "geschat"
    // of "niet bevestigd" kunnen tonen — één brondefinitie (Sportpaspoort).
    const { composePassport } = await import("../lib/passport");
    const passport = await composePassport(clerkId);
    const herkomst = passport
      ? Object.fromEntries(
          passport.fields.map((f) => [
            f.field,
            { origin: f.origin, estimated: f.estimated, stale: f.stale },
          ]),
        )
      : null;

    // §5.1 Voorbeeldsporter: zichtbare markering — dit account is fictief en
    // mag nooit met eigen data verward worden.
    const { isVoorbeeldSporter } = await import("../lib/voorbeeldsporter");
    res.json({
      ...user,
      ...athlete,
      zones,
      wkg,
      herkomst,
      voorbeeld: isVoorbeeldSporter(clerkId),
    });
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
    plannerView,
    restingHr,
    maxHr,
    goalForm,
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
    plannerView?: string | null;
    restingHr?: number | string | null;
    maxHr?: number | string | null;
    goalForm?: string | null;
    rhythmProxies?: string[] | null;
  };
  const { rhythmProxies } = req.body as { rhythmProxies?: string[] | null };

  // F4: doelvorm — vaste enum; expliciete null wist, onbekende waarden worden
  // genegeerd (nooit vertrouwd).
  const GOAL_FORMS = ["programma", "seizoen", "ritme"];
  let cleanGoalForm: string | null | undefined;
  if (goalForm === null) {
    cleanGoalForm = null;
  } else if (goalForm != null && GOAL_FORMS.includes(goalForm)) {
    cleanGoalForm = goalForm;
  }

  // F10: ritme-proxy's — vaste catalogus, maximaal twee. Bewust géén streaks,
  // gemiste dagen, gewicht of calorieën in de catalogus (TD-16). Ongeldige
  // invoer is een harde 400 (de sporter koos bewust; stil negeren zou liegen).
  const RHYTHM_PROXIES = [
    // Plezier
    "samen_rijden",
    "buiten",
    "nieuwe_plekken",
    "leuk_tik",
    // Fit blijven
    "ritme_weken",
    "actieve_dagen",
    "testrit",
  ];
  let cleanRhythmProxies: string[] | null | undefined;
  if (rhythmProxies === null) {
    cleanRhythmProxies = null;
  } else if (rhythmProxies !== undefined) {
    if (
      !Array.isArray(rhythmProxies) ||
      rhythmProxies.length > 2 ||
      rhythmProxies.some((p) => !RHYTHM_PROXIES.includes(p))
    ) {
      res.status(400).json({
        error: "Kies maximaal twee ritme-proxy's uit de vaste lijst",
        allowed: RHYTHM_PROXIES,
      });
      return;
    }
    cleanRhythmProxies = [...new Set(rhythmProxies)];
  }

  // F3: rust- en maximale hartslag — integers binnen een plausibel menselijk
  // bereik; expliciete null wist, onzin wordt genegeerd (nooit vertrouwd).
  const cleanHrField = (
    v: number | string | null | undefined,
    lo: number,
    hi: number,
  ): number | null | undefined => {
    if (v === null) return null;
    if (v === undefined || v === "") return undefined;
    const n = Math.round(Number(v));
    return Number.isFinite(n) && n >= lo && n <= hi ? n : undefined;
  };
  const cleanRestingHr = cleanHrField(restingHr, 25, 110);
  const cleanMaxHr = cleanHrField(maxHr, 120, 230);

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
  // Routeplanner-weergaveniveau (besluit B6): vaste enum, expliciete null =
  // terug naar automatisch voorstellen; onbekende waarden worden genegeerd.
  const PLANNER_VIEWS = ["gratis", "go_fietser", "go_sport", "wedstrijd"];
  let cleanPlannerView: string | null | undefined;
  if (plannerView === null) {
    cleanPlannerView = null;
  } else if (plannerView != null && PLANNER_VIEWS.includes(plannerView)) {
    cleanPlannerView = plannerView;
  }
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

    // Sportpaspoort: oude waarden vastleggen zodat iedere wijziging van een
    // kernveld een herleidbaar event krijgt (nooit stil overschrijven).
    const [before] = await db
      .select()
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId))
      .limit(1);

    // Atomair: profielwijziging + paspoort-events in één transactie — een
    // kernveld kan nooit veranderen zonder herleidbaar event.
    const { recordValueEvent, PASSPORT_FIELDS } = await import(
      "../lib/passport"
    );
    const updated = await db.transaction(async (tx) => {
    const [row] = await tx
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
        ...(cleanPlannerView !== undefined && {
          plannerView: cleanPlannerView,
        }),
        ...(cleanRestingHr !== undefined && { restingHr: cleanRestingHr }),
        ...(cleanMaxHr !== undefined && { maxHr: cleanMaxHr }),
        ...(cleanGoalForm !== undefined && {
          goalForm: cleanGoalForm as "programma" | "seizoen" | "ritme" | null,
        }),
        ...(cleanRhythmProxies !== undefined && { rhythmProxies: cleanRhythmProxies }),
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

    // Sportpaspoort-events voor gewijzigde kernvelden — in dezelfde
    // transactie: mislukt een event, dan wordt de wijziging teruggedraaid
    // (nooit stil overschrijven, ook niet bij een storing halverwege).
    if (row && before) {
      const beforeRec = before as Record<string, unknown>;
      const updatedRec = row as Record<string, unknown>;
      for (const field of Object.keys(PASSPORT_FIELDS) as Array<
        keyof typeof PASSPORT_FIELDS
      >) {
        const oldV = beforeRec[field] == null ? null : String(beforeRec[field]);
        const newV =
          updatedRec[field] == null ? null : String(updatedRec[field]);
        if (oldV === newV) continue;
        await recordValueEvent(
          {
            clerkId,
            field,
            oldValue: oldV,
            newValue: newV,
            origin: "handmatig",
            source: "profielinstellingen",
            actorType: "sporter",
            actorId: clerkId,
          },
          tx,
        );
      }
    }
    return row;
    });

    if (!updated) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const zones = updated.ftp ? computeZones(updated.ftp) : null;
    const wkg =
      updated.ftp && updated.weightKg
        ? Math.round((updated.ftp / Number(updated.weightKg)) * 100) / 100
        : null;

    // Woonlocatie bekend (nieuw of gewijzigd)? Vul dan op de achtergrond de
    // Sparki-routebibliotheek rond dat adres — idempotent per gebied, en de
    // gebruiker (bijv. midden in onboarding) wacht hier nooit op.
    if (homeValid) {
      void ensureLibraryRoutes(latNum!, lonNum!).catch((err) => {
        req.log.warn({ err }, "routebibliotheek-startset niet gestart");
      });
    }

    res.json({ ...updated, zones, wkg });
  } catch (err) {
    req.log.error({ err }, "athlete.profile PUT failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET/PUT /api/athlete/measurement-level ───────────────────────────────────
// TRAINEN_DOELEN_SEIZOEN_01 F2: meetniveau (as 2 — wat komt er binnen). Zelf
// te kiezen, met uitleg wat elk niveau oplevert. De keuze is een voorwaarde,
// geen status: een rit zonder de bijbehorende signalen valt eerlijk terug.
router.get("/measurement-level", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [row] = await db
      .select({ measurementLevel: athleteProfilesTable.measurementLevel })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId));
    res.json({
      measurementLevel: row?.measurementLevel ?? null,
      levels: MEASUREMENT_LEVEL_INFO,
    });
  } catch (err) {
    req.log.error({ err }, "athlete.measurementLevel.get failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/athlete/meetniveau ──────────────────────────────────────────────
// MEETNIVEAU_EN_UITLEG_01 §3+§7: het WAARGENOMEN meetniveau — geen instelling.
// Levend: elke uitlezing kijkt opnieuw naar de laatste 10 activiteiten en de
// laatste 7 dagen herstelmetingen (en verwerkt onderweg een eventuele
// wegval-melding, precies één per episode). Interne codes verlaten de server
// nooit (B4): de respons bevat alleen betekenisvolle booleans en de
// profielregel in gewone taal.
// Bewust ZONDER pakketpoort: dit is de profielwaarneming (§7-profielregel +
// welke sporen er binnenkomen) — geen diepe-analysedata. De analyse-endpoints
// zelf (power-bests, weekly-zones, …) dragen wél requireCommercialFeature.
router.get("/meetniveau", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const { waarneming, profielregel } = await refreshMeetniveau(clerkId);
    res.json({
      vermogen: waarneming.vermogen,
      hartslag: waarneming.hartslag,
      herstel: waarneming.herstel,
      activiteitenBekeken: waarneming.activiteitenBekeken,
      hersteldagen: waarneming.hersteldagen,
      profielregel,
    });
  } catch (err) {
    req.log.error({ err }, "athlete.meetniveau.get failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/measurement-level", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const { measurementLevel } = req.body as { measurementLevel?: unknown };
  if (!isMeasurementLevel(measurementLevel)) {
    res.status(400).json({
      error:
        "measurementLevel must be one of: pro, hartslag, tijd_gevoel, aanwezigheid",
    });
    return;
  }
  try {
    const [row] = await db
      .update(athleteProfilesTable)
      .set({ measurementLevel, updatedAt: new Date() })
      .where(eq(athleteProfilesTable.clerkId, clerkId))
      .returning({ measurementLevel: athleteProfilesTable.measurementLevel });
    if (!row) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json({ measurementLevel: row.measurementLevel });
  } catch (err) {
    req.log.error({ err }, "athlete.measurementLevel.put failed");
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
    // Atomair: statuswissel + paspoort-event in één transactie — de status
    // kan nooit veranderen zonder herleidbaar event.
    const { recordValueEvent } = await import("../lib/passport");
    const updated = await db.transaction(async (tx) => {
      const [beforeHealth] = await tx
        .select({ healthStatus: athleteProfilesTable.healthStatus })
        .from(athleteProfilesTable)
        .where(eq(athleteProfilesTable.clerkId, clerkId))
        .limit(1);

      const [row] = await tx
        .update(athleteProfilesTable)
        .set({ healthStatus, updatedAt: new Date() })
        .where(eq(athleteProfilesTable.clerkId, clerkId))
        .returning();

      if (row && beforeHealth && beforeHealth.healthStatus !== row.healthStatus) {
        await recordValueEvent(
          {
            clerkId,
            field: "healthStatus",
            oldValue: beforeHealth.healthStatus ?? null,
            newValue: row.healthStatus ?? null,
            origin: "handmatig",
            source: "gezondheidsmelding",
            actorType: "sporter",
            actorId: clerkId,
          },
          tx,
        );
      }
      return row;
    });

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

  // Zelfherstellende sync: dit is het eerste dat de app bij openen ophaalt.
  // Als de laatste Strava-sync verouderd (>24u) of mislukt is, start op de
  // achtergrond een begrensde inhaalsync — nooit blokkerend voor deze request.
  void maybeScheduleStravaCatchUp(clerkId, req.log).catch(() => {});

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
    // Zelfherstel: verlopen geplande trainingen zonder uitvoering eerlijk
    // als "gemist" markeren voordat we lezen (lui, geen aparte job nodig).
    await markOverdueAsMissed(clerkId, today).catch((err) =>
      req.log.error({ err }, "markOverdueAsMissed failed"),
    );
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
    // Zelfde luie zelfherstel als /workouts/today.
    await markOverdueAsMissed(clerkId, todayStr()).catch((err) =>
      req.log.error({ err }, "markOverdueAsMissed failed"),
    );
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
    planDetails,
    routeId,
  } = req.body as {
    scheduledDate: string;
    type?: string;
    title: string;
    description?: string;
    targetDurationMin?: number;
    targetTSS?: number;
    structure?: unknown;
    source?: string;
    planDetails?: unknown;
    routeId?: number;
  };

  if (!scheduledDate || !title) {
    res.status(400).json({ error: "scheduledDate and title are required" });
    return;
  }

  // Planningsdetails (Training inplannen-flow): whitelist + eerlijke 400 bij
  // ongeldige of uitgevoerde-ervaring-velden.
  const sanitized = sanitizePlanDetails(planDetails);
  if (!sanitized.ok) {
    res.status(400).json({ error: sanitized.error });
    return;
  }

  // Route is een soft reference — eigendom hier expliciet controleren zodat
  // een vreemd route-id nooit aan een training hangt.
  let checkedRouteId: number | null = null;
  if (routeId != null) {
    if (typeof routeId !== "number" || !Number.isInteger(routeId) || routeId <= 0) {
      res.status(400).json({ error: "Ongeldige route" });
      return;
    }
    const owned = await db.execute(
      sql`SELECT id FROM routes WHERE id = ${routeId} AND clerk_id = ${clerkId} LIMIT 1`,
    );
    if (owned.rows.length === 0) {
      res.status(400).json({ error: "Route niet gevonden" });
      return;
    }
    checkedRouteId = routeId;
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
        planDetails: sanitized.details,
        routeId: checkedRouteId,
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

  // Expliciet ontkoppelen: sessionId is aanwezig in de body én null.
  const wantsUnlink =
    Object.prototype.hasOwnProperty.call(req.body ?? {}, "sessionId") &&
    (req.body as { sessionId?: number | null }).sessionId === null;

  try {
    // Coachautoriteit: een training van de coach mag Sparki/de sporter hier
    // niet inhoudelijk herschrijven. Status (gedaan/overgeslagen) en het
    // koppelen van een uitgevoerde sessie blijven wél toegestaan — dat is
    // registratie, geen herprogrammering.
    const [current] = await db
      .select()
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
    // Handmatige koppeling: de gekozen activiteit moet van de sporter zelf
    // zijn en op dezelfde dag vallen als de geplande training — anders is de
    // koppeling betekenisloos en zou de uitvoeringshistorie liegen.
    let linkedVerdict: string | null = null;
    if (sessionId != null) {
      const [sess] = await db
        .select({
          id: trainingSessionsTable.id,
          sessionDate: trainingSessionsTable.sessionDate,
          durationMin: trainingSessionsTable.durationMin,
          tss: trainingSessionsTable.tss,
          sport: trainingSessionsTable.sport,
          type: trainingSessionsTable.type,
        })
        .from(trainingSessionsTable)
        .where(
          and(
            eq(trainingSessionsTable.id, sessionId),
            eq(trainingSessionsTable.clerkId, clerkId),
          ),
        );
      if (!sess) {
        res.status(404).json({ error: "Activiteit niet gevonden" });
        return;
      }
      const targetDate = scheduledDate ?? current.scheduledDate;
      if (sess.sessionDate !== targetDate) {
        res.status(400).json({
          error:
            "Deze activiteit valt op een andere dag dan de geplande training.",
        });
        return;
      }
      // Handmatige koppeling krijgt hetzelfde eerlijke uitvoeringsoordeel.
      if (status == null) {
        linkedVerdict = classifyExecution(sess, {
          targetDurationMin: current.targetDurationMin,
          targetTSS: current.targetTSS,
        }).verdict;
      }
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
          "Deze training komt van je coach. Die wordt niet automatisch aangepast — bespreek een wijziging met je coach.",
        coachOwned: true,
      });
      return;
    }

    const effectiveStatus =
      status != null
        ? status
        : linkedVerdict != null
          ? linkedVerdict
          : wantsUnlink
            ? "planned"
            : null;

    const [updated] = await db
      .update(plannedWorkoutsTable)
      .set({
        ...(effectiveStatus != null && { status: effectiveStatus }),
        ...(title != null && { title }),
        ...(description != null && { description }),
        ...(scheduledDate != null && { scheduledDate }),
        ...(targetDurationMin != null && { targetDurationMin }),
        ...(targetTSS != null && { targetTSS }),
        ...(structure != null && { structure }),
        ...(sessionId != null && { sessionId }),
        ...(wantsUnlink && { sessionId: null }),
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

    // Wijzigingshistorie: alleen de velden die echt veranderd zijn.
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const cur = current as unknown as Record<string, unknown>;
    const upd = updated as unknown as Record<string, unknown>;
    for (const veld of [
      "status",
      "title",
      "description",
      "scheduledDate",
      "targetDurationMin",
      "targetTSS",
      "sessionId",
    ]) {
      if (cur[veld] !== upd[veld]) {
        before[veld] = cur[veld] ?? null;
        after[veld] = upd[veld] ?? null;
      }
    }
    if (structure != null) {
      before["structure"] = current.structure ?? null;
      after["structure"] = updated.structure ?? null;
    }
    if (Object.keys(after).length > 0) {
      const action =
        sessionId != null
          ? "gekoppeld"
          : wantsUnlink
            ? "ontkoppeld"
            : scheduledDate != null && scheduledDate !== current.scheduledDate
              ? "verplaatst"
              : status != null && Object.keys(after).length === 1
                ? "status"
                : "gewijzigd";
      const bodyReason = (req.body as { reason?: string }).reason;
      await logWorkoutChange({
        clerkId,
        workoutId: id,
        action,
        actor: "sporter",
        reason:
          typeof bodyReason === "string" && bodyReason.trim()
            ? bodyReason.trim().slice(0, 500)
            : null,
        before,
        after,
      }).catch((err) =>
        req.log.error({ err }, "athlete.workouts PUT history log failed"),
      );
    }

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "athlete.workouts PUT failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── DELETE /api/athlete/workouts/:id ─────────────────────────────────────────
// Annuleren = zachte statuswissel (geen rij weg — historie en plan blijven
// herleidbaar). Coachtrainingen annuleert de sporter hier niet zelf.
router.delete("/workouts/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid workout id" });
    return;
  }
  try {
    const [current] = await db
      .select({
        id: plannedWorkoutsTable.id,
        source: plannedWorkoutsTable.source,
        status: plannedWorkoutsTable.status,
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
    if (current.source === "coach") {
      res.status(403).json({
        error:
          "Deze training komt van je coach. Die wordt niet automatisch geannuleerd — bespreek dit met je coach.",
        coachOwned: true,
      });
      return;
    }
    if (current.status === "cancelled") {
      res.json({ ok: true, status: "cancelled" });
      return;
    }
    const bodyReason = (req.body as { reason?: string } | undefined)?.reason;
    await db
      .update(plannedWorkoutsTable)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(plannedWorkoutsTable.id, id),
          eq(plannedWorkoutsTable.clerkId, clerkId),
        ),
      );
    await logWorkoutChange({
      clerkId,
      workoutId: id,
      action: "geannuleerd",
      actor: "sporter",
      reason:
        typeof bodyReason === "string" && bodyReason.trim()
          ? bodyReason.trim().slice(0, 500)
          : null,
      before: { status: current.status },
      after: { status: "cancelled" },
    }).catch((err) =>
      req.log.error({ err }, "athlete.workouts DELETE history log failed"),
    );
    res.json({ ok: true, status: "cancelled" });
  } catch (err) {
    req.log.error({ err }, "athlete.workouts DELETE failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/athlete/workouts/:id/history ────────────────────────────────────
// Volledige wijzigingshistorie van één geplande training (append-only log).
router.get("/workouts/:id/history", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid workout id" });
    return;
  }
  try {
    const [workout] = await db
      .select({ id: plannedWorkoutsTable.id })
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
    const changes = await db
      .select()
      .from(plannedWorkoutChangesTable)
      .where(
        and(
          eq(plannedWorkoutChangesTable.workoutId, id),
          eq(plannedWorkoutChangesTable.clerkId, clerkId),
        ),
      )
      .orderBy(desc(plannedWorkoutChangesTable.createdAt));
    res.json({ changes });
  } catch (err) {
    req.log.error({ err }, "athlete.workouts.history failed");
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

// ── GET /api/athlete/workouts/:id/export ─────────────────────────────────────
// Download een training met gestructureerde stappen als .zwo (Zwift) of .fit
// (Garmin/Wahoo). Eigen trainingen alleen (clerkId); vermogensdoelen blijven
// %FTP — het device rekent met de eigen FTP-instelling van de sporter.
router.get("/workouts/:id/export", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  const format = String(req.query["format"] ?? "zwo");
  if (isNaN(id) || !["zwo", "fit"].includes(format)) {
    res.status(400).json({ error: "Ongeldige export-aanvraag" });
    return;
  }
  try {
    const [workout] = await db
      .select({
        id: plannedWorkoutsTable.id,
        title: plannedWorkoutsTable.title,
        description: plannedWorkoutsTable.description,
        structure: plannedWorkoutsTable.structure,
      })
      .from(plannedWorkoutsTable)
      .where(
        and(
          eq(plannedWorkoutsTable.id, id),
          eq(plannedWorkoutsTable.clerkId, clerkId),
        ),
      );
    if (!workout) {
      res.status(404).json({ error: "Training niet gevonden" });
      return;
    }
    const rawSteps = (workout.structure as Record<string, unknown> | null)?.["steps"];
    const parsedSteps = parseBuilderSteps(rawSteps);
    if (!parsedSteps.ok || parsedSteps.steps.length === 0) {
      res.status(400).json({
        error: "Deze training heeft geen gestructureerde stappen om te exporteren",
      });
      return;
    }
    const safeName = workout.title.replace(/[^\w\-]+/g, "_").slice(0, 60) || "training";
    if (format === "zwo") {
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}.zwo"`);
      res.send(buildZwo(workout.title, workout.description, parsedSteps.steps));
    } else {
      const bytes = buildFitWorkout(workout.title, parsedSteps.steps);
      res.setHeader("Content-Type", "application/octet-stream");
      res.setHeader("Content-Disposition", `attachment; filename="${safeName}.fit"`);
      res.send(Buffer.from(bytes));
    }
  } catch (err) {
    req.log.error({ err }, "athlete.workouts.export failed");
    res.status(500).json({ error: "Kon training niet exporteren" });
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
  const { feedbackType, note, rpe, completion, deviationReason } = req.body as {
    feedbackType?: string;
    note?: string;
    rpe?: number | null;
    completion?: string | null;
    deviationReason?: string | null;
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
  if (
    rpe != null &&
    (typeof rpe !== "number" || !Number.isInteger(rpe) || rpe < 1 || rpe > 10)
  ) {
    res.status(400).json({ error: "rpe moet een geheel getal 1–10 zijn" });
    return;
  }
  const COMPLETIONS = ["volledig", "gedeeltelijk", "niet"] as const;
  if (
    completion != null &&
    !(COMPLETIONS as readonly string[]).includes(completion)
  ) {
    res.status(400).json({
      error: `completion moet één van ${COMPLETIONS.join(", ")} zijn`,
    });
    return;
  }
  if (deviationReason != null && typeof deviationReason !== "string") {
    res.status(400).json({ error: "Ongeldige deviationReason" });
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
      .values({
        clerkId,
        workoutId: id,
        feedbackType,
        note: note ?? null,
        rpe: rpe ?? null,
        completion: completion ?? null,
        deviationReason:
          deviationReason && deviationReason.trim()
            ? deviationReason.trim().slice(0, 500)
            : null,
      })
      .returning();

    // Let Sparki pick up a personal-context moment from the feedback note
    // (e.g. "niet getraind, examen morgen"). Best-effort + privacy-gated inside
    // captureContext — never blocks or fails the feedback response.
    if (note && note.trim()) {
      captureContext(clerkId, note.trim()).catch((err) =>
        req.log.error({ err }, "athlete.workouts.feedback context capture failed"),
      );
    }

    // Mirror terminal feedback to the workout status. "gedeeltelijk" is een
    // eerlijker oordeel dan een botte "completed".
    const newStatus =
      feedbackType === "done"
        ? completion === "gedeeltelijk"
          ? "partial"
          : completion === "niet"
            ? "skipped"
            : "completed"
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
      // "Done" alleen als de sporter óók echt volledig heeft uitgevoerd:
      // completion "gedeeltelijk"/"niet" spreekt "done" tegen en telt als
      // afwijken van het plan (geen vals structured-signaal).
      const fullyDone =
        feedbackType === "done" &&
        (completion == null || completion === "volledig");
      void deriveFromTraining(clerkId, {
        hadPlannedSession: true,
        completedAsPlanned: fullyDone,
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
router.post("/plan/generate", requireAuth, requireCommercialFeature("autonomous_training"), async (req, res) => {
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
          "Stel eerst je FTP en wekelijkse uren in zodat er een schema opgebouwd kan worden.",
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
    500,
  );
  // Zelfherstellende sync op het leespad (zie /dashboard): wie zijn ritten
  // bekijkt terwijl de koppeling stilviel, krijgt zo automatisch een inhaalsync.
  void maybeScheduleStravaCatchUp(clerkId, req.log).catch(() => {});
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

/**
 * Maximale snelheid uit de echte per-sample snelheidsstroom. De stream is al
 * per tijdvenster gemiddeld (buckets), zodat een enkele GPS-uitschieter nooit
 * de max wordt; we nemen de hoogste bucketwaarde onder een fysieke bovengrens.
 * Null wanneer er geen echte snelheidssamples zijn — nooit een verzonnen 0.
 */
function maxSpeedFromStreams(
  streams: Record<string, unknown> | null,
): number | null {
  if (!streams) return null;
  const speeds = streams["speedKph"];
  if (!Array.isArray(speeds)) return null;
  const MAX_PLAUSIBLE_KPH = 120;
  let best: number | null = null;
  for (const v of speeds) {
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    if (v > MAX_PLAUSIBLE_KPH) continue;
    if (best == null || v > best) best = v;
  }
  return best != null && best > 0 ? Math.round(best * 10) / 10 : null;
}

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
        fileType: activityImportsTable.fileType,
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

    // Actieve trim ("Rit inkorten"): de kaart/het profiel tonen het ingekorte
    // bereik; de ruwe opname in parsed_summary blijft onaangetast zodat
    // herstellen altijd kan. Ongeldig geworden bereiken (bijv. door een
    // her-import) worden eerlijk genegeerd, nooit half toegepast.
    const trim = session.trimEdit;
    const trimValid =
      trim != null &&
      track != null &&
      validateTrimRange(track.length, trim.startIndex, trim.endIndex) === null;
    const outTrack = trimValid
      ? track!.slice(trim!.startIndex, trim!.endIndex + 1)
      : track;
    const outProfile =
      trimValid && track
        ? sliceProfile(profile, track.length, trim!.startIndex, trim!.endIndex)
        : profile;

    // Herkomst-metadata (additief): waar deze sessie vandaan komt, via welke
    // synchronisatie, en welke velden handmatig/uit welke bron kwamen.
    const syncRunId = await findSessionSyncRun(
      clerkId,
      session.source,
      session.createdAt ?? null,
    );
    const herkomst = sessionOrigin(session, {
      syncRunId,
      apparaat: imp?.fileType ? `bestand (${imp.fileType})` : null,
    });

    // Maximale snelheid uit de ECHTE per-sample snelheidsstroom (al gebucket,
    // dus gemiddeld per venster — één GPS-uitschieter telt niet als max). Alleen
    // wanneer de rit echte snelheidssamples droeg; anders eerlijk null (oude
    // ritten zonder stream tonen dus geen max snelheid, nooit een 0).
    const maxSpeedKph = maxSpeedFromStreams(streams);

    // F2/TD-17: eerlijke melding wanneer deze rit onder het gekozen meetniveau
    // binnenkwam. Signalen van vóór F2 zijn null → dan geen (geraden) melding.
    const [profRow] = await db
      .select({ measurementLevel: athleteProfilesTable.measurementLevel })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId));
    const measurementNote =
      session.signals != null
        ? measurementGapNote(profRow?.measurementLevel ?? null, session.signals)
        : null;

    res.json({
      session,
      measurementNote,
      track: outTrack,
      profile: outProfile,
      climbs,
      segments: segments.length > 0 ? segments : null,
      streams,
      maxSpeedKph,
      plannedWorkout,
      trimEdit: trimValid ? trim : null,
      trackPointCount: track?.length ?? 0,
      herkomst,
      // Bronconflicten ("stil met inzicht"): waar twee bronnen voor hetzelfde
      // veld andere getallen gaven, afgeleid uit het interne samenvoeglogboek.
      // Leeg wanneer er eerlijk niets verschilde.
      sourceConflicts: deriveSourceConflicts(
        (session.mergeLog as MergeLogEntry[] | null) ?? null,
      ),
    });
  } catch (err) {
    req.log.error({ err }, "athlete.sessions detail GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Rit inkorten ─────────────────────────────────────────────────────────────
// Laad een eigen sessie mét de bewaarde track-geometrie ([lat, lon, ele?]).
// Sessies zonder bewaarde track kunnen niet worden ingekort (eerlijke 422).
async function loadOwnedSessionWithGeometry(clerkId: string, id: number) {
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
  if (!session) return { session: null, geometry: [] as TrimGeometryPoint[] };
  const [imp] = await db
    .select({ parsedSummary: activityImportsTable.parsedSummary })
    .from(activityImportsTable)
    .where(
      and(
        eq(activityImportsTable.linkedTrainingSessionId, session.id),
        eq(activityImportsTable.clerkId, clerkId),
      ),
    )
    .limit(1);
  const stored = (imp?.parsedSummary as { route?: { geometry?: unknown } | null } | null)
    ?.route ?? null;
  const geometry: TrimGeometryPoint[] = Array.isArray(stored?.geometry)
    ? (stored!.geometry as unknown[]).flatMap((p) =>
        Array.isArray(p) &&
        p.length >= 2 &&
        Number.isFinite(p[0]) &&
        Number.isFinite(p[1]) &&
        Math.abs(p[0] as number) <= 90 &&
        Math.abs(p[1] as number) <= 180
          ? [
              [
                p[0] as number,
                p[1] as number,
                typeof p[2] === "number" && Number.isFinite(p[2])
                  ? (p[2] as number)
                  : undefined,
              ] as TrimGeometryPoint,
            ]
          : [],
      )
    : [];
  return { session, geometry };
}

// POST /api/athlete/sessions/:id/trim-preview — herbereken statistieken voor
// een voorgesteld bereik ZONDER iets op te slaan (voorvertoning in de app).
router.post("/sessions/:id/trim-preview", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Ongeldige rit" });
    return;
  }
  try {
    const { session, geometry } = await loadOwnedSessionWithGeometry(clerkId, id);
    if (!session) {
      res.status(404).json({ error: "Rit niet gevonden" });
      return;
    }
    if (geometry.length < 2) {
      res.status(422).json({
        error: "Deze rit heeft geen bewaarde track en kan niet worden ingekort",
      });
      return;
    }
    const { startIndex, endIndex } = req.body as {
      startIndex?: unknown;
      endIndex?: unknown;
    };
    const rangeErr = validateTrimRange(geometry.length, startIndex, endIndex);
    if (rangeErr) {
      res.status(400).json({ error: rangeErr });
      return;
    }
    // De oorspronkelijke statistieken zijn de basis voor de proportionele
    // duurschatting — bij een al ingekorte rit dus de ORIGINELEN uit trimEdit.
    const original = session.trimEdit?.original ?? {
      durationMin: session.durationMin,
      distanceKm: session.distanceKm,
      elevationM: session.elevationM,
      avgSpeedKph: session.avgSpeedKph,
    };
    res.json({
      preview: computeTrimPreview(
        geometry,
        startIndex as number,
        endIndex as number,
        original,
      ),
    });
  } catch (err) {
    req.log.error({ err }, "athlete.sessions trim-preview failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/athlete/sessions/:id/trim — pas het inkorten toe: statistieken
// worden herberekend en de ORIGINELEN worden in trim_edit bewaard zodat de
// bewerking altijd volledig terug te draaien is. De ruwe opname blijft staan.
router.post("/sessions/:id/trim", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Ongeldige rit" });
    return;
  }
  try {
    const { session, geometry } = await loadOwnedSessionWithGeometry(clerkId, id);
    if (!session) {
      res.status(404).json({ error: "Rit niet gevonden" });
      return;
    }
    if (geometry.length < 2) {
      res.status(422).json({
        error: "Deze rit heeft geen bewaarde track en kan niet worden ingekort",
      });
      return;
    }
    const { startIndex, endIndex } = req.body as {
      startIndex?: unknown;
      endIndex?: unknown;
    };
    const rangeErr = validateTrimRange(geometry.length, startIndex, endIndex);
    if (rangeErr) {
      res.status(400).json({ error: rangeErr });
      return;
    }
    // Bij een tweede inkorting blijven de ALLEREERSTE originelen bewaard —
    // herstellen brengt altijd de onbewerkte rit terug.
    const original = session.trimEdit?.original ?? {
      durationMin: session.durationMin,
      distanceKm: session.distanceKm,
      elevationM: session.elevationM,
      avgSpeedKph: session.avgSpeedKph,
    };
    const preview = computeTrimPreview(
      geometry,
      startIndex as number,
      endIndex as number,
      original,
    );
    const trimEdit = {
      startIndex: startIndex as number,
      endIndex: endIndex as number,
      trimmedAt: new Date().toISOString(),
      durationEstimated: preview.durationEstimated,
      original,
    };
    const [updated] = await db
      .update(trainingSessionsTable)
      .set({
        trimEdit,
        durationMin: preview.durationMin,
        distanceKm: String(preview.distanceKm),
        // Hoogte alleen wanneer echt herberekenbaar; anders eerlijk null.
        elevationM: preview.elevationM,
        avgSpeedKph:
          preview.avgSpeedKph != null ? String(preview.avgSpeedKph) : null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(trainingSessionsTable.id, id),
          eq(trainingSessionsTable.clerkId, clerkId),
        ),
      )
      .returning();
    res.json({ session: updated, preview });
  } catch (err) {
    req.log.error({ err }, "athlete.sessions trim failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/athlete/sessions/:id/trim — herstel de oorspronkelijke rit:
// originele statistieken terug, trim weg. De ruwe opname stond er altijd nog.
router.delete("/sessions/:id/trim", requireAuth, async (req, res) => {
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
    if (!session.trimEdit) {
      res.status(400).json({ error: "Deze rit is niet ingekort" });
      return;
    }
    const original = session.trimEdit.original;
    const [updated] = await db
      .update(trainingSessionsTable)
      .set({
        trimEdit: null,
        durationMin: original.durationMin,
        distanceKm: original.distanceKm,
        elevationM: original.elevationM,
        avgSpeedKph: original.avgSpeedKph,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(trainingSessionsTable.id, id),
          eq(trainingSessionsTable.clerkId, clerkId),
        ),
      )
      .returning();
    res.json({ session: updated });
  } catch (err) {
    req.log.error({ err }, "athlete.sessions trim restore failed");
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

    // Uitvoeringskoppeling (Golf 23): verbind een NIEUWE handmatige activiteit
    // met de geplande training van die dag. Best-effort — nooit blokkerend.
    if (!merged) {
      autoLinkSession(clerkId, {
        id: session.id,
        sessionDate: session.sessionDate,
        sport: session.sport,
        type: session.type,
        durationMin: session.durationMin,
        tss: session.tss,
      }).catch((err) =>
        req.log.error({ err }, "athlete.sessions auto-link failed"),
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
    sorenessScore,
    stressScore,
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
    sorenessScore?: number;
    stressScore?: number;
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
        sorenessScore: sorenessScore ?? null,
        stressScore: stressScore ?? null,
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
          sorenessScore: sorenessScore ?? null,
          stressScore: stressScore ?? null,
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
// SSOT: dezelfde `computeLoadSeries` als de rest van Sparki (dashboard, plan,
// doelen) — geen tweede belastingsmodel. `?days=` stuurt alleen het
// grafiekvenster (7–90); het model zelf blijft altijd over 90 dagen gewarmd.
router.get("/load", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const rawDays = Number(String(req.query.days ?? "42"));
    const chartDays = Number.isFinite(rawDays)
      ? Math.max(7, Math.min(365, Math.round(rawDays)))
      : 42;
    const sessions = await db
      .select({
        sessionDate: trainingSessionsTable.sessionDate,
        tss: trainingSessionsTable.tss,
        hrLoad: trainingSessionsTable.hrLoad,
      })
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.clerkId, clerkId),
          // Venster + 90 dagen warmup, zodat het model aan de linkerrand
          // van elke gekozen periode al ingelopen is.
          gte(trainingSessionsTable.sessionDate, daysAgoStr(chartDays + 90)),
        ),
      );

    // SPOOR_H (§3.1) — één reeks, één basis, nooit mengen. Vermogensbelasting
    // (tss) en hartslagbelasting (hrLoad) zijn apart gedefinieerd en mogen
    // nooit in dezelfde reeks worden opgeteld (zie lib/hr-load.ts). Zolang er
    // vermogensscores in het venster staan is dat de basis; anders — voor de
    // renner met alleen een hartslagband — draait exact hetzelfde model op de
    // hartslagbelasting. De basis staat expliciet in het antwoord, zodat de
    // grafiek eerlijk laat zien op welke reeks hij staat (reeksbreuk bij
    // wisselen in plaats van stilzwijgend doorgetekende lijnen).
    const metVermogen = sessions.filter((s) => s.tss != null).length;
    const metHartslag = sessions.filter((s) => s.hrLoad != null).length;
    const basis: "vermogen" | "hartslag" =
      metVermogen > 0 || metHartslag === 0 ? "vermogen" : "hartslag";
    const reeks =
      basis === "vermogen"
        ? sessions.map((s) => ({ sessionDate: s.sessionDate, tss: s.tss }))
        : sessions.map((s) => ({ sessionDate: s.sessionDate, tss: s.hrLoad }));
    const buitenBasis = basis === "vermogen" ? metHartslag : 0;

    const series = computeLoadSeries(reeks, chartDays);
    // Herkomst-metadata (additief): welke engine, parameters en brondata.
    res.json({
      ...series,
      basis,
      basisDetail: { metVermogen, metHartslag, buitenBasis },
      herkomst: {
        engine: "computeLoadSeries",
        versie: "2",
        parameters: { chartDays, modelDays: chartDays + 90, basis },
        bron:
          basis === "vermogen"
            ? "training_sessions.tss (gemeten of afgeleid)"
            : "training_sessions.hr_load (interne belasting op hartslag)",
        aantalSessies: sessions.length,
        betrouwbaarheid: sessions.length > 0 ? "afgeleid" : "onvoldoende",
        melding:
          sessions.length > 0 ? null : "Onvoldoende gegevens beschikbaar.",
      },
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
router.get("/power-bests", requireAuth, requireCommercialFeature("performance_lab"), async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    // §4 datapoort server-side: powercurve/records zijn puur vermogensanalyse.
    // Zonder waargenomen vermogensspoor (laatste 10 activiteiten, ≥6 met
    // vermogen) is de UI-melding niet de enige grens — ook een renner met
    // oudere vermogenshistorie krijgt hier eerlijk "sensor ontbreekt", nooit
    // upgradetaal (dat is de pakketpoort hierboven, strikt gescheiden).
    const sporen = await observeSporen(clerkId);
    if (!sporen.vermogen) {
      res.status(403).json({
        error: "sensor_data_required",
        sensor: "vermogensmeter",
        message:
          "Hiervoor is vermogen nodig. Koppel een vermogensmeter om deze analyse te zien.",
      });
      return;
    }
    const rows = await db
      .select({
        sessionDate: trainingSessionsTable.sessionDate,
        powerBests: trainingSessionsTable.powerBests,
      })
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.clerkId, clerkId));

    // Twee even lange, niet-overlappende blokken van exact 42 lokale
    // kalenderdagen — voedt de powercurve-vergelijking (dit blok vs vorige
    // blok) in Analyse. Grenzen uit één pure helper (getest).
    const { recentStart, previousStart } = powerBestPeriods(localDateStr());
    const allTime: Record<string, { watts: number; date: string }> = {};
    const recent: Record<string, { watts: number; date: string }> = {};
    const previous: Record<string, { watts: number; date: string }> = {};
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
        if (row.sessionDate >= recentStart) {
          const curR = recent[win];
          if (!curR || watts > curR.watts) {
            recent[win] = { watts, date: row.sessionDate };
          }
        } else if (row.sessionDate >= previousStart) {
          const curP = previous[win];
          if (!curP || watts > curP.watts) {
            previous[win] = { watts, date: row.sessionDate };
          }
        }
      }
    }

    res.json({ allTime, recent, previous, sessionsWithBests });
  } catch (err) {
    req.log.error({ err }, "athlete.power-bests GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── POST /api/athlete/wat-als ────────────────────────────────────────────────
// ANALYSE §5.2 — een trainingsblok doorrekenen zonder het te rijden. Zelfde
// belastingsmodel (projectLoadForward in recovery-load), geen tweede model,
// geen AI. Uitkomst is ALTIJD een berekening, nooit een voorspelling.
router.post("/wat-als", requireAuth, requireCommercialFeature("performance_lab"), async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const { tssPerDag } = (req.body ?? {}) as { tssPerDag?: unknown };
  if (
    !Array.isArray(tssPerDag) ||
    tssPerDag.length < 1 ||
    tssPerDag.length > 42 ||
    tssPerDag.some((v) => typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 600)
  ) {
    res.status(400).json({
      error: "Geef 1 tot 42 dagwaarden (belastingsscore 0–600) om door te rekenen.",
    });
    return;
  }
  try {
    const { projectLoadForward } = await import("../lib/recovery-load");
    const sessies = await db
      .select({
        sessionDate: trainingSessionsTable.sessionDate,
        tss: trainingSessionsTable.tss,
      })
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.clerkId, clerkId));
    const uitkomst = projectLoadForward(sessies, tssPerDag as number[]);
    res.json({ soort: "berekening", ...uitkomst });
  } catch (err) {
    req.log.error({ err }, "athlete.wat-als POST failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/athlete/eisprofiel ──────────────────────────────────────────────
// ANALYSE §2 vierde kaart: wat de eerstvolgende doelwedstrijd van de curve
// vraagt, tegen de eigen gemeten curve (recent blok vs eigen beste — nooit een
// verzonnen norm). Zelfde pakketpoort als de andere curve-analyses.
router.get("/eisprofiel", requireAuth, requireCommercialFeature("performance_lab"), async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const { computeEisprofiel } = await import("../lib/eisprofiel");
    res.json(await computeEisprofiel(clerkId));
  } catch (err) {
    req.log.error({ err }, "athlete.eisprofiel GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/athlete/weekly-zones ────────────────────────────────────────────
// Time-in-zone per week (Coggan zones on FTP) over the REAL stored power
// streams of the last 6 weeks. Honest by construction: rides without a power
// stream count as ride but contribute no zone time; without FTP or without any
// power data the response says so instead of guessing.
router.get("/weekly-zones", requireAuth, requireCommercialFeature("performance_lab"), async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const WEEKS = 6;
  try {
    const [athlete] = await db
      .select({
        ftp: athleteProfilesTable.ftp,
        maxHr: athleteProfilesTable.maxHr,
        birthDate: athleteProfilesTable.birthDate,
        birthYear: athleteProfilesTable.birthYear,
      })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId))
      .limit(1);
    let ftp = athlete?.ftp ?? null;
    // SPOOR_H — hartslagzones naast (niet onder) de vermogenszones. maxHR uit
    // het profiel; anders de leeftijdsformule (Tanaka), expliciet gelabeld als
    // schatting. Zonder beide blijft de hartslagverdeling eerlijk afwezig.
    const leeftijd = computeAge(athlete?.birthDate ?? null, athlete?.birthYear ?? null);
    const maxHrGebruikt =
      athlete?.maxHr ?? (leeftijd != null ? Math.round(208 - 0.7 * leeftijd) : null);
    const maxHrBron: "profiel" | "schatting" | null =
      athlete?.maxHr != null ? "profiel" : maxHrGebruikt != null ? "schatting" : null;
    if (ftp == null) {
      // Zelfde bron als de FTP-ontwikkeling op de pagina: de meest recente
      // geldige FTP-meting. Achterhaalde afgeleide rijen tellen niet mee
      // (zelfde filter als GET /ftp) — anders zou de kaart "geen FTP" zeggen
      // terwijl de gebruiker elders wél een FTP ziet.
      const [latest] = await db
        .select({ ftpWatts: ftpHistoryTable.ftpWatts })
        .from(ftpHistoryTable)
        .where(
          and(
            eq(ftpHistoryTable.clerkId, clerkId),
            sql`NOT (${ftpHistoryTable.testType} = 'derived' AND coalesce(${ftpHistoryTable.notes}, '') LIKE '[achterhaald]%')`,
          ),
        )
        .orderBy(desc(ftpHistoryTable.measuredAt))
        .limit(1);
      ftp = latest?.ftpWatts ?? null;
    }

    // Weekstart (maandag) in LOKALE dagen — sessionDate is een 'YYYY-MM-DD'
    // string; "vandaag" en de weekgrenzen komen uit de geteste pure helpers
    // (nooit via toISOString — UTC-dag-val).
    const thisMonday = mondayOf(localDateStr());
    const weekStarts: string[] = [];
    for (let i = WEEKS - 1; i >= 0; i--) {
      weekStarts.push(shiftDateStr(thisMonday, -i * 7));
    }
    const rangeStart = weekStarts[0]!;

    const sessions = await db
      .select({
        id: trainingSessionsTable.id,
        sessionDate: trainingSessionsTable.sessionDate,
        avgHR: trainingSessionsTable.avgHR,
      })
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.clerkId, clerkId),
          gte(trainingSessionsTable.sessionDate, rangeStart),
        ),
      );

    const byWeek = new Map<
      string,
      {
        seconds: number[];
        hrSeconds: number[];
        rides: number;
        ridesWithPower: number;
        ridesWithHr: number;
      }
    >();
    for (const ws of weekStarts) {
      byWeek.set(ws, {
        seconds: POWER_ZONES.map(() => 0),
        hrSeconds: HR_ZONES.map(() => 0),
        rides: 0,
        ridesWithPower: 0,
        ridesWithHr: 0,
      });
    }

    let sessionsWithPower = 0;
    let sessionsWithHr = 0;
    if (sessions.length > 0 && (ftp || maxHrGebruikt)) {
      // Alleen het streams-deel van de import ophalen — parsedSummary als
      // geheel draagt ook route-geometrie en is onnodig zwaar.
      const imports = await db
        .select({
          sessionId: activityImportsTable.linkedTrainingSessionId,
          streams: sql<unknown>`${activityImportsTable.parsedSummary} -> 'streams'`,
        })
        .from(activityImportsTable)
        .where(
          and(
            eq(activityImportsTable.clerkId, clerkId),
            inArray(
              activityImportsTable.linkedTrainingSessionId,
              sessions.map((s) => s.id),
            ),
          ),
        );
      const streamsBySession = new Map<string, unknown>();
      for (const imp of imports) {
        if (imp.sessionId) streamsBySession.set(String(imp.sessionId), imp.streams);
      }
      for (const s of sessions) {
        const week = mondayOf(s.sessionDate);
        const agg = byWeek.get(week);
        if (!agg) continue;
        agg.rides += 1;
        const streams = streamsBySession.get(String(s.id)) ?? null;
        const zoneSeconds = ftp ? powerZoneSecondsFromStreams(streams, ftp) : null;
        if (zoneSeconds) {
          agg.ridesWithPower += 1;
          sessionsWithPower += 1;
          for (let i = 0; i < zoneSeconds.length; i++) {
            agg.seconds[i]! += zoneSeconds[i]!;
          }
        }
        const hrSeconds = hrZoneSecondsFromStreams(streams, maxHrGebruikt);
        if (hrSeconds) {
          agg.ridesWithHr += 1;
          sessionsWithHr += 1;
          for (let i = 0; i < hrSeconds.length; i++) {
            agg.hrSeconds[i]! += hrSeconds[i]!;
          }
        }
      }
    } else if (sessions.length > 0) {
      for (const s of sessions) {
        const agg = byWeek.get(mondayOf(s.sessionDate));
        if (agg) agg.rides += 1;
      }
    }

    res.json({
      ftp,
      zones: POWER_ZONES.map((z) => ({
        zone: z.zone,
        label: z.label,
        fromW: ftp ? Math.round(z.lo * ftp) : null,
        toW: ftp && z.hi != null ? Math.round(z.hi * ftp) : null,
      })),
      // SPOOR_H — hartslagzones staan NAAST de vermogenszones (§3.1): een
      // renner met alleen een hartslagband krijgt een echte verdeling, geen
      // lege vermogenskaart.
      hrZones: HR_ZONES.map((z) => ({
        zone: z.zone,
        label: z.label,
        fromBpm: maxHrGebruikt ? Math.round(z.lo * maxHrGebruikt) : null,
        toBpm:
          maxHrGebruikt && z.hi != null ? Math.round(z.hi * maxHrGebruikt) : null,
      })),
      maxHr: maxHrGebruikt,
      maxHrBron,
      weeks: weekStarts.map((ws) => {
        const agg = byWeek.get(ws)!;
        return {
          weekStart: ws,
          rides: agg.rides,
          ridesWithPower: agg.ridesWithPower,
          ridesWithHr: agg.ridesWithHr,
          zoneSeconds: agg.seconds,
          hrZoneSeconds: agg.hrSeconds,
        };
      }),
      sessionsWithPower,
      sessionsWithHr,
      // Eerlijk onderscheid (SPOOR_H): hartslag kan als gemiddelde gemeten
      // zijn (provider-import zonder samplereeksen). Dat activeert het
      // hartslagspoor wél, maar levert geen zoneverdeling — de UI moet dan
      // "wel signaal, geen samplereeksen" zeggen, nooit "geen sensorsignaal".
      sessionsWithAvgHr: sessions.filter((x) => x.avgHR != null).length,
    });
  } catch (err) {
    req.log.error({ err }, "athlete.weekly-zones GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/athlete/ontkoppeling ────────────────────────────────────────────
// ANALYSE_UITBREIDING §2: ontkoppeling (HR:Power) + efficiëntie per rit.
// Berekend met DEZELFDE gedeelde functies als de rit-detailweergave
// (@workspace/analysis — verplaatst, niet herimplementeerd). Alleen ritten die
// zich ervoor lenen krijgen een getal; ongeschikte ritten krijgen de reden.
router.get("/ontkoppeling", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const days = Math.min(365, Math.max(14, Number(String(req.query.days ?? "180")) || 180));
  try {
    const { computeOntkoppelingRitten } = await import("../lib/ontkoppeling");
    const ritten = await computeOntkoppelingRitten(clerkId, days);
    res.json({ days, ritten });
  } catch (err) {
    req.log.error({ err }, "athlete.ontkoppeling GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Analyse op verzoek (ANALYSE_UITBREIDING §3/§4) ───────────────────────────
// POST maakt (of hergebruikt) een analyse over 1–5 gekozen kaarten; GET leest
// de bewaarde analyses terug. Zelfde selectie+periode+data ⇒ zelfde antwoord.
router.post("/analyses", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const { kaarten, periodeDays } = (req.body ?? {}) as {
    kaarten?: unknown;
    periodeDays?: unknown;
  };
  try {
    const { analyseOpVerzoek } = await import("../lib/analyse-verzoek");
    const uitkomst = await analyseOpVerzoek(clerkId, kaarten, periodeDays);
    if ("fout" in uitkomst) {
      res.status(400).json({ error: uitkomst.fout });
      return;
    }
    if ("limietBereikt" in uitkomst) {
      res.status(429).json({
        error: `Daglimiet bereikt: ${uitkomst.limiet} analyses per dag.`,
        gebruiktVandaag: uitkomst.gebruiktVandaag,
        limiet: uitkomst.limiet,
      });
      return;
    }
    res.json(uitkomst);
  } catch (err) {
    const { AiBlockedError, AiUnavailableError } = await import("../lib/ai/gateway");
    if (err instanceof AiBlockedError) {
      res.status(403).json({ error: "AI-analyse staat voor dit account uit." });
      return;
    }
    if (err instanceof AiUnavailableError) {
      res.status(503).json({ error: "De analysedienst is tijdelijk niet beschikbaar. Je verzoek is niet meegeteld." });
      return;
    }
    req.log.error({ err }, "athlete.analyses POST failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/analyses", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const { analysesVandaag, ANALYSES_PER_DAG } = await import("../lib/analyse-verzoek");
    const [rijen, gebruikt] = await Promise.all([
      db
        .select()
        .from(analysisRequestsTable)
        .where(eq(analysisRequestsTable.clerkId, clerkId))
        .orderBy(desc(analysisRequestsTable.createdAt))
        .limit(30),
      analysesVandaag(clerkId),
    ]);
    res.json({ analyses: rijen, gebruiktVandaag: gebruikt, limiet: ANALYSES_PER_DAG });
  } catch (err) {
    req.log.error({ err }, "athlete.analyses GET failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/athlete/ftp ─────────────────────────────────────────────────────
router.get("/ftp", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    // Achterhaalde afgeleide rijen (gemarkeerd bij zelfherstel) blijven in de
    // database staan maar zijn niet toonbaar: een oudere afgeleide schatting
    // naast een echte waarde zou anders als geldige FTP gelezen worden.
    const history = await db
      .select()
      .from(ftpHistoryTable)
      .where(
        and(
          eq(ftpHistoryTable.clerkId, clerkId),
          sql`NOT (${ftpHistoryTable.testType} = 'derived' AND coalesce(${ftpHistoryTable.notes}, '') LIKE '[achterhaald]%')`,
        ),
      )
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
        // DATABRONNEN_EN_FTP_01 D2: dit is het invoerpad van de sporter zelf.
        bron: "sporter",
        leidend: true,
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
