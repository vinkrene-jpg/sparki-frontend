import { Router } from "express";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import {
  db,
  coachAthleteLinksTable,
  userProfilesTable,
  athleteProfilesTable,
  athleteDailyMetricsTable,
  coachFollowupAnswersTable,
  plannedWorkoutsTable,
  aiObservationsTable,
} from "@workspace/db";
import { analysisFeedbackTable } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { requireCommercialFeature } from "../lib/entitlements";
import { SPARKI_ENGINE_VERSION } from "../lib/engine-version";
import { writeAudit } from "../lib/security/audit";
import { sessionSeed } from "../lib/variation";
import { computeReadiness } from "../engines/recovery-load";
import {
  coachSharingLevel,
  hasDirectCoachAccess,
  hasClubTeamTrainerAccess,
  clubAssignedAthleteIds,
  hasRole,
} from "../engines/coaching";
import { loadPlanView } from "../engines/training-plan";
import { getAthleteContextForViewer } from "../engines/context-memory";
import {
  runCoachAnalysis,
  isKnownFollowUp,
  isValidFollowUpAnswer,
  checkInFromAnswer,
  isCoachFeedbackSignal,
  recordCoachingFeedback,
  applyProfileCorrection,
} from "../engines/observation";

const router = Router();

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

async function requireCoach(clerkId: string, res: import("express").Response) {
  if (!(await hasRole(clerkId, "coach"))) {
    res.status(403).json({ error: "Coach-rol vereist" });
    return false;
  }
  return true;
}

// Map a plan day's route-generator training type to the planned_workouts.type
// vocabulary so an adopted coach session reads correctly in the athlete's plan.
function planDayToWorkoutType(trainingType: string | null): string {
  switch (trainingType) {
    case "interval":
      return "interval";
    case "tempo":
      return "tempo";
    case "herstel":
      return "recovery";
    case "wedstrijd":
      return "race";
    default:
      return "ride";
  }
}

// GET /api/coach/athletes — roster of accepted athletes, each gated by the
// athlete's own dataSharingCoach preference.
router.get("/athletes", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  if (!(await requireCoach(coachId, res))) return;
  try {
    const links = await db
      .select({ athleteClerkId: coachAthleteLinksTable.athleteClerkId })
      .from(coachAthleteLinksTable)
      .where(
        and(
          eq(coachAthleteLinksTable.coachClerkId, coachId),
          eq(coachAthleteLinksTable.status, "accepted"),
        ),
      );
    // Unie van directe koppelingen en geldige club/teamtoewijzingen; toegang
    // wordt server-side per read bepaald, deelniveaus blijven per sporter gelden.
    const assigned = await clubAssignedAthleteIds(coachId);
    const ids = [...new Set([...links.map((l) => l.athleteClerkId), ...assigned])];
    if (ids.length === 0) {
      res.json({ athletes: [] });
      return;
    }

    const profiles = await db
      .select({
        clerkId: userProfilesTable.clerkId,
        displayName: userProfilesTable.displayName,
        discipline: athleteProfilesTable.discipline,
        healthStatus: athleteProfilesTable.healthStatus,
      })
      .from(userProfilesTable)
      .leftJoin(
        athleteProfilesTable,
        eq(athleteProfilesTable.clerkId, userProfilesTable.clerkId),
      )
      .where(inArray(userProfilesTable.clerkId, ids));

    const directIds = new Set(links.map((l) => l.athleteClerkId));
    const athletes = await Promise.all(
      profiles.map(async (p) => {
        const relation = directIds.has(p.clerkId) ? ("direct" as const) : ("team" as const);
        const sharing = await coachSharingLevel(p.clerkId);
        const base = {
          athleteClerkId: p.clerkId,
          displayName: p.displayName,
          sharing,
          relation,
        };
        if (sharing === "none") return base;
        // Alleen toewijzing (geen directe link): identificeren mag, maar
        // individuele data (readiness, planning, metrics) blijft dicht (WP-01C).
        if (relation === "team") {
          return { ...base, discipline: p.discipline };
        }

        const [metric] = await db
          .select()
          .from(athleteDailyMetricsTable)
          .where(eq(athleteDailyMetricsTable.clerkId, p.clerkId))
          .orderBy(desc(athleteDailyMetricsTable.metricDate))
          .limit(1);
        const [nextWorkout] = await db
          .select({
            scheduledDate: plannedWorkoutsTable.scheduledDate,
            title: plannedWorkoutsTable.title,
            type: plannedWorkoutsTable.type,
          })
          .from(plannedWorkoutsTable)
          .where(
            and(
              eq(plannedWorkoutsTable.clerkId, p.clerkId),
              gte(plannedWorkoutsTable.scheduledDate, todayISO()),
            ),
          )
          .orderBy(plannedWorkoutsTable.scheduledDate)
          .limit(1);

        return {
          ...base,
          discipline: p.discipline,
          healthStatus: p.healthStatus,
          readiness: computeReadiness(metric ?? null),
          nextSession: nextWorkout ?? null,
          // "full" sharing exposes the raw latest metric; "summary" hides it.
          latestMetric: sharing === "full" ? (metric ?? null) : undefined,
        };
      }),
    );
    res.json({ athletes });
  } catch (err) {
    req.log.error({ err }, "coach.athletes failed");
    res.status(500).json({ error: "Kon roster niet laden" });
  }
});

