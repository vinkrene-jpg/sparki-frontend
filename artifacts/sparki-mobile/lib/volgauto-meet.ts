// Volgauto-aansluitpuntlogica (puur, deterministisch) — Opdracht 3.
//
// De volgauto rijdt zijn EIGEN autoroute; de fietsroute blijft volledig
// intact. Deze module kiest het eerstvolgende aansluitpunt vóór de renner,
// wisselt STABIEL van aansluitpunt (geen heen-en-weer springen) en rekent
// eerlijke, als "geschat" gemarkeerde wachttijden uit. Geen netwerk, geen
// verzonnen zekerheid: zonder verse positie is er geen ETA.

export type Meetpoint = {
  /** Km-positie op de FIETSroute. */
  bikeKm: number;
  /** Km-positie op de AUTOroute (null = auto komt hier niet dichtbij langs). */
  carKm: number | null;
  lat: number;
  lon: number;
  /** "parkeerplaats" (echte OSM-parking ≤400 m) of "route" (routepunt). */
  kind: string;
  label: string;
};

export type MeetChoiceState = {
  /** Index in de meetpoints-lijst van het actieve aansluitpunt, of null. */
  activeIndex: number | null;
  /** Kandidaat waarnaar we mogelijk wisselen + sinds wanneer die beter is. */
  candidateIndex: number | null;
  candidateSinceMs: number | null;
};

export function createMeetChoiceState(): MeetChoiceState {
  return { activeIndex: null, candidateIndex: null, candidateSinceMs: null };
}

/** Hoelang een kandidaat-aansluitpunt beter moet blijven vóór we wisselen. */
export const SWITCH_STABILITY_MS = 120_000;

/**
 * Eerstvolgend aansluitpunt vóór de renner (op fiets-km), met een kleine
 * marge zodat een net gepasseerd punt niet blijft hangen.
 */
export function nextMeetpointIndex(
  meetpoints: Meetpoint[],
  riderBikeKm: number,
): number | null {
  for (let i = 0; i < meetpoints.length; i++) {
    if (meetpoints[i]!.bikeKm > riderBikeKm + 0.05) return i;
  }
  return null;
}

/**
 * Stabiele keuze van het actieve aansluitpunt:
 * - gepasseerd punt → DIRECT door naar het volgende (met melding);
 * - een ANDER (verderop gelegen) beter punt pas na SWITCH_STABILITY_MS
 *   onafgebroken voorkeur, zodat de bestuurder geen jojo-aanwijzingen krijgt.
 */
export function updateMeetChoice(
  state: MeetChoiceState,
  input: { meetpoints: Meetpoint[]; riderBikeKm: number; nowMs: number },
): { state: MeetChoiceState; switched: boolean } {
  const { meetpoints, riderBikeKm, nowMs } = input;
  const preferred = nextMeetpointIndex(meetpoints, riderBikeKm);
  if (preferred == null) {
    const changed = state.activeIndex !== null;
    return {
      state: { activeIndex: null, candidateIndex: null, candidateSinceMs: null },
      switched: changed,
    };
  }
  if (state.activeIndex == null) {
    return {
      state: { activeIndex: preferred, candidateIndex: null, candidateSinceMs: null },
      switched: false,
    };
  }
  const active = meetpoints[state.activeIndex];
  // Gepasseerd (of verdwenen) actief punt → meteen doorschuiven.
  if (!active || active.bikeKm <= riderBikeKm + 0.05) {
    return {
      state: { activeIndex: preferred, candidateIndex: null, candidateSinceMs: null },
      switched: true,
    };
  }
  if (preferred === state.activeIndex) {
    return {
      state: { ...state, candidateIndex: null, candidateSinceMs: null },
      switched: false,
    };
  }
  // Ander punt heeft de voorkeur — pas wisselen na aanhoudende stabiliteit.
  if (state.candidateIndex !== preferred || state.candidateSinceMs == null) {
    return {
      state: { ...state, candidateIndex: preferred, candidateSinceMs: nowMs },
      switched: false,
    };
  }
  if (nowMs - state.candidateSinceMs >= SWITCH_STABILITY_MS) {
    return {
      state: { activeIndex: preferred, candidateIndex: null, candidateSinceMs: null },
      switched: true,
    };
  }
  return { state, switched: false };
}

/**
 * Geschatte aankomsttijden bij het aansluitpunt. ALTIJD "geschat": zonder
 * bekende snelheid gelden voorzichtige standaardsnelheden (renner 27 km/u,
 * auto 40 km/u). Negatieve resterende afstand telt als aangekomen (0 s).
 */
export function estimateMeetEta(input: {
  meet: Meetpoint;
  riderBikeKm: number;
  riderSpeedMps: number | null;
  carKm: number | null;
  carSpeedMps: number | null;
}): { riderEtaSec: number; carEtaSec: number | null; waitSec: number | null } {
  const riderSpeed =
    input.riderSpeedMps != null && input.riderSpeedMps > 1
      ? input.riderSpeedMps
      : 27 / 3.6;
  const riderEtaSec = Math.max(
    0,
    Math.round(((input.meet.bikeKm - input.riderBikeKm) * 1000) / riderSpeed),
  );
  if (input.carKm == null || input.meet.carKm == null) {
    return { riderEtaSec, carEtaSec: null, waitSec: null };
  }
  const carSpeed =
    input.carSpeedMps != null && input.carSpeedMps > 1
      ? input.carSpeedMps
      : 40 / 3.6;
  const carEtaSec = Math.max(
    0,
    Math.round(((input.meet.carKm - input.carKm) * 1000) / carSpeed),
  );
  return { riderEtaSec, carEtaSec, waitSec: carEtaSec - riderEtaSec };
}

/** Positie ouder dan dit telt eerlijk als "geen positie bekend". */
export const POSITION_FRESH_MS = 3 * 60_000;

export function isPositionFresh(updatedAtMs: number, nowMs: number): boolean {
  return nowMs - updatedAtMs <= POSITION_FRESH_MS;
}

/** Nederlandse wachttijd-regel, altijd expliciet "geschat". */
export function formatWaitLine(waitSec: number | null): string {
  if (waitSec == null) return "Geen recente positie van de renner bekend.";
  if (Math.abs(waitSec) < 60) return "Jullie komen naar schatting gelijk aan.";
  const min = Math.round(Math.abs(waitSec) / 60);
  return waitSec > 0
    ? `Je bent er naar schatting ${min} min ná de renner.`
    : `Naar schatting ${min} min wachten op de renner.`;
}

/** Melding wanneer de auto niet bij de fietslijn kan komen. */
export const CAR_BLOCKED_NOTICE =
  "De fietsroute is hier niet toegankelijk voor auto's. Je wordt naar een aansluitpunt verderop geleid.";
