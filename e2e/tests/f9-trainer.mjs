// F9 — Trainer-cockpit-herindeling: schermbewijs op 402×874 (WP-S1-harnas).
//
// Wordt via de DEV-identiteitskiezer een gekoppelde trainer (governor-fixture),
// haalt een gekoppelde sporter op via /api/coach/athletes en opent diens
// coach-cockpit (/coach/athletes/:athleteId/cockpit). Legt de cockpit vast op
// telefoonformaat en klikt de nieuwe tabbalk (Sporter/Plannen/Berichten/Meer)
// plus één stappenvenster (Training toevoegen). Werkt zowel op de OUDE (één
// lange scroll) als de NIEUWE indeling: tabklikken zijn best-effort, zodat
// dezelfde harness voor VOOR en NA dient.
//
// Uitvoer-map instelbaar via F9_SHOT_DIR (voor/na naast elkaar).
// Draaien: F9_SHOT_DIR=voor node e2e/tests/f9-trainer.mjs
import { launchBrowser, TestRun } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SUB = process.env.F9_SHOT_DIR ?? "na";
const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../docs/proof-evidence/F9_TRAINER",
  SUB,
);
mkdirSync(EVIDENCE, { recursive: true });

// Gekoppelde trainer-fixture (heeft ≥1 gekoppelde sporter, zie wp-r0-rollen).
const TRAINER_ID = process.env.F9_TRAINER_ID ?? "governor-fixture-trainer-zelfstandig";

let exitCode = 0;

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();

// Zelfde dev-header-strategie als de app (apiFetch) en wp-r0-rollen.
async function probe(page, url, devId) {
  return page.evaluate(
    async ({ u, id }) => {
      const headers = id ? { "x-dev-clerk-id": id } : {};
      const r = await fetch(u, { credentials: "include", headers });
      let body = null;
      try {
        body = await r.json();
      } catch {
        /* geen JSON */
      }
      return { status: r.status, body };
    },
    { u: url, id: devId },
  );
}

async function shotFold(run, prefix) {
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
    runName: `trainer-cockpit`,
  });
  await run.open();

  // Word de gekoppelde trainer via de DEV-identiteitskiezer (echte klik + de
  // localStorage-vlag die de app-fetches meesturen).
  await run.page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(800);
  await run.page.evaluate(
    (id) => window.localStorage.setItem("sparki.dev.previewAthlete", id),
    TRAINER_ID,
  );
  await run.page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(800);

  // Controleer identiteit + rol server-side (dev-fallback-valkuil vermijden).
  const me = await probe(run.page, "/api/auth/me", TRAINER_ID);
  if (me.status !== 200 || me.body?.clerkId !== TRAINER_ID) {
    throw new Error(
      `VERKEERDE IDENTITEIT: verwacht ${TRAINER_ID}, kreeg ${me.body?.clerkId ?? me.status}`,
    );
  }
  console.log(`   ingelogd als ${me.body?.clerkId} rol ${me.body?.activeRole}`);

  // Haal een gekoppelde sporter op.
  const c = await probe(run.page, "/api/coach/athletes", TRAINER_ID);
  const list = Array.isArray(c.body?.athletes)
    ? c.body.athletes
    : Array.isArray(c.body)
      ? c.body
      : [];
  if (list.length === 0) {
    throw new Error(`geen gekoppelde sporters voor ${TRAINER_ID} (status ${c.status})`);
  }
  const athleteId =
    list[0].clerkId ?? list[0].athleteClerkId ?? list[0].id ?? list[0].athleteId;
  console.log(`   gekoppelde sporter: ${athleteId}`);

  // Open de coach-cockpit.
  await run.page.goto(`${baseUrl}/coach/athletes/${athleteId}/cockpit`, {
    waitUntil: "networkidle",
  });
  await run.page.waitForTimeout(1200);
  await shotFold(run, "cockpit");

  // Scroll-bewijs: paginahoogte + twee dieper gescrolde vensters. Toont "één
  // lange scroll" in de oude indeling; in de nieuwe indeling is de pagina kort.
  const scrollH = await run.page.evaluate(() => document.documentElement.scrollHeight);
  const viewH = await run.page.evaluate(() => window.innerHeight);
  console.log(
    `   paginahoogte=${scrollH}px, venster=${viewH}px, schermen=${(scrollH / viewH).toFixed(1)}`,
  );
  await run.page.evaluate(() => window.scrollTo(0, window.innerHeight));
  await run.page.waitForTimeout(300);
  await run.shot("cockpit-scroll-1");
  await run.page.evaluate(() => window.scrollTo(0, window.innerHeight * 2.2));
  await run.page.waitForTimeout(300);
  await run.shot("cockpit-scroll-2");
  await run.page.evaluate(() => window.scrollTo(0, 0));

  // NIEUWE indeling: klik elke tab (best-effort). OUDE indeling heeft geen
  // tabs — dan blijven deze kliks uit en valt de opname samen met de fold.
  for (const label of ["Sporter", "Plannen", "Berichten", "Meer"]) {
    const tab = run.page.getByRole("tab", { name: label });
    if (await tab.isVisible().catch(() => false)) {
      await tab.click();
      await run.page.waitForTimeout(600);
      await run.page.evaluate(() => window.scrollTo(0, 0));
      await run.shot(`tab-${label.toLowerCase()}`);
    }
  }

  // NIEUWE indeling: F7-berichtingang zichtbaar houden — leg de Berichten-tab
  // vast met de bijlage-ingang. Best-effort.
  const bTab = run.page.getByRole("tab", { name: "Berichten" });
  if (await bTab.isVisible().catch(() => false)) {
    await bTab.click();
    await run.page.waitForTimeout(500);
    await run.page.evaluate(() => window.scrollTo(0, 0));
    await run.shot("berichten-met-f7-ingang");
  }

  // NIEUWE indeling: stappenvenster "Training toevoegen" openen op de
  // Plannen-tab (BeheerSheet-patroon). Best-effort.
  const pTab = run.page.getByRole("tab", { name: "Plannen" });
  if (await pTab.isVisible().catch(() => false)) {
    await pTab.click();
    await run.page.waitForTimeout(500);
  }
  const addBtn = run.page.getByRole("button", { name: /training toevoegen/i }).first();
  if (await addBtn.isVisible().catch(() => false)) {
    await addBtn.click();
    await run.page.waitForTimeout(600);
    await run.shot("stappenvenster-training-toevoegen");
  }

  await run.close();
}

try {
  await flow("mobiel");
  console.log(`✅ F9 trainer-cockpit-bewijs (${SUB}) op 402×874 vastgelegd`);
  console.log(`Bewijs: ${EVIDENCE}`);
} catch (err) {
  exitCode = 1;
  console.error("❌ F9 trainer-cockpit-bewijs faalde:", err.message ?? err);
} finally {
  await browser.close();
  server.close();
}
process.exit(exitCode);
