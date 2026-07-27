import { test } from "node:test";
import assert from "node:assert/strict";
import {
  typeLabel,
  sourceLabel,
  avgSpeed,
  monthKey,
  monthLabel,
  relativeDate,
  calculateSummary,
  filterSessions,
  groupSessionsByMonth,
  sessionMetricsText,
} from "./core-activiteiten";
import type { TrainingSession } from "@/lib/athlete-types";

// Helper to create a fake session
function makeSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: 1,
    athleteId: 1,
    source: "sparki",
    type: "endurance",
    sessionDate: "2023-08-15",
    title: "Mooie rit",
    ...overrides,
  } as TrainingSession;
}

test("typeLabel and sourceLabel fallback to sensible defaults", () => {
  assert.equal(typeLabel("endurance"), "Duurtraining");
  assert.equal(typeLabel(null), "Training");
  assert.equal(typeLabel("weird"), "Weird");

  assert.equal(sourceLabel("strava"), "Strava");
  assert.equal(sourceLabel(null), "Onbekend");
  assert.equal(sourceLabel("garmin"), "Garmin");
});

test("avgSpeed calculation uses stored if valid, otherwise computes from distance and time", () => {
  assert.equal(avgSpeed(makeSession({ avgSpeedKph: "25.4" })), 25.4);
  assert.equal(avgSpeed(makeSession({ distanceKm: "60", durationMin: 120 })), 30);
  assert.equal(avgSpeed(makeSession({ distanceKm: "60", durationMin: 0 })), null);
});

test("relativeDate computes days correctly", () => {
  const today = "2023-08-15";
  assert.equal(relativeDate("2023-08-15", today), "Vandaag");
  assert.equal(relativeDate("2023-08-14", today), "Gisteren");
  assert.equal(relativeDate("2023-08-10", today), "5 dagen geleden");
  assert.ok(relativeDate("2023-01-01", today).includes("jan"));
});

test("calculateSummary sums durations and distances", () => {
  const sessions = [
    makeSession({ durationMin: 60, distanceKm: "30" }),
    makeSession({ durationMin: 45, distanceKm: "20.5" }),
    makeSession({ durationMin: 0, distanceKm: "0" }),
    makeSession(), // undefined metrics
  ];
  const summary = calculateSummary(sessions);
  assert.equal(summary.count, 4);
  assert.equal(summary.durationMin, 105);
  assert.equal(summary.distanceKm, 50.5);
});

test("filterSessions filters by query, type, and month", () => {
  const s1 = makeSession({ title: "Zondagsrit", type: "endurance", sessionDate: "2023-08-15" });
  const s2 = makeSession({ title: "Korte interval", type: "interval", sessionDate: "2023-08-10" });
  const s3 = makeSession({ title: "Race", type: "race", sessionDate: "2023-07-20" });

  const all = [s1, s2, s3];

  assert.equal(filterSessions(all, "zon", null, null).length, 1);
  assert.equal(filterSessions(all, "", "interval", null).length, 1);
  assert.equal(filterSessions(all, "", null, "2023-07").length, 1);
  assert.equal(filterSessions(all, "", null, null).length, 3);
});

test("groupSessionsByMonth groups and sorts newest first", () => {
  const s1 = makeSession({ sessionDate: "2023-07-15" });
  const s2 = makeSession({ sessionDate: "2023-08-10" });
  const s3 = makeSession({ sessionDate: "2023-08-20" });

  const grouped = groupSessionsByMonth([s1, s2, s3]);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0][0], "2023-08"); // Newest month first
  assert.equal(grouped[0][1].length, 2);
  assert.equal(grouped[1][0], "2023-07");
});

test("sessionMetricsText generates correct chips and omits missing values", () => {
  const full = makeSession({
    durationMin: 120,
    distanceKm: "60",
    avgSpeedKph: "30",
    elevationM: 500,
    normalizedPower: 220,
    avgHR: 140,
    tss: 110,
  });
  const chipsFull = sessionMetricsText(full);
  assert.deepEqual(chipsFull, [
    "120 min",
    "60 km",
    "30 km/u",
    "500 hm",
    "220 W",
    "140 bpm",
    "110 TSS"
  ]);

  const empty = makeSession({
    durationMin: null,
    distanceKm: null,
    avgSpeedKph: null,
    elevationM: null,
    normalizedPower: null,
    avgPower: null,
    avgHR: null,
    tss: null,
  });
  const chipsEmpty = sessionMetricsText(empty);
  assert.deepEqual(chipsEmpty, []);
});
