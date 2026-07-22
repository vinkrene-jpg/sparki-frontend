// Tests voor de nav-sanitizer: bij routes met tussenwaypoints levert ORS per
// segment een eigen "Aankomst"/"Vertrek"-stap; alleen de allereerste Vertrek en
// de allerlaatste Aankomst (de echte eindbestemming) mogen blijven staan.
//
// Run: pnpm --filter @workspace/api-server run test:nav-sanitize (via
// shell — workflowlimiet).

import { test } from "node:test";
import assert from "node:assert/strict";

import { sanitizeNavSteps, type NavStep } from "../lib/routing/nav-sanitize";

function step(km: number, dir: string, note = ""): NavStep {
  return { km, dir, note };
}

test("route zonder waypoints blijft ongewijzigd", () => {
  const steps = [
    step(0, "Vertrek", "Start"),
    step(1.2, "Links"),
    step(3.4, "Rechts"),
    step(5.0, "Aankomst", "Einde"),
  ];
  assert.deepEqual(sanitizeNavSteps(steps), steps);
});

test("tussen-aankomsten en tussen-vertrekken van waypoints verdwijnen", () => {
  const steps = [
    step(0, "Vertrek", "Start"),
    step(1.0, "Links"),
    step(2.0, "Aankomst", "Waypoint 1"),
    step(2.0, "Vertrek", "Waypoint 1"),
    step(3.0, "Rechts"),
    step(4.0, "Aankomst", "Waypoint 2"),
    step(4.0, "Vertrek", "Waypoint 2"),
    step(6.0, "Aankomst", "Einde"),
  ];
  const out = sanitizeNavSteps(steps);
  assert.deepEqual(
    out.map((s) => `${s.dir}:${s.note}`),
    ["Vertrek:Start", "Links:", "Rechts:", "Aankomst:Einde"],
  );
});

test("Engelse tokens (arrive/depart/finish) worden ook herkend", () => {
  const steps = [
    step(0, "depart"),
    step(1, "left"),
    step(2, "arrive", "wp"),
    step(2, "depart", "wp"),
    step(4, "finish", "einde"),
  ];
  const out = sanitizeNavSteps(steps);
  assert.deepEqual(
    out.map((s) => s.dir),
    ["depart", "left", "finish"],
  );
});

test("idempotent: nogmaals opschonen verandert niets", () => {
  const steps = [
    step(0, "Vertrek"),
    step(2, "Aankomst", "wp"),
    step(3, "Links"),
    step(5, "Aankomst", "einde"),
  ];
  const once = sanitizeNavSteps(steps);
  assert.deepEqual(sanitizeNavSteps(once), once);
});

test("lege lijst en route zonder aankomst blijven eerlijk intact", () => {
  assert.deepEqual(sanitizeNavSteps([]), []);
  const noArrive = [step(0, "Vertrek"), step(1, "Links")];
  assert.deepEqual(sanitizeNavSteps(noArrive), noArrive);
});

test("neutrale Tussenstop-stap blijft staan (geen finish, wel zichtbaar)", () => {
  const steps = [
    step(0, "Vertrek"),
    step(1.5, "Tussenstop", "Je bent bij je tussenstop."),
    step(3, "Aankomst", "einde"),
  ];
  const out = sanitizeNavSteps(steps);
  assert.equal(out.length, 3);
  assert.equal(out[1]!.dir, "Tussenstop");
});
