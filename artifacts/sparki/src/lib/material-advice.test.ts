// Materiaalcoach-eerlijkheid (Beslisblok 01, veilige fix 6): bij
// confidence "unknown" geen stellig advies tonen; bij elk ander niveau wel.
//
// Run with: node ../../scripts/run-tsx-test.mjs src/lib/material-advice.test.ts

import { test } from "node:test"
import assert from "node:assert/strict"
import { magAdviesTonen, ADVIES_ONBEKEND_TEKST } from "./material-advice"

test("unknown → geen advies", () => {
  assert.equal(magAdviesTonen("unknown"), false)
})

test("ontbrekende confidence → geen advies (fail-closed)", () => {
  assert.equal(magAdviesTonen(null), false)
  assert.equal(magAdviesTonen(undefined), false)
})

test("high/medium/low → advies wel tonen", () => {
  assert.equal(magAdviesTonen("high"), true)
  assert.equal(magAdviesTonen("medium"), true)
  assert.equal(magAdviesTonen("low"), true)
})

test("vervangtekst is eerlijk: belooft niets, vraagt om extra foto", () => {
  assert.ok(ADVIES_ONBEKEND_TEKST.includes("niet beoordelen"))
  assert.ok(ADVIES_ONBEKEND_TEKST.toLowerCase().includes("extra"))
})
