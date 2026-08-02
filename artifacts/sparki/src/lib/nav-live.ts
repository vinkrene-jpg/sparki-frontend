// Pure rekenhulpen voor de live navigatie — bewust zonder React zodat ze
// los testbaar zijn (test-nav-live). Alle waarden komen uit echte metingen;
// deze functies rekenen alleen, ze verzinnen nooit iets.

export type LatLon = { lat: number; lon: number }

// ── Gemiddelde snelheid ────────────────────────────────────────────
// Cumulatief over de hele rit: afgelegde meters gedeeld door rijtijd.
// Regels (herstel): zodra de rit gestart is toont hij 0,0 (nooit "—"),
// en een eenmaal berekende waarde verdwijnt nooit meer — bij een GPS-gat
// blijft de laatste geldige waarde staan (cumulatief kan niet "terugvallen").
export type AvgSpeedState = {
  meters: number
  lastKmh: number | null
}

export function initAvgSpeed(): AvgSpeedState {
  return { meters: 0, lastKmh: null }
}

// Voeg een stukje afgelegde afstand toe (alleen aanroepen tijdens "riding",
// met gefilterde bewegingsmeters) en reken het gemiddelde opnieuw uit over de
// rijtijd. rideSeconds = seconden op de ritklok (pauzes tellen niet mee).
export function updateAvgSpeed(
  s: AvgSpeedState,
  addMeters: number,
  rideSeconds: number,
): AvgSpeedState {
  const meters = s.meters + Math.max(0, addMeters)
  let lastKmh = s.lastKmh
  if (rideSeconds > 0) {
    lastKmh = Math.round((meters / rideSeconds) * 3.6 * 10) / 10
  }
  return { meters, lastKmh }
}

// Wat de databalk toont: vóór de start "—" mag, maar tijdens/na een rit
// altijd een getal — 0,0 zolang er nog niet echt bewogen is.
export function displayAvgKmh(
  s: AvgSpeedState,
  rideStarted: boolean,
): string | null {
  if (s.lastKmh != null) return s.lastKmh.toFixed(1).replace(".", ",")
  return rideStarted ? "0,0" : null
}

// ── Klimdetectie ───────────────────────────────────────────────────
// Percentage ter plekke: gladgestreken over een afstandsvenster ín de
// rijrichting (van huidige positie vooruit richting de top), zodat GPS/
// profielruis en een verkeerd-om gelezen segment nooit een negatief
// percentage opleveren terwijl je omhoog rijdt.
export const GRADE_WINDOW_KM = 0.12

export function smoothedClimbGradePct(
  eleAtKm: (km: number) => number,
  posKm: number,
  climbStartKm: number,
  climbSummitKm: number,
  windowKm: number = GRADE_WINDOW_KM,
): number | null {
  if (!(climbSummitKm > climbStartKm)) return null
  // Venster vooruit in de rijrichting; bij de top schuift het venster terug
  // zodat er altijd echte profielafstand in zit.
  let a = Math.max(climbStartKm, Math.min(posKm, climbSummitKm))
  let b = Math.min(climbSummitKm, a + windowKm)
  if (b - a < windowKm * 0.5) {
    a = Math.max(climbStartKm, b - windowKm)
  }
  const spanKm = b - a
  if (spanKm < 0.02) return null
  const rise = eleAtKm(b) - eleAtKm(a)
  const pct = (rise / (spanKm * 1000)) * 100
  // In de klimfase is een negatief venster (vals plat / ruis) eerlijk 0,0% —
  // nooit een min-teken terwijl de klim nog bezig is.
  return Math.round(Math.max(0, pct) * 10) / 10
}

// Klimfases: komt (aankondiging) → op (bezig) → top (vlak voor/op de top) →
// einde (net voorbij, korte bevestiging) → null.
export const CLIMB_ANNOUNCE_KM = 1.0
export const CLIMB_TOP_M = 60
export const CLIMB_DONE_KM = 0.25

export type ClimbWindow = {
  name: string
  lengthKm: number
  avgGradePct: number
  summitKm: number
  startKm: number
}

export type ClimbPhase =
  | { phase: "komt"; climb: ClimbWindow; inM: number }
  | { phase: "op"; climb: ClimbWindow; toTopM: number; fracDone: number }
  | { phase: "top"; climb: ClimbWindow; toTopM: number; fracDone: number }
  | { phase: "einde"; climb: ClimbWindow; sinceTopM: number }

