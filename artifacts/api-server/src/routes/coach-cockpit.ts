// Coach-cockpit — het centrale coachdashboard en de bijbehorende werkstromen:
// prioritering (signalen), besluiten (accepteren/aanpassen/afwijzen/parkeren),
// planning (één of meerdere sporters), Sparki-wijzigingsvoorstellen op
// coachtrainingen (nooit automatisch toegepast), compacte communicatie en
// coachcontext. Elke inzage en wijziging respecteert de bestaande
// toestemmingslagen (geaccepteerde koppeling + dataSharingCoach) en wordt
// vastgelegd in het beveiligings-auditlog.

import { Router } from "express";
import { and, asc, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  db,
  coachAthleteLinksTable,
  userProfilesTable,
  athleteProfilesTable,
  athleteDailyMetricsTable,
  plannedWorkoutsTable,
  trainingSessionsTable,
  racesTable,
  coachSignalActionsTable,
  coachMessagesTable,
  coachContextItemsTable,
  coachChangeProposalsTable,
  COACH_SIGNAL_ACTIONS,
  COACH_MESSAGE_SUBJECTS,
  COACH_CONTEXT_KINDS,
  type CoachSignalAction,
  type CoachMessageSubject,
  type CoachContextKind,
  type CoachProposalChanges,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { writeAudit } from "../lib/security/audit";
import { computeReadiness } from "../lib/sharing";
import {
  coachSharingLevel,
  hasAcceptedCoachLink,
  hasRole,
} from "../engines/coaching";
import { buildCoachSignals, openPriority } from "../lib/coach-signals";

const router = Router();

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function requireCoach(clerkId: string, res: import("express").Response) {
  if (!(await hasRole(clerkId, "coach"))) {
    res.status(403).json({ error: "Coach-rol vereist" });
    return false;
  }
  return true;
}

// Toestemmingsgate voor data-inzage/-wijziging: geaccepteerde koppeling én
// sharing != none. Fail-closed.
async function gateAthlete(
  coachId: string,
  athleteId: string,
  res: import("express").Response,
): Promise<"summary" | "full" | null> {
  if (!(await hasAcceptedCoachLink(coachId, athleteId))) {
    res.status(403).json({ error: "Geen gekoppelde atleet" });
    return null;
  }
  const sharing = await coachSharingLevel(athleteId);
  if (sharing === "none") {
    res.status(403).json({ error: "Atleet deelt geen data" });
    return null;
  }
  return sharing;
}

// ── GET /api/coach/dashboard ─────────────────────────────────────────────────
// Het centrale overzicht: per gekoppelde sporter status, vandaag, laatste
// activiteit, belangrijkste openstaande signaal, laatste beoordeling — gesorteerd
// op prioriteit. Sporters die niets delen staan er eerlijk in met alleen naam.
router.get("/dashboard", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  if (!(await requireCoach(coachId, res))) return;
  try {
    const links = await db
      .select({
        athleteClerkId: coachAthleteLinksTable.athleteClerkId,
        lastReviewedAt: coachAthleteLinksTable.lastReviewedAt,
      })
      .from(coachAthleteLinksTable)
      .where(
        and(
          eq(coachAthleteLinksTable.coachClerkId, coachId),
          eq(coachAthleteLinksTable.status, "accepted"),
        ),
      );
    if (links.length === 0) {
      res.json({ athletes: [] });
      return;
    }
    const ids = links.map((l) => l.athleteClerkId);
    const reviewedBy = new Map(links.map((l) => [l.athleteClerkId, l.lastReviewedAt]));

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

    void writeAudit({
      event: "viewed_by_coach",
      actorClerkId: coachId,
      meta: { rol: "coach", scherm: "dashboard", aantal: ids.length },
      req,
    });

    const today = todayISO();
    const athletes = await Promise.all(
      profiles.map(async (p) => {
        const sharing = await coachSharingLevel(p.clerkId);
        const base = {
          athleteClerkId: p.clerkId,
          displayName: p.displayName,
          sharing,
          lastReviewedAt: reviewedBy.get(p.clerkId) ?? null,
        };
        if (sharing === "none") {
          return { ...base, priority: null, signals: [], openSignals: 0 };
        }

        const [signals, [metric], [todayWorkout], [lastSession], unread] =
          await Promise.all([
            buildCoachSignals(coachId, p.clerkId),
            db
              .select()
              .from(athleteDailyMetricsTable)
              .where(eq(athleteDailyMetricsTable.clerkId, p.clerkId))
              .orderBy(desc(athleteDailyMetricsTable.metricDate))
              .limit(1),
            db
              .select({
                id: plannedWorkoutsTable.id,
                title: plannedWorkoutsTable.title,
                type: plannedWorkoutsTable.type,
                status: plannedWorkoutsTable.status,
                source: plannedWorkoutsTable.source,
              })
              .from(plannedWorkoutsTable)
              .where(
                and(
                  eq(plannedWorkoutsTable.clerkId, p.clerkId),
                  eq(plannedWorkoutsTable.scheduledDate, today),
                ),
              )
              .limit(1),
            db
              .select({
                id: trainingSessionsTable.id,
                title: trainingSessionsTable.title,
                sessionDate: trainingSessionsTable.sessionDate,
                durationMin: trainingSessionsTable.durationMin,
              })
              .from(trainingSessionsTable)
              .where(eq(trainingSessionsTable.clerkId, p.clerkId))
              .orderBy(desc(trainingSessionsTable.sessionDate), desc(trainingSessionsTable.id))
              .limit(1),
            db
              .select({ n: sql<number>`count(*)::int` })
              .from(coachMessagesTable)
              .where(
                and(
                  eq(coachMessagesTable.coachClerkId, coachId),
                  eq(coachMessagesTable.athleteClerkId, p.clerkId),
                  eq(coachMessagesTable.senderClerkId, p.clerkId),
                  isNull(coachMessagesTable.readAt),
                ),
              ),
          ]);

        const openSignals = signals.filter(
          (s) => !s.action || s.action.action === "parkeren",
        );
        return {
          ...base,
          discipline: p.discipline,
          healthStatus: p.healthStatus,
          readiness: computeReadiness(metric ?? null),
          todayWorkout: todayWorkout ?? null,
          lastActivity: lastSession ?? null,
          topSignal: openSignals[0] ?? null,
          openSignals: openSignals.length,
          unreadMessages: unread[0]?.n ?? 0,
          priority: openPriority(signals),
        };
      }),
    );

    // Prioriteit 1 eerst, dan 2, dan 3, dan rustig; binnen gelijk niveau op naam.
    athletes.sort((a, b) => {
      const pa = a.priority ?? 9;
      const pb = b.priority ?? 9;
      if (pa !== pb) return pa - pb;
      return (a.displayName ?? "").localeCompare(b.displayName ?? "");
    });
    res.json({ athletes });
  } catch (err) {
    req.log.error({ err }, "coach.dashboard failed");
    res.status(500).json({ error: "Kon dashboard niet laden" });
  }
});

