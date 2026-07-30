// Pure logica voor het professionele planoverzicht op /train.
// Alles hier is deterministisch en testbaar zonder DOM of netwerk:
// - niveaukeuze → welke wizardstappen een sporter te zien krijgt
// - gedempte doelverschuiving (pas melden bij betekenisvolle impact)
// - plan-naleving over een venster (gepland vs. aantoonbaar uitgevoerd)

import type { PlannedWorkout } from "@/lib/athlete-types";

// ── Niveaus (adaptieve wizard) ───────────────────────────────────────────────

export type NiveauId = "recreatief" | "sportief" | "wedstrijd" | "continentaal";

export type Niveau = {
  id: NiveauId;
  label: string;
  beschrijving: string;
  /** Backend-enum voor athlete_profiles.experienceLevel */
  experienceLevel: "beginner" | "intermediate" | "advanced" | "elite";
};

export const NIVEAUS: Niveau[] = [
  {
    id: "recreatief",
    label: "Recreatief",
    beschrijving: "Ik fiets voor plezier en fitheid — geen wedstrijden.",
    experienceLevel: "beginner",
  },
  {
    id: "sportief",
    label: "Sportief",
    beschrijving: "Ik train gericht en wil beter worden (toertochten, gran fondo's).",
    experienceLevel: "intermediate",
  },
  {
    id: "wedstrijd",
    label: "Wedstrijd",
    beschrijving: "Ik rijd (regionale) wedstrijden en train daar serieus voor.",
    experienceLevel: "advanced",
  },
  {
    id: "continentaal",
    label: "Nationaal / continentaal",
    beschrijving: "Ik koers op hoog niveau — mijn planning moet daarop sturen.",
    experienceLevel: "elite",
  },
];

export type WizardStapId =
  | "niveau"
  | "beschikbaarheid"
  | "agenda"
  | "belastbaarheid"
  | "voorkeuren"
  | "samenvatting";

/**
 * Adaptief: hoe hoger het niveau, hoe meer vragen.
 * - recreatief: niveau + beschikbaarheid + agenda
 * - sportief: + belastbaarheid/blessures
 * - wedstrijd/continentaal: + trainingsvoorkeuren & discipline
 */
export function wizardStappenVoorNiveau(niveau: NiveauId): WizardStapId[] {
  const basis: WizardStapId[] = ["niveau", "beschikbaarheid", "agenda"];
  if (niveau === "recreatief") return [...basis, "samenvatting"];
  if (niveau === "sportief") return [...basis, "belastbaarheid", "samenvatting"];
  return [...basis, "belastbaarheid", "voorkeuren", "samenvatting"];
}

// ── Gedempte doelverschuiving ────────────────────────────────────────────────

export type Doelverschuiving = {
  /** Alleen true bij betekenisvolle impact — kleine missers blijven stil. */
  tonen: boolean;
  gemisteTrainingen: number;
  geplandeMinuten: number;
  gemisteMinuten: number;
  boodschap: string | null;
};

function isGemist(w: PlannedWorkout, vandaagISO: string): boolean {
  return (
    w.scheduledDate < vandaagISO &&
    w.type !== "rest" &&
    (w.status === "planned" || w.status === "modified") &&
    w.sessionId == null
  );
}

/**
 * Kijkt naar de afgelopen `dagen` (standaard 14) en meldt een verschuiving
 * van het doel alléén als de impact betekenisvol is:
 * ≥3 gemiste trainingen, of ≥50% van de geplande minuten niet aantoonbaar
 * uitgevoerd (bij minimaal 2 geplande trainingen). Eén gemiste rit of een
 * dagelijkse aanpassing verschuift het doel dus nooit zichtbaar.
 */
