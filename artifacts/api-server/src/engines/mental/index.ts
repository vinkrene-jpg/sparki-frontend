// Mentale Weerbaarheid Engine — public facade.
//
// Deterministic detection of MENTAL friction with training execution: postponed
// workouts, skipped quality sessions, rides cut short, aborted plans and
// motivation dips — derived ONLY from the athlete's real planned workouts,
// completed sessions and workout feedback. This is explicitly NOT a medical
// instrument: no burn-out, depression or diagnosis language anywhere. It coaches
// on motivation, discipline, focus and resilience only.
//
// Honesty contract:
// - Score and patterns are computed from real rows; with too little planned
//   training the engine says so (state "insufficient") instead of inventing.
// - Confidence is capped below 1.0 and every pattern lists its real occurrences.
// - "During the ride" coaching is honest about the medium: Sparki cannot talk
//   to the athlete mid-ride, so cues are given UP FRONT to memorise; the
//   debrief works on summary data (duration/feedback), never a fabricated
//   "dip at minute 23".

import { and, desc, eq, gte, inArray } from "drizzle-orm";
import {
  db,
  plannedWorkoutsTable,
  trainingSessionsTable,
  workoutFeedbackTable,
  workoutMentalReflectionsTable,
  type PlannedWorkout,
  type TrainingSession,
  type WorkoutFeedback,
  type WorkoutMentalReflection,
  type WorkoutStructure,
} from "@workspace/db";

// ── Types ────────────────────────────────────────────────────────────────────

export type MentalTechnique = {
  key:
    | "visualisatie"
    | "zelfspraak"
    | "ademhaling"
    | "aandacht_verleggen"
    | "chunking"
    | "acceptatie";
  name: string;
  short: string; // one-line what it is
  how: string; // plain-Dutch instruction
  intelDedupeKey: string | null; // link into the Mentale Bibliotheek card
};

export type MentalPattern = {
  key:
    | "uitstellen"
    | "kwaliteit_ontwijken"
    | "inkorten"
    | "afbreken"
    | "motivatie_dip"
    | "vaste_zwakke_dag"
    | "lage_motivatie_vooraf"
    | "mentaal_zwaar";
  label: string;
  detail: string; // plain Dutch, with the real counts
  occurrences: number;
  technique: MentalTechnique;
};

export type MentalWeekPoint = {
  weekStart: string; // ISO date (Monday)
  score: number | null; // null = too few planned workouts that week (honest gap)
  planned: number;
  completed: number;
};

export type MentalPreparation = {
  workoutId: number;
  date: string;
  title: string;
  whyItMatters: string; // from the plan's own rationale (real) or honest fallback
  expectedResistance: string;
  cues: string[]; // short lines to memorise for during the ride
  technique: MentalTechnique;
};

export type MentalReflection = {
  motivationBefore: number | null; // 1-5
  mentalEffort: number | null; // 1-5
  note: string | null;
};

export type MentalDebrief = {
  workoutId: number;
  date: string;
  title: string;
  outcome: "volbracht" | "ingekort" | "gemist";
  facts: string; // real numbers: planned vs actual
  reflection: string; // honest, mental-execution focused
  // The athlete's own first-person mental reflection for this workout, when
  // they added one. Null = no subjective signal (the debrief stays honest).
  athleteReflection: MentalReflection | null;
  // A prompt inviting the athlete to add their subjective signal; shown only
  // when no reflection exists yet (intelligent-werkblad: one targeted ask).
  reflectionPrompt: string | null;
};

export type MentalOverview = {
  state: "ok" | "insufficient";
  reason: string | null; // set when insufficient
  score: number | null; // 0-100
  confidence: number | null; // 0-0.9
  confidenceReason: string | null;
  weeks: MentalWeekPoint[];
  patterns: MentalPattern[];
  riskFactors: string[];
  advice: string[];
  preparation: MentalPreparation | null;
  debrief: MentalDebrief | null;
  windowDays: number;
  plannedCount: number;
  completedCount: number;
};

// ── Mentale Bibliotheek (sport psychology techniques) ────────────────────────

