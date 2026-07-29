// Doelen-engine — deterministic multi-year goal picture with daily monitoring.
//
// The athlete's goal picture = manual goals (athlete_goals) + DERIVED goals from
// sources that already exist (A/B races, developmentGoal, nutrition season
// goal) — never duplicated, never re-asked. Progress per goal is judged
// deterministically on real data (load trend, done-vs-planned workouts, health
// status, race results); what cannot be measured is said plainly. Monthly (and
// on-demand) the engine proposes adjustments; NOTHING changes without the
// athlete's confirmation. Every change is recorded as a goal_events row.

import { and, asc, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import {
  db,
  athleteGoalsTable,
  goalEventsTable,
  goalProposalsTable,
  athleteProfilesTable,
  racesTable,
  trainingSessionsTable,
  plannedWorkoutsTable,
  nutritionSeasonGoalsTable,
  goalStatuses,
  goalHorizons,
  type AthleteGoal,
  type GoalProposal,
  type GoalHorizon,
  type GoalStatus,
} from "@workspace/db";
import { computeLoad, type Load } from "./recovery-load";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ProgressVerdict =
  | "op_koers"
  | "aandacht"
  | "risico"
  | "niet_meetbaar";

export type GoalProgress = {
  verdict: ProgressVerdict;
  /** Plain-Dutch reasons behind the verdict — always real data. */
  reasons: string[];
  /** What Sparki cannot measure for this goal (honest gaps). */
  gaps: string[];
  /** Days until targetDate; null when no date is set. */
  daysToTarget: number | null;
};

export type DerivedGoal = {
  derivedId: string; // stable id, e.g. "race:12", "development", "season_weight"
  source: "race" | "development_goal" | "nutrition_season";
  title: string;
  targetDate: string | null;
  detail: string | null;
  priority: number; // A race = 1, B = 2, rest = 3
  progress: GoalProgress;
};

export type GoalWithProgress = AthleteGoal & { progress: GoalProgress };

export type GoalQuestion = {
  key: string;
  question: string;
  /** Which goal it concerns (manual goal id), null for picture-level questions. */
  goalId: number | null;
};

export type GoalPicture = {
  goals: GoalWithProgress[];
  derived: DerivedGoal[];
  proposals: GoalProposal[];
  nextQuestion: GoalQuestion | null;
};

// ── Shared measurement context ────────────────────────────────────────────────

export type MeasureContext = {
  load: Load;
  prevLoad: Load; // load as of ~28 days ago, for CTL trend
  doneCount14: number;
  plannedCount14: number;
  healthStatus: string;
  todayIso: string;
};

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split("T")[0]!;
}

function nlToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
  }).format(new Date());
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + "T00:00:00Z").getTime();
  const b = new Date(toIso + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86_400_000);
}

async function buildMeasureContext(clerkId: string): Promise<MeasureContext> {
  const since = isoDaysAgo(120);
  const [sessions, planned, [profile]] = await Promise.all([
    db
      .select({
        sessionDate: trainingSessionsTable.sessionDate,
        tss: trainingSessionsTable.tss,
      })
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.clerkId, clerkId),
          gte(trainingSessionsTable.sessionDate, since),
        ),
      ),
    db
      .select({
        scheduledDate: plannedWorkoutsTable.scheduledDate,
        status: plannedWorkoutsTable.status,
        type: plannedWorkoutsTable.type,
      })
      .from(plannedWorkoutsTable)
      .where(
        and(
          eq(plannedWorkoutsTable.clerkId, clerkId),
          gte(plannedWorkoutsTable.scheduledDate, isoDaysAgo(14)),
        ),
      ),
    db
      .select({ healthStatus: athleteProfilesTable.healthStatus })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId)),
  ]);

  const todayIso = nlToday();
  const load = computeLoad(sessions);
  // CTL trend: recompute over sessions up to 28 days ago.
  const cutoff = isoDaysAgo(28);
  const prevLoad = computeLoad(sessions.filter((s) => s.sessionDate <= cutoff));

  const pastPlanned = planned.filter(
    (p) => p.scheduledDate <= todayIso && p.type !== "rest",
  );
  const done = pastPlanned.filter((p) => p.status === "completed").length;
  const sessionDates = new Set(sessions.map((s) => s.sessionDate));
  // A planned day with a real ridden session on the same date also counts as done.
  const doneViaSession = pastPlanned.filter(
    (p) => p.status !== "completed" && sessionDates.has(p.scheduledDate),
  ).length;

  return {
    load,
    prevLoad,
    doneCount14: done + doneViaSession,
    plannedCount14: pastPlanned.length,
    healthStatus: profile?.healthStatus ?? "ok",
    todayIso,
  };
}

