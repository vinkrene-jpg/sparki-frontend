// Opdracht 1 — kaartinteractie & HUD: lay-out (klimkaart vs. kaart),
// vrije camera zonder terugschieten, en begrensde metric-containers.
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  chooseMetricLayout,
  estimateInlineWidthPx,
  metricContainerWidthPx,
} from "./hud-metrics";
import { cameraForLocation, nextFollowing } from "./map-camera";
import {
  buildClimbWindows,
  climbPhaseAt,
  climbProfileSlice,
} from "./nav-climb";
import { computeNavLayout, MIN_MAP_HEIGHT } from "./nav-layout";

// ── Lay-out: kaart krimpt exact tot de resterende ruimte ───────────

test("klimkaart zichtbaar → kaart krimpt zonder overlap, sluiten → volledige ruimte terug", () => {
  const base = {
    screenWidth: 390,
    screenHeight: 844,
    topInset: 59,
    bottomInset: 34,
  };
  const open = computeNavLayout({ ...base, climbPanelHeight: 220 });
  assert.equal(open.climbPanelHeight, 220);
  assert.equal(open.mapBottomOffset, 220 + 34);
  assert.equal(open.mapHeight, 844 - 254);
  // Geen overlap: kaart + klimkaart + safe area vullen precies het scherm.
  assert.equal(open.mapHeight + open.climbPanelHeight + base.bottomInset, 844);

  const closed = computeNavLayout({ ...base, climbPanelHeight: null });
  assert.equal(closed.mapBottomOffset, 0);
  assert.equal(closed.mapHeight, 844);
});

test("klimkaart wordt begrensd: nooit groter dan max-fractie en kaart houdt minimum hoogte", () => {
  // Klein liggend scherm: gewenste 500px past niet.
  const l = computeNavLayout({
    screenWidth: 844,
    screenHeight: 390,
    topInset: 0,
    bottomInset: 21,
    climbPanelHeight: 500,
  });
  assert.equal(l.landscape, true);
  assert.ok(l.climbPanelHeight <= l.climbPanelMaxHeight);
  assert.ok(l.climbPanelHeight < 500);
  assert.ok(l.mapHeight >= MIN_MAP_HEIGHT);

  // Portret: fractiegrens (42%) bepaalt het maximum.
  const p = computeNavLayout({
    screenWidth: 390,
    screenHeight: 844,
    topInset: 59,
    bottomInset: 34,
    climbPanelHeight: 9999,
  });
  assert.ok(p.climbPanelHeight <= Math.floor((844 - 59 - 34) * 0.42));
  assert.ok(p.mapHeight >= MIN_MAP_HEIGHT);
});

// ── Camera: vrije modus zonder terugschieten ───────────────────────

test("pan/pinch/rotate schakelt naar vrije modus; GPS-tick verandert modus nooit", () => {
  assert.equal(nextFollowing(true, { type: "gesture", gesture: "pan" }), false);
  assert.equal(nextFollowing(true, { type: "gesture", gesture: "pinch" }), false);
  assert.equal(nextFollowing(true, { type: "gesture", gesture: "rotate" }), false);
  assert.equal(nextFollowing(false, { type: "location" }), false);
  assert.equal(nextFollowing(true, { type: "location" }), true);
});

test("vrije modus: camera krijgt GEEN doel bij nieuwe GPS-metingen (geen terugschieten); 'Terug naar mijn positie' herstelt volgen", () => {
  const loc = { latitude: 52.1, longitude: 5.2, heading: 90 };
  // Vrij: null → kaart blijft exact staan, ook na vele ticks.
  assert.equal(cameraForLocation(false, loc), null);
  assert.equal(cameraForLocation(false, { ...loc, latitude: 52.2 }), null);
  // Herstel volgen via de knop:
  const following = nextFollowing(false, { type: "recenter" });
  assert.equal(following, true);
  const cam = cameraForLocation(following, loc);
  assert.ok(cam);
  assert.equal(cam!.center.latitude, 52.1);
  assert.equal(cam!.heading, 90);
  // Zonder locatie valt er niets te volgen — eerlijk null.
  assert.equal(cameraForLocation(true, null), null);
});

// ── Databalk: begrensde containers, eenheid eronder waar nodig ─────

test("4-cijferig vermogen in smalle container → eenheid onder de waarde", () => {
  const w = metricContainerWidthPx(320, 5); // smal scherm, 5 metrics
  assert.ok(w > 0 && w < 65);
  assert.equal(chooseMetricLayout("1043", "W", w, 1), "stacked");
  // Zelfde waarde in een ruime container blijft naast elkaar.
  assert.equal(chooseMetricLayout("1043", "W", 160, 1), "inline");
});

test("grote systeem-fontScale dwingt stapeling af waar 1.0 nog inline past", () => {
  const w = metricContainerWidthPx(390, 3);
  assert.equal(chooseMetricLayout("32,4", "km/u", w, 1), "inline");
  assert.equal(chooseMetricLayout("32,4", "km/u", w, 2), "stacked");
  // Schaal groeit monotoon mee in de schatting.
  assert.ok(
    estimateInlineWidthPx("188", "bpm", 2) > estimateInlineWidthPx("188", "bpm", 1),
  );
});

test("randgevallen: geen eenheid altijd inline; onbekende breedte kiest veilig", () => {
  assert.equal(chooseMetricLayout("12:34:56", "", 40, 1), "inline");
  // Breedte nog niet gemeten (0): lange combinatie stapelt, korte niet.
  assert.equal(chooseMetricLayout("1043", "km/u", 0, 1), "stacked");
  assert.equal(chooseMetricLayout("95", "rpm", 0, 1), "inline");
});

// ── Klimkaart: alleen echte klimgegevens ───────────────────────────

test("klimvensters: onvolledige klimmen vallen eerlijk weg; fase-verloop komt→op→top→einde", () => {
  const windows = buildClimbWindows([
    { name: "Kruisberg", lengthKm: 1.5, avgGradePct: 6.1, summitKm: 12.5 },
    { name: "kapot", lengthKm: null, summitKm: 3 }, // onvolledig → weg
  ]);
  assert.equal(windows.length, 1);
  assert.equal(windows[0]!.startKm, 11);
  assert.equal(climbPhaseAt(windows, 5)?.phase ?? null, null);
  assert.equal(climbPhaseAt(windows, 10.4)?.phase, "komt");
  assert.equal(climbPhaseAt(windows, 11.7)?.phase, "op");
  assert.equal(climbPhaseAt(windows, 12.46)?.phase, "top");
  assert.equal(climbPhaseAt(windows, 12.6)?.phase, "einde");
  assert.equal(climbPhaseAt(windows, 13.5)?.phase ?? null, null);
});

test("klimprofiel-uitsnede: alleen uit een echt hoogteprofiel, anders null", () => {
  const climb = {
    name: "Test",
    lengthKm: 2,
    avgGradePct: 5,
    summitKm: 6,
    startKm: 4,
  };
  assert.equal(climbProfileSlice(null, 10, climb), null);
  assert.equal(climbProfileSlice([10, 20], null, climb), null);
  const slice = climbProfileSlice([0, 10, 20, 30, 40, 50], 10, climb, 5);
  assert.ok(slice && slice.length === 5);
  // Stijgend stuk van het profiel → uitsnede stijgt mee.
  assert.ok(slice![4]! > slice![0]!);
});
