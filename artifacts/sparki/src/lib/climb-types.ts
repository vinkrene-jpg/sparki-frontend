// Shared types for the Klimmenverkenner (climb explorer). Mirror the honest
// API shapes: every field either carries a real value or is explicitly null.

export type ClimbHit = {
  osmId: string
  name: string
  lat: number
  lon: number
  elevationM: number | null
  kind: "pass" | "peak"
  hasDescription: boolean
}

export type ClimbSearchResult = {
  area: { label: string; lat: number; lon: number } | null
  climbs: ClimbHit[]
}

export type DerivedClimbProfile = {
  lengthKm: number
  avgGradePct: number
  maxGradePct: number
  elevationGainM: number
  profile: number[]
  derived: true
}

export type ClimbDescription = {
  text: string
  source: "osm" | "wikipedia" | "wikidata"
  sourceUrl: string | null
} | null

export type ClimbDetail = {
  osmId: string
  name: string
  lat: number
  lon: number
  elevationM: number | null
  kind: "pass" | "peak"
  description: ClimbDescription
  profile: DerivedClimbProfile | null
  profileUnavailableReason: string | null
}

export const KIND_LABEL: Record<ClimbHit["kind"], string> = {
  pass: "Col / pas",
  peak: "Top / berg",
}

export const SOURCE_LABEL: Record<NonNullable<ClimbDescription>["source"], string> =
  {
    osm: "OpenStreetMap",
    wikipedia: "Wikipedia",
    wikidata: "Wikidata",
  }
