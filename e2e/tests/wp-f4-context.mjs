// SPARKI_BUILD_01 F4 (BB-06/BB-07) — multi-role context en navigatie.
// Echte browserkliks tegen de PRODUCTIEBUILD:
//  1. Contextregel (actieve rol · organisatie · team) permanent zichtbaar.
//  2. Rolwissel zonder nieuwe login: menu → "Rol: …" wisselt de actieve rol,
//     de onderbalk en contextregel verversen direct (geen reload/herlogin).
//  3. Vaste vijf posities per rol, positie 5 = Meer (BB-06); geen zesde (BB-07).
//  4. Terugknop blijft werken na een contextwissel.
//  5. Contextkiezer toont geen aantallen of informatie uit niet-actieve
//     contexten (alleen het rollabel).
//  6. Server-side contextvalidatie: rol wisselen naar een rol die het account
//     niet heeft → 403.
//
// Draaien: node e2e/tests/wp-f4-context.mjs
import { execSync } from "node:child_process";
import { launchBrowser, TestRun, mintTicket, ensureE2eUser } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/wp-f4-context",
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

const API = process.env.E2E_API_TARGET ?? "http://127.0.0.1:80";

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();
let userId = null;
try {
  const run = new TestRun({
    browser,
    baseUrl,
    viewport: "mobiel",
    evidenceDir: EVIDENCE,
    runName: "context",
  });
  await run.open();
  userId = await ensureE2eUser();
  await run.loginWithTicket(await mintTicket(userId));
  await run.page.goto(`${baseUrl}/vandaag`, { waitUntil: "networkidle" });
  await run.acceptConsentIfPresent();
  const me = await run.verifyIdentity({ expectClerkId: userId });
  log("login", me.status === 200, `auth/me=${me.status}`);
  const page = run.page;

  // Twee rollen: sporter + coach (contextwissel testbaar), start als sporter.
  psql(
    `UPDATE user_profiles SET roles = (SELECT array_agg(DISTINCT r) FROM unnest(roles || '{coach}') r), active_role = 'athlete', updated_at = now() WHERE clerk_id = '${userId}'`,
  );

  // 1. Contextregel permanent zichtbaar op de sporter-home.
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const rolBadge = page.locator('[data-testid="context-rol"]').first();
  const rolTekst = (await rolBadge.innerText().catch(() => "")).toUpperCase();
  log("contextregel zichtbaar met actieve rol", rolTekst.includes("SPORTER"), rolTekst);
  await page.screenshot({ path: path.join(EVIDENCE, "context-athlete.png") });

  // 2+5. Rolwissel via het menu op een ScreenShell-pagina, zonder herlogin.
  await page.goto(`${baseUrl}/you`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.locator('button[aria-label="Menu openen"]').first().click();
  const rolKnop = page.locator('button[title="Wissel van rol"]');
  const kiezerTekst = await rolKnop.innerText().catch(() => "");
  log("contextkiezer zichtbaar", kiezerTekst.length > 0, kiezerTekst);
  log(
    "contextkiezer zonder aantallen uit andere contexten",
    !/\d/.test(kiezerTekst),
    kiezerTekst,
  );
  await rolKnop.click();
  await page.waitForTimeout(1500);
  const actiefNa = psql(
    `SELECT active_role FROM user_profiles WHERE clerk_id='${userId}'`,
  );
  log("rolwissel zonder herlogin doorgevoerd (server)", actiefNa === "coach", actiefNa);
  // Contextregel en navigatie verversen zonder reload.
  await page.locator('button[aria-label="Menu sluiten"]').first().click().catch(() => {});
  await page.waitForTimeout(800);
  const rolNa = (
    await page.locator('[data-testid="context-rol"]').first().innerText().catch(() => "")
  ).toUpperCase();
  log("contextregel toont nieuwe rol zonder reload", rolNa.includes("COACH"), rolNa);
  await page.screenshot({ path: path.join(EVIDENCE, "context-coach.png") });

  // 3. BB-06: onderbalk = vijf posities, positie 5 = Meer, geen zesde.
  const navItems = await page
    .locator("nav")
    .last()
    .locator("a,button")
    .allInnerTexts()
    .catch(() => []);
  const labels = navItems.map((t) => t.trim()).filter(Boolean);
  log("vijf posities in de onderbalk (BB-06/BB-07)", labels.length === 5, labels.join(" · "));
  log("positie 5 heet Meer", labels[4] === "Meer", labels.join(" · "));

  // 4. Terugknop werkt na contextwissel.
  await page.goto(`${baseUrl}/invitations`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.goBack({ waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const terugUrl = page.url();
  log("terugknop na contextwissel", terugUrl.endsWith("/you"), terugUrl);

  // 6. Server-side contextvalidatie: rol die het account niet heeft → 403.
  const resp = await fetch(`${API}/api/auth/me/role`, {
    method: "PUT",
    headers: { "content-type": "application/json", "x-dev-clerk-id": userId },
    body: JSON.stringify({ role: "parent" }),
  });
  log("serverweigering rol zonder toekenning (403)", resp.status === 403, `status=${resp.status}`);

  await run.close();
} finally {
  if (userId) {
    try {
      psql(
        `UPDATE user_profiles SET roles = array_remove(array_remove(roles, 'coach'), 'nutrition_specialist'), active_role = 'athlete', updated_at = now() WHERE clerk_id = '${userId}'`,
      );
    } catch {}
  }
  await browser.close();
  server.close();
}

console.log(`\nwp-f4-context: ${stappen.length - fouten}/${stappen.length} OK`);
process.exit(fouten > 0 ? 1 : 0);
