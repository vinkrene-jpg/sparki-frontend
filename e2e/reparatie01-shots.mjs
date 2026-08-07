// REPARATIE_01 D1 — vóór/ná-screenshots van coachscherm + trainingsdetail.
// Gebruik: node e2e/reparatie01-shots.mjs voor|na
// Vereist: verse prod-build (dist/public) + draaiende api-server op :80.
import { startProdServer } from "./serve-prod.mjs";
import { launchBrowser, ensureE2eUser, mintTicket, TestRun } from "./harness.mjs";

const fase = process.argv[2];
if (fase !== "voor" && fase !== "na") {
  console.error("gebruik: node e2e/reparatie01-shots.mjs voor|na");
  process.exit(1);
}
const EVIDENCE = `e2e/evidence/reparatie01/${fase}`;

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();
const userId = await ensureE2eUser();

try {
  const run = new TestRun({
    browser,
    baseUrl,
    viewport: "mobiel",
    evidenceDir: EVIDENCE,
    runName: `reparatie01-${fase}`,
  });
  await run.open();
  await run.loginWithTicket(await mintTicket(userId));
  const page = run.page;

  const heeft = await page.evaluate(async (id) => {
    const r = await fetch("/api/athlete/workouts?limit=5", { headers: { "x-dev-clerk-id": id } });
    if (!r.ok) return { ok: false, status: r.status };
    const j = await r.json();
    const arr = Array.isArray(j) ? j : (j.workouts ?? j.items ?? []);
    return { ok: true, n: arr.length };
  }, userId);
  console.log("workouts:", JSON.stringify(heeft));

  await page.goto(`${baseUrl}/coach`, { waitUntil: "networkidle" });
  if (run.acceptConsentIfPresent) await run.acceptConsentIfPresent().catch(() => {});
  await page.waitForTimeout(1500);
  await run.shot("coach-boven");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(400);
  await run.shot("coach-midden");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await run.shot("coach-onder");

  await page.goto(`${baseUrl}/train`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await run.shot("train");
  // Best effort: eerste workout-kaart openen voor de detail-lade.
  const kandidaten = [
    'button:has-text("Training bekijken")',
    'button:has-text("Pas deze sessie aan")',
    '[data-testid*="workout"]',
  ];
  let open = false;
  for (const sel of kandidaten) {
    const el = page.locator(sel).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click().catch(() => {});
      await page.waitForTimeout(2500);
      open = true;
      break;
    }
  }
  if (open) {
    await run.shot("trainingsdetail-boven");
    const sheet = page.locator('[role="dialog"]');
    if (await sheet.isVisible().catch(() => false)) {
      await sheet.evaluate((el) => el.scrollTo(0, el.scrollHeight / 2));
      await page.waitForTimeout(300);
      await run.shot("trainingsdetail-midden");
      await sheet.evaluate((el) => el.scrollTo(0, el.scrollHeight));
      await page.waitForTimeout(300);
      await run.shot("trainingsdetail-onder");
    }
  } else {
    console.log("geen workout-kaart gevonden — alleen schermoverzichten vastgelegd");
  }
  console.log(`klaar — screenshots in ${EVIDENCE}`);
} finally {
  await browser.close();
  server.close();
}