export function berekenDoelverschuiving(
  workouts: PlannedWorkout[],
  vandaagISO: string,
  dagen = 14,
): Doelverschuiving {
  const vanaf = new Date(vandaagISO + "T12:00:00Z");
  vanaf.setUTCDate(vanaf.getUTCDate() - dagen);
  const vanafISO = vanaf.toISOString().slice(0, 10);

  const venster = workouts.filter(
    (w) =>
      w.scheduledDate >= vanafISO &&
      w.scheduledDate < vandaagISO &&
      w.type !== "rest" &&
      w.status !== "cancelled" &&
      w.status !== "skipped",
  );

  const geplandeMinuten = venster.reduce(
    (som, w) => som + (w.targetDurationMin ?? 0),
    0,
  );
  const gemiste = venster.filter((w) => isGemist(w, vandaagISO));
  const gemisteMinuten = gemiste.reduce(
    (som, w) => som + (w.targetDurationMin ?? 0),
    0,
  );

  const veelGemist = gemiste.length >= 3;
  const halfGemist =
    venster.length >= 2 &&
    geplandeMinuten > 0 &&
    gemisteMinuten / geplandeMinuten >= 0.5;

  const tonen = veelGemist || halfGemist;
  let boodschap: string | null = null;
  if (tonen) {
    const uren = Math.round((gemisteMinuten / 60) * 10) / 10;
    boodschap =
      `In de afgelopen ${dagen} dagen zijn ${gemiste.length} geplande trainingen` +
      ` (±${uren} uur) niet aantoonbaar uitgevoerd. Dat is genoeg om je opbouw` +
      ` te vertragen — houd rekening met een iets latere piek of pas je plan aan.`;
  }

  return {
    tonen,
    gemisteTrainingen: gemiste.length,
    geplandeMinuten,
    gemisteMinuten,
    boodschap,
  };
}

// ── Plan-naleving (voor /train én /analyse) ─────────────────────────────────

export type PlanNaleving = {
  gepland: number;
  uitgevoerd: number;
  /** null zolang er te weinig geplande trainingen zijn om iets te zeggen */
  pct: number | null;
};

/**
 * Naleving over de afgelopen `dagen`: hoeveel geplande (niet-rust, niet-
 * geannuleerde/overgeslagen) trainingen zijn aantoonbaar uitgevoerd
 * (gekoppelde sessie of status completed). Uploads en connector-imports
 * tellen mee zodra de bestaande koppeling ze aan een training linkt.
 */
export function berekenPlanNaleving(
  workouts: PlannedWorkout[],
  vandaagISO: string,
  dagen = 28,
): PlanNaleving {
  const vanaf = new Date(vandaagISO + "T12:00:00Z");
  vanaf.setUTCDate(vanaf.getUTCDate() - dagen);
  const vanafISO = vanaf.toISOString().slice(0, 10);

  const venster = workouts.filter(
    (w) =>
      w.scheduledDate >= vanafISO &&
      w.scheduledDate < vandaagISO &&
      w.type !== "rest" &&
      w.status !== "cancelled" &&
      w.status !== "skipped",
  );
  const uitgevoerd = venster.filter(
    (w) => w.sessionId != null || w.status === "completed",
  );

  return {
    gepland: venster.length,
    uitgevoerd: uitgevoerd.length,
    pct:
      venster.length >= 3
        ? Math.round((uitgevoerd.length / venster.length) * 100)
        : null,
  };
}

export type SnelleActie = "verkorten" | "verlengen" | "verplaatsen";

// ── Seizoenslijn ────────────────────────────────────────────────────────────

const FASE_LABEL: Record<string, string> = {
  base: "Basis",
  build: "Opbouw",
  peak: "Piek",
  taper: "Taper",
};

export function faseLabel(fase: string | null | undefined): string | null {
  if (!fase) return null;
  return FASE_LABEL[fase] ?? null;
}

