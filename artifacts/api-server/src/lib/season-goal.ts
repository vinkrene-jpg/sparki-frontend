// Seizoensdoel (gewicht) — gedeelde, deterministische leeslaag.
//
// Het afvaldoel (of aankomdoel) dat de sporter zelf instelt moet AANTOONBAAR
// meewegen op elke plek waar Sparki een keuze maakt: voedingsplan, dagadvies,
// trainingsplan en analyse. Deze module is daarvoor de enige bron:
//   - computeSeasonSteering: het eerlijke, deterministische stuurgetal
//     (max 0,5 kg per week, nooit crashdiëten);
//   - loadSeasonGoalSteering: de leesbare doorvoering per sporter, incl.
//     leeftijdspoort (RED-S: onder de 17 GEEN gewichtssturing, ook niet als
//     er per ongeluk een doelrij bestaat);
//   - buildSeasonGoalLine: de vaste Nederlandse zin waarmee engines het doel
//     BENOEMEN in hun uitleg — één formulering, overal herkenbaar.
//
// Kernregel (onwrikbaar): trainingen worden ALTIJD volledig gevoed. Het doel
// stuurt de gewone maaltijden op rustige momenten, nooit de training zelf.

import {
  db,
  athleteProfilesTable,
  nutritionSeasonGoalsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { computeAge } from "./age";

export const SEASON_GOAL_MIN_AGE = 17;
export const SAFE_KG_PER_WEEK = 0.5;

export type SeasonSteering = {
  deltaKg: number | null;
  weeksToSeasonStart: number | null;
  weeksToPeak: number | null;
  requiredKgPerWeek: number | null;
  feasible: boolean | null;
  summary: string;
  warning: string | null;
};

export function weeksUntil(
  dateStr: string | null,
  todayStr: string,
): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T12:00:00Z").getTime();
  const today = new Date(todayStr + "T12:00:00Z").getTime();
  return Math.round(((target - today) / 86_400_000 / 7) * 10) / 10;
}

export function computeSeasonSteering(
  currentKg: number | null,
  targetKg: number | null,
  seasonStartDate: string | null,
  peakDate: string | null,
  today: string,
): SeasonSteering | null {
  if (currentKg == null || targetKg == null) return null;
  const deltaKg = Math.round((currentKg - targetKg) * 10) / 10;
  const weeksToSeasonStart = weeksUntil(seasonStartDate, today);
  const weeksToPeak = weeksUntil(peakDate, today);
  // The season start is the moment the weight should be right; the peak is
  // the hard deadline. Steer on the nearest future milestone.
  const horizon =
    weeksToSeasonStart != null && weeksToSeasonStart > 0
      ? weeksToSeasonStart
      : weeksToPeak != null && weeksToPeak > 0
        ? weeksToPeak
        : null;

  if (Math.abs(deltaKg) <= 0.5) {
    return {
      deltaKg,
      weeksToSeasonStart,
      weeksToPeak,
      requiredKgPerWeek: 0,
      feasible: true,
      summary:
        "Je zit al op je streefgewicht. De voeding stuurt op behoud: genoeg eten voor je trainingen, niet minder.",
      warning: null,
    };
  }

  const direction = deltaKg > 0 ? "afvallen" : "aankomen";
  if (horizon == null || horizon <= 0) {
    return {
      deltaKg,
      weeksToSeasonStart,
      weeksToPeak,
      requiredKgPerWeek: null,
      feasible: null,
      summary: `Verschil met streefgewicht: ${Math.abs(deltaKg).toString().replace(".", ",")} kg (${direction}). Zonder toekomstige seizoensstart of piekdatum kan het tempo niet berekend worden.`,
      warning: null,
    };
  }

  const requiredKgPerWeek =
    Math.round((Math.abs(deltaKg) / horizon) * 100) / 100;
  const feasible = requiredKgPerWeek <= SAFE_KG_PER_WEEK;
  const horizonNl = horizon.toString().replace(".", ",");
  return {
    deltaKg,
    weeksToSeasonStart,
    weeksToPeak,
    requiredKgPerWeek,
    feasible,
    summary: feasible
      ? `${Math.abs(deltaKg).toString().replace(".", ",")} kg ${direction} in ${horizonNl} weken kan rustig: ongeveer ${requiredKgPerWeek.toString().replace(".", ",")} kg per week. Dat past naast je trainingen.`
      : `${Math.abs(deltaKg).toString().replace(".", ",")} kg ${direction} in ${horizonNl} weken vraagt ${requiredKgPerWeek.toString().replace(".", ",")} kg per week — dat is meer dan het veilige tempo van ${SAFE_KG_PER_WEEK.toString().replace(".", ",")} kg per week.`,
    warning: feasible
      ? null
      : "Dit tempo is niet gezond en kost je trainingskwaliteit. Stel je streefgewicht of je datum bij — de voeding stuurt nooit sneller dan het veilige tempo.",
  };
}

