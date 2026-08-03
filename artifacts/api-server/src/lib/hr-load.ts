// TRAINEN_DOELEN_SEIZOEN_01 F3 — belasting op hartslag (pure).
//
// Voor sessies ZONDER vermogen: een deterministische belastingmaat uit
// hartslag, met de hartslagreserve uit rust- en maximale hartslag
// (Karvonen). Zelfde vorm als de vermogensdefinitie zodat de getallen
// vergelijkbaar aanvoelen, maar de maat blijft APART herkenbaar — nooit
// optellen met de vermogensbelasting (tss).
//
//   IF_hr  = (gem. hartslag − rust) / (max − rust)
//   hrLoad = (duur in uren) × IF_hr² × 100
//
// Ontbreekt een ingrediënt of is het resultaat onaannemelijk, dan null —
// de sessie blijft eerlijk zonder belasting, precies zoals nu.

export type DeriveHrLoadInput = {
  durationMin: number | null | undefined;
  avgHR: number | null | undefined;
  restingHr: number | null | undefined;
  maxHr: number | null | undefined;
};

export function deriveHrLoad(input: DeriveHrLoadInput): number | null {
  const duration = input.durationMin;
  const avg = input.avgHR;
  const rust = input.restingHr;
  const max = input.maxHr;
  if (
    duration == null || !Number.isFinite(duration) || duration < 1 ||
    avg == null || !Number.isFinite(avg) || avg < 40 || avg > 230 ||
    rust == null || !Number.isFinite(rust) || rust < 25 || rust > 110 ||
    max == null || !Number.isFinite(max) || max < 120 || max > 230 ||
    max - rust < 40
  ) {
    return null;
  }
  const reserve = (avg - rust) / (max - rust);
  // Een gemiddelde onder rust of boven max betekent verkeerde instellingen of
  // corrupte data — daar een score uit afleiden zou het model vergiftigen.
  if (reserve <= 0 || reserve > 1.05) return null;
  const clamped = Math.min(reserve, 1);
  const hrLoad = Math.round((duration / 60) * clamped * clamped * 100);
  if (hrLoad < 0 || hrLoad > 1000) return null;
  return hrLoad;
}
