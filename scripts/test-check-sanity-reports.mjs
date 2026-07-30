#!/usr/bin/env node
// Zelftest voor scripts/check-sanity-reports.mjs (Poort 5b-validator).
// Draai met: node scripts/test-check-sanity-reports.mjs
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const dir = mkdtempSync(join(tmpdir(), "sanity5b-"));
const script = join(process.cwd(), "scripts", "check-sanity-reports.mjs");

function run(file) {
  try {
    execFileSync("node", [script, file], { encoding: "utf8" });
    return 0;
  } catch (e) {
    return e.status ?? 1;
  }
}

const VALID = `delivery: "Testoplevering"
date: "2026-07-30"
checked_by: "replit"
surfaces:
  - "routescherm doorlopen op mobiel formaat"
checks:
  dead_controls:
    cases:
      - case: "gravel-voorkeurschakelaar aan/uit veranderde het routeresultaat"
        result: "pass"
  context_nonsense:
    not_applicable: "geen contextafhankelijke opties in deze oplevering"
  placeholder_as_result:
    cases:
      - case: "wegdekregel toont eindwaarde, geen blijvende laadtekst"
        result: "pass"
verdict: "deliverable"
`;

const cases = [
  {
    name: "geldig rapport passeert",
    content: VALID,
    file: "SANITY_5B_2026-07-30_ok.yaml",
    expect: 0,
  },
  {
    name: "leeg surfaces-blok faalt (ook al staan er list-items onder checks)",
    content: VALID.replace('surfaces:\n  - "routescherm doorlopen op mobiel formaat"\n', "surfaces:\n"),
    file: "SANITY_5B_2026-07-30_leeg-surfaces.yaml",
    expect: 1,
  },
  {
    name: "surfaces geheel afwezig faalt",
    content: VALID.replace('surfaces:\n  - "routescherm doorlopen op mobiel formaat"\n', ""),
    file: "SANITY_5B_2026-07-30_geen-surfaces.yaml",
    expect: 1,
  },
  {
    name: "fail-check met verdict deliverable faalt",
    content: VALID.replace('result: "pass"\n  context_nonsense', 'result: "fail"\n  context_nonsense'),
    file: "SANITY_5B_2026-07-30_fail-deliverable.yaml",
    expect: 1,
  },
  {
    name: "ontbrekende categorie faalt",
    content: VALID.replace(/  context_nonsense:\n    not_applicable: .*\n/, ""),
    file: "SANITY_5B_2026-07-30_geen-categorie.yaml",
    expect: 1,
  },
  {
    name: "template-placeholdertekst faalt",
    content: VALID.replace("gravel-voorkeurschakelaar aan/uit veranderde het routeresultaat", "<welke control, hoe getest>"),
    file: "SANITY_5B_2026-07-30_placeholder.yaml",
    expect: 1,
  },
  {
    name: "gemengd blok (not_applicable + fail-case) met verdict deliverable faalt",
    content: VALID.replace(
      '  context_nonsense:\n    not_applicable: "geen contextafhankelijke opties in deze oplevering"\n',
      '  context_nonsense:\n    not_applicable: "geen contextafhankelijke opties in deze oplevering"\n    cases:\n      - case: "optie zonder betekenis in deze context getoond"\n        result: "fail"\n'
    ),
    file: "SANITY_5B_2026-07-30_gemengd-na-fail.yaml",
    expect: 1,
  },
  {
    name: "datum niet in bestandsnaam faalt",
    content: VALID,
    file: "SANITY_5B_2026-07-29_datum-mismatch.yaml",
    expect: 1,
  },
];

let failed = 0;
for (const c of cases) {
  const p = join(dir, c.file);
  writeFileSync(p, c.content);
  const code = run(p);
  const ok = code === c.expect;
  console.log(`${ok ? "OK  " : "FOUT"} ${c.name} (exit ${code}, verwacht ${c.expect})`);
  if (!ok) failed++;
}
rmSync(dir, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