// ── Deterministic progress judgement ─────────────────────────────────────────

export function judgeProgress(
  ctx: MeasureContext,
  targetDate: string | null,
  measure: string | null,
): GoalProgress {
  const reasons: string[] = [];
  const gaps: string[] = [];
  let score = 0; // + = on course, − = risk
  let measurable = false;

  const daysToTarget = targetDate ? daysBetween(ctx.todayIso, targetDate) : null;

  // Health first — a real injury/illness is always relevant.
  if (ctx.healthStatus === "injured") {
    reasons.push("Je hebt een blessure aangegeven — dat raakt dit doel direct.");
    score -= 2;
    measurable = true;
  } else if (ctx.healthStatus === "sick") {
    reasons.push("Je bent ziek gemeld — even pas op de plaats.");
    score -= 1;
    measurable = true;
  }

  // Load trend (CTL) — only when there is a real base.
  if (ctx.load.ctl >= 5 || ctx.prevLoad.ctl >= 5) {
    measurable = true;
    const delta = ctx.load.ctl - ctx.prevLoad.ctl;
    if (delta >= 3) {
      reasons.push(
        `Je belastbaarheid stijgt (van ${ctx.prevLoad.ctl} naar ${ctx.load.ctl} in vier weken).`,
      );
      score += 1;
    } else if (delta <= -3) {
      reasons.push(
        `Je belastbaarheid daalt (van ${ctx.prevLoad.ctl} naar ${ctx.load.ctl} in vier weken).`,
      );
      score -= 1;
    } else {
      reasons.push(`Je belastbaarheid is stabiel (rond ${ctx.load.ctl}).`);
    }
  } else {
    gaps.push(
      "Te weinig trainingen met belastingsscore om een belastingstrend te meten.",
    );
  }

  // Plan execution over the last 14 days.
  if (ctx.plannedCount14 >= 3) {
    measurable = true;
    const ratio = ctx.doneCount14 / ctx.plannedCount14;
    if (ratio >= 0.75) {
      reasons.push(
        `Je voerde ${ctx.doneCount14} van ${ctx.plannedCount14} geplande trainingen uit de afgelopen twee weken.`,
      );
      score += 1;
    } else if (ratio < 0.5) {
      reasons.push(
        `Slechts ${ctx.doneCount14} van ${ctx.plannedCount14} geplande trainingen uitgevoerd in twee weken.`,
      );
      score -= 1;
    } else {
      reasons.push(
        `${ctx.doneCount14} van ${ctx.plannedCount14} geplande trainingen uitgevoerd.`,
      );
    }
  } else {
    gaps.push("Geen of weinig gepland schema in de afgelopen twee weken.");
  }

  if (!measure) {
    gaps.push(
      "Geen meetlat vastgelegd voor dit doel — voortgang blijft een inschatting op trainingsdata.",
    );
  }

  if (!measurable) {
    return { verdict: "niet_meetbaar", reasons, gaps, daysToTarget };
  }

  // Deadline pressure: negative signals weigh heavier close to the target.
  if (daysToTarget != null && daysToTarget >= 0 && daysToTarget <= 42 && score < 0) {
    reasons.push(`Nog ${daysToTarget} dagen tot de streefdatum.`);
    score -= 1;
  }

  const verdict: ProgressVerdict =
    score >= 1 ? "op_koers" : score <= -2 ? "risico" : "aandacht";
  return { verdict, reasons, gaps, daysToTarget };
}

// ── Derived goals (no duplication of existing sources) ───────────────────────

