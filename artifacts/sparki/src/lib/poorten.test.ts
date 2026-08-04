// MEETNIVEAU_EN_UITLEG_01 §4+§8 — bewijstest twee gescheiden poorten.
//
// T1: pakket ok + sensoren ok ⇒ geen enkele melding.
// T2: pakket ok + sensor ontbreekt ⇒ DATAMELDING, nooit het woord "upgraden".
// T3: pakket ontbreekt + volledige sensorset ⇒ PAKKETMELDING, nooit
//     "koppel een band"/sensortaal.
// Plus: pakket gaat vóór data (nooit twee meldingen tegelijk) en onbekende
// antwoorden blokkeren nooit (fail-open UI).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bepaalPoort,
  pakketMelding,
  dataMelding,
  type SensorSoort,
} from "./poorten";

test("T1: pakket ok én data ok ⇒ poort open, geen melding", () => {
  assert.equal(
    bepaalPoort({ pakketOk: true, pakketBekend: true, dataOk: true, dataBekend: true }),
    "open",
  );
});

test("T2: pakket ok, sensor ontbreekt ⇒ datapoort (nooit pakket)", () => {
  assert.equal(
    bepaalPoort({ pakketOk: true, pakketBekend: true, dataOk: false, dataBekend: true }),
    "data",
  );
});

test("T3: pakket ontbreekt, volledige sensorset ⇒ pakketpoort (nooit data)", () => {
  assert.equal(
    bepaalPoort({ pakketOk: false, pakketBekend: true, dataOk: true, dataBekend: true }),
    "pakket",
  );
});

test("beide problemen tegelijk ⇒ precies één poort (pakket eerst)", () => {
  assert.equal(
    bepaalPoort({ pakketOk: false, pakketBekend: true, dataOk: false, dataBekend: true }),
    "pakket",
  );
});

test("onbekende antwoorden blokkeren nooit (fail-open UI)", () => {
  assert.equal(
    bepaalPoort({ pakketOk: false, pakketBekend: false, dataOk: false, dataBekend: false }),
    "open",
  );
});

test("datamelding bevat nooit pakkettaal ('upgraden', pakketnamen)", () => {
  for (const sensor of ["vermogensmeter", "hartslagband", "draagbare"] as SensorSoort[]) {
    const m = dataMelding(sensor);
    const tekst = `${m.titel} ${m.body}`.toLowerCase();
    assert.ok(!tekst.includes("upgrad"), `datamelding (${sensor}) bevat 'upgraden'`);
    assert.ok(!tekst.includes("pakket"), `datamelding (${sensor}) bevat 'pakket'`);
    assert.ok(!tekst.includes("compleet"), `datamelding (${sensor}) bevat pakketnaam`);
    assert.ok(!tekst.includes("abonnement"), `datamelding (${sensor}) bevat 'abonnement'`);
  }
});

test("pakketmelding bevat nooit sensortaal ('koppel een band', sensoren)", () => {
  const m = pakketMelding("De diepe belastingsanalyse");
  const tekst = `${m.titel} ${m.body} ${m.actieLabel}`.toLowerCase();
  for (const verboden of ["band", "sensor", "koppel", "vermogensmeter", "horloge", "ring"]) {
    assert.ok(!tekst.includes(verboden), `pakketmelding bevat sensortaal: '${verboden}'`);
  }
  // Pakketmelding benoemt wél het pad naar upgraden.
  assert.ok(tekst.includes("upgrad"), "pakketmelding mist het pad naar upgraden");
  assert.ok(m.actieHref.length > 0, "pakketmelding mist een actie");
});

test("meldingen zijn nooit identiek (poorten lopen niet door elkaar)", () => {
  const p = pakketMelding("X");
  for (const sensor of ["vermogensmeter", "hartslagband", "draagbare"] as SensorSoort[]) {
    const d = dataMelding(sensor);
    assert.notEqual(p.titel, d.titel);
    assert.notEqual(p.body, d.body);
  }
});
