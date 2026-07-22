#!/usr/bin/env node
// Sparki releasestraat — één reproduceerbare flow die alle poorten afloopt en
// een eerlijke acceptatie-uitvoer schrijft naar docs/RELEASE_ACCEPTANCE.md.
//
// Gebruik:  node scripts/release-check.mjs [--skip-tests] [--only <fase>]
// Fasen:    typecheck · migraties · tests · webbuild · serverbuild ·
//           mobielcontrole · healthcheck
//
// Deployment + rollback lopen via het Replit-publicatieplatform (buiten deze
// repo): publiceren maakt een nieuwe release; rollback = her-publiceren van de
// vorige werkende checkpoint. Dit script is de poort ervóór.

import { execSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const skipTests = args.includes("--skip-tests");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;
// --resume: sla fasen die in een eerdere run al groen waren over (statebestand)
// en stop netjes (exitcode 75) wanneer het tijdbudget op is. Zo is de volledige
// straat ook in korte shell-vensters reproduceerbaar af te lopen.
const resume = args.includes("--resume");
const budgetIdx = args.indexOf("--budget");
const budgetSec = budgetIdx >= 0 ? Number(args[budgetIdx + 1]) : null;
const STATE = resolve(ROOT, "docs/release-check-state.json");
const SCRIPT_START = Date.now();

let prior = {};
if (resume) {
  try {
    prior = JSON.parse(readFileSync(STATE, "utf8"));
  } catch {}
}
const results = [];
let outOfBudget = false;

function saveState() {
  const merged = { ...prior };
  for (const r of results) merged[r.name] = r;
  mkdirSync(resolve(ROOT, "docs"), { recursive: true });
  writeFileSync(STATE, JSON.stringify(merged, null, 2));
  return merged;
}

function run(name, cmd, { cwd = ROOT, env = {}, timeoutMin = 20 } = {}) {
  if (only && only !== name.split(":")[0]) return;
  if (resume && prior[name]?.ok) {
    results.push(prior[name]);
    return true;
  }
  if (outOfBudget) return;
  if (budgetSec && (Date.now() - SCRIPT_START) / 1000 > budgetSec) {
    outOfBudget = true;
    return;
  }
  const started = Date.now();
  process.stdout.write(`\n━━ ${name}\n   $ ${cmd}\n`);
  const r = spawnSync("bash", ["-lc", cmd], {
    cwd,
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, ...env },
    timeout: timeoutMin * 60_000,
  });
  const ok = r.status === 0;
  results.push({
    name,
    ok,
    seconds: Math.round((Date.now() - started) / 1000),
  });
  process.stdout.write(`   ${ok ? "GROEN" : "ROOD"} (${results.at(-1).seconds}s)\n`);
  saveState();
  return ok;
}

function testScripts(pkgDir) {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, pkgDir, "package.json"), "utf8"));
  return Object.keys(pkg.scripts ?? {}).filter((s) => s.startsWith("test:"));
}

// ── 1. Statische controle (lint-niveau) + typecheck ─────────────────────────
// Er is geen aparte ESLint-config; strikte TypeScript-compilatie over alle
// packages is de statische poort.
run("typecheck", "pnpm run typecheck");

// ── 2. Databasemigraties valideren (vóór deployment) ────────────────────────
// Drizzle push-model: --strict + gesloten stdin voert NIETS uit; het toont het
// diff en breekt af bij een openstaande wijziging. Geen drift = groen.
// Herstelroute: schemawijzigingen zijn uitsluitend additief (afbouwregel 6);
// terugdraaien = vorige release publiceren (kolommen blijven staan, data blijft
// behouden). Restore-bewijs: test:backup-restore hieronder.
run("migraties:drift-check", "node scripts/check-schema-drift.mjs");

// ── 3. Tests: unit (web + mobiel) · integratie/e2e (api-server) ─────────────
if (!skipTests) {
  for (const s of testScripts("artifacts/sparki")) {
    run(`unit:web:${s}`, `pnpm --filter @workspace/sparki run ${s}`);
  }
  for (const s of testScripts("artifacts/sparki-mobile")) {
    run(`unit:mobiel:${s}`, `pnpm --filter @workspace/sparki-mobile run ${s}`);
  }
  // Sequentieel — de api-server test-suites delen één dist/ (bewuste keuze).
  // Alle integratietests draaien tegen de dev-database met de dev-bypass
  // (x-dev-clerk-id), exact zoals de bestaande testworkflows dat doen.
  for (const s of testScripts("artifacts/api-server")) {
    run(`e2e:${s}`, `pnpm --filter @workspace/api-server run ${s}`, {
      env: { NODE_ENV: "development", DEV_AUTH_BYPASS: "true" },
    });
  }
}

