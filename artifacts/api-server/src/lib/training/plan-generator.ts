// Real periodized 3-week plan generator.
//
// Produces a science-based block of planned workouts computed from the athlete's
// OWN numbers (FTP, weekly-hour target, goal). NOTHING here is mocked: every
// duration, TSS, zone and power target is derived deterministically from the
// athlete profile + standard endurance periodization (2 build weeks + 1 deload),
// progressive overload, polarized intensity distribution and a recovery week.
//
// The generator never invents athlete data — if FTP or weekly hours are missing
// the caller refuses to generate (the UI then asks the athlete to complete their
// profile first).

import type {
  InsertPlannedWorkout,
  WorkoutBlock,
  WorkoutPhase,
  WorkoutStructure,
  WorkoutRouteNeed,
} from "@workspace/db";

export type BusyDay = {
  /** What the day allows: no training / time-capped / only light work. */
  impact: "geen_training" | "minder_tijd" | "alleen_licht";
  /** Athlete's own label, e.g. "Toetsweek" — shown honestly in the plan. */
  label: string;
};

export type GeneratePlanInput = {
  ftp: number;
  weeklyHourTarget: number;
  discipline: string | null;
  goals: string | null;
  /** ISO yyyy-mm-dd; plan starts on this date (inclusive). */
  startDate: string;
  /** Number of 7-day blocks. Default 3 (2 build + 1 deload). */
  weeks?: number;
  /**
   * Life-agenda days (school/familie/werk) keyed by ISO date. The generator
   * plans AROUND these: geen_training → rest day, alleen_licht → short
   * recovery spin, minder_tijd → session capped at 45 minutes. Only real,
   * athlete-entered events reach this map — never assumptions.
   */
  busyDays?: Record<string, BusyDay>;
};

type DayKind =
  | "rest"
  | "threshold"
  | "endurance"
  | "vo2"
  | "recovery"
  | "long"
  | "tempo";

// Mid-target as % of FTP per training zone (Coggan-style).
const ZONE_PCT: Record<number, number> = {
  1: 0.5,
  2: 0.65,
  3: 0.83,
  4: 0.98,
  5: 1.13,
  6: 1.35,
};

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0]!;
}

function round5(n: number): number {
  return Math.max(0, Math.round(n / 5) * 5);
}

// TSS from a block list: sum of (durationH * IF^2 * 100), IF = %FTP.
function tssFromBlocks(blocks: WorkoutBlock[]): number {
  let tss = 0;
  for (const b of blocks) {
    const intensity = b.targetPctFtp != null ? b.targetPctFtp / 100 : 0.5;
    tss += (b.durationMin / 60) * intensity * intensity * 100;
  }
  return Math.round(tss);
}

function block(
  kind: WorkoutBlock["kind"],
  label: string,
  durationMin: number,
  zone: number,
  reps?: number,
): WorkoutBlock {
  return {
    kind,
    label,
    durationMin,
    zone,
    targetPctFtp: Math.round((ZONE_PCT[zone] ?? 0.65) * 100),
    ...(reps != null ? { reps } : {}),
  };
}

// Weekly micro-cycle template keyed by weekday (0=Sun … 6=Sat). Polarized:
// mostly Z2 with two hard days (threshold + VO2) and protected rest.
function dayKindFor(weekday: number): DayKind {
  switch (weekday) {
    case 1:
      return "rest"; // Monday — full rest
    case 2:
      return "threshold"; // Tuesday — quality
    case 3:
      return "endurance"; // Wednesday — aerobic base
    case 4:
      return "vo2"; // Thursday — quality
    case 5:
      return "recovery"; // Friday — easy spin
    case 6:
      return "long"; // Saturday — long ride
    default:
      return "tempo"; // Sunday — sweet spot / tempo
  }
}

// Share of weekly minutes per training day (sums to 1.0 over training days).
const DAY_WEIGHT: Record<DayKind, number> = {
  rest: 0,
  recovery: 0.08,
  threshold: 0.18,
  endurance: 0.18,
  vo2: 0.16,
  long: 0.28,
  tempo: 0.12,
};

function phaseForWeek(weekIdx: number, totalWeeks: number): WorkoutPhase {
  // Last block is always a deload/recovery week.
  if (weekIdx === totalWeeks - 1) return "recovery";
  return "build";
}