export function climbPhaseAt(
  climbs: ClimbWindow[],
  traveledKm: number,
): ClimbPhase | null {
  for (const c of climbs) {
    const spanKm = c.summitKm - c.startKm
    if (!(spanKm > 0)) continue
    if (traveledKm >= c.startKm && traveledKm <= c.summitKm) {
      const toTopM = Math.max(0, (c.summitKm - traveledKm) * 1000)
      const fracDone = Math.min(
        1,
        Math.max(0, (traveledKm - c.startKm) / spanKm),
      )
      if (toTopM <= CLIMB_TOP_M) return { phase: "top", climb: c, toTopM, fracDone }
      return { phase: "op", climb: c, toTopM, fracDone }
    }
    if (
      traveledKm > c.summitKm &&
      traveledKm <= c.summitKm + CLIMB_DONE_KM
    ) {
      return {
        phase: "einde",
        climb: c,
        sinceTopM: (traveledKm - c.summitKm) * 1000,
      }
    }
    if (traveledKm >= c.startKm - CLIMB_ANNOUNCE_KM && traveledKm < c.startKm) {
      return { phase: "komt", climb: c, inM: (c.startKm - traveledKm) * 1000 }
    }
  }
  return null
}

// ── Databalk-positie ───────────────────────────────────────────────
// Verticaal versleepbaar met vaste snap-posities, uitgedrukt als fractie
// vanaf de onderkant van het scherm (0 = helemaal onderaan). Maximaal 30%
// vanaf de onderkant, zodat de balk nooit midden over de kaart hangt.
export const BAR_SNAPS = [0, 0.15, 0.3] as const
export type BarSnap = (typeof BAR_SNAPS)[number]

export function snapBarOffset(fractionFromBottom: number): BarSnap {
  const clamped = Math.max(0, Math.min(0.3, fractionFromBottom))
  let best: BarSnap = BAR_SNAPS[0]
  let bestD = Infinity
  for (const s of BAR_SNAPS) {
    const d = Math.abs(clamped - s)
    if (d < bestD) {
      bestD = d
      best = s
    }
  }
  return best
}

// ── Ritoverzicht ───────────────────────────────────────────────────
// Samenvatting over de echte opgenomen track + sensorsamples. Alles wat er
// niet echt is (geen hoogte, geen meter) blijft null — nooit een verzonnen
// getal.
export type TrackPoint = {
  lat: number
  lon: number
  t: number // epoch ms
  ele?: number | null
}
export type SensorSample = { t: number; watts?: number | null; cadence?: number | null }

