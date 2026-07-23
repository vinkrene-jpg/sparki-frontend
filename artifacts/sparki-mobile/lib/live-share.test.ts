// Vrienden live op de kaart (Opdracht 4) — mobiele pure kern.
//
// Getest zonder netwerk: adaptieve updatefrequentie (stilstand/scherm/
// batterij/offline), marker-clustering en eerlijke lokale herveroudering
// wanneer de kijker zelf netwerk verliest.
//
// Run: `pnpm --filter @workspace/sparki-mobile run test:live-share`

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  ageFriendsLocally,
  clusterFriendMarkers,
  decideUpdateIntervalMs,
  type FriendPosition,
} from "./live-share";

function friend(overrides: Partial<FriendPosition> = {}): FriendPosition {
  return {
    clerkId: "f1",
    name: "Test Vriend",
    initials: "TV",
    lat: 52.1,
    lon: 5.1,
    headingDeg: null,
    ageSec: 5,
    status: "Live",
    statusKind: "live",
    ...overrides,
  };
}

test("offline → geen update (null), er wordt niets verzonnen of gebufferd", () => {
  assert.equal(
    decideUpdateIntervalMs({ speedMps: 5, screenOn: true, batteryLow: false, online: false }),
    null,
  );
});

test("rijdend met scherm aan → basisinterval 10s", () => {
  assert.equal(
    decideUpdateIntervalMs({ speedMps: 6, screenOn: true, batteryLow: false, online: true }),
    10_000,
  );
});

test("stilstand → trager (30s), langzaamste factor wint", () => {
  assert.equal(
    decideUpdateIntervalMs({ speedMps: 0.2, screenOn: true, batteryLow: false, online: true }),
    30_000,
  );
  // Scherm uit (20s) + stilstand (30s) → 30s.
  assert.equal(
    decideUpdateIntervalMs({ speedMps: 0, screenOn: false, batteryLow: false, online: true }),
    30_000,
  );
});

test("scherm uit en batterij bijna leeg vertragen elk", () => {
  assert.equal(
    decideUpdateIntervalMs({ speedMps: 6, screenOn: false, batteryLow: false, online: true }),
    20_000,
  );
  assert.equal(
    decideUpdateIntervalMs({ speedMps: 6, screenOn: true, batteryLow: true, online: true }),
    30_000,
  );
});

test("clustering: dichtbij elkaar → één marker met beide leden", () => {
  const clusters = clusterFriendMarkers([
    friend({ clerkId: "f1" }),
    friend({ clerkId: "f2", lat: 52.1002, lon: 5.1 }), // ~22 m
  ]);
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].members.length, 2);
});

test("clustering: ver uit elkaar → losse markers", () => {
  const clusters = clusterFriendMarkers([
    friend({ clerkId: "f1" }),
    friend({ clerkId: "f2", lat: 52.2, lon: 5.3 }),
  ]);
  assert.equal(clusters.length, 2);
});

test("clustering: vrienden zonder coördinaten krijgen NOOIT een marker", () => {
  const clusters = clusterFriendMarkers([
    friend({ clerkId: "f1", lat: null, lon: null, statusKind: "niet_beschikbaar" }),
  ]);
  assert.equal(clusters.length, 0);
});

test("lokale herveroudering: Live wordt eerlijk verouderd bij kijker-netwerkverlies", () => {
  const aged = ageFriendsLocally([friend({ ageSec: 5 })], 60_000);
  assert.equal(aged[0].statusKind, "verouderd");
  assert.notEqual(aged[0].status, "Live");
});

test("lokale herveroudering: ≥5 min → coördinaten verborgen", () => {
  const aged = ageFriendsLocally([friend({ ageSec: 10 })], 5 * 60_000);
  assert.equal(aged[0].statusKind, "niet_beschikbaar");
  assert.equal(aged[0].lat, null);
  assert.equal(aged[0].lon, null);
});

test("lokale herveroudering: verse data blijft ongemoeid", () => {
  const aged = ageFriendsLocally([friend({ ageSec: 5 })], 2_000);
  assert.equal(aged[0].statusKind, "live");
  assert.equal(aged[0].lat, 52.1);
});
