// Regressietests voor de rit-flow engine (automatische pauze/hervatting +
// slimme rit-einde-detectie). Puur en zonder netwerk: elk scenario voedt de
// engine met een reeks realistische metingen (1 Hz) en controleert de events.
import assert from "node:assert/strict";
import test from "node:test";

import {
  createRideFlowState,
  manualPause,
  rideFlowTick,
  type RideFlowEvent,
  type RideFlowInput,
  type RideFlowState,
} from "./ride-flow";

type Partial1 = Partial<Omit<RideFlowInput, "t" | "pointIndex">>;

// Speel een reeks metingen af; iedere stap is 1 seconde. Retourneert alle
// events plus de eindstate.
function play(
  state: RideFlowState,
  steps: Partial1[],
  startT = 1_000_000,
  startPoint = 0,
): { state: RideFlowState; events: RideFlowEvent[] } {
  let s = state;
  const events: RideFlowEvent[] = [];
  steps.forEach((step, i) => {
    const input: RideFlowInput = {
      t: startT + i * 1000,
      speedMps: step.speedMps ?? null,
      movedM: step.movedM ?? (step.speedMps != null ? step.speedMps : 0),
      headingDeg: step.headingDeg ?? null,
      cadence: step.cadence ?? null,
      watts: step.watts ?? null,
      distToFinishM: step.distToFinishM ?? null,
      pointIndex: startPoint + i,
    };
    const res = rideFlowTick(s, input);
    s = res.state;
    events.push(...res.events);
  });
  return { state: s, events };
}

const rep = (n: number, step: Partial1): Partial1[] => Array(n).fill(step);
const riding = (n: number, v = 7): Partial1[] => rep(n, { speedMps: v });
const still = (n: number): Partial1[] => rep(n, { speedMps: 0, movedM: 0 });

function kinds(events: RideFlowEvent[]): string[] {
  return events.map((e) => e.kind);
}
function endEvents(events: RideFlowEvent[]) {
  return events.filter((e) => e.kind === "end_suggested") as Extract<
    RideFlowEvent,
    { kind: "end_suggested" }
  >[];
}

test("korte stop bij verkeerslicht: auto-pauze en daarna automatisch hervatten", () => {
  const r = play(createRideFlowState(), [
    ...riding(30),
    ...still(20), // ~20 s voor het rode licht
    ...riding(6, 4), // rustig wegfietsen
  ]);
  assert.deepEqual(kinds(r.events), ["auto_pause", "auto_resume"]);
  assert.equal(r.state.pause, "riding");
});

test("langere koffiestop: na een half uur stilstand automatisch hervatten", () => {
  const r = play(createRideFlowState(), [
    ...riding(60),
    ...still(1800), // 30 minuten pauze
    ...riding(8, 6),
  ]);
  assert.deepEqual(kinds(r.events), ["auto_pause", "auto_resume"]);
  assert.equal(r.state.pause, "riding");
});

test("GPS-ruis tijdens stilstand veroorzaakt geen hervatting", () => {
  const base = play(createRideFlowState(), [...riding(20), ...still(10)]);
  assert.equal(base.state.pause, "auto_paused");
  // Losse ruis-sprongen: één snelle meting, dan weer stil — nooit 3 op rij.
  const r = play(base.state, [
    { speedMps: 3.2, movedM: 18 },
    ...still(4),
    { speedMps: 4.1, movedM: 25 },
    ...still(4),
    { speedMps: 2.9, movedM: 15 },
    ...still(4),
  ]);
  assert.deepEqual(kinds(r.events), []);
  assert.equal(r.state.pause, "auto_paused");
});

test("één losse bewegingsmeting is nooit genoeg om te hervatten", () => {
  const base = play(createRideFlowState(), [...riding(20), ...still(10)]);
  const r = play(base.state, [{ speedMps: 6, movedM: 6 }, ...still(6)]);
  assert.equal(r.state.pause, "auto_paused");
  assert.deepEqual(kinds(r.events), []);
});

test("lopen met de fiets (wandeltempo) hervat de rit niet", () => {
  const base = play(createRideFlowState(), [...riding(20), ...still(10)]);
  const r = play(base.state, rep(60, { speedMps: 1.4, movedM: 1.4 }));
  assert.equal(r.state.pause, "auto_paused");
  assert.deepEqual(kinds(r.events), []);
});

test("hervatten na handmatige pauze zodra er echt gefietst wordt", () => {
  const base = play(createRideFlowState(), riding(20));
  let s = manualPause(base.state);
  assert.equal(s.pause, "manual_paused");
  const r = play(s, [...still(5), ...riding(5, 5)]);
  assert.deepEqual(kinds(r.events), ["auto_resume"]);
  assert.equal(r.state.pause, "riding");
});

