// Wedstrijdmodus — pure, deterministische rekenkern voor de live navigatie.
// Geen React, geen IO: alleen wiskunde over de echte positie langs de route.
//
// Rondetelling: bij lokale ronden rijdt de renner hetzelfde parcours meerdere
// keren. De GPS-positie "wrapt" dan van het einde van de lijn terug naar het
// begin. We detecteren die wrap alleen wanneer de renner eerst aantoonbaar ver
// in de ronde was (≥ 60%) en daarna weer vroeg op de lijn zit (≤ 25%) — een
// korte GPS-sprong halverwege telt dus nooit als ronde.
//
// Finish-gate: de finishcue (vlag/geluid) mag UITSLUITEND in de laatste ronde
// verschijnen. In eerdere ronden is de streep gewoon "doorkomst".

export type RaceModeState = {
  /** Huidige ronde, 1-gebaseerd. */
  lap: number;
  /** Hoogste voortgangsfractie (0..1) die in deze ronde is waargenomen. */
  maxFrac: number;
};

export function createRaceModeState(): RaceModeState {
  return { lap: 1, maxFrac: 0 };
}

const WRAP_ARMED_FRAC = 0.6;
const WRAP_RESET_FRAC = 0.25;

/**
 * Verwerk een nieuwe positie. `traveledKm` is de afstand langs de routelijn,
 * `totalKm` de totale lengte van één ronde. Geeft de nieuwe state terug plus
 * of er zojuist een ronde is afgerond.
 */
export function updateRaceMode(
  state: RaceModeState,
  input: { traveledKm: number; totalKm: number; localLaps: number },
): { state: RaceModeState; lapCompleted: boolean } {
  const { traveledKm, totalKm, localLaps } = input;
  if (!(totalKm > 0) || localLaps <= 1) {
    return { state, lapCompleted: false };
  }
  const frac = Math.min(1, Math.max(0, traveledKm / totalKm));
  if (state.maxFrac >= WRAP_ARMED_FRAC && frac <= WRAP_RESET_FRAC) {
    // Wrap: einde ronde → begin volgende ronde (nooit voorbij het totaal).
    const lap = Math.min(localLaps, state.lap + 1);
    return { state: { lap, maxFrac: frac }, lapCompleted: lap > state.lap };
  }
  return {
    state: { lap: state.lap, maxFrac: Math.max(state.maxFrac, frac) },
    lapCompleted: false,
  };
}

/** Alleen in de laatste ronde mag de finishcue (vlag/geluid) verschijnen. */
export function finishCueAllowed(
  state: RaceModeState,
  localLaps: number | null,
): boolean {
  const laps = localLaps ?? 1;
  if (laps <= 1) return true;
  return state.lap >= laps;
}

export type RaceModePoint = {
  id: number;
  kind: string;
  label: string;
  description: string | null;
  raceKm: number | null;
};

/**
 * Eerstvolgende wedstrijdpunt vóór de renner in de huidige ronde, met de
 * afstand ernaartoe in meters. Punten zonder km doen niet mee (eerlijk: geen
 * positie = geen afstandsmelding). Finishpunten worden buiten de laatste
 * ronde overgeslagen.
 */
export function nextRacePoint(
  points: RaceModePoint[],
  traveledKm: number,
  opts: { finishAllowed: boolean },
): { point: RaceModePoint; distanceM: number } | null {
  const upcoming = points
    .filter(
      (p) =>
        p.raceKm != null &&
        p.raceKm > traveledKm + 0.015 &&
        (opts.finishAllowed || p.kind !== "finish"),
    )
    .sort((a, b) => (a.raceKm ?? 0) - (b.raceKm ?? 0));
  const point = upcoming[0];
  if (!point || point.raceKm == null) return null;
  return { point, distanceM: Math.max(0, (point.raceKm - traveledKm) * 1000) };
}
