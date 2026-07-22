#!/usr/bin/env node
// Golf 28 — Productieconfiguratie-controle voor de mobiele app.
// Controleert dat alle store-vereiste configuratie aanwezig is en dat er GEEN
// secrets in de repository of appconfig staan. Toont nooit waarden van
// omgevingsvariabelen — alleen aanwezig/ontbreekt.
//
// Gebruik:  node scripts/check-prod-config.mjs [--kanaal productie]
// Exitcode: 0 = gereed, 1 = ontbrekende of onveilige configuratie.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];
const warnings = [];
const ok = [];

function fail(msg) {
  problems.push(msg);
}
function warn(msg) {
  warnings.push(msg);
}
function pass(msg) {
  ok.push(msg);
}

// ── app.json ────────────────────────────────────────────────────────────────
const appJsonPath = path.join(root, "app.json");
if (!fs.existsSync(appJsonPath)) {
  fail("app.json ontbreekt");
} else {
  const expo = JSON.parse(fs.readFileSync(appJsonPath, "utf8")).expo ?? {};

  if (expo.name && expo.name.trim()) pass(`appnaam: "${expo.name}"`);
  else fail("appnaam (expo.name) ontbreekt");

  if (/^\d+\.\d+\.\d+$/.test(expo.version ?? "")) pass(`versie: ${expo.version}`);
  else fail(`versie (expo.version) ontbreekt of is geen x.y.z: "${expo.version ?? ""}"`);

  const schemes = Array.isArray(expo.scheme) ? expo.scheme : [expo.scheme].filter(Boolean);
  if (schemes.length > 0) pass(`deep link-scheme(s): ${schemes.join(", ")}`);
  else fail("deep link-scheme (expo.scheme) ontbreekt");

  if (expo.ios?.bundleIdentifier && /^[a-z][a-z0-9.]+$/i.test(expo.ios.bundleIdentifier))
    pass(`iOS bundle-id: ${expo.ios.bundleIdentifier}`);
  else fail("iOS bundleIdentifier ontbreekt of is ongeldig");

  if (expo.ios?.buildNumber && /^\d+$/.test(expo.ios.buildNumber))
    pass(`iOS buildnummer: ${expo.ios.buildNumber}`);
  else fail("iOS buildNumber ontbreekt (geheel getal vereist)");

  if (expo.android?.package && /^[a-z][a-z0-9.]+$/i.test(expo.android.package))
    pass(`Android package: ${expo.android.package}`);
  else fail("Android package ontbreekt of is ongeldig");

  if (Number.isInteger(expo.android?.versionCode) && expo.android.versionCode >= 1)
    pass(`Android versionCode: ${expo.android.versionCode}`);
  else fail("Android versionCode ontbreekt (geheel getal >= 1 vereist)");

  // Iconen en splash moeten echt bestaan.
  for (const [label, rel] of [
    ["app-icoon", expo.icon],
    ["splash-afbeelding", expo.splash?.image],
    ["Android adaptive icon", expo.android?.adaptiveIcon?.foregroundImage],
  ]) {
    if (!rel) fail(`${label} niet geconfigureerd`);
    else if (!fs.existsSync(path.join(root, rel))) fail(`${label} bestand ontbreekt: ${rel}`);
    else pass(`${label}: ${rel}`);
  }

  // Machtigingen beperkt tot werkelijk gebruikte functies.
  const allowedAndroid = new Set([
    "android.permission.ACCESS_COARSE_LOCATION",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.ACCESS_BACKGROUND_LOCATION",
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_LOCATION",
    "android.permission.BLUETOOTH_SCAN",
    "android.permission.BLUETOOTH_CONNECT",
  ]);
  const extra = (expo.android?.permissions ?? []).filter((p) => !allowedAndroid.has(p));
  if (extra.length > 0)
    fail(`Android vraagt machtigingen die Sparki niet gebruikt: ${extra.join(", ")}`);
  else pass("Android-machtigingen beperkt tot locatie/voorgronddienst/Bluetooth");

  // Elke iOS-machtiging moet een Nederlandse uitleg hebben.
  const plist = expo.ios?.infoPlist ?? {};
  for (const key of [
    "NSLocationWhenInUseUsageDescription",
    "NSLocationAlwaysAndWhenInUseUsageDescription",
    "NSBluetoothAlwaysUsageDescription",
  ]) {
    if (typeof plist[key] === "string" && plist[key].length > 20) pass(`iOS-uitleg ${key} aanwezig`);
    else fail(`iOS-machtigingsuitleg ${key} ontbreekt of is te kort`);
  }

  // Geen secrets in appconfig: alles onder expo.extra en env-achtige waarden scannen.
  const flat = JSON.stringify(expo);
  const secretPatterns = [
    [/sk_(live|test)_[A-Za-z0-9]{10,}/, "Clerk/Stripe secret key"],
    [/-----BEGIN (RSA |EC )?PRIVATE KEY-----/, "private key"],
    [/AIza[0-9A-Za-z_-]{20,}/, "Google API key"],
    [/(postgres|postgresql):\/\/[^"\s]+:[^"\s]+@/, "databaseverbinding met wachtwoord"],
  ];
  for (const [re, label] of secretPatterns) {
    if (re.test(flat)) fail(`mogelijk secret (${label}) in app.json — verwijder dit direct`);
  }
  if (!secretPatterns.some(([re]) => re.test(flat))) pass("geen secrets aangetroffen in app.json");
}