export function haversineMeters(a: LatLon, b: LatLon): number {
  const R = 6371000
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const la1 = (a.lat * Math.PI) / 180
  const la2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export type RideSummary = {
  distanceKm: number
  totalSec: number
  movingSec: number
  avgKmh: number | null
  maxKmh: number | null
  elevationM: number | null
  avgWatts: number | null
  avgCadence: number | null
}

// Maximale snelheid uit de echte trackpunten: per stap afstand/tijd, en dan
// gladgestreken met een lopend gemiddelde over een klein tijdvenster zodat één
// GPS-uitschieter (een sprong van tientallen meters in één sample) nooit als
// "max" telt. Null zolang er te weinig echte beweging is om iets te meten.
const MAX_SPEED_WINDOW_SEC = 3
// Een venster telt pas mee als het écht gladgestreken is: minimaal een vol
// tijdvenster van 3 s ÉN minstens 3 samples. Zo kan een enkele uitschieter —
// ook bij grote sample-intervallen (bijv. één stap van 5 s) — nooit zijn eigen
// gemiddelde zijn; hij wordt altijd verdund door de buren of valt weg.
const MAX_SPEED_MIN_SAMPLES = 3
// Fysieke bovengrens: een sample-snelheid hierboven is per definitie een
// GPS-sprong en telt niet mee (fietsen/wandelen zit hier ruim onder).
const MAX_PLAUSIBLE_KMH = 120

export function maxSpeedKmh(track: TrackPoint[]): number | null {
  if (track.length < 2) return null
  // Per stap de ruwe snelheid (km/u), alleen als er echte tijd verstreek.
  type Step = { kmh: number; dtSec: number }
  const steps: Step[] = []
  for (let i = 1; i < track.length; i++) {
    const dtSec = (track[i]!.t - track[i - 1]!.t) / 1000
    if (dtSec <= 0) continue
    const meters = haversineMeters(track[i - 1]!, track[i]!)
    const kmh = (meters / dtSec) * 3.6
    if (kmh > MAX_PLAUSIBLE_KMH) continue
    steps.push({ kmh, dtSec })
  }
  if (steps.length === 0) return null
  // Lopend gemiddelde over een tijdvenster: pak per startpunt de stappen tot
  // het venster ECHT vol is (≥3 s én ≥3 samples) en middel de snelheid gewogen
  // naar tijd. Alleen zo'n vol venster levert een kandidaat-max; onvolledige
  // vensters (te kort in tijd of te weinig samples, bijv. aan het einde van de
  // rit of één losse spike-stap) tellen niet mee. De hoogste gladgestreken
  // waarde is de eerlijke maximumsnelheid.
  let best: number | null = null
  for (let i = 0; i < steps.length; i++) {
    let sumTime = 0
    let sumDist = 0
    let count = 0
    for (let j = i; j < steps.length; j++) {
      const s = steps[j]!
      sumTime += s.dtSec
      sumDist += (s.kmh / 3.6) * s.dtSec
      count += 1
      if (sumTime >= MAX_SPEED_WINDOW_SEC && count >= MAX_SPEED_MIN_SAMPLES) {
        break
      }
    }
    // Alleen een venster dat beide drempels haalt telt als kandidaat.
    if (sumTime >= MAX_SPEED_WINDOW_SEC && count >= MAX_SPEED_MIN_SAMPLES) {
      const kmh = (sumDist / sumTime) * 3.6
      if (best == null || kmh > best) best = kmh
    }
  }
  return best != null && best > 0 ? Math.round(best * 10) / 10 : null
}

export function summarizeRide(
  track: TrackPoint[],
  movingSeconds: number,
  sensors: SensorSample[],
): RideSummary {
  let meters = 0
  for (let i = 1; i < track.length; i++) {
    meters += haversineMeters(track[i - 1]!, track[i]!)
  }
  const totalSec =
    track.length >= 2
      ? Math.max(0, Math.round((track[track.length - 1]!.t - track[0]!.t) / 1000))
      : 0
  const movingSec = Math.min(Math.max(0, Math.round(movingSeconds)), totalSec || Math.round(movingSeconds))
  const avgKmh =
    movingSec > 0 && meters > 0
      ? Math.round((meters / movingSec) * 3.6 * 10) / 10
      : null
  // Hoogtemeters alleen uit echte hoogtesamples (drempel 2 m tegen ruis).
  const eles = track.filter((p) => typeof p.ele === "number") as (TrackPoint & { ele: number })[]
  let elevationM: number | null = null
  if (eles.length >= 5) {
    let gain = 0
    let ref = eles[0]!.ele
    for (const p of eles) {
      if (p.ele > ref + 2) {
        gain += p.ele - ref
        ref = p.ele
      } else if (p.ele < ref - 2) {
        ref = p.ele
      }
    }
    elevationM = Math.round(gain)
  }
  const watts = sensors.map((s) => s.watts).filter((w): w is number => typeof w === "number")
  const cads = sensors.map((s) => s.cadence).filter((c): c is number => typeof c === "number")
  return {
    distanceKm: Math.round((meters / 1000) * 100) / 100,
    totalSec,
    movingSec,
    avgKmh,
    maxKmh: maxSpeedKmh(track),
    elevationM,
    avgWatts: watts.length > 0 ? Math.round(watts.reduce((a, b) => a + b, 0) / watts.length) : null,
    avgCadence: cads.length > 0 ? Math.round(cads.reduce((a, b) => a + b, 0) / cads.length) : null,
  }
}

// GPX met tijden (en waar echt aanwezig hoogte + watt/cadans-extensies),
// zodat de upload via de Data Hub een echte sessie wordt.
export function buildRideGpx(
  name: string,
  track: TrackPoint[],
  sensors: SensorSample[],
): string {
  const safeName = name.replace(/[<>&]/g, "")
  // Dichtstbijzijnde sensorsample (≤ 5 s) per trackpunt.
  const sorted = [...sensors].sort((a, b) => a.t - b.t)
  let si = 0
  const lines: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<gpx version="1.1" creator="Sparki" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">`,
    `<trk><name>${safeName}</name><trkseg>`,
  ]
  for (const p of track) {
    while (si + 1 < sorted.length && Math.abs(sorted[si + 1]!.t - p.t) <= Math.abs(sorted[si]!.t - p.t)) si++
    const s = sorted.length > 0 && Math.abs(sorted[si]!.t - p.t) <= 5000 ? sorted[si]! : null
    const ele = typeof p.ele === "number" ? `<ele>${Math.round(p.ele * 10) / 10}</ele>` : ""
    const time = `<time>${new Date(p.t).toISOString()}</time>`
    let ext = ""
    if (s && (typeof s.watts === "number" || typeof s.cadence === "number")) {
      const cad = typeof s.cadence === "number" ? `<gpxtpx:cad>${Math.round(s.cadence)}</gpxtpx:cad>` : ""
      const pow = typeof s.watts === "number" ? `<power>${Math.round(s.watts)}</power>` : ""
      ext = `<extensions>${pow}${cad ? `<gpxtpx:TrackPointExtension>${cad}</gpxtpx:TrackPointExtension>` : ""}</extensions>`
    }
    lines.push(`<trkpt lat="${p.lat}" lon="${p.lon}">${ele}${time}${ext}</trkpt>`)
  }
  lines.push(`</trkseg></trk></gpx>`)
  return lines.join("\n")
}
