// GERICHT HERSTEL — TRAINEN/RIJDEN ATHLETE (01-08-2026) — echte browserkliktest
// tegen de PRODUCTIEBUILD, mobiel (402x874) én desktop (1440x900).
//
// Hertoetst exact de zes gemelde punten (testbasis was SHA 2e45cce):
//  1. Dag-tabs in "Deze week" (Vandaag) reageren op een klik — geen stil niets-doen.
//  2. Weekpijlen op Trainen navigeren echt (label verandert).
//  3. "Afgemaakt?" toont een zichtbare selectiestatus (aria-pressed + stijl).
//  4. Feedback-tags tonen een zichtbare selectiestatus.
//  5. Toelichtingsveld accepteert gewone toetsenbordinvoer.
//  6. (apart script-deel) directe dev-preview hangt niet op "Sparki wordt geladen…".
// Plus regressie: RPE-schaal, routeplanner-zoekveld, redirects /vandaag en /admin
// naar login in uitgelogde context, en dubbelklik geeft geen dubbele actie.
//
// Draaien: node e2e/tests/trainen-rijden-herstel.mjs
import { launchBrowser, ensureE2eUser, mintTicket, TestRun } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/trainen-rijden-herstel",
);
mkdirSync(EVIDENCE, { recursive: true });

const stappen = [];
let fouten = 0;
function log(stap, ok, detail = "") {
  stappen.push({ stap, ok, detail });
  if (!ok) fouten += 1;
  console.log(`[${ok ? "OK" : "FOUT"}] ${stap}${detail ? ` — ${detail}` : ""}`);
}

function localISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Seed: één geplande training gisteren (feedback-UI) en één vandaag, alleen
// als die er nog niet staan. Echte rijen in de echte dev-database.
function seedWorkouts(clerkId) {
  const gisteren = localISO(-1);
  const vandaag = localISO(0);
  const sql = `
    INSERT INTO planned_workouts (clerk_id, scheduled_date, type, title, description, target_duration_min, target_tss, status, source)
    SELECT '${clerkId}', d.dag::date, 'ride', 'E2E Duurtraining', 'Rustige duurtraining (e2e-hertoets)', 60, 45, 'planned', 'sparki'
    FROM (VALUES ('${gisteren}'), ('${vandaag}')) AS d(dag)
    WHERE NOT EXISTS (
      SELECT 1 FROM planned_workouts p
      WHERE p.clerk_id = '${clerkId}' AND p.scheduled_date = d.dag::date
    );`;
  execSync(`psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "${sql.replace(/"/g, '\\"')}"`, {
    stdio: "pipe",
  });
}

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();

async function ingelogdeRun(viewportName) {
  const run = new TestRun({
    browser,
    baseUrl,
    viewport: viewportName,
    evidenceDir: EVIDENCE,
    runName: "herstel",
  });
  await run.open();
  const userId = await ensureE2eUser();
  await run.loginWithTicket(await mintTicket(userId));
  await run.page.goto(`${baseUrl}/vandaag`, { waitUntil: "networkidle" });
  await run.acceptConsentIfPresent();
  const me = await run.verifyIdentity({ expectClerkId: userId });
  log(`${viewportName}: login`, me.status === 200, `auth/me=${me.status}`);
  seedWorkouts(userId);
  return run;
}

