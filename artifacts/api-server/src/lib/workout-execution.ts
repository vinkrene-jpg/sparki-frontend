// Uitvoeringskoppeling (Golf 23) — verbindt een echte uitgevoerde activiteit
// (training_sessions) aan de geplande training van die dag (planned_workouts)
// en velt een eerlijk, deterministisch uitvoeringsoordeel:
//
//   completed  — uitgevoerd zoals gepland (duur/belasting binnen marge)
//   partial    — gedeeltelijk uitgevoerd (duidelijk korter/lichter dan gepland)
//   adjusted   — uitgevoerd maar duidelijk anders dan gepland (langer/zwaarder)
//
// Regels:
// - Alleen dezelfde kalenderdag, dezelfde sporter, nog niet gekoppeld en
//   status "planned"/"modified". Een handmatige koppeling wint altijd en wordt
//   nooit door auto-koppeling overschreven.
// - Zonder targets (geen targetDurationMin én geen targetTSS) is er niets om
//   eerlijk tegen af te meten: dan is het oordeel "completed" met de reden dat
//   er geen doelwaarden waren.
// - Geen match ⇒ niets gebeurt; de activiteit blijft gewoon een extra,
//   ongeplande training. We verzinnen nooit een koppeling.

import { and, eq, inArray, isNull } from "drizzle-orm";
import {
  db,
  plannedWorkoutsTable,
  plannedWorkoutChangesTable,
  type PlannedWorkout,
} from "@workspace/db";
import { matchSport } from "../engines/data-hub/sports";

export type ExecutionVerdict = "completed" | "partial" | "adjusted";

export type SessionLike = {
  id: number;
  sessionDate: string; // YYYY-MM-DD
  sport?: string | null;
  type?: string | null;
  durationMin: number | null;
  tss: number | null;
};

export type WorkoutCandidate = Pick<
  PlannedWorkout,
  | "id"
  | "scheduledDate"
  | "type"
  | "status"
  | "sessionId"
  | "targetDurationMin"
  | "targetTSS"
  | "source"
>;

const LINKABLE_STATUSES = ["planned", "modified"] as const;

/** Is dit sessietype/deze sport verenigbaar met een geplande fietstraining? */
function sportCompatible(session: SessionLike, workout: WorkoutCandidate): boolean {
  // Geplande trainingen zijn (nu) fiets-georiënteerd; een sessie telt mee als
  // ze fiets is, of als de sport onbekend/legacy is ("ride").
  const sport = session.sport ?? null;
  if (sport == null) return true;
  if (matchSport(sport) === "cycling") return true;
  // Niet-fiets sessies koppelen we alleen aan een training van hetzelfde type.
  return workout.type != null && session.type === workout.type;
}

/**
 * Kies de beste kandidaat voor deze sessie: zelfde dag, koppelbaar, sport-
 * verenigbaar; bij meerdere kandidaten wint de kleinste duurafstand.
 * Puur — geen DB.
 */
export function matchSessionToWorkout(
  session: SessionLike,
  candidates: WorkoutCandidate[],
): WorkoutCandidate | null {
  const eligible = candidates.filter(
    (w) =>
      w.scheduledDate === session.sessionDate &&
      w.sessionId == null &&
      (LINKABLE_STATUSES as readonly string[]).includes(w.status) &&
      sportCompatible(session, w),
  );
  if (eligible.length === 0) return null;
  if (eligible.length === 1) return eligible[0]!;
  const dur = session.durationMin;
  return [...eligible].sort((a, b) => {
    const da =
      dur != null && a.targetDurationMin != null
        ? Math.abs(dur - a.targetDurationMin)
        : Number.MAX_SAFE_INTEGER;
    const dbb =
      dur != null && b.targetDurationMin != null
        ? Math.abs(dur - b.targetDurationMin)
        : Number.MAX_SAFE_INTEGER;
    if (da !== dbb) return da - dbb;
    return a.id - b.id;
  })[0]!;
}

/**
 * Deterministisch uitvoeringsoordeel op basis van echte cijfers.
 * Puur — geen DB. Geeft ook de eerlijke reden terug.
 */
export function classifyExecution(
  session: SessionLike,
  workout: Pick<WorkoutCandidate, "targetDurationMin" | "targetTSS">,
): { verdict: ExecutionVerdict; reason: string } {
  const ratios: number[] = [];
  if (
    session.durationMin != null &&
    workout.targetDurationMin != null &&
    workout.targetDurationMin > 0
  ) {
    ratios.push(session.durationMin / workout.targetDurationMin);
  }
  if (session.tss != null && workout.targetTSS != null && workout.targetTSS > 0) {
    ratios.push(session.tss / workout.targetTSS);
  }
  if (ratios.length === 0) {
    return {
      verdict: "completed",
      reason:
        "Geen doelwaarden (duur/belasting) om tegen af te meten — geregistreerd als uitgevoerd.",
    };
  }
  const min = Math.min(...ratios);
  const max = Math.max(...ratios);
  if (min < 0.7) {
    return {
      verdict: "partial",
      reason: `Uitvoering duidelijk korter of lichter dan gepland (${Math.round(min * 100)}% van het doel).`,
    };
  }
  if (max > 1.3) {
    return {
      verdict: "adjusted",
      reason: `Uitvoering duidelijk langer of zwaarder dan gepland (${Math.round(max * 100)}% van het doel).`,
    };
  }
  return {
    verdict: "completed",
    reason: "Uitvoering binnen de marge van het plan (70–130% van het doel).",
  };
}