// GET /api/coach/athletes/:athleteId — detail view, requires accepted link and
// sharing != none. Shareable observations are athlete observations the athlete
// has saved/acknowledged (not dismissed/new drafts).
router.get("/athletes/:athleteId", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  if (!(await requireCoach(coachId, res))) return;
  const athleteId = String(req.params.athleteId);
  try {
    if (!(await hasDirectCoachAccess(coachId, athleteId))) {
      res.status(403).json({ error: "Geen gekoppelde atleet" });
      return;
    }
    const sharing = await coachSharingLevel(athleteId);
    if (sharing === "none") {
      res.json({ sharing, athlete: null, message: "Atleet deelt geen data" });
      return;
    }
    void writeAudit({
      event: "viewed_by_coach",
      actorClerkId: coachId,
      subjectClerkId: athleteId,
      meta: { rol: "coach", niveau: sharing },
      req,
    });

    const [profile] = await db
      .select({
        clerkId: userProfilesTable.clerkId,
        displayName: userProfilesTable.displayName,
        discipline: athleteProfilesTable.discipline,
        healthStatus: athleteProfilesTable.healthStatus,
        ftp: athleteProfilesTable.ftp,
      })
      .from(userProfilesTable)
      .leftJoin(
        athleteProfilesTable,
        eq(athleteProfilesTable.clerkId, userProfilesTable.clerkId),
      )
      .where(eq(userProfilesTable.clerkId, athleteId));

    const metrics = await db
      .select()
      .from(athleteDailyMetricsTable)
      .where(eq(athleteDailyMetricsTable.clerkId, athleteId))
      .orderBy(desc(athleteDailyMetricsTable.metricDate))
      .limit(sharing === "full" ? 14 : 7);

    const schedule = await db
      .select({
        scheduledDate: plannedWorkoutsTable.scheduledDate,
        title: plannedWorkoutsTable.title,
        type: plannedWorkoutsTable.type,
        targetDurationMin: plannedWorkoutsTable.targetDurationMin,
        status: plannedWorkoutsTable.status,
      })
      .from(plannedWorkoutsTable)
      .where(
        and(
          eq(plannedWorkoutsTable.clerkId, athleteId),
          gte(plannedWorkoutsTable.scheduledDate, todayISO()),
        ),
      )
      .orderBy(plannedWorkoutsTable.scheduledDate)
      .limit(7);

    const observations = await db
      .select({
        id: aiObservationsTable.id,
        title: aiObservationsTable.title,
        summary: aiObservationsTable.summary,
        category: aiObservationsTable.category,
        severity: aiObservationsTable.severity,
        createdAt: aiObservationsTable.createdAt,
      })
      .from(aiObservationsTable)
      .where(
        and(
          eq(aiObservationsTable.clerkId, athleteId),
          inArray(aiObservationsTable.status, ["acknowledged", "saved"]),
        ),
      )
      .orderBy(desc(aiObservationsTable.createdAt))
      .limit(10);

    res.json({
      sharing,
      athlete: {
        ...profile,
        readiness: computeReadiness(metrics[0] ?? null),
        metrics: sharing === "full" ? metrics : metrics.slice(0, 3),
        schedule,
        observations,
      },
    });
  } catch (err) {
    req.log.error({ err }, "coach.athlete-detail failed");
    res.status(500).json({ error: "Kon atleet niet laden" });
  }
});

