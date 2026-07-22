#!/usr/bin/env node
// Golf 28 — Store-releasecontrole (App Store / Google Play).
// Bouwt voort op artifacts/sparki-mobile/scripts/check-prod-config.mjs (die
// controleert app.json/eas.json/secrets) en controleert hier de zaken die de
// hele repo raken: kanaal↔releasegroep-consistentie, publieke juridische
// pagina's, accountverwijdering in de app, het store-listing-register en
// hardgecodeerde ontwikkeldomeinen in mobiele code. Sluit af met de
// checklist van stappen die alleen buiten de repo kunnen (ondertekening,
// store-formulieren, testaccount).
//
// Gebruik:  node scripts/store-release-check.mjs [--kanaal productie]
// Exitcode: 0 = gereed (checklist blijft handwerk), 1 = probleem gevonden.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MOBILE = path.join(ROOT, "artifacts/sparki-mobile");
const problems = [];
const warnings = [];
const ok = [];
const fail = (m) => problems.push(m);
const warn = (m) => warnings.push(m);
const pass = (m) => ok.push(m);

const read = (p) => fs.readFileSync(p, "utf8");

// ── 1. Mobiele productieconfiguratie (bestaande controle hergebruiken) ──────
const kanaalIdx = process.argv.indexOf("--kanaal");
const kanaal = kanaalIdx >= 0 ? process.argv[kanaalIdx + 1] : null;
try {
  execFileSync(
    process.execPath,
    [
      path.join(MOBILE, "scripts/check-prod-config.mjs"),
      ...(kanaal ? ["--kanaal", kanaal] : []),
    ],
    { stdio: "pipe" },
  );
  pass("mobiele productieconfiguratie (check-prod-config) is groen");
} catch (err) {
  fail(
    "mobiele productieconfiguratie faalt — draai `pnpm --filter @workspace/sparki-mobile run check:prod-config` voor details",
  );
  const out = err.stdout?.toString() ?? "";
  for (const line of out.split("\n")) {
    if (line.includes("ONTBREEKT")) warn(`  ↳ ${line.trim()}`);
  }
}

// ── 2. Kanaal ↔ releasegroep consistent tussen eas.json en de server ────────
try {
  const eas = JSON.parse(read(path.join(MOBILE, "eas.json")));
  const channels = Object.values(eas.build ?? {})
    .map((p) => p.env?.EXPO_PUBLIC_CHANNEL)
    .filter(Boolean);
  const serverSrc = read(
    path.join(ROOT, "artifacts/api-server/src/lib/release-groups.ts"),
  );
  const missing = channels.filter((c) => !serverSrc.includes(`"${c}"`) && !serverSrc.includes(`${c}:`));
  if (missing.length > 0)
    fail(
      `distributiekanalen zonder serverafbeelding naar een releasegroep: ${missing.join(", ")} (vul CHANNEL_GROUPS aan in release-groups.ts)`,
    );
  else pass(`alle ${channels.length} distributiekanalen zijn op de server aan een releasegroep gekoppeld`);
} catch (err) {
  fail(`kanaalcontrole mislukt: ${err.message}`);
}

// ── 3. Publieke juridische pagina's (store-vereiste) ────────────────────────
try {
  const appTsx = read(path.join(ROOT, "artifacts/sparki/src/App.tsx"));
  for (const route of ["/privacy", "/voorwaarden"]) {
    if (appTsx.includes(`path="${route}"`)) pass(`publieke webroute ${route} aanwezig`);
    else fail(`publieke webroute ${route} ontbreekt in App.tsx (stores vereisen een privacy-URL zonder login)`);
  }
  const legalTexts = read(
    path.join(ROOT, "artifacts/api-server/src/lib/legal-texts.ts"),
  );
  if (/privacy/i.test(legalTexts) && /voorwaarden|terms/i.test(legalTexts))
    pass("juridische teksten (privacy + voorwaarden) aanwezig op de server");
  else fail("juridische teksten onvolledig in legal-texts.ts");
} catch (err) {
  fail(`controle juridische pagina's mislukt: ${err.message}`);
}

