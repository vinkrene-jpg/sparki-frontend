import assert from "node:assert/strict"
import {
  toGray,
  measureBrightness,
  measureSharpness,
  measureMotion,
  measureCoverage,
  measureFrame,
  judgeQuality,
} from "./scan-quality"

// Puur-deterministische tests voor de scanner-kwaliteitschecks — geen browser
// nodig; we bouwen synthetische RGBA-buffers.

function solid(w: number, h: number, v: number): Uint8Array {
  const buf = new Uint8Array(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    buf[i * 4] = v
    buf[i * 4 + 1] = v
    buf[i * 4 + 2] = v
    buf[i * 4 + 3] = 255
  }
  return buf
}

function checkerboard(w: number, h: number, a = 0, b = 255): Uint8Array {
  const buf = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = (x + y) % 2 === 0 ? a : b
      const i = (y * w + x) * 4
      buf[i] = v
      buf[i + 1] = v
      buf[i + 2] = v
      buf[i + 3] = 255
    }
  }
  return buf
}

const W = 32
const H = 24

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed++
  console.log(`✓ ${name}`)
}

test("helderheid: zwart ~0, wit ~1, grijs ~0.5", () => {
  assert.ok(measureBrightness(toGray(solid(W, H, 0), W, H)) < 0.01)
  assert.ok(measureBrightness(toGray(solid(W, H, 255), W, H)) > 0.99)
  const mid = measureBrightness(toGray(solid(W, H, 128), W, H))
  assert.ok(mid > 0.45 && mid < 0.55)
})

test("scherpte: vlak beeld ~0, dambord hoog", () => {
  const flat = measureSharpness(toGray(solid(W, H, 128), W, H), W, H)
  const sharp = measureSharpness(toGray(checkerboard(W, H), W, H), W, H)
  assert.ok(flat < 1)
  assert.ok(sharp > 1000)
  assert.ok(sharp > flat * 100)
})

test("beweging: identiek frame 0, geïnverteerd frame ~1", () => {
  const g1 = toGray(checkerboard(W, H), W, H)
  const g2 = toGray(checkerboard(W, H, 255, 0), W, H)
  assert.equal(measureMotion(g1, g1), 0)
  assert.ok(measureMotion(g2, g1) > 0.95)
  // Zonder vorig frame: 0 (geen valse afkeuring bij de eerste meting).
  assert.equal(measureMotion(g1, null), 0)
})

test("kadervulling: leeg vlak ~0, detailrijk hoog", () => {
  const empty = measureCoverage(toGray(solid(W, H, 200), W, H), W, H)
  const busy = measureCoverage(toGray(checkerboard(W, H), W, H), W, H)
  assert.ok(empty < 0.01)
  assert.ok(busy > 0.5)
})

test("oordeel: donker beeld krijgt licht-instructie", () => {
  const { quality } = measureFrame(solid(W, H, 10), W, H, null)
  const v = judgeQuality(quality)
  assert.equal(v.ok, false)
  assert.match(v.instruction ?? "", /donker/i)
})

test("oordeel: leeg (vlak, licht) beeld faalt op detail of scherpte", () => {
  const { quality } = measureFrame(solid(W, H, 160), W, H, null)
  const v = judgeQuality(quality)
  assert.equal(v.ok, false)
  assert.ok(v.instruction != null)
})

test("oordeel: scherp, detailrijk, stil beeld met normale helderheid slaagt", () => {
  // Dambord met gematigde waarden: helder genoeg, scherp, veel randen.
  const rgba = checkerboard(W, H, 90, 190)
  const { quality, gray } = measureFrame(rgba, W, H, null)
  const v = judgeQuality(quality)
  assert.equal(v.ok, true, JSON.stringify(quality))
  // Zelfde frame opnieuw: geen beweging → blijft goed.
  const again = measureFrame(rgba, W, H, gray)
  assert.equal(judgeQuality(again.quality).ok, true)
})

test("oordeel: sterk bewogen beeld krijgt beweeg-instructie", () => {
  const g1 = measureFrame(checkerboard(W, H, 90, 190), W, H, null)
  const moved = measureFrame(checkerboard(W, H, 190, 90), W, H, g1.gray)
  const v = judgeQuality(moved.quality)
  assert.equal(v.ok, false)
  assert.match(v.instruction ?? "", /langzamer|stil/i)
})

console.log(`\nAlle ${passed} scan-quality tests geslaagd.`)