// ── eas.json ────────────────────────────────────────────────────────────────
const easPath = path.join(root, "eas.json");
const REQUIRED_PROFILES = [
  "ontwikkeling",
  "android-intern",
  "play-gesloten",
  "testflight",
  "pilot",
  "productie",
];
if (!fs.existsSync(easPath)) {
  fail("eas.json ontbreekt (buildprofielen voor distributiekanalen)");
} else {
  const eas = JSON.parse(fs.readFileSync(easPath, "utf8"));
  for (const p of REQUIRED_PROFILES) {
    const prof = eas.build?.[p];
    if (!prof) {
      fail(`buildprofiel "${p}" ontbreekt in eas.json`);
      continue;
    }
    if (prof.env?.EXPO_PUBLIC_CHANNEL !== p)
      fail(`buildprofiel "${p}": EXPO_PUBLIC_CHANNEL moet "${p}" zijn`);
    else pass(`buildprofiel "${p}" met kanaal aanwezig`);
  }
  const easFlat = JSON.stringify(eas);
  if (/sk_(live|test)_[A-Za-z0-9]{10,}|-----BEGIN/.test(easFlat))
    fail("mogelijk secret in eas.json — verwijder dit direct");
  else pass("geen secrets aangetroffen in eas.json");
}

// ── Omgeving (alleen aanwezigheid, nooit waarden) ───────────────────────────
const kanaalArg = process.argv.indexOf("--kanaal");
const kanaal = kanaalArg >= 0 ? process.argv[kanaalArg + 1] : null;
if (kanaal && !REQUIRED_PROFILES.includes(kanaal)) {
  fail(`onbekend kanaal "${kanaal}" (kies uit: ${REQUIRED_PROFILES.join(", ")})`);
}
if (kanaal && kanaal !== "ontwikkeling") {
  const requiredEnv = [
    "EXPO_PUBLIC_DOMAIN",
    "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "EXPO_PUBLIC_MAPBOX_TOKEN",
  ];
  for (const name of requiredEnv) {
    if (process.env[name] && process.env[name].trim()) pass(`omgevingsvariabele ${name}: aanwezig`);
    else fail(`omgevingsvariabele ${name} ontbreekt voor kanaal "${kanaal}" (zet deze als EAS-omgevingsvariabele; nooit in de repository)`);
  }
  // Productie mag nooit naar een dev-domein wijzen.
  const dom = process.env.EXPO_PUBLIC_DOMAIN ?? "";
  if (dom && /(replit\.dev|localhost|127\.0\.0\.1)/.test(dom)) {
    fail(`EXPO_PUBLIC_DOMAIN wijst naar een ontwikkelomgeving — niet toegestaan voor kanaal "${kanaal}"`);
  } else if (dom) {
    pass("EXPO_PUBLIC_DOMAIN wijst niet naar een ontwikkelomgeving");
  }
}

// ── Rapport ─────────────────────────────────────────────────────────────────
console.log("Productieconfiguratie-controle Sparki mobiel");
console.log("=============================================");
for (const m of ok) console.log(`  OK       ${m}`);
for (const m of warnings) console.log(`  LET OP   ${m}`);
for (const m of problems) console.log(`  ONTBREEKT ${m}`);
console.log("---------------------------------------------");
if (problems.length > 0) {
  console.log(`NIET GEREED — ${problems.length} probleem(en).`);
  process.exit(1);
}
console.log(kanaal ? `GEREED voor kanaal "${kanaal}".` : "Basisconfiguratie GEREED.");
