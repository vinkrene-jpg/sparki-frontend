// RIJDEN_02 — knoppenrij wordt de stappenmachine: acceptatie §6 met echte
// browserkliks tegen de PRODUCTIEBUILD (WP-S1: DEV Preview is geen bewijs).
//
//  §6-1  scherm opent met één bolletje "Activiteit"
//  §6-2  racefiets kiezen ⇒ "Racefiets" · "Binnen 30 km" · "+ Verfijnen"
//  §6-3  Verfijnen opent één vraag, niet een lijst
//  §6-4  elke keuze wordt een bolletje; tik erop = stap opnieuw openen
//  §6-5  nergens een knop "Filters"
//  §6-6  "Sparki maakt hem" staat altijd onderaan, op elke diepte
//  §6-7  geen handeling twee keer op één scherm ("Sparki maakt hem" 1×
//        zichtbaar per weergave)
//  §6-11 knoppenrij blijft staan als het onderblad omhoog komt
//  §6-10 kaartstijl: alleen screenshot-bewijs (visuele beoordeling René)
//  (§6-8/9 — routenaam/één-regel-beschrijving — worden op de api-server
//   bewezen; de namen komen server-side uit buildRationaleFallback.)
//
// Draaien: node e2e/tests/rijden02-knoppenrij.mjs
// Vereist: api-server draait (poort 80) + verse prod-build
//   (cd artifacts/sparki && PORT=5000 BASE_PATH=/ pnpm run build)
import { launchBrowser, ensureE2eUser, mintTicket, TestRun } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../../lib/db/package.json", import.meta.url));
const { Client } = require("pg");

const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/rijden02-knoppenrij",
);
mkdirSync(EVIDENCE, { recursive: true });

// Westerbork (Drenthe, NL) — bekend werkend corpusgebied.
const SEED = { lat: 52.853, lon: 6.608 };
const MOBIEL = { width: 402, height: 874 };

const stappen = [];
let exitCode = 0;
function log(stap, ok, detail = "") {
  const status = ok ? "OK" : "FOUT";
  if (!ok) exitCode = 1;
  stappen.push({ stap, status, detail, t: new Date().toISOString() });
  console.log(`[${status}] ${stap}${detail ? ` — ${detail}` : ""}`);
}
function info(stap, detail = "") {
  stappen.push({ stap, status: "INFO", detail, t: new Date().toISOString() });
  console.log(`[INFO] ${stap}${detail ? ` — ${detail}` : ""}`);
}

async function metDb(fn) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

function vierkant(latOffset, lonOffset, d = 0.02) {
  const la = SEED.lat + latOffset;
  const lo = SEED.lon + lonOffset;
  return [
    [la, lo],
    [la + d, lo],
    [la + d, lo + d],
    [la, lo + d],
    [la, lo],
  ];
}

async function seed(clerkId) {
  return metDb(async (db) => {
    await db.query(`DELETE FROM routes WHERE name LIKE 'E2E-R02%'`);
    for (let i = 0; i < 3; i++) {
      await db.query(
        `INSERT INTO routes (clerk_id, name, surface, sport, status, visibility, distance_km, elevation_gain_m, geometry, source)
         VALUES ($1,$2,'asfalt','cycling','ready','private',$3,50,$4,'manual')`,
        [
          clerkId,
          `E2E-R02 eigen ${i + 1}`,
          20 + i * 5,
          JSON.stringify(vierkant(0.005 * i, -0.01 - 0.005 * i)),
        ],
      );
    }
  });
}

async function cleanup() {
  await metDb((db) => db.query(`DELETE FROM routes WHERE name LIKE 'E2E-R02%'`));
}

async function openRouteScherm(run, { userId, geo = SEED }) {
  await run.open();
  await run.context.grantPermissions(["geolocation"]);
  await run.context.setGeolocation({ latitude: geo.lat, longitude: geo.lon });
  await run.loginWithTicket(await mintTicket(userId));
  await run.page.goto(`${run.baseUrl}/route`, { waitUntil: "networkidle" });
  await run.acceptConsentIfPresent();
  if (new URL(run.page.url()).pathname !== "/route") {
    await run.page.goto(`${run.baseUrl}/route`, { waitUntil: "networkidle" });
  }
  await run.verifyIdentity({ expectClerkId: userId });
  await run.page.waitForTimeout(2500);
  return run.page;
}

// Aantal ZICHTBARE elementen met exact deze tekst (voor de dubbel-check C5).
async function zichtbaarAantal(page, tekst) {
  return page.getByText(tekst, { exact: true }).locator("visible=true").count();
}

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();
let userId = null;

