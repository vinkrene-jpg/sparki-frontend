// Tests voor de pure wedstrijdmodus-kern (lib/race-mode.ts). Vergrendelt:
// - rondetelling telt alleen bij een echte wrap (ver in de ronde → weer vroeg
//   op de lijn), nooit bij een korte GPS-sprong halverwege;
// - de teller loopt nooit voorbij het aantal lokale ronden;
// - de finishcue mag UITSLUITEND in de laatste ronde;
// - eerstvolgend wedstrijdpunt: op km-volgorde, punten zonder km doen niet
//   mee, finishpunten worden buiten de laatste ronde overgeslagen.
//
// Run: node ../../scripts/run-tsx-test.mjs --test lib/race-mode.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  createRaceModeState,
  finishCueAllowed,
  nextRacePoint,
  updateRaceMode,
  type RaceModePoint,
} from "./race-mode";

const TOTAL = 10; // km per ronde

function ride(kms: number[], localLaps = 3) {
  let state = createRaceModeState();
  let completions = 0;
  for (const traveledKm of kms) {
    const r = updateRaceMode(state, { traveledKm, totalKm: TOTAL, localLaps });
    state = r.state;
    if (r.lapCompleted) completions += 1;
  }
  return { state, completions };
}

test("wrap na ver-in-de-ronde telt als nieuwe ronde", () => {
  const { state, completions } = ride([1, 4, 7, 9.5, 0.5, 2]);
  assert.equal(state.lap, 2);
  assert.equal(completions, 1);
});

test("GPS-sprong halverwege telt nooit als ronde", () => {
  // Renner zat pas op 40% — een sprong terug naar het begin is ruis.
  const { state, completions } = ride([1, 3, 4, 0.5, 1.5]);
  assert.equal(state.lap, 1);
  assert.equal(completions, 0);
});

test("terugvallen tot 30% (boven reset-drempel) telt niet", () => {
  const { state } = ride([1, 7, 3.1, 7, 9]);
  assert.equal(state.lap, 1);
});

test("teller loopt nooit voorbij het aantal ronden", () => {
  const laps2 = [1, 9, 0.5, 9, 0.5, 9, 0.5];
  const { state } = ride(laps2, 2);
  assert.equal(state.lap, 2);
});

test("zonder lokale ronden (0/1) blijft de state onaangeroerd", () => {
  const s = createRaceModeState();
  const r = updateRaceMode(s, { traveledKm: 9.5, totalKm: TOTAL, localLaps: 1 });
  assert.equal(r.state, s);
  assert.equal(r.lapCompleted, false);
});

test("finishcue alleen in de laatste ronde", () => {
  let state = createRaceModeState();
  assert.equal(finishCueAllowed(state, 3), false);
  // Ronde 1 → 2
  state = updateRaceMode(state, { traveledKm: 9, totalKm: TOTAL, localLaps: 3 }).state;
  state = updateRaceMode(state, { traveledKm: 0.5, totalKm: TOTAL, localLaps: 3 }).state;
  assert.equal(finishCueAllowed(state, 3), false);
  // Ronde 2 → 3 (laatste)
  state = updateRaceMode(state, { traveledKm: 9, totalKm: TOTAL, localLaps: 3 }).state;
  state = updateRaceMode(state, { traveledKm: 0.5, totalKm: TOTAL, localLaps: 3 }).state;
  assert.equal(finishCueAllowed(state, 3), true);
});

test("finishcue zonder lokale ronden altijd toegestaan", () => {
  assert.equal(finishCueAllowed(createRaceModeState(), null), true);
  assert.equal(finishCueAllowed(createRaceModeState(), 1), true);
});

const POINTS: RaceModePoint[] = [
  { id: 1, kind: "sprint", label: "Tussensprint", description: null, raceKm: 3 },
  { id: 2, kind: "bergprijs", label: "Bergprijs", description: null, raceKm: 6 },
  { id: 3, kind: "finish", label: "Finish", description: null, raceKm: 10 },
  { id: 4, kind: "start", label: "Start", description: null, raceKm: null },
];

test("eerstvolgend punt op km-volgorde met afstand in meters", () => {
  const r = nextRacePoint(POINTS, 2, { finishAllowed: false });
  assert.equal(r?.point.id, 1);
  assert.equal(Math.round(r!.distanceM), 1000);
});

test("finishpunt overgeslagen buiten de laatste ronde", () => {
  const r = nextRacePoint(POINTS, 7, { finishAllowed: false });
  assert.equal(r, null);
});

test("finishpunt zichtbaar in de laatste ronde", () => {
  const r = nextRacePoint(POINTS, 7, { finishAllowed: true });
  assert.equal(r?.point.kind, "finish");
});

test("punt zonder km doet nooit mee", () => {
  const r = nextRacePoint(
    [{ id: 4, kind: "start", label: "Start", description: null, raceKm: null }],
    0,
    { finishAllowed: true },
  );
  assert.equal(r, null);
});
