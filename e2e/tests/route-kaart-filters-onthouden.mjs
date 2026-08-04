// Taak #567 — Bewijs met echte browserkliks dat gekozen routefilters een
// pagina-herbezoek overleven (localStorage per sport) en dat "Alles
// resetten" de onthouden voorkeur ook wist. Tegen de PRODUCTIEBUILD.
//
// Bewijst (telefoon 402x874 én desktop 1440x900):
//  1. /routes: plaatszoek → teller toont 2 geseede fietsroutes;
//  2. filter (max 30 km) → teller 1;
//  3. HERBEZOEK (page.goto /routes opnieuw): filter is onthouden — teller
//     blijft 1 en de Filters-knop is gemarkeerd (filtersActief-stip);
//  4. "Alles resetten" → teller 2 én na nóg een herbezoek blijft het 2
//     (opgeslagen voorkeur is gewist, localStorage-sleutel weg).
//
// Deterministische data: zelfde seedopzet als route-kaart-nearby (taak #563):
// 20 km-lus + 60 km-lijn rond Westerbork voor het QA-account.
//
// Draaien: node e2e/tests/route-kaart-filters-onthouden.mjs
// Vereist: api-server draait (poort 80) + verse prod-build
//   (cd artifacts/sparki && PORT=5000 BASE_PATH=/ pnpm run build)
import { launchBrowser, ensureE2eUser, mintTicket, TestRun, VIEWPORTS } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(
  new URL("../../lib/db/package.json", import.meta.url),
);
const { Client } = require("pg");

const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/route-kaart-filters-onthouden",
);
mkdirSync(EVIDENCE, { recursive: true });

const SEED = { lat: 52.853, lon: 6.608 }; // Westerbork (Drenthe)
const SEED_PLAATS = "Westerbork";
const NAAM_KORT = "E2E-567 lus 20km";
const NAAM_LANG = "E2E-567 tocht 60km";
const STORAGE_KEY = "sparki.route-kaart-filters.v1.cycling";

const stappen = [];
let fouten = 0;
function log(stap, status, detail = "") {
  stappen.push({ stap, status, detail, t: new Date().toISOString() });
  if (status === "FOUT") fouten += 1;
  console.log(`[${status}] ${stap}${detail ? ` — ${detail}` : ""}`);
}

async function seedRoutes(clerkId) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query(`DELETE FROM routes WHERE clerk_id = $1 AND name LIKE 'E2E-567%'`, [clerkId]);
    const d = 0.02;
    const lus = [
      [SEED.lat, SEED.lon],
      [SEED.lat + d, SEED.lon],
      [SEED.lat + d, SEED.lon + d],
      [SEED.lat, SEED.lon + d],
      [SEED.lat, SEED.lon],
    ];
    const lijn = [
      [SEED.lat + 0.01, SEED.lon - 0.01],
      [SEED.lat + 0.02, SEED.lon + 0.05],
      [SEED.lat + 0.03, SEED.lon + 0.12],
      [SEED.lat + 0.04, SEED.lon + 0.2],
    ];
    await db.query(
      `INSERT INTO routes (clerk_id, name, surface, sport, status, visibility, distance_km, elevation_gain_m, geometry, source)
       VALUES ($1,$2,'asfalt','cycling','ready','private',20,60,$3,'manual'),
              ($1,$4,'gravel','cycling','ready','private',60,420,$5,'manual')`,
      [clerkId, NAAM_KORT, JSON.stringify(lus), NAAM_LANG, JSON.stringify(lijn)],
    );
  } finally {
    await db.end();
  }
}

async function cleanupRoutes(clerkId) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query(`DELETE FROM routes WHERE clerk_id = $1 AND name LIKE 'E2E-567%'`, [clerkId]);
  } finally {
    await db.end();
  }
}

async function zoekPlaats(run, plaats) {
  const page = run.page;
  const veld = page.getByTestId("nearby-zoekveld");
  await veld.click();
  await veld.fill("");
  await veld.fill(plaats);
  await veld.press("Enter");
  await page.waitForTimeout(2500);
  const optie = page
    .locator("div.absolute.top-full button", { hasText: plaats })
    .first();
  if (await optie.isVisible().catch(() => false)) {
    await optie.click();
    await page.waitForTimeout(500);
  }
}

async function tellerTekst(page) {
  return (await page.getByTestId("nearby-teller").innerText()).trim();
}

