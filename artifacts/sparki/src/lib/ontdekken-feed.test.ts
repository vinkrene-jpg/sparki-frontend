import { test } from "node:test"
import assert from "node:assert/strict"
import {
  classificeerNieuws,
  bewaardeKernwoorden,
  vindGarageMatch,
  scoreKaart,
  mengFeed,
  stabieleIndex,
  type FeedKaart,
} from "./ontdekken-feed"

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

test("classificatie: materiaalwoorden → materiaal", () => {
  assert.equal(classificeerNieuws("Nieuwe groepset van SRAM aangekondigd"), "materiaal")
  assert.equal(classificeerNieuws("Tubeless banden getest"), "materiaal")
})

test("classificatie: trainingswoorden → trainingstip", () => {
  assert.equal(classificeerNieuws("Zo verbeter je je FTP met intervallen"), "trainingstip")
})

test("classificatie: woordgrens — 'transport' is geen sport/materiaal-hit", () => {
  assert.equal(classificeerNieuws("Transportstaking treft de stad"), "nieuws")
})

test("score: ouder nieuws scoort lager", () => {
  const kern = new Set<string>()
  const vers = scoreKaart(basis({ tijdIso: "2026-07-28" }), ctx, kern)
  const oud = scoreKaart(basis({ tijdIso: "2026-07-20" }), ctx, kern)
  assert.ok(vers > oud)
})

test("score: nabije wedstrijd scoort hoger dan verre", () => {
  const kern = new Set<string>()
  const dichtbij = scoreKaart(basis({ type: "wedstrijd", tijdIso: "2026-07-30" }), ctx, kern)
  const ver = scoreKaart(basis({ type: "wedstrijd", tijdIso: "2026-09-30" }), ctx, kern)
  assert.ok(dichtbij > ver)
})

test("score: 'minder hiervan' dempt categorie en bron", () => {
  const kern = new Set<string>()
  const normaal = scoreKaart(basis({}), ctx, kern)
  const gedemptCat = scoreKaart(basis({}), { ...ctx, minderCategorie: ["nieuws"] }, kern)
  const gedemptBron = scoreKaart(basis({ bron: "X" }), { ...ctx, minderBron: ["X"] }, kern)
  assert.ok(gedemptCat < normaal)
  assert.ok(gedemptBron < normaal)
})

test("score: bewaard-onderwerp boost via kernwoorden", () => {
  const kern = bewaardeKernwoorden(["Alles over tubeless banden"])
  const met = scoreKaart(basis({ titel: "Nieuwe tubeless test" }), ctx, kern)
  const zonder = scoreKaart(basis({ titel: "Iets anders" }), ctx, kern)
  assert.ok(met > zonder)
})

test("garage-match: merk met woordgrens, meest specifiek wint", () => {
  const items = [
    { brand: "Canyon", model: "Ultimate CF SL" },
    { brand: "Shimano", model: "105" },
  ]
  // merk + model in de tekst ⇒ specifiek label
  assert.equal(
    vindGarageMatch("Review: de Canyon Ultimate CF SL van 2026", items),
    "Canyon Ultimate CF SL",
  )
  // alleen merk ⇒ merk-label
  assert.equal(vindGarageMatch("Canyon presenteert nieuwe aero-lijn", items), "Canyon")
  // substring is GEEN match (woordgrens)
  assert.equal(vindGarageMatch("Fietsen door Canyonlands National Park", items), null)
  // puur numeriek model ("105") matcht nooit als los woord
  assert.equal(vindGarageMatch("Wielrenner rijdt 105 kilometer", items), null)
  // geen garage-item in de tekst ⇒ null
  assert.equal(vindGarageMatch("Trek lanceert nieuwe Madone", items), null)
})

test("garage-match: lege of te korte merken matchen niet", () => {
  assert.equal(vindGarageMatch("BMC nieuws", [{ brand: "", model: null }]), null)
  assert.equal(vindGarageMatch("De AG fiets", [{ brand: "AG", model: null }]), null)
})

test("score: garage-match geeft eerlijke boost, zonder match ongewijzigd", () => {
  const kern = new Set<string>()
  const zonder = scoreKaart(basis({ type: "materiaal" }), ctx, kern)
  const met = scoreKaart(basis({ type: "materiaal", garageMatch: "Canyon" }), ctx, kern)
  const nul = scoreKaart(basis({ type: "materiaal", garageMatch: null }), ctx, kern)
  assert.ok(met > zonder)
  assert.equal(nul, zonder)
})

test("mengFeed: nooit 3 dezelfde types op rij als er alternatief is", () => {
  const kaarten: FeedKaart[] = [
    { ...basis({ key: "a", type: "nieuws" }), score: 100 },
    { ...basis({ key: "b", type: "nieuws" }), score: 90 },
    { ...basis({ key: "c", type: "nieuws" }), score: 80 },
    { ...basis({ key: "d", type: "route" }), score: 10 },
  ]
  const uit = mengFeed(kaarten)
  for (let i = 2; i < uit.length; i++) {
    const drieDezelfde = uit[i].type === uit[i - 1].type && uit[i].type === uit[i - 2].type
    assert.equal(drieDezelfde, false)
  }
})

test("stabieleIndex: deterministisch en binnen bereik", () => {
  assert.equal(stabieleIndex("news-12", 7), stabieleIndex("news-12", 7))
  for (const k of ["a", "news-1", "route-99"]) {
    const i = stabieleIndex(k, 5)
    assert.ok(i >= 0 && i < 5)
  }
})