// ── Signalen ─────────────────────────────────────────────────────────────────

router.get("/athletes/:athleteId/signals", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  if (!(await requireCoach(coachId, res))) return;
  const athleteId = String(req.params.athleteId);
  try {
    if (!(await gateAthlete(coachId, athleteId, res))) return;
    void writeAudit({
      event: "viewed_by_coach",
      actorClerkId: coachId,
      subjectClerkId: athleteId,
      meta: { rol: "coach", scherm: "signalen" },
      req,
    });
    const signals = await buildCoachSignals(coachId, athleteId);
    res.json({ signals });
  } catch (err) {
    req.log.error({ err }, "coach.signals failed");
    res.status(500).json({ error: "Kon signalen niet laden" });
  }
});

// POST besluit op een signaal: accepteren / aanpassen / afwijzen / parkeren.
router.post(
  "/athletes/:athleteId/signals/action",
  requireAuth,
  async (req, res) => {
    const coachId = getClerkUserId(req)!;
    if (!(await requireCoach(coachId, res))) return;
    const athleteId = String(req.params.athleteId);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const signalKey = String(body.signalKey ?? "").slice(0, 200);
    const action = String(body.action ?? "") as CoachSignalAction;
    const note =
      typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;

    if (!signalKey) {
      res.status(400).json({ error: "signalKey ontbreekt" });
      return;
    }
    if (!COACH_SIGNAL_ACTIONS.includes(action)) {
      res.status(400).json({ error: "Ongeldig besluit" });
      return;
    }
    if ((action === "afwijzen" || action === "parkeren") && !note) {
      res.status(400).json({ error: "Geef een korte notitie bij afwijzen of parkeren." });
      return;
    }

    try {
      if (!(await gateAthlete(coachId, athleteId, res))) return;
      const [row] = await db
        .insert(coachSignalActionsTable)
        .values({ coachClerkId: coachId, athleteClerkId: athleteId, signalKey, action, note })
        .onConflictDoUpdate({
          target: [
            coachSignalActionsTable.coachClerkId,
            coachSignalActionsTable.athleteClerkId,
            coachSignalActionsTable.signalKey,
          ],
          set: { action, note, updatedAt: new Date() },
        })
        .returning();
      void writeAudit({
        event: "changed_by_coach",
        actorClerkId: coachId,
        subjectClerkId: athleteId,
        meta: { rol: "coach", wat: "signaalbesluit", besluit: action },
        req,
      });
      res.status(201).json({ action: row });
    } catch (err) {
      req.log.error({ err }, "coach.signal-action failed");
      res.status(500).json({ error: "Besluit opslaan mislukt" });
    }
  },
);

// POST /athletes/:athleteId/review — markeer als beoordeeld (datum laatste
// beoordeling op de koppeling).
router.post("/athletes/:athleteId/review", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  if (!(await requireCoach(coachId, res))) return;
  const athleteId = String(req.params.athleteId);
  try {
    const [updated] = await db
      .update(coachAthleteLinksTable)
      .set({ lastReviewedAt: new Date() })
      .where(
        and(
          eq(coachAthleteLinksTable.coachClerkId, coachId),
          eq(coachAthleteLinksTable.athleteClerkId, athleteId),
          eq(coachAthleteLinksTable.status, "accepted"),
        ),
      )
      .returning({ lastReviewedAt: coachAthleteLinksTable.lastReviewedAt });
    if (!updated) {
      res.status(403).json({ error: "Geen gekoppelde atleet" });
      return;
    }
    res.json({ lastReviewedAt: updated.lastReviewedAt });
  } catch (err) {
    req.log.error({ err }, "coach.review failed");
    res.status(500).json({ error: "Kon beoordeling niet opslaan" });
  }
});

