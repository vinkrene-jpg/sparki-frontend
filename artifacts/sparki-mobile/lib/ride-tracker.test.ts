// Tests for the ride crash-recovery persistence in `lib/ride-tracker.ts`.
//
// The most dangerous regression this locks in: a headless OS relaunch of the
// background task must NOT overwrite the already-captured track with a fresh
// empty buffer, and the persisted store must NOT be cleared on stop (only once
// the ride is genuinely saved/reset/discarded). Both are impossible to catch by
// hand without killing the device mid-ride, so they are covered here.
//
// The native modules (AsyncStorage, expo-location, expo-task-manager) are
// mocked so no device is needed. AsyncStorage is backed by a real in-memory Map
// so persistence round-trips are exercised for real, not stubbed away. Nothing
// is fabricated: every point fed in is a plain fake fix and the assertions only
// check what the module actually persisted/restored.
//
// Run with: pnpm --filter @workspace/sparki-mobile run test:ride-tracker

import { test, mock } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Mocks. Defined before any import of the module under test so its top-level
// `defineTask` + hydration side-effects run against the fakes.
// ---------------------------------------------------------------------------

// In-memory AsyncStorage backing store, shared by reference into the mock so
// tests can seed/inspect/reset it between scenarios.
const mem = new Map<string, string>();

