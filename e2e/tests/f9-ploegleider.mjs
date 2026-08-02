// F9 — Ploegleider-herindeling: schermbewijs op 402×874 (WP-S1-harnas).
//
// Legt de wedstrijd-room vast op telefoonformaat: de roomlijst (met de
// primaire actie "Room maken"), het stappenvenster voor room-aanmaken, en de
// room-detail met tabs (Media / Updates / Compilatie). Werkt zowel op de OUDE
// indeling (blokken onder elkaar, inline aanmaken) als de NIEUWE (tabs +
// stappenvenster): kliks zijn best-effort, zodat dezelfde harness voor VOOR en
// NA dient. Ook de zichtbare ingang vanaf het ploegleider-startpunt
// (/rol-start/ploegleider) wordt vastgelegd.
//
// Uitvoer-map instelbaar via F9_SHOT_DIR (voor/na naast elkaar).
// Draaien: F9_SHOT_DIR=voor node e2e/tests/f9-ploegleider.mjs
import { launchBrowser, TestRun, ensureE2eUser, mintTicket } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SUB = process.env.F9_SHOT_DIR ?? "na";
const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../docs/proof-evidence/F9_PLOEGLEIDER",
  SUB,
);
mkdirSync(EVIDENCE, { recursive: true });

const ROOMTITEL = `F9 Ploegbewijs ${Date.now()}`;
let exitCode = 0;

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();
const userId = await ensureE2eUser();

async function fold(run, prefix) {
  await run.page.evaluate(() => window.scrollTo(0, 0));
  await run.page.waitForTimeout(300);
  await run.shot(`${prefix}-fold`);
}

async function flow(viewport) {
  const run = new TestRun({
    browser,
    baseUrl,
    viewport,
    evidenceDir: EVIDENCE,
    runName: `ploegleider`,
  });
  await run.open();
  await run.loginWithTicket(await mintTicket(userId));
  await run.page.goto(`${baseUrl}/vandaag`, { waitUntil: "networkidle" });
  await run.acceptConsentIfPresent();

  // Ingang vanaf het ploegleider-startpunt (F3-grens: alleen een link/kaart).
  await run.page.goto(`${baseUrl}/rol-start/ploegleider`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(600);
  await fold(run, "rolstart");

  // Wedstrijd-room openen.
  await run.page.goto(`${baseUrl}/wedstrijd-room`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(900);
  await fold(run, "room-lijst");

  const scrollH = await run.page.evaluate(() => document.documentElement.scrollHeight);
  const viewH = await run.page.evaluate(() => window.innerHeight);
  console.log(`   roomlijst paginahoogte=${scrollH}px, venster=${viewH}px, schermen=${(scrollH / viewH).toFixed(1)}`);

  // Room aanmaken openen (nieuw: stappenvenster; oud: inline) en direct een
  // echte room maken, zodat de detail-tabs vastgelegd kunnen worden.
  const maak = run.page.getByRole("button", { name: /room maken|\+ room/i }).first();
  if (await maak.isVisible().catch(() => false)) {
    await maak.click();
    await run.page.waitForTimeout(600);
    await run.shot("room-aanmaken");
    const titel = run.page.getByPlaceholder(/omloop|titel/i).first();
    if (await titel.isVisible().catch(() => false)) {
      await titel.fill(ROOMTITEL);
      const bevestig = run.page.getByRole("button", { name: /^Room maken$/ }).last();
      if (await bevestig.isVisible().catch(() => false)) {
        await bevestig.click();
        await run.page.waitForLoadState("networkidle").catch(() => {});
        await run.page.waitForTimeout(1200);
      }
    }
  }

  // Bestaande room openen (indien aanwezig) om de detail-tabs vast te leggen.
  await run.page.goto(`${baseUrl}/wedstrijd-room`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(700);
  const eersteRoom = run.page.locator("section button, main button").filter({ hasText: /dag|dagen/i }).first();
  if (await eersteRoom.isVisible().catch(() => false)) {
    await eersteRoom.click();
    await run.page.waitForTimeout(900);
    await fold(run, "room-detail");

    // NIEUWE indeling: klik elke tab (best-effort).
    for (const label of ["Media", "Updates", "Compilatie"]) {
      const tab = run.page.getByRole("tab", { name: label });
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await run.page.waitForTimeout(500);
        await run.page.evaluate(() => window.scrollTo(0, 0));
        await run.shot(`tab-${label.toLowerCase()}`);
      }
    }
    const detailH = await run.page.evaluate(() => document.documentElement.scrollHeight);
    console.log(`   roomdetail paginahoogte=${detailH}px, schermen=${(detailH / viewH).toFixed(1)}`);
  } else {
    console.log("   (geen bestaande room om detail vast te leggen — best-effort)");
  }

  await run.close();
}

try {
  await flow("mobiel");
  console.log(`✅ F9 ploegleider-bewijs (${SUB}) op 402×874 vastgelegd`);
  console.log(`Bewijs: ${EVIDENCE}`);
} catch (err) {
  exitCode = 1;
  console.error("❌ F9 ploegleider-bewijs faalde:", err.message ?? err);
} finally {
  try {
    execSync(
      `psql "$DATABASE_URL" -c "DELETE FROM race_rooms WHERE title = '${ROOMTITEL.replace(/'/g, "''")}';"`,
      { stdio: "inherit", shell: "/bin/bash" },
    );
  } catch { /* opruimen best-effort */ }
  await browser.close();
  server.close();
}
process.exit(exitCode);
