// F9 — BEHEER/ADMIN-herindeling: schermbewijs op 402×874 (WP-S1-harnas).
//
// Legt /admin en /admin/ops vast op telefoonformaat. Werkt zowel op de OUDE
// (één lange scroll, geen ScreenShell op /admin) als de NIEUWE indeling (vier
// resp. drie tabs onder een ScreenShell): de tabklikken zijn best-effort,
// zodat dezelfde harness voor VOOR en NA dient.
//
// Belangrijk (eerlijkheid): /admin en /admin/ops vereisen een echt admin-recht
// op de server (whoami.isAdmin). Het QA-account is doorgaans GEEN admin; dan
// stuurt de server terug naar "/". De harness detecteert dat, legt de
// redirect-staat vast en meldt het expliciet i.p.v. te doen alsof.
//
// Uitvoer-map instelbaar via F9_SHOT_DIR (voor/na naast elkaar).
// Draaien: F9_SHOT_DIR=na node e2e/tests/f9-admin.mjs
import { launchBrowser, TestRun, ensureE2eUser, mintTicket } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SUB = process.env.F9_SHOT_DIR ?? "na";
const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../docs/proof-evidence/F9_ADMIN",
  SUB,
);
mkdirSync(EVIDENCE, { recursive: true });

let exitCode = 0;

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();
const userId = await ensureE2eUser();

async function foldShot(run, prefix) {
  await run.page.evaluate(() => window.scrollTo(0, 0));
  await run.page.waitForTimeout(300);
  await run.shot(`${prefix}-fold`);
}

async function capturePagina(run, url, naam, tabs) {
  await run.page.goto(`${baseUrl}${url}`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(1200);

  const huidigeUrl = run.page.url();
  const isAdmin = huidigeUrl.includes(url);
  console.log(`   ${url} → ${huidigeUrl} (admin-recht: ${isAdmin ? "ja" : "NEE"})`);

  await foldShot(run, naam);

  const scrollH = await run.page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  const viewH = await run.page.evaluate(() => window.innerHeight);
  console.log(
    `   ${url}: paginahoogte=${scrollH}px, venster=${viewH}px, schermen=${(scrollH / viewH).toFixed(1)}`,
  );

  if (!isAdmin) {
    console.warn(
      `   ⚠ QA-account heeft geen admin-recht — ${url} niet bereikbaar via echte login. ` +
        `Zie VOOR_NA.md voor de statische/code-onderbouwing.`,
    );
    return;
  }

  // Scroll-bewijs.
  await run.page.evaluate(() => window.scrollTo(0, window.innerHeight));
  await run.page.waitForTimeout(300);
  await run.shot(`${naam}-scroll-1`);
  await run.page.evaluate(() => window.scrollTo(0, 0));

  // NIEUWE indeling: klik elke tab (best-effort).
  for (const label of tabs) {
    const tab = run.page.getByRole("tab", { name: label });
    if (await tab.isVisible().catch(() => false)) {
      await tab.click();
      await run.page.waitForTimeout(500);
      await run.page.evaluate(() => window.scrollTo(0, 0));
      await run.shot(`${naam}-tab-${label.toLowerCase()}`);
    }
  }

  // NIEUWE indeling: destructief venster openen (best-effort).
  const opschoning = run.page
    .getByRole("button", { name: /Opschoning openen|Dienst stoppen openen/i })
    .first();
  if (await opschoning.isVisible().catch(() => false)) {
    await opschoning.click();
    await run.page.waitForTimeout(500);
    await run.shot(`${naam}-stappenvenster-destructief`);
  }
}

async function flow(viewport) {
  const run = new TestRun({
    browser,
    baseUrl,
    viewport,
    evidenceDir: EVIDENCE,
    runName: `admin`,
  });
  await run.open();
  await run.loginWithTicket(await mintTicket(userId));
  await run.page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await run.acceptConsentIfPresent();

  await capturePagina(run, "/admin", "admin", [
    "Overzicht",
    "Gezondheid",
    "Signalen",
    "Gegevens",
  ]);
  await capturePagina(run, "/admin/ops", "admin-ops", [
    "Systeem",
    "Beoordelingen",
    "Auditlog",
  ]);

  await run.close();
}

try {
  await flow("mobiel");
  console.log(`✅ F9 admin-bewijs (${SUB}) op 402×874 vastgelegd`);
  console.log(`Bewijs: ${EVIDENCE}`);
} catch (err) {
  exitCode = 1;
  console.error("❌ F9 admin-bewijs faalde:", err.message ?? err);
} finally {
  await browser.close();
  server.close();
}
process.exit(exitCode);
