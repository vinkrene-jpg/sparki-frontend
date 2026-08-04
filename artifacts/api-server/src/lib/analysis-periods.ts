// Pure period/date helpers for the Analyse endpoints (powercurve-periodes en
// weekzoneverdeling). Alles rekent op LOKALE kalenderdagen: sessionDate is een
// 'YYYY-MM-DD' string in lokale tijd, dus "vandaag" mag nooit via
// toISOString() (UTC-dag-val) worden bepaald.

/** Lokale kalenderdag als 'YYYY-MM-DD' — nooit via toISOString (UTC-val). */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Datumstring ± n dagen, in lokale kalenderdagen. */
export function shiftDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  dt.setDate(dt.getDate() + days);
  return localDateStr(dt);
}

/**
 * Grenzen voor de powercurve-periodevergelijking: twee even lange,
 * niet-overlappende blokken van exact `blockDays` kalenderdagen.
 * - recent:   [recentStart .. today]           (blockDays dagen, incl. vandaag)
 * - previous: [previousStart .. recentStart-1] (blockDays dagen)
 */
export function powerBestPeriods(
  today: string,
  blockDays = 42,
): { recentStart: string; previousStart: string } {
  return {
    recentStart: shiftDateStr(today, -(blockDays - 1)),
    previousStart: shiftDateStr(today, -(2 * blockDays - 1)),
  };
}

/** Maandag (lokale kalenderdag) van de week waar `dateStr` in valt. */
export function mondayOf(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  const dow = (dt.getDay() + 6) % 7; // 0 = maandag
  dt.setDate(dt.getDate() - dow);
  return localDateStr(dt);
}
