// Tests voor de centrale uitleg-registry en de persoonlijke contextbouwer.
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  UITLEG,
  UITLEG_DOEN,
  VORM_UITLEG_BASIS,
  VORM_UITLEG_WAARSCHUWING,
  vormGrafiekUitleg,
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
  "trainingsvolume",
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

// Twee-zinnen-opbouw (B6 04-08): kaarten in Analyse tonen altijd wat je ziet
// (wat) + wat je ermee doet (doen). Deze keys dragen kaarten in Analyse of de
// sessie-drawer en moeten dus een doen-zin hebben.
const ANALYSE_KAART_KEYS = [
  "fitheid", "vermoeidheid", "vorm", "belasting", "belastingsverloop", "trainingsvolume",
  "intensiteitsverdeling", "slaap", "readinessTrend", "hrvTrend",
  "performanceRadar", "ftpOntwikkeling", "records", "gewichtWkg",
  "doelscenario", "doelenOverzicht", "sessielijst",
  "vermogen", "hartslag", "vermogenszones", "hartslagzones",
  "hartslagdrift", "vermogensverval", "pacing", "intervallen",
]

test("B6: elke Analyse-kaart-key heeft een doen-zin (wat je ermee doet)", () => {
  for (const key of ANALYSE_KAART_KEYS) {
    assert.ok(UITLEG[key], `key ontbreekt in UITLEG: ${key}`)
    const doen = UITLEG_DOEN[key]
    assert.ok(doen && doen.trim().length > 10, `${key}: doen-zin ontbreekt of te kort`)
  }
})

test("B6: elke doen-zin hoort bij een bestaande registry-key en bevat geen 'AI'", () => {
  const aiPattern = /\bA\.?I\.?\b/
  for (const [key, doen] of Object.entries(UITLEG_DOEN)) {
    assert.ok(UITLEG[key], `UITLEG_DOEN heeft key zonder registry-entry: ${key}`)
    assert.ok(!aiPattern.test(doen), `${key}: doen-zin bevat 'AI'`)
  }
})

test("§6/T7: vormgrafiek-uitleg — basis altijd, waarschuwing bij weinig activiteiten", () => {
  // T7: periode met precies 1 activiteit → waarschuwende zin staat er.
  const een = vormGrafiekUitleg(1, 14)
  assert.ok(een.waarschuwing)
  assert.ok(een.tekst.includes(VORM_UITLEG_BASIS))
  assert.ok(een.tekst.includes(VORM_UITLEG_WAARSCHUWING))
  assert.ok(een.tekst.includes("groen zonder training ervoor is geen vorm"))

  // Nul activiteiten: ook waarschuwen.
  assert.ok(vormGrafiekUitleg(0, 90).waarschuwing)

  // Regelmatig trainen: geen waarschuwing, wél de vaste basistekst.
  const veel = vormGrafiekUitleg(20, 30)
  assert.ok(!veel.waarschuwing)
  assert.equal(veel.tekst, VORM_UITLEG_BASIS)

  // Lange periode met te dun ritme (5 ritten in een jaar) blijft weinig.
  assert.ok(vormGrafiekUitleg(5, 365).waarschuwing)
})

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