export const MENTAL_TECHNIQUES: Record<MentalTechnique["key"], MentalTechnique> =
  {
    visualisatie: {
      key: "visualisatie",
      name: "Visualisatie",
      short: "Speel de training vooraf af in je hoofd, inclusief het zware stuk.",
      how: "Neem 2 minuten voor de start. Zie jezelf het zwaarste blok rijden: hoe het voelt, wat je denkt, en hoe je doorgaat. Wie het zware moment al kent, schrikt er niet van.",
      intelDedupeKey: "debate-visualisation-works",
    },
    zelfspraak: {
      key: "zelfspraak",
      name: "Zelfspraak",
      short: "Korte, feitelijke zinnen tegen jezelf werken beter dan kritiek.",
      how: "Bereid twee zinnen voor die je op het zware moment tegen jezelf zegt, bijvoorbeeld: \"Zwaar hoort erbij\" en \"Rustig ademen, trappen maar\". Zeg ze letterlijk, desnoods hardop.",
      intelDedupeKey: "academy-focus-hard-moments",
    },
    ademhaling: {
      key: "ademhaling",
      name: "Ademhaling sturen",
      short: "Je adem is de snelste knop om onrust en paniekgevoel te dempen.",
      how: "Merk je dat je hoofd \"stop\" roept terwijl je vermogen normaal is? Adem 3 tellen in, 4 tellen uit, tien keer. Daarna beslis je pas — meestal is de dip dan al voorbij.",
      intelDedupeKey: "academy-breathing-under-pressure",
    },
    aandacht_verleggen: {
      key: "aandacht_verleggen",
      name: "Aandacht verleggen",
      short: "Stuur je focus naar iets stuurbaars: cadans, houding, de volgende bocht.",
      how: "Als \"ik wil stoppen\" opkomt: kies één focuspunt (cadans, ademhaling, het volgende herkenningspunt) en blijf daar 2 minuten bij. Het gevoel beslist niet — jij kiest waar je aandacht heen gaat.",
      intelDedupeKey: "academy-focus-hard-moments",
    },
    chunking: {
      key: "chunking",
      name: "Opdelen (chunking)",
      short: "Een training van 90 minuten bestaat niet — alleen het volgende blok.",
      how: "Denk nooit aan de hele training. Alleen: dit interval. Daarna: het volgende. Bij intervallen tel je af per herhaling; bij lange ritten rijd je van punt naar punt.",
      intelDedupeKey: "academy-chunking-long-efforts",
    },
    acceptatie: {
      key: "acceptatie",
      name: "Acceptatie",
      short: "Zware benen en geen zin mogen er zijn — ze bepalen niet wat je doet.",
      how: "Benoem wat je voelt (\"geen zin\", \"zware benen\") zonder ertegen te vechten, en start tóch met de eerste 10 minuten rustig. Beslis pas ná 10 minuten of aanpassen echt nodig is.",
      intelDedupeKey: "academy-acceptance-start-anyway",
    },
  };

// ── Pure computation ─────────────────────────────────────────────────────────

const WINDOW_DAYS = 42;
const SCORE_WINDOW_DAYS = 28;
const MIN_PLANNED_FOR_SCORE = 4;
const SHORTENED_RATIO = 0.75;

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - ((day + 6) % 7));
  return localDateStr(d);
}

function isQuality(w: PlannedWorkout): boolean {
  const s = w.structure as WorkoutStructure | null;
  if (s && typeof s.primaryZone === "number") return s.primaryZone >= 4;
  const t = `${w.type} ${w.title}`.toLowerCase();
  return /interval|tempo|drempel|vo2|sprint/.test(t);
}

type WorkoutFacts = {
  w: PlannedWorkout;
  session: TrainingSession | null;
  feedback: WorkoutFeedback[];
  reflection: WorkoutMentalReflection | null;
  inPast: boolean;
  completed: boolean;
  missed: boolean;
  shortened: boolean;
  postponed: boolean;
  abortedHard: boolean;
  quality: boolean;
};

