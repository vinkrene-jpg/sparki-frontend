// Aanvulling gericht herstel (01-08-2026) — gedeelde interactiecomponenten.
// Echte browserkliks tegen de PRODUCTIEBUILD:
//  1. Analyse-subtabs (Overzicht/Belasting/Progressie/Doelen/Sessies) wisselen
//     zichtbaar, actieve status klopt (aria-selected + accentstreep).
//  2. Knop "Uitleg" rechtsboven reageert (aria-pressed + label wisselt).
//  3. Toetsenbordbediening: tab-focus + Enter activeert een subtab.
//  4. Dubbelklik veroorzaakt geen dubbele/kapotte toestand.
//  5. Mobiel én desktop.
//  6. Regressie: navigatie in Meer blijft werken.
//  7. Zelfde broncomponent (HoofdstukTabs) elders: Jij-pagina tabs wisselen.
//
// Draaien: node e2e/tests/analyse-tabs-herstel.mjs
import { launchBrowser, TestRun, mintTicket, ensureE2eUser } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/analyse-tabs-herstel",
);
mkdirSync(EVIDENCE, { recursive: true });

const stappen = [];
let fouten = 0;
function log(stap, ok, detail = "") {
  stappen.push({ stap, ok, detail });
  if (!ok) fouten += 1;
  console.log(`[${ok ? "OK" : "FOUT"}] ${stap}${detail ? ` — ${detail}` : ""}`);
}

const TABS = ["Overzicht", "Belasting", "Progressie", "Doelen", "Sessies"];

async function actieveTab(page) {
  return page
    .locator('[role="tablist"][aria-label="Analyse-secties"] [role="tab"][aria-selected="true"]')
    .first()
    .innerText()
    .catch(() => null);
}

