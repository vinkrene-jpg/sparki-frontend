// DOELEN_01 — bewijs voor F1/F5: de leeftijdsmatrix is serverzijdig hard.
// Pure unit-tests op de policy-poort die ALLE schrijfpaden (sporter-create,
// sporter-update, trainervoorstel, acceptatie, vertaling) gebruiken.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bandForAge,
  validateGoalForBand,
  isWeightRelatedGoalText,
  policyPayload,
} from "../lib/goal-policy";
import { nearestMeasurableFallback } from "../lib/goal-translate";

test("DOE-12: band uit leeftijd; onbekend = meest beschermend", () => {
  assert.equal(bandForAge(null), "under14");
  assert.equal(bandForAge(9), "under14");
  assert.equal(bandForAge(13), "under14");
  assert.equal(bandForAge(14), "14-16");
  assert.equal(bandForAge(15), "14-16");
  assert.equal(bandForAge(16), "16-18");
  assert.equal(bandForAge(17), "16-18");
  assert.equal(bandForAge(18), "18+");
  assert.equal(bandForAge(45), "18+");
});

test("DOE-13/14: onder 14 alleen schuifbalkdoelen, zonder enige meetwaarde", () => {
  // Gewone doelsoorten zijn onmogelijk.
  for (const kind of ["event", "prestatie", "gedrag"]) {
    const r = validateGoalForBand("under14", { kind, title: "Doel" });
    assert.equal(r.ok, false);
  }
  // Schuifbalk met thema werkt.
  const ok = validateGoalForBand("under14", {
    kind: "slider",
    title: "Beter klimmen",
    theme: "beter_klimmen",
    themeLevel: 70,
  });
  assert.equal(ok.ok, true);
  // Meetwaarde of getal in de titel is geblokkeerd.
  const withMeasure = validateGoalForBand("under14", {
    kind: "slider",
    title: "Beter klimmen",
    theme: "beter_klimmen",
    themeLevel: 70,
    measure: "250 W",
  });
  assert.equal(withMeasure.ok, false);
  const withNumber = validateGoalForBand("under14", {
    kind: "slider",
    title: "300 watt halen",
    theme: "plezier",
    themeLevel: 50,
  });
  assert.equal(withNumber.ok, false);
  // Zonder thema geen doel.
  const noTheme = validateGoalForBand("under14", { kind: "slider", title: "X", themeLevel: 50 });
  assert.equal(noTheme.ok, false);
});

test("DOE-15: w/kg, gewicht en 1RM geblokkeerd tot 18 — herkenning", () => {
  assert.equal(isWeightRelatedGoalText("5,2 w/kg halen"), true);
  assert.equal(isWeightRelatedGoalText("naar 4 watt per kilo"), true);
  assert.equal(isWeightRelatedGoalText("5 kilo afvallen"), true);
  assert.equal(isWeightRelatedGoalText("gewicht naar 62 kg"), true);
  assert.equal(isWeightRelatedGoalText("1RM squat verhogen"), true);
  assert.equal(isWeightRelatedGoalText(null, "FTP naar 300 W"), false);
  assert.equal(isWeightRelatedGoalText("PR op de Kemmelberg"), false);
});

test("DOE-15/16: bandvalidatie blokkeert gewichtsdoelen in 14-16 en 16-18, niet 18+", () => {
  const wkg = { kind: "prestatie", title: "Naar 4,5 w/kg", measure: "w/kg" };
  assert.equal(validateGoalForBand("14-16", wkg).ok, false);
  assert.equal(validateGoalForBand("16-18", wkg).ok, false);
  assert.equal(validateGoalForBand("18+", wkg).ok, true);
  // Absoluut vermogen mag wél vanaf 14 (DOE-12 matrix).
  const ftp = { kind: "prestatie", title: "FTP omhoog", measure: "FTP", targetValue: "280 W" };
  assert.equal(validateGoalForBand("14-16", ftp).ok, true);
  assert.equal(validateGoalForBand("16-18", ftp).ok, true);
});

test("DOE-46: policy-payload geeft alleen toegestane soorten/thema's terug", () => {
  const jong = policyPayload("under14");
  assert.equal(jong.form, "slider");
  assert.equal(jong.kinds.length, 0);
  assert.ok(jong.themes.length >= 4);
  const midden = policyPayload("14-16");
  assert.equal(midden.form, "regular");
  assert.deepEqual(
    midden.kinds.map((k) => k.key).sort(),
    ["event", "gedrag", "prestatie"],
  );
  assert.equal(midden.blockWeightRelated, true);
  const volwassen = policyPayload("18+");
  assert.equal(volwassen.blockWeightRelated, false);
});

test("DOE-20: terugvalvoorstel is altijd een geldig gedragsdoel zonder verzonnen getallen", () => {
  const fb = nearestMeasurableFallback("ik wil de Tour winnen");
  assert.equal(fb.kind, "gedrag");
  assert.equal(fb.targetValue, null);
  const check = validateGoalForBand("14-16", fb);
  assert.equal(check.ok, true);
});
