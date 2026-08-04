// Taak #563 — Bewijs met echte browserkliks dat de nieuwe routekaart (Kaart-
// tab, taak #560) voorstellen toont en filtert, tegen de PRODUCTIEBUILD.
//
// Bewijst (telefoon 402x874 én desktop 1440x900):
//  1. /routes opent op de Kaart-tab met de kaart-eerst startweergave;
//  2. plaatszoek (geen geolocation): zoekveld → resultaat kiezen → teller
//     toont de geseede routes (2 fietsroutes rond het seedpunt);
//  3. filter (max 30 km) verkleint teller én lijst live naar 1; de weggefilterde
//     route staat niet meer in de lijst;
//  4. "Alles resetten" brengt de teller terug naar 2;
//  5. dun gebied (plaats zonder routes) → teller 0, eerlijke melding
//     "Nog geen bekende routes in dit gebied" + "Zelf plannen";
//  6. "Zelf plannen" in de lege staat opent de wizard (?view=maken).
//
// Deterministische data: twee routes worden vóór de kliks rechtstreeks voor
// het QA-account geseed rond Westerbork (52.853, 6.608): een 20 km-lus op
// asfalt en een 60 km heen-en-terug op gravel. Routes van ándere gebruikers
// zijn privé en tellen nooit mee; het dunne gebied (Uithuizen, Groningen)
// ligt ver van elk corpus.
//
// Draaien: node e2e/tests/route-kaart-nearby.mjs
// Vereist: api-server draait (poort 80) + verse prod-build
//   (cd artifacts/sparki && PORT=5000 BASE_PATH=/ pnpm run build)
import { launchBrowser, ensureE2eUser, mintTicket, TestRun, VIEWPORTS } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// pg is geen directe workspace-dep van e2e/ — resolve via lib/db,
// dat pg wél als dependency draagt (zelfde DB, zelfde driver).
const require = createRequire(
  new URL("../../lib/db/package.json", import.meta.url),
);
const { Client } = require("pg");

const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/route-kaart-nearby",
);
mkdirSync(EVIDENCE, { recursive: true });

const SEED = { lat: 52.853, lon: 6.608 }; // Westerbork (Drenthe)
const SEED_PLAATS = "Westerbork";
const DUN_PLAATS = "Uithuizen"; // Groningen — geen routes in de buurt
const NAAM_KORT = "E2E-563 lus 20km";
const NAAM_LANG = "E2E-563 tocht 60km";

const stappen = [];
let fouten = 0;
function log(stap, status, detail = "") {
  stappen.push({ stap, status, detail, t: new Date().toISOString() });
  if (status === "FOUT") fouten += 1;
  console.log(`[${status}] ${stap}${detail ? ` — ${detail}` : ""}`);
}

// ── Seed: twee eigen routes rond het seedpunt (idempotent) ──────────────────
async function seedRoutes(clerkId) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query(`DELETE FROM routes WHERE clerk_id = $1 AND name LIKE 'E2E-563%'`, [clerkId]);
    // Lus: vierkantje rond het centrum, start == einde (isLus).
    const d = 0.02;
    const lus = [
      [SEED.lat, SEED.lon],
      [SEED.lat + d, SEED.lon],
      [SEED.lat + d, SEED.lon + d],
      [SEED.lat, SEED.lon + d],
      [SEED.lat, SEED.lon],
    ];
    // Heen-en-terug/A-B: open lijn naar het oosten (geen lus).
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
    await db.query(`DELETE FROM routes WHERE clerk_id = $1 AND name LIKE 'E2E-563%'`, [clerkId]);
  } finally {
    await db.end();
  }
}

