// Performance Radar — pure, eerlijke berekening (Golf 22).
//
// Iedere as is herleidbaar: bron + periode + berekening staan in `basis`.
// Ontbreekt de data voor een as, dan is `level` null met een reden — een
// ontbrekende as wordt NOOIT als nulprestatie of neutraal getal getekend.
// Er bestaat bewust géén totaalscore: die zou verzonnen zijn.

export type RadarInputs = {
  load: { ctl: number; atl: number; tsb: number } | null;
  /** Sessies (recentste eerst) met datum + gevoel-score. */
  sessions: Array<{ sessionDate: string; feelScore: number | null }>;
  /** Huidige FTP uit het profiel (Sportpaspoort, SSOT). */
  ftpWatts: number | null;
  /** Gewicht in kg uit het profiel — nodig voor een eerlijke W/kg-schaal. */
  weightKg: number | null;
  /** "Vandaag" als JJJJ-MM-DD (lokale datum), zodat de functie puur blijft. */
  todayIso: string;
};

export type RadarAxis = {
  key: string;
  label: string;
  /** 0..1, of null wanneer de as eerlijk niet meetbaar is. */
  level: number | null;
  /** Bron + periode + berekening, in gewone taal. */
  basis: string;
  /** Alleen gevuld als level null is: wat er ontbreekt. */
  missingReason?: string;
};

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso + "T12:00:00Z").getTime();
  const b = new Date(bIso + "T12:00:00Z").getTime();
  return Math.round((a - b) / 86400000);
}

/**
 * Zes assen, elk aantoonbaar berekend uit echte data. Schalen:
 *  - Fitheid: CTL t.o.v. 80 (stevige amateurbasis) — bron: belastingsmodel.
 *  - Vorm: TSB van −30..+30 lineair naar 0..1 — bron: belastingsmodel.
 *  - Herstel: ATL t.o.v. je eigen chronische basis (ACWR omgekeerd).
 *  - Vermogen: FTP in W/kg op de schaal 2,0–5,5 W/kg — vergt FTP én gewicht.
 *  - Gevoel: gemiddelde sessie-score (1–5) laatste 28 dagen.
 *  - Regelmaat: sessies in de laatste 28 dagen t.o.v. 12 (≈3 per week).
 */
export function computePerformanceRadar(input: RadarInputs): RadarAxis[] {
  const { load, sessions, ftpWatts, weightKg, todayIso } = input;

  const recent = sessions.filter(
    (s) => daysBetween(todayIso, s.sessionDate) <= 28 && daysBetween(todayIso, s.sessionDate) >= 0,
  );
  const feelScores = recent
    .map((s) => s.feelScore)
    .filter((f): f is number => f != null);

  const axes: RadarAxis[] = [];

  const hasLoad = load != null && (load.ctl > 0 || load.atl > 0);
  axes.push({
    key: "fitness",
    label: "Fitheid",
    level: hasLoad ? clamp(load!.ctl / 80) : null,
    basis: "Fitheid (CTL) uit je belastingsmodel over 90 dagen, geschaald op CTL 80.",
    missingReason: hasLoad ? undefined : "Nog geen trainingsbelasting geregistreerd.",
  });

  axes.push({
    key: "form",
    label: "Vorm",
    level: hasLoad ? clamp((load!.tsb + 30) / 60) : null,
    basis: "Vormbalans (TSB = fitheid − vermoeidheid), −30 tot +30 geschaald naar 0–1.",
    missingReason: hasLoad ? undefined : "Nog geen trainingsbelasting geregistreerd.",
  });

  axes.push({
    key: "recovery",
    label: "Herstel",
    level:
      hasLoad && load!.ctl > 0
        ? clamp(1 - load!.atl / Math.max(load!.ctl * 1.5, 1))
        : null,
    basis: "Acute belasting (ATL) afgezet tegen je eigen chronische basis (CTL).",
    missingReason:
      hasLoad && load!.ctl > 0
        ? undefined
        : "Nog geen chronische trainingsbasis om herstel tegen af te zetten.",
  });

  const wkg = ftpWatts != null && ftpWatts > 0 && weightKg != null && weightKg > 0
    ? ftpWatts / weightKg
    : null;
  axes.push({
    key: "power",
    label: "Vermogen",
    level: wkg != null ? clamp((wkg - 2.0) / (5.5 - 2.0)) : null,
    basis: "FTP uit je Sportpaspoort gedeeld door je gewicht, op de schaal 2,0–5,5 W/kg.",
    missingReason:
      wkg != null
        ? undefined
        : ftpWatts == null || ftpWatts <= 0
          ? "FTP ontbreekt in je profiel."
          : "Gewicht ontbreekt in je profiel (nodig voor W/kg).",
  });

  axes.push({
    key: "feel",
    label: "Gevoel",
    level: feelScores.length >= 2
      ? clamp(feelScores.reduce((a, b) => a + b, 0) / feelScores.length / 5)
      : null,
    basis: "Gemiddelde gevoel-score (1–5) van je sessies in de laatste 28 dagen.",
    missingReason:
      feelScores.length >= 2
        ? undefined
        : "Minder dan twee sessies met een gevoel-score in de laatste 28 dagen.",
  });

  axes.push({
    key: "consistency",
    label: "Regelmaat",
    level: recent.length > 0 ? clamp(recent.length / 12) : null,
    basis: "Aantal sessies in de laatste 28 dagen, geschaald op 12 (≈3 per week).",
    missingReason:
      recent.length > 0 ? undefined : "Geen sessies in de laatste 28 dagen.",
  });

  return axes;
}