// GET /api/coach/athletes/:athleteId/plan — read-only view of the athlete's
// current Sparki advisory plan (mode "advisory"). Requires an accepted link and
// the athlete sharing != none. This NEVER modifies the coach's planned_workouts;
// it only surfaces Sparki's suggestion so the coach can decide what to act on.
router.get("/athletes/:athleteId/plan", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  if (!(await requireCoach(coachId, res))) return;
  const athleteId = String(req.params.athleteId);
  try {
    if (!(await hasDirectCoachAccess(coachId, athleteId))) {
      res.status(403).json({ error: "Geen gekoppelde atleet" });
      return;
    }
    const sharing = await coachSharingLevel(athleteId);
    if (sharing === "none") {
      res.json({
        sharing,
        athlete: null,
        plan: null,
        days: [],
        message: "Atleet deelt geen data",
      });
      return;
    }

    const [profile] = await db
      .select({
        clerkId: userProfilesTable.clerkId,
        displayName: userProfilesTable.displayName,
        discipline: athleteProfilesTable.discipline,
      })
      .from(userProfilesTable)
      .leftJoin(
        athleteProfilesTable,
        eq(athleteProfilesTable.clerkId, userProfilesTable.clerkId),
      )
      .where(eq(userProfilesTable.clerkId, athleteId));

    const view = await loadPlanView(athleteId);
    // Only surface advisory plans. An autonomous plan means the athlete is
    // self-coached and there is no advice to show in the coach portal.
    const isAdvisory = view?.plan?.mode === "advisory";

    // Mark days the coach has already adopted (a coach-sourced planned_workouts
    // row exists for that date) so the UI can show a "Overgenomen" state and
    // never offer to write the same day twice.
    type PlanViewDay = NonNullable<
      Awaited<ReturnType<typeof loadPlanView>>
    >["days"][number];
    let days: Array<PlanViewDay & { adopted: boolean }> = [];
    if (isAdvisory) {
      const coachWorkouts = await db
        .select({ scheduledDate: plannedWorkoutsTable.scheduledDate })
        .from(plannedWorkoutsTable)
        .where(
          and(
            eq(plannedWorkoutsTable.clerkId, athleteId),
            eq(plannedWorkoutsTable.source, "coach"),
          ),
        );
      const adoptedDates = new Set(coachWorkouts.map((w) => w.scheduledDate));
      days = view!.days.map((d) => ({
        ...d,
        adopted: adoptedDates.has(d.dayDate),
      }));
    }

    res.json({
      sharing,
      athlete: {
        athleteClerkId: athleteId,
        displayName: profile?.displayName ?? null,
        discipline: profile?.discipline ?? null,
      },
      plan: isAdvisory ? view!.plan : null,
      days,
    });
  } catch (err) {
    req.log.error({ err }, "coach.athlete-plan failed");
    res.status(500).json({ error: "Kon adviesschema niet laden" });
  }
});

// GET /api/coach/athletes/:athleteId/context — the athlete's personal-context
// memories (examen, wedstrijd, blessure, slaap/spanning, kamp). Requires an
// accepted link AND sharing != none. Only Sparki's neutral title/detail is
// exposed — never the athlete's raw words or their personal answers.
router.get("/athletes/:athleteId/context", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  if (!(await requireCoach(coachId, res))) return;
  const athleteId = String(req.params.athleteId);
  try {
    if (!(await hasDirectCoachAccess(coachId, athleteId))) {
      res.status(403).json({ error: "Geen gekoppelde atleet" });
      return;
    }
    const sharing = await coachSharingLevel(athleteId);
    if (sharing === "none") {
      res.json({ sharing, memories: [], message: "Atleet deelt geen data" });
      return;
    }
    const memories = await getAthleteContextForViewer(athleteId);
    res.json({ sharing, memories });
  } catch (err) {
    req.log.error({ err }, "coach.athlete-context failed");
    res.status(500).json({ error: "Kon context niet laden" });
  }
});

