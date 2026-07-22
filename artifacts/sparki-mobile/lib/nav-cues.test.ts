// Tests voor de pure cue-engine (lib/nav-cues.ts): geluid/spraak-beslissingen
// tijdens navigatie. Vergrendelt de kernregels:
// - tussenwaypoints ("Aankomst" halverwege) klinken NOOIT — geen finish-toon
//   en geen gesproken bestemming, alleen de echte laatste stap;
// - elke afslag klinkt maximaal één keer per fase (vooraf/nu);
// - van-de-route klinkt één keer per episode en onderdrukt afslag-cues;
// - rechtdoor/vertrek/tussenstop blijven stil (nooit verzonnen instructies).
//
// Run: node ../../scripts/run-tsx-test.mjs --test lib/nav-cues.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  classifyManeuver,
  createCueState,
  decideCues,
  sanitizeNavSteps,
  speakDistance,
  thresholds,
  type NavStep,
} from "./nav-cues";

const ROUTE: NavStep[] = [
  { km: 0, dir: "depart", note: "Vertrek" },
  { km: 1.0, dir: "left", note: "Sla linksaf" },
  { km: 2.0, dir: "straight", note: "Rechtdoor" },
  { km: 3.0, dir: "sharp-right", note: "Scherp rechts" },
  { km: 4.0, dir: "arrive", note: "Aankomst" },
];

test("sanitize: tussen-aankomsten van waypoints verdwijnen, echte finish blijft", () => {
  const steps: NavStep[] = [
    { km: 0, dir: "depart" },
    { km: 1, dir: "left" },
    { km: 2, dir: "Aankomst", note: "waypoint" },
    { km: 3, dir: "right" },
    { km: 5, dir: "arrive", note: "einde" },
  ];
  const out = sanitizeNavSteps(steps);
  assert.deepEqual(
    out.map((s) => s.dir),
    ["depart", "left", "right", "arrive"],
  );
  assert.equal(out[out.length - 1].note, "einde");
});

test("classify: rechtdoor, vertrek en tussenstop zijn stil", () => {
  assert.equal(classifyManeuver("straight", false), null);
  assert.equal(classifyManeuver("depart", false), null);
  assert.equal(classifyManeuver("Tussenstop", false), null);
});

test("classify: aankomst klinkt alléén als laatste stap", () => {
  assert.equal(classifyManeuver("arrive", false), null);
  const last = classifyManeuver("arrive", true);
  assert.ok(last && last.sound === "arrive");
});

test("vooraf-cue klinkt één keer, daarna nu-cue één keer", () => {
  let state = createCueState();
  const { early, now } = thresholds(null);
  // Ver weg: niets.
  let r = decideCues(state, { steps: ROUTE, traveledKm: 0.2, speedMps: null, offRoute: false });
  assert.equal(r.cues.length, 0);
  // Binnen vooraf-venster van de linksaf op km 1.0.
  const travelEarly = 1.0 - (early - 10) / 1000;
  r = decideCues(r.state, { steps: ROUTE, traveledKm: travelEarly, speedMps: null, offRoute: false });
  assert.equal(r.cues.length, 1);
  assert.match(r.cues[0].speech ?? "", /^Over .* linksaf\.$/);
  // Zelfde positie nogmaals: geen herhaling.
  r = decideCues(r.state, { steps: ROUTE, traveledKm: travelEarly, speedMps: null, offRoute: false });
  assert.equal(r.cues.length, 0);
  // Vlak voor de afslag: nu-cue, precies één keer.
  const travelNow = 1.0 - (now - 5) / 1000;
  r = decideCues(r.state, { steps: ROUTE, traveledKm: travelNow, speedMps: null, offRoute: false });
  assert.equal(r.cues.length, 1);
  assert.equal(r.cues[0].speech, "Nu linksaf.");
  r = decideCues(r.state, { steps: ROUTE, traveledKm: travelNow, speedMps: null, offRoute: false });
  assert.equal(r.cues.length, 0);
});

test("gemiste vooraf wordt niet alsnog uitgesproken na de nu-cue", () => {
  let state = createCueState();
  const { now } = thresholds(null);
  // Meteen in het nu-venster (bijv. GPS-sprong): alleen de nu-cue.
  const travelNow = 1.0 - (now - 5) / 1000;
  let r = decideCues(state, { steps: ROUTE, traveledKm: travelNow, speedMps: null, offRoute: false });
  assert.equal(r.cues.length, 1);
  assert.equal(r.cues[0].key, "1:nu");
  // Iets verderop (afslag gepasseerd): stil.
  r = decideCues(r.state, { steps: ROUTE, traveledKm: 1.05, speedMps: null, offRoute: false });
  assert.equal(r.cues.length, 0);
});

test("van de route: één waarschuwing per episode, afslag-cues onderdrukt", () => {
  let state = createCueState();
  let r = decideCues(state, { steps: ROUTE, traveledKm: 0.9, speedMps: null, offRoute: true });
  assert.equal(r.cues.length, 1);
  assert.equal(r.cues[0].sound, "offroute");
  // Nog steeds van de route: stil.
  r = decideCues(r.state, { steps: ROUTE, traveledKm: 0.9, speedMps: null, offRoute: true });
  assert.equal(r.cues.length, 0);
  // Terug op de route en later opnieuw eraf: nieuwe episode, nieuwe waarschuwing.
  r = decideCues(r.state, { steps: ROUTE, traveledKm: 2.5, speedMps: null, offRoute: false });
  r = decideCues(r.state, { steps: ROUTE, traveledKm: 2.6, speedMps: null, offRoute: true });
  assert.equal(r.cues.length, 1);
  assert.equal(r.cues[0].sound, "offroute");
});

test("bestemmingsmelding alleen bij de echte laatste stap", () => {
  // Route met een (foutief niet-gesanitized) tussen-Aankomst: engine negeert hem.
  const dirty: NavStep[] = [
    { km: 0, dir: "depart" },
    { km: 1, dir: "Aankomst", note: "waypoint" },
    { km: 2, dir: "arrive", note: "einde" },
  ];
  let state = createCueState();
  const { now } = thresholds(null);
  // Vlak voor de tussen-aankomst: stil.
  let r = decideCues(state, { steps: dirty, traveledKm: 1.0 - (now - 5) / 1000, speedMps: null, offRoute: false });
  assert.equal(r.cues.length, 0);
  // Vlak voor de echte finish: aankomst-cue.
  r = decideCues(r.state, { steps: dirty, traveledKm: 2.0 - (now - 5) / 1000, speedMps: null, offRoute: false });
  assert.equal(r.cues.length, 1);
  assert.equal(r.cues[0].sound, "arrive");
  assert.equal(r.cues[0].speech, "Je bent bij je bestemming.");
});

test("drempels schalen met snelheid maar blijven begrensd", () => {
  const slow = thresholds(2); // 7,2 km/u
  const fast = thresholds(15); // 54 km/u
  assert.ok(slow.early >= 120 && slow.early <= 400);
  assert.ok(fast.early <= 400);
  assert.ok(slow.now >= 30 && fast.now <= 80);
  assert.ok(fast.early >= slow.early);
});

test("speakDistance rondt menselijk af", () => {
  assert.equal(speakDistance(52), "50 meter");
  assert.equal(speakDistance(180), "200 meter");
  assert.equal(speakDistance(430), "400 meter");
  assert.match(speakDistance(1200), /kilometer$/);
});