/** Append-only historieregel voor een geplande training. */
export async function logWorkoutChange(entry: {
  clerkId: string;
  workoutId: number;
  action: string;
  actor: "sporter" | "coach" | "sparki";
  reason?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}): Promise<void> {
  await db.insert(plannedWorkoutChangesTable).values({
    clerkId: entry.clerkId,
    workoutId: entry.workoutId,
    action: entry.action,
    actor: entry.actor,
    reason: entry.reason ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
}

/**
 * Auto-koppeling na het ontstaan van een nieuwe sessie (Data Hub-import of
 * handmatige invoer). Best-effort: fouten worden gelogd door de aanroeper,
 * nooit doorgegooid richting de import zelf. Idempotent: een al gekoppelde
 * training wordt nooit opnieuw gekoppeld.
 */
export async function autoLinkSession(
  clerkId: string,
  session: SessionLike,
): Promise<{ workoutId: number; verdict: ExecutionVerdict } | null> {
  const candidates = await db
    .select({
      id: plannedWorkoutsTable.id,
      scheduledDate: plannedWorkoutsTable.scheduledDate,
      type: plannedWorkoutsTable.type,
      status: plannedWorkoutsTable.status,
      sessionId: plannedWorkoutsTable.sessionId,
      targetDurationMin: plannedWorkoutsTable.targetDurationMin,
      targetTSS: plannedWorkoutsTable.targetTSS,
      source: plannedWorkoutsTable.source,
    })
    .from(plannedWorkoutsTable)
    .where(
      and(
        eq(plannedWorkoutsTable.clerkId, clerkId),
        eq(plannedWorkoutsTable.scheduledDate, session.sessionDate),
        isNull(plannedWorkoutsTable.sessionId),
        inArray(plannedWorkoutsTable.status, [...LINKABLE_STATUSES]),
      ),
    );

  const match = matchSessionToWorkout(session, candidates);
  if (!match) return null;

  const { verdict, reason } = classifyExecution(session, match);

  // Voorwaardelijke update: alleen als de training nog steeds ongekoppeld en
  // koppelbaar is (race-veilig — een handmatige koppeling wint).
  const [updated] = await db
    .update(plannedWorkoutsTable)
    .set({ status: verdict, sessionId: session.id, updatedAt: new Date() })
    .where(
      and(
        eq(plannedWorkoutsTable.id, match.id),
        eq(plannedWorkoutsTable.clerkId, clerkId),
        isNull(plannedWorkoutsTable.sessionId),
        inArray(plannedWorkoutsTable.status, [...LINKABLE_STATUSES]),
      ),
    )
    .returning({ id: plannedWorkoutsTable.id });
  if (!updated) return null;

  await logWorkoutChange({
    clerkId,
    workoutId: match.id,
    action: "gekoppeld",
    actor: "sparki",
    reason: `Automatisch gekoppeld aan activiteit #${session.id}. ${reason}`,
    before: { status: match.status, sessionId: null },
    after: { status: verdict, sessionId: session.id },
  });

  return { workoutId: match.id, verdict };
}

/**
 * Lazy zelfheling op het leespad: geplande trainingen in het verleden zonder
 * gekoppelde activiteit worden "missed". Geen nachtelijke job nodig — de eerst-
 * volgende lezer maakt het beeld kloppend. `today` = lokale kalenderdag.
 */
export async function markOverdueAsMissed(
  clerkId: string,
  today: string,
): Promise<number> {
  const rows = await db
    .select({
      id: plannedWorkoutsTable.id,
      scheduledDate: plannedWorkoutsTable.scheduledDate,
      status: plannedWorkoutsTable.status,
    })
    .from(plannedWorkoutsTable)
    .where(
      and(
        eq(plannedWorkoutsTable.clerkId, clerkId),
        isNull(plannedWorkoutsTable.sessionId),
        inArray(plannedWorkoutsTable.status, [...LINKABLE_STATUSES]),
      ),
    );
  const overdue = rows.filter((r) => r.scheduledDate < today);
  for (const r of overdue) {
    const [updated] = await db
      .update(plannedWorkoutsTable)
      .set({ status: "missed", updatedAt: new Date() })
      .where(
        and(
          eq(plannedWorkoutsTable.id, r.id),
          eq(plannedWorkoutsTable.clerkId, clerkId),
          isNull(plannedWorkoutsTable.sessionId),
          inArray(plannedWorkoutsTable.status, [...LINKABLE_STATUSES]),
        ),
      )
      .returning({ id: plannedWorkoutsTable.id });
    if (updated) {
      await logWorkoutChange({
        clerkId,
        workoutId: r.id,
        action: "gemist",
        actor: "sparki",
        reason:
          "Geplande datum verstreken zonder gekoppelde activiteit — als gemist gemarkeerd.",
        before: { status: r.status },
        after: { status: "missed" },
      });
    }
  }
  return overdue.length;
}