async function loadDerivedGoals(
  clerkId: string,
  ctx: MeasureContext,
): Promise<DerivedGoal[]> {
  const [races, [profile], [seasonGoal]] = await Promise.all([
    db
      .select()
      .from(racesTable)
      .where(
        and(
          eq(racesTable.clerkId, clerkId),
          gte(racesTable.raceDate, ctx.todayIso),
          inArray(racesTable.priority, ["A", "B", "C"]),
          // Geannuleerde wedstrijden leveren geen doelen meer op.
          ne(racesTable.status, "geannuleerd"),
        ),
      )
      .orderBy(asc(racesTable.raceDate))
      .limit(6),
    db
      .select({
        developmentGoal: athleteProfilesTable.developmentGoal,
        goals: athleteProfilesTable.goals,
      })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId)),
    db
      .select()
      .from(nutritionSeasonGoalsTable)
      .where(eq(nutritionSeasonGoalsTable.clerkId, clerkId)),
  ]);

  const derived: DerivedGoal[] = [];

  for (const race of races) {
    derived.push({
      derivedId: `race:${race.id}`,
      source: "race",
      title: `${race.priority}-wedstrijd: ${race.name}`,
      targetDate: race.raceDate,
      detail: race.location ?? null,
      priority: race.priority === "A" ? 1 : race.priority === "B" ? 2 : 3,
      progress: judgeProgress(ctx, race.raceDate, null),
    });
  }

  if (profile?.developmentGoal) {
    const label =
      profile.developmentGoal === "persoonlijk" && profile.goals?.trim()
        ? profile.goals.trim()
        : profile.developmentGoal;
    derived.push({
      derivedId: "development",
      source: "development_goal",
      title: `Ontwikkeldoel: ${label}`,
      targetDate: null,
      detail: null,
      priority: 2,
      progress: judgeProgress(ctx, null, null),
    });
  }

  if (
    seasonGoal &&
    (seasonGoal.peakDate || seasonGoal.targetWeightKg != null)
  ) {
    const parts: string[] = [];
    if (seasonGoal.targetWeightKg != null)
      parts.push(`streefgewicht ${String(seasonGoal.targetWeightKg).replace(".", ",")} kg`);
    if (seasonGoal.peakDate) parts.push(`piek op ${seasonGoal.peakDate}`);
    derived.push({
      derivedId: "season_weight",
      source: "nutrition_season",
      title: "Voeding-seizoensdoel",
      targetDate: seasonGoal.peakDate,
      detail: parts.join(", ") || null,
      priority: 3,
      progress: judgeProgress(ctx, seasonGoal.peakDate, "gewicht"),
    });
  }

  return derived;
}

// ── Doorvraagladder — one targeted question at a time ────────────────────────

