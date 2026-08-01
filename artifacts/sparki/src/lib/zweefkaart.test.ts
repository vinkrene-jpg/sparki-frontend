// MEDIA_UITLEG_01 F2 — toetst de zweefkaartlogica (CMP-40):
// geen beweging zonder aanraking, beweging-uit = gewone kaart, uitsluitend
// het vrijgegeven moment, kanteling geclampt (subtiel, geen spektakel).
import test from "node:test"
import assert from "node:assert/strict"
import {
  DIEPTE_MOMENTEN,
  shouldEnableDiepte,
  computeKanteling,
  kantelTransform,
  RUST_TRANSFORM,
  MAX_KANTELING_GRADEN,
} from "./zweefkaart"

test("uitsluitend het vrijgegeven moment (training_voltooid)", () => {
  assert.deepEqual([...DIEPTE_MOMENTEN], ["training_voltooid"])
  assert.equal(shouldEnableDiepte(true, false, "training_voltooid"), true)
  // Verboden plaatsen — nooit diepte, ook met flag aan.
  for (const m of ["lijst", "formulier", "navigatie", "acute_melding", "training_actief", ""]) {
    assert.equal(shouldEnableDiepte(true, false, m), false, m)
  }
})

test("beweging uit ⇒ gewone kaart, flag uit ⇒ gewone kaart", () => {
  assert.equal(shouldEnableDiepte(true, true, "training_voltooid"), false)
  assert.equal(shouldEnableDiepte(false, false, "training_voltooid"), false)
  // en terug: weer aan
  assert.equal(shouldEnableDiepte(true, false, "training_voltooid"), true)
})

test("rust = geen transform (geen beweging zonder aanraking)", () => {
  assert.equal(RUST_TRANSFORM, "none")
})

test("kanteling geclampt op ±4° en puur transform", () => {
  const rect = { left: 0, top: 0, width: 200, height: 100 }
  const midden = computeKanteling(100, 50, rect)
  assert.equal(midden.rotateX, 0)
  assert.equal(midden.rotateY, 0)
  // Ver buiten de kaart → geclampt op het maximum.
  const buiten = computeKanteling(10000, -10000, rect)
  assert.ok(Math.abs(buiten.rotateX) <= MAX_KANTELING_GRADEN)
  assert.ok(Math.abs(buiten.rotateY) <= MAX_KANTELING_GRADEN)
  // Transform-string bevat alleen perspective/rotate/scale — geen layout.
  const t = kantelTransform(buiten)
  assert.ok(/^perspective\(900px\) rotateX\(-?[\d.]+deg\) rotateY\(-?[\d.]+deg\) scale\([\d.]+\)$/.test(t))
})

test("degenererende rect faalt veilig naar rust", () => {
  const k = computeKanteling(10, 10, { left: 0, top: 0, width: 0, height: 0 })
  assert.deepEqual(k, { rotateX: 0, rotateY: 0 })
})
