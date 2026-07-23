import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import {
  ATHLETE_NAV_ENTRIES,
  COACH_NAV_ENTRIES,
  PARENT_NAV_ENTRIES,
  ATHLETE_CHAPTERS,
  ATHLETE_MEER_CHAPTERS,
  COACH_CHAPTERS,
  PARENT_CHAPTERS,
  CLUB_CHAPTER,
  chaptersForRole,
} from "./chapters"

// Navigatieregressietest — bewaakt de vaste afspraken van Opdracht 0C:
// 1. de sporter heeft precies vijf hoofdkeuzes (Vandaag·Trainen·Rijden·Wedstrijd·Meer);
// 2. élke navigatielink (hoofdnav, hoofdstukken, Meer) wijst naar een route
//    die echt in App.tsx geregistreerd staat — niets mag onbereikbaar worden;
// 3. rollen coach/ouder behouden hun bestaande navigatie;
// 4. geen "AI" in zichtbare labels, labels zijn Nederlands.

const here = path.dirname(fileURLToPath(import.meta.url))
const appSource = readFileSync(path.join(here, "..", "App.tsx"), "utf8")

// Alle geregistreerde routepaden uit App.tsx (bron van waarheid voor routing).
const routePaths = [...appSource.matchAll(/<Route path="([^"]+)"/g)].map(
  (m) => m[1]!,
)

function routeExists(href: string): boolean {
  const clean = href.split("?")[0]!
  return routePaths.some((p) => {
    const base = p.replace(/\/\*\?$/, "")
    if (base === clean) return true
    // Parametroutes: /profiel/:clerkId dekt /profiel/x — hier niet nodig,
    // maar prefixmatch op sign-in-achtige routes wél.
    return p.endsWith("/*?") && clean.startsWith(base)
  })
}

test("sporter heeft precies vijf hoofdkeuzes in de vaste volgorde", () => {
  assert.equal(ATHLETE_NAV_ENTRIES.length, 5)
  assert.deepEqual(
    ATHLETE_NAV_ENTRIES.map((e) => e.label),
    ["Vandaag", "Trainen", "Rijden", "Wedstrijd", "Meer"],
  )
  assert.deepEqual(
    ATHLETE_NAV_ENTRIES.map((e) => e.href),
    ["/vandaag", "/train", "/routes", "/races", "/meer"],
  )
})

test("elke hoofdnav-link wijst naar een bestaande route", () => {
  for (const e of [
    ...ATHLETE_NAV_ENTRIES,
    ...COACH_NAV_ENTRIES,
    ...PARENT_NAV_ENTRIES,
  ]) {
    assert.ok(routeExists(e.href), `route ontbreekt voor nav-link ${e.href}`)
  }
})

test("alle hoofdstukken en Meer-onderdelen blijven bereikbaar", () => {
  const all = [
    ...ATHLETE_CHAPTERS,
    ...ATHLETE_MEER_CHAPTERS,
    ...COACH_CHAPTERS,
    ...PARENT_CHAPTERS,
    CLUB_CHAPTER,
  ]
  for (const c of all) {
    assert.ok(routeExists(c.href), `route ontbreekt voor hoofdstuk ${c.href} (${c.label})`)
  }
})

test("Meer bevat de verplichte onderdelen", () => {
  const hrefs = new Set(ATHLETE_MEER_CHAPTERS.map((c) => c.href))
  for (const verplicht of ["/you", "/lichaam", "/mechanieker", "/samen", "/wereld", "/kennis"]) {
    assert.ok(hrefs.has(verplicht), `Meer mist ${verplicht}`)
  }
})

test("coach en ouder behouden hun bestaande navigatie", () => {
  assert.deepEqual(
    COACH_NAV_ENTRIES.map((e) => e.href),
    ["/", "/invitations", "/you"],
  )
  assert.deepEqual(
    PARENT_NAV_ENTRIES.map((e) => e.href),
    ["/", "/feed", "/invitations", "/you"],
  )
  assert.deepEqual(
    chaptersForRole("coach", false).map((c) => c.href),
    COACH_CHAPTERS.map((c) => c.href),
  )
  assert.deepEqual(
    chaptersForRole("parent", false).map((c) => c.href),
    PARENT_CHAPTERS.map((c) => c.href),
  )
})

test("club verschijnt alleen bij een echte koppeling", () => {
  const zonder = chaptersForRole("athlete", false).map((c) => c.href)
  const met = chaptersForRole("athlete", true).map((c) => c.href)
  assert.ok(!zonder.includes("/club"))
  assert.ok(met.includes("/club"))
})

test("paginacrash-fallback behoudt de navigatie (uitweg naar andere tab)", () => {
  // Contract: de per-pagina ErrorBoundary in App.tsx gebruikt een fallback
  // die de onderbalk (BottomNav) bevat, zodat één kapot menu-item nooit de
  // navigatie meetrekt.
  assert.ok(
    /function PageErrorFallback\(\)[\s\S]*?<BottomNav \/>/m.test(appSource),
    "PageErrorFallback moet BottomNav renderen",
  )
  assert.ok(
    /<ErrorBoundary[^>]*fallback=\{<PageErrorFallback \/>\}/.test(appSource),
    "ProtectedPage-ErrorBoundary moet de PageErrorFallback gebruiken",
  )
})

test("geen 'AI' in zichtbare labels of hints", () => {
  const all = [
    ...ATHLETE_NAV_ENTRIES.map((e) => e.label),
    ...ATHLETE_CHAPTERS.flatMap((c) => [c.label, c.hint]),
    ...ATHLETE_MEER_CHAPTERS.flatMap((c) => [c.label, c.hint]),
  ]
  for (const text of all) {
    assert.ok(!/\bAI\b|\bA\.I\./i.test(text), `verboden 'AI' in "${text}"`)
  }
})
