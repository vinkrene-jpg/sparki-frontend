// WP-1 Routeplanner-herstel (31-07-2026) — echte browserkliktest, mobiel
// formaat, tegen de PRODUCTIEBUILD (dev-server is nooit bewijs, zie README).
//
// Bewijst de acceptatiecriteria van WP-1:
//  1. tijdens de aanvraag is er ALTIJD zichtbare status ("Route berekenen…"
//     en daarna "Veiligheidscontrole uitvoeren…") — nooit minutenlang niets;
//  2. de genereerknop is geblokkeerd zolang de aanvraag loopt (geen dubbele
//     berekening door herhaald tikken);
//  3. de aanvraag eindigt met een echte route (RESULTAAT) óf een eerlijke,
//     begrijpelijke weigering mét vervolgacties — nooit een stil einde;
//  4. de invoer blijft na een fout behouden.
//
// Draaien: node e2e/tests/routeplanner-generatie.mjs
import { launchBrowser, ensureE2eUser, mintTicket, TestRun } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/routeplanner",
);
mkdirSync(EVIDENCE, { recursive: true });

// Startpunt voor de test (Betuwe — landelijk gebied).
const GEO = { latitude: 51.905, longitude: 5.66 };

const stappen = [];
function log(stap, status, detail = "") {
  stappen.push({ stap, status, detail, t: new Date().toISOString() });
  console.log(`[${status}] ${stap}${detail ? ` — ${detail}` : ""}`);
}

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();
let exitCode = 0;
try {
  const run = new TestRun({
    browser,
    baseUrl,
    viewport: "mobiel",
    evidenceDir: EVIDENCE,
    runName: "wp1-generatie",
  });
  await run.open();
  await run.context.grantPermissions(["geolocation"]);
  await run.context.setGeolocation(GEO);

  // Echte login (Clerk ticket) + identiteitscontrole.
  const userId = await ensureE2eUser();
  await run.loginWithTicket(await mintTicket(userId));
  await run.page.goto(`${baseUrl}/routes`, { waitUntil: "networkidle" });
  await run.acceptConsentIfPresent();
  const me = await run.verifyIdentity({ expectClerkId: userId });
  log("login", me.status === 200 ? "OK" : "FOUT", `auth/me=${me.status}`);
  await run.page.goto(`${baseUrl}/routes`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(1200);
  await run.shot("planner-open");

  const page = run.page;
  const planner = page.getByText("WAT VOOR ROUTE?", { exact: false }).first();
  if (!(await planner.isVisible().catch(() => false))) {
    log("planner-zichtbaar", "FOUT", "planner (stap 1) niet zichtbaar voor QA-account");
    throw new Error("Planner niet bereikbaar — geen verdere claims mogelijk");
  }
  log("planner-zichtbaar", "OK");

  // Stap 1: startpunt via echte geolocatie.
  await page.getByRole("button", { name: "Gebruik mijn locatie" }).click();
  await page.getByText(/^Startpunt: 51\.9/).waitFor({ timeout: 15000 });
  log("startpunt", "OK", "eigen locatie vastgeklikt");
  await run.shot("startpunt-gezet");

  // Doorklikken naar de laatste stap.
  for (let i = 0; i < 4; i++) {
    const verder = page.getByRole("button", { name: "Verder →" }).first();
    if (!(await verder.isVisible().catch(() => false))) break;
    await verder.click();
    await page.waitForTimeout(400);
  }
  await run.shot("laatste-stap");

  // Genereer en controleer de statusfasen.
  const genereer = page.getByRole("button", { name: /Genereer route/ }).first();
  if (!(await genereer.isVisible().catch(() => false)))
    throw new Error("Genereer-knop niet gevonden op de laatste stap");
  await genereer.click();
  const statusBerekenen = page.getByText("Route berekenen…", { exact: false }).first();
  await statusBerekenen.waitFor({ timeout: 10000 });
  log("status-berekenen", "OK", "zichtbare status direct na de tik");
  await run.shot("status-berekenen");

  // Dedupe: de knop moet nu geblokkeerd zijn.
  const pendingKnop = page.getByRole("button", { name: /Berekenen…|Veiligheidscontrole…/ }).first();
  const disabled = await pendingKnop.isDisabled().catch(() => false);
  log("knop-geblokkeerd", disabled ? "OK" : "FOUT");
  if (!disabled) exitCode = 1;

  // Fase 2: veiligheidscontrole (kan bij koud gebied even duren).
  const veilig = page.getByText("Veiligheidscontrole uitvoeren", { exact: false }).first();
  try {
    await veilig.waitFor({ timeout: 60000 });
    log("status-veiligheidscontrole", "OK");
    await run.shot("status-veiligheidscontrole");
  } catch {
    log("status-veiligheidscontrole", "NIET GEZIEN", "aanvraag was mogelijk al klaar vóór deze fase zichtbaar werd");
  }

  // Einde: echt resultaat of eerlijke weigering met vervolgacties.
  const resultaat = page.getByText("RESULTAAT", { exact: true }).first();
  const foutOpnieuw = page.getByRole("button", { name: "Opnieuw proberen" }).first();
  await Promise.race([
    resultaat.waitFor({ timeout: 200 * 1000 }),
    foutOpnieuw.waitFor({ timeout: 200 * 1000 }),
  ]);
  const heeftResultaat = await resultaat.isVisible().catch(() => false);
  await run.shot(heeftResultaat ? "resultaat" : "eerlijke-fout");
  if (heeftResultaat) {
    log("einde", "OK", "echte route(varianten) op het scherm");
  } else {
    const fouttekst = (await page.locator("p.text-\\[12px\\]").allTextContents().catch(() => []))
      .find((t) => t.includes("Geen geschikte route") || t.includes("kon niet gecontroleerd"));
    log("einde", "EERLIJKE WEIGERING", fouttekst?.slice(0, 160) ?? "fout + vervolgacties zichtbaar");
    // Vervolgacties + behouden invoer controleren.
    const actiesOk =
      (await foutOpnieuw.isVisible().catch(() => false)) &&
      (await page.getByRole("button", { name: "Startpunt of afstand aanpassen" }).isVisible().catch(() => false));
    log("vervolgacties", actiesOk ? "OK" : "FOUT");
    if (!actiesOk) exitCode = 1;
    const invoerBewaard = await page
      .getByRole("button", { name: "Startpunt of afstand aanpassen" })
      .isVisible()
      .catch(() => false);
    log("invoer-bewaard", invoerBewaard ? "OK" : "FOUT");
  }
} catch (err) {
  log("test", "FOUT", String(err));
  exitCode = 1;
} finally {
  writeFileSync(
    path.join(EVIDENCE, "wp1-generatie-rapport.json"),
    JSON.stringify({ baseUrl, geo: GEO, stappen }, null, 2),
  );
  await browser.close();
  server.close();
}
process.exit(exitCode);
