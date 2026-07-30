// Racefiets-verificatie van het wegdek (afkeurregel René 30-07-2026, taak
// #487): onbekend wegdek is op de racefiets niet-verifieerbaar en dus géén
// zachte tolerantie. Zolang er een onbekend (niet-geverifieerd) aandeel is,
// wordt de route nooit als "geschikt voor racefiets" aanbevolen en is hij
// alleen te gebruiken na een expliciete keuze van de renner.
//
// Twee eerlijke bronnen, in volgorde van gezag:
// 1. het wegdekscherm (actuele OSM-tags + BGT/GRB-aanvulling) — dit is de
//    meting ná de officiële-kaart-controlelaag;
// 2. de motor-meting (engineSurface.knownPct) — direct beschikbaar bij de
//    kandidaat, nog vóór het scherm geladen is.
// Zonder enige meting kan verificatie niet geclaimd worden ("niet gemeten").

export type RacefietsVerificationStatus =
  | "geverifieerd"
  | "niet_volledig_geverifieerd"
  | "niet_gemeten"

export type RacefietsVerification = {
  status: RacefietsVerificationStatus
  // Onbekend aandeel in % (0–100); null als er geen meting is.
  onbekendPct: number | null
  bron: "scherm" | "motor" | null
}

export function racefietsVerification(
  bikeType: string | null | undefined,
  engineKnownPct: number | null | undefined,
  schermOnbekendPct: number | null | undefined,
): RacefietsVerification | null {
  if (bikeType !== "racefiets") return null
  if (schermOnbekendPct != null) {
    const pct = Math.round(schermOnbekendPct * 10) / 10
    return pct <= 0.05
      ? { status: "geverifieerd", onbekendPct: 0, bron: "scherm" }
      : { status: "niet_volledig_geverifieerd", onbekendPct: pct, bron: "scherm" }
  }
  if (engineKnownPct != null) {
    const pct = Math.round((100 - engineKnownPct) * 10) / 10
    return pct <= 0.05
      ? { status: "geverifieerd", onbekendPct: 0, bron: "motor" }
      : { status: "niet_volledig_geverifieerd", onbekendPct: pct, bron: "motor" }
  }
  return { status: "niet_gemeten", onbekendPct: null, bron: null }
}