export function buildWorkoutFacts(
  workouts: PlannedWorkout[],
  sessions: TrainingSession[],
  feedback: WorkoutFeedback[],
  today: string,
  reflections: WorkoutMentalReflection[] = [],
): WorkoutFacts[] {
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const reflectionByWorkout = new Map(
    reflections.map((r) => [r.workoutId, r]),
  );
  const fbByWorkout = new Map<number, WorkoutFeedback[]>();
  for (const f of feedback) {
    const arr = fbByWorkout.get(f.workoutId) ?? [];
    arr.push(f);
    fbByWorkout.set(f.workoutId, arr);
  }
  return workouts.map((w) => {
    const session = w.sessionId ? (sessionById.get(w.sessionId) ?? null) : null;
    const fb = fbByWorkout.get(w.id) ?? [];
    const inPast = w.scheduledDate < today;
    const fbTypes = new Set(fb.map((f) => f.feedbackType));
    const completed =
      w.status === "done" || session != null || fbTypes.has("done");
    const missed =
      !completed && (w.status === "missed" || fbTypes.has("missed") || inPast);
    const shortened = Boolean(
      completed &&
        w.targetDurationMin &&
        session?.durationMin &&
        session.durationMin < w.targetDurationMin * SHORTENED_RATIO,
    );
    return {
      w,
      session,
      feedback: fb,
      reflection: reflectionByWorkout.get(w.id) ?? null,
      inPast,
      completed,
      missed,
      shortened,
      postponed: fbTypes.has("move"),
      abortedHard: fbTypes.has("too_hard") || fbTypes.has("tired"),
      quality: isQuality(w),
    };
  });
}

