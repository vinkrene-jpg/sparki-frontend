// DATABRONNEN_EN_FTP_01 §3 — eigen Normalized Power (Coggan).
// D-T3: constant vermogen → NP = dat vermogen; wisselend vermogen → NP > gem.;
// gaten-beleid gedocumenteerd en getest; te korte reeks → eerlijk null.
import assert from "node:assert/strict";
import { computeNormalizedPower } from "../lib/normalized-power";

function seq(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

let failures = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    failures++;
    console.error(`✗ ${name}:`, (err as Error).message);
  }
}

check("constant 200 W over 20 min → NP = 200", () => {
  const t = seq(1200);
  const w = t.map(() => 200);
  assert.equal(computeNormalizedPower(t, w), 200);
});

check("blokken 300/100 W → NP boven het gemiddelde (4e-machtsweging)", () => {
  const t = seq(1800);
  const w = t.map((i) => (Math.floor(i / 60) % 2 === 0 ? 300 : 100));
  const np = computeNormalizedPower(t, w)!;
  const avg = 200;
  assert.ok(np > avg + 10, `NP ${np} hoort ruim boven gemiddelde ${avg}`);
  assert.ok(np < 300, `NP ${np} hoort onder het piekvermogen`);
});

check("nulls binnen actieve opname tellen als 0 W (freewheelen)", () => {
  const t = seq(1200);
  const w: Array<number | null> = t.map((i) => (i % 2 === 0 ? 300 : null));
  const np = computeNormalizedPower(t, w)!;
  const npVol = computeNormalizedPower(
    t,
    t.map(() => 300),
  )!;
  assert.ok(np < npVol, "coasting-nullen moeten de NP drukken");
});

check("lang gat (pauze) telt niet mee — geen kunstmatige nullen", () => {
  // 10 min rijden, 30 min pauze (gat in tijdstempels), 10 min rijden.
  const t = [...seq(600), ...seq(600).map((i) => i + 600 + 1800)];
  const w = t.map(() => 250);
  assert.equal(computeNormalizedPower(t, w), 250);
});

check("kort gat (≤3 s) wordt als hapering opgevuld met de laatste waarde", () => {
  // elke 3e seconde ontbreekt — NP blijft die van constant vermogen.
  const t = seq(1200).filter((i) => i % 3 !== 2);
  const w = t.map(() => 220);
  assert.equal(computeNormalizedPower(t, w), 220);
});

check("te korte reeks (< 5 min actief) → eerlijk null", () => {
  const t = seq(200);
  const w = t.map(() => 250);
  assert.equal(computeNormalizedPower(t, w), null);
});

check("lege of ongeldige invoer → null", () => {
  assert.equal(computeNormalizedPower([], []), null);
  assert.equal(
    computeNormalizedPower(seq(600), seq(600).map(() => null)),
    null,
  );
});

if (failures > 0) {
  console.error(`\n${failures} test(s) GEFAALD`);
  process.exit(1);
}
console.log("\nAlle NP-tests geslaagd.");