// Zoek een plaats via het échte zoekveld en kies (indien nodig) het eerste
// resultaat uit de dropdown — precies zoals een renner zonder geolocation.
async function zoekPlaats(run, naam, plaats) {
  const page = run.page;
  const veld = page.getByTestId("nearby-zoekveld");
  await veld.click();
  await veld.fill("");
  await veld.fill(plaats);
  await run.shot(`zoek-${plaats.toLowerCase()}`);
  await veld.press("Enter");
  // Bij precies één geocode-resultaat kiest de UI zelf; anders dropdown.
  await page.waitForTimeout(2500);
  const optie = page
    .locator("div.absolute.top-full button", { hasText: plaats })
    .first();
  if (await optie.isVisible().catch(() => false)) {
    await optie.click();
    await page.waitForTimeout(500);
  }
  await run.shot(`gekozen-${plaats.toLowerCase()}`);
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
      runName: `kaart-${viewport}`,
    });
    await run.open();
    // BEWUST geen geolocation-permissie: de plaatszoek moet volstaan.
    await run.loginWithTicket(await mintTicket(userId));
    const me = await run.verifyIdentity({ expectClerkId: userId });
    log(`${viewport}: identiteit`, me.status === 200 ? "OK" : "FOUT", `status=${me.status}`);
    await run.page.goto(`${baseUrl}/routes`, { waitUntil: "networkidle" });
    await run.acceptConsentIfPresent();
    await run.page.goto(`${baseUrl}/routes`, { waitUntil: "networkidle" });
    const page = run.page;
    await page.waitForTimeout(1000);

    // 1. Kaart-startweergave zichtbaar (standaard tab zonder ?view=).
    const startZichtbaar = await page
      .getByTestId("route-kaart-start")
      .isVisible()
      .catch(() => false);
    log(`${viewport}: kaart-startweergave`, startZichtbaar ? "OK" : "FOUT");
    if (!startZichtbaar) {
      await run.shot("geen-startweergave");
      await run.close();
      continue;
    }
    await run.shot("startweergave");

    // 2. Plaatszoek → teller toont de 2 geseede routes.
    await zoekPlaats(run, "seed", SEED_PLAATS);
    const t2 = await wachtOpTeller(page, "2 fietsroutes");
    log(`${viewport}: teller na plaatszoek`, t2.startsWith("2 fietsroutes") ? "OK" : "FOUT", `"${t2}"`);
    await run.shot("teller-2");

    // Lijst openen: beide geseede routes zichtbaar.
    await page.getByTestId("nearby-teller").click();
    await page.waitForTimeout(400);
    const kortIn = await page.getByText(NAAM_KORT, { exact: false }).first().isVisible().catch(() => false);
    const langIn = await page.getByText(NAAM_LANG, { exact: false }).first().isVisible().catch(() => false);
    log(`${viewport}: lijst toont beide routes`, kortIn && langIn ? "OK" : "FOUT", `kort=${kortIn} lang=${langIn}`);
    await run.shot("lijst-2");

    // 3. Filter max 30 km → teller in sheet én onder de kaart wordt 1;
    //    de 60km-route verdwijnt uit de lijst.
    await run.clickAndVerify({
      label: "filters-openen",
      locator: page.getByTestId("knop-filters"),
      expectVisibleText: ["Moeilijkheidsgraad", "Ondergrond"],
    });
    await page.getByLabel("Maximale afstand (km)").fill("30");
    await page.waitForTimeout(600);
    const sheetTeller = (await page.getByTestId("filters-teller").innerText()).trim();
    log(
      `${viewport}: sheet-teller na max 30 km`,
      sheetTeller.startsWith("1 fietsroutes") ? "OK" : "FOUT",
      `"${sheetTeller}"`,
    );
    await run.shot("filter-max30");
    await page.getByTestId("filters-teller").click(); // sluit sheet
    await page.waitForTimeout(400);
    const t1 = await wachtOpTeller(page, "1 fietsroutes", 5000);
    log(`${viewport}: teller na filter`, t1.startsWith("1 fietsroutes") ? "OK" : "FOUT", `"${t1}"`);
    const langWeg = !(await page.getByText(NAAM_LANG, { exact: false }).first().isVisible().catch(() => false));
    const kortNog = await page.getByText(NAAM_KORT, { exact: false }).first().isVisible().catch(() => false);
    log(`${viewport}: lijst gefilterd`, langWeg && kortNog ? "OK" : "FOUT", `60km-weg=${langWeg} 20km-nog=${kortNog}`);
    await run.shot("gefilterd-1");

    // 4. Alles resetten → teller terug naar 2.
    await page.getByTestId("knop-filters").click();
    await page.getByRole("button", { name: "Alles resetten" }).click();
    await page.waitForTimeout(400);
    await page.getByTestId("filters-teller").click();
    const tReset = await wachtOpTeller(page, "2 fietsroutes", 5000);
    log(`${viewport}: teller na reset`, tReset.startsWith("2 fietsroutes") ? "OK" : "FOUT", `"${tReset}"`);

    // 5. Dun gebied: plaats zonder routes → teller 0 + eerlijke melding.
    await zoekPlaats(run, "dun", DUN_PLAATS);
    const t0 = await wachtOpTeller(page, "0 fietsroutes");
    log(`${viewport}: teller dun gebied`, t0.startsWith("0 fietsroutes") ? "OK" : "FOUT", `"${t0}"`);
    // Lijst is nog open van eerder; zo niet, open hem.
    const melding = page.getByText("Nog geen bekende routes in dit gebied", { exact: false }).first();
    if (!(await melding.isVisible().catch(() => false))) {
      await page.getByTestId("nearby-teller").click();
      await page.waitForTimeout(400);
    }
    const meldingOk = await melding.isVisible().catch(() => false);
    log(`${viewport}: eerlijke melding dun gebied`, meldingOk ? "OK" : "FOUT");
    await run.shot("dun-gebied");

    // 6. "Zelf plannen" in de lege staat opent de wizard (?view=maken).
    const legePlannen = page
      .getByRole("button", { name: "Zelf plannen" })
      .locator("visible=true")
      .last();
    await run.clickAndVerify({
      label: "zelf-plannen-leeg",
      locator: legePlannen,
      expectPath: "/routes",
      expectVisibleText: ["Plan je route direct op de kaart"],
    });
    const naUrl = new URL(page.url());
    const wizardOk = naUrl.searchParams.get("view") === "maken";
    log(`${viewport}: Zelf plannen → wizard`, wizardOk ? "OK" : "FOUT", page.url());
    await run.shot("wizard-open");

    await run.close();
  }
} catch (err) {
  log("onverwachte fout", "FOUT", String(err?.stack ?? err));
  exitCode = 1;
} finally {
  if (userId) await cleanupRoutes(userId).catch((e) => log("cleanup", "FOUT", String(e)));
  await browser.close().catch(() => {});
  server.close();
}

if (fouten > 0) exitCode = 1;
const rapport = {
  test: "route-kaart-nearby (taak #563)",
  uitgevoerd: new Date().toISOString(),
  viewports: Object.keys(VIEWPORTS),
  resultaat: exitCode === 0 ? "GESLAAGD" : "GEFAALD",
  fouten,
  stappen,
};
writeFileSync(path.join(EVIDENCE, "rapport.json"), JSON.stringify(rapport, null, 2));
console.log(`\n${rapport.resultaat} — ${fouten} fouten. Rapport: ${path.join(EVIDENCE, "rapport.json")}`);
process.exit(exitCode);
