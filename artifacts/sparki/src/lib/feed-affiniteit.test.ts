import { test } from "node:test"
import assert from "node:assert/strict"
import {
  berekenAffiniteit,
  MIN_INTERACTIES,
  type FeedInteractie,
} from "./feed-affiniteit"
import { scoreKaart, type FeedKaart } from "./ontdekken-feed"

const interactie = (over: Partial<FeedInteractie>): FeedInteractie => ({
  soort: "open",
  categorie: "materiaal",
  bron: null,
  opIso: "2026-07-28T10:00:00Z",
  ...over,
})

const ctx = {
  todayIso: "2026-07-28",
  minderCategorie: [] as string[],
  minderBron: [] as string[],
  bewaardeTitels: [] as string[],
}

const basis = (over: Partial<FeedKaart>): Omit<FeedKaart, "score"> => ({
  key: "k",
  type: "nieuws",
  titel: "Titel",
  samenvatting: null,
  bron: null,
  tijdIso: "2026-07-28T00:00:00Z",
  link: null,
  extern: false,
  ...over,
})

test("honest default: onder het minimum is affiniteit niet actief", () => {
  const weinig = Array.from({ length: MIN_INTERACTIES - 1 }, () => interactie({}))
  const aff = berekenAffiniteit(weinig)
  assert.equal(aff.actief, false)
  assert.deepEqual(aff.categorie, {})
  assert.deepEqual(aff.bron, {})
})

test("genoeg interacties: categorie- en bron-affiniteit opgebouwd", () => {
  const veel = [
    ...Array.from({ length: 4 }, () => interactie({ categorie: "materiaal", bron: "Wielerblad" })),
    interactie({ categorie: "trainingstip" }),
    interactie({ soort: "bewaar", categorie: "materiaal", bron: "Wielerblad" }),
  ]
  const aff = berekenAffiniteit(veel)
  assert.equal(aff.actief, true)
  assert.ok((aff.categorie["materiaal"] ?? 0) > (aff.categorie["trainingstip"] ?? 0))
  assert.ok((aff.bron["Wielerblad"] ?? 0) > 0)
})

test("bewaar weegt zwaarder dan open", () => {
  const lijst = [
    ...Array.from({ length: 3 }, () => interactie({ categorie: "route" })),
    ...Array.from({ length: 2 }, () => interactie({ soort: "bewaar" as const, categorie: "klim" })),
  ]
  const aff = berekenAffiniteit(lijst)
  assert.equal(aff.actief, true)
  // 3 opens (3 punten) vs 2 bewaringen (4 punten)
  assert.ok((aff.categorie["klim"] ?? 0) > (aff.categorie["route"] ?? 0))
})

test("scoreKaart: actieve affiniteit boost categorie en bron", () => {
  const kern = new Set<string>()
  const aff = {
    actief: true,
    aantal: 10,
    categorie: { materiaal: 12 },
    bron: { Wielerblad: 6 },
  }
  const zonder = scoreKaart(basis({ type: "materiaal", bron: "Wielerblad" }), ctx, kern)
  const met = scoreKaart(basis({ type: "materiaal", bron: "Wielerblad" }), { ...ctx, affiniteit: aff }, kern)
  assert.equal(met, zonder + 12 + 6)
})

test("scoreKaart: niet-actieve affiniteit verandert de score niet", () => {
  const kern = new Set<string>()
  const aff = { actief: false, aantal: 2, categorie: { nieuws: 99 }, bron: {} }
  const zonder = scoreKaart(basis({}), ctx, kern)
  const met = scoreKaart(basis({}), { ...ctx, affiniteit: aff }, kern)
  assert.equal(met, zonder)
})

test("affiniteit overstemt 'minder hiervan' nooit", () => {
  const kern = new Set<string>()
  const aff = { actief: true, aantal: 20, categorie: { nieuws: 20 }, bron: {} }
  const normaal = scoreKaart(basis({}), ctx, kern)
  const gedemptMetAffiniteit = scoreKaart(
    basis({}),
    { ...ctx, minderCategorie: ["nieuws"], affiniteit: aff },
    kern,
  )
  assert.ok(gedemptMetAffiniteit < normaal)
})
