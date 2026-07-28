// Shared types for the Klimmenverkenner (climb explorer). Mirror the honest
// API shapes: every field either carries a real value or is explicitly null.

export type ClimbHit = {
  osmId: string
  name: string
  lat: number
  lon: number
  elevationM: number | null
  kind: "pass" | "peak" | "road"
  hasDescription: boolean
}

export type ClimbSearchResult = {
  area: { label: string; lat: number; lon: number } | null
  // De werkelijk gebruikte (geklemde) zoekstraal in km.
  radiusKm: number
  climbs: ClimbHit[]
}

export type DerivedClimbProfile = {
  lengthKm: number
  avgGradePct: number
  maxGradePct: number
  elevationGainM: number
  profile: number[]
  // Echte lijn ([lat, lon]) voor de kaart: bij "trace" een getraceerde route
  // naar de top, bij "way" de echte weggeometrie van de klimweg zelf.
  points: [number, number][]
  derived: true
  source: "trace" | "way"
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
  kind: "pass" | "peak" | "road"
  description: ClimbDescription
  profile: DerivedClimbProfile | null
  profileUnavailableReason: string | null
}

export const KIND_LABEL: Record<ClimbHit["kind"], string> = {
  pass: "Col / pas",
  peak: "Top / berg",
  road: "Klimweg / helling",
}

export const SOURCE_LABEL: Record<NonNullable<ClimbDescription>["source"], string> =
  {
    osm: "OpenStreetMap",
    wikipedia: "Wikipedia",
    wikidata: "Wikidata",
  }
