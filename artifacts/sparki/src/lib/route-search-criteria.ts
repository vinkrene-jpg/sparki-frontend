// Route-zoeklaag: sleutel van de zoek-bepalende criteria.
//
// Contract "eerst bekend, dán nieuw" (taak-512-flow): de lijst met bekende
// routes hoort bij PRECIES één set zoekcriteria. Zodra één zoek-bepalend
// gegeven wijzigt (startpunt, modus, bestemming, afstand, sport/fietssoort,
// hoogtevoorkeur, trainingsdoel, ondergrond, gekoppelde workout, wens,
// N-wegen-vermijding) is de oude lijst waardeloos én gevaarlijk: hij zou de
// verplichte zoekstap voor de níeuwe aanvraag omzeilen of routes tonen die
// bij een vorig startpunt pasten.
//
// De routeplanner berekent deze sleutel en wist de bekende-routes-lijst
// telkens wanneer hij verandert. Puur en synchroon zodat het contract
// testbaar is zonder UI.

export type ZoekCriteria = {
  mode: string
  startLat: number | null
  startLon: number | null
  destination: string
  distance: string
  sport: string
  bikeType: string | null
  elevationPreference: string | null
  trainingType: string | null
  unpavedPreferencePct: number | null
  linkedWorkoutId: number | null
  wish: string
  avoidBusyRoads: boolean
}

export function zoekCriteriaKey(c: ZoekCriteria): string {
  return JSON.stringify([
    c.mode,
    c.startLat,
    c.startLon,
    c.destination.trim(),
    c.distance.trim(),
    c.sport,
    c.bikeType,
    c.elevationPreference,
    c.trainingType,
    c.unpavedPreferencePct,
    c.linkedWorkoutId,
    c.wish.trim(),
    c.avoidBusyRoads,
  ])
}
