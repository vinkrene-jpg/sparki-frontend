// Tests for `lib/ride-sensor-summary.ts` — the on-screen sensor summary shown
// when a ride is saved. It must agree exactly with what `buildRideGpx` writes
// into the GPX file: same point↔sample matching (via matchSamplesToPoints),
// same per-reading rounding. And it must never fabricate: no sensors → null,
// one sensor type → only that field, unmatched samples excluded.
//
// Run with: pnpm --filter @workspace/sparki-mobile run test:ride-sensor-summary

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  summarizeRideSensors,
  formatRideSensorSummary,
} from "./ride-sensor-summary";
import { buildRideGpx } from "./ride-gpx";
import type { RidePoint, RideSensorSample } from "@/hooks/useRideRecorder";

const T0 = Date.UTC(2026, 6, 21, 9, 0, 0);

function sample(
  offsetSec: number,
  v: Partial<Pick<RideSensorSample, "watts" | "heartRate" | "cadence">>,
): RideSensorSample {
  return {
    time: T0 + offsetSec * 1000,
    watts: v.watts ?? null,
    heartRate: v.heartRate ?? null,
    cadence: v.cadence ?? null,
  };
}

function point(offsetSec: number): RidePoint {
  return {
    latitude: 52.0 + offsetSec * 0.0001,
    longitude: 5.0 + offsetSec * 0.0001,
    time: T0 + offsetSec * 1000,
  } as RidePoint;
}

// Extract the sensor values actually written to a GPX string.
function gpxValues(gpx: string) {
  const nums = (re: RegExp) => [...gpx.matchAll(re)].map((m) => Number(m[1]));
  return {
    watts: nums(/<power>(\d+)<\/power>/g),
    heartRate: nums(/<gpxtpx:hr>(\d+)<\/gpxtpx:hr>/g),
    cadence: nums(/<gpxtpx:cad>(\d+)<\/gpxtpx:cad>/g),
  };
}

const avg = (xs: number[]) =>
  Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

// Assert the summary equals the avg/max of what really landed in the file.
function assertSummaryMatchesGpx(
  points: RidePoint[],
  samples: RideSensorSample[],
) {
  const gpx = buildRideGpx(points, "Testrit", undefined, samples);
  assert.ok(gpx);
  const file = gpxValues(gpx);
  const s = summarizeRideSensors(points, samples);
  for (const field of ["watts", "heartRate", "cadence"] as const) {
    const written = file[field];
    if (written.length === 0) {
      assert.equal(s?.[field] ?? null, null, `${field} absent in file → null`);
    } else {
      assert.ok(s, "summary exists when the file has sensor values");
      assert.deepEqual(
        s[field],
        { avg: avg(written), max: Math.max(...written) },
        `${field} summary equals file aggregate`,
      );
    }
  }
}

test("mixed samples: avg/max per field, rounded exactly like the GPX writer", () => {
  const points = [point(0), point(1), point(2)];
  const samples = [
    sample(0, { watts: 199.6, heartRate: 140.4, cadence: 88 }),
    sample(1, { watts: 250.2, heartRate: 150.5, cadence: 92.7 }),
    sample(2, { watts: 300.5, heartRate: 160, cadence: 95.2 }),
  ];
  const s = summarizeRideSensors(points, samples);
  assert.ok(s);
  // GPX writes Math.round per reading: 200/250/301 → avg 250, max 301.
  assert.deepEqual(s.watts, { avg: 250, max: 301 });
  // 140/151/160 → avg 150.33 → 150, max 160. (150.5 rounds to 151, matching
  // the <gpxtpx:hr> value in the file — not the raw 150.5.)
  assert.deepEqual(s.heartRate, { avg: 150, max: 160 });
  // 88/93/95 → avg 92, max 95.
  assert.deepEqual(s.cadence, { avg: 92, max: 95 });
  assertSummaryMatchesGpx(points, samples);
});

test("sensorless ride returns null (never zeros)", () => {
  const points = [point(0), point(1)];
  assert.equal(summarizeRideSensors(points, []), null);
  assert.equal(summarizeRideSensors(points, undefined), null);
  assert.equal(summarizeRideSensors(points, null), null);
  assert.equal(summarizeRideSensors(null, [sample(0, { watts: 200 })]), null);
  // Samples exist but every field is null (should not happen in practice —
  // the recorder only logs when at least one value is real — but the summary
  // must still stay honest).
  assert.equal(
    summarizeRideSensors(points, [sample(0, {}), sample(1, {})]),
    null,
  );
  assert.equal(formatRideSensorSummary(null), null);
});

