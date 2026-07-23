// HUD-databalk: deterministische lay-outkeuze per meetwaarde.
//
// Iedere meetwaarde (snelheid, vermogen, hartslag, cadans, afstanden, tijd,
// percentage) staat in een eigen begrensde container. Waarde en eenheid mogen
// die container nooit uitlopen of een buur overlappen. Past de eenheid niet
// meer naast de waarde (grote getallen, groot systeemlettertype, smal scherm),
// dan gaat de eenheid ONDER de waarde staan — waarde dominant, eenheid kleiner
// maar leesbaar. Pure functies zodat dit gedrag testbaar is zonder UI.

export const METRIC_VALUE_FONT = 22;
export const METRIC_UNIT_FONT = 12;
// Gemiddelde tekenbreedte als fractie van de fontgrootte (Inter semibold,
// cijfers zijn tabulair-achtig breed). Bewust ruim genomen: liever een keer
// te vroeg stapelen dan overlappen.
const VALUE_CHAR_W = 0.64;
const UNIT_CHAR_W = 0.6;
// Ruimte tussen waarde en eenheid wanneer ze naast elkaar staan.
const INLINE_GAP_PX = 4;

export type MetricTextLayout = "inline" | "stacked";

/** Geschatte breedte (px) van waarde + eenheid naast elkaar. */
export function estimateInlineWidthPx(
  value: string,
  unit: string,
  fontScale: number,
): number {
  const scale = clampFontScale(fontScale);
  const valueW = value.length * METRIC_VALUE_FONT * VALUE_CHAR_W * scale;
  const unitW = unit.length * METRIC_UNIT_FONT * UNIT_CHAR_W * scale;
  return valueW + (unit ? INLINE_GAP_PX + unitW : 0);
}

/** Systeemlettergrootte begrensd: 0 of onzin telt als 1, extreem groot als 2. */
export function clampFontScale(fontScale: number): number {
  if (!Number.isFinite(fontScale) || fontScale <= 0) return 1;
  return Math.min(2, Math.max(0.8, fontScale));
}

/**
 * Kies de lay-out voor één meetwaarde binnen zijn container.
 * - Past waarde + eenheid naast elkaar → "inline".
 * - Past dat niet (grote waarde, brede eenheid, smal scherm of groot
 *   systeemlettertype) → "stacked": eenheid onder de waarde.
 * - Onbekende containerbreedte (eerste render, width 0) → veilig "stacked"
 *   zodra de gecombineerde tekst lang is; nooit gokken op ruimte.
 */
export function chooseMetricLayout(
  value: string,
  unit: string,
  containerWidthPx: number,
  fontScale = 1,
): MetricTextLayout {
  if (!unit) return "inline";
  if (!Number.isFinite(containerWidthPx) || containerWidthPx <= 0) {
    // Breedte nog onbekend: conservatief op tekstlengte.
    return value.length + unit.length > 6 ? "stacked" : "inline";
  }
  return estimateInlineWidthPx(value, unit, fontScale) <= containerWidthPx
    ? "inline"
    : "stacked";
}

/** Verdeel de balkbreedte over n gelijke metric-containers (met tussenlijnen). */
export function metricContainerWidthPx(
  barWidthPx: number,
  metricCount: number,
  dividerPx = 1,
  paddingPx = 12,
): number {
  if (!Number.isFinite(barWidthPx) || barWidthPx <= 0 || metricCount <= 0) return 0;
  const inner = barWidthPx - paddingPx * 2 - dividerPx * Math.max(0, metricCount - 1);
  return Math.max(0, inner / metricCount);
}