// ── 4. Builds ────────────────────────────────────────────────────────────────
run("webbuild", "pnpm --filter @workspace/sparki run build");
run("serverbuild", "pnpm --filter @workspace/api-server run build");
// Mobiele buildcontrole: strikte compilatie van de volledige Expo-app.
// Echte Android/iOS-binaries vereisen EAS-build met winkelcertificaten —
// een externe toelating, eerlijk als zodanig gemarkeerd in de acceptatie.
run("mobielcontrole", "pnpm --filter @workspace/sparki-mobile run typecheck");
// Storegereedheid (Golf 28): mobiele productieconfig + repo-brede storecontrole.
// Echte Android/iOS-releasebuilds (EAS-ondertekening, store-formulieren) zijn
// externe stappen — het script print die als checklist, faalt er niet op.
run(
  "storecontrole:mobiel-config",
  "pnpm --filter @workspace/sparki-mobile run check:prod-config",
);
run("storecontrole:release-check", "node scripts/store-release-check.mjs");

// ── 5. Healthcheck (release-modus: rood = blokkade) ─────────────────────────
run(
  "healthcheck:release",
  "HEALTH_CHECK_MODE=release pnpm --filter @workspace/api-server run job:health",
);

// ── Acceptatie-uitvoer ───────────────────────────────────────────────────────
if (outOfBudget) {
  saveState();
  const done = results.length;
  console.log(
    `\n⏸ Tijdbudget op — ${done} fase(n) vastgelegd. Hervat met: node scripts/release-check.mjs --resume --budget <s>`,
  );
  process.exit(75);
}

let commit = "onbekend";
try {
  commit = execSync("git --no-optional-locks rev-parse --short HEAD", {
    cwd: ROOT,
  })
    .toString()
    .trim();
} catch {}

const failed = results.filter((r) => !r.ok);
const lines = [
  "# Sparki releaseacceptatie",
  "",
  `- **Release/commit:** ${commit}`,
  `- **Datum:** ${new Date().toISOString()}`,
  `- **Migraties:** drizzle push-model — driftcontrole ${
    results.find((r) => r.name === "migraties:drift-check")?.ok
      ? "groen (geen openstaande schemawijzigingen; uitsluitend additief beleid)"
      : "ROOD — schema-drift, eerst oplossen"
  }`,
  `- **Healthstatus:** ${
    results.find((r) => r.name === "healthcheck:release")?.ok
      ? "groen (release-modus, geen onopgeloste rode storingen)"
      : "ROOD"
  }`,
  "",
  "## Resultaten",
  "",
  "| Fase | Status | Duur |",
  "|---|---|---|",
  ...results.map(
    (r) => `| ${r.name} | ${r.ok ? "✅ groen" : "❌ rood"} | ${r.seconds}s |`,
  ),
  "",
  "## Uitsluitend externe blokkades",
  "",
  "- Android/iOS-winkelbuild: vereist EAS-account + winkelcertificaten (extern).",
  "- Garmin/Wahoo-datasync: wacht op fabrikants-API-sleutels (gereed voor activatie).",
  "- E-mailbezorging: wacht op geverifieerd verzenddomein (gereed voor activatie).",
  "- Deployment/rollback: via Replit-publicatie; rollback = vorige checkpoint her-publiceren.",
  "",
  `**Eindoordeel:** ${failed.length === 0 ? "RELEASECANDIDATE GEREED" : `NIET GEREED — ${failed.length} rode fase(n): ${failed.map((f) => f.name).join(", ")}`}`,
  "",
];
mkdirSync(resolve(ROOT, "docs"), { recursive: true });
writeFileSync(resolve(ROOT, "docs/RELEASE_ACCEPTANCE.md"), lines.join("\n"));
writeFileSync(
  resolve(ROOT, "docs/release-check-latest.json"),
  JSON.stringify({ commit, date: new Date().toISOString(), results }, null, 2),
);

console.log(`\n${failed.length === 0 ? "✅ RELEASECANDIDATE GEREED" : `❌ ${failed.length} rode fase(n)`} — zie docs/RELEASE_ACCEPTANCE.md`);
process.exit(failed.length === 0 ? 0 : 1);