try {
  userId = await ensureE2eUser();
  await seed(userId);
  log("voorbereiding: corpus geseed (3 eigen routes)", true);

  const run = new TestRun({ browser, baseUrl, viewport: MOBIEL, evidenceDir: EVIDENCE, runName: "mobiel" });
  const page = await openRouteScherm(run, { userId });

  const rij = page.getByTestId("knoppenrij").locator("visible=true").first();
  await rij.waitFor({ timeout: 20000 });

  // §6-1: één bolletje "Activiteit", geen verdere keuzebolletjes.
  const rijTekst = (await rij.innerText()).trim();
  log("§6-1: scherm opent met één bolletje 'Activiteit'", rijTekst === "Activiteit", JSON.stringify(rijTekst));
  await run.shot("6-1-open");

  // §6-5: nergens een knop "Filters".
  log("§6-5: geen knop 'Filters'", (await page.getByRole("button", { name: /^Filters/ }).count()) === 0);

  // §6-6: de escape staat onderaan, al vóór er iets gekozen is.
  const escape = page.getByTestId("escape-sparki").locator("visible=true").first();
  log("§6-6: 'Sparki maakt hem' zichtbaar op stap 1", await escape.isVisible().catch(() => false));

  // §6-7 (C5): "Sparki maakt hem" precies één keer zichtbaar.
  log("§6-7: 'Sparki maakt hem' staat één keer op het scherm", (await zichtbaarAantal(page, "Sparki maakt hem")) === 1);

  // §6-2: racefiets kiezen via het bolletje.
  await page.getByTestId("knoppenrij").locator("visible=true").first().getByText("Activiteit").click();
  const racefiets = page.getByText("Racefiets", { exact: true }).locator("visible=true").first();
  await racefiets.waitFor({ timeout: 5000 });
  await run.shot("6-2-activiteitvraag");
  await racefiets.click();
  await page.waitForTimeout(600);
  const naKeuze = (await rij.innerText()).replace(/\s+/g, " ").trim();
  log(
    "§6-2: rij toont 'Racefiets' · 'Binnen 30 km' · '+ Verfijnen'",
    naKeuze.includes("Racefiets") && /Binnen \d+ km/.test(naKeuze) && naKeuze.includes("Verfijnen"),
    naKeuze,
  );
  await run.shot("6-2-na-keuze");

  // §6-3: Verfijnen opent precies één vraag (afstand), geen lijst.
  await rij.getByText("+ Verfijnen").click();
  await page.waitForTimeout(400);
  const vraagKoppen = await page
    .locator("p.font-mono:visible")
    .evaluateAll((els) => els.map((e) => e.textContent?.trim()).filter((t) => t?.endsWith("?")));
  const slider = page.locator('input[type="range"]:visible');
  log(
    "§6-3: Verfijnen opent één vraag (afstand-schuif), geen lijst",
    (await slider.count()) === 1 && vraagKoppen.length === 1,
    `koppen=${JSON.stringify(vraagKoppen)}`,
  );
  await run.shot("6-3-een-vraag");

  // §6-6 op diepte: escape blijft zichtbaar terwijl een vraag open staat.
  log("§6-6: escape ook zichtbaar met open vraag", (await zichtbaarAantal(page, "Sparki maakt hem")) >= 1);

  // Afstand kiezen ⇒ bolletje met de wáárde.
  await page.getByRole("button", { name: /^Kies \d+ km$/ }).click();
  await page.waitForTimeout(600);
  const metAfstand = (await rij.innerText()).replace(/\s+/g, " ").trim();
  log("§6-4: gekozen afstand wordt een bolletje met de waarde", /\d+ km/.test(metAfstand), metAfstand);

  // §6-4: tik op het afstand-bolletje = stap opnieuw openen.
  const afstandChip = rij.getByText(/^\d+ km$/).first();
  await afstandChip.click();
  await page.waitForTimeout(400);
  log("§6-4: tik op bolletje opent de stap opnieuw", (await page.locator('input[type="range"]:visible').count()) === 1);
  await page.locator('[aria-label="Sluiten"]:visible').first().click();
  await run.shot("6-4-bolletje-heropend");

  // §6-11: onderblad omhoog — knoppenrij blijft staan.
  await page.locator('[aria-label="Onderblad openen"]').click().catch(() => {});
  await page.waitForTimeout(500);
  log("§6-11: knoppenrij blijft staan met onderblad omhoog", await rij.isVisible().catch(() => false));
  log("§6-6: escape blijft zichtbaar met onderblad omhoog", (await zichtbaarAantal(page, "Sparki maakt hem")) === 1);
  await run.shot("6-11-onderblad-omhoog");

  // §6-10: kaartstijl-bewijs — screenshot voor visuele beoordeling.
  info("§6-10: kaartstijl alleen als screenshot-bewijs (visuele beoordeling René)");

  await run.context.close();
} finally {
  try {
    await cleanup();
  } catch (e) {
    console.error("cleanup faalde:", e);
  }
  await browser.close();
  server.close();
}

writeFileSync(
  path.join(EVIDENCE, "rapport.json"),
  JSON.stringify({ stappen, exitCode, t: new Date().toISOString() }, null, 2),
);
console.log(`\nKlaar — exitcode ${exitCode} (${stappen.length} checks)`);
process.exit(exitCode);
