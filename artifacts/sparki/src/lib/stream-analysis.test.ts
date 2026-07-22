// Pure tests voor de stream-analyses: zones, hartslagdrift, vermogensverval,
// pacing, intervaldetectie en vergelijkbaarheid. Alles deterministisch.
import {
  powerZoneDistribution,
  hrZoneDistribution,
  hrDrift,
  powerFade,
  pacing,
  detectIntervals,
  compareIntervalsWithPlan,
  assessComparability,
  hasChannel,
  type SessionStreams,
} from "./stream-analysis"

let passed = 0
let failed = 0
function assert(cond: boolean, msg: string) {
  if (cond) {
    passed += 1
    console.log(`  ✓ ${msg}`)
  } else {
    failed += 1
    console.error(`  ✗ ${msg}`)
  }
}
function section(name: string) {
  console.log(`\n— ${name}`)
}

// Bouw een synthetische maar realistische stream: elke bucket 10 s.
function makeStreams(opts: {
  n: number
  power?: (i: number) => number | null
  hr?: (i: number) => number | null
}): SessionStreams {
  const t: number[] = []
  const power: Array<number | null> = []
  const hr: Array<number | null> = []
  for (let i = 0; i < opts.n; i++) {
    t.push(i * 10)
    power.push(opts.power ? opts.power(i) : null)
    hr.push(opts.hr ? opts.hr(i) : null)
  }
  return {
    t,
    power: opts.power ? power : null,
    heartRate: opts.hr ? hr : null,
    cadence: null,
    speedKph: null,
    elevationM: null,
    temperatureC: null,
    distanceKm: null,
  }
}

section("Kanaal-aanwezigheid")
{
  const s = makeStreams({ n: 30, power: () => 200 })
  assert(hasChannel(s, "power"), "power aanwezig wordt herkend")
  assert(!hasChannel(s, "heartRate"), "ontbrekende hartslag is eerlijk afwezig")
  assert(!hasChannel(null, "power"), "null streams → geen kanaal")
}

section("Vermogenszones")
{
  // 200 W constant bij FTP 250 → ratio 0,8 → Z3 (tempo).
  const s = makeStreams({ n: 60, power: () => 200 })
  const zones = powerZoneDistribution(s, 250)
  assert(zones != null, "zones berekend met vermogen + FTP")
  const z3 = zones!.find((z) => z.zone === "Z3")!
  assert(z3.pct === 100, `alle tijd in Z3 (${z3.pct}%)`)
  assert(
    powerZoneDistribution(s, null) === null,
    "geen FTP → eerlijk null (geen zones verzonnen)",
  )
  assert(
    powerZoneDistribution(makeStreams({ n: 60 }), 250) === null,
    "geen vermogen → null",
  )
}

section("Hartslagzones")
{
  const s = makeStreams({ n: 60, hr: () => 150 })
  const zones = hrZoneDistribution(s, 200) // 75% → Z3
  assert(zones != null, "hartslagzones berekend")
  const z3 = zones!.find((z) => z.zone === "Z3")!
  assert(z3.pct === 100, `alle tijd in Z3 (${z3.pct}%)`)
  assert(hrZoneDistribution(s, null) === null, "geen maximale hartslag → null")
}

section("Hartslagdrift")
{
  // Zelfde vermogen, hartslag kruipt op: eerste helft 140, tweede helft 155.
  const s = makeStreams({
    n: 120,
    power: () => 200,
    hr: (i) => (i < 60 ? 140 : 155),
  })
  const d = hrDrift(s)
  assert(d != null, "drift berekend met vermogen + hartslag")
  assert(d!.driftPct > 5 && d!.driftPct < 15, `driftPct ≈ 9,7 (${d!.driftPct})`)
  assert(d!.verdict === "matig", `oordeel matig (${d!.verdict})`)
  assert(hrDrift(makeStreams({ n: 120, power: () => 200 })) === null, "geen hartslag → null")
}

section("Vermogensverval")
{
  const s = makeStreams({ n: 90, power: (i) => (i < 30 ? 250 : i < 60 ? 240 : 210) })
  const f = powerFade(s)
  assert(f != null, "verval berekend")
  assert(f!.fadePct < -12, `duidelijk verval (${f!.fadePct}%)`)
  assert(f!.verdict === "duidelijk verval", `oordeel (${f!.verdict})`)
  const flat = powerFade(makeStreams({ n: 90, power: () => 220 }))
  assert(flat!.verdict === "stabiel", "constant vermogen → stabiel")
}

