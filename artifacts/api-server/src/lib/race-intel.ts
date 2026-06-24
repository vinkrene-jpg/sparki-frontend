// Race Intelligence — deterministic preparation, race-day report and fuelling.
//
// Pure functions over a Race (athlete-entered) + the athlete's profile. Nothing
// here invents live data: every value is either taken straight from the race
// record, derived by transparent arithmetic (and flagged `isEstimate`), or honest
// general guidance. When a field the athlete hasn't filled in is needed, the
// output says so plainly instead of fabricating a number. The term "AI" never
// appears in any user-facing string — this is framed entirely as Sparki.

import type { Race, AthleteProfile } from "@workspace/db";

// ── Shared status ────────────────────────────────────────────────────────────
export type IntelStatus = "done" | "active" | "upcoming";

// ── Preparation timeline ─────────────────────────────────────────────────────
export type PrepPhase = {
  id: string;
  /** Days before the race this milestone falls on (0 = race day). */
  daysBefore: number;
  title: string;
  focus: string;
  steps: string[];
  /** Checklist group ids this phase asks the athlete to handle. */
  checklistGroups: string[];
  /** True for the phase where Sparki asks for the organiser's technical guide. */
  askTechnicalGuide: boolean;
  /** Whether the technical-guide details are already present on the race. */
  technicalGuideReceived: boolean;
  status: IntelStatus;
};

// ── Race-day report ──────────────────────────────────────────────────────────
export type ReportItem = { label: string; value: string | null; known: boolean };
export type ReportSection = {
  id: string;
  title: string;
  /** Honest one-line read of the section (says when little is known). */
  summary: string;
  items: ReportItem[];
};
export type RaceDayReport = {
  sections: ReportSection[];
  personalNote: string;
  /** Plain-Dutch list of the things Sparki still doesn't know. */
  dataGaps: string[];
};

// ── Race fuel ────────────────────────────────────────────────────────────────
export type FuelTier = {
  id: "laag" | "midden" | "hoog";
  label: string;
  items: string[];
  note: string;
};
export type Range = { min: number; max: number };
export type RaceFuel = {
  durationKnown: boolean;
  estimatedDurationMin: number | null;
  isEstimate: boolean;
  carbsPerHourG: Range;
  totalCarbsG: Range | null;
  fluidPerHourMl: Range;
  bidons: number | null;
  gelsEstimate: number | null;
  tiers: FuelTier[];
  guidance: string[];
  note: string;
};

// ── Multi-day checklist groups ───────────────────────────────────────────────
export type ChecklistGroup = {
  id: string;
  label: string;
  /** Item ids (match PREP_CHECKLIST on the client). */
  itemIds: string[];
  itemLabels: string[];
  /** Which prep phase handles this group. */
  whenDaysBefore: number;
  instruction: string;
};

export type RaceIntel = {
  raceId: number;
  daysUntil: number;
  prep: PrepPhase[];
  report: RaceDayReport;
  fuel: RaceFuel;
  checklistGroups: ChecklistGroup[];
};

