// R7/R16-tests voor het aanpassen van routes op het nieuwe mobiele
// routescherm: elk gebaar (punt op de lijn pinnen, punt verslepen, punt
// verwijderen, waypoint toevoegen, in-/uitkorten, klim toevoegen) levert
// PRECIES ÉÉN routeaanvraag op — nooit nul (behalve bij de guards) en nooit
// twee.

import test from "node:test"
import assert from "node:assert/strict"
import {
  afstandNaInkorten,
  afstandNaUitkorten,
  bouwAanpassingsInput,
  viaNaPin,
  viaNaSleep,
  viaNaVerwijderen,
  voerAanpassingUit,
  type AanpassingContext,
} from "./route-aanpassing"

const kandidaat = {
  sport: "cycling" as const,
  trainingType: "duurtraining",
  targetDistanceKm: 40,
  distanceKm: 41.2,
}

function ctx(extra: Partial<AanpassingContext> = {}): AanpassingContext {
  return {
    bezig: false,
    center: { lat: 52.09, lon: 5.12 },
    kandidaat,
    fallbackTrainingType: "duurtraining",
    fallbackAfstandKm: 40,
    viaPunten: [],
    klimDetail: null,
    klimVoet: null,
    ...extra,
  }
}

// Hulpteller: hoe vaak wordt er echt een aanvraag verstuurd?
function teller() {
  const calls: unknown[] = []
  return { calls, verstuur: (input: unknown) => calls.push(input) }
}

test("punt op de lijn pinnen = precies één aanvraag met dat via-punt", () => {
  const via = viaNaPin([], [52.1, 5.2])
  const t = teller()
  const gestart = voerAanpassingUit(ctx({ viaPunten: via }), { reden: "punt-verslepen", via }, t.verstuur)
  assert.equal(gestart, true)
  assert.equal(t.calls.length, 1)
  const input = t.calls[0] as { viaPoints?: [number, number][]; mode: string }
  assert.equal(input.mode, "loop")
  assert.deepEqual(input.viaPoints, [[52.1, 5.2]])
})

test("punt verslepen = precies één aanvraag met het verplaatste punt", () => {
  const via = viaNaSleep([[52.1, 5.2]], 0, [52.15, 5.25])
  assert.deepEqual(via, [[52.15, 5.25]])
  const t = teller()
  voerAanpassingUit(ctx({ viaPunten: via }), { reden: "punt-verslepen", via }, t.verstuur)
  assert.equal(t.calls.length, 1)
  assert.deepEqual((t.calls[0] as { viaPoints?: unknown }).viaPoints, [[52.15, 5.25]])
})

test("punt verwijderen = precies één aanvraag zónder dat punt", () => {
  const via = viaNaVerwijderen([[52.1, 5.2], [52.2, 5.3]], 0)
  assert.deepEqual(via, [[52.2, 5.3]])
  const t = teller()
  voerAanpassingUit(ctx({ viaPunten: via }), { reden: "waypoint", via }, t.verstuur)
  assert.equal(t.calls.length, 1)
  assert.deepEqual((t.calls[0] as { viaPoints?: unknown }).viaPoints, [[52.2, 5.3]])
})

test("laatste punt verwijderen = één aanvraag zonder viaPoints", () => {
  const via = viaNaVerwijderen([[52.1, 5.2]], 0)
  const t = teller()
  voerAanpassingUit(ctx({ viaPunten: via }), { reden: "waypoint", via }, t.verstuur)
  assert.equal(t.calls.length, 1)
  assert.equal((t.calls[0] as { viaPoints?: unknown }).viaPoints, undefined)
})

test("inkorten/uitkorten = één aanvraag met de nieuwe doelafstand (±25%)", () => {
  assert.equal(afstandNaInkorten(40), 30)
  assert.equal(afstandNaUitkorten(40), 50)
  assert.equal(afstandNaInkorten(6), 5, "eerlijke ondergrens van 5 km")
  const t = teller()
  voerAanpassingUit(ctx(), { reden: "inkorten", afstand: afstandNaInkorten(40) }, t.verstuur)
  assert.equal(t.calls.length, 1)
  assert.equal((t.calls[0] as { targetDistanceKm?: number }).targetDistanceKm, 30)
})

test("klim toevoegen = één aanvraag met voet+top als via-punten én climbCheck", () => {
  const t = teller()
  voerAanpassingUit(
    ctx({
      klimDetail: { osmId: "n123", name: "Posbank", lat: 52.03, lon: 6.02 },
      klimVoet: [52.02, 6.0],
      viaPunten: [[52.1, 5.2]],
    }),
    { reden: "klim" },
    t.verstuur,
  )
  assert.equal(t.calls.length, 1)
  const input = t.calls[0] as {
    viaPoints?: [number, number][]
    climbCheck?: { osmId: string | null; name: string; summitLat: number; summitLon: number }
  }
  // Eigen via-punten blijven staan, klimvoet + top reizen mee.
  assert.deepEqual(input.viaPoints, [[52.1, 5.2], [52.02, 6.0], [52.03, 6.02]])
  assert.deepEqual(input.climbCheck, {
    osmId: "n123",
    name: "Posbank",
    summitLat: 52.03,
    summitLon: 6.02,
  })
})

test("klim zonder geladen voet reist NOOIT stiekem mee", () => {
  const input = bouwAanpassingsInput(
    ctx({ klimDetail: { osmId: "n123", name: "Posbank", lat: 52.03, lon: 6.02 }, klimVoet: null }),
    { reden: "klim" },
  )
  assert.ok(input)
  assert.equal(input!.viaPoints, undefined)
  // Ook de climbCheck mag NIET meereizen: de API wijst een climbCheck zonder
  // via-punten af (400) en de klim is zonder voet niet waar te maken.
  assert.equal(input!.climbCheck, undefined)
})

test("profiel-loze klim geselecteerd + inkorten = één geldige aanvraag zonder klim", () => {
  // UI-scenario uit de review: gebruiker kiest een klim zonder bruikbaar
  // profiel (voet ontbreekt) en kort daarna de route in — de hergeneratie
  // moet gewoon slagen, zonder climbCheck en zonder klim-via-punten.
  const t = teller()
  voerAanpassingUit(
    ctx({
      klimDetail: { osmId: "n123", name: "Posbank", lat: 52.03, lon: 6.02 },
      klimVoet: null,
    }),
    { reden: "inkorten", afstand: 30 },
    t.verstuur,
  )
  assert.equal(t.calls.length, 1)
  const input = t.calls[0] as { climbCheck?: unknown; viaPoints?: unknown; targetDistanceKm?: number }
  assert.equal(input.climbCheck, undefined)
  assert.equal(input.viaPoints, undefined)
  assert.equal(input.targetDistanceKm, 30)
})

test("guards: lopende aanvraag / geen kandidaat / geen startpunt = géén aanvraag", () => {
  for (const c of [ctx({ bezig: true }), ctx({ kandidaat: null }), ctx({ center: null })]) {
    const t = teller()
    const gestart = voerAanpassingUit(c, { reden: "waypoint" }, t.verstuur)
    assert.equal(gestart, false)
    assert.equal(t.calls.length, 0)
  }
})

test("R16-logregel wordt bij precies één gestarte aanvraag geschreven", () => {
  const regels: string[] = []
  const t = teller()
  voerAanpassingUit(ctx(), { reden: "uitkorten", afstand: 50 }, t.verstuur, (r) => regels.push(r))
  assert.equal(t.calls.length, 1)
  assert.deepEqual(regels, ['[route-scherm] aanpassing "uitkorten" → één routeaanvraag'])
})