// Volume multiplier per block: build ramps up (progressive overload), the final
// week deloads to absorb the work.
function volumeMultiplier(weekIdx: number, totalWeeks: number): number {
  if (weekIdx === totalWeeks - 1) return 0.6; // deload
  return 1 + weekIdx * 0.08; // 1.0, 1.08, …
}

type Built = {
  type: string;
  title: string;
  intensity: string;
  primaryZone: number;
  routeNeed: WorkoutRouteNeed;
  equipment: string[];
  blocks: WorkoutBlock[];
  recoveryAdvice: string;
  rationale: WorkoutStructure["rationale"];
};

const BIKE = ["Fiets", "Vermogensmeter", "Hartslagmeter", "Bidons"];

function goalLine(goals: string | null): string {
  return goals?.trim() ? goals.trim() : "je seizoensdoel";
}

function buildWorkout(
  kind: DayKind,
  durationMin: number,
  phase: WorkoutPhase,
  goals: string | null,
): Built | null {
  const goal = goalLine(goals);
  const deload = phase === "recovery";

  if (kind === "rest") return null;

  if (kind === "recovery") {
    const blocks = [block("recovery", "Losdraaien", durationMin, 1)];
    return {
      type: "recovery",
      title: "Herstelrit",
      intensity: "Herstel Z1",
      primaryZone: 1,
      routeNeed: "indoor_ok",
      equipment: BIKE,
      blocks,
      recoveryAdvice:
        "Houd het écht licht — dit is actief herstel, geen training. Eet en slaap goed; dit versnelt het herstel tussen de zware dagen.",
      rationale: {
        whyToday:
          "Na de kwaliteitsdagen heeft je lichaam lichte beweging nodig om door te bloeden zonder nieuwe vermoeidheid op te bouwen.",
        supportsGoal: `Herstel is waar je sterker wordt. Zonder deze rustige dagen kun je de zware sessies die ${goal} dichterbij brengen niet kwalitatief afwerken.`,
        whatToFeel:
          "Volledig comfortabel, je kunt moeiteloos praten. Benen mogen losser aanvoelen naarmate je rijdt.",
        tooHardSigns:
          "Als je hijgt of je benen branden, rij je te hard. Schakel terug.",
        tooLightSigns:
          "Te licht kan bijna niet vandaag — rustiger is altijd goed op een hersteldag.",
        safeAdjust:
          "Voel je je moe? Kort de rit in of vervang door wandelen/stretchen. Voel je je fris? Houd je toch in — bewaar het voor de kwaliteitsdag.",
      },
    };
  }

  if (kind === "endurance" || kind === "long") {
    const long = kind === "long";
    const wu = long ? 12 : 10;
    const cd = long ? 8 : 8;
    const mid = Math.max(20, durationMin - wu - cd);
    const blocks = [
      block("warmup", "Warming-up", wu, 1),
      block("steady", long ? "Lange duurinspanning" : "Duurinspanning", mid, 2),
      block("cooldown", "Cooling-down", cd, 1),
    ];
    return {
      type: "ride",
      title: long ? "Lange duurrit" : "Duurrit Z2",
      intensity: long ? "Lange duur Z2" : "Duur Z2",
      primaryZone: 2,
      routeNeed: long ? "outdoor_long" : "outdoor",
      equipment: long ? [...BIKE, "Eten voor onderweg"] : BIKE,
      blocks,
      recoveryAdvice: long
        ? "Tank koolhydraten tijdens de rit (60–90g/uur) en eet binnen 30 min na afloop. Lange duur vraagt goede aanvulling."
        : "Lichte sessie qua intensiteit — normaal eten en drinken volstaat. Let op je houding en cadans.",
      rationale: {
        whyToday: long
          ? "De lange rit is de hoeksteen van je aerobe basis: je traint vetverbranding, capillairen en uithoudingsvermogen op het tempo waarop je het langst kunt doorgaan."
          : "Een rustige aerobe dag bouwt je basis op én bevordert herstel tussen de kwaliteitsdagen door — de motor van progressie.",
        supportsGoal: `Een grotere aerobe motor tilt je hele krommen omhoog en maakt dat je drempel- en VO2-werk beter beklijft — direct in dienst van ${goal}.`,
        whatToFeel:
          "Comfortabel, je kunt in hele zinnen praten (Z2). Het mag saai voelen — dat is precies goed.",
        tooHardSigns:
          "Boven Z2 (hijgen, oplopende hartslag) verbrand je de bedoeling van de dag. Houd je in.",
        tooLightSigns:
          "Zakt je hartslag ver onder Z2 en voelt het als niks? Til het tempo naar de bovenkant van Z2.",
        safeAdjust:
          "Weinig tijd of moe? Kort de duurinspanning in maar houd de zone gelijk. Liever niet de intensiteit opvoeren.",
      },
    };
  }

  if (kind === "tempo") {
    const wu = 12;
    const cd = 8;
    const work = Math.max(20, durationMin - wu - cd);
    const blocks = [
      block("warmup", "Warming-up", wu, 1),
      block("interval", deload ? "Tempo blok" : "Sweet spot blok", work, 3),
      block("cooldown", "Cooling-down", cd, 1),
    ];
    return {
      type: "ride",
      title: deload ? "Tempo Z3" : "Sweet spot",
      intensity: deload ? "Tempo Z3" : "Sweet spot (Z3)",
      primaryZone: 3,
      routeNeed: "indoor_ok",
      equipment: BIKE,
      blocks,
      recoveryAdvice:
        "Stevige maar duurzame inspanning. Goed aanvullen met koolhydraten na afloop helpt je morgen weer fris te staan.",
      rationale: {
        whyToday:
          "Tempo/sweet-spot geeft veel aerobe prikkel per minuut: je tilt je drempel op zonder de zware belasting van echte intervallen.",
        supportsGoal: `Sweet spot is het meest tijdsefficiënte werk om je FTP te verhogen — de kern van ${goal}.`,
        whatToFeel:
          "Comfortabel-zwaar: praten kan in korte zinnen. Beheerst, niet vol.",
        tooHardSigns:
          "Moet je happen naar adem of zakt je vermogen weg op het einde? Dan zit je te hoog — laat het tempo iets zakken.",
        tooLightSigns:
          "Voelt het te makkelijk en blijf je ruim onder doelvermogen? Schuif naar de bovenkant van de zone.",
        safeAdjust:
          "Vermoeid? Verklein het blok of splits het in tweeën met korte pauze. Houd de zone, kort de duur.",
      },
    };
  }

  if (kind === "threshold") {
    const wu = 15;
    const cd = 10;
    const reps = deload ? 2 : 3;
    const repMin = 10;
    const rec = 5;
    const blocks: WorkoutBlock[] = [block("warmup", "Warming-up", wu, 1)];
    for (let i = 0; i < reps; i++) {
      blocks.push(
        block("interval", `Drempel ${i + 1} (10′)`, repMin, 4, reps),
      );
      if (i < reps - 1) blocks.push(block("recovery", "Herstel", rec, 1));
    }
    blocks.push(block("cooldown", "Cooling-down", cd, 1));
    return {
      type: "ride",
      title: `Drempel ${reps}×10′`,
      intensity: "Drempel (Z4)",
      primaryZone: 4,
      routeNeed: "indoor_ok",
      equipment: BIKE,
      blocks,
      recoveryAdvice:
        "Kwaliteitsdag — plan er een echte herstelnacht omheen. Eet voldoende koolhydraten vooraf en vul binnen 30 min na afloop aan.",
      rationale: {
        whyToday:
          "Drempelintervallen rond je FTP verhogen rechtstreeks het vermogen dat je langdurig kunt aanhouden — de motor van een hogere FTP.",
        supportsGoal: `Dit is de meest directe prikkel voor ${goal}: herhaald werk net rond je drempel duwt die drempel omhoog.`,
        whatToFeel:
          "Comfortabel-zwaar tot zwaar (7–8/10). Gelijkmatig vermogen, je kunt alleen losse woorden zeggen.",
        tooHardSigns:
          "Kun je het doelvermogen in de laatste herhaling niet vasthouden of word je misselijk? Te hoog — verlaag 5–10W of stop een herhaling eerder.",
        tooLightSigns:
          "Rond je elke herhaling makkelijk af met vermogen over? Til de volgende 5–10W op of voeg een herhaling toe.",
        safeAdjust:
          "Moe of slecht geslapen? Doe één herhaling minder of zak naar de onderkant van Z4. Pijn? Stop en kies herstel.",
      },
    };
  }

  // vo2
  const wu = 15;
  const cd = 10;
  const reps = deload ? 3 : 5;
  const repMin = 3;
  const rec = 3;
  const blocks: WorkoutBlock[] = [block("warmup", "Warming-up", wu, 1)];
  for (let i = 0; i < reps; i++) {
    blocks.push(block("interval", `VO2 ${i + 1} (3′)`, repMin, 5, reps));
    if (i < reps - 1) blocks.push(block("recovery", "Herstel", rec, 1));
  }
  blocks.push(block("cooldown", "Cooling-down", cd, 1));
  return {
    type: "ride",
    title: `VO2max ${reps}×3′`,
    intensity: "VO2max (Z5)",
    primaryZone: 5,
    routeNeed: "indoor_ok",
    equipment: BIKE,
    blocks,
    recoveryAdvice:
      "Zwaarste sessie van de week. Goede warming-up is essentieel; neem daarna een rustige avond en let extra op je slaap.",
    rationale: {
      whyToday:
        "Korte intervallen boven je drempel vergroten je maximale zuurstofopname (VO2max) — het plafond waaronder al je andere zones liggen.",
      supportsGoal: `Een hoger plafond maakt je drempelwerk makkelijker en tilt op termijn je FTP op — een belangrijke pijler onder ${goal}.`,
      whatToFeel:
        "Hard tot zeer hard (8–9/10). De laatste minuut van elke herhaling moet écht pittig zijn.",
      tooHardSigns:
        "Klap je dicht halverwege of kelderen je herhalingen in vermogen? Verkort naar 2′ of doe één herhaling minder.",
      tooLightSigns:
        "Kun je nog een paar herhalingen extra? Dan ga je te voorzichtig — duw iets harder of voeg er één toe.",
      safeAdjust:
        "Niet fris? VO2 vraagt frisheid: vervang door drempel- of tempowerk, of verschuif een dag. Forceer nooit op vermoeide benen.",
    },
  };
}

