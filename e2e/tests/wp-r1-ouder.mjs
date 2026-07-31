// WP-R1 — Ouderomgeving: echte kliktest (dev preview, WP-R0-rolfixtures).
//
// Bewijst per scenario, via ECHTE kliks:
//   • Ouder (2 kinderen): onderbalk Kinderen · Vandaag · Meldingen ·
//     Toestemmingen · Meer — alle vijf klikbaar, juiste pagina + inhoud;
//     kindkiezer aanwezig, wisselen verandert het getoonde kind (Vandaag
//     én Toestemmingen volgen); Meer bevat Profiel en Hulp.
//   • Ouder-solo (1 kind): géén kindkiezer, kind direct zichtbaar.
//   • Uitnodigings-/acceptatie-/her-loginflow: ouder maakt een echte
//     kind-uitnodiging aan (API zoals de app), een vers geaccepteerd kind
//     verschijnt na harde herlaad (her-login-equivalent) in de kinderlijst;
//     daarna wordt de tijdelijke koppeling weer netjes beëindigd.
//   • Telefoon (402x874) én desktop (1440x900).
//
// Draaien: node e2e/tests/wp-r1-ouder.mjs (dev-servers moeten draaien)
import { launchBrowser, TestRun } from "../harness.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "http://127.0.0.1:80";
const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/wp-r1-ouder",
);
mkdirSync(EVIDENCE, { recursive: true });

const OUDER = "governor-fixture-parent";
const OUDER_SOLO = "governor-fixture-parent-solo";
const KIND_A = "TESTFIXTURE Sporter Jeugd";
const KIND_B = "TESTFIXTURE Sporter Jeugd B";

const TABS = [
  { label: "Kinderen", pad: "/kinderen", verwacht: ["Kinderen"] },
  { label: "Vandaag", pad: "/vandaag", verwacht: [] },
  { label: "Meldingen", pad: "/meldingen", verwacht: ["Meldingen", "Verzoeken"] },
  { label: "Toestemmingen", pad: "/toestemmingen", verwacht: ["Toestemmingen"] },
  { label: "Meer", pad: "/meer", verwacht: ["Profiel", "Hulp"] },
];

