import { test } from "node:test"
import assert from "node:assert/strict"
import {
  classificeerNieuws,
  bewaardeKernwoorden,
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