export function nextGoalQuestion(
  goals: GoalWithProgress[],
  derived: DerivedGoal[],
  healthStatus: string,
): GoalQuestion | null {
  const active = goals.filter((g) => g.status === "active");

  // 1. Injury and an active goal with a nearby deadline → is it still feasible?
  if (healthStatus === "injured" || healthStatus === "sick") {
    const hit = active.find(
      (g) =>
        g.targetDate != null &&
        g.progress.daysToTarget != null &&
        g.progress.daysToTarget >= 0 &&
        g.progress.daysToTarget <= 120,
    );
    if (hit) {
      return {
        key: `injury_feasible:${hit.id}`,
        question: `Blijft "${hit.title}" haalbaar nu je ${healthStatus === "injured" ? "geblesseerd" : "ziek"} bent, of stellen we bij?`,
        goalId: hit.id,
      };
    }
  }

  // 2. No main goal at all (manual), while there IS derived context → confirm it.
  const hasMain = active.some((g) => g.priority === 1);
  if (!hasMain) {
    if (derived.length > 0) {
      return {
        key: "confirm_main",
        question: `Is "${derived[0]!.title}" je hoofddoel voor dit seizoen, of werk je ergens anders naartoe?`,
        goalId: null,
      };
    }
    return {
      key: "ask_main",
      question:
        "Waar werk je op dit moment het hardst naartoe — dit seizoen of verder vooruit?",
      goalId: null,
    };
  }

  // 3. Active goal without a target date.
  const noDate = active.find((g) => !g.targetDate);
  if (noDate) {
    return {
      key: `ask_date:${noDate.id}`,
      question: `Wanneer wil je "${noDate.title}" bereikt hebben?`,
      goalId: noDate.id,
    };
  }

  // 4. Active goal without a measure.
  const noMeasure = active.find((g) => !g.measure);
  if (noMeasure) {
    return {
      key: `ask_measure:${noMeasure.id}`,
      question: `Waaraan merk je dat "${noMeasure.title}" gelukt is? Dan kan de voortgang echt gemeten worden.`,
      goalId: noMeasure.id,
    };
  }

  // 5. Passed target date but still active → achieved or adjust?
  const overdue = active.find(
    (g) => g.progress.daysToTarget != null && g.progress.daysToTarget < 0,
  );
  if (overdue) {
    return {
      key: `ask_overdue:${overdue.id}`,
      question: `De streefdatum van "${overdue.title}" is voorbij. Is het gelukt, of schuiven we het doel op?`,
      goalId: overdue.id,
    };
  }

  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function loadGoalPicture(clerkId: string): Promise<GoalPicture> {
  const ctx = await buildMeasureContext(clerkId);
  const [rows, derived, proposals] = await Promise.all([
    db
      .select()
      .from(athleteGoalsTable)
      .where(eq(athleteGoalsTable.clerkId, clerkId))
      .orderBy(asc(athleteGoalsTable.priority), asc(athleteGoalsTable.targetDate)),
    loadDerivedGoals(clerkId, ctx),
    db
      .select()
      .from(goalProposalsTable)
      .where(
        and(
          eq(goalProposalsTable.clerkId, clerkId),
          eq(goalProposalsTable.status, "open"),
        ),
      )
      .orderBy(desc(goalProposalsTable.createdAt)),
  ]);

  const goals: GoalWithProgress[] = rows.map((g) => ({
    ...g,
    progress:
      g.status === "active"
        ? judgeProgress(ctx, g.targetDate, g.measure)
        : {
            verdict: "niet_meetbaar",
            reasons: [],
            gaps: [],
            daysToTarget: g.targetDate
              ? daysBetween(ctx.todayIso, g.targetDate)
              : null,
          },
  }));

  return {
    goals,
    derived,
    proposals,
    nextQuestion: nextGoalQuestion(goals, derived, ctx.healthStatus),
  };
}

export function isValidHorizon(v: unknown): v is GoalHorizon {
  return typeof v === "string" && (goalHorizons as readonly string[]).includes(v);
}
export function isValidStatus(v: unknown): v is GoalStatus {
  return typeof v === "string" && (goalStatuses as readonly string[]).includes(v);
}

export async function recordGoalEvent(input: {
  clerkId: string;
  goalId: number;
  eventType: string;
  note?: string | null;
  payload?: unknown;
}): Promise<void> {
  await db.insert(goalEventsTable).values({
    clerkId: input.clerkId,
    goalId: input.goalId,
    eventType: input.eventType,
    note: input.note ?? null,
    payload: input.payload ?? null,
  });
}

// ── Daily reporting: one deterministic goal-progress summary ─────────────────

export type GoalDailySummary = {
  headline: string;
  lines: string[];
} | null;

/** Compose the daily goal-progress block for the coach analysis. Null when the
 * athlete has no goal picture at all (nothing to fabricate). */
export async function composeGoalDailySummary(
  clerkId: string,
): Promise<GoalDailySummary> {
  const picture = await loadGoalPicture(clerkId);
  const active = picture.goals.filter((g) => g.status === "active");
  const all = [
    ...active.map((g) => ({
      title: g.title,
      progress: g.progress,
      priority: g.priority,
    })),
    ...picture.derived.map((d) => ({
      title: d.title,
      progress: d.progress,
      priority: d.priority,
    })),
  ].sort((a, b) => a.priority - b.priority);

  if (all.length === 0) return null;

  const VERDICT_LABEL: Record<ProgressVerdict, string> = {
    op_koers: "op koers",
    aandacht: "vraagt aandacht",
    risico: "onder druk",
    niet_meetbaar: "nog niet meetbaar",
  };

  const risk = all.filter((g) => g.progress.verdict === "risico").length;
  const onCourse = all.filter((g) => g.progress.verdict === "op_koers").length;
  const headline =
    risk > 0
      ? `${risk} van je ${all.length} doelen staat onder druk.`
      : onCourse === all.length
        ? "Al je doelen liggen op koers."
        : "Je doelen liggen grotendeels op koers.";

  const lines = all
    .slice(0, 4)
    .map(
      (g) =>
        `${g.title}: ${VERDICT_LABEL[g.progress.verdict]}${
          g.progress.reasons[0] ? ` — ${g.progress.reasons[0]}` : ""
        }`,
    );

  return { headline, lines };
}

// ── Health-status reassessment ───────────────────────────────────────────────

/** Called when healthStatus changes to injured/sick: records an injury-impact
 * event on every active goal with a foreseeable deadline. Idempotent per day. */
export async function reassessGoalsOnHealthChange(
  clerkId: string,
  healthStatus: string,
): Promise<number> {
  if (healthStatus !== "injured" && healthStatus !== "sick") return 0;
  const today = nlToday();
  const active = await db
    .select()
    .from(athleteGoalsTable)
    .where(
      and(
        eq(athleteGoalsTable.clerkId, clerkId),
        eq(athleteGoalsTable.status, "active"),
      ),
    );

  let count = 0;
  for (const goal of active) {
    // Idempotent per Amsterdam calendar day: compare the event's LOCAL date,
    // not a UTC midnight boundary (which shifts around local midnight).
    const [existing] = await db
      .select({ id: goalEventsTable.id })
      .from(goalEventsTable)
      .where(
        and(
          eq(goalEventsTable.goalId, goal.id),
          eq(goalEventsTable.eventType, "injury_impact"),
          sql`(${goalEventsTable.createdAt} AT TIME ZONE 'Europe/Amsterdam')::date = ${today}::date`,
        ),
      )
      .limit(1);
    if (existing) continue;
    await recordGoalEvent({
      clerkId,
      goalId: goal.id,
      eventType: "injury_impact",
      note:
        healthStatus === "injured"
          ? "Blessure gemeld — haalbaarheid van dit doel wordt opnieuw bekeken."
          : "Ziekte gemeld — haalbaarheid van dit doel wordt opnieuw bekeken.",
      payload: { healthStatus },
    });
    count++;
  }
  return count;
}

// ── Monthly proposals ─────────────────────────────────────────────────────────

function periodKey(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
  })
    .format(d)
    .slice(0, 7);
}

