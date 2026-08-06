// RIJDEN_01 F0 — het activiteitenregister is de SSOT voor tabel A/B/C.
// Deze test pint de tabellen uit het document vast zodat een latere
// "kleine aanpassing" nooit stil een activiteit, afstand of factor sloopt.
import test from "node:test"
import assert from "node:assert/strict"
import {
  ACTIVITEITEN,
  activiteit,
  klemAfstand,
  standaardAfstand,
  VORMEN,
  HOOGTES,
  vormGeneratePayload,
} from "./rijden-activiteiten"

test("tabel A: precies acht activiteiten in documentvolgorde", () => {
  assert.deepEqual(
    ACTIVITEITEN.map((a) => a.id),
    [
      "wandelen",
      "sightseeing",
      "hiken",
      "hardlopen",
      "fietsen",
      "racefiets",
      "mtb",
      "gravel",
    ],
  )
})

test("tabel B: min/max/standaard per activiteit exact uit het document", () => {
  const b: Record<string, [number, number, number]> = {
    wandelen: [2, 50, 8],
    sightseeing: [1, 20, 5],
    hiken: [5, 60, 15],
    hardlopen: [3, 60, 10],
    fietsen: [10, 200, 35],
    racefiets: [20, 300, 70],
    mtb: [10, 150, 35],
    gravel: [15, 250, 60],
  }
  for (const a of ACTIVITEITEN) {
    const [min, max, std] = b[a.id]!
    assert.equal(a.afstand.minKm, min, `${a.id} min`)
    assert.equal(a.afstand.maxKm, max, `${a.id} max`)
    assert.equal(a.afstand.standaardKm, std, `${a.id} standaard`)
  }
})

test("engine-koppeling: sport + fietstype kloppen per activiteit", () => {
  assert.equal(activiteit("wandelen").sport, "walking")
  assert.equal(activiteit("sightseeing").sport, "walking")
  assert.equal(activiteit("hiken").sport, "hiking")
  assert.equal(activiteit("hardlopen").sport, "running")
  for (const id of ["fietsen", "racefiets", "mtb", "gravel"] as const) {
    assert.equal(activiteit(id).sport, "cycling")
  }
  assert.equal(activiteit("fietsen").bikeType, null)
  assert.equal(activiteit("racefiets").bikeType, "racefiets")
  assert.equal(activiteit("mtb").bikeType, "mtb")
  assert.equal(activiteit("gravel").bikeType, "gravel")
})

test("tabel C: factoren per activiteit exact uit het document", () => {
  // [ondergrondKeuze, hoogte, drukkeWegen, onderweg, klim]
  const c: Record<string, [boolean, boolean, boolean, boolean, boolean]> = {
    wandelen: [true, true, false, true, false],
    sightseeing: [true, false, true, true, false],
    hiken: [true, true, false, true, true],
    hardlopen: [true, true, true, false, false],
    fietsen: [true, true, true, true, false],
    racefiets: [false, true, false, false, true],
    mtb: [false, true, false, false, true],
    gravel: [true, true, false, true, true],
  }
  for (const a of ACTIVITEITEN) {
    const [ondergrond, hoogte, drukke, onderweg, klim] = c[a.id]!
    assert.equal(a.factoren.ondergrond.keuze, ondergrond, `${a.id} ondergrond`)
    assert.equal(a.factoren.hoogte, hoogte, `${a.id} hoogte`)
    assert.equal(a.factoren.drukkeWegenVermijden, drukke, `${a.id} drukke wegen`)
    assert.equal(a.factoren.onderweg.beschikbaar, onderweg, `${a.id} onderweg`)
    assert.equal(a.factoren.klimToevoegen, klim, `${a.id} klim`)
    assert.equal(a.factoren.geenWoonwijken, true, `${a.id} geen woonwijken`)
    assert.equal(a.factoren.vorm, true, `${a.id} vorm`)
  }
  // Vaste ondergrond: racefiets verhard, MTB onverhard; rest geen vaste.
  assert.equal(activiteit("racefiets").factoren.ondergrond.vast, "verhard")
  assert.equal(activiteit("mtb").factoren.ondergrond.vast, "onverhard")
  assert.equal(activiteit("gravel").factoren.ondergrond.vast, null)
  // Sightseeing: Onderweg standaard AAN, elders standaard uit.
  assert.equal(activiteit("sightseeing").factoren.onderweg.standaardAan, true)
  assert.equal(activiteit("fietsen").factoren.onderweg.standaardAan, false)
})

test("klemAfstand houdt zich aan tabel B-grenzen", () => {
  const race = activiteit("racefiets")
  assert.equal(klemAfstand(race, 5), 20)
  assert.equal(klemAfstand(race, 999), 300)
  assert.equal(klemAfstand(race, 71.4), 71)
})

test("standaardAfstand: training van vandaag wint, geklemd; anders tabel B", () => {
  const race = activiteit("racefiets")
  assert.deepEqual(standaardAfstand(race, 62), { km: 62, uitTraining: true })
  assert.deepEqual(standaardAfstand(race, 400), { km: 300, uitTraining: true })
  assert.deepEqual(standaardAfstand(race, null), { km: 70, uitTraining: false })
  assert.deepEqual(standaardAfstand(race, 0), { km: 70, uitTraining: false })
})

test("vormen en hoogte-opties bestaan met enginekoppeling", () => {
  assert.deepEqual(VORMEN.map((v) => v.id), ["rondje", "heen-terug", "a-naar-b"])
  assert.deepEqual(HOOGTES.map((h) => h.engine), ["flat", "hilly", "hilly"])
})

// Contracttest (taak Rijden vormkeuzes): elke vormkeuze produceert aantoonbaar
// een ANDERE geldige generate-payload — geen dode knoppen, geen stil
// terugvallen op een rondje.
test("vormGeneratePayload: elke vorm levert een andere geldige payload", () => {
  const rondje = vormGeneratePayload("rondje")
  const heenTerug = vormGeneratePayload("heen-terug")
  const aNaarB = vormGeneratePayload("a-naar-b", "Herentals")
  assert.ok(rondje.ok && heenTerug.ok && aNaarB.ok)
  if (!rondje.ok || !heenTerug.ok || !aNaarB.ok) return
  assert.deepEqual(rondje.payload, { mode: "loop" })
  assert.deepEqual(heenTerug.payload, { mode: "out_and_back" })
  assert.deepEqual(aNaarB.payload, { mode: "ptp", destinationText: "Herentals" })
  // Drie verschillende modes — de drie vormen kunnen nooit stil samenvallen.
  const modes = new Set([rondje.payload.mode, heenTerug.payload.mode, aNaarB.payload.mode])
  assert.equal(modes.size, 3)
})

test("vormGeneratePayload: A-naar-B zonder bestemming is een eerlijke fout", () => {
  const leeg = vormGeneratePayload("a-naar-b")
  assert.equal(leeg.ok, false)
  const spaties = vormGeneratePayload("a-naar-b", "   ")
  assert.equal(spaties.ok, false)
  // Bestemming wordt getrimd doorgegeven.
  const res = vormGeneratePayload("a-naar-b", "  Gent  ")
  assert.ok(res.ok)
  if (res.ok) assert.deepEqual(res.payload, { mode: "ptp", destinationText: "Gent" })
})