export function computeMentalOverview(
  facts: WorkoutFacts[],
  today: string,
): Omit<MentalOverview, "preparation" | "debrief"> {
  const past = facts.filter((f) => f.inPast || f.completed);
  const cutoff = localDateStr(
    new Date(Date.now() - SCORE_WINDOW_DAYS * 86400000),
  );
  const scoreWindow = past.filter((f) => f.w.scheduledDate >= cutoff);

  // Weekly series over the whole window (honest nulls on thin weeks).
  const byWeek = new Map<string, WorkoutFacts[]>();
  for (const f of past) {
    const wk = mondayOf(f.w.scheduledDate);
    const arr = byWeek.get(wk) ?? [];
    arr.push(f);
    byWeek.set(wk, arr);
  }
  const weeks: MentalWeekPoint[] = [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, list]) => {
      const planned = list.length;
      const completed = list.filter((f) => f.completed).length;
      const full = list.filter((f) => f.completed && !f.shortened).length;
      const score =
        planned >= 2
          ? Math.round((0.7 * completed + 0.3 * full) / planned * 100)
          : null;
      return { weekStart, score, planned, completed };
    });

  if (scoreWindow.length < MIN_PLANNED_FOR_SCORE) {
    return {
      state: "insufficient",
      reason: `Te weinig geplande trainingen in de afgelopen ${SCORE_WINDOW_DAYS} dagen (${scoreWindow.length} gevonden, minimaal ${MIN_PLANNED_FOR_SCORE} nodig). Een eerlijke score is pas mogelijk met een gevuld schema.`,
      score: null,
      confidence: null,
      confidenceReason: null,
      weeks,
      patterns: [],
      riskFactors: [],
      advice: [],
      windowDays: SCORE_WINDOW_DAYS,
      plannedCount: scoreWindow.length,
      completedCount: scoreWindow.filter((f) => f.completed).length,
    };
  }

  const planned = scoreWindow.length;
  const completed = scoreWindow.filter((f) => f.completed);
  const fullLength = completed.filter((f) => !f.shortened);
  const qualityPlanned = scoreWindow.filter((f) => f.quality);
  const qualityDone = qualityPlanned.filter((f) => f.completed);

  const completionRate = completed.length / planned;
  const fullRate = completed.length > 0 ? fullLength.length / completed.length : 1;
  const qualityRate =
    qualityPlanned.length > 0 ? qualityDone.length / qualityPlanned.length : null;

  let score =
    60 * completionRate +
    25 * (qualityRate ?? completionRate) +
    15 * fullRate;
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Confidence grows with evidence, capped below certainty.
  const confidence = Math.min(0.9, 0.4 + 0.05 * planned);
  const confidenceReason = `Gebaseerd op ${planned} geplande trainingen in ${SCORE_WINDOW_DAYS} dagen${qualityPlanned.length > 0 ? `, waarvan ${qualityPlanned.length} kwaliteitstrainingen` : ""}. Wat er in je hoofd omging staat niet in de data — dit meet alleen uitvoering.`;

  // ── Patterns (≥2 real occurrences each) ────────────────────────────────────
  const patterns: MentalPattern[] = [];
  const missedOrMoved = scoreWindow.filter((f) => f.missed || f.postponed);
  if (missedOrMoved.length >= 2) {
    patterns.push({
      key: "uitstellen",
      label: "Trainingen uitstellen of overslaan",
      detail: `${missedOrMoved.length} van de ${planned} geplande trainingen werden verschoven of niet gereden.`,
      occurrences: missedOrMoved.length,
      technique: MENTAL_TECHNIQUES.acceptatie,
    });
  }
  if (
    qualityRate != null &&
    qualityPlanned.length >= 2 &&
    qualityPlanned.length - qualityDone.length >= 2 &&
    completionRate - qualityRate >= 0.25
  ) {
    patterns.push({
      key: "kwaliteit_ontwijken",
      label: "Kwaliteitstrainingen ontwijken",
      detail: `Rustige trainingen worden vaker gereden dan zware: ${qualityDone.length} van ${qualityPlanned.length} kwaliteitstrainingen gedaan, tegenover ${Math.round(completionRate * 100)}% van alles.`,
      occurrences: qualityPlanned.length - qualityDone.length,
      technique: MENTAL_TECHNIQUES.visualisatie,
    });
  }
  const shortenedList = scoreWindow.filter((f) => f.shortened);
  if (shortenedList.length >= 2) {
    patterns.push({
      key: "inkorten",
      label: "Korter rijden dan gepland",
      detail: `${shortenedList.length} trainingen duurden ruim korter dan gepland (minder dan driekwart van de geplande tijd).`,
      occurrences: shortenedList.length,
      technique: MENTAL_TECHNIQUES.chunking,
    });
  }
  const aborted = scoreWindow.filter((f) => f.abortedHard);
  if (aborted.length >= 2) {
    patterns.push({
      key: "afbreken",
      label: "Zwaar aanvoelen en afbreken",
      detail: `Bij ${aborted.length} trainingen gaf je aan dat het te zwaar was of dat je te moe was.`,
      occurrences: aborted.length,
      technique: MENTAL_TECHNIQUES.ademhaling,
    });
  }
  // Same weekday failing ≥2× — a fixed weak day, usually agenda/motivation.
  const dayCount = new Map<number, number>();
  for (const f of missedOrMoved) {
    const day = new Date(`${f.w.scheduledDate}T12:00:00`).getDay();
    dayCount.set(day, (dayCount.get(day) ?? 0) + 1);
  }
  const DAY_NAMES = [
    "zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag",
  ];
  for (const [day, n] of dayCount) {
    if (n >= 2) {
      patterns.push({
        key: "vaste_zwakke_dag",
        label: `Vaste lastige dag: ${DAY_NAMES[day]}`,
        detail: `${n} van de gemiste of verschoven trainingen vielen op ${DAY_NAMES[day]}. Dat wijst eerder op agenda of routine dan op je benen.`,
        occurrences: n,
        technique: MENTAL_TECHNIQUES.zelfspraak,
      });
      break; // one weekday pattern max — keep the card focused
    }
  }
  // Recent motivation dip: last 2 weeks clearly below the weeks before.
  const scored = weeks.filter((w) => w.score != null);
  if (scored.length >= 4) {
    const recent = scored.slice(-2);
    const before = scored.slice(0, -2);
    const avg = (list: MentalWeekPoint[]) =>
      list.reduce((s, w) => s + (w.score ?? 0), 0) / list.length;
    if (avg(before) - avg(recent) >= 20) {
      patterns.push({
        key: "motivatie_dip",
        label: "Recente dip in uitvoering",
        detail: `De laatste twee weken werden duidelijk minder geplande trainingen afgemaakt dan in de weken ervoor.`,
        occurrences: 2,
        technique: MENTAL_TECHNIQUES.aandacht_verleggen,
      });
    }
  }
  // ── Patterns from the athlete's own reflections (real subjective signal) ─────
  // Only when they actually reflected — silent otherwise, never inferred.
  const reflected = scoreWindow.filter((f) => f.reflection != null);
  const lowMotivation = reflected.filter(
    (f) => (f.reflection?.motivationBefore ?? 99) <= 2,
  );
  if (lowMotivation.length >= 2) {
    patterns.push({
      key: "lage_motivatie_vooraf",
      label: "Weinig zin vooraf",
      detail: `Bij ${lowMotivation.length} trainingen gaf je zelf aan met weinig motivatie te starten. Dat je toch bent begonnen, is precies de winst — het gevoel vooraf voorspelt de rit niet.`,
      occurrences: lowMotivation.length,
      technique: MENTAL_TECHNIQUES.acceptatie,
    });
  }
  const mentallyHeavy = reflected.filter(
    (f) => (f.reflection?.mentalEffort ?? 0) >= 4,
  );
  if (mentallyHeavy.length >= 2) {
    patterns.push({
      key: "mentaal_zwaar",
      label: "Mentaal zware trainingen",
      detail: `Je noteerde ${mentallyHeavy.length} trainingen als mentaal zwaar. Dat is een echt signaal om het hoofd net zo bewust voor te bereiden als de benen.`,
      occurrences: mentallyHeavy.length,
      technique: MENTAL_TECHNIQUES.chunking,
    });
  }

  // ── Risk factors & advice (from real patterns only) ────────────────────────
  const riskFactors: string[] = [];
  const advice: string[] = [];
  for (const p of patterns) {
    switch (p.key) {
      case "uitstellen":
        riskFactors.push("Uitstellen wordt een gewoonte: elke verschoven training maakt de volgende makkelijker om ook te verschuiven.");
        advice.push("Start met 10 minuten rustig rijden vóór je beslist om over te slaan. Meestal rijd je daarna gewoon door.");
        break;
      case "kwaliteit_ontwijken":
        riskFactors.push("Zonder kwaliteitstrainingen vlakt je vooruitgang af, terwijl het gevoel van 'druk bezig zijn' blijft.");
        advice.push(`Speel de zware training vooraf af in je hoofd (${MENTAL_TECHNIQUES.visualisatie.name.toLowerCase()}): wie het zware blok al kent, ziet er minder tegen op.`);
        break;
      case "inkorten":
        riskFactors.push("Steeds inkorten leert je hoofd dat stoppen altijd een optie is zodra het saai of zwaar wordt.");
        advice.push("Deel de rit op: denk nooit aan de hele duur, alleen aan het volgende blok of het volgende herkenningspunt.");
        break;
      case "afbreken":
        riskFactors.push("\"Te zwaar\" op papier normale dagen kan betekenen dat het hoofd eerder opgeeft dan het lichaam.");
        advice.push("Voel je de eerste dip: tien keer 3 tellen in, 4 tellen uit ademen — en dán pas beslissen.");
        break;
      case "vaste_zwakke_dag":
        riskFactors.push("Een vaste zwakke dag ondermijnt de hele weekopbouw van je schema.");
        advice.push("Leg de training op die dag 's ochtends klaar (kleding, fiets, tijdstip) en spreek een vaste zin met jezelf af.");
        break;
      case "motivatie_dip":
        riskFactors.push("Een dip die doorzet kan van een paar gemiste trainingen een gestopt schema maken.");
        advice.push("Maak de eerstvolgende training bewust makkelijk en kort — één afgemaakte training breekt de spiraal.");
        break;
      case "lage_motivatie_vooraf":
        riskFactors.push("Als weinig zin vooraf de norm wordt, kost elke start meer energie dan de training zelf.");
        advice.push("Spreek een vaste startroutine af (10 minuten rustig, dan pas beslissen). Je hebt zelf al bewezen dat je ook met weinig zin doorrijdt.");
        break;
      case "mentaal_zwaar":
        riskFactors.push("Structureel mentaal zware trainingen putten je focus uit als je ze alleen op wilskracht rijdt.");
        advice.push("Bereid je hoofd voor zoals je benen: deel de rit op in blokken en kies vooraf één zin en één focuspunt.");
        break;
    }
  }
  if (patterns.length === 0) {
    advice.push(
      `Je uitvoering is stabiel: ${completed.length} van de ${planned} geplande trainingen gereden. Houd de routine vast die nu werkt.`,
    );
  }

  return {
    state: "ok",
    reason: null,
    score,
    confidence: Math.round(confidence * 100) / 100,
    confidenceReason,
    weeks,
    patterns,
    riskFactors,
    advice,
    windowDays: SCORE_WINDOW_DAYS,
    plannedCount: planned,
    completedCount: completed.length,
  };
}

