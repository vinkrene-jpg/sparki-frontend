// Regressietest wedstrijdgrendel volgauto (bugmelding René 30-07-2026):
// een OUD enabled volgautoplan op een gewone trainings-/toertochtroute mag
// nooit meer een rolkeuze veroorzaken. De grendel zit vóór het ophalen:
// useVolgautoPlan krijgt op zulke routes GEEN route-id (null), dus het plan
// wordt nooit opgehaald en de rolkeuze verschijnt niet. Alleen expliciet als
// wedstrijd gemarkeerde routes krijgen de route-id wél.
//
// Run: pnpm --filter @workspace/sparki-mobile run test:volgauto-gate

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  volgautoPlanRouteId,
  volgautoRolkeuzeZichtbaar,
} from "./volgauto-api";

// Een oud plan zoals dat nog in de database kan staan: enabled=true.
const oudEnabledPlan = { enabled: true };

test("gewone trainingsroute met oud enabled plan: useVolgautoPlan krijgt geen route-id", () => {
  assert.equal(volgautoPlanRouteId(12, "training"), null);
});

test("toertocht met oud enabled plan: useVolgautoPlan krijgt geen route-id", () => {
  assert.equal(volgautoPlanRouteId(12, "toertocht"), null);
  // Ook ontbrekende/onbekende usageType blijft dicht (fail-closed).
  assert.equal(volgautoPlanRouteId(12, null), null);
  assert.equal(volgautoPlanRouteId(12, undefined), null);
  assert.equal(volgautoPlanRouteId(Number.NaN, "wedstrijd"), null);
});

test("zonder route-id wordt het plan nooit opgehaald — rolkeuze verschijnt niet", () => {
  // De hook staat uit (routeId null) ⇒ data blijft undefined; met undefined
  // plan is de rolkeuze onzichtbaar, óók zolang er nog geen rol gekozen is.
  assert.equal(volgautoRolkeuzeZichtbaar(undefined, null), false);
  assert.equal(volgautoRolkeuzeZichtbaar(null, null), false);
  // Sanity: bij een écht opgehaald enabled plan zonder rol verschijnt hij wél,
  // en na een rolkeuze weer niet.
  assert.equal(volgautoRolkeuzeZichtbaar(oudEnabledPlan, null), true);
  assert.equal(volgautoRolkeuzeZichtbaar(oudEnabledPlan, "renner"), false);
  assert.equal(volgautoRolkeuzeZichtbaar({ enabled: false }, null), false);
});

test("wedstrijdroute krijgt de route-id wél", () => {
  assert.equal(volgautoPlanRouteId(12, "wedstrijd"), 12);
});

test("navigatiescherm gebruikt de grendel en de rolkeuze-gate echt", () => {
  // Bedradingscontrole: het scherm mag de grendel niet omzeilen door weer een
  // eigen inline expressie te gebruiken.
  const src = readFileSync(
    join(__dirname, "..", "app", "(app)", "navigate", "[id].tsx"),
    "utf8",
  );
  assert.match(
    src,
    /useVolgautoPlan\(\s*volgautoPlanRouteId\(routeId, route\?\.usageType\)/,
    "useVolgautoPlan moet zijn route-id via volgautoPlanRouteId krijgen",
  );
  assert.match(
    src,
    /volgautoRolkeuzeZichtbaar\(volgautoPlan, volgautoRole\)/,
    "de rolkeuze moet via volgautoRolkeuzeZichtbaar gegate zijn",
  );
});