section("Pacing")
{
  const steady = pacing(makeStreams({ n: 60, power: () => 210 }))
  assert(steady!.verdict === "gelijkmatig", "constant → gelijkmatig")
  const surgy = pacing(
    makeStreams({ n: 60, power: (i) => (i % 2 === 0 ? 380 : 90) }),
  )
  assert(surgy!.verdict === "zeer wisselend", `blokkerig → zeer wisselend (${surgy!.variabilityPct}%)`)
  assert(pacing(makeStreams({ n: 60 })) === null, "geen vermogen → null")
}

section("Intervaldetectie")
{
  // Basis 150 W met 3 blokken van 300 W van elk 120 s (12 buckets).
  const inBlock = (i: number) =>
    (i >= 30 && i < 42) || (i >= 60 && i < 72) || (i >= 90 && i < 102)
  const s = makeStreams({ n: 140, power: (i) => (inBlock(i) ? 300 : 150) })
  const ivs = detectIntervals(s)
  assert(ivs.length === 3, `3 blokken gevonden (${ivs.length})`)
  assert(ivs[0]!.avgW === 300, `blokvermogen 300 W (${ivs[0]!.avgW})`)
  assert(ivs[0]!.durationSec >= 110, `blokduur ≈ 120 s (${ivs[0]!.durationSec})`)
  assert(detectIntervals(makeStreams({ n: 140 })).length === 0, "geen vermogen → geen blokken")
}

section("Interval vs. plan")
{
  const inBlock = (i: number) =>
    (i >= 30 && i < 42) || (i >= 60 && i < 72) || (i >= 90 && i < 102)
  const s = makeStreams({ n: 140, power: (i) => (inBlock(i) ? 300 : 150) })
  const cmp = compareIntervalsWithPlan(
    s,
    [
      { kind: "warmup", durationMin: 15 },
      { kind: "interval", durationMin: 2, targetPctFtp: 120, reps: 3 },
      { kind: "cooldown", durationMin: 10 },
    ],
    250, // doel = 300 W
  )
  assert(cmp != null, "vergelijking gemaakt")
  assert(cmp!.plannedCount === 3 && cmp!.riddenCount === 3, "3 gepland, 3 gereden")
  assert(cmp!.matches[0]!.deltaPct === 0, `blok op doel (${cmp!.matches[0]!.deltaPct}%)`)
  assert(cmp!.conclusion.includes("Alle 3"), `conclusie: ${cmp!.conclusion}`)
  assert(
    compareIntervalsWithPlan(s, [{ kind: "steady", durationMin: 60 }], 250) === null,
    "plan zonder intervallen → null",
  )
  const noPower = compareIntervalsWithPlan(
    makeStreams({ n: 140 }),
    [{ kind: "interval", durationMin: 2, targetPctFtp: 120, reps: 3 }],
    250,
  )
  assert(
    noPower != null && noPower.riddenCount === 0 && noPower.matches[0]!.riddenAvgW === null,
    "geen vermogen → eerlijk 0 gereden blokken",
  )
}

section("Vergelijkbaarheid")
{
  const base = {
    type: "duurrit",
    durationMin: 120,
    distanceKm: 60,
    elevationM: 300,
    avgPower: 190,
    avgHr: 140,
  }
  const ok = assessComparability(base, { ...base, durationMin: 130 })
  assert(ok.comparable, "gelijksoortige ritten zijn vergelijkbaar")
  const diffType = assessComparability(base, { ...base, type: "intervaltraining" })
  assert(!diffType.comparable && diffType.reasons[0]!.includes("soort"), "ander type → niet vergelijkbaar met reden")
  const diffDur = assessComparability(base, { ...base, durationMin: 45 })
  assert(!diffDur.comparable, "sterk verschillende duur → niet vergelijkbaar")
  const noBase = assessComparability(
    { ...base, avgPower: null, avgHr: null },
    { ...base, avgPower: 200, avgHr: null },
  )
  assert(!noBase.comparable, "geen gedeelde meetbasis → niet vergelijkbaar")
  const hilly = assessComparability(base, { ...base, elevationM: 1500 })
  assert(!hilly.comparable && hilly.reasons.some((r) => r.includes("terrein")), "sterk ander terrein → reden genoemd")
}

console.log(`\n${passed} geslaagd, ${failed} gefaald`)
if (failed > 0) process.exit(1)
