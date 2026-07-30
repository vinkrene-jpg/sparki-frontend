// Officiële-kaart-controlelaag voor de route-selectie: één ingang die per
// regio de juiste overheidswegenkaart raadpleegt.
//
// - Nederland: BGT via PDOK (lib/bgt-verharding.ts, vlak-geometrie).
// - Vlaanderen: GRB via Digitaal Vlaanderen (lib/grb-verharding.ts,
//   lijn-geometrie). Wallonië/Brussel zijn NIET getoetst en doen niet mee.
// - Elders: null — eerlijk "geen bron", de selectie weegt dit dan niet mee.
//
// De regio-checks in beide lagen zijn goedkoop (punt-in-polygoon), dus buiten
// de eigen regio kost een aanroep vrijwel niets en is het antwoord null.

import { bgtUnpavedShare, routeInNetherlands } from "./bgt-verharding";
import { grbUnpavedShare } from "./grb-verharding";

/**
 * Aandeel (0..1) van een kandidaatpad dat volgens de officiële
 * overheidswegenkaart (BGT in NL, GRB in Vlaanderen) niet volledig verhard
 * is. null = geen oordeel (buiten NL/Vlaanderen, bron faalde of te dunne
 * dekking) — nooit gokken.
 */
export async function controlUnpavedShare(
  path: [number, number][],
): Promise<number | null> {
  if (!Array.isArray(path) || path.length < 2) return null;
  // routeInNetherlands bepaalt welke laag "aan zet" is; een NL-route waar de
  // BGT eerlijk null zegt (dunne dekking/bronfout) valt NIET terug op het GRB
  // (dat zou toch null geven) — dit spaart alleen de dubbele regiocheck uit.
  if (routeInNetherlands(path)) return bgtUnpavedShare(path);
  return grbUnpavedShare(path);
}