// POST /api/coach/athletes/:athleteId/plan/adopt — the coach explicitly adopts
// one or more advised days into the athlete's plan as coach-authored sessions
// (source "coach", NOT "sparki"). Mirrors the gating of GET .../plan. Nothing is
// written automatically: only the day ids the coach sends are adopted, and a day
// that already has a coach session on its date is skipped — existing coach
// workouts are never silently overwritten.
router.post("/athletes/:athleteId/plan/adopt", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  if (!(await requireCoach(coachId, res))) return;
  const athleteId = String(req.params.athleteId);

  const body = req.body as { planDayIds?: unknown };
  const dayIds = Array.from(
    new Set(
      (Array.isArray(body.planDayIds) ? body.planDayIds : [])
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  );
  if (dayIds.length === 0) {
    res.status(400).json({ error: "Geen dagen geselecteerd" });
    return;
  }

  try {
    if (!(await hasDirectCoachAccess(coachId, athleteId))) {
      res.status(403).json({ error: "Geen gekoppelde atleet" });
      return;
    }
    const sharing = await coachSharingLevel(athleteId);
    if (sharing === "none") {
      res.status(403).json({ error: "Atleet deelt geen data" });
      return;
    }

    const view = await loadPlanView(athleteId);
    if (!view || view.plan.mode !== "advisory") {
      res.status(404).json({ error: "Geen adviesschema beschikbaar" });
      return;
    }
    const byId = new Map(view.days.map((d) => [d.id, d]));

    const adopted: number[] = [];
    const skipped: Array<{ dayId: number; reason: string }> = [];

    for (const dayId of dayIds) {
      const day = byId.get(dayId);
      if (!day) {
        skipped.push({ dayId, reason: "not_found" });
        continue;
      }
      if (day.isRest) {
        skipped.push({ dayId, reason: "rest" });
        continue;
      }
      // Never overwrite: if a coach session already exists on that date, skip.
      const [existing] = await db
        .select({ id: plannedWorkoutsTable.id })
        .from(plannedWorkoutsTable)
        .where(
          and(
            eq(plannedWorkoutsTable.clerkId, athleteId),
            eq(plannedWorkoutsTable.scheduledDate, day.dayDate),
            eq(plannedWorkoutsTable.source, "coach"),
          ),
        )
        .limit(1);
      if (existing) {
        skipped.push({ dayId, reason: "already" });
        continue;
      }

      await db.insert(plannedWorkoutsTable).values({
        clerkId: athleteId,
        scheduledDate: day.dayDate,
        type: planDayToWorkoutType(day.trainingType),
        title: day.workout?.title ?? day.focus,
        description: day.rationale ?? null,
        targetDurationMin: day.estDurationMin ?? null,
        status: "planned",
        source: "coach",
      });
      adopted.push(dayId);
    }

    res.status(201).json({ adopted, skipped });
  } catch (err) {
    req.log.error({ err }, "coach.athlete-plan-adopt failed");
    res.status(500).json({ error: "Kon advies niet overnemen" });
  }
});

