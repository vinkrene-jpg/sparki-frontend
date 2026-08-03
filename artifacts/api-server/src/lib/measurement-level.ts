// TRAINEN_DOELEN_SEIZOEN_01 F2 — meetniveau (as 2: wat komt er binnen).
//
// Eén systeem met minder ingangen, geen tweede systeem: dit bepaalt alleen
// welke signalen een sessie feitelijk droeg, welk meetniveau dat oplevert en
// welke eerlijke melding daarbij hoort (TD-17: nooit stil degraderen).
//
// De keuze "pro" is een voorwaarde, geen status: rijdt iemand zonder meter,
// dan valt die rit terug op het feitelijke niveau en wordt dat gezegd.

export type MeasurementLevel = "pro" | "hartslag" | "tijd_gevoel" | "aanwezigheid";

export type SessionSignals = {
  power: boolean;
  hr: boolean;
  duration: boolean;
};

// Uitleg per niveau — wat elk niveau oplevert (voor de instel-UI).
export const MEASUREMENT_LEVEL_INFO: Record<
  MeasurementLevel,
  { label: string; uitleg: string }
> = {
  pro: {
    label: "Pro",
    uitleg:
      "Vermogen én hartslag. Het volledige model: belastingscore uit vermogen, zones en intensiteit per rit.",
  },
  hartslag: {
    label: "Hartslag",
    uitleg:
      "Zones en belasting op hartslag. Zelfde raamwerk als Pro, alleen grover — geen vermogensdata nodig.",
  },
  tijd_gevoel: {
    label: "Tijd en gevoel",
    uitleg:
      "Duur, afstand en hoe het voelde (RPE). Geen zones; sturing op omvang en gevoel.",
  },
  aanwezigheid: {
    label: "Aanwezigheid",
    uitleg:
      "Alleen dát er iets gedaan is. Voor wandelen, e-bike en jonge jeugd — geen getallen.",
  },
};

// Welke signalen een sessie feitelijk droeg. Puur uit de aanwezige velden op
// het ingest-moment — nooit geraden.
export function deriveSessionSignals(row: {
  avgPower?: number | null;
  normalizedPower?: number | null;
  avgHR?: number | null;
  durationMin?: number | null;
}): SessionSignals {
  return {
    power: row.avgPower != null || row.normalizedPower != null,
    hr: row.avgHR != null,
    duration: row.durationMin != null && row.durationMin > 0,
  };
}

// Het feitelijke meetniveau dat deze signalen dragen.
export function factualLevel(signals: SessionSignals): MeasurementLevel {
  if (signals.power) return "pro";
  if (signals.hr) return "hartslag";
  if (signals.duration) return "tijd_gevoel";
  return "aanwezigheid";
}

const LEVEL_RANK: Record<MeasurementLevel, number> = {
  aanwezigheid: 0,
  tijd_gevoel: 1,
  hartslag: 2,
  pro: 3,
};

// Effectief niveau voor een rit: nooit hoger dan wat er feitelijk binnenkwam.
export function effectiveLevel(
  chosen: MeasurementLevel | null | undefined,
  signals: SessionSignals,
): MeasurementLevel {
  const factual = factualLevel(signals);
  if (!chosen) return factual;
  return LEVEL_RANK[factual] < LEVEL_RANK[chosen] ? factual : chosen;
}

// TD-17: eerlijke, korte melding per rit — wat er miste en wat dat betekende.
// Null = er miste niets ten opzichte van het gekozen niveau.
export function measurementGapNote(
  chosen: MeasurementLevel | null | undefined,
  signals: SessionSignals,
): string | null {
  const effective = effectiveLevel(chosen, signals);
  if (!chosen || LEVEL_RANK[effective] >= LEVEL_RANK[chosen]) return null;

  const miste: string[] = [];
  if (LEVEL_RANK[chosen] >= LEVEL_RANK.pro && !signals.power) miste.push("vermogen");
  if (LEVEL_RANK[chosen] >= LEVEL_RANK.hartslag && !signals.hr) miste.push("hartslag");
  if (LEVEL_RANK[chosen] >= LEVEL_RANK.tijd_gevoel && !signals.duration) miste.push("duur");
  if (miste.length === 0) return null;

  const gevolg: Record<MeasurementLevel, string> = {
    pro: "deze rit telt op vermogensniveau mee",
    hartslag: "deze rit telt op hartslagniveau mee",
    tijd_gevoel: "deze rit telt op tijd en gevoel mee",
    aanwezigheid: "deze rit telt alleen als aanwezigheid mee",
  };
  return `Bij deze rit kwam geen ${miste.join(" en geen ")} binnen — ${gevolg[effective]}, niet op je ingestelde niveau (${MEASUREMENT_LEVEL_INFO[chosen].label}).`;
}

export function isMeasurementLevel(v: unknown): v is MeasurementLevel {
  return v === "pro" || v === "hartslag" || v === "tijd_gevoel" || v === "aanwezigheid";
}
