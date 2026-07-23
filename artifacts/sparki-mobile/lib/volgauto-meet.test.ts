// Volgauto-aansluitpuntlogica (mobiel, puur) — Opdracht 3.
// Run: `pnpm --filter @workspace/sparki-mobile run test:volgauto-meet`

import test from "node:test";
import assert from "node:assert/strict";
import {
  createMeetChoiceState,
  nextMeetpointIndex,
  updateMeetChoice,
  estimateMeetEta,
  isPositionFresh,
  formatWaitLine,
  SWITCH_STABILITY_MS,
  POSITION_FRESH_MS,
  CAR_BLOCKED_NOTICE,
  type Meetpoint,
} from "./volgauto-meet";

const mp = (bikeKm: number, carKm = bikeKm): Meetpoint => ({
  bikeKm,
  carKm,
  lat: 52,
  lon: 5,
  kind: "routepunt",
  label: `km ${bikeKm}`,
});

test("nextMeetpointIndex kiest het eerste punt vóór de renner (met marge)", () => {
  const pts = [mp(3), mp(7), mp(12)];
  assert.equal(nextMeetpointIndex(pts, 0), 0);
  assert.equal(nextMeetpointIndex(pts, 3), 1); // net gepasseerd → volgende
  assert.equal(nextMeetpointIndex(pts, 6.96), 2); // km 7 valt binnen de 50 m-marge → volgende punt
  assert.equal(nextMeetpointIndex(pts, 12.5), null); // niets meer voor de boeg
});

test("eerste keuze zet het actieve punt zonder 'switched'-melding", () => {
  const r = updateMeetChoice(createMeetChoiceState(), {
    meetpoints: [mp(5), mp(9)],
    riderBikeKm: 1,
    nowMs: 0,
  });
  assert.equal(r.state.activeIndex, 0);
  assert.equal(r.switched, false);
});

test("gepasseerd actief punt schuift DIRECT door met melding", () => {
  const s0 = updateMeetChoice(createMeetChoiceState(), {
    meetpoints: [mp(5), mp(9)],
    riderBikeKm: 1,
    nowMs: 0,
  }).state;
  const r = updateMeetChoice(s0, {
    meetpoints: [mp(5), mp(9)],
    riderBikeKm: 5.2,
    nowMs: 10_000,
  });
  assert.equal(r.state.activeIndex, 1);
  assert.equal(r.switched, true);
});

test("ander voorkeurspunt wisselt pas na 120 s aanhoudende voorkeur (geen jojo)", () => {
  // Actief = index 1 (km 9); daarna verschijnt een dichterbij punt (km 7).
  let state = updateMeetChoice(createMeetChoiceState(), {
    meetpoints: [mp(9)],
    riderBikeKm: 1,
    nowMs: 0,
  }).state;
  const pts = [mp(7), mp(9)];
  state = { ...state, activeIndex: 1 };
  const early = updateMeetChoice(state, { meetpoints: pts, riderBikeKm: 1, nowMs: 1_000 });
  assert.equal(early.switched, false);
  assert.equal(early.state.candidateIndex, 0);
  const mid = updateMeetChoice(early.state, {
    meetpoints: pts,
    riderBikeKm: 1,
    nowMs: 1_000 + SWITCH_STABILITY_MS - 1,
  });
  assert.equal(mid.switched, false);
  const late = updateMeetChoice(mid.state, {
    meetpoints: pts,
    riderBikeKm: 1,
    nowMs: 1_000 + SWITCH_STABILITY_MS,
  });
  assert.equal(late.switched, true);
  assert.equal(late.state.activeIndex, 0);
});

test("geen punten meer voor de boeg → actief punt leeg met melding", () => {
  const s0 = updateMeetChoice(createMeetChoiceState(), {
    meetpoints: [mp(5)],
    riderBikeKm: 1,
    nowMs: 0,
  }).state;
  const r = updateMeetChoice(s0, { meetpoints: [mp(5)], riderBikeKm: 8, nowMs: 0 });
  assert.equal(r.state.activeIndex, null);
  assert.equal(r.switched, true);
});

test("estimateMeetEta: standaardsnelheden en eerlijke null zonder autopositie", () => {
  const meet = mp(10, 12);
  const noCar = estimateMeetEta({
    meet,
    riderBikeKm: 5.5,
    riderSpeedMps: null,
    carKm: null,
    carSpeedMps: null,
  });
  // 4.5 km @ 27 km/u = 600 s
  assert.equal(noCar.riderEtaSec, 600);
  assert.equal(noCar.carEtaSec, null);
  assert.equal(noCar.waitSec, null);
  const withCar = estimateMeetEta({
    meet,
    riderBikeKm: 5.5,
    riderSpeedMps: null,
    carKm: 12 - (40 / 3.6) * 0.3, // 300 s rijden @ 40 km/u
    carSpeedMps: null,
  });
  assert.equal(withCar.carEtaSec, 300);
  assert.equal(withCar.waitSec, 300 - 600);
});

test("estimateMeetEta: aangekomen (negatieve rest) telt als 0 s", () => {
  const r = estimateMeetEta({
    meet: mp(10, 12),
    riderBikeKm: 11,
    riderSpeedMps: 8,
    carKm: 13,
    carSpeedMps: 15,
  });
  assert.equal(r.riderEtaSec, 0);
  assert.equal(r.carEtaSec, 0);
});

test("isPositionFresh: 3-minutengrens", () => {
  assert.equal(isPositionFresh(0, POSITION_FRESH_MS), true);
  assert.equal(isPositionFresh(0, POSITION_FRESH_MS + 1), false);
});

test("formatWaitLine is altijd 'geschat' en eerlijk zonder positie", () => {
  assert.match(formatWaitLine(null), /Geen recente positie/);
  assert.match(formatWaitLine(30), /gelijk aan/);
  assert.match(formatWaitLine(180), /naar schatting 3 min ná/i);
  assert.match(formatWaitLine(-300), /schatting 5 min wachten/);
});

test("CAR_BLOCKED_NOTICE legt uit dat de auto naar een punt verderop gaat", () => {
  assert.match(CAR_BLOCKED_NOTICE, /niet toegankelijk voor auto's/);
  assert.match(CAR_BLOCKED_NOTICE, /aansluitpunt verderop/);
});