mock.module("@react-native-async-storage/async-storage", {
  defaultExport: {
    getItem: async (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: async (k: string, v: string) => {
      mem.set(k, v);
    },
    removeItem: async (k: string) => {
      mem.delete(k);
    },
  },
});

// Capture the background task callback registered via defineTask so tests can
// invoke it exactly as the OS would (with a batch of real fixes).
const taskHolder: { cb: ((body: unknown) => unknown) | null } = { cb: null };
mock.module("expo-task-manager", {
  namedExports: {
    defineTask: (_name: string, cb: (body: unknown) => unknown) => {
      taskHolder.cb = cb;
    },
  },
});

mock.module("expo-location", {
  namedExports: {
    Accuracy: { BestForNavigation: 4 },
    ActivityType: { Fitness: 3 },
    requestForegroundPermissionsAsync: async () => ({ status: "granted" }),
    requestBackgroundPermissionsAsync: async () => ({ status: "granted" }),
    hasStartedLocationUpdatesAsync: async () => false,
    startLocationUpdatesAsync: async () => {},
    stopLocationUpdatesAsync: async () => {},
  },
});

const STORE_KEY = "sparki:active-ride";

type RidePoint = { latitude: number; longitude: number; time: number };

function pt(lat: number, lon: number, time: number): RidePoint {
  return { latitude: lat, longitude: lon, time };
}

// Load the module under test FRESH each scenario via a cache-busting query so
// its module-level buffer/startedAt and the hydration promise re-run against the
// currently-seeded storage. The mocked native modules stay mocked (different
// specifiers), so only ride-tracker's own state resets.
let freshCounter = 0;
async function freshModule() {
  freshCounter += 1;
  taskHolder.cb = null;
  return (await import(`./ride-tracker.ts?fresh=${freshCounter}`)) as typeof import("./ride-tracker");
}

function seed(ride: { startedAt: unknown; points: unknown; sensorSamples?: unknown }) {
  mem.set(STORE_KEY, JSON.stringify(ride));
}

// --- Hydration before background append --------------------------------------
//
// This MUST be the first test: `defineTask` (which captures the background task
// callback) fires only on the module's first evaluation. Later scenarios use a
// cache-busting fresh import that doesn't re-trigger it — and they don't need it.

test("hydration restores the buffer before the background task appends", async () => {
  mem.clear();
  // A pre-kill track already on disk, including real sensor readings.
  const preKill = [pt(52.0, 5.0, 1000), pt(52.1, 5.1, 2000)];
  const preKillSamples = [
    { time: 1500, watts: 205, heartRate: 140, cadence: 88 },
  ];
  seed({ startedAt: 1000, points: preKill, sensorSamples: preKillSamples });

  // Fresh module = simulated headless relaunch with empty in-memory buffer.
  const m = await freshModule();
  assert.ok(taskHolder.cb, "background task must be registered on load");

  // OS delivers a new fix to the relaunched task.
  const newFix = pt(52.2, 5.2, 3000);
  await taskHolder.cb!({ data: { locations: [{ coords: newFix, timestamp: newFix.time }] }, error: null });

  // Observe the resulting buffer via the subscription (fires immediately).
  let seen: RidePoint[] = [];
  const unsub = m.subscribeRideTracker((pts) => {
    seen = pts;
  });
  unsub();

  assert.deepEqual(
    seen,
    [...preKill, newFix],
    "the pre-kill track must be restored, then the new fix appended — never overwritten",
  );

  // The next flushed snapshot must still carry the pre-kill sensor log: the
  // relaunched task has no sensor hook running, so an empty in-memory sensor
  // buffer must never clobber the values measured before the kill.
  await m.stopRideTracker();
  const parsed = JSON.parse(mem.get(STORE_KEY)!);
  assert.deepEqual(
    parsed.sensorSamples,
    preKillSamples,
    "the persisted sensor log from before the kill must survive later flushes",
  );
});

// --- Incremental persistence ------------------------------------------------

test("incremental persistence writes {startedAt, points}", async () => {
  mem.clear();
  const m = await freshModule();

  const points = [pt(52.0, 5.0, 1000), pt(52.1, 5.1, 2000)];
  m.persistForegroundRide(points, 1000);
  // stopRideTracker flushes the throttled write to disk immediately.
  await m.stopRideTracker();

  const raw = mem.get(STORE_KEY);
  assert.ok(raw, "expected a persisted snapshot after flush");
  const parsed = JSON.parse(raw!);
  assert.equal(parsed.startedAt, 1000, "startedAt must be persisted");
  assert.deepEqual(parsed.points, points, "the real fixes must be persisted");
});

// --- Store cleared only on save/reset/discard, not on stop ------------------

test("stop does not clear the persisted store", async () => {
  mem.clear();
  const m = await freshModule();
  m.persistForegroundRide([pt(52.0, 5.0, 1000), pt(52.1, 5.1, 2000)], 1000);
  await m.stopRideTracker();

  assert.ok(mem.get(STORE_KEY), "stop must keep the ride so a crash before save can't lose it");
});

test("clearRecoverableRide clears the persisted store (save/reset/discard path)", async () => {
  mem.clear();
  const m = await freshModule();
  m.persistForegroundRide([pt(52.0, 5.0, 1000), pt(52.1, 5.1, 2000)], 1000);
  await m.stopRideTracker();
  assert.ok(mem.get(STORE_KEY), "sanity: ride persisted before clear");

  await m.clearRecoverableRide();
  assert.equal(mem.get(STORE_KEY), undefined, "clear must remove the persisted ride");
});

// --- loadRecoverableRide honesty guards -------------------------------------

test("loadRecoverableRide returns a valid ride (>=2 fixes)", async () => {
  mem.clear();
  const points = [pt(52.0, 5.0, 1000), pt(52.1, 5.1, 2000)];
  seed({ startedAt: 1000, points });
  const m = await freshModule();

  const ride = await m.loadRecoverableRide();
  assert.ok(ride, "a real 2-fix ride must be recoverable");
  assert.equal(ride!.startedAt, 1000);
  assert.deepEqual(ride!.points, points);
});

test("loadRecoverableRide returns null for fewer than 2 fixes", async () => {
  mem.clear();
  seed({ startedAt: 1000, points: [pt(52.0, 5.0, 1000)] });
  const m = await freshModule();
  assert.equal(await m.loadRecoverableRide(), null, "a single fix is not a real track");
});

test("loadRecoverableRide returns null for corrupt JSON", async () => {
  mem.clear();
  mem.set(STORE_KEY, "{not valid json");
  const m = await freshModule();
  assert.equal(await m.loadRecoverableRide(), null, "corrupt store must never crash or fabricate a ride");
});

test("loadRecoverableRide returns null when nothing is stored", async () => {
  mem.clear();
  const m = await freshModule();
  assert.equal(await m.loadRecoverableRide(), null);
});

// --- Sensor sample persistence -----------------------------------------------

type Sample = { time: number; watts: number | null; heartRate: number | null; cadence: number | null };

function sample(time: number, watts: number | null, hr: number | null, cad: number | null): Sample {
  return { time, watts, heartRate: hr, cadence: cad };
}

test("sensor samples are persisted alongside the track and survive to recovery", async () => {
  mem.clear();
  const m = await freshModule();

  const points = [pt(52.0, 5.0, 1000), pt(52.1, 5.1, 2000)];
  const samples = [sample(1000, 210, 145, 92), sample(2000, 220, 147, null)];
  m.persistForegroundRide(points, 1000);
  m.persistRideSensorSamples(samples);
  await m.stopRideTracker();

  const raw = mem.get(STORE_KEY);
  assert.ok(raw, "expected a persisted snapshot after flush");
  assert.deepEqual(
    JSON.parse(raw!).sensorSamples,
    samples,
    "the measured sensor values must be persisted with the track",
  );

  const ride = await m.loadRecoverableRide();
  assert.ok(ride, "ride must be recoverable");
  assert.deepEqual(
    ride!.sensorSamples,
    samples,
    "a recovered ride must carry the values measured before the crash",
  );
});

test("a ride without sensors recovers with an empty (never fabricated) sensor log", async () => {
  mem.clear();
  // Old-format snapshot without sensorSamples (pre-crash from an older build).
  seed({ startedAt: 1000, points: [pt(52.0, 5.0, 1000), pt(52.1, 5.1, 2000)] });
  const m = await freshModule();

  const ride = await m.loadRecoverableRide();
  assert.ok(ride, "old-format snapshot must still be recoverable");
  assert.equal(
    ride!.sensorSamples,
    undefined,
    "no sensor field is fabricated for a snapshot that never had one",
  );
});

test("loadRecoverableRide returns null when startedAt is missing", async () => {
  mem.clear();
  mem.set(STORE_KEY, JSON.stringify({ points: [pt(52.0, 5.0, 1), pt(52.1, 5.1, 2)] }));
  const m = await freshModule();
  assert.equal(await m.loadRecoverableRide(), null, "a track without a real start time is not restorable");
});
