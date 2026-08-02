// DASHBOARD_01 Fase A — sporter-Dashboard schermbewijs op 402×874.
//
// Legt de rustige Dashboard-oppervlakte vast (L1 visual/StateCard + L2
// Momentblok boven de vouw; L3 risico's/kansen mag onder de vouw) én de
// diepere analyse als doorklik (/dashboard/analyse), plus de /vandaag→
// /dashboard-doorverwijzing met behoud van querystring.
//
// Dezelfde harness dient voor VOOR en NA:
// - VOOR (oude build): het pad /vandaag bestond nog als scherm. Zet
//   DASH_PATH=/vandaag zodat de harness het toenmalige startscherm opent.
// - NA (deze build): /dashboard is het scherm, /vandaag is een redirect.
//   Standaard DASH_PATH=/dashboard.
//
// Uitvoer-map instelbaar via DASH_SHOT_DIR (voor/na naast elkaar).
// Draaien: DASH_SHOT_DIR=na node e2e/tests/dashboard-sporter.mjs
import { launchBrowser, TestRun, ensureE2eUser, mintTicket } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SUB = process.env.DASH_SHOT_DIR ?? "na";
const DASH_PATH = process.env.DASH_PATH ?? "/dashboard";
const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../docs/proof-evidence/DASHBOARD_01_SPORTER",
  SUB,
);
mkdirSync(EVIDENCE, { recursive: true });

let exitCode = 0;

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();
const userId = await ensureE2eUser();

async function foldShot(run, prefix) {
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
    runName: "dashboard-sporter",
  });
  await run.open();
  await run.loginWithTicket(await mintTicket(userId));

  // Rustige Dashboard-oppervlakte.
  await run.page.goto(`${baseUrl}${DASH_PATH}`, { waitUntil: "networkidle" });
  await run.acceptConsentIfPresent();
  await run.page.goto(`${baseUrl}${DASH_PATH}`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(1200);

  // Fold: L1 (visual/StateCard) + L2 (Momentblok) horen boven de vouw.
  await foldShot(run, "dashboard");

  // Scroll-bewijs: hoeveel scroll tot alles bereikbaar is (L3 mag onder de
  // vouw). Legt de paginahoogte + twee dieper gescrolde vensters vast.
  const scrollH = await run.page.evaluate(() => document.documentElement.scrollHeight);
  const viewH = await run.page.evaluate(() => window.innerHeight);
  console.log(`   paginahoogte=${scrollH}px, venster=${viewH}px, schermen=${(scrollH / viewH).toFixed(1)}`);
  await run.page.evaluate(() => window.scrollTo(0, window.innerHeight));
  await run.page.waitForTimeout(300);
  await run.shot("dashboard-scroll-1");
  await run.page.evaluate(() => window.scrollTo(0, window.innerHeight * 2.2));
  await run.page.waitForTimeout(300);
  await run.shot("dashboard-scroll-2");
  await run.page.evaluate(() => window.scrollTo(0, 0));

  // /vandaag-doorverwijzing met behoud van querystring (alleen zinvol NA).
  if (DASH_PATH === "/dashboard") {
    await run.page.goto(`${baseUrl}/vandaag?focus=nutrition`, { waitUntil: "networkidle" });
    await run.page.waitForTimeout(800);
    const naRedirect = await run.page.evaluate(() => location.pathname + location.search);
    console.log(`   /vandaag?focus=nutrition → ${naRedirect}`);
    await run.shot("vandaag-redirect");
  }

  // Diepere analyse als doorklik (eigen scherm, geen tweede gedaante).
  await run.page.goto(`${baseUrl}/dashboard/analyse`, { waitUntil: "networkidle" }).catch(() => {});
  await run.page.waitForTimeout(1000);
  await foldShot(run, "analyse");
  await run.page.evaluate(() => window.scrollTo(0, window.innerHeight));
  await run.page.waitForTimeout(300);
  await run.shot("analyse-scroll-1");

  await run.close();
}

try {
  await flow("mobiel");
  console.log(`✅ DASHBOARD_01 sporter-bewijs (${SUB}) op 402×874 vastgelegd`);
  console.log(`Bewijs: ${EVIDENCE}`);
} catch (err) {
  exitCode = 1;
  console.error("❌ DASHBOARD_01 sporter-bewijs faalde:", err.message ?? err);
} finally {
  await browser.close();
  server.close();
}
process.exit(exitCode);
