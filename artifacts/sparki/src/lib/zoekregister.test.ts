import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { zoekIngangen, filterZoekIngangen } from "./zoekregister"

// Zoekregister-regressietest — bewaakt de afspraken van de app-brede zoekfunctie:
// 1. élke zoekingang wijst naar een route die echt in App.tsx geregistreerd staat
//    (zoeken mag nooit naar een dood spoor leiden);
// 2. geen dubbele hrefs (hoofdstukken en Meer overlappen deels);
// 3. labels zijn Nederlands en bevatten nooit "AI";
// 4. filteren is accent-ongevoelig en vindt op label, hint én trefwoord;
// 5. te korte zoekopdrachten (<2 tekens) leveren niets op.

const here = path.dirname(fileURLToPath(import.meta.url))
const appSource = readFileSync(path.join(here, "..", "App.tsx"), "utf8")
const routePaths = [...appSource.matchAll(/<Route path="([^"]+)"/g)].map(
  (m) => m[1]!,
)

function routeExists(href: string): boolean {
  const clean = href.split("?")[0]!
  return routePaths.some((p) => {
    const base = p.replace(/\/\*\?$/, "")
    if (base === clean) return true
    return p.endsWith("/*?") && clean.startsWith(base)
  })
}

const ROLES = ["athlete", "coach", "parent"] as const

test("iedere zoekingang wijst naar een geregistreerde route", () => {
  for (const role of ROLES) {
    for (const hasClub of [false, true]) {
      for (const ingang of zoekIngangen(role, hasClub)) {
        assert.ok(
          routeExists(ingang.href),
          `Zoekingang "${ingang.label}" (${ingang.href}, rol ${role}) staat niet in App.tsx`,
        )
      }
    }
  }
})

// Taak #611: de sporter-coach-omgeving is via zoeken vindbaar; Klimmen blijft
// vindbaar ondanks dat het uit het Meer-menu is verhuisd (besluit 01-08-2026).
test("sporter vindt /coach en /klimmen via zoeken", () => {
  const ingangen = zoekIngangen("athlete", false)
  const coach = filterZoekIngangen(ingangen, "coach")
  assert.ok(coach.some((e) => e.href === "/coach"), "zoek 'coach' vindt /coach")
  const klim = filterZoekIngangen(ingangen, "klimmen")
  assert.ok(klim.some((e) => e.href === "/klimmen"), "zoek 'klimmen' vindt /klimmen")
})

test("geen dubbele hrefs per rol", () => {
  for (const role of ROLES) {
    const hrefs = zoekIngangen(role, true).map((e) => e.href)
    assert.equal(hrefs.length, new Set(hrefs).size, `dubbele href voor rol ${role}`)
  }
})

test("geen 'AI' in zichtbare labels of hints", () => {
  for (const role of ROLES) {
    for (const e of zoekIngangen(role, true)) {
      for (const text of [e.label, e.hint]) {
        assert.ok(
          !/\bA\.?I\.?\b/.test(text),
          `"${text}" (${e.href}) bevat 'AI' in zichtbare tekst`,
        )
      }
    }
  }
})

test("club-ingang alleen bij echte clubkoppeling", () => {
  const zonder = zoekIngangen("athlete", false).some((e) => e.href === "/club")
  const met = zoekIngangen("athlete", true).some((e) => e.href === "/club")
  assert.equal(zonder, false, "/club mag niet verschijnen zonder koppeling")
  assert.equal(met, true, "/club moet verschijnen mét koppeling")
})

test("filteren vindt op trefwoord en is accent-ongevoelig", () => {
  const ingangen = zoekIngangen("athlete", false)
  // Trefwoord: "wekker" hoort bij Geluid.
  const wekker = filterZoekIngangen(ingangen, "wekker")
  assert.ok(
    wekker.some((e) => e.href === "/geluid"),
    "'wekker' moet de Geluid-pagina vinden",
  )
  // Accentloos: "voéding" moet gewoon Lichaam vinden.
  const voeding = filterZoekIngangen(ingangen, "voéding")
  assert.ok(
    voeding.some((e) => e.href === "/lichaam"),
    "'voéding' (met accent) moet de Lichaam-pagina vinden",
  )
})

test("te korte zoekopdracht levert niets op", () => {
  const ingangen = zoekIngangen("athlete", false)
  assert.deepEqual(filterZoekIngangen(ingangen, "w"), [])
  assert.deepEqual(filterZoekIngangen(ingangen, "  "), [])
})
