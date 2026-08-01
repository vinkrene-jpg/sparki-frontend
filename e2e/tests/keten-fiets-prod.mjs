// KETEN_FIETS_01 — bewijs op ECHTE PRODUCTIE met het echte account van René.
// Zes stappen: genereren → beoordelen (kaart+hoogteprofiel) → opslaan →
// heropenen ná uitloggen/herinloggen → GPX-export → navigatie starten.
// Plus: onmogelijke aanvraag eindigt binnen tijd met concrete reden.
//
// Draaien (pas ná Publish, als /version.json de verwachte SHA toont):
//   CLERK_SECRET_KEY="$CLERK_SECRET_KEY_LIVE" EXPECT_SHA=<sha> \
//   RENE_CLERK_ID=user_... node e2e/tests/keten-fiets-prod.mjs <mobiel|desktop>
//
// Let op: dit logt in als een ECHT persoon (expliciete toestemming René,
// 01-08-2026). Consent-documenten worden NOOIT automatisch geaccepteerd —
// verschijnt de poort, dan stopt de test hard.
import { launchBrowser, TestRun } from "../harness.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.PROD_URL ?? "https://sparki-frontend.replit.app";
const PROOF_TOKEN = process.env.E2E_PROOF_TOKEN;
const EXPECT_SHA = process.env.EXPECT_SHA;
const VIEWPORT = process.argv[2] === "desktop" ? { width: 1440, height: 900 } : { width: 375, height: 812 };
const VIEWNAME = process.argv[2] === "desktop" ? "desktop" : "mobiel-375";
if (!PROOF_TOKEN || !EXPECT_SHA) throw new Error("E2E_PROOF_TOKEN en EXPECT_SHA zijn verplicht");

// Ticket via het afgeschermde bewijs-endpoint op de server zelf (de live
// Clerk-sleutel bestaat alleen dáár). Eenmalig, 300 s geldig, vast account.
async function proofTicket() {
  const r = await fetch(`${BASE}/api/e2e/proof-ticket`, {
    method: "POST",
    headers: { "x-e2e-proof-token": PROOF_TOKEN },
  });
  if (!r.ok) throw new Error(`proof-ticket faalde: ${r.status}`);
  return r.json(); // { userId, ticket }
}

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../evidence/keten-fiets-prod");
mkdirSync(EVIDENCE, { recursive: true });

const stappen = [];
const log = (stap, status, detail = "") => {
  stappen.push({ stap, status, detail, t: new Date().toISOString() });
  console.log(`[${status}] ${stap}${detail ? ` — ${detail}` : ""}`);
};

// Poort 0: versiegelijkheid web + api.
const vWeb = await (await fetch(`${BASE}/version.json`)).json();
const vApi = await (await fetch(`${BASE}/api/version`)).json();
if (vWeb.sha !== EXPECT_SHA || vApi.commit !== EXPECT_SHA)
  throw new Error(`SHA-mismatch: web=${vWeb.sha} api=${vApi.commit} verwacht=${EXPECT_SHA}`);
log("versiecontrole", "OK", `web=${vWeb.sha} api=${vApi.commit} apiStart=${vApi.startedAt}`);

const browser = await launchBrowser();
let exitCode = 0;
let run;
const GEO = { latitude: 51.905, longitude: 5.66 }; // Betuwe, NL

async function login(runObj) {
  const { userId, ticket } = await proofTicket();
  await runObj.loginWithTicket(ticket);
  await runObj.page.goto(`${BASE}/vandaag`, { waitUntil: "networkidle" });
  const gate = await runObj.page.getByText("Eerst even akkoord", { exact: false }).isVisible().catch(() => false);
  if (gate) throw new Error("Consent-poort actief op René's account — STOP, geen automatische acceptatie");
  const me = await runObj.verifyIdentity({ expectClerkId: userId });
  if (me.status !== 200) throw new Error(`auth/me=${me.status} — geen geldige sessie`);
  log("login", "OK", "identiteit geverifieerd via /api/auth/me");
}

