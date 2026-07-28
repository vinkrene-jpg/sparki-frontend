// Pure presentatielogica voor het Core-Analysescherm (/lab, flag: commercial_shell).
// Geen React en geen data-fetching — alles hier is deterministisch en direct
// testbaar (test:core-analyse). Berekeningen blijven waar ze horen
// (lib/performance-radar, engines, API): dit bestand vertaalt uitsluitend
// bestaande waarden naar presentatie — toestanden, labels en tekstuele
// alternatieven voor grafieken. Eerlijk by design: geen enkele functie hier
// verzint een waarde; ontbreekt iets, dan is het antwoord null.

// ── Gegevens-toestand per sectie ─────────────────────────────────────────────
// Vertaling van react-query-status naar één eerlijke presentatietoestand.
//  - laden      → eerste keer laden, nog niets te tonen (skeleton);
//  - fout       → verversen mislukt én geen cache: geen cijfers tonen;
//  - verouderd  → er ís cache, maar de laatste verversing faalde: tonen mag,
//                 uitsluitend mét duidelijke melding (opdracht data-trust);
//  - leeg       → bron werkt, maar er is echt nog geen inhoud;
//  - ok         → verse gegevens.
export type AnalyseToestand = "laden" | "fout" | "verouderd" | "leeg" | "ok";

export function analyseToestand(input: {
  isLoading: boolean;
  isError: boolean;
  hasData: boolean;
}): AnalyseToestand {
  if (input.isLoading && !input.hasData) return "laden";
  if (input.isError) return input.hasData ? "verouderd" : "fout";
  if (!input.hasData) return "leeg";
  return "ok";
}

/** Strengste toestand wint wanneer een sectie op meerdere bronnen leunt. */
export function combineerToestanden(
  ...toestanden: AnalyseToestand[]
): AnalyseToestand {
  if (toestanden.includes("fout")) return "fout";
  if (toestanden.includes("laden")) return "laden";
  if (toestanden.includes("verouderd")) return "verouderd";
  if (toestanden.includes("leeg")) return "leeg";
  return "ok";
}

/** "5 minuten geleden" — alleen uit een echt tijdstip; anders null. */
export function laatstBijgewerktLabel(
  dataUpdatedAt: number | null | undefined,
  nu: number,
): string | null {
  if (dataUpdatedAt == null || dataUpdatedAt <= 0 || nu < dataUpdatedAt) {
    return null;
  }
  const minuten = Math.floor((nu - dataUpdatedAt) / 60_000);
  if (minuten < 1) return "minder dan een minuut geleden";
  if (minuten < 60) {
    return minuten === 1 ? "1 minuut geleden" : `${minuten} minuten geleden`;
  }
  const uren = Math.floor(minuten / 60);
  if (uren < 24) return uren === 1 ? "1 uur geleden" : `${uren} uur geleden`;
  const dagen = Math.floor(uren / 24);
  return dagen === 1 ? "1 dag geleden" : `${dagen} dagen geleden`;
}

// ── Periodefilter (bestaande keuze 14/30/90 dagen) ───────────────────────────
export const ANALYSE_PERIODES = [14, 30, 90] as const;
export type AnalysePeriode = (typeof ANALYSE_PERIODES)[number];

export function periodeLabel(dagen: number): string {
  return `${dagen} dagen`;
}

// ── Kopregels ────────────────────────────────────────────────────────────────
/** Profielcontext onder de paginatitel — alleen echte onderdelen. */
export function contextRegel(
  profiel:
    | {
        displayName?: string | null;
        ftp?: number | null;
        wkg?: string | number | null;
      }
    | null
    | undefined,
): string | null {
  if (!profiel) return null;
  const delen: string[] = [profiel.displayName || "Atleet"];
  if (profiel.ftp) delen.push(`FTP ${profiel.ftp}W`);
  if (profiel.wkg) delen.push(`${profiel.wkg} W/kg`);
  return delen.join(" · ");
}

/** Dekking van de radar — bestaande eerlijke copy, ongewijzigd. */
export function dekkingRegel(meetbaar: number, totaal: number): string {
  return meetbaar === totaal
    ? "Alle zes signalen berekend uit je eigen data."
    : `${meetbaar} van ${totaal} signalen meetbaar — alleen die worden getekend.`;
}

// ── FTP-weergave (zelfde semantiek als de bestaande FtpBars) ─────────────────
export type FtpTest = { ftpWatts: number; measuredAt: string };

export function ftpWeergave(
  history: FtpTest[],
  huidigeFtp: number | null | undefined,
): {
  gesorteerd: FtpTest[];
  getoond: number | null;
  bronIsProfiel: boolean;
  deltaAllTime: number;
  maxWatts: number;
} {
  const gesorteerd = [...history].sort((a, b) =>
    a.measuredAt.localeCompare(b.measuredAt),
  );
  const eerste = gesorteerd[0]?.ftpWatts ?? 0;
  const laatste = gesorteerd[gesorteerd.length - 1]?.ftpWatts ?? 0;
  const deltaAllTime = gesorteerd.length > 0 ? laatste - eerste : 0;
  const getoond =
    huidigeFtp ?? (gesorteerd.length > 0 ? laatste : null);
  const maxWatts =
    gesorteerd.length > 0
      ? Math.max(...gesorteerd.map((h) => h.ftpWatts))
      : 0;
  return {
    gesorteerd,
    getoond,
    bronIsProfiel: huidigeFtp != null,
    deltaAllTime,
    maxWatts,
  };
}

