import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizePlanDetails } from "../lib/plan-details";

test("null of leeg object geeft eerlijk null terug", () => {
  assert.deepEqual(sanitizePlanDetails(null), { ok: true, details: null });
  assert.deepEqual(sanitizePlanDetails(undefined), { ok: true, details: null });
  assert.deepEqual(sanitizePlanDetails({}), { ok: true, details: null });
  assert.deepEqual(sanitizePlanDetails({ goal: "   " }), {
    ok: true,
    details: null,
  });
});

test("geldige planningsdetails komen gesanitized door", () => {
  const r = sanitizePlanDetails({
    discipline: "gravel",
    goal: "  duurvermogen opbouwen ",
    targetDistanceKm: 82.46,
    intensity: "duur",
    bikeId: 3,
    nutritionNote: "60 g koolhydraten per uur",
  });
  assert.ok(r.ok);
  assert.deepEqual(r.ok && r.details, {
    discipline: "gravel",
    goal: "duurvermogen opbouwen",
    targetDistanceKm: 82.5,
    intensity: "duur",
    bikeId: 3,
    nutritionNote: "60 g koolhydraten per uur",
  });
});

test("onbekende discipline of intensiteit geeft een eerlijke fout", () => {
  assert.equal(sanitizePlanDetails({ discipline: "hardlopen" }).ok, false);
  assert.equal(sanitizePlanDetails({ intensity: "z9" }).ok, false);
});

test("ongeldige nummers worden geweigerd, niet stilletjes weggegooid", () => {
  assert.equal(sanitizePlanDetails({ targetDistanceKm: -5 }).ok, false);
  assert.equal(sanitizePlanDetails({ targetDistanceKm: NaN }).ok, false);
  assert.equal(sanitizePlanDetails({ bikeId: 1.5 }).ok, false);
  assert.equal(sanitizePlanDetails({ bikeId: "3" }).ok, false);
});

test("uitgevoerde-ervaring-velden horen niet bij een geplande training", () => {
  for (const veld of ["feelScore", "rpe", "tss", "recovery", "complaints"]) {
    const r = sanitizePlanDetails({ [veld]: 3 });
    assert.equal(r.ok, false, `${veld} moet geweigerd worden`);
  }
});

test("niet-whitelisted velden verdwijnen (whitelist, geen passthrough)", () => {
  const r = sanitizePlanDetails({ goal: "test", extraVeld: "x" });
  assert.ok(r.ok);
  assert.deepEqual(r.ok && r.details, { goal: "test" });
});

test("geen object is een eerlijke fout", () => {
  assert.equal(sanitizePlanDetails([1]).ok, false);
  assert.equal(sanitizePlanDetails("x").ok, false);
});
