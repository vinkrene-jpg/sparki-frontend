// Tests voor de Meer-indeling (testbaar zonder React). Legt vast: vaste
// groepsvolgorde; alle ATHLETE_MEER_CHAPTERS-items exact een keer; club- en
// admin-conditie; coach- en oudervariant bevatten al hun items; geen emoji/
// symbolen in labels (alleen letters, cijfers, spaties en normale leestekens).
//
// Run with: node ../../scripts/run-tsx-test.mjs src/lib/core-meer.test.ts

import { test } from "node:test"
import assert from "node:assert/strict"
import { bouwMeerGroepen } from "./core-meer"
import {
  ATHLETE_MEER_CHAPTERS,
  CLUB_CHAPTER,
  COACH_CHAPTERS,
  PARENT_CHAPTERS,
} from "./chapters"

// Vaste groepsvolgorde (harde eis).
const VASTE_VOLGORDE_ATLEET = [
  "Profiel & account",
  "Veelgebruikt",
  "Sport & materiaal",
  "Koppelingen & gegevens",
  "Ondersteuning & kennis",
  // Sinds Beslisblok 01 altijd aanwezig (Privacy + Voorwaarden voor iedereen).
  "Beheer, instellingen & privacy",
]

const VASTE_VOLGORDE_ATLEET_ADMIN = VASTE_VOLGORDE_ATLEET

const VASTE_VOLGORDE_COACH_OUDER = [
  "Profiel & account",
  "Veelgebruikt",
  "Ondersteuning & kennis",
  "Beheer, instellingen & privacy",
]

test("atleet: vaste groepsvolgorde zonder admin", () => {
  const groepen = bouwMeerGroepen({
    role: "athlete",
    isClubMember: false,
    isAdmin: false,
  })
  assert.deepEqual(
    groepen.map((g) => g.titel),
    VASTE_VOLGORDE_ATLEET,
  )
})

test("atleet: vaste groepsvolgorde met admin", () => {
  const groepen = bouwMeerGroepen({
    role: "athlete",
    isClubMember: false,
    isAdmin: true,
  })
  assert.deepEqual(
    groepen.map((g) => g.titel),
    VASTE_VOLGORDE_ATLEET_ADMIN,
  )
})

test("atleet: alle ATHLETE_MEER_CHAPTERS exact een keer", () => {
  const groepen = bouwMeerGroepen({
    role: "athlete",
    isClubMember: false,
    isAdmin: false,
  })
  const alleHrefs = groepen.flatMap((g) => g.items.map((i) => i.href))
  const verwachtHrefs = ATHLETE_MEER_CHAPTERS.map((ch) => ch.href)
  // + Connect, Support (losse knoppen in de oude pagina) + Analyse (staat
  // inmiddels ook in de mobiele onderbalk; blijft daarnaast vast vindbaar
  // via Meer).
  verwachtHrefs.push("/connect", "/support", "/analyse")
  // Beslisblok 01: Photo Lab-ingang + Privacy en Voorwaarden in Meer.
  verwachtHrefs.push("/photo-lab", "/privacy", "/voorwaarden")
  const sorted = [...alleHrefs].sort()
  const verwacht = [...verwachtHrefs].sort()
  assert.deepEqual(sorted, verwacht, "alle chapters precies een keer")
})

test("atleet: club-conditie (wel/niet lid)", () => {
  const zonder = bouwMeerGroepen({
    role: "athlete",
    isClubMember: false,
    isAdmin: false,
  })
  const met = bouwMeerGroepen({
    role: "athlete",
    isClubMember: true,
    isAdmin: false,
  })
  const zonderHrefs = zonder.flatMap((g) => g.items.map((i) => i.href))
  const metHrefs = met.flatMap((g) => g.items.map((i) => i.href))

  assert.ok(!zonderHrefs.includes("/club"), "zonder lid geen /club")
  assert.ok(metHrefs.includes("/club"), "met lid wel /club")
})

