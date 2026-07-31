// Regressietest voor het "eerst bekend, dán nieuw"-invalidatiecontract.
//
// De routeplanner wist de bekende-routes-lijst zodra zoekCriteriaKey
// verandert; een gewijzigd startpunt of gewijzigde afstand kan daardoor NOOIT
// oude bekende treffers hergebruiken of de verplichte zoekstap omzeilen
// (de A→B-gate `bekend == null` gaat dan weer open, en de lus-kaarten met
// oude treffers verdwijnen). Deze test pint dat élk zoek-bepalend veld de
// sleutel verandert, en dat niet-bepalende ruis (spaties) dat niet doet.
//
// Puur, geen UI/DB — run: `pnpm --filter @workspace/sparki run test:route-search-criteria`

import { zoekCriteriaKey, type ZoekCriteria } from "./route-search-criteria"

let failures = 0
function assert(cond: boolean, label: string) {
  if (cond) console.log(`  ✓ ${label}`)
  else {
    failures += 1
    console.error(`  ✗ ${label}`)
  }
}

const basis: ZoekCriteria = {
  mode: "loop",
  startLat: 52.156,
  startLon: 5.387,
  destination: "",
  distance: "40",
  sport: "cycling",
  bikeType: "race",
  elevationPreference: "any",
  trainingType: "duurtraining",
  unpavedPreferencePct: null,
  linkedWorkoutId: null,
  wish: "",
  avoidBusyRoads: false,
}

const key = zoekCriteriaKey(basis)

assert(
  zoekCriteriaKey({ ...basis }) === key,
  "identieke criteria ⇒ identieke sleutel (stabiel)",
)
assert(
  zoekCriteriaKey({ ...basis, distance: " 40 " }) === key &&
    zoekCriteriaKey({ ...basis, wish: "  " }) === key,
  "alleen witruimte ⇒ zelfde sleutel (geen valse invalidatie)",
)

// Élk zoek-bepalend veld moet de sleutel veranderen — anders zou een
// wijziging oude bekende routes laten staan of de zoekstap omzeilen.
const varianten: [string, Partial<ZoekCriteria>][] = [
  ["startpunt (lat)", { startLat: 51.9 }],
  ["startpunt (lon)", { startLon: 4.5 }],
  ["startpunt onbekend", { startLat: null, startLon: null }],
  ["modus lus → A→B", { mode: "ptp" }],
  ["bestemming", { mode: "ptp", destination: "Utrecht" }],
  ["afstand", { distance: "80" }],
  ["sport", { sport: "running" }],
  ["fietssoort", { bikeType: "gravel" }],
  ["hoogtevoorkeur", { elevationPreference: "hilly" }],
  ["trainingsdoel", { trainingType: "interval" }],
  ["ondergrond (onverhard %)", { unpavedPreferencePct: 40 }],
  ["gekoppelde workout", { linkedWorkoutId: 7 }],
  ["wens", { wish: "langs de Lek" }],
  ["N-wegen vermijden", { avoidBusyRoads: true }],
]
for (const [naam, delta] of varianten) {
  assert(
    zoekCriteriaKey({ ...basis, ...delta }) !== key,
    `wijziging ${naam} ⇒ andere sleutel ⇒ bekende lijst gewist`,
  )
}

console.log(
  failures === 0
    ? "\nAlle criteria-invalidatietests geslaagd."
    : `\n${failures} test(s) GEFAALD.`,
)
process.exit(failures === 0 ? 0 : 1)
