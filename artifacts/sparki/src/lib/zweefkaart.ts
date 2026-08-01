// MEDIA_UITLEG_01 F2 — logica voor de diepte-/zweefkaart (CMP-40).
//
// Pure functies, los van React, zodat het gedrag toetsbaar is:
// 1. de toegestane-momentenlijst (PAT-28: één vrijgegeven moment, uitbreiden
//    is een besluit — nooit "omdat het toch al werkt");
// 2. de aan/uit-beslissing (flag × verminder-beweging × moment);
// 3. de kantelberekening (subtiel, geclampt, alleen tijdens aanraking).

/** Vrijgegeven momenten voor diepte. F2-pilot: uitsluitend "training voltooid". */
export const DIEPTE_MOMENTEN = Object.freeze(["training_voltooid"] as const)
export type DiepteMoment = (typeof DIEPTE_MOMENTEN)[number]

/**
 * Diepte alleen wanneer: de flag aanstaat ÉN beweging niet is verminderd
 * (systeem of Sparki-instelling) ÉN het moment op de vrijgegeven lijst staat.
 * Beweging uit ⇒ gewone kaart, identiek bruikbaar (geen functieverlies).
 */
export function shouldEnableDiepte(
  flagAan: boolean,
  motionOff: boolean,
  moment: string,
): boolean {
  return (
    flagAan &&
    !motionOff &&
    (DIEPTE_MOMENTEN as readonly string[]).includes(moment)
  )
}

export const MAX_KANTELING_GRADEN = 4
export const DRUK_SCHAAL = 0.985

/**
 * Kanteling uit de aanraakpositie binnen de kaart. Geclampt op ±4°;
 * puur transform (rotateX/rotateY/scale) — nooit layout, dus geen shift.
 * Buiten een aanraking bestaat er geen kanteling (rust = identiteit).
 */
export function computeKanteling(
  pointerX: number,
  pointerY: number,
  rect: { left: number; top: number; width: number; height: number },
): { rotateX: number; rotateY: number } {
  if (rect.width <= 0 || rect.height <= 0) return { rotateX: 0, rotateY: 0 }
  const nx = Math.min(1, Math.max(0, (pointerX - rect.left) / rect.width))
  const ny = Math.min(1, Math.max(0, (pointerY - rect.top) / rect.height))
  // Midden = 0; randen = maximaal. Y-as kantelt om X en omgekeerd.
  return {
    rotateX: (0.5 - ny) * 2 * MAX_KANTELING_GRADEN,
    rotateY: (nx - 0.5) * 2 * MAX_KANTELING_GRADEN,
  }
}

/** Rusttoestand: geen transform — de kaart is dan een gewone kaart. */
export const RUST_TRANSFORM = "none"

export function kantelTransform(k: { rotateX: number; rotateY: number }): string {
  return `perspective(900px) rotateX(${k.rotateX.toFixed(2)}deg) rotateY(${k.rotateY.toFixed(2)}deg) scale(${DRUK_SCHAAL})`
}
