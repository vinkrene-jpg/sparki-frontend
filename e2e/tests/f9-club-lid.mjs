// F9_CLUB_LID — Club-ledenpagina-herindeling: schermbewijs op 402×874.
//
// Maakt via de echte UI een club aan met het QA-account (de maker wordt owner
// en ziet daarmee RealClubView), opent /club en legt het lid-scherm vast op
// telefoonformaat. De tab-/sheet-kliks zijn best-effort, zodat dezelfde harness
// zowel de OUDE (één lange scroll, geen tabs) als de NIEUWE indeling (vier tabs
// + stappenvensters) vastlegt — geschikt voor VOOR én NA.
//
// Uitvoer-map instelbaar via F9_SHOT_DIR (voor/na naast elkaar).
// Draaien: F9_SHOT_DIR=voor node e2e/tests/f9-club-lid.mjs
import { launchBrowser, TestRun, ensureE2eUser, mintTicket } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SUB = process.env.F9_SHOT_DIR ?? "na";
const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../docs/proof-evidence/F9_CLUB_LID",
  SUB,
);
mkdirSync(EVIDENCE, { recursive: true });

const CLUBNAAM = `F9 Ledenbewijs ${Date.now()}`;
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
    runName: `club-lid`,
  });
  await run.open();
  await run.loginWithTicket(await mintTicket(userId));
  await run.page.goto(`${baseUrl}/club`, { waitUntil: "networkidle" });
  await run.acceptConsentIfPresent();
  await run.page.goto(`${baseUrl}/club?code=start`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(800);

  // Clubomgeving aanmaken — de maker wordt owner en ziet RealClubView.
  const aanmakenBtn = run.page.getByRole("button", { name: "Aanmaken" }).first();
  if (await aanmakenBtn.isVisible().catch(() => false)) {
    await aanmakenBtn.click();
    await run.page.waitForTimeout(400);
    const naamveld = run.page.getByPlaceholder("Clubnaam");
    if (await naamveld.isVisible().catch(() => false)) {
      await naamveld.fill(CLUBNAAM);
      await run.page.getByRole("button", { name: /^Aanmaken$/ }).last().click();
      await run.page.waitForLoadState("networkidle").catch(() => {});
      await run.page.waitForTimeout(1200);
    }
  }

  // Lid-scherm.
  await run.page.goto(`${baseUrl}/club`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(1200);
  await shotFold(run, "club");

  // Scroll-bewijs: paginahoogte + één dieper gescrold venster (toont "één
  // lange scroll" in de oude indeling; in de nieuwe indeling is de pagina kort).
  const scrollH = await run.page.evaluate(() => document.documentElement.scrollHeight);
  const viewH = await run.page.evaluate(() => window.innerHeight);
  console.log(`   paginahoogte=${scrollH}px, venster=${viewH}px, schermen=${(scrollH / viewH).toFixed(1)}`);
  await run.page.evaluate(() => window.scrollTo(0, window.innerHeight));
  await run.page.waitForTimeout(300);
  await run.shot("club-scroll-1");
  await run.page.evaluate(() => window.scrollTo(0, window.innerHeight * 2.2));
  await run.page.waitForTimeout(300);
  await run.shot("club-scroll-2");
  await run.page.evaluate(() => window.scrollTo(0, 0));

  // NIEUWE indeling: klik elke tab (best-effort). OUDE indeling heeft geen tabs.
  for (const label of ["Vandaag", "Berichten", "Documenten", "Meer"]) {
    const tab = run.page.getByRole("tab", { name: label });
    if (await tab.isVisible().catch(() => false)) {
      await tab.click();
      await run.page.waitForTimeout(600);
      await run.page.evaluate(() => window.scrollTo(0, 0));
      await run.shot(`tab-${label.toLowerCase()}`);
    }
  }

  // NIEUWE indeling: berichtcomposer als stappenvenster (best-effort). Eerst
  // terug naar Berichten-tab.
  const berichtenTab = run.page.getByRole("tab", { name: "Berichten" });
  if (await berichtenTab.isVisible().catch(() => false)) {
    await berichtenTab.click();
    await run.page.waitForTimeout(400);
  }
  const stuur = run.page.getByRole("button", { name: /Bericht sturen/i }).first();
  if (await stuur.isVisible().catch(() => false)) {
    await stuur.click();
    await run.page.waitForTimeout(600);
    await run.shot("stappenvenster-bericht");
  }

  await run.close();
}

try {
  await flow("mobiel");
  console.log(`✅ F9 club-lid-bewijs (${SUB}) op 402×874 vastgelegd`);
  console.log(`Bewijs: ${EVIDENCE}`);
} catch (err) {
  exitCode = 1;
  console.error("❌ F9 club-lid-bewijs faalde:", err.message ?? err);
} finally {
  try {
    execSync(
      `psql "$DATABASE_URL" -c "DELETE FROM clubs WHERE name = '${CLUBNAAM.replace(/'/g, "''")}';"`,
      { stdio: "inherit", shell: "/bin/bash" },
    );
  } catch { /* opruimen best-effort */ }
  await browser.close();
  server.close();
}
process.exit(exitCode);
