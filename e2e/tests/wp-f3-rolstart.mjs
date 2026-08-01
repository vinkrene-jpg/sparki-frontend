// SPARKI_BUILD_01 F3 (BB-08/BB-14) — rolgestuurde startschermen.
// Echte browserkliks tegen de PRODUCTIEBUILD:
//  1. Account met rol nutrition_specialist landt op het Voeding-startscherm
//     (eerlijke lege toestand) — géén terugval op de sporterweergave.
//  2. Onderbalk toont de rolnavigatie (Voeding · Profiel · Hulp), niet de
//     sporterbalk (Trainen/Routes/Wedstrijd).
//  3. /rol-start/<clubrol> toont per rolwaarde een eigen startpunt met echte
//     ingangen en (waar dun) de eerlijke lege toestand.
//  4. Een niet-bestaande rolwaarde krijgt de eerlijke "onbekende rol"-melding,
//     nooit een nagebootst scherm.
//
// Draaien: node e2e/tests/wp-f3-rolstart.mjs
import { execSync } from "node:child_process";
import { launchBrowser, TestRun, mintTicket, ensureE2eUser } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/wp-f3-rolstart",
);
mkdirSync(EVIDENCE, { recursive: true });

const stappen = [];
let fouten = 0;
function log(stap, ok, detail = "") {
  stappen.push({ stap, ok, detail });
  if (!ok) fouten += 1;
  console.log(`[${ok ? "OK" : "FOUT"}] ${stap}${detail ? ` — ${detail}` : ""}`);
}

function psql(sql) {
  return execSync(`psql "$DATABASE_URL" -tAc ${JSON.stringify(sql)}`, {
    encoding: "utf8",
  }).trim();
}

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();
let userId = null;
try {
  const run = new TestRun({
    browser,
    baseUrl,
    viewport: "mobiel",
    evidenceDir: EVIDENCE,
    runName: "rolstart",
  });
  await run.open();
  userId = await ensureE2eUser();
  await run.loginWithTicket(await mintTicket(userId));
  await run.page.goto(`${baseUrl}/vandaag`, { waitUntil: "networkidle" });
  await run.acceptConsentIfPresent();
  const me = await run.verifyIdentity({ expectClerkId: userId });
  log("login", me.status === 200, `auth/me=${me.status}`);
  const page = run.page;

  // Rolwaarde server-side toekennen (zoals een admin-roluitnodiging doet).
  psql(
    `UPDATE user_profiles SET roles = (SELECT array_agg(DISTINCT r) FROM unnest(roles || '{nutrition_specialist}') r), active_role = 'nutrition_specialist', updated_at = now() WHERE clerk_id = '${userId}'`,
  );
  log(
    "rol toegekend",
    psql(`SELECT active_role FROM user_profiles WHERE clerk_id='${userId}'`) ===
      "nutrition_specialist",
  );

  // 1+2: startscherm + navigatie zonder sporterterugval.
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const nutriStart = await page
    .locator('[data-testid="nutrition-start"]')
    .isVisible()
    .catch(() => false);
  log("Voeding-startscherm zichtbaar (geen sporterweergave)", nutriStart);
  const vervolg = await page
    .locator('[data-testid="nutrition-vervolgstap"]')
    .isVisible()
    .catch(() => false);
  log("eerlijke lege toestand met één vervolgstap", vervolg);
  // Alle nav-elementen samen bekijken: DevPanel/desktopnav kunnen vóór de
  // mobiele onderbalk in de DOM staan.
  const navTekst = (await page.locator("nav").allInnerTexts().catch(() => []))
    .join(" · ")
    .toUpperCase();
  log("onderbalk toont Voeding", navTekst.includes("VOEDING"), navTekst.replaceAll("\n", " · "));
  log(
    "onderbalk zonder sporterkeuzes",
    !navTekst.includes("TRAINEN") && !navTekst.includes("WEDSTRIJD"),
    navTekst.replaceAll("\n", " · "),
  );
  await page.screenshot({ path: path.join(EVIDENCE, "voeding-start.png") });

  // 3: clubrol-startpunten (dunne rol met eerlijke lege toestand + beheerrol).
  await page.goto(`${baseUrl}/rol-start/mechanieker`, { waitUntil: "networkidle" });
  const mech = await page
    .locator('[data-testid="rolstart-mechanieker"]')
    .isVisible()
    .catch(() => false);
  const mechLeeg = await page
    .locator('[data-testid="rolstart-leeg"]')
    .isVisible()
    .catch(() => false);
  log("startpunt mechanieker met eerlijke lege toestand", mech && mechLeeg);
  await page.screenshot({ path: path.join(EVIDENCE, "rolstart-mechanieker.png") });

  await page.goto(`${baseUrl}/rol-start/admin`, { waitUntil: "networkidle" });
  const adminFunctie = await page
    .locator('[data-testid="rolstart-functie-/club-beheer"]')
    .isVisible()
    .catch(() => false);
  log("startpunt clubbeheerder linkt naar clubbeheer", adminFunctie);

  // 4: niet-bestaande rol → eerlijke melding.
  await page.goto(`${baseUrl}/rol-start/tovenaar`, { waitUntil: "networkidle" });
  const onbekend = await page
    .locator('[data-testid="rolstart-onbekend"]')
    .isVisible()
    .catch(() => false);
  log("onbekende rol krijgt eerlijke melding", onbekend);
  await page.screenshot({ path: path.join(EVIDENCE, "rolstart-onbekend.png") });

  await run.close();
} finally {
  // Rol altijd terugzetten zodat andere e2e-tests de sporterstart houden.
  if (userId) {
    try {
      psql(
        `UPDATE user_profiles SET roles = array_remove(roles, 'nutrition_specialist'), active_role = 'athlete', updated_at = now() WHERE clerk_id = '${userId}'`,
      );
    } catch {}
  }
  await browser.close();
  server.close();
}

console.log(`\nwp-f3-rolstart: ${stappen.length - fouten}/${stappen.length} OK`);
process.exit(fouten > 0 ? 1 : 0);
