// Gedeelde visuele taal voor meerdere routes tegelijk op één kaart
// (correctie René 31-07-2026): elke route krijgt een eigen kleur ÉN elke
// fietscategorie een eigen lijnstijl, zodat het onderscheid nooit alleen
// van kleur afhangt (toegankelijkheid). Kaart, lijst en legenda gebruiken
// exact dezelfde functies zodat kleur en stijl overal gelijk blijven.

// Kleurenpalet (Okabe–Ito-basis, kleurenblind-vriendelijk) — gekozen op
// contrast tegen zowel de lichte Voyager-kaarttegels als de donkere kaarten
// in de lijst. Geel is bewust weggelaten (onleesbaar op lichte tegels).
const ROUTE_COLORS = [
  "#0072B2", // blauw
  "#D55E00", // vermiljoen
  "#009E73", // groen
  "#CC79A7", // roze
  "#E69F00", // oranje
  "#7C3AED", // paars
  "#56B4E9", // hemelsblauw
  "#8B0000", // donkerrood
] as const

// Stabiele kleur per route: op basis van de positie van het route-id in de
// gesorteerde id-lijst van de geladen set. Zo houdt een route dezelfde kleur
// wanneer de gebruiker filtert (de indexen in het gefilterde lijstje
// verschuiven, de id-volgorde niet).
export function routeColorById(id: number, allIds: number[]): string {
  const sorted = [...allIds].sort((a, b) => a - b)
  const idx = Math.max(0, sorted.indexOf(id))
  return ROUTE_COLORS[idx % ROUTE_COLORS.length]
}

// Lijnstijl per fietscategorie (vaste afspraak):
// - racefiets/weg: doorgetrokken lijn
// - MTB: grove stippellijn
// - gravel: streep-stippellijn
// - gewone fiets: fijne streepjeslijn
// Onbekende types krijgen een eigen, consistente korte streepjeslijn.
export function bikeDash(bikeType: string): string | undefined {
  switch (bikeType) {
    case "racefiets":
      return undefined // doorgetrokken
    case "mtb":
      return "2 9"
    case "gravel":
      return "14 6 3 6"
    case "fiets":
      return "9 6"
    default:
      return "5 5"
  }
}

export const BIKE_DASH_LABEL: Record<string, string> = {
  racefiets: "doorgetrokken",
  mtb: "grove stippellijn",
  gravel: "streep-stippellijn",
  fiets: "streepjeslijn",
}

// Klein lijnvoorbeeld voor legenda en routekaartjes: exact dezelfde kleur en
// lijnstijl als op de kaart, zodat lijst en kaart één-op-één te koppelen zijn.
export function LijnVoorbeeld({
  color,
  bikeType,
  width = 34,
}: {
  color: string
  bikeType: string
  width?: number
}) {
  return (
    <svg
      width={width}
      height={8}
      viewBox={`0 0 ${width} 8`}
      aria-hidden="true"
      className="shrink-0"
    >
      <line
        x1={1}
        y1={4}
        x2={width - 1}
        y2={4}
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={bikeDash(bikeType)}
      />
    </svg>
  )
}