test("trapsignaal (cadans/vermogen) versnelt hervatting, ook bij lage GPS-snelheid", () => {
  const base = play(createRideFlowState(), [...riding(20), ...still(10)]);
  const r = play(base.state, rep(4, { speedMps: 1.8, movedM: 1.8, cadence: 75, watts: 160 }));
  assert.deepEqual(kinds(r.events), ["auto_resume"]);
});

test("renner finisht, pauzeert en stapt in de auto: einde gesuggereerd, geen hervatting", () => {
  const base = play(createRideFlowState(), [
    ...rep(120, { speedMps: 8, cadence: 85, watts: 200 }),
    ...rep(3, { speedMps: 8, cadence: 85, watts: 200, distToFinishM: 80 }),
    ...still(30), // gefinisht, fiets in de auto
  ]);
  assert.equal(base.state.pause, "auto_paused");
  // Wegrijden met de auto: snel, geen trapsignaal, weg van de finish.
  const r = play(
    base.state,
    rep(200, { speedMps: 19, movedM: 19, distToFinishM: 5000 }),
    2_000_000,
    123,
  );
  assert.ok(!kinds(r.events).includes("auto_resume"), "mag niet hervatten");
  const ends = endEvents(r.events);
  assert.ok(ends.length >= 1, "einde moet gesuggereerd worden");
  assert.ok(
    ends.some((e) => e.confidence === "strong"),
    "moet uiteindelijk sterke zekerheid bereiken",
  );
});

test("korte snelle afdaling wordt niet als autorit gezien", () => {
  // 2 minuten 55–65 km/u zonder trappen, daarna uitremmen en doorfietsen.
  const r = play(createRideFlowState(), [
    ...rep(300, { speedMps: 7, cadence: 80, watts: 180 }),
    ...rep(120, { speedMps: 16.5 }),
    ...rep(5, { speedMps: 5 }),
    ...rep(60, { speedMps: 7, cadence: 80, watts: 180 }),
  ]);
  assert.deepEqual(endEvents(r.events), []);
});

test("echte sprint wordt niet als autorit gezien", () => {
  const r = play(createRideFlowState(), [
    ...rep(300, { speedMps: 9, cadence: 90, watts: 220 }),
    ...rep(20, { speedMps: 17, cadence: 110, watts: 900 }), // sprint mét trapsignaal
    ...rep(60, { speedMps: 8, cadence: 85, watts: 200 }),
  ]);
  assert.deepEqual(endEvents(r.events), []);
});

test("fietsrit zonder geplande finishlocatie: autorit wordt tóch herkend", () => {
  const r = play(createRideFlowState(), [
    ...rep(600, { speedMps: 7.5, cadence: 85, watts: 190 }),
    // Instappen en wegrijden: aanhoudend 90 km/u zonder trapsignaal.
    ...rep(300, { speedMps: 25 }),
  ]);
  const ends = endEvents(r.events);
  assert.ok(ends.length >= 1);
  assert.equal(ends[0]!.confidence, "strong");
});

test("rit langs een parallelle autoweg op fietstempo geeft geen einde-suggestie", () => {
  // Gewoon doorfietsen op 30–35 km/u naast een snelweg: nooit in de snelle band.
  const r = play(createRideFlowState(), rep(900, { speedMps: 9.2, cadence: 88, watts: 210 }));
  assert.deepEqual(endEvents(r.events), []);
});

test("voorgesteld eindpunt is het laatste waarschijnlijke fietspunt", () => {
  const bike = rep(600, { speedMps: 7.5, cadence: 85, watts: 190 });
  const car = rep(300, { speedMps: 25 });
  const r = play(createRideFlowState(), [...bike, ...car]);
  const ends = endEvents(r.events);
  assert.ok(ends.length >= 1);
  // De autoreeks begint op stap 600 → laatste fietspunt-index is 600.
  assert.equal(ends[0]!.lastBikePointIndex, 600);
});

test("zonder sensoren in de rit telt sensorstilte niet mee (eerlijk neutraal)", () => {
  // 40 km/u aanhoudend zónder ooit een sensor: alleen het duursignaal telt —
  // hooguit een zwakke (vraag-)suggestie, nooit direct sterk.
  const r = play(createRideFlowState(), [
    ...rep(600, { speedMps: 7 }),
    ...rep(400, { speedMps: 11.5 }),
  ]);
  for (const e of endEvents(r.events)) assert.equal(e.confidence, "weak");
});

test("finish gepasseerd en verlaten verhoogt de zekerheid", () => {
  const r = play(createRideFlowState(), [
    ...rep(300, { speedMps: 8, cadence: 85, watts: 200 }),
    ...rep(3, { speedMps: 8, cadence: 85, watts: 200, distToFinishM: 60 }),
    ...rep(300, { speedMps: 13, distToFinishM: 4000 }),
  ]);
  const ends = endEvents(r.events);
  assert.ok(ends.length >= 1);
  const strong = ends.find((e) => e.confidence === "strong");
  assert.ok(strong, "moet sterke zekerheid bereiken");
  assert.ok(strong.reasons.some((x) => x.includes("finishlocatie")));
});
