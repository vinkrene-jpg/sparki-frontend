#!/usr/bin/env node
// Poort 5b — validatie van sanity-check-rapporten in docs/PRODUCT_PROMISES/sanity-checks/.
// Zie docs/PRODUCT_PROMISES/POORT_5B_SANITY_CHECK.md voor het bindende format.
//
// Gebruik:
//   node scripts/check-sanity-reports.mjs             # valideer alle rapporten
//   node scripts/check-sanity-reports.mjs <pad.yaml>  # valideer één rapport
//
// Exitcode 0 = alle rapporten geldig; 1 = format- of verdictfout (fail-closed).

import { readFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";

const DIR = join(process.cwd(), "docs", "PRODUCT_PROMISES", "sanity-checks");
const CATEGORIES = ["dead_controls", "context_nonsense", "placeholder_as_result"];
const NAME_RE = /^SANITY_5B_\d{4}-\d{2}-\d{2}_[a-z0-9-]+\.yaml$/;

// Minimale YAML-lezer voor dit vaste format (geen dependency nodig): we controleren
// aanwezigheid en inhoud van de verplichte velden regelgewijs.
function validate(path) {
  const errors = [];
  const name = basename(path);
  if (name !== "TEMPLATE.yaml" && !NAME_RE.test(name)) {
    errors.push(`bestandsnaam voldoet niet aan SANITY_5B_<JJJJ-MM-DD>_<slug>.yaml: ${name}`);
  }
  const text = readFileSync(path, "utf8");
  const lines = text.split("\n");

  const requireField = (re, label) => {
    const m = text.match(re);
    if (!m) errors.push(`verplicht veld ontbreekt of is leeg: ${label}`);
    return m ? m[1] : null;
  };

  requireField(/^delivery:\s*["']?(.+?)["']?\s*$/m, "delivery");
  const date = requireField(/^date:\s*["']?(\d{4}-\d{2}-\d{2})["']?\s*$/m, "date (JJJJ-MM-DD)");
  requireField(/^checked_by:\s*["']?(.+?)["']?\s*$/m, "checked_by");
  // surfaces: block-aware — tel alleen list-items BINNEN het surfaces-blok.
  const sStart = lines.findIndex((l) => /^surfaces:\s*$/.test(l));
  if (sStart === -1) {
    errors.push("surfaces ontbreekt");
  } else {
    let count = 0;
    for (let i = sStart + 1; i < lines.length; i++) {
      const l = lines[i];
      if (l.trim() === "" || l.trim().startsWith("#")) continue;
      if (!/^\s/.test(l)) break; // volgend top-level veld
      if (/^\s+-\s+["']?\S/.test(l)) count++;
    }
    if (count === 0) errors.push("surfaces bevat geen enkele doorlopen flow");
  }
  if (name !== "TEMPLATE.yaml" && date && !name.includes(date)) {
    errors.push(`date (${date}) staat niet in de bestandsnaam`);
  }

  // Per categorie: minimaal één case met result pass/fail, of not_applicable met reden.
  let anyFail = false;
  for (const cat of CATEGORIES) {
    const start = lines.findIndex((l) => l.trim() === `${cat}:`);
    if (start === -1) {
      errors.push(`categorie ontbreekt: checks.${cat}`);
      continue;
    }
    // blok = tot volgende regel met gelijk-of-lagere indent die geen comment/leeg is
    const indent = lines[start].match(/^\s*/)[0].length;
    let block = [];
    for (let i = start + 1; i < lines.length; i++) {
      const l = lines[i];
      if (l.trim() === "" || l.trim().startsWith("#")) { block.push(l); continue; }
      const li = l.match(/^\s*/)[0].length;
      if (li <= indent) break;
      block.push(l);
    }
    const blockText = block.join("\n");
    const na = blockText.match(/not_applicable:\s*["']?(.+?)["']?\s*$/m);
    const cases = [...blockText.matchAll(/-\s+case:\s*["']?(.+?)["']?\s*$/gm)];
    const results = [...blockText.matchAll(/result:\s*["']?(pass|fail)\b/gm)];
    // Fail-state ALTIJD meetellen, ook naast not_applicable — een fail mag nooit
    // wegvallen door een gemengd blok.
    if (results.some((r) => r[1] === "fail")) anyFail = true;
    if (na) {
      if (na[1].trim().length < 10) {
        errors.push(`checks.${cat}: not_applicable vereist een expliciete reden`);
      }
      if (cases.length > 0 || results.length > 0) {
        errors.push(`checks.${cat}: not_applicable en cases sluiten elkaar uit — kies één van beide`);
      }
      continue;
    }
    if (cases.length === 0) {
      errors.push(`checks.${cat}: minimaal één concreet gecontroleerd geval vereist (of not_applicable met reden)`);
    }
    if (results.length < cases.length) {
      errors.push(`checks.${cat}: elk geval moet een result (pass|fail) hebben`);
    }
    if (cases.some((c) => c[1].trim().startsWith("<"))) {
      errors.push(`checks.${cat}: template-placeholdertekst niet ingevuld`);
    }
  }

  const verdict = text.match(/^verdict:\s*["']?(deliverable|blocked)["']?\s*$/m);
  if (!verdict) {
    errors.push("verdict ontbreekt of is niet deliverable|blocked");
  } else if (anyFail && verdict[1] === "deliverable") {
    errors.push("verdict is 'deliverable' terwijl minstens één check 'fail' is — een fail blokkeert de oplevering");
  }

  return errors;
}

const args = process.argv.slice(2);
let files;
if (args.length > 0) {
  files = args;
} else {
  files = readdirSync(DIR)
    .filter((f) => f.endsWith(".yaml") && f !== "TEMPLATE.yaml")
    .map((f) => join(DIR, f));
}

let failed = false;
if (files.length === 0) {
  console.log("Poort 5b: geen rapporten aanwezig (nog geen oplevering geregistreerd) — format-check overgeslagen.");
}
for (const f of files) {
  const errs = validate(f);
  if (errs.length) {
    failed = true;
    console.error(`FOUT ${basename(f)}:`);
    for (const e of errs) console.error(`  - ${e}`);
  } else {
    console.log(`OK   ${basename(f)}`);
  }
}
process.exit(failed ? 1 : 0);