/** Maandlabel bij een FTP-test; UTC-middag voorkomt de lokale-datum-val. */
export function maandLabel(measuredAt: string): string {
  return new Date(measuredAt + "T12:00:00Z").toLocaleDateString("nl-NL", {
    month: "short",
  });
}

// ── Dagmetingen → reeksen (bestaande afbeeldingen, ongewijzigd) ──────────────
export type DagMetriek = { feelScore?: number | null; hrv?: number | null };

/** Readiness-reeks: oudste eerst, gevoel 1–5 → 0–100, gaten eerlijk weggelaten. */
export function readinessReeks(metrics: DagMetriek[]): number[] {
  return metrics
    .slice()
    .reverse()
    .filter((m) => m.feelScore != null)
    .map((m) => Math.round((m.feelScore! / 5) * 100));
}

export function hrvReeks(metrics: DagMetriek[]): number[] {
  return metrics
    .slice()
    .reverse()
    .filter((m) => m.hrv != null)
    .map((m) => m.hrv!);
}

export function hrvVandaag(metrics: DagMetriek[]): number | null {
  return metrics[0]?.hrv ?? null;
}

/** Verschil met gisteren — alleen wanneer beide dagen echt gemeten zijn. */
export function hrvDelta(metrics: DagMetriek[]): number | null {
  const vandaag = metrics[0]?.hrv;
  const gisteren = metrics[1]?.hrv;
  if (vandaag == null || gisteren == null) return null;
  return Math.round(vandaag - gisteren);
}

// ── Tekstuele alternatieven voor grafieken (toegankelijkheid) ────────────────
// Samenvattingen bevatten uitsluitend echte meetwaarden; bij te weinig data
// is er geen samenvatting (null) — nooit een verzonnen beschrijving.
export function reeksSamenvatting(
  naam: string,
  waarden: number[],
  eenheid: string,
): string | null {
  if (waarden.length < 2) return null;
  const eerste = waarden[0];
  const laatste = waarden[waarden.length - 1];
  const laagste = Math.min(...waarden);
  const hoogste = Math.max(...waarden);
  return `${naam}: ${waarden.length} metingen, van ${eerste} naar ${laatste} ${eenheid}; laagste ${laagste}, hoogste ${hoogste} ${eenheid}.`;
}

export function radarSamenvatting(
  assen: Array<{ label: string; level: number }>,
): string | null {
  if (assen.length < 3) return null;
  const delen = assen.map(
    (a) => `${a.label} ${Math.round(a.level * 100)} van 100`,
  );
  return `Performance-radar met ${assen.length} meetbare signalen: ${delen.join(", ")}.`;
}

export function ftpSamenvatting(gesorteerd: FtpTest[]): string | null {
  if (gesorteerd.length === 0) return null;
  const eerste = gesorteerd[0];
  const laatste = gesorteerd[gesorteerd.length - 1];
  if (gesorteerd.length === 1) {
    return `FTP-verloop: 1 test, ${eerste.ftpWatts} watt (${maandLabel(eerste.measuredAt)}).`;
  }
  return `FTP-verloop: ${gesorteerd.length} tests, van ${eerste.ftpWatts} watt (${maandLabel(eerste.measuredAt)}) naar ${laatste.ftpWatts} watt (${maandLabel(laatste.measuredAt)}).`;
}

// ── Sessieregels ─────────────────────────────────────────────────────────────
export function sessieDatumLabel(sessionDate: string): string {
  return new Date(sessionDate + "T12:00:00Z").toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });
}

export function sessieTitel(s: {
  title?: string | null;
  type: string;
}): string {
  if (s.title) return s.title;
  return s.type.charAt(0).toUpperCase() + s.type.slice(1);
}

export function sessieDuurLabel(durationMin: number | null | undefined): string | null {
  return durationMin != null ? `${durationMin} min` : null;
}

/** Belastingscore uit de sessie; niet-numeriek → null (nooit 0 verzinnen). */
export function sessieBelasting(tss: unknown): number | null {
  if (tss == null) return null;
  const n = Number(tss);
  return Number.isFinite(n) ? Math.round(n) : null;
}

// ── Vaste copy (één plek, zoals de commerciële schil) ────────────────────────
export const ANALYSE_COPY = {
  paginaTitel: "Analyse",
  paginaOnderschrift: "Begrijp je vorm — alles hieronder komt uit je eigen data.",
  verouderd: "Verouderde gegevens — verversen is niet gelukt.",
  laatstBijgewerkt: "Laatst bijgewerkt",
  opnieuw: "Opnieuw proberen",
  radarFout: "Je performance-radar kon niet geladen worden.",
  metriekenFout: "Je dagmetingen konden niet geladen worden.",
  ftpFout: "Je FTP-geschiedenis kon niet geladen worden.",
  sessiesFout: "Je recente sessies konden niet geladen worden.",
  foutBeschrijving:
    "Er worden geen vervangende cijfers getoond — probeer het opnieuw.",
} as const;
