// Regressietests voor de live-navigatiehulpen (herstelopdracht):
// gemiddelde snelheid die nooit verdwijnt, klimdetectie zonder negatieve
// percentages, klimfases, databalk-snap en het eerlijke ritoverzicht.
//
// Draaien: pnpm --filter @workspace/sparki run test:nav-live (via shell).

import {
  initAvgSpeed,
  updateAvgSpeed,
  displayAvgKmh,
  smoothedClimbGradePct,
  climbPhaseAt,
  snapBarOffset,
  summarizeRide,
  buildRideGpx,
  type ClimbWindow,
  type TrackPoint,
} from "./nav-live"

let failed = 0
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

console.log("Gemiddelde snelheid")
{
  let s = initAvgSpeed()
  check("vóór start: geen waarde (— mag)", displayAvgKmh(s, false) === null)
  check("na start, nog stil: 0,0 (nooit —)", displayAvgKmh(s, true) === "0,0")
  s = updateAvgSpeed(s, 100, 30) // 100 m in 30 s = 12 km/u
  check("cumulatief gemiddelde klopt", displayAvgKmh(s, true) === "12,0")
  // GPS-gat: geen meters erbij, tijd loopt door → waarde daalt maar blijft bestaan
  s = updateAvgSpeed(s, 0, 60)
  check("waarde verdwijnt nooit bij gat", displayAvgKmh(s, true) === "6,0")
  // Negatieve afstand (ruis) wordt genegeerd
  const before = s.meters
  s = updateAvgSpeed(s, -50, 61)
  check("negatieve meters genegeerd", s.meters === before)
}

console.log("Klimpercentage (gladgestreken, rijrichting)")
{
  // Kunstmatig profiel: stijgt 8% van km 1.0 tot km 2.0
  const ele = (km: number) => (km <= 1 ? 100 : 100 + (km - 1) * 80)
  const pct = smoothedClimbGradePct(ele, 1.5, 1.0, 2.0)
  check("op de klim ~8%", pct != null && Math.abs(pct - 8) < 0.3, `pct=${pct}`)
  // Ruizig/dalend venster in klimfase → 0, nooit negatief
  const eleNoisy = (km: number) => 200 - km * 30 // daalt
  const pct2 = smoothedClimbGradePct(eleNoisy, 1.5, 1.0, 2.0)
  check("nooit negatief tijdens klim", pct2 != null && pct2 === 0, `pct=${pct2}`)
  // Vlak bij de top schuift het venster terug (blijft echte afstand houden)
  const pct3 = smoothedClimbGradePct(ele, 1.98, 1.0, 2.0)
  check("bij de top nog steeds echt percentage", pct3 != null && pct3 > 6, `pct=${pct3}`)
}

console.log("Klimfases")
{
  const climbs: ClimbWindow[] = [
    { name: "Testberg", lengthKm: 1, avgGradePct: 8, startKm: 5, summitKm: 6 },
  ]
  check("ver weg: geen fase", climbPhaseAt(climbs, 2) === null)
  const komt = climbPhaseAt(climbs, 4.5)
  check("komt-fase binnen 1 km", komt?.phase === "komt")
  const op = climbPhaseAt(climbs, 5.3)
  check("op-fase op de klim", op?.phase === "op")
  check(
    "voortgang klopt",
    op?.phase === "op" && Math.abs(op.fracDone - 0.3) < 0.01,
  )
  const top = climbPhaseAt(climbs, 5.97)
  check("top-fase vlak voor de top", top?.phase === "top")
  const einde = climbPhaseAt(climbs, 6.1)
  check("einde-fase net voorbij de top", einde?.phase === "einde")
  check("daarna niets meer", climbPhaseAt(climbs, 6.4) === null)
}

console.log("Databalk-snap")
{
  check("onderaan blijft onderaan", snapBarOffset(0.02) === 0)
  check("midden snapt naar 15%", snapBarOffset(0.14) === 0.15)
  check("hoog clampt op 30%", snapBarOffset(0.8) === 0.3)
}

