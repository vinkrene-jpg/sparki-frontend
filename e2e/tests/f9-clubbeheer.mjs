// F9 — Clubbeheer-herindeling: schermbewijs op 402×874 (WP-S1-harnas).
//
// Maakt via de echte UI een team-organisatie (concept) aan met het QA-account,
// opent /club/beheer en legt de beheerpagina vast op telefoonformaat. Werkt
// zowel op de OUDE (één lange scroll) als de NIEUWE indeling (vier tabs): de
// tabklikken zijn best-effort, zodat dezelfde harness voor VOOR en NA dient.
//
// Uitvoer-map instelbaar via F9_SHOT_DIR (voor/na naast elkaar).
// Draaien: F9_SHOT_DIR=voor node e2e/tests/f9-clubbeheer.mjs
import { launchBrowser, TestRun, ensureE2eUser, mintTicket } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SUB = process.env.F9_SHOT_DIR ?? "na";
const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../docs/proof-evidence/F9_CLUBBEHEER",
  SUB,
);
mkdirSync(EVIDENCE, { recursive: true });

const TEAMNAAM = `F9 Beheerbewijs ${Date.now()}`;
let exitCode = 0;

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();
const userId = await ensureE2eUser();

async function shotFullAndFold(run, prefix) {
  // Fold-bewijs: exact het zichtbare venster bij openen (geen scroll).
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
    runName: `clubbeheer`,
  });
  await run.open();
  await run.loginWithTicket(await mintTicket(userId));
  await run.page.goto(`${baseUrl}/club`, { waitUntil: "networkidle" });
  await run.acceptConsentIfPresent();
  await run.page.goto(`${baseUrl}/club?code=start`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(800);

  // Team-organisatie aanmaken (concept) — zelfde echte instap als een starter.
  const aanmakenBtn = run.page.getByRole("button", { name: "Aanmaken" }).first();
  if (await aanmakenBtn.isVisible().catch(() => false)) {
    await aanmakenBtn.click();
    await run.page.waitForTimeout(400);
    const radio = run.page.getByRole("radio", { name: "Zelfstandig team" });
    if (await radio.isVisible().catch(() => false)) await radio.click();
    const naamveld = run.page.getByPlaceholder("Teamnaam");
    if (await naamveld.isVisible().catch(() => false)) {
      await naamveld.fill(TEAMNAAM);
      await run.page.getByRole("button", { name: /^Aanmaken$/ }).last().click();
      await run.page.waitForLoadState("networkidle").catch(() => {});
      await run.page.waitForTimeout(1200);
    }
  }

  // Beheerpagina.
  await run.page.goto(`${baseUrl}/club/beheer`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(1200);
  await shotFullAndFold(run, "beheer");

  // Scroll-bewijs: hoeveel scroll is er nodig om alles te bereiken? Legt de
  // paginahoogte vast + twee dieper gescrolde vensters (toont "één lange
  // scroll" in de oude indeling; in de nieuwe indeling is de pagina kort).
  const scrollH = await run.page.evaluate(() => document.documentElement.scrollHeight);
  const viewH = await run.page.evaluate(() => window.innerHeight);
  console.log(`   paginahoogte=${scrollH}px, venster=${viewH}px, schermen=${(scrollH / viewH).toFixed(1)}`);
  await run.page.evaluate(() => window.scrollTo(0, window.innerHeight));
  await run.page.waitForTimeout(300);
  await run.shot("beheer-scroll-1");
  await run.page.evaluate(() => window.scrollTo(0, window.innerHeight * 2.2));
  await run.page.waitForTimeout(300);
  await run.shot("beheer-scroll-2");
  await run.page.evaluate(() => window.scrollTo(0, 0));

  // NIEUWE indeling: klik elke tab (best-effort). OUDE indeling heeft geen
  // tabs — dan blijven deze kliks gewoon uit en valt de screenshot samen met
  // de fold-opname.
  for (const label of ["Overzicht", "Leden", "Structuur", "Instellingen"]) {
    const tab = run.page.getByRole("tab", { name: label });
    if (await tab.isVisible().catch(() => false)) {
      await tab.click();
      await run.page.waitForTimeout(600);
      await run.page.evaluate(() => window.scrollTo(0, 0));
      await run.shot(`tab-${label.toLowerCase()}`);
    }
  }

  // NIEUWE indeling: één stappenvenster openen (uitnodigen of documenten) om
  // het sheet-patroon vast te leggen. Best-effort.
  const uitnodig = run.page.getByRole("button", { name: /uitnodigen/i }).first();
  if (await uitnodig.isVisible().catch(() => false)) {
    await uitnodig.click();
    await run.page.waitForTimeout(600);
    await run.shot("stappenvenster-uitnodigen");
  }

  await run.close();
}

try {
  await flow("mobiel");
  console.log(`✅ F9 clubbeheer-bewijs (${SUB}) op 402×874 vastgelegd`);
  console.log(`Bewijs: ${EVIDENCE}`);
} catch (err) {
  exitCode = 1;
  console.error("❌ F9 clubbeheer-bewijs faalde:", err.message ?? err);
} finally {
  try {
    execSync(
      `psql "$DATABASE_URL" -c "DELETE FROM clubs WHERE name = '${TEAMNAAM.replace(/'/g, "''")}';"`,
      { stdio: "inherit", shell: "/bin/bash" },
    );
  } catch { /* opruimen best-effort */ }
  await browser.close();
  server.close();
}
process.exit(exitCode);