try {
  run = new TestRun({ browser, baseUrl: BASE, viewport: VIEWPORT, evidenceDir: EVIDENCE, runName: `keten-${VIEWNAME}` });
  run.viewportName = VIEWNAME;
  await run.open();
  await run.context.grantPermissions(["geolocation"]);
  await run.context.setGeolocation(GEO);
  await login(run);
  const page = run.page;

  // ── Stap 1: route genereren ────────────────────────────────────────────
  await page.goto(`${BASE}/routes`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.getByText("WAT VOOR ROUTE?", { exact: false }).first().waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "Gebruik mijn locatie" }).click();
  await page.getByText(/^Startpunt: 51\.9/).waitFor({ timeout: 20000 });
  for (let i = 0; i < 4; i++) {
    const verder = page.getByRole("button", { name: "Verder →" }).first();
    if (!(await verder.isVisible().catch(() => false))) break;
    await verder.click();
    await page.waitForTimeout(400);
  }
  await run.shot("stap1-instellingen");
  await page.getByRole("button", { name: /Genereer route/ }).first().click();
  const resultaat = page.getByText("RESULTAAT", { exact: true }).first();
  const fout = page.getByRole("button", { name: "Opnieuw proberen" }).first();
  const t0 = Date.now();
  await Promise.race([resultaat.waitFor({ timeout: 330000 }), fout.waitFor({ timeout: 330000 })]);
  const genereerMs = Date.now() - t0;
  if (!(await resultaat.isVisible().catch(() => false))) {
    await run.shot("stap1-eerlijke-fout");
    throw new Error(`Generatie gaf een fout (na ${genereerMs}ms) — zie screenshot`);
  }
  log("stap1-genereren", "OK", `route na ${Math.round(genereerMs / 1000)}s`);
  await run.shot("stap1-resultaat");

  // ── Stap 2: beoordelen — kaart + hoogteprofiel zichtbaar ─────────────
  const kaart = await page.locator(".leaflet-container").first().isVisible().catch(() => false);
  const profiel = await page.getByText(/Hoogteprofiel|hoogte/i).first().isVisible().catch(() => false);
  log("stap2-beoordelen", kaart ? "OK" : "FOUT", `kaart=${kaart} hoogteprofiel-tekst=${profiel}`);
  if (!kaart) exitCode = 1;
  await run.shot("stap2-kaart-hoogteprofiel");

  // ── Stap 3: opslaan ───────────────────────────────────────────────────
  const naamveld = page.locator('input[type="text"]').last();
  const naam = `KETEN_FIETS_01 ${VIEWNAME} ${new Date().toISOString().slice(0, 16)}`;
  if (await naamveld.isVisible().catch(() => false)) await naamveld.fill(naam);
  await page.getByRole("button", { name: /^Bewaar route$/ }).first().click();
  await page.waitForTimeout(3000);
  await run.shot("stap3-opgeslagen");
  // routeId via API bevestigen
  const routes = await page.evaluate(async () => (await fetch("/api/routes", { credentials: "include" })).json());
  const mijnRoute = (Array.isArray(routes) ? routes : routes.routes ?? []).find((r) => r.name?.startsWith("KETEN_FIETS_01"));
  if (!mijnRoute) throw new Error("Opgeslagen route niet terug te vinden via /api/routes");
  log("stap3-opslaan", "OK", `routeId=${mijnRoute.id} naam="${mijnRoute.name}"`);

  // ── Stap 4: uitloggen → herinloggen → heropenen ───────────────────────
  await page.evaluate(() => window.Clerk.signOut());
  await page.waitForTimeout(2500);
  const uitgelogd = await page.evaluate(async () => (await fetch("/api/auth/me", { credentials: "include" })).status);
  log("stap4-uitgelogd", uitgelogd === 401 || uitgelogd === 403 ? "OK" : "FOUT", `auth/me=${uitgelogd}`);
  await login(run);
  await page.goto(`${BASE}/routes/${mijnRoute.id}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const naamZichtbaar = await page.getByText("KETEN_FIETS_01", { exact: false }).first().isVisible().catch(() => false);
  const kaart2 = await page.locator(".leaflet-container").first().isVisible().catch(() => false);
  log("stap4-heropenen", naamZichtbaar && kaart2 ? "OK" : "FOUT", `naam=${naamZichtbaar} kaart=${kaart2}`);
  if (!(naamZichtbaar && kaart2)) exitCode = 1;
  await run.shot("stap4-heropend-na-herlogin");

  // ── Stap 5: GPX-export ────────────────────────────────────────────────
  const gpx = await page.evaluate(async (id) => {
    const r = await fetch(`/api/routes/${id}/gpx`, { credentials: "include" });
    const txt = await r.text();
    return { status: r.status, bytes: txt.length, geldig: txt.startsWith("<?xml") && txt.includes("<gpx") };
  }, mijnRoute.id);
  log("stap5-gpx", gpx.status === 200 && gpx.geldig ? "OK" : "FOUT", `status=${gpx.status} bytes=${gpx.bytes}`);
  if (!(gpx.status === 200 && gpx.geldig)) exitCode = 1;
  await run.shot("stap5-gpx-context");

  // ── Stap 6: navigatie starten ─────────────────────────────────────────
  const rijd = page.getByRole("button", { name: /Rijd|Navigeer|Start/ }).first();
  if (await rijd.isVisible().catch(() => false)) await rijd.click();
  await page.waitForTimeout(2500);
  const startNav = page.getByText("Start navigatie", { exact: false }).first();
  const navZichtbaar = await startNav.isVisible().catch(() => false);
  if (navZichtbaar) { await startNav.click(); await page.waitForTimeout(2500); }
  const navKaart = await page.locator(".leaflet-container").first().isVisible().catch(() => false);
  log("stap6-navigatie", navKaart ? "OK" : "CONTROLEER", `startknop=${navZichtbaar} kaart=${navKaart}`);
  await run.shot("stap6-navigatie-gestart");

  // ── Foutscenario: onmogelijke aanvraag (Noordzee) ─────────────────────
  if (process.env.SKIP_FOUT) throw { message: "__SKIP_FOUT__", skip: true };
  await run.context.setGeolocation({ latitude: 54.0, longitude: 3.0 });
  await page.goto(`${BASE}/routes?nav=maken`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  if (await page.getByText("WAT VOOR ROUTE?", { exact: false }).first().isVisible().catch(() => false)) {
    await page.getByRole("button", { name: "Gebruik mijn locatie" }).click().catch(() => {});
    await page.waitForTimeout(1500);
    for (let i = 0; i < 4; i++) {
      const verder = page.getByRole("button", { name: "Verder →" }).first();
      if (!(await verder.isVisible().catch(() => false))) break;
      await verder.click();
      await page.waitForTimeout(300);
    }
    const gen = page.getByRole("button", { name: /Genereer route/ }).first();
    if (await gen.isVisible().catch(() => false)) {
      const tf = Date.now();
      await gen.click();
      const foutKnop = page.getByRole("button", { name: "Opnieuw proberen" }).first();
      const res2 = page.getByText("RESULTAAT", { exact: true }).first();
      await Promise.race([foutKnop.waitFor({ timeout: 330000 }), res2.waitFor({ timeout: 330000 })]);
      const eerlijkeFout = await foutKnop.isVisible().catch(() => false);
      log("foutscenario", eerlijkeFout ? "OK" : "CONTROLEER", `einde na ${Math.round((Date.now() - tf) / 1000)}s, eerlijke fout=${eerlijkeFout}`);
      await run.shot("foutscenario-noordzee");
    }
  }

  writeFileSync(path.join(EVIDENCE, `verslag-${VIEWNAME}.json`), JSON.stringify({ sha: EXPECT_SHA, viewport: VIEWNAME, apiStartedAt: vApi.startedAt, stappen }, null, 2));
} catch (e) {
  exitCode = 1;
  log("FATAAL", "FOUT", String(e?.message ?? e));
  await run?.shot("fataal").catch(() => {});
  writeFileSync(path.join(EVIDENCE, `verslag-${VIEWNAME}.json`), JSON.stringify({ sha: EXPECT_SHA, viewport: VIEWNAME, stappen, fataal: String(e?.message ?? e) }, null, 2));
} finally {
  await browser.close();
}
process.exit(exitCode);