// ── Planning (coachtrainingen) ───────────────────────────────────────────────

// GET weekplanning van één sporter (alle bronnen, zodat de coach het hele
// beeld ziet; Sparki-trainingen zijn read-only voor de coach).
router.get("/athletes/:athleteId/workouts", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  if (!(await requireCoach(coachId, res))) return;
  const athleteId = String(req.params.athleteId);
  const from = DATE_RE.test(String(req.query.from ?? "")) ? String(req.query.from) : todayISO();
  const to = DATE_RE.test(String(req.query.to ?? "")) ? String(req.query.to) : null;
  try {
    if (!(await gateAthlete(coachId, athleteId, res))) return;
    const where = [
      eq(plannedWorkoutsTable.clerkId, athleteId),
      gte(plannedWorkoutsTable.scheduledDate, from),
    ];
    if (to) where.push(lte(plannedWorkoutsTable.scheduledDate, to));
    const workouts = await db
      .select({
        id: plannedWorkoutsTable.id,
        scheduledDate: plannedWorkoutsTable.scheduledDate,
        title: plannedWorkoutsTable.title,
        type: plannedWorkoutsTable.type,
        description: plannedWorkoutsTable.description,
        targetDurationMin: plannedWorkoutsTable.targetDurationMin,
        targetTSS: plannedWorkoutsTable.targetTSS,
        status: plannedWorkoutsTable.status,
        source: plannedWorkoutsTable.source,
        structure: plannedWorkoutsTable.structure,
      })
      .from(plannedWorkoutsTable)
      .where(and(...where))
      .orderBy(asc(plannedWorkoutsTable.scheduledDate));
    res.json({ workouts });
  } catch (err) {
    req.log.error({ err }, "coach.workouts.list failed");
    res.status(500).json({ error: "Kon planning niet laden" });
  }
});

interface WorkoutInput {
  scheduledDate?: unknown;
  title?: unknown;
  type?: unknown;
  description?: unknown;
  targetDurationMin?: unknown;
  targetTSS?: unknown;
  raceId?: unknown;
}

function parseWorkoutInput(body: WorkoutInput):
  | { ok: true; value: { scheduledDate: string; title: string; type: string; description: string | null; targetDurationMin: number | null; targetTSS: number | null; raceId: number | null } }
  | { ok: false; error: string } {
  const scheduledDate = String(body.scheduledDate ?? "");
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  if (!DATE_RE.test(scheduledDate)) return { ok: false, error: "Ongeldige datum" };
  if (!title) return { ok: false, error: "Titel ontbreekt" };
  const type = typeof body.type === "string" && body.type ? body.type.slice(0, 40) : "ride";
  const description =
    typeof body.description === "string" ? body.description.trim().slice(0, 2000) || null : null;
  const dur = body.targetDurationMin == null ? null : Number(body.targetDurationMin);
  if (dur != null && (!Number.isFinite(dur) || dur < 0 || dur > 1440))
    return { ok: false, error: "Ongeldige duur" };
  const tss = body.targetTSS == null ? null : Number(body.targetTSS);
  if (tss != null && (!Number.isFinite(tss) || tss < 0 || tss > 1000))
    return { ok: false, error: "Ongeldige doelbelasting" };
  const raceId = body.raceId == null ? null : Number(body.raceId);
  if (raceId != null && !Number.isInteger(raceId))
    return { ok: false, error: "Ongeldige wedstrijd" };
  return {
    ok: true,
    value: { scheduledDate, title, type, description, targetDurationMin: dur, targetTSS: tss, raceId },
  };
}

// Koppeling aan een wedstrijd is alleen echt als die wedstrijd van de sporter is.
async function verifyRace(athleteId: string, raceId: number | null): Promise<boolean> {
  if (raceId == null) return true;
  const [race] = await db
    .select({ id: racesTable.id })
    .from(racesTable)
    .where(and(eq(racesTable.id, raceId), eq(racesTable.clerkId, athleteId)))
    .limit(1);
  return Boolean(race);
}

// POST nieuwe coachtraining voor één sporter.
router.post("/athletes/:athleteId/workouts", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  if (!(await requireCoach(coachId, res))) return;
  const athleteId = String(req.params.athleteId);
  const parsed = parseWorkoutInput((req.body ?? {}) as WorkoutInput);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  try {
    if (!(await gateAthlete(coachId, athleteId, res))) return;
    if (!(await verifyRace(athleteId, parsed.value.raceId))) {
      res.status(400).json({ error: "Wedstrijd niet gevonden bij deze sporter" });
      return;
    }
    const { raceId, ...fields } = parsed.value;
    const [workout] = await db
      .insert(plannedWorkoutsTable)
      .values({
        clerkId: athleteId,
        ...fields,
        status: "planned",
        source: "coach",
        coachClerkId: coachId,
        structure: raceId != null ? { raceId } : null,
      })
      .returning();
    void writeAudit({
      event: "changed_by_coach",
      actorClerkId: coachId,
      subjectClerkId: athleteId,
      meta: { rol: "coach", wat: "training_toegevoegd", datum: fields.scheduledDate },
      req,
    });
    res.status(201).json({ workout });
  } catch (err) {
    req.log.error({ err }, "coach.workouts.create failed");
    res.status(500).json({ error: "Kon training niet toevoegen" });
  }
});