function dagLabel(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Som van geplande minuten in de week van `weekMaandagISO` (niet-rust, telt mee). */
function weekMinuten(workouts: PlannedWorkout[], weekMaandagISO: string): number {
  const eind = new Date(weekMaandagISO + "T12:00:00Z");
  eind.setUTCDate(eind.getUTCDate() + 6);
  const eindISO = eind.toISOString().slice(0, 10);
  return workouts
    .filter(
      (w) =>
        w.scheduledDate >= weekMaandagISO &&
        w.scheduledDate <= eindISO &&
        w.type !== "rest" &&
        w.status !== "cancelled" &&
        w.status !== "skipped",
    )
    .reduce((som, w) => som + (w.targetDurationMin ?? 0), 0);
}

export type SnelleAanpassing = {
  /** Kan de actie worden uitgevoerd? Zo niet, dan staat er een eerlijke reden. */
  kan: boolean;
  reden: string | null;
  nieuweDuurMin: number | null;
  nieuweTSS: number | null;
  nieuweDatum: string | null;
  /** Eén eerlijke consequentiezin die vóór het bevestigen wordt getoond. */
  consequentie: string | null;
};

/**
 * Berekent deterministisch wat een snelle aanpassing doet met deze training,
 * de weekminuten/TSS en — gedempt — het doel. Nooit verzonnen getallen: alles
 * volgt uit de echte geplande duur/TSS. Ontbreekt de geplande duur, dan is
 * schalen eerlijk niet mogelijk.
 */
export function berekenSnelleAanpassing(args: {
  workout: PlannedWorkout;
  actie: SnelleActie;
  alleWorkouts: PlannedWorkout[];
  vandaagISO: string;
  nieuweDatum?: string | null;
}): SnelleAanpassing {
  const { workout, actie, alleWorkouts, vandaagISO } = args;
  const geen: SnelleAanpassing = {
    kan: false,
    reden: null,
    nieuweDuurMin: null,
    nieuweTSS: null,
    nieuweDatum: null,
    consequentie: null,
  };

  const weekMaandag = maandagVanISO(workout.scheduledDate);
  const weekVoor = weekMinuten(alleWorkouts, weekMaandag);

  if (actie === "verkorten" || actie === "verlengen") {
    if (workout.targetDurationMin == null) {
      return {
        ...geen,
        reden:
          "Deze training heeft geen geplande duur, dus verkorten of verlengen met 25% is niet te berekenen.",
      };
    }
    const factor = actie === "verkorten" ? 0.75 : 1.25;
    const oud = workout.targetDurationMin;
    const nieuw = Math.round(oud * factor);
    if (actie === "verkorten" && nieuw < 15) {
      return {
        ...geen,
        reden: `Verkorten maakt deze training korter dan 15 minuten (${nieuw} min) — sla hem dan liever over.`,
      };
    }
    const deltaMin = nieuw - oud;
    const oudTSS = workout.targetTSS;
    const nieuwTSS = oudTSS != null ? Math.round(oudTSS * factor) : null;
    const deltaTSS = oudTSS != null && nieuwTSS != null ? nieuwTSS - oudTSS : null;
    const weekNa = weekVoor + deltaMin;
    const teken = (n: number) => (n > 0 ? `+${n}` : String(n));
    const tssDeel = deltaTSS != null ? `, ${teken(deltaTSS)} TSS` : "";
    const consequentie =
      `Van ${oud} naar ${nieuw} min (${teken(deltaMin)} min${tssDeel}). ` +
      `Deze week gaat van ${weekVoor} naar ${weekNa} geplande minuten. ` +
      doelZin(deltaMin, weekVoor);
    return {
      kan: true,
      reden: null,
      nieuweDuurMin: nieuw,
      nieuweTSS: nieuwTSS,
      nieuweDatum: null,
      consequentie,
    };
  }

  // ── Verplaatsen ──
  const nieuweDatum = args.nieuweDatum ?? null;
  if (!nieuweDatum) return { ...geen, reden: "Kies eerst een dag om naartoe te verplaatsen." };
  if (nieuweDatum < vandaagISO)
    return { ...geen, reden: "Verplaatsen naar een dag in het verleden kan niet." };
  if (nieuweDatum === workout.scheduledDate)
    return { ...geen, reden: "Dat is dezelfde dag — kies een andere dag." };

  const bezet = alleWorkouts.some(
    (w) =>
      w.id !== workout.id &&
      w.scheduledDate === nieuweDatum &&
      w.type !== "rest" &&
      w.status !== "cancelled" &&
      w.status !== "skipped",
  );
  const bezetDeel = bezet ? " Let op: op die dag staat al een training." : "";

  const doelMaandag = maandagVanISO(nieuweDatum);
  const duur = workout.targetDurationMin ?? 0;
  let consequentie: string;
  if (doelMaandag === weekMaandag) {
    consequentie =
      `Verplaatst naar ${dagLabel(nieuweDatum)}. ` +
      `Je weekminuten en TSS blijven gelijk; alleen de timing schuift.` +
      bezetDeel;
  } else {
    const weekNa = weekVoor - duur;
    const doelWeekVoor = weekMinuten(alleWorkouts, doelMaandag);
    consequentie =
      `Verplaatst naar ${dagLabel(nieuweDatum)}. ` +
      `Deze week gaat van ${weekVoor} naar ${weekNa} geplande minuten; ` +
      `de week van ${dagLabel(doelMaandag)} gaat van ${doelWeekVoor} naar ${doelWeekVoor + duur}. ` +
      `Je totale belasting blijft gelijk — ` +
      doelZin(-duur, weekVoor).toLowerCase().replace(/^dit is/, "de verschuiving is") +
      bezetDeel;
  }
  return {
    kan: true,
    reden: null,
    nieuweDuurMin: null,
    nieuweTSS: null,
    nieuweDatum,
    consequentie,
  };
}

/** Gedempt: alleen bij betekenisvolle impact zeggen we iets over het doel. */
function doelZin(deltaMin: number, weekMin: number): string {
  const betekenisvol =
    Math.abs(deltaMin) >= 60 ||
    (weekMin > 0 && Math.abs(deltaMin) / weekMin >= 0.25);
  return betekenisvol
    ? "Dit is groot genoeg om je opbouw merkbaar te beïnvloeden."
    : "Je doel verschuift hier niet merkbaar door.";
}

// ── Periodisering in de kalender (taak 450) ────────────────────────────────
//
// Spiegelt exact de faseafleiding van de server (training-plan.ts):
// dagen tot de eerstvolgende doelwedstrijd → fase. Zonder wedstrijd is er
// geen faseverloop — dan tonen we eerlijk niets.

export type Fase = "base" | "build" | "peak" | "taper";

/** Fase-venster in dagen-tot-wedstrijd: [ondergrens, bovengrens]. */
const FASE_VENSTER: Record<Exclude<Fase, "base">, [number, number]> = {
  taper: [0, 10],
  peak: [11, 28],
  build: [29, 70],
};

export function faseVoorDagen(dagenTotRace: number): Fase {
  if (dagenTotRace <= 10) return "taper";
  if (dagenTotRace <= 28) return "peak";
  if (dagenTotRace <= 70) return "build";
  return "base";
}

function dagenTussen(vanISO: string, totISO: string): number {
  const van = new Date(vanISO + "T12:00:00Z").getTime();
  const tot = new Date(totISO + "T12:00:00Z").getTime();
  return Math.round((tot - van) / 86_400_000);
}

/** Fase waarin een kalenderdag valt, afgeleid van de wedstrijddatum.
 *  null zonder wedstrijd of voor dagen ná de wedstrijd. */
export function faseVoorDatum(iso: string, raceDateISO: string | null | undefined): Fase | null {
  if (!raceDateISO) return null;
  const dagen = dagenTussen(iso, raceDateISO);
  if (dagen < 0) return null;
  return faseVoorDagen(dagen);
}

export type FaseWeekPositie = {
  fase: Fase;
  faseLabel: string;
  /** Hoeveelste week binnen deze fase (1-gebaseerd). */
  weekNr: number;
  /** Totaal aantal weken dat deze fase beslaat. */
  totaalWeken: number;
  /** Resterende weken in deze fase (incl. de huidige). */
  resterendeWeken: number;
};

/**
 * "Week 2 van 3 in de piekfase" — deterministisch uit dagen-tot-wedstrijd.
 * Basisfase heeft geen einde (geen venster) → null, eerlijk geen weeknummer.
 */
export function faseWeekPositie(dagenTotRace: number | null | undefined): FaseWeekPositie | null {
  if (dagenTotRace == null || dagenTotRace < 0) return null;
  const fase = faseVoorDagen(dagenTotRace);
  if (fase === "base") return null;
  const [onder, boven] = FASE_VENSTER[fase];
  const spanDagen = boven - onder + 1;
  const totaalWeken = Math.ceil(spanDagen / 7);
  const resterendeDagen = dagenTotRace - onder; // 0 = laatste dag van de fase
  const resterendeWeken = Math.min(totaalWeken, Math.floor(resterendeDagen / 7) + 1);
  const weekNr = totaalWeken - resterendeWeken + 1;
  return {
    fase,
    faseLabel: FASE_LABEL[fase] ?? fase,
    weekNr,
    totaalWeken,
    resterendeWeken,
  };
}

// ── Weektypering (volume/intensiteit-indicator per kalenderweek) ────────────

export type WeekTypering = {
  /** Som van geplande minuten (niet-rust, niet-geannuleerd/overgeslagen). */
  minuten: number;
  /** Aantal meetellende trainingen. */
  trainingen: number;
  /** Aandeel intensieve sessies (primaire zone ≥ 4), 0..1; null zonder trainingen. */
  aandeelIntensief: number | null;
};

function isIntensief(w: PlannedWorkout): boolean {
  if (w.structure?.primaryZone != null) return w.structure.primaryZone >= 4;
  const t = `${w.type} ${w.title ?? ""}`.toLowerCase();
  return t.includes("interval") || t.includes("sprint") || t.includes("vo2");
}

export function weekTypering(workouts: PlannedWorkout[], weekMaandagISO: string): WeekTypering {
  const eind = new Date(weekMaandagISO + "T12:00:00Z");
  eind.setUTCDate(eind.getUTCDate() + 6);
  const eindISO = eind.toISOString().slice(0, 10);
  const venster = workouts.filter(
    (w) =>
      w.scheduledDate >= weekMaandagISO &&
      w.scheduledDate <= eindISO &&
      w.type !== "rest" &&
      w.status !== "cancelled" &&
      w.status !== "skipped",
  );
  const minuten = venster.reduce((som, w) => som + (w.targetDurationMin ?? 0), 0);
  const intensief = venster.filter(isIntensief).length;
  return {
    minuten,
    trainingen: venster.length,
    aandeelIntensief: venster.length > 0 ? intensief / venster.length : null,
  };
}

// ── Vandaag-staat (bovenste blok op /train) ─────────────────────────────────

export type VandaagStaat =
  | { soort: "training"; workout: PlannedWorkout }
  | { soort: "rust"; workout: PlannedWorkout }
  | { soort: "gat" };

function isRust(type: string): boolean {
  const t = type.toLowerCase();
  return t.includes("rest") || t.includes("rust") || t.includes("off");
}

/** Elke dag heeft precies één verklaarde staat — nooit een leeg, onverklaard blok. */
export function bepaalVandaagStaat(workout: PlannedWorkout | undefined | null): VandaagStaat {
  if (!workout || workout.status === "cancelled") return { soort: "gat" };
  if (isRust(workout.type)) return { soort: "rust", workout };
  return { soort: "training", workout };
}

/** "20 min opwarming (Z2) · 4×8 min interval (Z4) · …" — alleen uit echte blokken. */
export function blokkenZin(structure: PlannedWorkout["structure"]): string | null {
  const blokken = structure?.blocks ?? [];
  if (blokken.length === 0) return null;
  return blokken
    .map((b) => {
      const reps = b.reps != null && b.reps > 1 ? `${b.reps}×` : "";
      return `${reps}${b.durationMin} min ${b.label || b.kind} (Z${b.zone})`;
    })
    .join(" · ");
}

/** Eén doel-zin voor de sessie richting het einddoel — nooit verzonnen. */
export function sessieDoelZin(w: PlannedWorkout): string | null {
  return w.structure?.rationale?.supportsGoal ?? w.description ?? null;
}

// ── Ontwikkelingszin (CTL-trend expliciet aan het doel koppelen) ────────────

export type OntwikkelingTrend = {
  zin: string;
  /** true wanneer de trend afwijkt van wat de fase vraagt — zichtbaar signaal. */
  afwijking: boolean;
};

/**
 * Deterministische één-regel-koppeling tussen CTL-trend en doel.
 * - < 14 datapunten → null (de UI toont dan een eerlijke lege staat).
 * - Verwachting per fase: basis/opbouw = stijgend; piek = vasthoudend/stijgend;
 *   taper = dalend is juist goed (frisheid).
 */
export function ontwikkelingTrend(args: {
  chartData: Array<{ date: string; ctl: number }> | undefined;
  fase: Fase | null | undefined;
  doelNaam: string | null;
  doelDatum: string | null;
}): OntwikkelingTrend | null {
  const data = args.chartData ?? [];
  if (data.length < 14) return null;
  const venster = data.slice(-28);
  const eerste = venster[0]!.ctl;
  const laatste = venster[venster.length - 1]!.ctl;
  const delta = Math.round((laatste - eerste) * 10) / 10;
  const dagen = venster.length;

  const doelDeel = args.doelNaam
    ? args.doelDatum
      ? `${args.doelNaam} (${new Date(args.doelDatum + "T12:00:00Z").toLocaleDateString("nl-NL", { day: "numeric", month: "long" })})`
      : args.doelNaam
    : null;

  const fase = args.fase ?? null;
  const richting = delta >= 1 ? "stijgt" : delta <= -1 ? "daalt" : "blijft gelijk";

  if (!doelDeel) {
    return {
      zin: `Je fitheid (CTL) ${richting} met ${delta >= 0 ? "+" : ""}${delta} over de laatste ${dagen} dagen. Koppel een doel om deze trend aan je opbouw te toetsen.`,
      afwijking: false,
    };
  }

  let afwijking = false;
  let oordeel: string;
  if (fase === "taper") {
    oordeel = delta <= 1
      ? "je bouwt belasting af richting je doel — precies wat de taper vraagt"
      : "je belasting stijgt nog, terwijl de taper juist om afbouw vraagt";
    afwijking = delta > 1;
  } else if (fase === "peak") {
    oordeel = delta >= -1
      ? "je houdt je vorm vast in de piekfase, passend bij het schema"
      : "je fitheid zakt in de piekfase — dat wijkt af van het schema";
    afwijking = delta < -1;
  } else {
    // base / build / onbekend: opbouw hoort te stijgen
    oordeel = delta >= 1
      ? "je bouwt volgens schema op"
      : "je opbouw stagneert — dat wijkt af van het opbouwtempo richting je doel";
    afwijking = delta < 1;
  }

  return {
    zin: `Je fitheid (CTL) ${richting} met ${delta >= 0 ? "+" : ""}${delta} over de laatste ${dagen} dagen richting ${doelDeel}: ${oordeel}.`,
    afwijking,
  };
}

/** Maandag (ISO) van de lokale week waarin deze ISO-datum valt. */
export function maandagVanISO(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // ma=0 … zo=6
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}
