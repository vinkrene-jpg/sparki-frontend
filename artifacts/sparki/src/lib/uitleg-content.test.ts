// Tests voor de centrale uitleg-registry en de persoonlijke contextbouwer.
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  UITLEG,
  buildUitlegContextRegels,
  type UitlegPersoonlijk,
} from "./uitleg-content"

const VEREISTE_KEYS = [
  // Grafiek-uitleg (bestond al)
  "vermogen",
  "hartslag",
  "cadans",
  "snelheid",
  "hoogte",
  "temperatuur",
  "vermogenszones",
  "hartslagzones",
  "hartslagdrift",
  "vermogensverval",
  "pacing",
  "intervallen",
  "vergelijkbaarheid",
  // Golf 9: kerngetallen, advies en analyses
  "ftp",
  "belasting",
  "fitheid",
  "vermoeidheid",
  "vorm",
  "readiness",
  "herstel",
  "trainingsadvies",
  "records",
  "materiaalstatus",
  "wedstrijdanalyse",
  "voedingsadvies",
  "onzekerheid",
]

test("registry bevat alle vereiste keys", () => {
  for (const key of VEREISTE_KEYS) {
    assert.ok(UITLEG[key], `key ontbreekt in UITLEG: ${key}`)
  }
})

test("elke uitleg heeft drie gevulde lagen en een versienummer", () => {
  for (const [key, u] of Object.entries(UITLEG)) {
    assert.ok(u.wat.trim().length > 10, `${key}: 'wat' te kort of leeg`)
    assert.ok(u.waarom.trim().length > 10, `${key}: 'waarom' te kort of leeg`)
    assert.ok(u.hoe.trim().length > 10, `${key}: 'hoe' te kort of leeg`)
    assert.ok(
      Number.isInteger(u.versie) && u.versie >= 1,
      `${key}: versie moet een geheel getal >= 1 zijn`,
    )
  }
})

test("geen dubbele definitie: elke term heeft een unieke 'wat'-tekst", () => {
  const gezien = new Map<string, string>()
  for (const [key, u] of Object.entries(UITLEG)) {
    const eerder = gezien.get(u.wat)
    assert.ok(!eerder, `dubbele definitie: ${key} en ${eerder} delen dezelfde 'wat'`)
    gezien.set(u.wat, key)
  }
})

test("geen user-facing 'AI' in uitlegteksten", () => {
  const aiPattern = /\bA\.?I\.?\b/
  for (const [key, u] of Object.entries(UITLEG)) {
    for (const laag of [u.wat, u.waarom, u.hoe]) {
      assert.ok(!aiPattern.test(laag), `${key}: bevat 'AI' in tekst: ${laag}`)
    }
  }
})

test("contextbouwer: geeft lege lijst zonder persoonlijke data", () => {
  assert.deepEqual(buildUitlegContextRegels("ftp", null), [])
  assert.deepEqual(buildUitlegContextRegels("ftp", undefined), [])
  assert.deepEqual(buildUitlegContextRegels("onbekende-key", { ftp: 250 }), [])
})

test("contextbouwer: FTP met echte waarde, w/kg en schattings-eerlijkheid", () => {
  const exact = buildUitlegContextRegels("ftp", { ftp: 250, weightKg: 70 })
  assert.ok(exact[0].includes("250 W"))
  assert.ok(!exact[0].includes("schatting"))
  assert.ok(exact[1].includes("3.6 W/kg"))

  const geschat = buildUitlegContextRegels("ftp", { ftp: 250, ftpEstimated: true })
  assert.ok(geschat[0].includes("schatting"))

  const ontbreekt = buildUitlegContextRegels("ftp", {})
  assert.equal(ontbreekt.length, 1)
  assert.ok(ontbreekt[0].includes("nog niet bekend"))
})

test("contextbouwer: belasting eerlijk over ontbrekende FTP", () => {
  const met = buildUitlegContextRegels("belasting", { ftp: 220 })
  assert.ok(met[0].includes("220 W"))
  const zonder = buildUitlegContextRegels("belasting", {})
  assert.ok(zonder[0].includes("Zonder bekende FTP"))
})

test("contextbouwer: fitheid/vermoeidheid/vorm gebruiken echte waarden of zijn eerlijk leeg", () => {
  assert.ok(buildUitlegContextRegels("fitheid", { ctl: 54.4 })[0].includes("54"))
  assert.ok(
    buildUitlegContextRegels("fitheid", {})[0].includes("te weinig trainingsdata"),
  )
  assert.ok(buildUitlegContextRegels("vermoeidheid", { atl: 61 })[0].includes("61"))
  assert.ok(buildUitlegContextRegels("vorm", { tsb: 8 })[0].includes("fris"))
  assert.ok(buildUitlegContextRegels("vorm", { tsb: -20 })[0].includes("herstel"))
  assert.ok(buildUitlegContextRegels("vorm", { tsb: -3 })[0].includes("normaal"))
})

test("contextbouwer: readiness alleen met echte check-in", () => {
  const met = buildUitlegContextRegels("readiness", {
    readinessScore: 72,
    readinessState: "GOED",
  })
  assert.ok(met[0].includes("72 van 100"))
  assert.ok(met[0].includes("goed"))
  const zonder = buildUitlegContextRegels("readiness", {})
  assert.ok(zonder[0].includes("geen check-in"))
})

test("contextbouwer: voedingsadvies met en zonder gewicht", () => {
  assert.ok(
    buildUitlegContextRegels("voedingsadvies", { weightKg: 68 })[0].includes("68 kg"),
  )
  assert.ok(
    buildUitlegContextRegels("voedingsadvies", {})[0].includes("niet bekend"),
  )
})

test("contextbouwer: verzint nooit getallen die niet zijn meegegeven", () => {
  // Alle regels zonder input mogen geen cijfers bevatten behalve vaste
  // schaal-uitleg — hier: geen enkele.
  const keys = ["ftp", "belasting", "fitheid", "vermoeidheid", "vorm", "readiness"]
  for (const key of keys) {
    for (const regel of buildUitlegContextRegels(key, {} as UitlegPersoonlijk)) {
      assert.ok(
        !/\d/.test(regel.replace("100", "")),
        `${key}: regel zonder data bevat toch een getal: ${regel}`,
      )
    }
  }
})