export type ProposalBuildResult = { created: number; skipped: number };

export type ProposalCandidate = {
  goalId: number | null;
  kind: string;
  title: string;
  reasoning: string;
  proposedChange?: unknown;
};

/** Pure, deterministic candidate builder — separately testable. Decides WHICH
 * proposals this month's review produces; persists nothing. */
export function buildProposalCandidates(
  ctx: MeasureContext,
  active: Pick<AthleteGoal, "id" | "title" | "targetDate" | "measure">[],
  opts: {
    finished?: Pick<AthleteGoal, "title" | "status">[];
    seasonGoal?: { peakDate: string | null; targetWeightKg: unknown } | null;
  } = {},
): ProposalCandidate[] {
  const out: ProposalCandidate[] = [];

  for (const goal of active) {
    const progress = judgeProgress(ctx, goal.targetDate, goal.measure);

    if (progress.verdict === "risico") {
      if (ctx.healthStatus === "injured" || ctx.healthStatus === "sick") {
        // Recovery first + honest goal adjustment option.
        out.push({
          goalId: goal.id,
          kind: "recovery",
          title: `Herstel voorrang geven boven "${goal.title}"`,
          reasoning: `${progress.reasons.join(" ")} Eerst herstellen beschermt het doel op langere termijn — doortrainen vergroot de schade.`,
          proposedChange: { focus: "recovery" },
        });
        if (goal.targetDate) {
          const suggested = new Date(goal.targetDate + "T00:00:00Z");
          suggested.setUTCDate(suggested.getUTCDate() + 28);
          const newDate = suggested.toISOString().split("T")[0]!;
          out.push({
            goalId: goal.id,
            kind: "goal_adjust",
            title: `Streefdatum van "${goal.title}" vier weken opschuiven`,
            reasoning: `Met de huidige gezondheidssituatie is de oorspronkelijke datum (${goal.targetDate}) krap. Opschuiven naar ${newDate} houdt het doel haalbaar.`,
            proposedChange: { targetDate: newDate },
          });
        }
      } else if (
        ctx.plannedCount14 >= 3 &&
        ctx.doneCount14 / ctx.plannedCount14 < 0.5
      ) {
        out.push({
          goalId: goal.id,
          kind: "load",
          title: `Trainingsbelasting verlagen richting "${goal.title}"`,
          reasoning: `${progress.reasons.join(" ")} Een schema dat past bij je werkelijke week is beter dan een schema dat blijft liggen — liever minder gepland en wél uitgevoerd.`,
          proposedChange: { weeklyLoad: "verlagen" },
        });
      } else {
        out.push({
          goalId: goal.id,
          kind: "goal_adjust",
          title: `Doel "${goal.title}" bijstellen`,
          reasoning: `${progress.reasons.join(" ")} Bijstellen (datum of meetlat) houdt het doel geloofwaardig in plaats van demotiverend.`,
          proposedChange: null,
        });
      }
    }

    if (
      progress.verdict === "op_koers" &&
      ctx.load.ctl - ctx.prevLoad.ctl >= 5 &&
      goal.targetDate &&
      progress.daysToTarget != null &&
      progress.daysToTarget > 60
    ) {
      out.push({
        goalId: goal.id,
        kind: "load",
        title: `Ontwikkeling versnelt — belasting rond "${goal.title}" herijken`,
        reasoning: `Je belastbaarheid steeg van ${ctx.prevLoad.ctl} naar ${ctx.load.ctl} in vier weken en je doel ligt nog ${progress.daysToTarget} dagen weg. Het schema kan iets ambitieuzer, of het doel kan scherper.`,
        proposedChange: { weeklyLoad: "herijken" },
      });
    }
  }

  // Nutrition steering: only when a REAL season goal exists (17+ gated at its
  // source) with a peak within 90 days and execution is faltering or the load
  // trend is down — then training fueling deserves explicit attention.
  const sg = opts.seasonGoal;
  if (sg && sg.peakDate) {
    const daysToPeak = daysBetween(ctx.todayIso, sg.peakDate);
    const executionLow =
      ctx.plannedCount14 >= 3 && ctx.doneCount14 / ctx.plannedCount14 < 0.5;
    const loadDown =
      (ctx.load.ctl >= 5 || ctx.prevLoad.ctl >= 5) &&
      ctx.load.ctl - ctx.prevLoad.ctl <= -3;
    if (daysToPeak >= 0 && daysToPeak <= 90 && (executionLow || loadDown)) {
      out.push({
        goalId: null,
        kind: "nutrition",
        title: "Voeding rond trainingen aanscherpen richting je piek",
        reasoning: `Je piek is over ${daysToPeak} dagen en ${
          loadDown
            ? `je belastbaarheid daalt (van ${ctx.prevLoad.ctl} naar ${ctx.load.ctl}).`
            : `je voerde maar ${ctx.doneCount14} van ${ctx.plannedCount14} geplande trainingen uit.`
        } Trainingen volledig gevoed rijden beschermt je vorm én je seizoensdoel — nooit trainen op een leeg lichaam.`,
        proposedChange: { nutrition: "fuel_training" },
      });
    }
  }

  // Picture-level: a recently achieved/dropped goal → review the rest.
  const finished = opts.finished ?? [];
  if (finished.length > 0 && active.length > 0) {
    const f = finished[0]!;
    out.push({
      goalId: null,
      kind: "goal_review",
      title: "Overige doelen herzien",
      reasoning: `"${f.title}" is ${f.status === "achieved" ? "behaald" : "vervallen"}. Dat is een goed moment om te kijken of je overige doelen nog kloppen qua datum en ambitie.`,
      proposedChange: null,
    });
  }

  return out;
}

