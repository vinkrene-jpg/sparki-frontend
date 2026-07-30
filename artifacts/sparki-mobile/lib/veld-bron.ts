// Per-veld herkomstlabels voor het rit-detail — zelfde vertaling als op web
// (VELD_BRON_LABELS in artifacts/sparki/src/components/sparki/
// session-detail-drawer.tsx). Onbekende ruwe waarden tonen we letterlijk —
// nooit raden; ontbrekende herkomst is eerlijk "onbekend".

export type Herkomst = {
  bron: string;
  bronnen: string[];
  veldBronnen: Record<string, string> | null;
  handmatigeVelden: string[] | null;
} | null;

export const VELD_BRON_LABELS: Record<string, string> = {
  manual: "handmatig",
  strava: "Strava",
  garmin: "Garmin",
  wahoo: "Wahoo",
  file: "bestand",
  gpx: "GPX-bestand",
  fit: "FIT-bestand",
  tcx: "TCX-bestand",
  sensor: "sensor",
  mobiel: "Sparki-app",
  mobile: "Sparki-app",
  sparki: "Sparki",
  coach: "coach",
  derived: "berekend",
  import: "bestand",
};

export function veldBronLabel(raw: string): string {
  return VELD_BRON_LABELS[raw.toLowerCase()] ?? raw;
}

/**
 * De leverende bron voor één ritgegeven, uit de Data Origin-laag.
 * - null zolang de herkomst nog niet geladen is (geen gok tonen)
 * - "handmatig aangepast" voor handmatig overschreven velden
 * - vertaald bronlabel wanneer de bron vastligt
 * - "onbekend" wanneer de herkomst geladen is maar dit veld ontbreekt
 */
export function bronVoorVeld(herkomst: Herkomst | undefined, field: string): string | null {
  if (herkomst == null) return null;
  if ((herkomst.handmatigeVelden ?? []).includes(field)) return "handmatig aangepast";
  const raw = herkomst.veldBronnen?.[field];
  if (raw) return veldBronLabel(raw);
  return "onbekend";
}
