// Afwijkingskeuze — pure besliskern voor de "van de route af"-kaart.
//
// Zodra de afwijkingsdetectie (route-match.ts) een echte afwijking meldt,
// krijgt de renner een duidelijke keuzekaart met precies drie opties:
//   1. "terug"       — snelste (echt gerouteerde) weg terug naar de routelijn;
//   2. "bestemming"  — route opnieuw berekenen richting de eindbestemming;
//   3. "negeren"     — huidige route behouden, kaart sluiten.
// Wedstrijdroutes: terugkeer naar het parcours staat voorop; de volledige
// route (mét bevestigde wedstrijdpunten) wordt NOOIT automatisch vervangen —
// een vervolg is altijd een tijdelijke overlay bovenop de originele lijn.
// Geen keuze = veilige standaard: originele route blijft actief, geen enkele
// automatische herberekening, en de kaart blijft rustig staan (geen spam).

import { haversineMeters } from "@/lib/route-match";

export type OffRouteChoiceId = "terug" | "bestemming" | "negeren";

export type OffRouteOption = {
  id: OffRouteChoiceId;
  label: string;
  detail: string;
  primary: boolean;
};

/**
 * De drie keuzes, in volgorde van prominentie. Bij een wedstrijdroute staat
 * terugkeer naar het parcours voorop en draagt "bestemming" een eerlijke
 * kanttekening; de originele route + wedstrijdpunten blijven altijd bewaard.
 */
export function offRouteOptions(isRace: boolean): OffRouteOption[] {
  const terug: OffRouteOption = {
    id: "terug",
    label: "Snelste weg terug",
    detail: isRace
      ? "Terug naar het parcours — wedstrijdpunten blijven gelden."
      : "Kortste echte weg terug naar je routelijn.",
    primary: true,
  };
  const bestemming: OffRouteOption = {
    id: "bestemming",
    label: "Opnieuw naar bestemming",
    detail: isRace
      ? "Alleen als het parcours echt niet meer haalbaar is — je originele wedstrijdroute blijft bewaard."
      : "Nieuwe route vanaf hier richting je eindbestemming.",
    primary: false,
  };
  const negeren: OffRouteOption = {
    id: "negeren",
    label: "Negeren",
    detail: "Huidige route behouden; deze melding sluit.",
    primary: false,
  };
  return [terug, bestemming, negeren];
}

// ── Kaart tonen / verbergen zonder spam ────────────────────────────

export type OffRoutePromptState = {
  /** Episode waarvoor de renner "negeren" koos (kaart blijft dan dicht). */
  dismissedEpisode: number | null;
  /** Afstand tot de route (m) op het moment van negeren. */
  dismissedDistanceM: number | null;
};

export function createOffRoutePromptState(): OffRoutePromptState {
  return { dismissedEpisode: null, dismissedDistanceM: null };
}

export function registerDismiss(
  state: OffRoutePromptState,
  episode: number,
  distanceM: number,
): OffRoutePromptState {
  return { dismissedEpisode: episode, dismissedDistanceM: distanceM };
}

// Na "negeren" komt de kaart binnen dezelfde episode alleen terug bij een
// RELEVANTE verandering: de afwijking is duidelijk groter geworden.
const REPROMPT_MIN_GROWTH_M = 150;
const REPROMPT_GROWTH_FACTOR = 2;

export type OffRoutePromptInput = {
  /** Afwijking actief volgens de detectie (route-match)? */
  active: boolean;
  /** Episodeteller uit de detectie (telt per echte afwijking op). */
  episode: number;
  /** Huidige afstand tot de routelijn in meters. */
  distanceM: number;
  /** Loopt er al een gekozen vervolg (overlay) naar de route/bestemming? */
  hasDetour: boolean;
};

/**
 * Toon de keuzekaart? Puur en herhaalbaar: zelfde invoer → zelfde uitkomst,
 * dus geen flikkerende of zich herhalende meldingen.
 * - Niet afgeweken of al een vervolg gekozen → nooit tonen.
 * - Nieuwe episode → tonen (één kaart per echte afwijking).
 * - Genegeerd binnen deze episode → dicht, tenzij de afwijking relevant
 *   groeide (≥ 2× én ≥ +150 m) — dan is de situatie wezenlijk anders.
 */
export function shouldShowOffRoutePrompt(
  state: OffRoutePromptState,
  input: OffRoutePromptInput,
): boolean {
  if (!input.active || input.hasDetour) return false;
  if (state.dismissedEpisode !== input.episode) return true;
  const base = state.dismissedDistanceM;
  if (base == null || !Number.isFinite(base)) return false;
  return (
    input.distanceM >= base * REPROMPT_GROWTH_FACTOR &&
    input.distanceM - base >= REPROMPT_MIN_GROWTH_M
  );
}

// ── Herberekenlus-beveiliging ──────────────────────────────────────

// Een nieuw vervolgverzoek (rejoin) mag pas na echte verplaatsing of na een
// afkoelperiode — nooit een lus van herberekeningen op dezelfde plek.
const REJOIN_COOLDOWN_MS = 15_000;
const REJOIN_MIN_MOVE_M = 100;

export type RejoinRequestMark = {
  atMs: number;
  lat: number;
  lon: number;
};

export function allowNewRejoinRequest(
  prev: RejoinRequestMark | null,
  nowMs: number,
  pos: { lat: number; lon: number },
): boolean {
  if (!prev) return true;
  if (nowMs - prev.atMs >= REJOIN_COOLDOWN_MS) return true;
  return haversineMeters(prev, pos) >= REJOIN_MIN_MOVE_M;
}
