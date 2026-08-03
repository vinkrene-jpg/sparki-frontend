// SPARKI_TELEFOON_UX_01 v1.1 — herstelbewijs lege staten op 375 px breed.
//
// Toetst met een LEEG QA-account (geen training, geen schema, geen doel):
//  1. /dashboard: geen herofoto; één samengevoegde lege-staat-kaart met
//     hooguit twee acties, direct onder de coachboodschap; hoofdhandeling
//     ("Training toevoegen") zichtbaar in de openingsvouw.
//  2. /train: één samengevoegde lege-staat-kaart (geen drie opeenvolgende
//     lege-staat-kaarten); hoofdhandeling zichtbaar in de openingsvouw;
//     uitleg achter een uitklap.
//
// Draaien: node e2e/tests/ux-lege-staat.mjs
import { launchBrowser, TestRun, ensureE2eUser, mintTicket } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../docs/proof-evidence/TELEFOON_UX_LEGE_STATEN",
);
mkdirSync(EVIDENCE, { recursive: true });

let exitCode = 0;
const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();
// Apart, leeg QA-account — nooit het gevulde e2e-hoofdaccount.
const userId = await ensureE2eUser("sparki-e2e-leeg+clerk_test@example.com");

// Hoofdhandeling moet binnen de openingsvouw zichtbaar zijn (geen scroll).
async function assertInFold(page, locator, label, viewportH) {
  const el = page.locator(locator).locator("visible=true").first();
  if (!(await el.isVisible().catch(() => false)))
    throw new Error(`"${label}" is niet zichtbaar`);
  const box = await el.boundingBox();
  if (!box) throw new Error(`"${label}" heeft geen boundingBox`);
  const bottom = box.y + box.height;
  if (bottom > viewportH)
    throw new Error(
      `"${label}" valt buiten de openingsvouw: onderkant op ${Math.round(bottom)}px van ${viewportH}px`,
    );
  console.log(`  ✔ "${label}" in de vouw (onderkant ${Math.round(bottom)}px / ${viewportH}px)`);
}

const VIEW = { width: 375, height: 812 };