// PUT wijzig/verplaats/annuleer een COACH-training. Sparki-trainingen zijn hier
// bewust niet aanpasbaar: dat blijft het domein van de sporter en Sparki.
router.put(
  "/athletes/:athleteId/workouts/:workoutId",
  requireAuth,
  async (req, res) => {
    const coachId = getClerkUserId(req)!;
    if (!(await requireCoach(coachId, res))) return;
    const athleteId = String(req.params.athleteId);
    const workoutId = Number(req.params.workoutId);
    if (!Number.isInteger(workoutId)) {
      res.status(400).json({ error: "Ongeldige training" });
      return;
    }
    const body = (req.body ?? {}) as WorkoutInput & { status?: unknown };
    try {
      if (!(await gateAthlete(coachId, athleteId, res))) return;
      const [current] = await db
        .select({
          id: plannedWorkoutsTable.id,
          source: plannedWorkoutsTable.source,
          coachClerkId: plannedWorkoutsTable.coachClerkId,
        })
        .from(plannedWorkoutsTable)
        .where(
          and(
            eq(plannedWorkoutsTable.id, workoutId),
            eq(plannedWorkoutsTable.clerkId, athleteId),
          ),
        );
      if (!current) {
        res.status(404).json({ error: "Training niet gevonden" });
        return;
      }
      // Cross-coach isolatie: alleen de coach die de training aanmaakte mag
      // wijzigen. Rijen van vóór de coach_clerk_id-kolom (null) blijven voor
      // elke gekoppelde coach aanpasbaar (legacy).
      if (
        current.source !== "coach" ||
        (current.coachClerkId != null && current.coachClerkId !== coachId)
      ) {
        res.status(403).json({ error: "Alleen je eigen coachtrainingen kun je aanpassen" });
        return;
      }

      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (body.scheduledDate != null) {
        if (!DATE_RE.test(String(body.scheduledDate))) {
          res.status(400).json({ error: "Ongeldige datum" });
          return;
        }
        set.scheduledDate = String(body.scheduledDate);
      }
      if (typeof body.title === "string" && body.title.trim())
        set.title = body.title.trim().slice(0, 200);
      if (typeof body.description === "string")
        set.description = body.description.trim().slice(0, 2000) || null;
      if (typeof body.type === "string" && body.type) set.type = body.type.slice(0, 40);
      if (body.targetDurationMin != null) {
        const n = Number(body.targetDurationMin);
        if (!Number.isFinite(n) || n < 0 || n > 1440) {
          res.status(400).json({ error: "Ongeldige duur" });
          return;
        }
        set.targetDurationMin = n;
      }
      if (body.targetTSS != null) {
        const n = Number(body.targetTSS);
        if (!Number.isFinite(n) || n < 0 || n > 1000) {
          res.status(400).json({ error: "Ongeldige doelbelasting" });
          return;
        }
        set.targetTSS = n;
      }
      if (body.status != null) {
        const s = String(body.status);
        if (!["planned", "cancelled"].includes(s)) {
          res.status(400).json({ error: "Ongeldige status" });
          return;
        }
        set.status = s;
      }

      const [updated] = await db
        .update(plannedWorkoutsTable)
        .set(set)
        .where(eq(plannedWorkoutsTable.id, workoutId))
        .returning();
      void writeAudit({
        event: "changed_by_coach",
        actorClerkId: coachId,
        subjectClerkId: athleteId,
        meta: { rol: "coach", wat: "training_gewijzigd", trainingId: workoutId },
        req,
      });
      res.json({ workout: updated });
    } catch (err) {
      req.log.error({ err }, "coach.workouts.update failed");
      res.status(500).json({ error: "Kon training niet wijzigen" });
    }
  },
);

