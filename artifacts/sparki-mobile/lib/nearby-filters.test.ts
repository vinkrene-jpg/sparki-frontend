import assert from "node:assert/strict";
import { test } from "node:test";

import {
  NEARBY_FILTERS_LEEG,
  nearbyFiltersActief,
  ondergrondKlasse,
  pasNearbyFilters,
  type NearbyRoute,
} from "./nearby-filters";

function route(over: Partial<NearbyRoute>): NearbyRoute {
  return {
    key: over.key ?? "r-1",
    soort: "route",
    id: 1,
    bron: "bewaard",
    bronLabel: "Bewaard door jou",
    naam: "Testroute",
    sport: "cycling",
    distanceKm: 40,
    elevationGainM: 200,
    durationSec: null,
    surface: "asfalt",
    isLus: true,
    moeilijkheid: "gemiddeld",
    startAfstandKm: 1.2,
    geometry: [
      [51.1, 4.9],
      [51.2, 5.0],
    ],
    verificatie: "controle_bij_gebruik",
    ...over,
  };
}

test("lege filters laten alles door en gelden als niet-actief", () => {
  const routes = [route({}), route({ key: "r-2", surface: "unknown" })];
  assert.equal(pasNearbyFilters(routes, NEARBY_FILTERS_LEEG).length, 2);
  assert.equal(nearbyFiltersActief(NEARBY_FILTERS_LEEG), false);
});

test("afstandsband filtert; onbekende afstand valt eerlijk af zodra er een grens is", () => {
  const routes = [
    route({ key: "kort", distanceKm: 20 }),
    route({ key: "lang", distanceKm: 80 }),
    route({ key: "onbekend", distanceKm: null }),
  ];
  const f = { ...NEARBY_FILTERS_LEEG, minKm: 25, maxKm: 60 };
  assert.deepEqual(
    pasNearbyFilters([...routes, route({ key: "mid", distanceKm: 40 })], f).map(
      (r) => r.key,
    ),
    ["mid"],
  );
  assert.equal(nearbyFiltersActief(f), true);
});

test("ondergrond: unknown telt alleen mee bij 'geen voorkeur' (server-semantiek)", () => {
  assert.equal(ondergrondKlasse("asfalt"), "verhard");
  assert.equal(ondergrondKlasse("gravel"), "onverhard");
  assert.equal(ondergrondKlasse("unknown"), "onbekend");
  const routes = [
    route({ key: "a", surface: "asfalt" }),
    route({ key: "g", surface: "gravel" }),
    route({ key: "u", surface: "unknown" }),
  ];
  assert.equal(pasNearbyFilters(routes, NEARBY_FILTERS_LEEG).length, 3);
  assert.deepEqual(
    pasNearbyFilters(routes, {
      ...NEARBY_FILTERS_LEEG,
      ondergrond: "verhard",
    }).map((r) => r.key),
    ["a"],
  );
  assert.deepEqual(
    pasNearbyFilters(routes, {
      ...NEARBY_FILTERS_LEEG,
      ondergrond: "onverhard",
    }).map((r) => r.key),
    ["g"],
  );
});

test("moeilijkheidsfilter laat 'onbekend' eerlijk afvallen", () => {
  const routes = [
    route({ key: "m", moeilijkheid: "makkelijk" }),
    route({ key: "z", moeilijkheid: "zwaar" }),
    route({ key: "o", moeilijkheid: null }),
  ];
  const f = {
    ...NEARBY_FILTERS_LEEG,
    moeilijkheid: { makkelijk: true, gemiddeld: true, zwaar: false },
  };
  assert.deepEqual(pasNearbyFilters(routes, f).map((r) => r.key), ["m"]);
});

test("type-filter: lus vs heen-en-terug", () => {
  const routes = [route({ key: "lus", isLus: true }), route({ key: "ab", isLus: false })];
  assert.deepEqual(
    pasNearbyFilters(routes, { ...NEARBY_FILTERS_LEEG, type: "lus" }).map((r) => r.key),
    ["lus"],
  );
  assert.deepEqual(
    pasNearbyFilters(routes, { ...NEARBY_FILTERS_LEEG, type: "heenterug" }).map(
      (r) => r.key,
    ),
    ["ab"],
  );
});

test("hoogtemeterband filtert; null hm valt af bij een grens", () => {
  const routes = [
    route({ key: "vlak", elevationGainM: 100 }),
    route({ key: "berg", elevationGainM: 1200 }),
    route({ key: "onbekend", elevationGainM: null }),
  ];
  assert.deepEqual(
    pasNearbyFilters(routes, { ...NEARBY_FILTERS_LEEG, minHm: 800 }).map((r) => r.key),
    ["berg"],
  );
});