/**
 * Generate a real periodized block of planned workouts. Returns rows ready to
 * insert (sans clerkId, which the route adds). Caller must pass a valid FTP and
 * weekly-hour target.
 */
export function generateThreeWeekPlan(
  input: GeneratePlanInput,
): Array<Omit<InsertPlannedWorkout, "clerkId">> {
  const weeks = input.weeks ?? 3;
  const weeklyMinutes = input.weeklyHourTarget * 60;
  const rows: Array<Omit<InsertPlannedWorkout, "clerkId">> = [];

  for (let dayIdx = 0; dayIdx < weeks * 7; dayIdx++) {
    const weekIdx = Math.floor(dayIdx / 7);
    const date = addDays(input.startDate, dayIdx);
    const weekday = new Date(date + "T00:00:00Z").getUTCDay();
    const busy = input.busyDays?.[date];
    let kind = dayKindFor(weekday);
    const phase = phaseForWeek(weekIdx, weeks);
    const vol = volumeMultiplier(weekIdx, weeks);

    // Life agenda: the athlete told Sparki this day is (partly) taken.
    if (busy?.impact === "geen_training" && kind !== "rest") {
      const structure: WorkoutStructure = {
        phase,
        week: weekIdx + 1,
        intensity: "Rust",
        primaryZone: 0,
        routeNeed: "none",
        equipment: [],
        blocks: [],
        recoveryAdvice:
          "Geen training vandaag — je agenda heeft voorrang. Goede slaap en voeding houden je op koers.",
        rationale: {
          whyToday: `Je gaf aan: ${busy.label}. Daarom staat er vandaag bewust geen training — het schema is eromheen gebouwd.`,
          supportsGoal:
            "Een schema dat past bij je echte leven houd je vol. Dat levert op termijn meer op dan een gemiste training forceren.",
          whatToFeel: "Focus op je dag. De training komt op de andere dagen terug.",
          tooHardSigns: "—",
          tooLightSigns: "—",
          safeAdjust:
            "Komt er onverwacht toch tijd vrij? Houd het bij een korte, lichte rit — het schema rekent niet op extra belasting vandaag.",
        },
      };
      rows.push({
        scheduledDate: date,
        type: "rest",
        title: `Vrij — ${busy.label}`,
        description: "Geen training: je agenda heeft vandaag voorrang.",
        targetDurationMin: 0,
        targetTSS: 0,
        structure,
        status: "planned",
        source: "sparki",
      });
      continue;
    }
    if (busy?.impact === "alleen_licht" && kind !== "rest") {
      kind = "recovery";
    }

    if (kind === "rest") {
      const structure: WorkoutStructure = {
        phase,
        week: weekIdx + 1,
        intensity: "Rust",
        primaryZone: 0,
        routeNeed: "none",
        equipment: [],
        blocks: [],
        recoveryAdvice:
          "Volledige rustdag. Geen training — geef je lichaam tijd om te adapteren. Goede slaap en voeding doen vandaag het werk.",
        rationale: {
          whyToday:
            "Rust is geen verloren dag: adaptaties uit je trainingen worden juist nu verankerd. Plannen mét rust maakt je sneller dan elke dag rijden.",
          supportsGoal:
            "Zonder herstel stapelt vermoeidheid op en daalt je vorm. Deze rustdag beschermt de kwaliteit van je harde dagen.",
          whatToFeel: "Ontspannen. Gebruik de dag voor slaap, eten en mobiliteit.",
          tooHardSigns: "—",
          tooLightSigns: "—",
          safeAdjust:
            "Voel je je heel fris en wil je bewegen? Houd het bij lichte mobiliteit of een wandeling — niet fietsen.",
        },
      };
      rows.push({
        scheduledDate: date,
        type: "rest",
        title: "Rustdag",
        description: "Volledige rust — herstel en adaptatie.",
        targetDurationMin: 0,
        targetTSS: 0,
        structure,
        status: "planned",
        source: "sparki",
      });
      continue;
    }

    let dur = round5(weeklyMinutes * vol * (DAY_WEIGHT[kind] ?? 0.15));
    if (busy?.impact === "minder_tijd") dur = Math.min(dur, 45);
    if (busy?.impact === "alleen_licht") dur = Math.min(dur, 40);
    const built = buildWorkout(kind, dur, phase, input.goals);
    if (!built) continue;

    // Re-scale block minutes to the computed target so totals match weekly hours.
    const blocksTotal = built.blocks.reduce((s, b) => s + b.durationMin, 0);
    if (blocksTotal > 0 && Math.abs(blocksTotal - dur) > 4) {
      const factor = dur / blocksTotal;
      let adjusted = built.blocks.map((b) =>
        b.kind === "warmup" || b.kind === "cooldown"
          ? b
          : { ...b, durationMin: Math.max(2, Math.round(b.durationMin * factor)) },
      );
      const newTotal = adjusted.reduce((s, b) => s + b.durationMin, 0);
      // absorb rounding drift into the longest steady/interval block
      const drift = dur - newTotal;
      if (drift !== 0) {
        let idx = -1;
        let max = -1;
        adjusted.forEach((b, i) => {
          if (
            (b.kind === "steady" || b.kind === "interval") &&
            b.durationMin > max
          ) {
            max = b.durationMin;
            idx = i;
          }
        });
        if (idx >= 0)
          adjusted[idx] = {
            ...adjusted[idx]!,
            durationMin: Math.max(2, adjusted[idx]!.durationMin + drift),
          };
      }
      built.blocks = adjusted;
    }

    const structure: WorkoutStructure = {
      phase,
      week: weekIdx + 1,
      intensity: built.intensity,
      primaryZone: built.primaryZone,
      routeNeed: built.routeNeed,
      equipment: built.equipment,
      blocks: built.blocks,
      recoveryAdvice: built.recoveryAdvice,
      rationale: built.rationale,
    };

    const totalMin = built.blocks.reduce((s, b) => s + b.durationMin, 0);
    rows.push({
      scheduledDate: date,
      type: built.type,
      title: built.title,
      description: built.intensity,
      targetDurationMin: totalMin,
      targetTSS: tssFromBlocks(built.blocks),
      structure,
      status: "planned",
      source: "sparki",
    });
  }

  return rows;
}
