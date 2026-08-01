// TEAM_ONBOARDING_01 — schermbewijs via echte browserkliks (WP-S1-harnas).
//
// Flow (prod-build, echte Clerk ticket-login met het QA-account):
//   1. /club → "Start een club- of teamomgeving" → Aanmaken;
//   2. kies "Zelfstandig team", vul teamnaam, maak aan (concept);
//   3. /club/beheer toont "Team in oprichting" met teamstappen;
//   4. klik organogram-kaart "Compact wedstrijdteam" → stafplekken zichtbaar;
//   5. zelfde beheerpagina ook op telefoonformaat vastgelegd.
//
// Draaien: node e2e/tests/team-onboarding.mjs   (api-server moet draaien)
// Opruimen: de aangemaakte organisatie wordt aan het einde via de DB verwijderd.
import { launchBrowser, TestRun, ensureE2eUser, mintTicket } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/team-onboarding",
);
mkdirSync(EVIDENCE, { recursive: true });

const TEAMNAAM = `E2E Wedstrijdteam ${Date.now()}`;
let exitCode = 0;

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();
const userId = await ensureE2eUser();

async function flow(viewport, { create }) {
  const run = new TestRun({
    browser,
    baseUrl,
    viewport,
    evidenceDir: EVIDENCE,
    runName: `team-onboarding-${viewport}`,
  });
  await run.open();
  await run.loginWithTicket(await mintTicket(userId));
  await run.page.goto(`${baseUrl}/club`, { waitUntil: "networkidle" });
  await run.acceptConsentIfPresent();
  // Zonder lidmaatschap stuurt /club door naar home; de instap-kaarten
  // (lid worden + starten) staan op /club?code=… — dezelfde echte UI-route
  // als een renner die via een clubcode binnenkomt.
  await run.page.goto(`${baseUrl}/club?code=start`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(800);

  if (create) {
    await run.clickAndVerify({
      label: "aanmaken-openen",
      locator: run.page.getByRole("button", { name: "Aanmaken" }).first(),
      expectVisibleText: ["Zelfstandig team", "Club"],
    });
    await run.clickAndVerify({
      label: "kies-zelfstandig-team",
      locator: run.page.getByRole("radio", { name: "Zelfstandig team" }),
    });
    if (!(await run.page.getByPlaceholder("Teamnaam").isVisible()))
      throw new Error('Invoerveld "Teamnaam" niet zichtbaar na keuze Zelfstandig team');
    await run.page.getByPlaceholder("Teamnaam").fill(TEAMNAAM);
    await run.shot("teamnaam-ingevuld");
    await run.page.getByRole("button", { name: /^Aanmaken$/ }).last().click();
    await run.page.waitForLoadState("networkidle").catch(() => {});
    await run.page.waitForTimeout(1200);
    await run.shot("na-aanmaken");
  }

  // Beheer: teamvariant van de onboarding.
  await run.page.goto(`${baseUrl}/club/beheer`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(1000);
  await run.shot("beheer-team-in-oprichting");
  for (const tekst of ["Team in oprichting", "Teamnaam", "Structuur kiezen", "Compact wedstrijdteam", "Zelf samenstellen"]) {
    const vis = await run.page.getByText(tekst, { exact: false }).locator("visible=true").first().isVisible().catch(() => false);
    if (!vis) throw new Error(`"${tekst}" niet zichtbaar op /club/beheer (${viewport})`);
  }

  if (create) {
    await run.clickAndVerify({
      label: "kaart-compact-wedstrijdteam",
      locator: run.page.getByText("Compact wedstrijdteam", { exact: false }).locator("visible=true").first(),
      expectVisibleText: ["Kaart toegepast"],
    });
    await run.page.waitForTimeout(800);
    await run.shot("stafplekken-na-kaart");
    for (const tekst of ["Stafplekken", "Ploegleider", "Teammanager", "Mechanieker", "Soigneur"]) {
      const vis = await run.page.getByText(tekst, { exact: false }).locator("visible=true").first().isVisible().catch(() => false);
      if (!vis) throw new Error(`"${tekst}" niet zichtbaar bij stafplekken (${viewport})`);
    }
  }
  // Addendum: rolgestuurde start — de eigenaar/teammanager landt op /club op
  // een startblok met de eigen rol en één begrijpelijke eerste actie (in
  // concept: "Rond de inrichting af").
  await run.page.goto(`${baseUrl}/club`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(1000);
  await run.shot("rolgestuurde-start");
  for (const tekst of ["Jouw rol", "Rond de inrichting af"]) {
    const vis = await run.page.getByText(tekst, { exact: false }).locator("visible=true").first().isVisible().catch(() => false);
    if (!vis) throw new Error(`"${tekst}" niet zichtbaar op de rolgestuurde start (${viewport})`);
  }

  await run.close();
}

try {
  await flow("desktop", { create: true });
  await flow("mobiel", { create: false });
  console.log("✅ team-onboarding e2e: desktop + mobiel geslaagd");
  console.log(`Bewijs: ${EVIDENCE}`);
} catch (err) {
  exitCode = 1;
  console.error("❌ team-onboarding e2e faalde:", err.message ?? err);
} finally {
  // Opruimen: de e2e-organisatie verwijderen (cascade ruimt structuur op).
  try {
    execSync(
      `psql "$DATABASE_URL" -c "DELETE FROM clubs WHERE name = '${TEAMNAAM.replace(/'/g, "''")}';"`,
      { stdio: "inherit", shell: "/bin/bash" },
    );
  } catch { /* opruimen best-effort; naam is uniek per run */ }
  await browser.close();
  server.close();
}
process.exit(exitCode);