// POST herhaal een coachtraining op extra datums (zelfde inhoud).
router.post(
  "/athletes/:athleteId/workouts/:workoutId/repeat",
  requireAuth,
  async (req, res) => {
    const coachId = getClerkUserId(req)!;
    if (!(await requireCoach(coachId, res))) return;
    const athleteId = String(req.params.athleteId);
    const workoutId = Number(req.params.workoutId);
    const dates = Array.from(
      new Set(
        ((req.body?.dates as unknown[]) ?? [])
          .map((d) => String(d))
          .filter((d) => DATE_RE.test(d)),
      ),
    ).slice(0, 20);
    if (!Number.isInteger(workoutId) || dates.length === 0) {
      res.status(400).json({ error: "Geef minstens één geldige datum" });
      return;
    }
    try {
      if (!(await gateAthlete(coachId, athleteId, res))) return;
      const [source] = await db
        .select()
        .from(plannedWorkoutsTable)
        .where(
          and(
            eq(plannedWorkoutsTable.id, workoutId),
            eq(plannedWorkoutsTable.clerkId, athleteId),
            eq(plannedWorkoutsTable.source, "coach"),
          ),
        );
      if (
        !source ||
        (source.coachClerkId != null && source.coachClerkId !== coachId)
      ) {
        res.status(404).json({ error: "Coachtraining niet gevonden" });
        return;
      }
      const created: number[] = [];
      for (const date of dates) {
        const [row] = await db
          .insert(plannedWorkoutsTable)
          .values({
            clerkId: athleteId,
            scheduledDate: date,
            title: source.title,
            type: source.type,
            description: source.description,
            targetDurationMin: source.targetDurationMin,
            targetTSS: source.targetTSS,
            structure: source.structure,
            status: "planned",
            source: "coach",
            coachClerkId: coachId,
          })
          .returning({ id: plannedWorkoutsTable.id });
        if (row) created.push(row.id);
      }
      void writeAudit({
        event: "changed_by_coach",
        actorClerkId: coachId,
        subjectClerkId: athleteId,
        meta: { rol: "coach", wat: "training_herhaald", aantal: created.length },
        req,
      });
      res.status(201).json({ created });
    } catch (err) {
      req.log.error({ err }, "coach.workouts.repeat failed");
      res.status(500).json({ error: "Kon training niet herhalen" });
    }
  },
);

// POST /workouts/bulk — dezelfde training voor meerdere sporters tegelijk.
// Per sporter gelden de normale toestemmingsgates; wie niet deelt wordt eerlijk
// overgeslagen met reden.
router.post("/workouts/bulk", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  if (!(await requireCoach(coachId, res))) return;
  const body = (req.body ?? {}) as { athleteClerkIds?: unknown } & WorkoutInput;
  const athleteIds = Array.from(
    new Set(
      (Array.isArray(body.athleteClerkIds) ? body.athleteClerkIds : [])
        .map((x) => String(x))
        .filter(Boolean),
    ),
  ).slice(0, 50);
  const parsed = parseWorkoutInput(body);
  if (!parsed.ok || athleteIds.length === 0) {
    res.status(400).json({
      error: parsed.ok ? "Selecteer minstens één sporter" : parsed.error,
    });
    return;
  }
  try {
    const created: string[] = [];
    const skipped: Array<{ athleteClerkId: string; reason: string }> = [];
    for (const athleteId of athleteIds) {
      if (!(await hasAcceptedCoachLink(coachId, athleteId))) {
        skipped.push({ athleteClerkId: athleteId, reason: "geen_koppeling" });
        continue;
      }
      if ((await coachSharingLevel(athleteId)) === "none") {
        skipped.push({ athleteClerkId: athleteId, reason: "deelt_niet" });
        continue;
      }
      const { raceId: _raceId, ...fields } = parsed.value;
      await db.insert(plannedWorkoutsTable).values({
        clerkId: athleteId,
        ...fields,
        status: "planned",
        source: "coach",
        coachClerkId: coachId,
      });
      created.push(athleteId);
    }
    void writeAudit({
      event: "changed_by_coach",
      actorClerkId: coachId,
      meta: { rol: "coach", wat: "bulk_training", aantal: created.length },
      req,
    });
    res.status(201).json({ created, skipped });
  } catch (err) {
    req.log.error({ err }, "coach.workouts.bulk failed");
    res.status(500).json({ error: "Kon bulk-planning niet uitvoeren" });
  }
});

// ── Sparki-wijzigingsvoorstellen op coachtrainingen ─────────────────────────
// Sparki past een coachtraining NOOIT zelf aan; een voorstel blijft open tot de
// coach beslist. "accepteren" past het voorstel toe, "aanpassen" past de door de
// coach gecorrigeerde velden toe, "afwijzen"/"parkeren" registreren alleen.

router.get("/athletes/:athleteId/proposals", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  if (!(await requireCoach(coachId, res))) return;
  const athleteId = String(req.params.athleteId);
  try {
    if (!(await gateAthlete(coachId, athleteId, res))) return;
    // Cross-coach isolatie: alleen voorstellen op trainingen van DEZE coach
    // (of legacy-rijen zonder coach_clerk_id).
    const proposals = await db
      .select({ proposal: coachChangeProposalsTable })
      .from(coachChangeProposalsTable)
      .innerJoin(
        plannedWorkoutsTable,
        eq(coachChangeProposalsTable.workoutId, plannedWorkoutsTable.id),
      )
      .where(
        and(
          eq(coachChangeProposalsTable.athleteClerkId, athleteId),
          or(
            isNull(plannedWorkoutsTable.coachClerkId),
            eq(plannedWorkoutsTable.coachClerkId, coachId),
          ),
        ),
      )
      .orderBy(desc(coachChangeProposalsTable.createdAt))
      .limit(50)
      .then((rows) => rows.map((r) => r.proposal));
    res.json({ proposals });
  } catch (err) {
    req.log.error({ err }, "coach.proposals.list failed");
    res.status(500).json({ error: "Kon voorstellen niet laden" });
  }
});