try {
  const run = new TestRun({
    browser,
    baseUrl,
    viewport: VIEW,
    evidenceDir: EVIDENCE,
    runName: "ux-lege-staat",
  });
  await run.open();
  await run.loginWithTicket(await mintTicket(userId));

  // ── Dashboard ──
  await run.page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  if (await run.acceptConsentIfPresent()) {
    // Wacht tot het akkoord echt is vastgelegd (gate verdwenen) vóór verder.
    await run.page
      .getByText("Eerst even akkoord", { exact: false })
      .waitFor({ state: "hidden", timeout: 20000 })
      .catch(() => {});
  }
  await run.page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(800);
  await run.page.evaluate(() => window.scrollTo(0, 0));
  await run.shot("dashboard-fold");

  // Geen herofoto zolang er geen informatie is.
  const heroImgs = await run.page
    .locator('header img[aria-hidden="true"]')
    .count();
  if (heroImgs > 0) throw new Error(`herofoto aanwezig in lege staat (${heroImgs} img)`);
  console.log("  ✔ dashboard: geen herofoto in lege staat");

  // Eén samengevoegde kaart, hoofdactie in de vouw.
  const kaart = run.page.locator('[data-testid="dashboard-lege-staat"]');
  if (!(await kaart.isVisible())) throw new Error("samengevoegde dashboardkaart ontbreekt");
  await assertInFold(
    run.page,
    'button:has-text("Training toevoegen")',
    "Dashboard-hoofdactie Training toevoegen",
    VIEW.height,
  );
  // Hooguit twee acties op de kaart.
  const acties = await kaart.locator("button:visible").count();
  // knoppen op kaart: 2 acties + 0 (uitklap is <summary>, geen button)
  if (acties > 2) throw new Error(`meer dan twee actieknoppen op de lege-staat-kaart: ${acties}`);
  console.log(`  ✔ dashboard: ${acties} actie(s) op één samengevoegde kaart`);
  // Uitleg standaard dicht.
  const uitlegOpen = await kaart.locator("details[open]").count();
  if (uitlegOpen > 0) throw new Error("uitleg staat standaard open");
  console.log("  ✔ dashboard: uitleg achter uitklap (dicht)");

  // ── Trainen ──
  await run.page.goto(`${baseUrl}/train`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(800);
  await run.page.evaluate(() => window.scrollTo(0, 0));
  await run.shot("train-fold");

  await assertInFold(
    run.page,
    'button:has-text("Training toevoegen")',
    "Trainen-hoofdactie Training toevoegen",
    VIEW.height,
  );
  const beginKaart = run.page.getByText("Begin met trainen", { exact: false });
  if (!(await beginKaart.first().isVisible()))
    throw new Error("samengevoegde Trainen-lege-staat-kaart ontbreekt");
  console.log("  ✔ trainen: één samengevoegde lege-staat-kaart");
  // De oude drie lege-staat-koppen mogen niet meer als losse kaarten staan.
  for (const kop of ["Waar komt je training vandaan", "Je doel als maatlat"]) {
    const zichtbaar = await run.page
      .getByText(kop, { exact: false })
      .locator("visible=true")
      .count();
    if (zichtbaar > 0) throw new Error(`laag-kop "${kop}" nog zichtbaar in lege staat`);
  }
  console.log("  ✔ trainen: losse laag-kaarten verborgen in lege staat");
  // Uitleg pas na klik (details/summary-uitklap, standaard dicht).
  const trainKaart = run.page.locator('[data-testid="train-lege-staat"]');
  if ((await trainKaart.locator("details[open]").count()) > 0)
    throw new Error("uitleg staat standaard open");
  const uitlegKnop = trainKaart.locator("summary", { hasText: /hoe werkt dit scherm/i });
  if (!(await uitlegKnop.isVisible())) throw new Error("uitklap-knop ontbreekt");
  await uitlegKnop.click();
  await run.page.waitForTimeout(200);
  await run.shot("train-uitleg-open");
  console.log("  ✔ trainen: uitleg achter uitklap");

  // ── Regressie: gevuld account ziet de normale lagen, nooit de lege kaart ──
  // Plan via de echte API één training voor vandaag, herlaad en controleer dat
  // de samengevoegde lege-staat-kaart verdwijnt; daarna weer opruimen.
  const created = await run.page.evaluate(async () => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const r = await fetch("/api/athlete/workouts", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scheduledDate: iso,
        type: "endurance",
        title: "E2E regressie duurrit",
        targetDurationMin: 60,
      }),
    });
    return { status: r.status, body: await r.json().catch(() => null) };
  });
  if (created.status !== 200 && created.status !== 201)
    throw new Error(`regressie-workout plannen faalde: ${created.status}`);
  try {
    await run.page.goto(`${baseUrl}/train`, { waitUntil: "networkidle" });
    await run.page.waitForTimeout(1200);
    await run.shot("train-gevuld");
    if (await run.page.locator('[data-testid="train-lege-staat"]').count())
      throw new Error("lege-staat-kaart toont bij een account MET geplande training");
    const vandaagZichtbaar = await run.page
      .getByText("E2E regressie duurrit", { exact: false })
      .locator("visible=true")
      .first()
      .isVisible()
      .catch(() => false);
    if (!vandaagZichtbaar)
      throw new Error("geplande training niet zichtbaar op /train (gevuld account)");
    console.log("  ✔ regressie: gevuld account ziet normale lagen (geen lege kaart)");

    await run.page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
    await run.page.waitForTimeout(1200);
    await run.shot("dashboard-gevuld");
    if (await run.page.locator('[data-testid="dashboard-lege-staat"]').count())
      throw new Error("dashboard-lege-staat-kaart toont bij account MET training");
    console.log("  ✔ regressie: dashboard gevuld = normale secties (met herofoto)");
  } finally {
    // Opruimen zodat het lege QA-account leeg blijft voor volgende runs.
    const wid = created.body?.id ?? created.body?.workout?.id;
    if (wid != null) {
      await run.page.evaluate(async (id) => {
        await fetch(`/api/athlete/workouts/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
      }, wid);
    }
  }

  await run.close();
  console.log("ALLE UX-lege-staat-checks geslaagd (375px)");
} catch (err) {
  console.error("✖ FAAL:", err.message ?? err);
  exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
process.exit(exitCode);
