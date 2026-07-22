// Race Intelligence — wedstrijddossier (Golf 16).
//
// Eén samengesteld overzicht per wedstrijd voor de héle flow: toevoegen → info →
// parcoursanalyse → voorbereiding → racedag → activiteit koppelen → evalueren.
// Alles wordt op leesmoment samengesteld uit bestaande engines (geen kopieën,
// geen tweede bron van waarheid): race-context (info + gaten), race-course
// (parcours), race-advice (adviezen met typologie), race-intel (voorbereiding,
// racedagrapport, voeding, checklist), journey (gekoppelde activiteit) en
// race-evaluation (terugblik).

import { and, eq } from "drizzle-orm";
import {
  db,
  journeyReflectionsTable,
  type Race,
  type AthleteProfile,
} from "@workspace/db";
import { buildRaceContext, type RaceContext } from "./race-context";
import { buildRaceIntel, daysUntil, type RaceIntel } from "./race-intel";
import { buildRaceAdvice, type RaceAdviceSet } from "./race-advice";
import type { RaceCourseAnalysis } from "./race-course";
import { buildRaceEvaluation, type RaceEvaluation } from "./race-evaluation";
import { resolveLinkedActivity, type LinkedActivity } from "./journey";

export type RaceDossierPhase =
  | "aankomend"
  | "racedag"
  | "afgerond"
  | "geannuleerd";

export type RaceDossier = {
  race: Race;
  /** Waar de wedstrijd in de flow zit — stuurt welke blokken de UI toont. */
  phase: RaceDossierPhase;
  daysUntil: number;
  context: RaceContext;
  course: RaceCourseAnalysis;
  advice: RaceAdviceSet;
  intel: RaceIntel;
  linkedActivity: LinkedActivity;
  evaluation: RaceEvaluation;
};

export async function buildRaceDossier(
  race: Race,
  athlete: AthleteProfile | null,
  now: Date = new Date(),
): Promise<RaceDossier> {
  const d = daysUntil(race.raceDate, now);
  const phase: RaceDossierPhase =
    race.status === "geannuleerd"
      ? "geannuleerd"
      : d > 0
        ? "aankomend"
        : d === 0
          ? "racedag"
          : "afgerond";

  const [reflectionRows, context, adviceWithCourse, evaluation] =
    await Promise.all([
      db
        .select()
        .from(journeyReflectionsTable)
        .where(
          and(
            eq(journeyReflectionsTable.clerkId, race.clerkId),
            eq(journeyReflectionsTable.raceId, race.id),
          ),
        )
        .limit(1),
      buildRaceContext(race, athlete),
      buildRaceAdvice(race, athlete),
      buildRaceEvaluation(race, athlete),
    ]);

  const linkedActivity = await resolveLinkedActivity(
    race,
    reflectionRows[0] ?? null,
  );

  const { course, ...advice } = adviceWithCourse;

  return {
    race,
    phase,
    daysUntil: d,
    context,
    course,
    advice,
    intel: buildRaceIntel(race, athlete),
    linkedActivity,
    evaluation,
  };
}