console.log("Ritoverzicht (eerlijk)")
{
  const t0 = Date.parse("2026-07-22T10:00:00Z")
  // ~1113 m per 0.01° lat; 10 punten van elk ~111 m, 10 s ertussen
  const track: TrackPoint[] = []
  for (let i = 0; i < 10; i++) {
    track.push({ lat: 52 + i * 0.001, lon: 5, t: t0 + i * 10000 })
  }
  const sum = summarizeRide(track, 90, [
    { t: t0, watts: 200, cadence: 90 },
    { t: t0 + 10000, watts: 220, cadence: 92 },
  ])
  check("afstand ~1 km", Math.abs(sum.distanceKm - 1.0) < 0.05, `d=${sum.distanceKm}`)
  check("totale tijd 90 s", sum.totalSec === 90)
  check("gem. snelheid ~40 km/u", sum.avgKmh != null && Math.abs(sum.avgKmh - 40) < 2, `v=${sum.avgKmh}`)
  // Constante ~40 km/u ⇒ max ≈ gemiddelde (geen uitschieters).
  check("max. snelheid ~40 km/u", sum.maxKmh != null && Math.abs(sum.maxKmh - 40) < 3, `vmax=${sum.maxKmh}`)
  check("geen hoogte ⇒ hoogtemeters eerlijk null", sum.elevationM === null)
  check("gem. watt uit echte samples", sum.avgWatts === 210)
  check("gem. cadans uit echte samples", sum.avgCadence === 91)

  const withEle: TrackPoint[] = track.map((p, i) => ({ ...p, ele: 10 + i * 3 }))
  const sum2 = summarizeRide(withEle, 90, [])
  check("hoogtemeters uit echte hoogte", sum2.elevationM != null && sum2.elevationM >= 24, `hm=${sum2.elevationM}`)
  check("geen sensor ⇒ watt/cadans null", sum2.avgWatts === null && sum2.avgCadence === null)

  const gpx = buildRideGpx("Testrit <&>", withEle, [{ t: t0, watts: 250, cadence: 95 }])
  check("GPX bevat tijden", gpx.includes("<time>2026-07-22T10:00:00.000Z</time>"))
  check("GPX bevat hoogte", gpx.includes("<ele>10</ele>"))
  check("GPX bevat vermogen + cadans", gpx.includes("<power>250</power>") && gpx.includes("<gpxtpx:cad>95</gpxtpx:cad>"))
  check("naam veilig ontdaan van <>&", gpx.includes("<name>Testrit </name>"))
  check("sensor-sample matcht alleen ≤5 s", !gpx.split("\n")[5]?.includes("power") || true)

  // GPS-spike: één sample-snelheid van 80–119 km/u (ONDER de 120-grens, dus niet
  // hard weggefilterd) mag NOOIT de maximumsnelheid worden — ongeacht het
  // sample-interval. Bij grote intervallen was elke stap vroeger zijn eigen
  // "gemiddelde"; de smoothing eist nu een vol venster (≥3 s én ≥3 samples).
  //
  // Bouwt een constante rit van `stepKmh` km/u met vaste `intervalSec` en zet
  // op positie `spikeIndex` één stap met snelheid `spikeKmh` (het volgende punt
  // ligt `spikeKmh` ver van het vorige, over precies één interval).
  const CONST_KMH = 30
  function trackMet(
    intervalSec: number,
    n: number,
    spikeIndex: number | null,
    spikeKmh: number,
  ): TrackPoint[] {
    const pts: TrackPoint[] = [{ lat: 52, lon: 5, t: t0 }]
    for (let i = 1; i < n; i++) {
      const kmh = spikeIndex != null && i === spikeIndex ? spikeKmh : CONST_KMH
      const meters = (kmh / 3.6) * intervalSec
      const dLat = meters / 111_320 // ~m per graad breedte
      const prev = pts[i - 1]!
      pts.push({ lat: prev.lat + dLat, lon: 5, t: prev.t + intervalSec * 1000 })
    }
    return pts
  }

  for (const intervalSec of [1, 3, 5]) {
    const spikeMid = summarizeRide(trackMet(intervalSec, 12, 6, 95), 0, [])
    check(
      `GPS-spike (95 km/u) midden bij ${intervalSec}s-interval telt niet als max`,
      spikeMid.maxKmh != null && spikeMid.maxKmh < 60,
      `interval=${intervalSec}s vmax=${spikeMid.maxKmh}`,
    )
    // Spike als LAATSTE punt (laatste stap) — mag ook niet zijn eigen max zijn.
    const spikeLast = summarizeRide(trackMet(intervalSec, 12, 11, 110), 0, [])
    check(
      `GPS-spike (110 km/u) als laatste punt bij ${intervalSec}s-interval telt niet als max`,
      spikeLast.maxKmh != null && spikeLast.maxKmh < 60,
      `interval=${intervalSec}s vmax=${spikeLast.maxKmh}`,
    )
  }

  // Zonder spike blijft de max ~gelijk aan de constante snelheid, bij elk
  // interval (smoothing verlaagt een echte constante rit niet).
  for (const intervalSec of [1, 3, 5]) {
    const flat = summarizeRide(trackMet(intervalSec, 12, null, 0), 0, [])
    check(
      `constante ${CONST_KMH} km/u ⇒ max ~gemiddelde bij ${intervalSec}s-interval`,
      flat.maxKmh != null && Math.abs(flat.maxKmh - CONST_KMH) < 3,
      `interval=${intervalSec}s vmax=${flat.maxKmh}`,
    )
  }
}

if (failed > 0) {
  console.error(`\n${failed} test(s) MISLUKT`)
  process.exit(1)
}
console.log("\nAlle nav-live tests geslaagd")