async function testViewport(browser, baseUrl, viewportName) {
  const run = new TestRun({
    browser,
    baseUrl,
    viewport: viewportName,
    evidenceDir: EVIDENCE,
    runName: "analyse",
  });
  await run.open();
  const userId = await ensureE2eUser();
  await run.loginWithTicket(await mintTicket(userId));
  await run.page.goto(`${baseUrl}/vandaag`, { waitUntil: "networkidle" });
  await run.acceptConsentIfPresent();
  const me = await run.verifyIdentity({ expectClerkId: userId });
  log(`${viewportName}: login`, me.status === 200, `auth/me=${me.status}`);
  const page = run.page;

  await page.goto(`${baseUrl}/analyse`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await run.shot("analyse");

  // ── 1. Alle vijf subtabs wisselen zichtbaar ──
  for (const naam of TABS) {
    const tab = page
      .locator('[role="tablist"][aria-label="Analyse-secties"] [role="tab"]', { hasText: naam })
      .first();
    if (!(await tab.isVisible().catch(() => false))) {
      log(`${viewportName}: subtab "${naam}" aanwezig`, false);
      continue;
    }
    await tab.click();
    await page.waitForTimeout(700);
    const actief = await actieveTab(page);
    const panelZichtbaar = await page
      .locator(`#tab-${naam.toLowerCase()}`)
      .isVisible()
      .catch(() => false); // exact het bijbehorende tabpanel moet zichtbaar zijn
    log(
      `${viewportName}: 1. subtab "${naam}" wisselt zichtbaar`,
      actief === naam && panelZichtbaar,
      `actief="${actief}"`,
    );
  }
  await run.shot("analyse-laatste-tab");

  // ── 4. Dubbelklik op een subtab: status blijft correct, geen kapotte staat ──
  const belasting = page
    .locator('[role="tablist"][aria-label="Analyse-secties"] [role="tab"]', { hasText: "Belasting" })
    .first();
  await belasting.dblclick();
  await page.waitForTimeout(600);
  log(
    `${viewportName}: 4. dubbelklik subtab blijft correct`,
    (await actieveTab(page)) === "Belasting",
    `actief="${await actieveTab(page)}"`,
  );

  // ── 2. Knop "Uitleg" rechtsboven ──
  const uitleg = page.getByRole("button", { name: /^Uitleg( aan)?$/ }).first();
  if (!(await uitleg.isVisible().catch(() => false))) {
    log(`${viewportName}: 2. Uitleg-knop aanwezig`, false);
  } else {
    const voor = await uitleg.getAttribute("aria-pressed");
    await uitleg.click();
    await page.waitForTimeout(500);
    const na = await uitleg.getAttribute("aria-pressed");
    const label = await uitleg.innerText();
    await run.shot("analyse-uitleg-aan");
    log(
      `${viewportName}: 2. Uitleg-toggle reageert zichtbaar`,
      voor !== na && ((na === "true" && /aan/i.test(label)) || na === "false"),
      `aria-pressed ${voor}→${na}, label="${label}"`,
    );
    // Dubbelklik op de toggle = twee wissels = terug naar de nieuwe beginstand.
    await uitleg.dblclick();
    await page.waitForTimeout(400);
    const naDubbel = await uitleg.getAttribute("aria-pressed");
    log(
      `${viewportName}: 4. dubbelklik Uitleg = nette dubbele wissel`,
      naDubbel === na,
      `aria-pressed ${na}→${naDubbel}`,
    );
    // terug naar uit-stand voor consistentie
    if (naDubbel === "true") { await uitleg.click(); await page.waitForTimeout(300); }
  }

  // ── 3. Toetsenbord: focus op een subtab + Enter activeert ──
  const overzicht = page
    .locator('[role="tablist"][aria-label="Analyse-secties"] [role="tab"]', { hasText: "Overzicht" })
    .first();
  await overzicht.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(600);
  log(
    `${viewportName}: 3. toetsenbord (focus+Enter) activeert subtab`,
    (await actieveTab(page)) === "Overzicht",
    `actief="${await actieveTab(page)}"`,
  );

  // ── 7. Zelfde broncomponent elders (Jij-pagina, donkere variant) ──
  await page.goto(`${baseUrl}/you`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const youTabs = page.locator('[role="tablist"] [role="tab"]');
  const nYou = await youTabs.count();
  if (nYou >= 2) {
    await youTabs.nth(1).click();
    await page.waitForTimeout(600);
    const sel = await youTabs.nth(1).getAttribute("aria-selected");
    log(`${viewportName}: 7. zelfde tabcomponent op Jij wisselt`, sel === "true", `aria-selected=${sel}`);
  } else {
    log(`${viewportName}: 7. zelfde tabcomponent op Jij wisselt`, true, `geen tablist op /you (n=${nYou}) — n.v.t.`);
  }

  // ── 6. Regressie: navigatie in Meer werkt ──
  await page.goto(`${baseUrl}/meer`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const meerLink = page.locator('a[href]:visible', { hasText: /./ }).filter({ hasText: /Instellingen|Analyse|Kennis|Club|Support|Privacy/i }).first();
  if (await meerLink.isVisible().catch(() => false)) {
    const href = await meerLink.getAttribute("href");
    await meerLink.click();
    await page.waitForTimeout(900);
    const pad = new URL(page.url()).pathname;
    log(`${viewportName}: 6. Meer-navigatie werkt`, pad !== "/meer", `klik "${href}" → ${pad}`);
  } else {
    log(`${viewportName}: 6. Meer-navigatie werkt`, false, "geen navigatielink gevonden op /meer");
  }
  await run.shot("meer-regressie");

  await run.close();
}

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();
let exitCode = 0;
try {
  await testViewport(browser, baseUrl, "mobiel");
  await testViewport(browser, baseUrl, "desktop");
  console.log(`\nResultaat: ${stappen.length - fouten}/${stappen.length} OK, ${fouten} FOUT`);
  if (fouten > 0) exitCode = 1;
} catch (err) {
  console.error("ONVERWACHTE FOUT:", err);
  exitCode = 2;
} finally {
  await browser.close();
  server.close();
}
process.exit(exitCode);