function sanitizeChanges(raw: unknown): CoachProposalChanges | null {
  if (raw == null || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const out: CoachProposalChanges = {};
  if (typeof c.title === "string" && c.title.trim()) out.title = c.title.trim().slice(0, 200);
  if (typeof c.scheduledDate === "string" && DATE_RE.test(c.scheduledDate))
    out.scheduledDate = c.scheduledDate;
  if (c.targetDurationMin != null) {
    const n = Number(c.targetDurationMin);
    if (Number.isFinite(n) && n >= 0 && n <= 1440) out.targetDurationMin = n;
  }
  if (c.targetTSS != null) {
    const n = Number(c.targetTSS);
    if (Number.isFinite(n) && n >= 0 && n <= 1000) out.targetTSS = n;
  }
  if (typeof c.intensity === "string" && c.intensity.trim())
    out.intensity = c.intensity.trim().slice(0, 60);
  if (c.cancel === true) out.cancel = true;
  return Object.keys(out).length > 0 ? out : null;
}

router.post("/proposals/:proposalId/decision", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  if (!(await requireCoach(coachId, res))) return;
  const proposalId = Number(req.params.proposalId);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const action = String(body.action ?? "") as CoachSignalAction;
  const note =
    typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;
  if (!Number.isInteger(proposalId) || !COACH_SIGNAL_ACTIONS.includes(action)) {
    res.status(400).json({ error: "Ongeldig besluit" });
    return;
  }
  if (action === "afwijzen" && !note) {
    res.status(400).json({ error: "Geef een reden bij afwijzen." });
    return;
  }
  try {
    const [proposal] = await db
      .select()
      .from(coachChangeProposalsTable)
      .where(eq(coachChangeProposalsTable.id, proposalId));
    if (!proposal) {
      res.status(404).json({ error: "Voorstel niet gevonden" });
      return;
    }
    if (!(await gateAthlete(coachId, proposal.athleteClerkId, res))) return;
    if (proposal.status !== "open" && proposal.status !== "geparkeerd") {
      res.status(409).json({ error: "Voorstel is al afgehandeld" });
      return;
    }
    // Cross-coach isolatie: alleen de coach van de betreffende training mag
    // over dit voorstel beslissen (legacy-rijen zonder eigenaar uitgezonderd).
    const [owned] = await db
      .select({ coachClerkId: plannedWorkoutsTable.coachClerkId })
      .from(plannedWorkoutsTable)
      .where(eq(plannedWorkoutsTable.id, proposal.workoutId));
    if (owned && owned.coachClerkId != null && owned.coachClerkId !== coachId) {
      res.status(403).json({ error: "Dit voorstel hoort bij een training van een andere coach" });
      return;
    }

    let applied = false;
    if (action === "accepteren" || action === "aanpassen") {
      const changes =
        action === "aanpassen"
          ? sanitizeChanges(body.changes)
          : proposal.changes;
      if (!changes) {
        res.status(400).json({ error: "Geef aan wat je aanpast." });
        return;
      }
      const [workout] = await db
        .select({ id: plannedWorkoutsTable.id, source: plannedWorkoutsTable.source, structure: plannedWorkoutsTable.structure })
        .from(plannedWorkoutsTable)
        .where(
          and(
            eq(plannedWorkoutsTable.id, proposal.workoutId),
            eq(plannedWorkoutsTable.clerkId, proposal.athleteClerkId),
          ),
        );
      if (!workout) {
        res.status(409).json({ error: "De training bestaat niet meer" });
        return;
      }
      const set: Record<string, unknown> = { updatedAt: new Date() };
      if (changes.title) set.title = changes.title;
      if (changes.scheduledDate) set.scheduledDate = changes.scheduledDate;
      if (changes.targetDurationMin != null) set.targetDurationMin = changes.targetDurationMin;
      if (changes.targetTSS != null) set.targetTSS = changes.targetTSS;
      if (changes.cancel) set.status = "cancelled";
      if (changes.intensity) {
        const s = (workout.structure ?? {}) as Record<string, unknown>;
        set.structure = { ...s, intensity: changes.intensity };
      }
      await db
        .update(plannedWorkoutsTable)
        .set(set)
        .where(eq(plannedWorkoutsTable.id, proposal.workoutId));
      applied = true;
    }

    const status =
      action === "accepteren"
        ? "geaccepteerd"
        : action === "aanpassen"
          ? "aangepast"
          : action === "afwijzen"
            ? "afgewezen"
            : "geparkeerd";
    const [updated] = await db
      .update(coachChangeProposalsTable)
      .set({ status, coachNote: note, decidedBy: coachId, decidedAt: new Date() })
      .where(eq(coachChangeProposalsTable.id, proposalId))
      .returning();
    void writeAudit({
      event: "changed_by_coach",
      actorClerkId: coachId,
      subjectClerkId: proposal.athleteClerkId,
      meta: { rol: "coach", wat: "voorstelbesluit", besluit: action, voorstelId: proposalId },
      req,
    });
    res.json({ proposal: updated, applied });
  } catch (err) {
    req.log.error({ err }, "coach.proposal-decision failed");
    res.status(500).json({ error: "Besluit opslaan mislukt" });
  }
});