/** Build monthly adjustment proposals for one athlete. Deterministic, honest,
 * idempotent per goal+kind+month via dedupeKey. Nothing is applied here. */
export async function buildMonthlyProposals(
  clerkId: string,
): Promise<ProposalBuildResult> {
  const ctx = await buildMeasureContext(clerkId);
  const period = periodKey();
  const [active, finished, [seasonGoal]] = await Promise.all([
    db
      .select()
      .from(athleteGoalsTable)
      .where(
        and(
          eq(athleteGoalsTable.clerkId, clerkId),
          eq(athleteGoalsTable.status, "active"),
        ),
      ),
    db
      .select()
      .from(athleteGoalsTable)
      .where(
        and(
          eq(athleteGoalsTable.clerkId, clerkId),
          inArray(athleteGoalsTable.status, ["achieved", "dropped"]),
          gte(
            athleteGoalsTable.updatedAt,
            new Date(Date.now() - 35 * 86_400_000),
          ),
        ),
      ),
    db
      .select({
        peakDate: nutritionSeasonGoalsTable.peakDate,
        targetWeightKg: nutritionSeasonGoalsTable.targetWeightKg,
      })
      .from(nutritionSeasonGoalsTable)
      .where(eq(nutritionSeasonGoalsTable.clerkId, clerkId)),
  ]);

  let created = 0;
  let skipped = 0;

  const propose = async (input: ProposalCandidate) => {
    const dedupeKey = `goal:${input.goalId ?? "all"}:${input.kind}:${period}`;
    // Concurrency-safe idempotency: the unique index (clerk_id, dedupe_key)
    // is the real guard; onConflictDoNothing makes a duplicate run a no-op.
    const inserted = await db
      .insert(goalProposalsTable)
      .values({
        clerkId,
        goalId: input.goalId,
        kind: input.kind,
        title: input.title,
        reasoning: input.reasoning,
        proposedChange: input.proposedChange ?? null,
        dedupeKey,
      })
      .onConflictDoNothing({
        target: [goalProposalsTable.clerkId, goalProposalsTable.dedupeKey],
      })
      .returning({ id: goalProposalsTable.id });
    if (inserted.length === 0) {
      skipped++;
      return;
    }
    created++;
    if (input.goalId != null) {
      await recordGoalEvent({
        clerkId,
        goalId: input.goalId,
        eventType: "proposal_created",
        note: input.title,
        payload: { kind: input.kind, period },
      });
    }
  };

  const candidates = buildProposalCandidates(ctx, active, {
    finished,
    seasonGoal: seasonGoal ?? null,
  });
  for (const candidate of candidates) {
    await propose(candidate);
  }

  return { created, skipped };
}

