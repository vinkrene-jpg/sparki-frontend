// Tests voor `lib/fall-detection.ts` — de pure val-detectie-toestandsmachine.
// Eerlijke regels (identiek aan de webnavigatie): eerst ≥ 20 km/u, dan binnen
// 30 s abrupt < 3 km/u, en dat 15 s lang stil → vraag "Alles oké?". De
// 30 s-toets geldt alleen op het MOMENT dat de stilstand begint; daarna telt
// de stilstand door. Na "Ik ben oké" volgt 5 minuten rust.
//
// Run with: pnpm --filter @workspace/sparki-mobile run test:fall-detection

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  initialFallState,
  feedSpeed,
  dismissFall,
  FAST_WINDOW_MS,
  STILL_TRIGGER_MS,
  SNOOZE_MS,
} from "./fall-detection";

const T0 = 1_000_000;

test("snel rijden → abrupt stil → na 15 s trigger", () => {
  let s = initialFallState();
  ({ state: s } = feedSpeed(s, 32, T0, false));
  ({ state: s } = feedSpeed(s, 1, T0 + 2000, false)); // stilstand begint
  let r = feedSpeed(s, 0.5, T0 + 2000 + STILL_TRIGGER_MS - 1, false);
  assert.equal(r.trigger, false);
  r = feedSpeed(r.state, 0.5, T0 + 2000 + STILL_TRIGGER_MS, false);
  assert.equal(r.trigger, true);
});

test("geen trigger zonder voorafgaand snel rijden", () => {
  let s = initialFallState();
  ({ state: s } = feedSpeed(s, 1, T0, false));
  const r = feedSpeed(s, 0.5, T0 + STILL_TRIGGER_MS * 4, false);
  assert.equal(r.trigger, false);
});

test("30 s-venster geldt alleen op het moment dat de stilstand begint", () => {
  let s = initialFallState();
  ({ state: s } = feedSpeed(s, 30, T0, false));
  // Stilstand begint pas ná het 30 s-venster: geen bewaking.
  const late = feedSpeed(s, 1, T0 + FAST_WINDOW_MS + 1000, false);
  assert.equal(late.state.stillSince, null);
  // Maar begint de stilstand er nét binnen, dan telt hij daarna gewoon door.
  let r = feedSpeed(s, 1, T0 + FAST_WINDOW_MS - 1000, false);
  assert.notEqual(r.state.stillSince, null);
  r = feedSpeed(r.state, 0.5, T0 + FAST_WINDOW_MS - 1000 + STILL_TRIGGER_MS, false);
  assert.equal(r.trigger, true);
});

test("weer gaan rijden reset de stilstand-teller", () => {
  let s = initialFallState();
  ({ state: s } = feedSpeed(s, 30, T0, false));
  ({ state: s } = feedSpeed(s, 1, T0 + 1000, false));
  ({ state: s } = feedSpeed(s, 10, T0 + 5000, false)); // langzaam rijden
  assert.equal(s.stillSince, null);
});

test("geen tweede trigger terwijl de vraag al open staat", () => {
  let s = initialFallState();
  ({ state: s } = feedSpeed(s, 30, T0, false));
  ({ state: s } = feedSpeed(s, 1, T0 + 1000, false));
  const r = feedSpeed(s, 0.5, T0 + 1000 + STILL_TRIGGER_MS, true);
  assert.equal(r.trigger, false);
});

test("na 'Ik ben oké' 5 minuten geen nieuwe vraag, daarna wel weer", () => {
  let s = dismissFall(initialFallState(), T0);
  assert.equal(s.snoozeUntil, T0 + SNOOZE_MS);
  // Nieuwe val binnen de rustperiode: geen trigger.
  ({ state: s } = feedSpeed(s, 30, T0 + 1000, false));
  ({ state: s } = feedSpeed(s, 1, T0 + 2000, false));
  let r = feedSpeed(s, 0.5, T0 + 2000 + STILL_TRIGGER_MS, false);
  assert.equal(r.trigger, false);
  // Zelfde situatie ná de rustperiode: wél een trigger.
  let s2 = dismissFall(initialFallState(), T0);
  const t1 = T0 + SNOOZE_MS + 1000;
  ({ state: s2 } = feedSpeed(s2, 30, t1, false));
  ({ state: s2 } = feedSpeed(s2, 1, t1 + 1000, false));
  r = feedSpeed(s2, 0.5, t1 + 1000 + STILL_TRIGGER_MS, false);
  assert.equal(r.trigger, true);
});
