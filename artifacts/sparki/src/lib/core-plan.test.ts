import { test } from "node:test";
import assert from "node:assert/strict";
import { startOfLocalWeek, buildWeekGridLocal, afleidDagStatus, kiesPlanActie } from "./core-plan";
import { localISODate } from "./commercial-shell";

test("startOfLocalWeek starts on Monday", () => {
  // 2024-01-03 is Wednesday
  const d = new Date("2024-01-03T12:00:00");
  const start = startOfLocalWeek(d);
  assert.equal(start.getDay(), 1, "Must be Monday");
  assert.equal(start.getDate(), 1, "Must be 1st of Jan");
});

test("buildWeekGridLocal yields 7 days", () => {
  const d = new Date("2024-01-03T12:00:00");
  const grid = buildWeekGridLocal(d, 0);
  assert.equal(grid.length, 7);
  assert.equal(grid[0]!.getDay(), 1);
  assert.equal(grid[6]!.getDay(), 0);
});

test("afleidDagStatus logic", () => {
  assert.equal(afleidDagStatus(null), "leeg");
  assert.equal(afleidDagStatus("rest"), "herstel");
  assert.equal(afleidDagStatus("ride"), "training");
});

test("kiesPlanActie logic", () => {
  assert.equal(kiesPlanActie(undefined, false), "missing");
  assert.equal(kiesPlanActie({ hasCoach: true } as any, true), "none");
  assert.equal(kiesPlanActie({ plan: null, hasCoach: false } as any, true), "generate");
  // Spiegelt de echte TrainingPlanResponse-vorm: `mode` staat op topniveau,
  // `plan` is de PlanHeader. (Genest `plan.mode` bestaat niet in het contract.)
  assert.equal(kiesPlanActie({ plan: { id: 1 }, mode: "autonomous", hasCoach: false } as any, true), "adapt");
  assert.equal(kiesPlanActie({ plan: { id: 1 }, mode: "advisory", hasCoach: false } as any, true), "generate");
});

test("localISODate bewijst dat de lokale datum wordt gebruikt (geen UTC-verschuiving)", () => {
  // Maak een datum. Zelfs als het laat op de avond is (bijv. 23:00) en middernacht passeert in UTC,
  // we gebruiken lokale date methoden, dus we testen of localISODate effectief geen
  // pure toISOString().slice(0, 10) doet (wat in theorie UTC is en zou verschillen).
  const d = new Date();
  const expectedDay = String(d.getDate()).padStart(2, "0");
  const result = localISODate(d);
  
  assert.equal(result.slice(8, 10), expectedDay, "Pakt de lokale dag, niet UTC via toISOString");
});