// ── Date helpers (local-midnight, like the client resolver) ──────────────────
function parseDateOnly(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
export function daysUntil(dateStr: string, today: Date = new Date()): number {
  const a = startOfDay(today).getTime();
  const b = startOfDay(parseDateOnly(dateStr)).getTime();
  return Math.round((b - a) / 86_400_000);
}

// ── Technical-guide presence ─────────────────────────────────────────────────
function hasTechnicalGuide(race: Race): boolean {
  return Boolean(
    race.course ||
      race.technicalSections ||
      race.distanceKm ||
      race.elevationM != null,
  );
}

// ── Checklist groups (spread across the days, not one big list) ──────────────
// Item ids/labels mirror PREP_CHECKLIST on the client so checked-state persists
// against the same keys via the existing /api/races/:id/checklist endpoint.
function buildChecklistGroups(): ChecklistGroup[] {
  return [
    {
      id: "materiaal_techniek",
      label: "Materiaal & techniek",
      itemIds: ["bike", "tyres", "chain"],
      itemLabels: ["Fiets", "Banden", "Ketting"],
      whenDaysBefore: 3,
      instruction:
        "Controleer fiets, banden en ketting nu — dan is er nog tijd voor reparatie of vervanging.",
    },
    {
      id: "elektronica",
      label: "Elektronica",
      itemIds: ["electronics"],
      itemLabels: ["Elektronica geladen"],
      whenDaysBefore: 2,
      instruction: "Laad fietscomputer, shifters en lampjes vandaag volledig op.",
    },
    {
      id: "klaarleggen",
      label: "Klaarleggen",
      itemIds: ["helmet", "shoes", "clothing", "bidons", "pump", "co2", "tools"],
      itemLabels: [
        "Helm",
        "Schoenen",
        "Kleding",
        "Bidons",
        "Pomp",
        "CO₂",
        "Gereedschap",
      ],
      whenDaysBefore: 1,
      instruction: "Leg alles vanavond klaar, niet morgenochtend in haast.",
    },
    {
      id: "documenten",
      label: "Documenten",
      itemIds: ["race_number", "transponder"],
      itemLabels: ["Rugnummer", "Transponder"],
      whenDaysBefore: 1,
      instruction: "Rugnummer en transponder klaar; denk ook aan licentie of ID.",
    },
    {
      id: "voeding",
      label: "Voeding",
      itemIds: ["nutrition"],
      itemLabels: ["Voeding"],
      whenDaysBefore: 1,
      instruction: "Pak je wedstrijdvoeding in volgens je fuelplan hieronder.",
    },
  ];
}

// ── Preparation timeline ─────────────────────────────────────────────────────
// Milestones at 7/5/3/2/1 days before + race day. Status is derived from how far
// off the race is: the closest milestone that hasn't passed is the active one.
export function buildPrepTimeline(race: Race, today: Date = new Date()): PrepPhase[] {
  const d = daysUntil(race.raceDate, today);
  const guideReceived = hasTechnicalGuide(race);

  const defs: Omit<PrepPhase, "status" | "technicalGuideReceived">[] = [
    {
      id: "week_out",
      daysBefore: 7,
      title: "Vorm scherpstellen",
      focus: "Laatste kwaliteit, beheerst volume",
      steps: [
        "Doe deze week je laatste scherpe intervallen — kort en gecontroleerd.",
        "Verzorg slaap en voeding nu al; vorm bouw je niet op in één dag.",
      ],
      checklistGroups: [],
      askTechnicalGuide: false,
    },
    {
      id: "plan_logistics",
      daysBefore: 5,
      title: "Plan & logistiek",
      focus: "Reis, tijden en team vastleggen",
      steps: [
        "Leg je vertrektijd, reistijd en parkeerplek vast.",
        "Stem af met teamgenoten die meerijden of -racen.",
      ],
      checklistGroups: [],
      askTechnicalGuide: false,
    },
    {
      id: "technical_guide",
      daysBefore: 3,
      title: "Technische gids",
      focus: "Parcours leren kennen + materiaalcheck",
      steps: guideReceived
        ? [
            "Technische gids ontvangen — ik verwerk parcours, afstand en hoogtemeters in je rapport.",
            "Controleer fiets, banden en ketting; nu is er nog tijd voor reparatie.",
          ]
        : [
            "Stuur me de technische gids van de organisatie, dan verwerk ik parcours, afstand, hoogtemeters en lastige delen.",
            "Controleer fiets, banden en ketting; nu is er nog tijd voor reparatie.",
          ],
      checklistGroups: ["materiaal_techniek"],
      askTechnicalGuide: true,
    },
    {
      id: "taper",
      daysBefore: 2,
      title: "Taper & rust",
      focus: "Minder volume, fris worden",
      steps: [
        "Minder volume, behoud scherpte met een paar korte prikkels.",
        "Laad je elektronica op en visualiseer de race rustig.",
      ],
      checklistGroups: ["elektronica"],
      askTechnicalGuide: false,
    },
    {
      id: "day_before",
      daysBefore: 1,
      title: "Klaarleggen",
      focus: "Alles klaar, vroeg slapen",
      steps: [
        "Eet koolhydraatrijk en vermijd nieuwe gerechten.",
        "Loop je checklist na en leg alles klaar.",
        "Ga op tijd naar bed; de nacht ervóór telt mee.",
      ],
      checklistGroups: ["klaarleggen", "documenten", "voeding"],
      askTechnicalGuide: false,
    },
    {
      id: "race_day",
      daysBefore: 0,
      title: "Uitvoeren",
      focus: "Timings, fuel en focus",
      steps: [
        "Volg je dagplanning: ontbijt, vertrek, warming-up, start.",
        "Begin vroeg met aanvullen volgens je fuelplan.",
      ],
      checklistGroups: [],
      askTechnicalGuide: false,
    },
  ];

  // Active = the milestone closest to today that hasn't passed yet, i.e. the
  // largest daysBefore that is still <= daysUntil. Anything with a larger
  // daysBefore has already gone by (done); the rest are upcoming.
  let activeIdx = -1;
  defs.forEach((p, i) => {
    if (p.daysBefore <= d && (activeIdx === -1 || p.daysBefore > defs[activeIdx]!.daysBefore)) {
      activeIdx = i;
    }
  });

  return defs.map((p, i) => {
    let status: IntelStatus;
    if (d < 0) status = "done";
    else if (i === activeIdx) status = "active";
    else if (p.daysBefore > d) status = "done";
    else status = "upcoming";
    return { ...p, technicalGuideReceived: guideReceived, status };
  });
}

// ── Race fuel ────────────────────────────────────────────────────────────────
// Rough average race speeds by discipline (km/h), used ONLY to estimate duration
// when the athlete has entered a distance. Conservative and clearly flagged as an
// estimate; the athlete-facing copy tells them to adjust to their real pace.
const DISCIPLINE_SPEED_KMH: Record<string, number> = {
  weg: 34,
  wegwedstrijd: 34,
  road: 34,
  criterium: 38,
  crit: 38,
  tijdrit: 40,
  "time trial": 40,
  gravel: 26,
  mtb: 18,
  mountainbike: 18,
  veldrijden: 24,
  cyclocross: 24,
};

function estimateDurationMin(race: Race): number | null {
  const km = race.distanceKm != null ? Number(race.distanceKm) : null;
  if (km == null || !Number.isFinite(km) || km <= 0) return null;
  const key = (race.discipline ?? "").trim().toLowerCase();
  const speed = DISCIPLINE_SPEED_KMH[key] ?? 33;
  return Math.round((km / speed) * 60);
}

function fuelTiers(): FuelTier[] {
  return [
    {
      id: "laag",
      label: "Laag budget",
      items: [
        "Banaan",
        "Witte rijst met honing of jam",
        "Zelfgemaakte havermout- of rijstreep",
        "Verdund vruchtensap met een snuf zout",
      ],
      note: "Levert dezelfde koolhydraten als gels, voor een fractie van de prijs.",
    },
    {
      id: "midden",
      label: "Gemengd",
      items: [
        "Eigen repen + 1–2 gels voor de finale",
        "Bidon met sportdrank uit poeder",
        "Mueslireep of ontbijtkoek",
      ],
      note: "Combineer goedkoop met gemak waar het er echt toe doet.",
    },
    {
      id: "hoog",
      label: "Kant-en-klaar",
      items: [
        "Energiegels",
        "Energierepen",
        "Isotone sportdrank (kant-en-klaar)",
      ],
      note: "Gemak en exacte dosering — niet nodig om goed te presteren.",
    },
  ];
}

export function buildRaceFuel(race: Race): RaceFuel {
  const estimatedDurationMin = estimateDurationMin(race);
  const durationKnown = estimatedDurationMin != null;
  const hours = durationKnown ? estimatedDurationMin! / 60 : null;

  // Carbohydrate target per hour follows common endurance fuelling guidance
  // (matches the conservative thresholds used elsewhere in Sparki).
  let carbsPerHourG: Range;
  if (hours == null) carbsPerHourG = { min: 30, max: 60 };
  else if (estimatedDurationMin! < 75) carbsPerHourG = { min: 0, max: 30 };
  else if (estimatedDurationMin! <= 150) carbsPerHourG = { min: 30, max: 60 };
  else carbsPerHourG = { min: 60, max: 90 };

  const totalCarbsG =
    hours != null
      ? {
          min: Math.round(carbsPerHourG.min * hours),
          max: Math.round(carbsPerHourG.max * hours),
        }
      : null;

  const fluidPerHourMl: Range = { min: 500, max: 750 };
  const bidons = hours != null ? Math.max(1, Math.ceil(hours)) : null;

  // A gel carries ~25 g carbs; estimate only for races long enough to fuel on
  // the bike, assuming roughly half the carbs come from gels.
  const gelsEstimate =
    totalCarbsG != null && estimatedDurationMin! >= 75
      ? Math.max(1, Math.round((totalCarbsG.min + totalCarbsG.max) / 2 / 50))
      : null;

  const guidance = [
    "Test alles eerst in training — nooit iets nieuws op wedstrijddag.",
    "Begin vroeg met aanvullen, niet pas als je leeg bent.",
    "Drink met regelmaat, ook als je nog geen dorst hebt.",
  ];

  const note = durationKnown
    ? `Geschat op ~${Math.round((estimatedDurationMin! / 60) * 10) / 10} uur rijden — pas aan op je eigen tempo en de afstand.`
    : "Vul de afstand van de race in voor een nauwkeuriger plan; dit is algemene richtlijn per uur.";

  return {
    durationKnown,
    estimatedDurationMin,
    isEstimate: true,
    carbsPerHourG,
    totalCarbsG,
    fluidPerHourMl,
    bidons,
    gelsEstimate,
    tiers: fuelTiers(),
    guidance,
    note,
  };
}

// ── Race-day report ──────────────────────────────────────────────────────────
const PRIORITY_LABEL: Record<string, string> = {
  A: "A-doel",
  B: "B-wedstrijd",
  C: "C-wedstrijd",
};

function formatRaceDate(dateStr: string): string {
  const date = parseDateOnly(dateStr);
  return date.toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function item(label: string, value: string | null | undefined): ReportItem {
  const v = value != null && String(value).trim() !== "" ? String(value) : null;
  return { label, value: v, known: v != null };
}

function courseCharacter(race: Race): string {
  const km = race.distanceKm != null ? Number(race.distanceKm) : null;
  const elev = race.elevationM ?? null;
  if (km != null && elev != null && km > 0) {
    const perKm = elev / km;
    if (perKm >= 12)
      return `Stevig klimwerk: ~${elev} m over ${km} km. Verdeel je krachten en spaar voor de cols.`;
    if (perKm >= 5)
      return `Glooiend parcours: ~${elev} m over ${km} km. Selectie valt waarschijnlijk op de hellingen.`;
    return `Overwegend vlak: ~${elev} m over ${km} km. Reken op een gesloten koers en finale.`;
  }
  if (km != null && km > 0) return `Afstand ${km} km; hoogtemeters nog onbekend.`;
  return "Koerskarakter nog onbekend — voeg afstand en hoogtemeters toe via de technische gids.";
}

function attentionPoints(race: Race): ReportItem[] {
  const out: ReportItem[] = [];
  if (race.technicalSections)
    out.push(item("Technische delen", race.technicalSections));
  if (race.weatherNote) out.push(item("Weer", race.weatherNote));
  if (race.coachInstructions)
    out.push(item("Van je coach", race.coachInstructions));
  if (race.priority === "A")
    out.push({
      label: "Doel",
      value: "A-doel: details en rust maken nu het verschil.",
      known: true,
    });
  if (out.length === 0)
    out.push({
      label: "Aandachtspunten",
      value: null,
      known: false,
    });
  return out;
}

function personalNote(race: Race, athlete: AthleteProfile | null, d: number): string {
  const parts: string[] = [];
  const priority = PRIORITY_LABEL[race.priority] ?? race.priority;

  if (d > 1) parts.push(`Nog ${d} dagen tot ${race.name}.`);
  else if (d === 1) parts.push(`Morgen is het zover: ${race.name}.`);
  else if (d === 0) parts.push(`Vandaag rijd je ${race.name}.`);
  else parts.push(`${race.name} zit erop.`);

  if (race.priority === "A")
    parts.push("Dit is een A-doel — alles wat je nu doet, telt mee.");
  else if (race.priority === "C")
    parts.push("Een C-wedstrijd: zie het als training met een rugnummer.");
  else parts.push(`Een ${priority} om scherp op te bouwen.`);

  if (athlete?.experienceLevel === "beginner")
    parts.push("Houd het simpel: goed eten, op tijd zijn, en geniet ervan.");
  else if (
    athlete?.competitionLevel === "national" ||
    athlete?.experienceLevel === "elite"
  )
    parts.push("Je weet wat je moet doen — vertrouw op je voorbereiding.");
  else parts.push("Vertrouw op je plan en blijf bij je eigen koers.");

  return parts.join(" ");
}

export function buildRaceDayReport(
  race: Race,
  athlete: AthleteProfile | null,
  today: Date = new Date(),
): RaceDayReport {
  const d = daysUntil(race.raceDate, today);

  const basisItems: ReportItem[] = [
    item("Wedstrijd", race.name),
    item("Datum", formatRaceDate(race.raceDate)),
    item("Start", race.startTime),
    item("Locatie", race.location),
    item("Discipline", race.discipline),
    {
      label: "Prioriteit",
      value: PRIORITY_LABEL[race.priority] ?? race.priority,
      known: true,
    },
  ];

  const courseItems: ReportItem[] = [
    item("Afstand", race.distanceKm != null ? `${race.distanceKm} km` : null),
    item("Hoogtemeters", race.elevationM != null ? `${race.elevationM} m` : null),
    item("Parcours", race.course),
    item("Technische delen", race.technicalSections),
  ];

  const fuel = buildRaceFuel(race);
  const fuelSummary = fuel.totalCarbsG
    ? `Richt op ${fuel.carbsPerHourG.min}–${fuel.carbsPerHourG.max} g koolhydraten per uur (±${fuel.totalCarbsG.min}–${fuel.totalCarbsG.max} g totaal) en ${fuel.fluidPerHourMl.min}–${fuel.fluidPerHourMl.max} ml drinken per uur.`
    : `Richt op ${fuel.carbsPerHourG.min}–${fuel.carbsPerHourG.max} g koolhydraten en ${fuel.fluidPerHourMl.min}–${fuel.fluidPerHourMl.max} ml drinken per uur. Vul de afstand in voor totalen.`;

  const mentalItems: ReportItem[] = [
    {
      label: "Mindset",
      value:
        race.priority === "A"
          ? "Focus op je eigen plan en de eerste belangrijke fase; laat de rest los."
          : "Blijf rustig, rijd je eigen koers en gebruik dit om te leren.",
      known: true,
    },
  ];
  if (race.startTime)
    mentalItems.push(
      item("Routine", `Plan je opbouw rond de start om ${race.startTime}.`),
    );

  const sections: ReportSection[] = [
    {
      id: "basisinfo",
      title: "Basisinfo",
      summary: basisItems.every((i) => i.known)
        ? "Alle kerngegevens staan klaar."
        : "Een paar kerngegevens ontbreken nog.",
      items: basisItems,
    },
    {
      id: "koerskarakter",
      title: "Koerskarakter",
      summary: courseCharacter(race),
      items: courseItems,
    },
    {
      id: "aandachtspunten",
      title: "Aandachtspunten",
      summary:
        attentionPoints(race).some((i) => i.known)
          ? "Hier let je extra op."
          : "Nog geen specifieke aandachtspunten bekend.",
      items: attentionPoints(race),
    },
    {
      id: "voeding",
      title: "Voeding & hydratatie",
      summary: fuelSummary,
      items: [
        item(
          "Per uur",
          `${fuel.carbsPerHourG.min}–${fuel.carbsPerHourG.max} g koolhydraten · ${fuel.fluidPerHourMl.min}–${fuel.fluidPerHourMl.max} ml`,
        ),
        item(
          "Bidons",
          fuel.bidons != null ? `± ${fuel.bidons}` : null,
        ),
      ],
    },
    {
      id: "mentaal",
      title: "Mentale voorbereiding",
      summary: "Kom met rust en vertrouwen aan de start.",
      items: mentalItems,
    },
  ];

  // Honest list of what Sparki still doesn't know.
  const dataGaps: string[] = [];
  if (!race.startTime) dataGaps.push("starttijd");
  if (!race.location) dataGaps.push("locatie");
  if (race.distanceKm == null) dataGaps.push("afstand");
  if (race.elevationM == null) dataGaps.push("hoogtemeters");
  if (!race.technicalSections) dataGaps.push("technische delen");
  if (!race.weatherNote) dataGaps.push("weersinschatting");

  return {
    sections,
    personalNote: personalNote(race, athlete, d),
    dataGaps,
  };
}

// ── Combined ─────────────────────────────────────────────────────────────────
export function buildRaceIntel(
  race: Race,
  athlete: AthleteProfile | null,
  today: Date = new Date(),
): RaceIntel {
  return {
    raceId: race.id,
    daysUntil: daysUntil(race.raceDate, today),
    prep: buildPrepTimeline(race, today),
    report: buildRaceDayReport(race, athlete, today),
    fuel: buildRaceFuel(race),
    checklistGroups: buildChecklistGroups(),
  };
}
