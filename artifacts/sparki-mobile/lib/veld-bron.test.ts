import assert from "node:assert/strict";
import { test } from "node:test";

import { bronVoorVeld, veldBronLabel, type Herkomst } from "./veld-bron";

test("null zolang herkomst nog niet geladen is — geen gok", () => {
  assert.equal(bronVoorVeld(undefined, "avgPower"), null);
  assert.equal(bronVoorVeld(null, "avgPower"), null);
});

test("vastgelegde bron wordt vertaald met dezelfde labels als web", () => {
  const herkomst: Herkomst = {
    bron: "strava",
    bronnen: ["strava"],
    veldBronnen: { avgPower: "strava", elevationM: "fit", tss: "derived" },
    handmatigeVelden: null,
  };
  assert.equal(bronVoorVeld(herkomst, "avgPower"), "Strava");
  assert.equal(bronVoorVeld(herkomst, "elevationM"), "FIT-bestand");
  assert.equal(bronVoorVeld(herkomst, "tss"), "berekend");
});

test("handmatig aangepaste velden gaan vóór de veldbron", () => {
  const herkomst: Herkomst = {
    bron: "strava",
    bronnen: ["strava"],
    veldBronnen: { distanceKm: "strava" },
    handmatigeVelden: ["distanceKm"],
  };
  assert.equal(bronVoorVeld(herkomst, "distanceKm"), "handmatig aangepast");
});

test("geladen herkomst zonder veldbron is eerlijk 'onbekend'", () => {
  const herkomst: Herkomst = {
    bron: "manual",
    bronnen: ["manual"],
    veldBronnen: null,
    handmatigeVelden: null,
  };
  assert.equal(bronVoorVeld(herkomst, "avgSpeedKph"), "onbekend");
  assert.equal(bronVoorVeld({ ...herkomst, veldBronnen: {} }, "maxHR"), "onbekend");
});

test("onbekende ruwe waarde wordt letterlijk getoond — nooit geraden", () => {
  assert.equal(veldBronLabel("zwift"), "zwift");
  assert.equal(veldBronLabel("Strava"), "Strava");
});
