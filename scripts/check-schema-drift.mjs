#!/usr/bin/env node
// Schema-driftcontrole (drizzle push-model, dus geen migratiemap).
//
// Draait `drizzle-kit push --strict` met gesloten stdin: dat voert NIETS uit
// (de bevestigingsprompt faalt zonder TTY) en toont het volledige diff.
//
// Eerlijke uitzonderingen (alleen na verificatie tegen de live catalogus):
// 1. PostgreSQL kapt constraint-namen af op 63 tekens, terwijl drizzle
//    vergelijkt op de volledige naam. Voor lange namen ziet drizzle daardoor
//    eeuwig een DROP + ADD van dezelfde constraint. Zo'n paar is alleen een
//    no-op als de namen matchen, de tabel gelijk is ÉN de voorgestelde
//    FK-definitie identiek is aan wat er al staat (pg_get_constraintdef).
// 2. Voor array-kolommen vergelijkt drizzle default `'{}'` met de catalogus-
//    vorm `'{}'::text[]` en stelt het eeuwig hetzelfde default voor; alleen
//    no-op als de catalogus dat default aantoonbaar al heeft.
// Al het andere telt als echte drift.

import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function psql(query) {
  const q = spawnSync("psql", [process.env.DATABASE_URL ?? "", "-tAc", query], {
    encoding: "utf8",
    timeout: 30_000,
  });
  return (q.stdout ?? "").trim();
}

// FK-definities vergelijkbaar maken: quotes/schema weg, spaties samengevouwen,
// ON UPDATE/ON DELETE in canonieke volgorde, impliciete NO ACTION weg.
export function normaliseerFk(def) {
  let s = def
    .replace(/"/g, "")
    .replace(/\bpublic\./g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const acties = {};
  s = s.replace(
    /\son (update|delete) (cascade|restrict|set null|set default|no action)/g,
    (_m, kind, actie) => {
      acties[kind] = actie;
      return "";
    },
  );
  for (const kind of ["delete", "update"]) {
    const actie = acties[kind];
    if (actie && actie !== "no action") s += ` on ${kind} ${actie}`;
  }
  return s.trim();
}

// Pure classificatie: statements + opzoekfuncties → { echteDrift, noOps }.
// `opzoek.catalogusDefinitie(table, constraint)` → genormaliseerde definitie of "".
// `opzoek.defaultAlIngesteld(table, column)` → boolean.
export function classificeer(statements, opzoek) {
  const drops = new Map(); // afgekapte naam → { table, stmt }
  const adds = new Map(); // volledige naam → { table, def, stmt }
  const echteDrift = [];
  const noOps = [];

  for (const s of statements) {
    const drop = s.match(/^ALTER TABLE "([^"]+)" DROP CONSTRAINT "([^"]+)";?$/);
    const add = s.match(
      /^ALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)" (FOREIGN KEY .+?);?$/,
    );
    const arrDefault = s.match(
      /^ALTER TABLE "([^"]+)" ALTER COLUMN "([^"]+)" SET DEFAULT '\{\}';?$/,
    );
    if (drop) drops.set(drop[2], { table: drop[1], stmt: s });
    else if (add) adds.set(add[2], { table: add[1], def: add[3], stmt: s });
    else if (arrDefault && opzoek.defaultAlIngesteld(arrDefault[1], arrDefault[2])) {
      noOps.push(`no-op (array-default al ingesteld): ${s}`);
    } else echteDrift.push(s);
  }

  // Een drop/add-paar is alleen een no-op-lus als ALLES klopt:
  // (1) gedropte naam = exact de 63-tekens-afkapping van de toegevoegde naam,
  // (2) zelfde tabel, én (3) voorgestelde FK-definitie identiek aan de
  // catalogus. Anders: echte drift.
  const gepaardeAdds = new Set();
  let lusParen = 0;
  for (const [naam, d] of drops) {
    const kandidaat = [...adds.entries()].find(
      ([vol, a]) =>
        vol.length > 63 && vol.slice(0, 63) === naam && a.table === d.table,
    );
    if (!kandidaat) {
      echteDrift.push(d.stmt);
      continue;
    }
    const [vol, a] = kandidaat;
    const bestaand = opzoek.catalogusDefinitie(d.table, naam);
    if (bestaand && bestaand === normaliseerFk(a.def)) {
      gepaardeAdds.add(vol);
      lusParen++;
    } else {
      echteDrift.push(`${d.stmt} (definitie wijkt af van catalogus)`);
      echteDrift.push(a.stmt);
      gepaardeAdds.add(vol); // al gerapporteerd, niet dubbel melden
    }
  }
  // Toegevoegde constraints zonder geverifieerd lus-paar zijn óók drift.
  for (const [vol, a] of adds) {
    if (!gepaardeAdds.has(vol)) echteDrift.push(a.stmt);
  }
  return { echteDrift, noOps, lusParen };
}

function main() {
  const r = spawnSync(
    "bash",
    ["-lc", "pnpm exec drizzle-kit push --strict --verbose < /dev/null 2>&1"],
    { cwd: resolve(ROOT, "lib/db"), encoding: "utf8", timeout: 180_000 },
  );
  const out = r.stdout ?? "";

  if (/No changes detected/.test(out)) {
    console.log("Geen schema-drift.");
    process.exit(0);
  }

  const statements = out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^(ALTER|CREATE|DROP)\s/.test(l));

  const { echteDrift, noOps, lusParen } = classificeer(statements, {
    defaultAlIngesteld: (table, column) =>
      psql(
        `SELECT column_default FROM information_schema.columns WHERE table_name='${table}' AND column_name='${column}'`,
      ).replace(/::[a-z ]+\[\]$/, "") === "'{}'",
    catalogusDefinitie: (table, constraint) =>
      normaliseerFk(
        psql(
          `SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
           JOIN pg_class t ON t.oid = c.conrelid
           WHERE t.relname='${table}' AND c.conname='${constraint}'`,
        ),
      ),
  });

  for (const n of noOps) console.log(n);
  if (echteDrift.length === 0) {
    console.log(
      `Geen echte drift — alleen bekende no-op-lussen (${lusParen} constraint-paar/paren, catalogus-geverifieerd).`,
    );
    process.exit(0);
  }
  console.error("ECHTE SCHEMA-DRIFT gevonden:\n" + echteDrift.join("\n"));
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
