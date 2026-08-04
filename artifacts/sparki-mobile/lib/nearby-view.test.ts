import assert from "node:assert/strict";
import { test } from "node:test";

import { nearbyTellerTekst, ontdekKaartCenter } from "./nearby-view";

test("gezochte plaats werkt ook ZONDER fysieke GPS-positie", () => {
  const center = ontdekKaartCenter({ lat: 51.16, lon: 4.99 }, null);
  assert.deepEqual(center, { latitude: 51.16, longitude: 4.99 });
});

test("gezochte plaats wint van een afwijkende GPS-positie", () => {
  const center = ontdekKaartCenter(
    { lat: 51.16, lon: 4.99 },
    { latitude: 52.37, longitude: 4.9 },
  );
  assert.deepEqual(center, { latitude: 51.16, longitude: 4.99 });
});

test("zonder plaats valt het centrum terug op GPS; zonder beide is er eerlijk niets", () => {
  assert.deepEqual(ontdekKaartCenter(null, { latitude: 52.37, longitude: 4.9 }), {
    latitude: 52.37,
    longitude: 4.9,
  });
  assert.equal(ontdekKaartCenter(null, null), null);
});

test("teller meldt afkappen eerlijk in plaats van het subset als compleet te tonen", () => {
  assert.equal(nearbyTellerTekst(12, "fietsroutes"), "12 fietsroutes");
  assert.equal(
    nearbyTellerTekst(12, "fietsroutes", { total: 320, afgekapt: false }),
    "12 fietsroutes",
  );
  assert.equal(
    nearbyTellerTekst(250, "fietsroutes", { total: 320, afgekapt: true }),
    "250 van minstens 320 fietsroutes (dichtstbijzijnde eerst)",
  );
});