async function wachtOpTeller(page, verwacht, timeout = 20000) {
  const start = Date.now();
  for (;;) {
    const t = await tellerTekst(page).catch(() => "");
    if (t.startsWith(verwacht)) return t;
    if (Date.now() - start > timeout) return t;
    await page.waitForTimeout(400);
  }
}

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();
let exitCode = 0;
let userId = null;
try {
  userId = await ensureE2eUser();
  await seedRoutes(userId);
  log("seed", "OK", `2 routes rond ${SEED_PLAATS} voor ${userId}`);

  for (const viewport of ["mobiel", "desktop"]) {
    const run = new TestRun({
      browser,
      baseUrl,
      viewport,
      evidenceDir: EVIDENCE,
      runName: `onthouden-${viewport}`,
    });
    await run.open();
    await run.loginWithTicket(await mintTicket(userId));
    const me = await run.verifyIdentity({ expectClerkId: userId });
    log(`${viewport}: identiteit`, me.status === 200 ? "OK" : "FOUT", `status=${me.status}`);
    const page = run.page;
    await page.goto(`${baseUrl}/routes`, { waitUntil: "networkidle" });
    await run.acceptConsentIfPresent();
    await page.goto(`${baseUrl}/routes`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);

    // 1. Plaatszoek → 2 routes.
    await zoekPlaats(run, SEED_PLAATS);
    const t2 = await wachtOpTeller(page, "2 fietsroutes");
    log(`${viewport}: teller na plaatszoek`, t2.startsWith("2 fietsroutes") ? "OK" : "FOUT", `"${t2}"`);

    // 2. Filter max 30 km instellen → teller 1.
    await page.getByTestId("knop-filters").click();
    await page.waitForTimeout(400);
    // De dubbele slider is een ARIA-slider (button role=slider) — bedien hem
    // zoals een renner met het toetsenbord: pijltje-links tot ≤ 30 km.
    const maxKnop = page.getByLabel("Maximale afstand (km)");
    await maxKnop.focus();
    for (let i = 0; i < 40; i++) {
      const nu = Number(await maxKnop.getAttribute("aria-valuenow"));
      if (nu <= 30) break;
      await maxKnop.press("ArrowLeft");
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(600);
    await page.getByTestId("filters-teller").click(); // sluit sheet
    const t1 = await wachtOpTeller(page, "1 fietsroutes", 5000);
    log(`${viewport}: teller na filter`, t1.startsWith("1 fietsroutes") ? "OK" : "FOUT", `"${t1}"`);
    const opgeslagen = await page.evaluate((k) => window.localStorage.getItem(k), STORAGE_KEY);
    log(`${viewport}: voorkeur opgeslagen`, opgeslagen && opgeslagen.includes('"maxKm":30') ? "OK" : "FOUT", `${opgeslagen}`);
    await run.shot("gefilterd-voor-herbezoek");

    // 3. HERBEZOEK: filter overleeft, Filters-knop gemarkeerd.
    await page.goto(`${baseUrl}/routes`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await zoekPlaats(run, SEED_PLAATS);
    const tNa = await wachtOpTeller(page, "1 fietsroutes");
    log(`${viewport}: filter onthouden na herbezoek`, tNa.startsWith("1 fietsroutes") ? "OK" : "FOUT", `"${tNa}"`);
    const langWeg = !(await page.getByText(NAAM_LANG, { exact: false }).first().isVisible().catch(() => false));
    log(`${viewport}: 60km-route blijft weggefilterd`, langWeg ? "OK" : "FOUT");
    // filtersActief-markering: de knop draagt de accentrand-klasse.
    const knopKlasse = await page.getByTestId("knop-filters").getAttribute("class");
    log(
      `${viewport}: Filters-knop gemarkeerd`,
      knopKlasse && knopKlasse.includes("border-accent-cyan") ? "OK" : "FOUT",
    );
    await run.shot("onthouden-na-herbezoek");

    // Sheet toont de onthouden waarde ook echt in het veld.
    await page.getByTestId("knop-filters").click();
    await page.waitForTimeout(400);
    const veldWaarde = await page
      .getByLabel("Maximale afstand (km)")
      .getAttribute("aria-valuenow");
    log(`${viewport}: sheet toont onthouden max`, veldWaarde === "30" ? "OK" : "FOUT", `"${veldWaarde}"`);
    await run.shot("sheet-onthouden");

    // 4. Alles resetten → teller 2 + voorkeur gewist + blijft leeg na herbezoek.
    await page.getByRole("button", { name: "Alles resetten" }).click();
    await page.waitForTimeout(400);
    await page.getByTestId("filters-teller").click();
    const tReset = await wachtOpTeller(page, "2 fietsroutes", 5000);
    log(`${viewport}: teller na reset`, tReset.startsWith("2 fietsroutes") ? "OK" : "FOUT", `"${tReset}"`);
    const naReset = await page.evaluate((k) => window.localStorage.getItem(k), STORAGE_KEY);
    log(`${viewport}: voorkeur gewist na reset`, naReset === null ? "OK" : "FOUT", `${naReset}`);
    await page.goto(`${baseUrl}/routes`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await zoekPlaats(run, SEED_PLAATS);
    const tSchoon = await wachtOpTeller(page, "2 fietsroutes");
    log(`${viewport}: schoon na reset + herbezoek`, tSchoon.startsWith("2 fietsroutes") ? "OK" : "FOUT", `"${tSchoon}"`);
    await run.shot("schoon-na-reset");

    await run.close();
  }
} catch (err) {
  log("onverwachte fout", "FOUT", String(err?.stack ?? err));
  exitCode = 1;
} finally {
  try {
    if (userId) await cleanupRoutes(userId);
  } catch {}
  await browser.close();
  server.close();
}

console.log(`\nResultaat: ${fouten === 0 ? "GESLAAGD" : `${fouten} FOUT(EN)`}`);
process.exit(exitCode || (fouten > 0 ? 1 : 0));
