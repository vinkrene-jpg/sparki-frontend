// Route aanpassen op het nieuwe mobiele routescherm (ROUTEPLANNER_MOBIEL_01
// R7/R16). Pure gebarenlogica + één orchestrator die per aanpassing PRECIES
// ÉÉN routeaanvraag bouwt en aflevert. Het scherm (route-scherm.tsx) blijft
// dun: Leaflet-handlers vertalen gebaren naar deze functies.

import type { GenerateRouteInput, RouteCandidate, Sport } from "@/hooks/use-routes"
import type { ClimbDetail } from "@/lib/climb-types"

export type ViaPunt = [number, number]

export type AanpassingReden =
  | "punt-verslepen"
  | "waypoint"
  | "inkorten"
  | "uitkorten"
  | "klim"

// ── Pure gebaren op de via-puntenlijst ──────────────────────────────────

// Tik op de routelijn: pin de route daar vast (nieuw via-punt op de lijn).
export function viaNaPin(via: ViaPunt[], punt: ViaPunt): ViaPunt[] {
  return [...via, punt]
}

// Sleep een bestaand punt naar een nieuwe plek.
export function viaNaSleep(via: ViaPunt[], index: number, nieuw: ViaPunt): ViaPunt[] {
  return via.map((p, i) => (i === index ? nieuw : p))
}

// Tik op een punt: verwijder het.
export function viaNaVerwijderen(via: ViaPunt[], index: number): ViaPunt[] {
  return via.filter((_, i) => i !== index)
}

// In-/uitkorten: ±25% op de huidige doelafstand, met een eerlijke ondergrens.
export function afstandNaInkorten(huidigKm: number): number {
  return Math.max(5, Math.round(huidigKm * 0.75))
}
export function afstandNaUitkorten(huidigKm: number): number {
  return Math.round(huidigKm * 1.25)
}

// ── Orchestrator: één aanpassing = één routeaanvraag ────────────────────

export type AanpassingContext = {
  bezig: boolean
  center: { lat: number; lon: number } | null
  kandidaat: Pick<
    RouteCandidate,
    "sport" | "trainingType" | "targetDistanceKm" | "distanceKm"
  > | null
  fallbackTrainingType: string | null
  fallbackAfstandKm: number
  viaPunten: ViaPunt[]
  // Canoniek klimdetail (op osmId geladen) + voet uit het klimprofiel — de
  // klim reist alleen mee wanneer beide er echt zijn (eerlijkheid).
  klimDetail: Pick<ClimbDetail, "osmId" | "name" | "lat" | "lon"> | null
  klimVoet: ViaPunt | null
}

export type Aanpassing = {
  reden: AanpassingReden
  via?: ViaPunt[]
  afstand?: number
}

// Bouwt de éne generate-input voor een aanpassing, of null wanneer de
// aanpassing niet mag starten (al bezig / geen kandidaat / geen startpunt).
export function bouwAanpassingsInput(
  ctx: AanpassingContext,
  aanpassing: Aanpassing,
): GenerateRouteInput | null {
  if (ctx.bezig || !ctx.center || !ctx.kandidaat) return null
  const via = aanpassing.via ?? ctx.viaPunten
  const afstand =
    aanpassing.afstand ??
    ctx.kandidaat.targetDistanceKm ??
    ctx.kandidaat.distanceKm ??
    ctx.fallbackAfstandKm
  // Fail-closed: een klim reist ALLEEN mee wanneer zowel het canonieke
  // detail als de voet er echt zijn — anders géén via-punten én géén
  // climbCheck (de API wijst climbCheck zonder via-punten terecht af).
  const klim = ctx.klimDetail && ctx.klimVoet ? ctx.klimDetail : null
  const klimVia: ViaPunt[] =
    klim && ctx.klimVoet ? [ctx.klimVoet, [klim.lat, klim.lon]] : []
  return {
    mode: "loop",
    sport: ctx.kandidaat.sport as Sport,
    startLat: ctx.center.lat,
    startLon: ctx.center.lon,
    trainingType:
      ctx.kandidaat.trainingType || ctx.fallbackTrainingType || "duurtraining",
    targetDistanceKm: afstand,
    viaPoints:
      via.length > 0 || klimVia.length > 0 ? [...via, ...klimVia] : undefined,
    climbCheck: klim
      ? {
          osmId: klim.osmId,
          name: klim.name,
          summitLat: klim.lat,
          summitLon: klim.lon,
        }
      : undefined,
  }
}

// Voert een aanpassing uit: bouwt de input en levert hem PRECIES ÉÉN keer af
// bij `verstuur` (R16). Retourneert true wanneer er een aanvraag is gestart.
export function voerAanpassingUit(
  ctx: AanpassingContext,
  aanpassing: Aanpassing,
  verstuur: (input: GenerateRouteInput) => void,
  log: (regel: string) => void = () => undefined,
): boolean {
  const input = bouwAanpassingsInput(ctx, aanpassing)
  if (!input) return false
  // R16 — meetbaar in logging: één aanpassing, één routeaanvraag.
  log(`[route-scherm] aanpassing "${aanpassing.reden}" → één routeaanvraag`)
  verstuur(input)
  return true
}
