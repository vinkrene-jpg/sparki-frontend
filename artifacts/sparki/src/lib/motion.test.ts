// MEDIA_UITLEG_01 F1 — toetst de centrale motionlaag:
// 1. de schakelaarlogica in beide richtingen (T-1/T-2, MTS-51);
// 2. de configuratie is bevroren en dus niet per component aanpasbaar;
// 3. index.css bevat de centrale uitschakelaar (directe eindtoestand, T-3)
//    en de duur-/easingvariabelen die src/lib/motion.ts spiegelen (F-2/F-3).
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { MOTION, resolveMotionOff } from "./motion"

test("schakelaar beide richtingen: OR-logica systeem × Sparki", () => {
  assert.equal(resolveMotionOff(false, false), false)
  assert.equal(resolveMotionOff(true, false), true) // systeem aan ⇒ uit
  assert.equal(resolveMotionOff(false, true), true) // Sparki aan ⇒ uit
  assert.equal(resolveMotionOff(true, true), true)
  // en terug: beide weer uit ⇒ beweging weer aan
  assert.equal(resolveMotionOff(false, false), false)
})

test("configuratie is bevroren — niet per component overschrijfbaar", () => {
  assert.ok(Object.isFrozen(MOTION))
  assert.ok(Object.isFrozen(MOTION.duur))
  assert.throws(() => {
    ;(MOTION.duur as { kort: number }).kort = 999
  }, TypeError)
  assert.equal(MOTION.duur.kort, 120)
  assert.equal(MOTION.maxGelijktijdigBewegend, 2)
})

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "index.css"),
  "utf8",
)

test("index.css bevat de centrale uitschakelaar met directe eindtoestand", () => {
  assert.ok(css.includes('html[data-motion="off"] *'))
  const blok = css.slice(css.indexOf('html[data-motion="off"]'))
  const eind = blok.slice(0, blok.indexOf("}"))
  assert.ok(/animation-duration:\s*0\.01ms\s*!important/.test(eind))
  assert.ok(/transition-duration:\s*0\.01ms\s*!important/.test(eind))
  // Geen layoutverschuiving: de uitschakelaar raakt alleen tijd, nooit
  // display/position/transform-eigenschappen.
  assert.ok(!/display\s*:/.test(eind))
  assert.ok(!/transform\s*:/.test(eind))
})

test("CSS-variabelen spiegelen de bevroren configuratie", () => {
  assert.ok(css.includes(`--motion-duur-kort: ${MOTION.duur.kort}ms`))
  assert.ok(css.includes(`--motion-duur-normaal: ${MOTION.duur.normaal}ms`))
  assert.ok(css.includes(`--motion-duur-traag: ${MOTION.duur.traag}ms`))
  assert.ok(css.includes(`--motion-easing-in: ${MOTION.easingIn}`))
  assert.ok(css.includes(`--motion-easing-uit: ${MOTION.easingUit}`))
})