// Age gate: null when eligible, otherwise honest refusal payload.
export function seasonGoalIneligible(
  age: number | null,
): { eligible: false; reason: string; message: string } | null {
  if (age == null) {
    return {
      eligible: false,
      reason: "birth_year_missing",
      message:
        "Je geboortejaar is nog niet ingevuld. Sturen op gewicht is er alleen voor renners van 17 jaar en ouder — vul eerst je geboortejaar in bij je profiel.",
    };
  }
  if (age < SEASON_GOAL_MIN_AGE) {
    return {
      eligible: false,
      reason: "too_young",
      message:
        "Sturen op gewicht doet Sparki bewust niet onder de 17. Op jouw leeftijd geldt: genoeg en gevarieerd eten, op tijd rond je trainingen — je lichaam is nog volop in ontwikkeling.",
    };
  }
  return null;
}

export type SeasonGoalRichting = "afvallen" | "aankomen" | "behoud" | "onbekend";

/** De doorvoering: het actieve seizoensdoel van één sporter, klaar om mee te
 * wegen én benoemd te worden. Null wanneer er niets echts te sturen valt
 * (geen doel, geen streefgewicht, te jong of geboortejaar onbekend). */
export type SeasonGoalContext = {
  targetWeightKg: number;
  currentWeightKg: number | null;
  richting: SeasonGoalRichting;
  steering: SeasonSteering | null;
  /** Vaste Nederlandse zin die het doel benoemt — voor uitleg/rationale. */
  line: string;
};

/** Eén formulering waarmee elke engine het doel benoemt. Deterministisch. */
export function buildSeasonGoalLine(
  targetWeightKg: number,
  steering: SeasonSteering | null,
): string {
  const target = targetWeightKg.toString().replace(".", ",");
  const richting = seasonGoalRichting(steering);
  const naam =
    richting === "afvallen"
      ? "afvaldoel"
      : richting === "aankomen"
        ? "aankomdoel"
        : "seizoensdoel";
  const kern = `Je ${naam} (streefgewicht ${target} kg) weegt hierin mee`;
  if (richting === "onbekend") {
    // Eerlijk gat: zonder huidig gewicht valt de richting/het tempo niet te
    // berekenen — nooit doen alsof de sporter "op gewicht" zit.
    return `${kern}: zonder je huidige gewicht kan Sparki richting en tempo nog niet berekenen — vul je gewicht in bij je profiel. Trainingen blijven altijd volledig gevoed.`;
  }
  if (richting === "behoud") {
    return `${kern}: je zit op gewicht, dus de sturing is behoud — genoeg eten voor je trainingen, niet minder.`;
  }
  const tempo =
    steering?.requiredKgPerWeek != null
      ? steering.feasible
        ? ` in een rustig tempo van ~${steering.requiredKgPerWeek.toString().replace(".", ",")} kg per week`
        : ` — let op: het gevraagde tempo is hoger dan het veilige maximum van ${SAFE_KG_PER_WEEK.toString().replace(".", ",")} kg per week, dus Sparki stuurt niet sneller dan dat`
      : "";
  return `${kern}: bijsturen gebeurt via je gewone maaltijden op rustige momenten${tempo}. Trainingen blijven altijd volledig gevoed.`;
}

export function seasonGoalRichting(
  steering: SeasonSteering | null,
): SeasonGoalRichting {
  // Geen steering (b.v. huidig gewicht onbekend) ⇒ richting is eerlijk
  // onbekend, NOOIT "behoud" — dat zou een onterecht "je zit op gewicht" zijn.
  if (!steering || steering.deltaKg == null) return "onbekend";
  if (Math.abs(steering.deltaKg) <= 0.5) return "behoud";
  return steering.deltaKg > 0 ? "afvallen" : "aankomen";
}

/** Laad het actieve seizoensdoel van deze sporter, met leeftijdspoort.
 * Faalt stil naar null — een ontbrekend doel is een normale toestand. */
export async function loadSeasonGoalSteering(
  clerkId: string,
  today?: string,
): Promise<SeasonGoalContext | null> {
  const [[athlete], [goal]] = await Promise.all([
    db
      .select({
        birthYear: athleteProfilesTable.birthYear,
        birthDate: athleteProfilesTable.birthDate,
        weightKg: athleteProfilesTable.weightKg,
      })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId)),
    db
      .select()
      .from(nutritionSeasonGoalsTable)
      .where(eq(nutritionSeasonGoalsTable.clerkId, clerkId)),
  ]);
  if (!goal || goal.targetWeightKg == null) return null;
  // RED-S-poort: zonder bekend geboortejaar of onder de 17 wordt het doel
  // nergens doorgevoerd — fail-closed, ook als de rij tóch bestaat.
  const age = computeAge(athlete?.birthDate, athlete?.birthYear);
  if (seasonGoalIneligible(age)) return null;

  const currentWeightKg =
    athlete?.weightKg != null ? Number(athlete.weightKg) : null;
  const targetWeightKg = Number(goal.targetWeightKg);
  const todayStr =
    today ??
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(
      new Date(),
    );
  const steering = computeSeasonSteering(
    currentWeightKg,
    targetWeightKg,
    goal.seasonStartDate,
    goal.peakDate,
    todayStr,
  );
  return {
    targetWeightKg,
    currentWeightKg,
    richting: seasonGoalRichting(steering),
    steering,
    line: buildSeasonGoalLine(targetWeightKg, steering),
  };
}