// ── Communicatie coach ↔ sporter ─────────────────────────────────────────────
// Compact en gekoppeld aan de context (training/activiteit/signaal). Berichten
// vereisen alleen een geaccepteerde koppeling: praten kan altijd, ook als de
// sporter (tijdelijk) geen data deelt.

function parseMessageBody(body: Record<string, unknown>) {
  const text = typeof body.body === "string" ? body.body.trim().slice(0, 1000) : "";
  const subjectType = COACH_MESSAGE_SUBJECTS.includes(
    String(body.subjectType ?? "algemeen") as CoachMessageSubject,
  )
    ? (String(body.subjectType ?? "algemeen") as CoachMessageSubject)
    : "algemeen";
  const subjectId =
    body.subjectId == null ? null : Number.isInteger(Number(body.subjectId)) ? Number(body.subjectId) : null;
  const subjectKey =
    typeof body.subjectKey === "string" ? body.subjectKey.slice(0, 200) || null : null;
  return { text, subjectType, subjectId, subjectKey };
}

// Coachkant: berichten met één sporter.
router.get("/athletes/:athleteId/messages", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  if (!(await requireCoach(coachId, res))) return;
  const athleteId = String(req.params.athleteId);
  try {
    if (!(await hasAcceptedCoachLink(coachId, athleteId))) {
      res.status(403).json({ error: "Geen gekoppelde atleet" });
      return;
    }
    const messages = await db
      .select()
      .from(coachMessagesTable)
      .where(
        and(
          eq(coachMessagesTable.coachClerkId, coachId),
          eq(coachMessagesTable.athleteClerkId, athleteId),
        ),
      )
      .orderBy(asc(coachMessagesTable.createdAt))
      .limit(200);
    // Inkomend (van de sporter) markeren als gelezen.
    await db
      .update(coachMessagesTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(coachMessagesTable.coachClerkId, coachId),
          eq(coachMessagesTable.athleteClerkId, athleteId),
          eq(coachMessagesTable.senderClerkId, athleteId),
          isNull(coachMessagesTable.readAt),
        ),
      );
    res.json({ messages });
  } catch (err) {
    req.log.error({ err }, "coach.messages.list failed");
    res.status(500).json({ error: "Kon berichten niet laden" });
  }
});

router.post("/athletes/:athleteId/messages", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  if (!(await requireCoach(coachId, res))) return;
  const athleteId = String(req.params.athleteId);
  const { text, subjectType, subjectId, subjectKey } = parseMessageBody(
    (req.body ?? {}) as Record<string, unknown>,
  );
  if (!text) {
    res.status(400).json({ error: "Bericht is leeg" });
    return;
  }
  try {
    if (!(await hasAcceptedCoachLink(coachId, athleteId))) {
      res.status(403).json({ error: "Geen gekoppelde atleet" });
      return;
    }
    const [message] = await db
      .insert(coachMessagesTable)
      .values({
        coachClerkId: coachId,
        athleteClerkId: athleteId,
        senderClerkId: coachId,
        body: text,
        subjectType,
        subjectId,
        subjectKey,
      })
      .returning();
    res.status(201).json({ message });
  } catch (err) {
    req.log.error({ err }, "coach.messages.create failed");
    res.status(500).json({ error: "Kon bericht niet versturen" });
  }
});

// Sporterkant: eigen berichten per coach lezen en beantwoorden.
router.get("/messages", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const messages = await db
      .select()
      .from(coachMessagesTable)
      .where(eq(coachMessagesTable.athleteClerkId, clerkId))
      .orderBy(asc(coachMessagesTable.createdAt))
      .limit(200);
    const coachIds = Array.from(new Set(messages.map((m) => m.coachClerkId)));
    const names = coachIds.length
      ? await db
          .select({
            clerkId: userProfilesTable.clerkId,
            displayName: userProfilesTable.displayName,
          })
          .from(userProfilesTable)
          .where(inArray(userProfilesTable.clerkId, coachIds))
      : [];
    // Inkomend (van de coach) markeren als gelezen. Bij nul berichten is er
    // niets te markeren (lege or(...) zou ongeldige SQL geven).
    if (coachIds.length > 0) {
      await db
        .update(coachMessagesTable)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(coachMessagesTable.athleteClerkId, clerkId),
            isNull(coachMessagesTable.readAt),
            inArray(coachMessagesTable.senderClerkId, coachIds),
          ),
        );
    }
    res.json({
      messages,
      coaches: Object.fromEntries(names.map((n) => [n.clerkId, n.displayName])),
    });
  } catch (err) {
    req.log.error({ err }, "coach.messages.mine failed");
    res.status(500).json({ error: "Kon berichten niet laden" });
  }
});

router.post("/messages/reply", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const coachClerkId = String(body.coachClerkId ?? "");
  const { text, subjectType, subjectId, subjectKey } = parseMessageBody(body);
  if (!coachClerkId || !text) {
    res.status(400).json({ error: "Bericht of coach ontbreekt" });
    return;
  }
  try {
    if (!(await hasAcceptedCoachLink(coachClerkId, clerkId))) {
      res.status(403).json({ error: "Geen gekoppelde coach" });
      return;
    }
    const [message] = await db
      .insert(coachMessagesTable)
      .values({
        coachClerkId,
        athleteClerkId: clerkId,
        senderClerkId: clerkId,
        body: text,
        subjectType,
        subjectId,
        subjectKey,
      })
      .returning();
    res.status(201).json({ message });
  } catch (err) {
    req.log.error({ err }, "coach.messages.reply failed");
    res.status(500).json({ error: "Kon bericht niet versturen" });
  }
});