// ── Accept / reject a proposal ────────────────────────────────────────────────

/** Pure: derive the athlete_goals patch an accepted proposal applies. Only
 * whitelisted, validated fields ever reach the goal row. */
export function deriveGoalPatch(
  proposedChange: unknown,
): Partial<typeof athleteGoalsTable.$inferInsert> {
  const patch: Partial<typeof athleteGoalsTable.$inferInsert> = {};
  if (proposedChange == null || typeof proposedChange !== "object") return patch;
  const change = proposedChange as Record<string, unknown>;
  if (
    typeof change.targetDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(change.targetDate)
  ) {
    patch.targetDate = change.targetDate;
  }
  if (isValidStatus(change.status)) {
    patch.status = change.status;
    if (typeof change.statusReason === "string")
      patch.statusReason = change.statusReason;
  }
  return patch;
}

export async function decideProposal(
  clerkId: string,
  proposalId: number,
  decision: "accepted" | "rejected",
): Promise<GoalProposal | null> {
  const [proposal] = await db
    .select()
    .from(goalProposalsTable)
    .where(
      and(
        eq(goalProposalsTable.id, proposalId),
        eq(goalProposalsTable.clerkId, clerkId),
        eq(goalProposalsTable.status, "open"),
      ),
    );
  if (!proposal) return null;

  const [updated] = await db
    .update(goalProposalsTable)
    .set({ status: decision, decidedAt: new Date() })
    .where(eq(goalProposalsTable.id, proposal.id))
    .returning();

  if (proposal.goalId != null) {
    await recordGoalEvent({
      clerkId,
      goalId: proposal.goalId,
      eventType: decision === "accepted" ? "proposal_accepted" : "proposal_rejected",
      note: proposal.title,
      payload: { proposalId: proposal.id, kind: proposal.kind },
    });
  }

  // Apply the structured change ONLY on acceptance — never silently.
  if (decision === "accepted" && proposal.goalId != null && proposal.proposedChange) {
    const patch = deriveGoalPatch(proposal.proposedChange);
    if (Object.keys(patch).length > 0) {
      patch.updatedAt = new Date();
      await db
        .update(athleteGoalsTable)
        .set(patch)
        .where(
          and(
            eq(athleteGoalsTable.id, proposal.goalId),
            eq(athleteGoalsTable.clerkId, clerkId),
          ),
        );
      await recordGoalEvent({
        clerkId,
        goalId: proposal.goalId,
        eventType: "adjusted",
        note: `Bijgesteld via geaccepteerd voorstel: ${proposal.title}`,
        payload: patch,
      });
    }
  }

  return updated ?? null;
}

// ── Planning integration ──────────────────────────────────────────────────────

/** How long an accepted steering proposal keeps influencing plan inputs. */
const DIRECTIVE_WINDOW_DAYS = 35;

