#!/usr/bin/env node
// Regressietests voor de driftclassificatie (synthetische gevallen, geen DB).
import { classificeer, normaliseerFk } from "./check-schema-drift.mjs";
import assert from "node:assert/strict";

const LANG =
  "een_hele_lange_constraintnaam_die_ruim_voorbij_de_drieenzestig_tekens_gaat_fk"; // >63
const KORT63 = LANG.slice(0, 63);
const FK_DEF =
  'FOREIGN KEY ("kolom_id") REFERENCES "public"."doel_tabel"("id") ON DELETE cascade ON UPDATE no action';
const FK_CATALOGUS = normaliseerFk(
  "FOREIGN KEY (kolom_id) REFERENCES doel_tabel(id) ON DELETE CASCADE",
);

let n = 0;
function check(naam, fn) {
  fn();
  console.log(`[PASS] ${naam}`);
  n++;
}

// 1. Pure afkappingslus (zelfde tabel, identieke definitie) → groen.
check("truncatielus met identieke definitie is no-op", () => {
  const r = classificeer(
    [
      `ALTER TABLE "tabel_a" DROP CONSTRAINT "${KORT63}";`,
      `ALTER TABLE "tabel_a" ADD CONSTRAINT "${LANG}" ${FK_DEF};`,
    ],
    {
      catalogusDefinitie: () => FK_CATALOGUS,
      defaultAlIngesteld: () => false,
    },
  );
  assert.equal(r.echteDrift.length, 0);
  assert.equal(r.lusParen, 1);
});

// 2. Zelfde naamprefix maar ANDERE FK-definitie (bv. ON DELETE gewijzigd) → rood.
check("gelijk prefix met afwijkende definitie is echte drift", () => {
  const r = classificeer(
    [
      `ALTER TABLE "tabel_a" DROP CONSTRAINT "${KORT63}";`,
      `ALTER TABLE "tabel_a" ADD CONSTRAINT "${LANG}" ${FK_DEF};`,
    ],
    {
      catalogusDefinitie: () =>
        normaliseerFk("FOREIGN KEY (kolom_id) REFERENCES doel_tabel(id) ON DELETE SET NULL"),
      defaultAlIngesteld: () => false,
    },
  );
  assert.ok(r.echteDrift.length >= 2, "afwijkende definitie moet rood zijn");
});

// 3. Zelfde prefix maar ANDERE tabel → rood (geen paar).
check("gelijk prefix op andere tabel is echte drift", () => {
  const r = classificeer(
    [
      `ALTER TABLE "tabel_a" DROP CONSTRAINT "${KORT63}";`,
      `ALTER TABLE "tabel_b" ADD CONSTRAINT "${LANG}" ${FK_DEF};`,
    ],
    {
      catalogusDefinitie: () => FK_CATALOGUS,
      defaultAlIngesteld: () => false,
    },
  );
  assert.equal(r.echteDrift.length, 2);
});

// 4. Constraint bestaat niet in catalogus (lege definitie) → rood.
check("onbekende constraint in catalogus is echte drift", () => {
  const r = classificeer(
    [
      `ALTER TABLE "tabel_a" DROP CONSTRAINT "${KORT63}";`,
      `ALTER TABLE "tabel_a" ADD CONSTRAINT "${LANG}" ${FK_DEF};`,
    ],
    { catalogusDefinitie: () => "", defaultAlIngesteld: () => false },
  );
  assert.ok(r.echteDrift.length >= 2);
});

// 5. Array-default alleen no-op na catalogusbevestiging.
check("array-default: no-op alleen met catalogusbewijs", () => {
  const stmt = `ALTER TABLE "tabel_a" ALTER COLUMN "labels" SET DEFAULT '{}';`;
  const ja = classificeer([stmt], {
    catalogusDefinitie: () => "",
    defaultAlIngesteld: () => true,
  });
  assert.equal(ja.echteDrift.length, 0);
  const nee = classificeer([stmt], {
    catalogusDefinitie: () => "",
    defaultAlIngesteld: () => false,
  });
  assert.equal(nee.echteDrift.length, 1);
});

// 6. Elk ander statement (kolom toevoegen, tabel maken) → altijd rood.
check("overige statements zijn altijd echte drift", () => {
  const r = classificeer(
    [
      `ALTER TABLE "tabel_a" ADD COLUMN "nieuw" text;`,
      `CREATE TABLE "nieuwe_tabel" ("id" serial);`,
    ],
    { catalogusDefinitie: () => "", defaultAlIngesteld: () => true },
  );
  assert.equal(r.echteDrift.length, 2);
});

console.log(`${n}/6 driftclassificatie-tests geslaagd.`);