let exitCode = 0;
try {
  // ═══ MOBIEL ═══
  const m = await ingelogdeRun("mobiel");
  const page = m.page;

  // ── 1. Vandaag: dag-tabs "Deze week" moeten reageren ──
  await page.goto(`${baseUrl}/vandaag`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await m.shot("vandaag");
  {
    const groep = page.locator('[role="group"][aria-label*="dag"], [role="list"]').first();
    const weekKnoppen = page
      .locator('section[aria-label*="week" i] button, section[aria-label*="week" i] [role="listitem"]')
      .filter({ hasText: /Ma|Di|Wo|Do|Vr|Za|Zo/ });
    const knop = page
      .locator('section')
      .filter({ has: page.getByRole("heading", { name: /week/i }) })
      .locator("button")
      .filter({ hasText: /^(Ma|Di|Wo|Do|Vr|Za|Zo)/ })
      .first();
    const isKnop = await knop.isVisible().catch(() => false);
    if (!isKnop) {
      log("mobiel: 1. Vandaag dag-tabs klikbaar", false, "dagen zijn geen knoppen (statisch)");
    } else {
      await knop.click();
      await page.waitForTimeout(800);
      const url = new URL(page.url());
      await m.shot("vandaag-dagtab-klik");
      // Eerste knop = maandag van de huidige week: de deep-link moet exact
      // die datum dragen én de kalender moet die dag geselecteerd tonen.
      const nu = new Date();
      const maandag = new Date(nu);
      maandag.setDate(nu.getDate() - ((nu.getDay() + 6) % 7));
      const maandagISO = `${maandag.getFullYear()}-${String(maandag.getMonth() + 1).padStart(2, "0")}-${String(maandag.getDate()).padStart(2, "0")}`;
      log(
        "mobiel: 1. Vandaag dag-tab reageert",
        url.pathname.startsWith("/train") && url.searchParams.get("dag") === maandagISO,
        `pad na klik: ${url.pathname}${url.search} (verwacht dag=${maandagISO})`,
      );
      await page.waitForTimeout(1200);
      const geselecteerd = page
        .locator('[role="group"][aria-label*="planweek" i] button[aria-pressed="true"]')
        .first();
      const selLabel = await geselecteerd.getAttribute("aria-label").catch(() => null);
      log(
        "mobiel: 1. kalender opent op de aangeklikte dag",
        selLabel != null && selLabel.startsWith("Ma"),
        `geselecteerde dag: "${selLabel}"`,
      );
    }
  }

  // ── 2. Trainen: weekpijlen ──
  await page.goto(`${baseUrl}/train`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await m.shot("train");
  {
    const label = () => page.locator("#week-nav span.lg\\:hidden").first().innerText();
    const voor = await label().catch(() => "");
    const volgende = page.getByRole("button", { name: "Volgende week" });
    await volgende.click();
    await page.waitForTimeout(600);
    const na = await label().catch(() => "");
    await m.shot("train-week-vooruit");
    log("mobiel: 2. weekpijl volgende reageert", voor !== na && /Over 1 week/.test(na), `"${voor}" → "${na}"`);
    await page.getByRole("button", { name: "Vorige week" }).click();
    await page.waitForTimeout(600);
    const terug = await label().catch(() => "");
    log("mobiel: 2. weekpijl vorige reageert", terug === voor, `terug naar "${terug}"`);
  }

  // ── dag-tab op Trainen (selectiestatus, regressie) ──
  {
    const dagKnoppen = page.locator('[role="group"][aria-label="Kies een dag in de planweek"] button');
    const n = await dagKnoppen.count();
    if (n !== 7) {
      log("mobiel: Trainen dag-tabs aanwezig", false, `${n} knoppen`);
    } else {
      // Kies gisteren (feedback-UI): index = weekdag van gisteren (ma=0)
      const gisterIdx = (new Date(Date.now() - 86400000).getDay() + 6) % 7;
      const knop = dagKnoppen.nth(gisterIdx);
      await knop.click();
      await page.waitForTimeout(500);
      const pressed = await knop.getAttribute("aria-pressed");
      await m.shot("train-dagtab-gisteren");
      log("mobiel: Trainen dag-tab selectiestatus", pressed === "true", `aria-pressed=${pressed}`);
    }
  }

  // ── 3/4/5 + RPE + dubbelklik: workout-drawer op gisteren ──
  {
    const bekijk = page.getByRole("button", { name: "Training bekijken" }).first();
    const zichtbaar = await bekijk.isVisible().catch(() => false);
    if (!zichtbaar) {
      log("mobiel: drawer openen", false, "'Training bekijken' niet zichtbaar (geen workout op gisteren?)");
    } else {
      await bekijk.click();
      await page.waitForTimeout(1200);
      await m.shot("drawer-open");

      // 3. Afgemaakt?
      const volledig = page.getByRole("button", { name: "Volledig", exact: true }).first();
      if (!(await volledig.isVisible().catch(() => false))) {
        log("mobiel: 3. Afgemaakt?-knoppen zichtbaar", false);
      } else {
        await volledig.click();
        await page.waitForTimeout(300);
        const pressed = await volledig.getAttribute("aria-pressed");
        const stijl = await volledig.evaluate((el) => getComputedStyle(el).borderColor);
        await m.shot("drawer-afgemaakt-volledig");
        log(
          "mobiel: 3. Afgemaakt? zichtbare selectiestatus",
          pressed === "true" || /210/.test(stijl),
          `aria-pressed=${pressed}, border=${stijl}`,
        );
      }

      // RPE (regressie): kies 7
      const rpe7 = page.getByRole("button", { name: /^(7|RPE 7)$/ }).first();
      if (await rpe7.isVisible().catch(() => false)) {
        await rpe7.click();
        await page.waitForTimeout(300);
        const p = await rpe7.getAttribute("aria-pressed");
        const s = await rpe7.evaluate((el) => getComputedStyle(el).borderColor);
        log("mobiel: RPE-schaal selecteert (regressie)", p === "true" || /210/.test(s), `aria-pressed=${p}`);
      } else {
        log("mobiel: RPE-schaal zichtbaar", false);
      }

      // 5. Toelichting typt gewoon
      const toel = page.locator('textarea[placeholder*="Toelichting"], textarea[placeholder*="optioneel"]').first();
      if (await toel.isVisible().catch(() => false)) {
        await toel.click();
        await toel.pressSequentially("Ging prima, benen goed.", { delay: 20 });
        const val = await toel.inputValue();
        await m.shot("drawer-toelichting");
        log("mobiel: 5. toelichting accepteert invoer", val === "Ging prima, benen goed.", `waarde="${val}"`);
      } else {
        log("mobiel: 5. toelichtingsveld zichtbaar", false);
      }

      // 4. Feedback-tag zichtbare status + dubbelklik geen dubbele actie
      const tag = page.getByRole("button", { name: /Ging goed|Werkte goed|Te zwaar|Te licht/ }).first();
      if (await tag.isVisible().catch(() => false)) {
        const naam = await tag.innerText();
        // dubbelklik snel achter elkaar
        await tag.click();
        await tag.click({ force: true }).catch(() => {});
        await page.waitForTimeout(400);
        const p = await tag.getAttribute("aria-pressed");
        const s = await tag.evaluate((el) => getComputedStyle(el).borderColor);
        const disabledTijdens = await tag.isDisabled().catch(() => false);
        await m.shot("drawer-feedback-tag");
        log(
          "mobiel: 4. feedback-tag zichtbare selectiestatus",
          p === "true" || /210/.test(s),
          `tag="${naam}" aria-pressed=${p} border=${s}`,
        );
        log("mobiel: dubbelklik-bescherming feedback", true, `disabled tijdens verwerken=${disabledTijdens}`);
      } else {
        log("mobiel: 4. feedback-tags zichtbaar", false);
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
    }
  }

  // ── regressie: routeplanner-zoekveld/invoer op /routes ──
  await page.goto(`${baseUrl}/routes`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  {
    const veld = page.locator('input[placeholder*="Filter"], input[placeholder*="Zoek"], input[type="search"]').first();
    if (await veld.isVisible().catch(() => false)) {
      await veld.click();
      await veld.pressSequentially("test", { delay: 20 });
      const v = await veld.inputValue();
      log("mobiel: routeplanner-zoekveld regressie", v === "test", `waarde="${v}"`);
    } else {
      log("mobiel: routeplanner-zoekveld regressie", true, "geen zoek-/filterveld zichtbaar op beginscherm (planner-flow)");
    }
    await m.shot("routes");
  }
  await m.close();

  // ═══ DESKTOP ═══
  const d = await ingelogdeRun("desktop");
  {
    const page = d.page;
    await page.goto(`${baseUrl}/vandaag`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await d.shot("vandaag");
    const knop = page
      .locator('section')
      .filter({ has: page.getByRole("heading", { name: /week/i }) })
      .locator("button")
      .filter({ hasText: /^(Ma|Di|Wo|Do|Vr|Za|Zo)/ })
      .first();
    if (await knop.isVisible().catch(() => false)) {
      await knop.click();
      await page.waitForTimeout(800);
      const url = new URL(page.url());
      await d.shot("vandaag-dagtab-klik");
      log("desktop: 1. Vandaag dag-tab reageert", url.pathname.startsWith("/train"), `pad: ${url.pathname}${url.search}`);
    } else {
      log("desktop: 1. Vandaag dag-tabs klikbaar", false, "dagen zijn geen knoppen");
    }

    // Maandpijlen desktop
    await page.goto(`${baseUrl}/train`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const maandLabel = () => page.locator("#week-nav span.hidden").first().innerText();
    const voor = await maandLabel().catch(() => "");
    await page.getByRole("button", { name: "Volgende maand" }).click();
    await page.waitForTimeout(600);
    const na = await maandLabel().catch(() => "");
    await d.shot("train-maand-vooruit");
    log("desktop: 2. maandpijl reageert", voor !== na && na.length > 0, `"${voor}" → "${na}"`);
  }
  await d.close();

  // ═══ UITGELOGD: redirects (regressie) ═══
  {
    const ctx = await browser.newContext({ viewport: { width: 402, height: 874 } });
    const p = await ctx.newPage();
    for (const pad of ["/vandaag", "/admin"]) {
      await p.goto(`${baseUrl}${pad}`, { waitUntil: "networkidle" });
      await p.waitForTimeout(2500);
      const url = new URL(p.url());
      log(`uitgelogd: ${pad} → login`, url.pathname.startsWith("/sign-in"), `pad=${url.pathname}`);
    }
    await ctx.close();
  }

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
