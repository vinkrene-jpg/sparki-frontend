import test from "node:test"
import assert from "node:assert/strict"
import { displayRouteName } from "./route-name"

test("automatische 'Gereden: Eigen route vanuit …'-naam wordt opgeschoond", () => {
  const r = displayRouteName(
    "Gereden: Eigen route vanuit BGV · 43.2 km · 12 aug",
    43.2,
  )
  assert.equal(r.display, "Ronde vanuit BGV — 43 km")
  assert.equal(r.startHint, "BGV")
  assert.equal(r.cleaned, true)
})

test("opschonen zonder bekende afstand laat de km weg", () => {
  const r = displayRouteName("Gereden: Eigen route vanuit Utrecht", null)
  assert.equal(r.display, "Ronde vanuit Utrecht")
  assert.equal(r.cleaned, true)
})

test("meerwoordige startplaats blijft heel", () => {
  const r = displayRouteName(
    "Gereden: Eigen route vanuit Den Haag · 61 km",
    61.4,
  )
  assert.equal(r.display, "Ronde vanuit Den Haag — 61 km")
  assert.equal(r.startHint, "Den Haag")
})

test("zelfgekozen naam blijft exact zoals de gebruiker hem gaf", () => {
  const r = displayRouteName("Mijn zondagsrondje kasseien", 88)
  assert.equal(r.display, "Mijn zondagsrondje kasseien")
  assert.equal(r.cleaned, false)
})

test("'vanuit X' in een gewone naam geeft alleen een start-hint", () => {
  const r = displayRouteName("Trainingsrit vanuit Amersfoort met klimmetjes", 70)
  assert.equal(r.display, "Trainingsrit vanuit Amersfoort met klimmetjes")
  assert.equal(r.startHint, "Amersfoort")
  assert.equal(r.cleaned, false)
})
