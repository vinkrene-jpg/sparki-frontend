// Afkeurregel-bewijstest (aanscherping René 30-07-2026, taak #487):
// "Onbekend wegdek op de racefiets is niet-verifieerbaar en dus géén zachte
// tolerantie" — zolang een onbekend segment niet geverifieerd is, wordt de
// route NIET als geschikte racefietsroute aanbevolen; tonen mag alleen na
// expliciete keuze van de renner.
//
// Voert het tegenvoorbeeld uit SPARKI_PROMISE_CALIBRATION.yaml echt uit:
// een racefietslus met 12% onbekend wegdek (knownPct 88) mag zonder
// expliciete gebruikerskeuze nooit als "geschikte racefietsroute" gelden.
//
// Run: pnpm --filter @workspace/api-server run test:route-racefiets-verification

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeBikeSuitability,
  racefietsEngineVerification,
  type RouteSurfacesAnalysis,
} from "../lib/route-surfaces";
import { roadUnknownGatePenalty } from "../lib/routing/loop-quality";

function analysisWith(
  entries: { kind: RouteSurfacesAnalysis["breakdown"][number]["kind"]; pct: number }[],
): RouteSurfacesAnalysis {
  const totalKm = 47;
  return {
    totalKm,
    breakdown: entries.map((e) => ({
      kind: e.kind,
      pct: e.pct,
      km: Math.round(totalKm * e.pct) / 100,
      evidence: e.kind === "onbekend" ? null : "surface=asphalt",
    })),
    segments: [],
    forbiddenKm: 0,
    restrictedKm: 0,
    bgt: null,
  };
}

test("TEGENVOORBEELD YAML: 12% onbekend (knownPct 88) ⇒ nooit 'geschikt' zonder keuze", () => {
  const analysis = analysisWith([
    { kind: "asfalt", pct: 88 },
    { kind: "onbekend", pct: 12 },
  ]);
  const race = computeBikeSuitability(analysis, { maxSlopePct: null })
    .find((s) => s.bike === "racefiets")!;
  assert.notEqual(race.verdict, "goed", "12% onbekend mag nooit 'goed geschikt' zijn");
  assert.notEqual(race.verdict, "gedeeltelijk", "ook niet 'gedeeltelijk geschikt'");
  assert.equal(race.verdict, "niet_geverifieerd");
  assert.ok(
    race.reasons.some((r) => r.includes("12%") && r.includes("expliciete")),
    "reden noemt het onbekend-percentage én de vereiste expliciete keuze",
  );
});

test("0% onbekend ⇒ racefiets kan gewoon 'goed geschikt' zijn", () => {
  const analysis = analysisWith([{ kind: "asfalt", pct: 100 }]);
  const race = computeBikeSuitability(analysis, { maxSlopePct: null })
    .find((s) => s.bike === "racefiets")!;
  assert.equal(race.verdict, "goed");
});

test("aantoonbaar slechter (offroad) blijft de zwaardere afkeur", () => {
  const analysis = analysisWith([
    { kind: "asfalt", pct: 60 },
    { kind: "onverhard", pct: 28 },
    { kind: "onbekend", pct: 12 },
  ]);
  const race = computeBikeSuitability(analysis, { maxSlopePct: null })
    .find((s) => s.bike === "racefiets")!;
  assert.equal(race.verdict, "afgeraden");
});

test(">40% onbekend blijft eerlijk 'onvoldoende gegevens'", () => {
  const analysis = analysisWith([
    { kind: "asfalt", pct: 55 },
    { kind: "onbekend", pct: 45 },
  ]);
  const race = computeBikeSuitability(analysis, { maxSlopePct: null })
    .find((s) => s.bike === "racefiets")!;
  assert.equal(race.verdict, "onvoldoende_gegevens");
});

test("gravel/MTB behouden hun eigen oordeel — de gate is racefiets-specifiek", () => {
  const analysis = analysisWith([
    { kind: "asfalt", pct: 88 },
    { kind: "onbekend", pct: 12 },
  ]);
  const out = computeBikeSuitability(analysis, { maxSlopePct: null });
  assert.notEqual(out.find((s) => s.bike === "gravelbike")!.verdict, "niet_geverifieerd");
  assert.notEqual(out.find((s) => s.bike === "mountainbike")!.verdict, "niet_geverifieerd");
});

test("motor-verificatie: knownPct 88 ⇒ niet volledig geverifieerd (12% onbekend)", () => {
  assert.deepEqual(racefietsEngineVerification(88), {
    status: "niet_volledig_geverifieerd",
    onbekendPct: 12,
  });
  assert.deepEqual(racefietsEngineVerification(100), {
    status: "geverifieerd",
    onbekendPct: 0,
  });
  assert.deepEqual(racefietsEngineVerification(null), {
    status: "niet_gemeten",
    onbekendPct: null,
  });
});

test("selectie zoekt eerst een alternatief zonder onbekend wegdek (vaste straf)", () => {
  // Gemeten onbekend ⇒ vaste straf die de kwaliteitswensen verslaat.
  assert.ok(roadUnknownGatePenalty("cycling-road", 0.88) >= 4);
  // Volledig bekend ⇒ geen straf.
  assert.equal(roadUnknownGatePenalty("cycling-road", 1), 0);
  // Zonder meting nooit gokken.
  assert.equal(roadUnknownGatePenalty("cycling-road", null), 0);
  // Andere profielen krijgen de racefiets-gate nooit.
  assert.equal(roadUnknownGatePenalty("cycling-gravel", 0.5), 0);
});