// ── Preparation & debrief (real plan data only) ──────────────────────────────

function buildPreparation(
  upcoming: WorkoutFacts[],
  patterns: MentalPattern[],
): MentalPreparation | null {
  const next = upcoming
    .filter((f) => !f.inPast && !f.completed && f.quality)
    .sort((a, b) => a.w.scheduledDate.localeCompare(b.w.scheduledDate))[0];
  if (!next) return null;
  const s = next.w.structure as WorkoutStructure | null;
  const technique =
    patterns[0]?.technique ?? MENTAL_TECHNIQUES.chunking;
  const cues = [
    "Nog één interval — meer hoeft je hoofd niet te weten.",
    "Focus alleen op de komende minuut.",
    "Zwaar voelen hoort bij deze training; het is geen stopteken.",
    "Dit is precies de training die je sterker maakt.",
    "Vandaag train je ook je karakter.",
  ];
  return {
    workoutId: next.w.id,
    date: next.w.scheduledDate,
    title: next.w.title,
    whyItMatters:
      s?.rationale?.whyToday ??
      "Kwaliteitstrainingen zoals deze leveren de prikkel die rustige ritten niet geven — dit is waar de vooruitgang vandaan komt.",
    expectedResistance:
      "Reken op weerstand vóór de start (\"geen zin\", \"benen voelen zwaar\") en een dip halverwege het eerste zware blok. Dat is normaal en zegt niets over hoe de training gaat aflopen.",
    cues,
    technique,
  };
}