// ── Coachcontext (blessure-afspraak, school/werk, beperking, wedstrijddoel,
// tijdelijke instructie) ─────────────────────────────────────────────────────

router.get("/athletes/:athleteId/context-items", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  if (!(await requireCoach(coachId, res))) return;
  const athleteId = String(req.params.athleteId);
  try {
    if (!(await gateAthlete(coachId, athleteId, res))) return;
    const items = await db
      .select()
      .from(coachContextItemsTable)
      .where(
        and(
          eq(coachContextItemsTable.coachClerkId, coachId),
          eq(coachContextItemsTable.athleteClerkId, athleteId),
        ),
      )
      .orderBy(desc(coachContextItemsTable.updatedAt));
    res.json({ items });
  } catch (err) {
    req.log.error({ err }, "coach.context.list failed");
    res.status(500).json({ error: "Kon context niet laden" });
  }
});

router.post("/athletes/:athleteId/context-items", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  if (!(await requireCoach(coachId, res))) return;
  const athleteId = String(req.params.athleteId);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const kind = String(body.kind ?? "") as CoachContextKind;
  const text = typeof body.body === "string" ? body.body.trim().slice(0, 1000) : "";
  const startDate =
    typeof body.startDate === "string" && DATE_RE.test(body.startDate) ? body.startDate : null;
  const endDate =
    typeof body.endDate === "string" && DATE_RE.test(body.endDate) ? body.endDate : null;
  if (!COACH_CONTEXT_KINDS.includes(kind) || !text) {
    res.status(400).json({ error: "Soort of tekst ontbreekt" });
    return;
  }
  try {
    if (!(await gateAthlete(coachId, athleteId, res))) return;
    const [item] = await db
      .insert(coachContextItemsTable)
      .values({ coachClerkId: coachId, athleteClerkId: athleteId, kind, body: text, startDate, endDate })
      .returning();
    void writeAudit({
      event: "changed_by_coach",
      actorClerkId: coachId,
      subjectClerkId: athleteId,
      meta: { rol: "coach", wat: "context_toegevoegd", soort: kind },
      req,
    });
    res.status(201).json({ item });
  } catch (err) {
    req.log.error({ err }, "coach.context.create failed");
    res.status(500).json({ error: "Kon context niet opslaan" });
  }
});

router.put("/context-items/:itemId", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  if (!(await requireCoach(coachId, res))) return;
  const itemId = Number(req.params.itemId);
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (!Number.isInteger(itemId)) {
    res.status(400).json({ error: "Ongeldig item" });
    return;
  }
  try {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.body === "string" && body.body.trim())
      set.body = body.body.trim().slice(0, 1000);
    if (typeof body.endDate === "string" && DATE_RE.test(body.endDate))
      set.endDate = body.endDate;
    if (body.endDate === null) set.endDate = null;
    const [item] = await db
      .update(coachContextItemsTable)
      .set(set)
      .where(
        and(
          eq(coachContextItemsTable.id, itemId),
          eq(coachContextItemsTable.coachClerkId, coachId),
        ),
      )
      .returning();
    if (!item) {
      res.status(404).json({ error: "Item niet gevonden" });
      return;
    }
    res.json({ item });
  } catch (err) {
    req.log.error({ err }, "coach.context.update failed");
    res.status(500).json({ error: "Kon context niet wijzigen" });
  }
});

router.delete("/context-items/:itemId", requireAuth, async (req, res) => {
  const coachId = getClerkUserId(req)!;
  if (!(await requireCoach(coachId, res))) return;
  const itemId = Number(req.params.itemId);
  if (!Number.isInteger(itemId)) {
    res.status(400).json({ error: "Ongeldig item" });
    return;
  }
  try {
    const [item] = await db
      .delete(coachContextItemsTable)
      .where(
        and(
          eq(coachContextItemsTable.id, itemId),
          eq(coachContextItemsTable.coachClerkId, coachId),
        ),
      )
      .returning({ id: coachContextItemsTable.id });
    if (!item) {
      res.status(404).json({ error: "Item niet gevonden" });
      return;
    }
    res.json({ deleted: item.id });
  } catch (err) {
    req.log.error({ err }, "coach.context.delete failed");
    res.status(500).json({ error: "Kon context niet verwijderen" });
  }
});

// Sporterkant (transparantie): welke context hebben mijn coaches over mij
// vastgelegd — altijd zichtbaar voor de sporter zelf.
router.get("/context-items/about-me", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const items = await db
      .select()
      .from(coachContextItemsTable)
      .where(eq(coachContextItemsTable.athleteClerkId, clerkId))
      .orderBy(desc(coachContextItemsTable.updatedAt));
    res.json({ items });
  } catch (err) {
    req.log.error({ err }, "coach.context.about-me failed");
    res.status(500).json({ error: "Kon context niet laden" });
  }
});

export default router;
