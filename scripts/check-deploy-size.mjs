#!/usr/bin/env node
// Sparki — deploy-omvang-controle
//
// De Replit-deploy-image heeft een limiet van 8 GiB en bevat de werkmap
// (inclusief .git). Deze controle meet de omvang vóórdat publiceren faalt:
//   • werkmap, exclusief node_modules / .git / .cache (dat is de beïnvloedbare inhoud)
//   • artifacts/*/dist apart uitgesplitst
//   • .git wordt apart gerapporteerd (telt WEL mee in de deploy-image)
//
// Gebruik:
//   node scripts/check-deploy-size.mjs            → waarschuwt boven WARN, faalt boven FAIL
//   node scripts/check-deploy-size.mjs --warn-only → nooit exitcode ≠ 0 (voor in de build)
//
// Drempels (GiB), instelbaar via env:
//   DEPLOY_SIZE_WARN_GIB (default 5) · DEPLOY_SIZE_FAIL_GIB (default 7)

import { readdirSync, lstatSync } from "node:fs";
import { resolve, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const WARN_GIB = Number(process.env.DEPLOY_SIZE_WARN_GIB || 5);
const FAIL_GIB = Number(process.env.DEPLOY_SIZE_FAIL_GIB || 7);
const IMAGE_LIMIT_GIB = 8;
const warnOnly = process.argv.includes("--warn-only");

const EXCLUDE = new Set(["node_modules", ".git", ".cache"]);
const GIB = 1024 ** 3;

const bigFiles = []; // { path, size }
const TOP_FILES = 12;

function walk(dir) {
  let total = 0;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    if (EXCLUDE.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) {
      total += walk(p);
    } else if (e.isFile()) {
      let size = 0;
      try {
        size = lstatSync(p).size;
      } catch {
        continue;
      }
      total += size;
      if (size > 20 * 1024 * 1024) bigFiles.push({ path: relative(ROOT, p), size });
    }
  }
  return total;
}

function fmt(bytes) {
  if (bytes >= GIB) return (bytes / GIB).toFixed(2) + " GiB";
  if (bytes >= 1024 ** 2) return (bytes / 1024 ** 2).toFixed(0) + " MiB";
  return (bytes / 1024).toFixed(0) + " KiB";
}

// Per-topmap meten zodat we de grootste boosdoeners kunnen tonen.
const topDirs = [];
let workTotal = 0;
for (const e of readdirSync(ROOT, { withFileTypes: true })) {
  if (EXCLUDE.has(e.name)) continue;
  const p = join(ROOT, e.name);
  if (e.isSymbolicLink()) continue;
  let size = 0;
  if (e.isDirectory()) size = walk(p);
  else if (e.isFile()) {
    try {
      size = lstatSync(p).size;
    } catch {
      size = 0;
    }
  }
  workTotal += size;
  topDirs.push({ name: e.name, size });
}
topDirs.sort((a, b) => b.size - a.size);

// artifacts/*/dist apart uitsplitsen
const distDirs = [];
try {
  for (const e of readdirSync(join(ROOT, "artifacts"), { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const dist = join(ROOT, "artifacts", e.name, "dist");
    try {
      if (lstatSync(dist).isDirectory()) {
        distDirs.push({ name: `artifacts/${e.name}/dist`, size: walk(dist) });
      }
    } catch {
      /* geen dist — prima */
    }
  }
} catch {
  /* geen artifacts-map */
}

// .git apart (telt mee in de deploy-image, maar valt buiten de werk-drempel)
let gitSize = 0;
const bigFilesSnapshot = bigFiles.slice(); // .git-bestanden horen niet in de opruimlijst
try {
  EXCLUDE.delete(".git");
  gitSize = walk(join(ROOT, ".git"));
  EXCLUDE.add(".git");
} catch {
  gitSize = 0;
}
bigFiles.length = 0;
bigFiles.push(...bigFilesSnapshot);

console.log("== Deploy-omvang-controle ==");
console.log(`Werkmap (excl. node_modules/.git/.cache): ${fmt(workTotal)}`);
console.log(`.git (telt óók mee in de ${IMAGE_LIMIT_GIB} GiB deploy-image): ${fmt(gitSize)}`);
console.log(`Drempels: waarschuwen ≥ ${WARN_GIB} GiB · falen ≥ ${FAIL_GIB} GiB (limiet ${IMAGE_LIMIT_GIB} GiB)`);
console.log("\nGrootste topmappen:");
for (const d of topDirs.slice(0, 10)) console.log(`  ${fmt(d.size).padStart(10)}  ${d.name}`);
if (distDirs.length) {
  console.log("\nartifacts/*/dist:");
  for (const d of distDirs.sort((a, b) => b.size - a.size))
    console.log(`  ${fmt(d.size).padStart(10)}  ${d.name}`);
}
if (bigFiles.length) {
  console.log("\nGrootste bestanden (>20 MiB):");
  for (const f of bigFiles.sort((a, b) => b.size - a.size).slice(0, TOP_FILES))
    console.log(`  ${fmt(f.size).padStart(10)}  ${f.path}`);
}

const workGib = workTotal / GIB;
if (workGib >= FAIL_GIB) {
  console.error(
    `\n❌ Werkmap is ${workGib.toFixed(2)} GiB (≥ ${FAIL_GIB} GiB). Publiceren gaat vrijwel zeker falen op de ${IMAGE_LIMIT_GIB} GiB-limiet. Ruim de grootste mappen/bestanden hierboven op (export-zips, testbundels, oude assets).`,
  );
  process.exit(warnOnly ? 0 : 1);
} else if (workGib >= WARN_GIB) {
  console.warn(
    `\n⚠️  Werkmap is ${workGib.toFixed(2)} GiB (≥ ${WARN_GIB} GiB waarschuwingsdrempel). Nog niet fataal, maar ruim tijdig op — de deploy-image-limiet is ${IMAGE_LIMIT_GIB} GiB en .git (${fmt(gitSize)}) telt daarbij ook mee.`,
  );
} else {
  console.log(`\n✅ Werkmap ${workGib.toFixed(2)} GiB — onder de waarschuwingsdrempel van ${WARN_GIB} GiB.`);
}