// POST /api/coach/athletes/:athleteId/plan/decision — de coach beoordeelt een
// voorstel van Sparki expliciet: overnemen (accept), aanpassen (adjust) of
// afwijzen (reject, reden verplicht). "accept" hergebruikt het bestaande
// adopt-pad; "adjust"/"reject" registreren alleen het besluit. Elk besluit
// wordt idempotent vastgelegd in de feedbacklus (één rij per coach+voorstel) —
// en past NOOIT automatisch analyseregels aan.
router.post(
  "/athletes/:athleteId/plan/decision",
  requireAuth,
  async (req, res) => {
    const coachId = getClerkUserId(req)!;
    if (!(await requireCoach(coachId, res))) return;
    const athleteId = String(req.params.athleteId);

    const body = (req.body ?? {}) as {
      planDayId?: unknown;
      decision?: unknown;
      reasonText?: unknown;
      adjustedNote?: unknown;
    };
    const planDayId = Number(body.planDayId);
    const decision = String(body.decision ?? "");
    const reasonText =
      typeof body.reasonText === "string"
        ? body.reasonText.trim().slice(0, 500) || null
        : null;
    const adjustedNote =
      typeof body.adjustedNote === "string"
        ? body.adjustedNote.trim().slice(0, 500) || null
        : null;

    if (!Number.isInteger(planDayId) || planDayId <= 0) {
      res.status(400).json({ error: "Ongeldige dag" });
      return;
    }
    if (!["accept", "adjust", "reject"].includes(decision)) {
      res.status(400).json({ error: "Ongeldig besluit" });
      return;
    }
    if (decision === "reject" && !reasonText) {
      res.status(400).json({ error: "Geef een reden bij afwijzen." });
      return;
    }
    if (decision === "adjust" && !adjustedNote) {
      res.status(400).json({ error: "Geef aan wat je aanpast." });
      return;
    }

    try {
      // Toestemmingsgate — identiek aan het adopt-pad (fail-closed).
      if (!(await hasDirectCoachAccess(coachId, athleteId))) {
        res.status(403).json({ error: "Geen gekoppelde atleet" });
        return;
      }
      const sharing = await coachSharingLevel(athleteId);
      if (sharing === "none") {
        res.status(403).json({ error: "Atleet deelt geen data" });
        return;
      }

      const view = await loadPlanView(athleteId);
      if (!view || view.plan.mode !== "advisory") {
        res.status(404).json({ error: "Geen adviesschema beschikbaar" });
        return;
      }
      const day = view.days.find((d) => d.id === planDayId);
      if (!day) {
        res.status(404).json({ error: "Dag niet gevonden" });
        return;
      }

      // Accept = het bestaande overnemen-pad (nooit een parallel schrijfpad):
      // een coach-sessie op die datum, zonder bestaande te overschrijven.
      let adopted = false;
      if (decision === "accept" || decision === "adjust") {
        const [existing] = await db
          .select({ id: plannedWorkoutsTable.id })
          .from(plannedWorkoutsTable)
          .where(
            and(
              eq(plannedWorkoutsTable.clerkId, athleteId),
              eq(plannedWorkoutsTable.scheduledDate, day.dayDate),
              eq(plannedWorkoutsTable.source, "coach"),
            ),
          )
          .limit(1);
        if (!existing && !day.isRest) {
          await db.insert(plannedWorkoutsTable).values({
            clerkId: athleteId,
            scheduledDate: day.dayDate,
            type: planDayToWorkoutType(day.trainingType),
            title: day.workout?.title ?? day.focus,
            description:
              decision === "adjust"
                ? [day.rationale, `Aangepast door coach: ${adjustedNote}`]
                    .filter(Boolean)
                    .join(" — ")
                : (day.rationale ?? null),
            targetDurationMin: day.estDurationMin ?? null,
            status: "planned",
            source: "coach",
          });
          adopted = true;
        }
      }

      // Registreer het besluit idempotent in de feedbacklus.
      const verdict =
        decision === "reject"
          ? "niet_opgevolgd"
          : decision === "adjust"
            ? "opgevolgd"
            : "opgevolgd";
      const [feedback] = await db
        .insert(analysisFeedbackTable)
        .values({
          clerkId: athleteId,
          actorClerkId: coachId,
          actorRole: "coach",
          subjectType: "coach_proposal",
          subjectKey: `plan_day:${planDayId}`,
          verdict,
          reasonCode: decision === "reject" ? "anders" : null,
          reasonText: decision === "adjust" ? adjustedNote : reasonText,
          actionKind: decision === "adjust" ? "training_aangepast" : null,
          context: {
            engine: "training-plan",
            ruleKey: `decision:${decision}`,
            engineVersion: SPARKI_ENGINE_VERSION,
            confidenceScore: null,
            confidenceLevel: null,
            severity: null,
            category: "planning",
            missingData: [],
            computedAt: new Date().toISOString(),
          },
        })
        .onConflictDoUpdate({
          target: [
            analysisFeedbackTable.actorClerkId,
            analysisFeedbackTable.subjectType,
            analysisFeedbackTable.subjectKey,
          ],
          // Volledige overschrijving bij herbeoordeling: ook reasonCode en de
          // contextmomentopname mee-updaten, anders blijft de verantwoording
          // van het oude besluit staan (breekt herleidbaarheid + aggregaties).
          set: {
            verdict,
            reasonCode: decision === "reject" ? "anders" : null,
            reasonText: decision === "adjust" ? adjustedNote : reasonText,
            actionKind: decision === "adjust" ? "training_aangepast" : null,
            context: {
              engine: "training-plan",
              ruleKey: `decision:${decision}`,
              engineVersion: SPARKI_ENGINE_VERSION,
              confidenceScore: null,
              confidenceLevel: null,
              severity: null,
              category: "planning",
              missingData: [],
              computedAt: new Date().toISOString(),
            },
            updatedAt: new Date(),
          },
        })
        .returning();

      res.status(201).json({ decision, adopted, feedback });
    } catch (err) {
      req.log.error({ err }, "coach.plan-decision failed");
      res.status(500).json({ error: "Besluit opslaan mislukt" });
    }
  },
);

