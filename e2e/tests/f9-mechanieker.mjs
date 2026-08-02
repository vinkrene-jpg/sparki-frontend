// F9 — Mechanieker-herindeling: schermbewijs op 402×874 (WP-S1-harnas).
//
// Opent /mechanieker met het QA-account en legt de pagina vast op
// telefoonformaat. Werkt zowel op de OUDE (één lange scroll: signalen, fiets,
// garage, vergelijkingstest, materiaalcoach onder elkaar) als de NIEUWE
// indeling (vier tabs + stappenvensters). De tabklikken en sheet-opening zijn
// best-effort, zodat dezelfde harness voor VOOR en NA dient.
//
// Uitvoer-map instelbaar via F9_SHOT_DIR (voor/na naast elkaar).
// Draaien: F9_SHOT_DIR=voor node e2e/tests/f9-mechanieker.mjs
import { launchBrowser, TestRun, ensureE2eUser, mintTicket } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SUB = process.env.F9_SHOT_DIR ?? "na";
const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../docs/proof-evidence/F9_MECHANIEKER",
  SUB,
);
mkdirSync(EVIDENCE, { recursive: true });

let exitCode = 0;

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();
const userId = await ensureE2eUser();

async function shotFold(run, prefix) {
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
    runName: `mechanieker`,
  });
  await run.open();
  await run.loginWithTicket(await mintTicket(userId));
  await run.page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await run.acceptConsentIfPresent();

  // Mechaniekerpagina.
  await run.page.goto(`${baseUrl}/mechanieker`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(1200);
  await shotFold(run, "mechanieker");

  // Scroll-bewijs: hoeveel scroll is er nodig om alles te bereiken?
  const scrollH = await run.page.evaluate(() => document.documentElement.scrollHeight);
  const viewH = await run.page.evaluate(() => window.innerHeight);
  console.log(`   paginahoogte=${scrollH}px, venster=${viewH}px, schermen=${(scrollH / viewH).toFixed(1)}`);
  await run.page.evaluate(() => window.scrollTo(0, window.innerHeight));
  await run.page.waitForTimeout(300);
  await run.shot("mechanieker-scroll-1");
  await run.page.evaluate(() => window.scrollTo(0, window.innerHeight * 2.2));
  await run.page.waitForTimeout(300);
  await run.shot("mechanieker-scroll-2");
  await run.page.evaluate(() => window.scrollTo(0, 0));

  // NIEUWE indeling: klik elke tab (best-effort). OUDE indeling heeft geen
  // tabs — dan blijven deze kliks gewoon uit en valt de screenshot samen met
  // de fold-opname.
  for (const label of ["Onderhoud", "Garage", "Testen", "Advies"]) {
    const tab = run.page.getByRole("tab", { name: label });
    if (await tab.isVisible().catch(() => false)) {
      await tab.click();
      await run.page.waitForTimeout(600);
      await run.page.evaluate(() => window.scrollTo(0, 0));
      await run.shot(`tab-${label.toLowerCase()}`);
    }
  }

  // NIEUWE indeling: één stappenvenster openen (modelschatting) om het
  // sheet-patroon vast te leggen. Best-effort.
  const testenTab = run.page.getByRole("tab", { name: "Testen" });
  if (await testenTab.isVisible().catch(() => false)) {
    await testenTab.click();
    await run.page.waitForTimeout(500);
    const model = run.page.getByRole("button", { name: /modelschatting/i }).first();
    if (await model.isVisible().catch(() => false)) {
      await model.click();
      await run.page.waitForTimeout(600);
      await run.shot("stappenvenster-modelschatting");
    }
  }

  await run.close();
}

try {
  await flow("mobiel");
  console.log(`✅ F9 mechanieker-bewijs (${SUB}) op 402×874 vastgelegd`);
  console.log(`Bewijs: ${EVIDENCE}`);
} catch (err) {
  exitCode = 1;
  console.error("❌ F9 mechanieker-bewijs faalde:", err.message ?? err);
} finally {
  await browser.close();
  server.close();
}
process.exit(exitCode);