test("only one sensor type present → only that field is summarized", () => {
  const points = [point(0), point(1), point(2)];
  const samples = [
    sample(0, { heartRate: 120 }),
    sample(1, { heartRate: 130 }),
    sample(2, { heartRate: 125 }),
  ];
  const s = summarizeRideSensors(points, samples);
  assert.ok(s);
  assert.deepEqual(s.heartRate, { avg: 125, max: 130 });
  assert.equal(s.watts, null);
  assert.equal(s.cadence, null);
  const line = formatRideSensorSummary(s);
  assert.ok(line);
  assert.match(line, /hartslag 125 \(max 130\)/);
  assert.ok(!/W \(/.test(line), "no wattage mentioned when none was measured");
  assert.ok(!/cadans/.test(line), "no cadence mentioned when none was measured");
  assertSummaryMatchesGpx(points, samples);
});

test("sparse points + dense samples: summary counts only point-matched values, exactly like the file", () => {
  // Track points every 10s (sparser than the 1 Hz sensor cadence), so most
  // samples never land in the GPX. Peak wattage (999) happens BETWEEN points
  // and outside every match window — it must not appear in the file NOR in
  // the summary. Values are chosen so the all-samples aggregate differs
  // clearly from the point-matched aggregate.
  const points = [point(0), point(10), point(20), point(30)];
  const samples: RideSensorSample[] = [];
  for (let t = 0; t <= 30; t++) {
    // A wild spike well away from any point (t=15..16, >5s from 10 and 20).
    const w = t === 15 || t === 16 ? 999 : 100 + t;
    samples.push(sample(t, { watts: w, heartRate: 130 + t }));
  }
  const gpx = buildRideGpx(points, "Testrit", undefined, samples);
  assert.ok(gpx);
  const file = gpxValues(gpx);
  // Exactly one value per point, spike excluded.
  assert.equal(file.watts.length, 4);
  assert.ok(!file.watts.includes(999), "spike between points never written");

  const s = summarizeRideSensors(points, samples);
  assert.ok(s?.watts && s.heartRate);
  assert.deepEqual(s.watts, { avg: avg(file.watts), max: Math.max(...file.watts) });
  assert.deepEqual(s.heartRate, {
    avg: avg(file.heartRate),
    max: Math.max(...file.heartRate),
  });
  assert.ok(s.watts.max < 999, "summary max excludes the unwritten spike");

  // Cross-check: the naive all-samples aggregate WOULD differ — this is the
  // regression the shared matching path prevents.
  const naiveMax = Math.max(...samples.map((x) => x.watts!));
  assert.equal(naiveMax, 999);
  assert.notEqual(s.watts.max, naiveMax);
});

test("samples entirely outside the match window are excluded (screen-locked gap stays honest)", () => {
  // Sensors only ran during the first 3 seconds; the ride continued for two
  // more GPS-only minutes. Points after the gap get no extension in the file,
  // and a sample burst far from any point contributes nothing.
  const points = [point(0), point(60), point(120)];
  const samples = [
    sample(0, { watts: 210.4, cadence: 87.2 }),
    sample(1, { watts: 305.5, cadence: 90.5 }),
    sample(30, { watts: 400, cadence: 120 }), // ≥5s from every point → dropped
  ];
  assertSummaryMatchesGpx(points, samples);
  const s = summarizeRideSensors(points, samples);
  assert.ok(s?.watts && s.cadence);
  // Only the t=0 sample matches a point (t=1 loses to t=0 for point 0 and is
  // too far from the others): file holds exactly one wattage reading, 210.
  assert.deepEqual(s.watts, { avg: 210, max: 210 });
  assert.deepEqual(s.cadence, { avg: 87, max: 87 });
  assert.equal(s.heartRate, null);
});

test("summary matches the values that actually land in the GPX file (aligned case)", () => {
  const points = [point(0), point(1), point(2)];
  const samples = [
    sample(0, { watts: 210.4, heartRate: 141.6, cadence: 87.2 }),
    sample(1, { watts: 305.5, heartRate: 152.5, cadence: 90.5 }),
    sample(2, { watts: 180.1, heartRate: 138.4, cadence: 84.9 }),
  ];
  assertSummaryMatchesGpx(points, samples);
});