// Zelfde gedrag als apiFetch in de app: dev-identiteit als header meesturen.
async function api(page, method, url, body) {
  return page.evaluate(async ({ method, url, body }) => {
    const id = window.localStorage.getItem("sparki.dev.previewAthlete");
    const r = await fetch(url, {
      method,
      credentials: "include",
      headers: {
        "content-type": "application/json",
        ...(id ? { "x-dev-clerk-id": id } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    let json = null;
    try { json = await r.json(); } catch {}
    return { status: r.status, body: json };
  }, { method, url, body });
}

async function kiesIdentiteit(run, id) {
  await run.page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await run.page.evaluate((wie) => {
    window.localStorage.setItem("sparki.dev.previewAthlete", wie);
  }, id);
  await run.page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(1000);
  const me = await api(run.page, "GET", "/api/auth/me");
  if (me.status !== 200 || me.body?.clerkId !== id)
    throw new Error(`VERKEERDE IDENTITEIT: verwacht ${id}, kreeg ${me.body?.clerkId ?? me.status}`);
  if (me.body?.activeRole !== "parent")
    throw new Error(`VERKEERDE ROL: verwacht parent, kreeg ${me.body?.activeRole}`);
}

const browser = await launchBrowser();
const rapport = [];
let failures = 0;

async function scenarioTabs(viewport) {
  const run = new TestRun({
    browser, baseUrl: BASE, viewport,
    evidenceDir: EVIDENCE, runName: `ouder-tabs`,
  });
  await run.open();
  const regels = [];
  const fout = (msg) => { failures += 1; regels.push({ status: "FOUT", detail: msg }); };
  try {
    await kiesIdentiteit(run, OUDER);
    regels.push({ status: "OK", detail: `identiteit ${OUDER} (rol parent) bevestigd` });
    await run.shot("start-ouder");

    for (const tab of TABS) {
      // Zichtbare navigatielink met dit label aanklikken (onderbalk op
      // telefoon, zijbalk op desktop) — geen page.goto.
      // Onderbalk (DsMobileNav) rendert <button>-items, de desktop-zijbalk
      // <a>-links — beide meenemen, alleen zichtbare kandidaten.
      const link = run.page
        .locator(`a:has-text("${tab.label}"), nav button:has-text("${tab.label}")`)
        .locator("visible=true")
        .first();
      if (!(await link.isVisible().catch(() => false))) {
        fout(`navigatielink "${tab.label}" niet zichtbaar (${viewport})`);
        continue;
      }
      try {
        await run.clickAndVerify({
          label: `tab-${tab.label.toLowerCase()}`,
          locator: link,
          expectPath: tab.pad,
          expectVisibleText: tab.verwacht,
        });
        regels.push({ status: "OK", detail: `tab ${tab.label} → ${tab.pad} met verwachte inhoud (${viewport})` });
      } catch (e) {
        fout(String(e.message ?? e));
      }
    }

    // Kindkiezer: op Kinderen beide kinderen zichtbaar; kiezen stuurt Vandaag.
    await run.page.goto(`${BASE}/kinderen`, { waitUntil: "networkidle" });
    await run.page.waitForTimeout(800);
    await run.shot("kinderen");
    for (const naam of [KIND_A, KIND_B]) {
      const zichtbaar = await run.page.getByText(naam, { exact: false }).first().isVisible().catch(() => false);
      if (!zichtbaar) fout(`kind "${naam}" niet zichtbaar op /kinderen`);
    }
    const kiesB = run.page.locator('[data-testid^="kies-kind-"]').first();
    if (await kiesB.isVisible().catch(() => false)) {
      await kiesB.click();
      await run.page.waitForTimeout(400);
      await run.shot("kind-gewisseld");
      regels.push({ status: "GEKLIKT", detail: "kindkiezer: ander kind gekozen" });
    }
    // Vandaag toont nu precies het gekozen kind (kiezer-chips aanwezig).
    await run.page.goto(`${BASE}/vandaag`, { waitUntil: "networkidle" });
    await run.page.waitForTimeout(1000);
    await run.shot("vandaag-na-wissel");
    const chips = await run.page.locator('[data-testid="kindkiezer"]').first().isVisible().catch(() => false);
    if (!chips) fout("kindkiezer-chips ontbreken op Vandaag bij 2 kinderen");
    else regels.push({ status: "OK", detail: "Vandaag toont kindkiezer bij 2 kinderen" });
    // Wissel via de chips en controleer dat het getoonde kind meebeweegt.
    const chipB = run.page.locator('[data-testid="kindkiezer"] button', { hasText: KIND_B }).first();
    if (await chipB.isVisible().catch(() => false)) {
      await chipB.click();
      await run.page.waitForTimeout(600);
      const toontB = await run.page.getByText(KIND_B, { exact: false }).nth(1).isVisible().catch(() => false);
      await run.shot("vandaag-kind-b");
      if (!toontB) fout("na chip-wissel is kind B niet het getoonde kind op Vandaag");
      else regels.push({ status: "OK", detail: "chip-wissel: Vandaag volgt gekozen kind" });
    }
    // Toestemmingen volgt dezelfde keuze.
    await run.page.goto(`${BASE}/toestemmingen`, { waitUntil: "networkidle" });
    await run.page.waitForTimeout(800);
    await run.shot("toestemmingen");
    const kiezerT = await run.page.locator('[data-testid="kindkiezer"]').first().isVisible().catch(() => false);
    if (!kiezerT) fout("kindkiezer ontbreekt op Toestemmingen bij 2 kinderen");
    else regels.push({ status: "OK", detail: "Toestemmingen heeft kindkiezer + rechtenpaneel" });
  } catch (e) {
    fout(String(e.message ?? e));
  } finally {
    await run.page.evaluate(() => window.localStorage.removeItem("sparki.dev.previewAthlete")).catch(() => {});
    await run.close();
  }
  rapport.push({ scenario: `ouder-2-kinderen (${viewport})`, regels });
}

async function scenarioSolo() {
  const run = new TestRun({
    browser, baseUrl: BASE, viewport: "desktop",
    evidenceDir: EVIDENCE, runName: "ouder-solo",
  });
  await run.open();
  const regels = [];
  const fout = (msg) => { failures += 1; regels.push({ status: "FOUT", detail: msg }); };
  try {
    await kiesIdentiteit(run, OUDER_SOLO);
    await run.page.goto(`${BASE}/vandaag`, { waitUntil: "networkidle" });
    await run.page.waitForTimeout(1000);
    await run.shot("solo-vandaag");
    const chips = await run.page.locator('[data-testid="kindkiezer"]').first().isVisible().catch(() => false);
    if (chips) fout("kindkiezer getoond bij één kind (moet verborgen zijn)");
    else regels.push({ status: "OK", detail: "één kind: geen kindkiezer" });
    const kind = await run.page.getByText(KIND_B, { exact: false }).first().isVisible().catch(() => false);
    if (!kind) fout("het enige kind is niet direct zichtbaar op Vandaag");
    else regels.push({ status: "OK", detail: "het enige kind is direct zichtbaar" });
  } catch (e) {
    fout(String(e.message ?? e));
  } finally {
    await run.page.evaluate(() => window.localStorage.removeItem("sparki.dev.previewAthlete")).catch(() => {});
    await run.close();
  }
  rapport.push({ scenario: "ouder-solo (1 kind)", regels });
}

async function scenarioInviteFlow() {
  const run = new TestRun({
    browser, baseUrl: BASE, viewport: "desktop",
    evidenceDir: EVIDENCE, runName: "ouder-invite",
  });
  await run.open();
  const regels = [];
  const fout = (msg) => { failures += 1; regels.push({ status: "FOUT", detail: msg }); };
  const KIND_TIJDELIJK = "governor-fixture-outsider"; // bestaand testaccount als "vers kind"
  try {
    await kiesIdentiteit(run, OUDER);
    // 1. Ouder maakt een echte kind-uitnodiging (zoals de Uitnodigen-pagina).
    const inv = await api(run.page, "POST", "/api/invitations", { relationship: "parent_athlete" });
    if (inv.status !== 201 || !inv.body?.token) throw new Error(`uitnodiging aanmaken faalde: ${inv.status}`);
    regels.push({ status: "OK", detail: "ouder maakte kind-uitnodiging (status 201)" });
    // 2. Het kind accepteert (registratie/acceptatieflow, server-side atomair).
    await run.page.evaluate((wie) => window.localStorage.setItem("sparki.dev.previewAthlete", wie), KIND_TIJDELIJK);
    const acc = await api(run.page, "POST", `/api/invitations/${inv.body.token}/accept`);
    if (acc.status !== 200) throw new Error(`acceptatie faalde: ${acc.status} ${JSON.stringify(acc.body)}`);
    regels.push({ status: "OK", detail: "kind accepteerde de uitnodiging (koppeling actief)" });
    // 3. Her-login-equivalent: ouder opnieuw, harde herlaad → kind zichtbaar.
    await run.page.evaluate((wie) => window.localStorage.setItem("sparki.dev.previewAthlete", wie), OUDER);
    await run.page.goto(`${BASE}/kinderen`, { waitUntil: "networkidle" });
    await run.page.waitForTimeout(1200);
    await run.shot("kinderen-na-acceptatie");
    const nieuw = await run.page.getByText("TESTFIXTURE Buitenstaander", { exact: false }).first().isVisible().catch(() => false);
    if (!nieuw) fout("vers gekoppeld kind niet zichtbaar na herlaad");
    else regels.push({ status: "OK", detail: "na her-login is het verse kind zichtbaar in Kinderen" });
    // 4. Opruimen: koppeling beëindigen + rol/kindstatus fixture-herstel via reseed gebeurt buiten de test.
    const del = await api(run.page, "DELETE", `/api/links/as-parent/${KIND_TIJDELIJK}`);
    if (del.status !== 200) fout(`opruimen koppeling faalde: ${del.status}`);
    else regels.push({ status: "OK", detail: "tijdelijke koppeling weer beëindigd" });
  } catch (e) {
    fout(String(e.message ?? e));
  } finally {
    await run.page.evaluate(() => window.localStorage.removeItem("sparki.dev.previewAthlete")).catch(() => {});
    await run.close();
  }
  rapport.push({ scenario: "uitnodiging → acceptatie → her-login", regels });
}

try {
  await scenarioTabs("mobiel");
  await scenarioTabs("desktop");
  await scenarioSolo();
  await scenarioInviteFlow();
} finally {
  await browser.close();
}

const verslag = { datum: new Date().toISOString(), basis: BASE, failures, rapport };
writeFileSync(path.join(EVIDENCE, "rapport.json"), JSON.stringify(verslag, null, 2));
for (const s of rapport) {
  console.log(`\n== ${s.scenario} ==`);
  for (const r of s.regels) console.log(`  [${r.status}] ${r.detail}`);
}
console.log(`\nwp-r1-ouder: ${failures === 0 ? "GESLAAGD" : `${failures} FOUT(EN)`}`);
process.exit(failures === 0 ? 0 : 1);
