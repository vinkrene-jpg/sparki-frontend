// Kalibratie-regressietest (vondst René 30-07-2026, hoofdstuk D):
// "gravelfiets geselecteerd maar route is ~97% verhard" — de onverhard-
// voorkeur was een dode knop omdat de motor zelf nooit op onverhard stuurde.
//
// Deze test legt de afkeurregel vast:
// 1. gravel + onverhard-voorkeur ⇒ het custom model BEVAT een voorkeursstraf
//    op verhard wegdek (de motor zoekt onverhard actief op);
// 2. de straf schaalt met de voorkeur en heeft een vloer (nooit een harde 0 —
//    een route mag nooit onmogelijk worden);
// 3. racefiets krijgt deze sturing NOOIT, ook niet als er per ongeluk een
//    voorkeur wordt meegegeven — de harde 0%-onverhard-grens (zware straf op
//    onverhard wegdek) blijft onaangetast.
//
// Run: pnpm --filter @workspace/api-server run test:gravel-steering

import { test } from "node:test";
import assert from "node:assert/strict";
import { customModelFor } from "../lib/routing/providers/graphhopper";

type Rule = { if: string; multiply_by: string };

function rules(model: Record<string, unknown> | null): Rule[] {
  return ((model?.priority as Rule[]) ?? []) as Rule[];
}

function sealedPenalty(model: Record<string, unknown> | null): Rule | null {
  return (
    rules(model).find(
      (r) => r.if.includes("ASPHALT") && r.if.includes("PAVING_STONES"),
    ) ?? null
  );
}

test("gravel + voorkeur ⇒ motor straft verhard wegdek (voorheen dode knop)", () => {
  const model = customModelFor("cycling-gravel", false, 0.4);
  const rule = sealedPenalty(model);
  assert.ok(
    rule,
    "gravel met onverhard-voorkeur MOET een verhard-wegdek-straf in het custom model hebben",
  );
  // factor = max(0.3, 1 - 1.2*0.4) = 0.52
  assert.equal(rule!.multiply_by, "0.52");
});

test("straf schaalt met de voorkeur en heeft een vloer (nooit harde 0)", () => {
  const r30 = sealedPenalty(customModelFor("cycling-gravel", false, 0.3));
  const r100 = sealedPenalty(customModelFor("cycling-gravel", false, 1));
  assert.ok(r30 && r100);
  assert.equal(Number(r30!.multiply_by).toFixed(2), "0.64");
  assert.equal(r100!.multiply_by, "0.3"); // vloer — route blijft altijd mogelijk
  for (const r of [r30!, r100!]) {
    assert.ok(Number(r.multiply_by) > 0, "nooit een harde 0");
  }
});

test("zonder voorkeur (null/0) geen verhard-straf voor gravel", () => {
  assert.equal(sealedPenalty(customModelFor("cycling-gravel", false, null)), null);
  assert.equal(sealedPenalty(customModelFor("cycling-gravel", false, 0)), null);
});

test("racefiets krijgt de gravel-sturing NOOIT — harde grens blijft", () => {
  // Zelfs met een (foutief) meegegeven voorkeur: geen verhard-wegdek-straf.
  const model = customModelFor("cycling-road", false, 0.8);
  assert.equal(
    sealedPenalty(model),
    null,
    "racefiets mag nooit richting onverhard worden gestuurd",
  );
  // En de zware straf op onverhard wegdek (0%-grens in de motor) staat er nog.
  const unpavedRule = rules(model).find(
    (r) => r.if.includes("GRAVEL") && r.if.includes("COMPACTED"),
  );
  assert.ok(unpavedRule, "racefiets-onverhard-straf ontbreekt");
  assert.equal(unpavedRule!.multiply_by, "0.05");
});
