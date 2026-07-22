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

// 7. Array-default mét expliciete ::text[]-cast — zelfde lus, zelfde bewijsplicht.
check("array-default met ::text[]-cast: no-op alleen met catalogusbewijs", () => {
  const stmt = `ALTER TABLE "tabel_a" ALTER COLUMN "labels" SET DEFAULT '{}'::text[];`;
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

// 8. UNIQUE-churn: ADD + DROP van exact dezelfde naam, catalogus identiek → no-op.
check("unique-churn met identieke catalogusdefinitie is no-op", () => {
  const UNIEK_DEF = 'UNIQUE NULLS NOT DISTINCT("route_id","audience","target_clerk_id")';
  const CATALOGUS = normaliseerFk(
    "UNIQUE NULLS NOT DISTINCT (route_id, audience, target_clerk_id)",
  );
  const r = classificeer(
    [
      `ALTER TABLE "route_shares" ADD CONSTRAINT "route_shares_unique" ${UNIEK_DEF};`,
      `ALTER TABLE "route_shares" DROP CONSTRAINT "route_shares_unique";`,
    ],
    { catalogusDefinitie: () => CATALOGUS, defaultAlIngesteld: () => false },
  );
  assert.equal(r.echteDrift.length, 0);
  assert.equal(r.lusParen, 1);
});

// 9. UNIQUE-churn met AFWIJKENDE catalogusdefinitie → rood.
check("unique-churn met afwijkende definitie is echte drift", () => {
  const r = classificeer(
    [
      `ALTER TABLE "route_shares" ADD CONSTRAINT "route_shares_unique" UNIQUE NULLS NOT DISTINCT("route_id","audience");`,
      `ALTER TABLE "route_shares" DROP CONSTRAINT "route_shares_unique";`,
    ],
    {
      catalogusDefinitie: () =>
        normaliseerFk("UNIQUE NULLS NOT DISTINCT (route_id, audience, target_clerk_id)"),
      defaultAlIngesteld: () => false,
    },
  );
  assert.ok(r.echteDrift.length >= 2);
});

// 10. Gelijknamige constraints op TWEE tabellen: elk paar onafhankelijk
// beoordeeld — één catalogus-geverifieerde lus, één afwijkende → rood.
check("gelijknamige constraints op verschillende tabellen maskeren elkaar niet", () => {
  const DEF_A = "UNIQUE NULLS NOT DISTINCT(\"a\",\"b\")";
  const DEF_B = "UNIQUE NULLS NOT DISTINCT(\"x\",\"y\")";
  const r = classificeer(
    [
      `ALTER TABLE "tabel_a" ADD CONSTRAINT "zelfde_naam" ${DEF_A};`,
      `ALTER TABLE "tabel_a" DROP CONSTRAINT "zelfde_naam";`,
      `ALTER TABLE "tabel_b" ADD CONSTRAINT "zelfde_naam" ${DEF_B};`,
      `ALTER TABLE "tabel_b" DROP CONSTRAINT "zelfde_naam";`,
    ],
    {
      // Alleen tabel_a heeft de definitie al in de catalogus; tabel_b wijkt af.
      catalogusDefinitie: (table) =>
        table === "tabel_a"
          ? normaliseerFk("UNIQUE NULLS NOT DISTINCT (a, b)")
          : normaliseerFk("UNIQUE NULLS NOT DISTINCT (x, y, z)"),
      defaultAlIngesteld: () => false,
    },
  );
  assert.equal(r.lusParen, 1, "alleen het tabel_a-paar is een no-op");
  assert.ok(r.echteDrift.length >= 2, "het tabel_b-paar moet rood blijven");
});

// 11. Array-default met AFWIJKEND cast-type t.o.v. catalogus → rood.
check("array-default met afwijkend cast-type is echte drift", () => {
  const stmt = `ALTER TABLE "tabel_a" ALTER COLUMN "labels" SET DEFAULT '{}'::integer[];`;
  const r = classificeer([stmt], {
    catalogusDefinitie: () => "",
    // Simuleert main(): catalogus heeft '{}'::text[], voorstel cast ::integer[].
    defaultAlIngesteld: (_t, _c, cast) => (cast ? "'{}'::text[]" === `'{}'${cast}` : true),
  });
  assert.equal(r.echteDrift.length, 1, "cast-mismatch moet rood zijn");
});

console.log(`${n}/11 driftclassificatie-tests geslaagd.`);
