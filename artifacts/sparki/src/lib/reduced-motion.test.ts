// Statische controle voor defect A-05 — reduced motion app-breed.
// Bewaakt dat de centrale vangrail in src/index.css blijft bestaan: zonder
// deze regel zouden nieuwe skeletons/spinners zonder motion-reduce:animate-none
// weer bewegen voor gebruikers met "verminder beweging". Dit test de BRON
// (index.css), geen gegenereerde bestanden.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "index.css"),
  "utf8",
)

// Pak alle prefers-reduced-motion-blokken (accolade-gebalanceerd is hier niet
// nodig: we controleren dat de selectors en `animation: none` binnen zo'n
// blok voorkomen).
function reducedMotionBlocks(source: string): string[] {
  const blokken: string[] = []
  const re = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    let diepte = 1
    let i = re.lastIndex
    while (i < source.length && diepte > 0) {
      if (source[i] === "{") diepte++
      else if (source[i] === "}") diepte--
      i++
    }
    blokken.push(source.slice(re.lastIndex, i))
  }
  return blokken
}

const blokken = reducedMotionBlocks(css)

test("index.css bevat minstens één prefers-reduced-motion-blok", () => {
  assert.ok(blokken.length >= 1)
})

test("centrale vangrail dekt alle Tailwind-loopanimaties met animation:none", () => {
  for (const klasse of [".animate-pulse", ".animate-spin", ".animate-bounce", ".animate-ping"]) {
    const gedekt = blokken.some(
      (b) => b.includes(klasse) && /animation:\s*none/.test(b),
    )
    assert.ok(gedekt, `${klasse} moet onder prefers-reduced-motion op animation:none staan`)
  }
})

test("scene-achtergrondanimaties blijven onder reduced motion uitgeschakeld", () => {
  for (const klasse of [".scene-haze", ".scene-beam", ".scene-ambient", ".scene-bloom"]) {
    const gedekt = blokken.some(
      (b) => b.includes(klasse) && /animation:\s*none/.test(b),
    )
    assert.ok(gedekt, `${klasse} moet onder prefers-reduced-motion op animation:none staan`)
  }
})
