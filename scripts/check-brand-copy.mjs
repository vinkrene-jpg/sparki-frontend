#!/usr/bin/env node
// TAALHERSTEL-bewaking: gewone gebruikersgerichte UI-zinnen mogen de merknaam
// niet in de derde persoon gebruiken ("Sparki ziet/zegt/adviseert ...").
//
// Detectie: "Sparki " gevolgd door een kleine letter binnen een stringliteral
// of JSX-tekst. Toegestaan blijven o.a. productnamen (Sparki Go/Compleet),
// identifiers, imports, commentaar en logregels — plus alles wat expliciet in
// scripts/brand-copy-allowlist.json staat (met reden).
//
// Gebruik: node scripts/check-brand-copy.mjs   (exit 1 bij overtredingen)

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SCAN_DIRS = [
  "artifacts/sparki/src",
  "artifacts/sparki-mobile/src",
  "artifacts/sparki-mobile/app",
  "artifacts/api-server/src",
];
const EXTS = new Set([".ts", ".tsx"]);

const allowlist = JSON.parse(
  readFileSync(path.join(ROOT, "scripts/brand-copy-allowlist.json"), "utf8"),
);

// Derde-persoonspatroon: merknaam + spatie + kleine letter (ook accenten).
const THIRD_PERSON = /Sparki\s+[a-zà-ü]/;
// Toegestane merkcombinaties die het patroon per ongeluk zou raken.
const ALLOWED_INLINE =
  /Sparki\s+(Go|Compleet|Complete)\b|@sparki|sparki[-_./]/;

function isCodeNotCopy(line) {
  const t = line.trim();
  return (
    t.startsWith("//") ||
    t.startsWith("*") ||
    t.startsWith("/*") ||
    t.startsWith("{/*") ||
    /^import\b/.test(t) ||
    /^export\s+(type|interface)\b/.test(t) ||
    // log-/debugregels zijn geen UI-copy
    /\b(console\.(log|warn|error)|req\.log|logger)\b/.test(t)
  );
}

function inStringOrJsx(line) {
  // Grof maar effectief: de merknaam staat binnen aanhalingstekens/backticks
  // of in JSX-tekst (regel bevat > vóór de treffer of het is een pure
  // tekstregel binnen JSX).
  const idx = line.search(THIRD_PERSON);
  if (idx < 0) return false;
  const before = line.slice(0, idx);
  const quotes = (before.match(/["'`]/g) ?? []).length;
  if (quotes % 2 === 1) return true; // binnen een string
  if (/>[^<]*$/.test(before)) return true; // JSX-tekst na een tag
  if (/^\s*[A-ZÀ-Üa-zà-ü"'`{]/.test(line) && !/[=;(]/.test(before)) return true;
  return false;
}

function allowed(rel, line) {
  // Exacte bestandsmatch; alleen mappen (eindigend op "/") mogen als prefix.
  return allowlist.some((e) => {
    const fileMatch = e.file.endsWith("/")
      ? rel.startsWith(e.file)
      : rel === e.file;
    return fileMatch && (!e.contains || line.includes(e.contains));
  });
}

// Haal commentaargedeelten weg vóór de controle, zodat verboden copy NA een
// commentaar op dezelfde regel niet meelift op de commentaarvrijstelling.
function stripComments(line) {
  return line
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*.*?\*\//g, "")
    .replace(/(^|\s)\/\/(?!\S*:\/\/).*$/, "$1");
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (EXTS.has(path.extname(name))) yield p;
  }
}

const violations = [];
for (const dir of SCAN_DIRS) {
  const abs = path.join(ROOT, dir);
  let entries;
  try {
    entries = [...walk(abs)];
  } catch {
    continue;
  }
  for (const file of entries) {
    const rel = path.relative(ROOT, file);
    // Testbestanden en seeds zijn geen UI-copy.
    if (/\/(tests|scripts|__tests__)\//.test(rel) || /\.test\./.test(rel))
      continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((rawLine, i) => {
      const line = stripComments(rawLine);
      if (!THIRD_PERSON.test(line)) return;
      // Regel is pas fout als er een treffer overblijft nadat toegestane
      // combinaties zijn weggehaald.
      const stripped = line.replace(new RegExp(ALLOWED_INLINE, "g"), "");
      if (!THIRD_PERSON.test(stripped)) return;
      if (isCodeNotCopy(line)) return;
      if (!inStringOrJsx(stripped)) return;
      if (allowed(rel, line)) return;
      violations.push(`${rel}:${i + 1}: ${line.trim().slice(0, 160)}`);
    });
  }
}

if (violations.length) {
  console.error(
    `check-brand-copy: ${violations.length} UI-zin(nen) gebruiken de merknaam in de derde persoon:\n`,
  );
  for (const v of violations) console.error("  " + v);
  console.error(
    "\nHerschrijf de zin direct/neutraal, of voeg een bewuste uitzondering toe aan scripts/brand-copy-allowlist.json (met reden).",
  );
  process.exit(1);
}
console.log("check-brand-copy: geen verboden merkvermeldingen in UI-copy.");
