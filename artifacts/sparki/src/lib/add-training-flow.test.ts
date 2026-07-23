import { test } from "node:test"
import assert from "node:assert/strict"
import { chooseInitialMode, TRAINING_TYPE_OPTIONS } from "./add-training-flow"

const TODAY = "2026-07-23"

test("zonder datumcontext toont het venster eerst de keuze", () => {
  assert.equal(chooseInitialMode(null, TODAY), "kies")
  assert.equal(chooseInitialMode(undefined, TODAY), "kies")
  assert.equal(chooseInitialMode("", TODAY), "kies")
})

test("toekomstige kalenderdag selecteert automatisch inplannen", () => {
  assert.equal(chooseInitialMode("2026-07-24", TODAY), "plan")
  assert.equal(chooseInitialMode("2026-12-01", TODAY), "plan")
})

test("verstreken kalenderdag stelt registreren voor", () => {
  assert.equal(chooseInitialMode("2026-07-22", TODAY), "log")
  assert.equal(chooseInitialMode("2025-01-01", TODAY), "log")
})

test("vandaag blijft een keuze (plannen én registreren kan)", () => {
  assert.equal(chooseInitialMode(TODAY, TODAY), "kies")
})

test("ongeldige datum valt eerlijk terug op de keuze", () => {
  assert.equal(chooseInitialMode("morgen", TODAY), "kies")
  assert.equal(chooseInitialMode("2026-7-4", TODAY), "kies")
})

test("'Rit' is vervangen door Fietstraining; crosstraining duidelijk gelabeld", () => {
  const byValue = Object.fromEntries(
    TRAINING_TYPE_OPTIONS.map((o) => [o.value, o.label]),
  )
  assert.equal(byValue["ride"], "Fietstraining")
  assert.equal(byValue["run"], "Crosstraining — hardlopen")
  assert.equal(byValue["swim"], "Crosstraining — zwemmen")
  assert.ok(byValue["strength"]?.includes("ondersteunend"))
  // Geen enkel label heet nog kaal "Rit", "Hardlopen" of "Zwemmen".
  for (const o of TRAINING_TYPE_OPTIONS) {
    assert.notEqual(o.label, "Rit")
    assert.notEqual(o.label, "Hardlopen")
    assert.notEqual(o.label, "Zwemmen")
  }
})