// ── Athlete-facing daily coach analysis (no role gate; your own data) ─────────

// GET /api/coach/analysis — Sparki's deterministic six-part analysis for the
// signed-in athlete, including today's stored follow-up answers fed back in.
router.get("/analysis", requireAuth, requireCommercialFeature("ai_observations"), async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const analysis = await runCoachAnalysis(clerkId, {
      variationSeed: sessionSeed(req),
    });
    // Verantwoording: iedere uitgeleverde analyse draagt engine + versie +
    // tijdstip, zodat elke conclusie herleidbaar is naar haar berekening.
    res.json({
      ...analysis,
      engine: "observation",
      engineVersion: SPARKI_ENGINE_VERSION,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "coach.analysis failed");
    res.status(500).json({ error: "Kon je analyse niet samenstellen" });
  }
});

// POST /api/coach/followup — save the athlete's answer to one of Sparki's
// follow-up questions, then return the freshly recomputed analysis so the advice
// updates immediately. A "fris/oké/vermoeid" answer is a real check-in and is
// persisted as actual daily metrics. Body: { questionId, answer }.
router.post("/followup", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = req.body as Record<string, unknown>;
  const questionId = String(body.questionId ?? "");
  const answer = String(body.answer ?? "");

  if (!isKnownFollowUp(questionId) || !isValidFollowUpAnswer(questionId, answer)) {
    res.status(400).json({ error: "Ongeldige vraag of antwoord" });
    return;
  }

  try {
    const today = todayISO();

    // A check-in answer is real readiness data — persist it as a daily metric so
    // every engine (not just this analysis) sees it.
    const checkIn = checkInFromAnswer(answer);
    if (questionId === "missing_checkin" && checkIn) {
      await db
        .insert(athleteDailyMetricsTable)
        .values({
          clerkId,
          metricDate: today,
          feelScore: checkIn.feelScore,
          fatigueScore: checkIn.fatigueScore,
        })
        .onConflictDoUpdate({
          target: [
            athleteDailyMetricsTable.clerkId,
            athleteDailyMetricsTable.metricDate,
          ],
          set: {
            feelScore: checkIn.feelScore,
            fatigueScore: checkIn.fatigueScore,
          },
        });
    }

    // A confirmed profile correction ("pas_aan" on a profile_* question) is
    // applied now — the applier re-verifies the evidence from the database
    // before writing, so a stale confirmation never blind-writes anything.
    if (questionId.startsWith("profile_") && answer === "pas_aan") {
      await applyProfileCorrection(clerkId, questionId);
    }

    // Store the answer itself (one per question per day; re-answering updates it).
    await db
      .insert(coachFollowupAnswersTable)
      .values({ clerkId, analysisDate: today, questionId, answer })
      .onConflictDoUpdate({
        target: [
          coachFollowupAnswersTable.clerkId,
          coachFollowupAnswersTable.analysisDate,
          coachFollowupAnswersTable.questionId,
        ],
        set: { answer, updatedAt: new Date() },
      });

    const analysis = await runCoachAnalysis(clerkId, {
      variationSeed: sessionSeed(req),
    });
    res.json({
      ...analysis,
      engine: "observation",
      engineVersion: SPARKI_ENGINE_VERSION,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "coach.followup failed");
    res.status(500).json({ error: "Kon je antwoord niet verwerken" });
  }
});

// POST /api/coach/feedback — record how the athlete reacted to Sparki's advice
// (e.g. advice_followed / too_strict) so the begeleidingsprofiel adapts. Body:
// { signal }.
router.post("/feedback", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = req.body as Record<string, unknown>;
  const signal = String(body.signal ?? "");

  if (!isCoachFeedbackSignal(signal)) {
    res.status(400).json({ error: "Ongeldig feedbacksignaal" });
    return;
  }

  try {
    const nudges = await recordCoachingFeedback(clerkId, signal);
    res.json({ ok: true, nudges });
  } catch (err) {
    req.log.error({ err }, "coach.feedback failed");
    res.status(500).json({ error: "Kon je feedback niet verwerken" });
  }
});

export default router;