// ── 4. Accountverwijdering in de app (Google Play-vereiste) ─────────────────
try {
  const instellingen = read(
    path.join(MOBILE, "app/(app)/instellingen.tsx"),
  );
  if (instellingen.includes("/api/account/delete"))
    pass("accountverwijdering bereikbaar vanuit de mobiele app");
  else fail("accountverwijdering niet gevonden in de mobiele instellingen (Play-vereiste)");
} catch (err) {
  fail(`controle accountverwijdering mislukt: ${err.message}`);
}

// ── 5. Store-listing-register aanwezig en zonder placeholders vergeten ──────
try {
  const listing = JSON.parse(read(path.join(ROOT, "docs/store/store-listing.json")));
  pass("store-listing register (docs/store/store-listing.json) is geldige JSON");
  const urls = JSON.stringify(listing.urls ?? {});
  if (urls.includes("<productiedomein>"))
    warn("store-listing bevat nog <productiedomein>-placeholders — vervang vóór indiening door het echte domein");
  else pass("store-listing-URL's zijn ingevuld");
} catch (err) {
  fail(`store-listing register ontbreekt of is ongeldig: ${err.message}`);
}

// ── 6. Geen hardgecodeerde ontwikkeldomeinen in mobiele broncode ────────────
try {
  const offenders = [];
  const scan = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) scan(p);
      else if (/\.(ts|tsx)$/.test(entry.name)) {
        const src = read(p);
        // Alleen echte verwijzingen naar dev-domeinen in URL-vorm; commentaar
        // met uitleg over localhost is onschadelijk maar melden we streng.
        if (/https?:\/\/[^"'\s]*\.replit\.dev/.test(src))
          offenders.push(path.relative(ROOT, p));
      }
    }
  };
  scan(path.join(MOBILE, "app"));
  scan(path.join(MOBILE, "lib"));
  scan(path.join(MOBILE, "hooks"));
  if (offenders.length > 0)
    fail(`hardgecodeerd replit.dev-domein in mobiele code: ${offenders.join(", ")}`);
  else pass("geen hardgecodeerde ontwikkeldomeinen in mobiele broncode");
} catch (err) {
  fail(`domeinscan mislukt: ${err.message}`);
}

// ── Rapport ─────────────────────────────────────────────────────────────────
console.log("Store-releasecontrole Sparki (App Store / Google Play)");
console.log("======================================================");
for (const m of ok) console.log(`  OK       ${m}`);
for (const m of warnings) console.log(`  LET OP   ${m}`);
for (const m of problems) console.log(`  PROBLEEM ${m}`);
console.log("------------------------------------------------------");
console.log("Checklist — stappen die alleen BUITEN deze repo kunnen:");
console.log("  1. Apple Developer- en Google Play-account (ontwikkelaarsovereenkomsten).");
console.log("  2. Ondertekening: EAS beheert iOS-certificaten/Android-keystore bij `eas build` — nooit sleutels in de repo.");
console.log("  3. EAS-omgevingsvariabelen per kanaal zetten (EXPO_PUBLIC_DOMAIN, EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, EXPO_PUBLIC_MAPBOX_TOKEN).");
console.log("  4. Store-formulieren invullen vanuit docs/store/store-listing.json (beschrijvingen, dataveiligheid, machtigingsuitleg).");
console.log("  5. Screenshots maken in de genoemde formaten en uploaden.");
console.log("  6. Testaccount voor review apart aanleveren (nooit in de repo).");
console.log("  7. version_requirements in de database bijwerken (minimum + aanbevolen versie) bij iedere store-release.");
if (problems.length > 0) {
  console.log(`NIET GEREED — ${problems.length} probleem(en).`);
  process.exit(1);
}
console.log("GEREED — repo-kant is in orde; loop de checklist hierboven na.");