export function buildDebrief(past: WorkoutFacts[]): MentalDebrief | null {
  const recent = past
    .filter((f) => f.inPast && (f.completed || f.missed))
    .sort((a, b) => b.w.scheduledDate.localeCompare(a.w.scheduledDate))[0];
  if (!recent) return null;
  const planned = recent.w.targetDurationMin;
  const actual = recent.session?.durationMin ?? null;
  const outcome: MentalDebrief["outcome"] = !recent.completed
    ? "gemist"
    : recent.shortened
      ? "ingekort"
      : "volbracht";
  const facts =
    planned && actual
      ? `Gepland ${planned} min, gereden ${actual} min.`
      : actual
        ? `Gereden: ${actual} min.`
        : "Geen rit-gegevens gevonden bij deze training.";
  const r = recent.reflection;
  const hasReflection =
    r != null &&
    (r.motivationBefore != null ||
      r.mentalEffort != null ||
      (r.note != null && r.note.trim() !== ""));
  // When the athlete added their own signal, reflect it back honestly instead
  // of guessing; otherwise invite exactly that one missing piece.
  let reflection: string;
  if (hasReflection) {
    reflection =
      outcome === "volbracht"
        ? "Afgemaakt zoals gepland. Wat je zelf noteerde hieronder is precies het soort signaal dat de cijfers niet laten zien — dat maakt het volgende advies scherper."
        : outcome === "ingekort"
          ? "De rit werd korter dan gepland. Dankzij wat je zelf noteerde hoeft Sparki niet te gissen of het je lichaam of je hoofd was."
          : "Deze training is niet gereden. Wat je erover noteerde hieronder telt mee — geen oordeel, wel context voor de volgende keer.";
  } else {
    reflection =
      outcome === "volbracht"
        ? "Afgemaakt zoals gepland — noteer voor jezelf wat vandaag hielp om door te rijden, dat is je recept voor de volgende zware dag."
        : outcome === "ingekort"
          ? "De rit werd korter dan gepland. Alleen jij weet wanneer het kantelde: was het je lichaam, of besliste je hoofd? Wat de data laat zien staat hierboven; het moment zelf ken jij het best."
          : "Deze training is niet gereden. Geen oordeel — wel de vraag: wat was op dat moment de doorslag? Dat antwoord is de sleutel voor de volgende keer.";
  }
  const athleteReflection: MentalReflection | null = hasReflection
    ? {
        motivationBefore: r!.motivationBefore ?? null,
        mentalEffort: r!.mentalEffort ?? null,
        note: r!.note?.trim() ? r!.note.trim() : null,
      }
    : null;
  const reflectionPrompt = hasReflection
    ? null
    : outcome === "gemist"
      ? "Wat er in je hoofd omging staat niet in de data. Voeg het in één keer toe — hoe was je motivatie vooraf, en wat gaf de doorslag om niet te rijden?"
      : "Wat er in je hoofd omging staat niet in de data. Voeg het in één keer toe — hoe was je motivatie vooraf en hoe zwaar was het mentaal?";
  return {
    workoutId: recent.w.id,
    date: recent.w.scheduledDate,
    title: recent.w.title,
    outcome,
    facts,
    reflection,
    athleteReflection,
    reflectionPrompt,
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function getMentalOverview(
  clerkId: string,
): Promise<MentalOverview> {
  const today = localDateStr(new Date());
  const since = localDateStr(new Date(Date.now() - WINDOW_DAYS * 86400000));

  const workouts = await db
    .select()
    .from(plannedWorkoutsTable)
    .where(
      and(
        eq(plannedWorkoutsTable.clerkId, clerkId),
        gte(plannedWorkoutsTable.scheduledDate, since),
      ),
    )
    .orderBy(desc(plannedWorkoutsTable.scheduledDate));

  const sessionIds = workouts
    .map((w) => w.sessionId)
    .filter((id): id is number => id != null);
  const workoutIds = workouts.map((w) => w.id);

  const [sessions, feedback, reflections] = await Promise.all([
    sessionIds.length > 0
      ? db
          .select()
          .from(trainingSessionsTable)
          .where(inArray(trainingSessionsTable.id, sessionIds))
      : Promise.resolve([]),
    workoutIds.length > 0
      ? db
          .select()
          .from(workoutFeedbackTable)
          .where(inArray(workoutFeedbackTable.workoutId, workoutIds))
      : Promise.resolve([]),
    workoutIds.length > 0
      ? db
          .select()
          .from(workoutMentalReflectionsTable)
          .where(
            inArray(workoutMentalReflectionsTable.workoutId, workoutIds),
          )
      : Promise.resolve([]),
  ]);

  const facts = buildWorkoutFacts(
    workouts,
    sessions,
    feedback,
    today,
    reflections,
  );
  const base = computeMentalOverview(facts, today);
  return {
    ...base,
    preparation: buildPreparation(facts, base.patterns),
    debrief: buildDebrief(facts),
  };
}

// Compact plain-Dutch block for the shared athlete context (chat, brief, day
// analysis). Only speaks when there is real signal; otherwise one honest line.
export async function mentalContextBlock(clerkId: string): Promise<string> {
  try {
    const o = await getMentalOverview(clerkId);
    if (o.state === "insufficient") {
      return `MENTALE UITVOERING: te weinig geplande trainingen om patronen te zien (${o.plannedCount} in ${o.windowDays} dagen).`;
    }
    const lines = [
      `MENTALE UITVOERING (laatste ${o.windowDays} dagen, echte data):`,
      `- Uitvoeringsscore: ${o.score}/100 (${o.completedCount} van ${o.plannedCount} geplande trainingen gereden).`,
    ];
    for (const p of o.patterns) lines.push(`- Patroon: ${p.label} — ${p.detail}`);
    if (o.patterns.length === 0) lines.push("- Geen opvallende patronen: uitvoering is stabiel.");
    const ar = o.debrief?.athleteReflection;
    if (ar) {
      const bits: string[] = [];
      if (ar.motivationBefore != null)
        bits.push(`motivatie vooraf ${ar.motivationBefore}/5`);
      if (ar.mentalEffort != null)
        bits.push(`mentaal zwaar ${ar.mentalEffort}/5`);
      if (ar.note) bits.push(`eigen woorden: "${ar.note}"`);
      if (bits.length > 0)
        lines.push(
          `- Eigen mentale reflectie bij laatste training (${o.debrief!.title}): ${bits.join("; ")}.`,
        );
    }
    lines.push(
      "Gebruik dit voor coaching op motivatie/discipline/focus. GEEN medische duiding (geen burn-out/depressie/diagnose). Als de sporter mentaal worstelt met een training: erken het gevoel kort, en geef één concrete techniek (opdelen, ademhaling, zelfspraak, visualisatie, aandacht verleggen of accepteren-en-starten).",
    );
    return lines.join("\n");
  } catch {
    return "MENTALE UITVOERING: kon niet worden geladen.";
  }
}
