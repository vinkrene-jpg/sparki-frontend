// Regressietests voor de "Rit inkorten"-engine (pure functies, geen DB).
// Draaien via: npx tsx --test src/lib/ride-trim.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeTrimPreview,
  elevationGainM,
  sliceProfile,
  trackDistanceKm,
  validateTrimRange,
  type TrimGeometryPoint,
} from "./ride-trim";

// Rechte lijn noordwaarts: ~1.112 km per 0.01° breedtegraad, 101 punten.
function straightTrack(n = 101, withEle = false): TrimGeometryPoint[] {
  return Array.from({ length: n }, (_, i) =>
    withEle
      ? ([52 + i * 0.01, 5, 10 + i * 2] as TrimGeometryPoint)
      : ([52 + i * 0.01, 5] as TrimGeometryPoint),
  );
}

const ORIGINAL = {
  durationMin: 100,
  distanceKm: "111.2",
  elevationM: 200,
  avgSpeedKph: "66.7",
};

test("trim: validateTrimRange accepteert een geldig bereik", () => {
  assert.equal(validateTrimRange(101, 0, 100), null);
  assert.equal(validateTrimRange(101, 10, 90), null);
});

test("trim: validateTrimRange weigert omgekeerde, gelijke en buiten-bereik indexen", () => {
  assert.notEqual(validateTrimRange(101, 90, 10), null);
  assert.notEqual(validateTrimRange(101, 50, 50), null);
  assert.notEqual(validateTrimRange(101, -1, 100), null);
  assert.notEqual(validateTrimRange(101, 0, 101), null);
});

test("trim: validateTrimRange weigert niet-gehele en niet-numerieke invoer", () => {
  assert.notEqual(validateTrimRange(101, 0.5, 100), null);
  assert.notEqual(validateTrimRange(101, "0" as unknown, 100), null);
  assert.notEqual(validateTrimRange(1, 0, 0), null);
});

test("trim: halve rit geeft ongeveer halve afstand en proportioneel geschatte duur", () => {
  const geo = straightTrack();
  const p = computeTrimPreview(geo, 0, 50, ORIGINAL);
  assert.ok(Math.abs(p.distanceFraction - 0.5) < 0.02, `fraction ${p.distanceFraction}`);
  assert.ok(p.durationMin != null && Math.abs(p.durationMin - 50) <= 2);
  assert.equal(p.durationEstimated, true);
});

test("trim: volledig bereik verandert de afstand niet", () => {
  const geo = straightTrack();
  const p = computeTrimPreview(geo, 0, geo.length - 1, ORIGINAL);
  assert.equal(p.distanceKm, p.fullDistanceKm);
  assert.equal(p.durationMin, 100);
});

test("trim: hoogtemeters worden alleen uit echte ele-waarden herberekend", () => {
  const withEle = computeTrimPreview(straightTrack(101, true), 0, 50, ORIGINAL);
  assert.ok(withEle.elevationM != null && withEle.elevationM > 0);
  const withoutEle = computeTrimPreview(straightTrack(101, false), 0, 50, ORIGINAL);
  assert.equal(withoutEle.elevationM, null);
});

test("trim: zonder oorspronkelijke duur blijft de geschatte duur eerlijk null", () => {
  const p = computeTrimPreview(straightTrack(), 0, 50, {
    ...ORIGINAL,
    durationMin: null,
  });
  assert.equal(p.durationMin, null);
  assert.equal(p.durationEstimated, false);
  assert.equal(p.avgSpeedKph, null);
});

test("trim: gemiddelde snelheid volgt uit ingekorte afstand en geschatte duur", () => {
  const p = computeTrimPreview(straightTrack(), 0, 50, ORIGINAL);
  assert.ok(p.avgSpeedKph != null);
  const expected = p.distanceKm / (p.durationMin! / 60);
  assert.ok(Math.abs(p.avgSpeedKph! - expected) < 0.5);
});

test("trim: trackDistanceKm telt haversine-afstand langs de punten op", () => {
  const km = trackDistanceKm(straightTrack());
  assert.ok(Math.abs(km - 111.2) < 1, `km ${km}`);
  assert.equal(trackDistanceKm([[52, 5]]), 0);
});

test("trim: elevationGainM gebruikt een ruisdrempel en telt alleen echte stijging", () => {
  const flatNoise: TrimGeometryPoint[] = Array.from({ length: 20 }, (_, i) => [
    52 + i * 0.001,
    5,
    10 + (i % 2), // ±1 m-ruis blijft onder de 3 m-drempel
  ]);
  assert.equal(elevationGainM(flatNoise), 0);
  const climb: TrimGeometryPoint[] = Array.from({ length: 20 }, (_, i) => [
    52 + i * 0.001,
    5,
    10 + i * 5,
  ]);
  assert.ok(elevationGainM(climb)! >= 90);
});

test("trim: elevationGainM is eerlijk null bij (grotendeels) ontbrekende hoogte", () => {
  assert.equal(elevationGainM(straightTrack(50, false)), null);
  const sparse: TrimGeometryPoint[] = straightTrack(50, true).map((p, i) =>
    i % 3 === 0 ? p : ([p[0], p[1]] as TrimGeometryPoint),
  );
  assert.equal(elevationGainM(sparse), null);
});

test("trim: sliceProfile knipt het profiel proportioneel op het bereik", () => {
  const profile = Array.from({ length: 200 }, (_, i) => i);
  const out = sliceProfile(profile, 101, 0, 50)!;
  assert.ok(out.length >= 2);
  assert.equal(out[0], 0);
  assert.ok(Math.abs(out[out.length - 1]! - 100) <= 2);
});

test("trim: sliceProfile laat een ontbrekend profiel ongemoeid", () => {
  assert.equal(sliceProfile(null, 101, 0, 50), null);
  assert.deepEqual(sliceProfile([5], 101, 0, 50), [5]);
});

test("trim: einde inkorten verwijdert het staartstuk uit de statistieken", () => {
  const geo = straightTrack();
  const p = computeTrimPreview(geo, 0, 80, ORIGINAL);
  assert.ok(p.distanceFraction > 0.75 && p.distanceFraction < 0.85);
  assert.ok(p.durationMin! > 75 && p.durationMin! < 85);
});

test("trim: degenerate track zonder afstand geeft eerlijk geen duurschatting", () => {
  const stil: TrimGeometryPoint[] = Array.from({ length: 10 }, () => [52, 5]);
  const p = computeTrimPreview(stil, 0, 5, ORIGINAL);
  assert.equal(p.durationMin, null);
  assert.equal(p.durationEstimated, false);
  assert.equal(p.avgSpeedKph, null);
  assert.equal(p.distanceKm, 0);
});

test("trim: begin én einde inkorten combineert beide kanten", () => {
  const geo = straightTrack();
  const p = computeTrimPreview(geo, 20, 80, ORIGINAL);
  assert.ok(Math.abs(p.distanceFraction - 0.6) < 0.03);
  assert.equal(p.pointCount, 61);
});