export type SteeringDirective = {
  kind: string; // load | recovery | nutrition
  line: string; // plain-Dutch instruction for the plan/day-advice inputs
};

/** Pure: map ACCEPTED load/recovery/nutrition proposals (within the validity
 * window) to concrete plan-input directives. This is how an accepted steering
 * proposal actually changes what the plan generator and day advice work with. */
export function directivesFromProposals(
  proposals: Pick<
    GoalProposal,
    "kind" | "status" | "decidedAt" | "proposedChange" | "title"
  >[],
  now: Date = new Date(),
): SteeringDirective[] {
  const out: SteeringDirective[] = [];
  const seen = new Set<string>();
  for (const p of proposals) {
    if (p.status !== "accepted" || !p.decidedAt) continue;
    const ageDays = (now.getTime() - p.decidedAt.getTime()) / 86_400_000;
    if (ageDays < 0 || ageDays > DIRECTIVE_WINDOW_DAYS) continue;
    const change = (p.proposedChange ?? {}) as Record<string, unknown>;
    let line: string | null = null;
    if (p.kind === "recovery" && change.focus === "recovery") {
      line =
        "Afgesproken bijsturing: herstel heeft voorrang — plan lichter, geen intensieve blokken tot de hersteldirectie is opgeheven.";
    } else if (p.kind === "load" && change.weeklyLoad === "verlagen") {
      line =
        "Afgesproken bijsturing: weekbelasting verlagen — liever minder gepland en wél uitgevoerd.";
    } else if (p.kind === "load" && change.weeklyLoad === "herijken") {
      line =
        "Afgesproken bijsturing: belasting mag iets ambitieuzer — de belastbaarheid steeg duidelijk.";
    } else if (p.kind === "nutrition" && change.nutrition === "fuel_training") {
      line =
        "Afgesproken bijsturing: trainingen volledig gevoed rijden — voeding rond trainingen heeft expliciete aandacht.";
    }
    if (line && !seen.has(line)) {
      seen.add(line);
      out.push({ kind: p.kind, line });
    }
  }
  return out;
}

/** Load the athlete's currently-active steering directives from accepted
 * proposals. Used by plan generation and coaching context. */
export async function loadSteeringDirectives(
  clerkId: string,
): Promise<SteeringDirective[]> {
  const accepted = await db
    .select({
      kind: goalProposalsTable.kind,
      status: goalProposalsTable.status,
      decidedAt: goalProposalsTable.decidedAt,
      proposedChange: goalProposalsTable.proposedChange,
      title: goalProposalsTable.title,
    })
    .from(goalProposalsTable)
    .where(
      and(
        eq(goalProposalsTable.clerkId, clerkId),
        eq(goalProposalsTable.status, "accepted"),
        gte(
          goalProposalsTable.decidedAt,
          new Date(Date.now() - DIRECTIVE_WINDOW_DAYS * 86_400_000),
        ),
      ),
    );
  return directivesFromProposals(accepted);
}

/** Plain-Dutch goals block for prompts and the plan generator's `goals` input.
 * Empty string when there is nothing real to say. Includes the athlete's
 * accepted steering directives so an accepted proposal really changes the
 * inputs the plan and day advice are built on. */
export async function goalsContextLine(clerkId: string): Promise<string> {
  const [picture, directives] = await Promise.all([
    loadGoalPicture(clerkId),
    loadSteeringDirectives(clerkId),
  ]);
  const active = picture.goals.filter((g) => g.status === "active");
  const parts: string[] = [];
  for (const g of active.slice(0, 3)) {
    const bits = [g.title];
    if (g.targetDate) bits.push(`streefdatum ${g.targetDate}`);
    if (g.measure) bits.push(`meetlat: ${g.measure}`);
    bits.push(
      g.progress.verdict === "op_koers"
        ? "op koers"
        : g.progress.verdict === "risico"
          ? "onder druk"
          : g.progress.verdict === "aandacht"
            ? "vraagt aandacht"
            : "nog niet meetbaar",
    );
    parts.push(bits.join(", "));
  }
  for (const d of picture.derived.slice(0, 2)) {
    parts.push(d.title + (d.targetDate ? ` (${d.targetDate})` : ""));
  }
  for (const dir of directives) {
    parts.push(dir.line);
  }
  return parts.join(" · ");
}