test("atleet: admin-conditie", () => {
  const zonder = bouwMeerGroepen({
    role: "athlete",
    isClubMember: false,
    isAdmin: false,
  })
  const met = bouwMeerGroepen({
    role: "athlete",
    isClubMember: false,
    isAdmin: true,
  })
  const zonderHrefs = zonder.flatMap((g) => g.items.map((i) => i.href))
  const metHrefs = met.flatMap((g) => g.items.map((i) => i.href))

  assert.ok(!zonderHrefs.includes("/admin"), "zonder admin geen /admin")
  assert.ok(metHrefs.includes("/admin"), "met admin wel /admin")

  const adminGroep = met.find((g) => g.titel === "Beheer, instellingen & privacy")
  assert.ok(adminGroep, "admin-groep aanwezig")
  assert.deepEqual(
    adminGroep!.items.map((i) => i.href),
    ["/admin", "/privacy", "/voorwaarden"],
  )
  const zonderGroep = zonder.find(
    (g) => g.titel === "Beheer, instellingen & privacy",
  )
  assert.ok(zonderGroep, "privacy-groep ook zonder admin aanwezig")
  assert.deepEqual(
    zonderGroep!.items.map((i) => i.href),
    ["/privacy", "/voorwaarden"],
  )
})

test("coach: alle COACH_CHAPTERS + Support", () => {
  const groepen = bouwMeerGroepen({
    role: "coach",
    isClubMember: false,
    isAdmin: false,
  })
  const hrefs = groepen.flatMap((g) => g.items.map((i) => i.href))
  const verwacht = [
    ...COACH_CHAPTERS.map((ch) => ch.href),
    "/support",
    "/privacy",
    "/voorwaarden",
  ].sort()
  assert.deepEqual([...hrefs].sort(), verwacht)
})

test("coach: vaste groepsvolgorde", () => {
  const groepen = bouwMeerGroepen({
    role: "coach",
    isClubMember: false,
    isAdmin: false,
  })
  assert.deepEqual(
    groepen.map((g) => g.titel),
    VASTE_VOLGORDE_COACH_OUDER,
  )
})

test("ouder: alle PARENT_CHAPTERS + Support", () => {
  const groepen = bouwMeerGroepen({
    role: "parent",
    isClubMember: false,
    isAdmin: false,
  })
  const hrefs = groepen.flatMap((g) => g.items.map((i) => i.href))
  // PARENT_CHAPTERS bevat zelf al /support (rij "Hulp"); op de Meer-pagina
  // hoort elke bestemming precies één keer — dus ontdubbelen in de verwachting.
  const verwacht = [
    ...new Set([
      ...PARENT_CHAPTERS.map((ch) => ch.href),
      "/support",
      "/privacy",
      "/voorwaarden",
    ]),
  ].sort()
  assert.deepEqual([...hrefs].sort(), verwacht)
})

// Taak #611: de sporter-coach-omgeving (/coach) is vindbaar via het Meer-menu.
test("atleet: /coach staat in de Meer-indeling (Veelgebruikt)", () => {
  const groepen = bouwMeerGroepen({
    role: "athlete",
    isClubMember: false,
    isAdmin: false,
  })
  const veelgebruikt = groepen.find((g) => g.titel === "Veelgebruikt")
  assert.ok(veelgebruikt, "groep Veelgebruikt aanwezig")
  assert.ok(
    veelgebruikt!.items.some((i) => i.href === "/coach"),
    "/coach vindbaar in Veelgebruikt",
  )
})

test("ouder: vaste groepsvolgorde", () => {
  const groepen = bouwMeerGroepen({
    role: "parent",
    isClubMember: false,
    isAdmin: false,
  })
  assert.deepEqual(
    groepen.map((g) => g.titel),
    VASTE_VOLGORDE_COACH_OUDER,
  )
})

test("labels: geen emoji of symbolen", () => {
  // Regex: alles buiten letters, cijfers, spaties en normale leestekens (.,&-') afkeuren.
  const toegestaan = /^[a-zA-Z0-9\s.,&'\-éëïöüáàèôû]+$/
  const atleet = bouwMeerGroepen({
    role: "athlete",
    isClubMember: true,
    isAdmin: true,
  })
  const coach = bouwMeerGroepen({
    role: "coach",
    isClubMember: false,
    isAdmin: false,
  })
  const ouder = bouwMeerGroepen({
    role: "parent",
    isClubMember: false,
    isAdmin: false,
  })

  for (const groep of [...atleet, ...coach, ...ouder]) {
    assert.ok(
      toegestaan.test(groep.titel),
      `groep-titel "${groep.titel}" bevat geen symbolen`,
    )
    for (const item of groep.items) {
      assert.ok(
        toegestaan.test(item.label),
        `item-label "${item.label}" bevat geen symbolen`,
      )
      assert.ok(
        toegestaan.test(item.hint),
        `item-hint "${item.hint}" bevat geen symbolen`,
      )
    }
  }
})
