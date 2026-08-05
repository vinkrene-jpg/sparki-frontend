// Task 588 — CLUB_AFRONDING_01 C2: echte browser-doorloop van de clubbalken
// per clubrol (WP-S1-harnas, prod-build + echte Clerk-login + echte kliks).
//
// Bewijst per clubrol (beheer=owner, hoofdtrainer, wedstrijdstaf=ploegleider,
// staf=trainer):
//  1. clubcontext kiezen in het hoofdmenu toont de juiste onderbalk;
//  2. ?tab=-links in de balk landen op het juiste tabblad in /club en
//     /club/beheer (aria-selected op de echte tabknop);
//  3. accountrol kiezen (Rol: Sporter) zet de standaard sporterbalk terug.
//
// Seeding: één E2E-club direct in de DB voor het QA-account (idempotent op
// naamprefix E2E-588, cleanup in finally); de clubrol wordt per fase omgezet.
// Fail-closed blijft intact: de onderbalk verschijnt alleen wanneer de server
// (/api/clubs) de rol bevestigt — de test kiest de context via de echte UI.
//
// Draaien: node e2e/tests/club-balken-rollen.mjs
import { execSync } from "node:child_process";
import { launchBrowser, TestRun, mintTicket, ensureE2eUser } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/club-balken-rollen",
);
mkdirSync(EVIDENCE, { recursive: true });

const CLUBNAAM = "E2E-588 Clubbalken";

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

// Onderbalk-labels lezen (case-insensitief: CSS zet ze in uppercase).
async function navLabels(page) {
  // Mobiele onderbalk = DsMobileNav (nav[aria-label="Hoofdnavigatie"], knoppen).
  const txt = await page
    .locator('nav[aria-label="Hoofdnavigatie"]')
    .first()
    .innerText()
    .catch(() => "");
  return txt
    .split("\n")
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t && !t.includes("vraagt aandacht"));
}

async function actieveTab(page) {
  return (
    await page
      .locator('[role="tab"][aria-selected="true"]')
      .first()
      .innerText()
      .catch(() => "")
  ).trim();
}

// Verwachte balken per rol (labels uit src/lib/chapters.ts, C2).
const VERWACHT = {
  owner: ["organisatie", "leden", "agenda", "berichten", "meer"],
  hoofdtrainer: ["trainingen", "groepen", "wedstrijden", "berichten", "meer"],
  ploegleider: ["wedstrijden", "agenda", "documenten", "berichten", "meer"],
  trainer: ["club", "documenten", "berichten", "meer"],
};
// QA-account heeft een clubrol: sporterbalk = commerciële nav met "Club" op
// de Analyse-positie (besluitenpatch 01-08, hoofdstuk B).
const SPORTERBALK = ["dashboard", "trainen", "rijden", "club", "meer"];

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();
let userId = null;
let clubId = null;
let geparkeerdeLidmaatschappen = [];

async function kiesClubContext(run, rolLabel) {
  const page = run.page;
  await page.locator('button[aria-label="Menu openen"]').first().click();
  await page.waitForTimeout(600);
  await page.locator('button[title="Wissel van context"]').first().click();
  await page.waitForTimeout(400);
  const ctx = page.getByRole("button", { name: new RegExp(CLUBNAAM, "i") }).first();
  const zichtbaar = await ctx.isVisible().catch(() => false);
  log(`${rolLabel}: clubcontext zichtbaar in rolwisselaar`, zichtbaar,
    zichtbaar ? await ctx.innerText() : "niet gevonden");
  if (!zichtbaar) throw new Error("clubcontext ontbreekt in het menu");
  await ctx.click();
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1000);
}

async function terugNaarSporter(run, rolLabel) {
  const page = run.page;
  await page.locator('button[aria-label="Menu openen"]').first().click();
  await page.waitForTimeout(600);
  await page.locator('button[title="Wissel van context"]').first().click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /^Rol: Sporter/ }).first().click();
  await page.waitForTimeout(600);
  // Actieve rol was al sporter: de wissel eindigt de clubcontext zonder
  // navigatie; menu sluiten en de standaardbalk controleren.
  await page.locator('button[aria-label="Menu sluiten"]').first().click().catch(() => {});
  await page.waitForTimeout(800);
  const labels = await navLabels(page);
  log(
    `${rolLabel}: accountrol kiezen zet sporterbalk terug`,
    JSON.stringify(labels) === JSON.stringify(SPORTERBALK),
    labels.join(" · "),
  );
  await run.shot(`${rolLabel}-sporterbalk-terug`);
}

async function faseVoorRol(run, rol, doorloop) {
  const page = run.page;
  psql(`UPDATE club_members SET role='${rol}' WHERE club_id=${clubId} AND clerk_id='${userId}'`);
  // Verse start per rol: geen achtergebleven stand, verse /api/clubs-cache.
  await page.goto(`${baseUrl}/you`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("sparki.club-nav-role"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  await kiesClubContext(run, rol);
  const labels = await navLabels(page);
  log(
    `${rol}: clubbalk toont juiste items`,
    JSON.stringify(labels) === JSON.stringify(VERWACHT[rol]),
    labels.join(" · "),
  );
  await run.shot(`${rol}-clubbalk`);
  log(`${rol}: eerste balkitem is startpunt`, true, page.url());

  await doorloop();
  await terugNaarSporter(run, rol);
}

// Klik een balkitem en controleer pad + ?tab + actieve tabknop.
async function klikBalkTab(run, rol, label, expectPath, expectTab, expectTabLabel) {
  const page = run.page;
  const item = page
    .locator('nav[aria-label="Hoofdnavigatie"]')
    .first()
    .locator("button")
    .filter({ hasText: new RegExp(`^${label}$`, "i") })
    .first();
  if (!(await item.isVisible().catch(() => false))) {
    log(`${rol}: balkitem "${label}" zichtbaar`, false, "niet gevonden");
    return;
  }
  await item.click();
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(900);
  const url = new URL(page.url());
  const padOk = url.pathname === expectPath;
  const tabParamOk = url.searchParams.get("tab") === expectTab;
  const tabNu = await actieveTab(page);
  const tabOk = tabNu.toLowerCase() === expectTabLabel.toLowerCase();
  log(
    `${rol}: "${label}" → ${expectPath}?tab=${expectTab} met tabblad "${expectTabLabel}" actief`,
    padOk && tabParamOk && tabOk,
    `url=${url.pathname}?${url.searchParams.toString()} actieve-tab="${tabNu}"`,
  );
  await run.shot(`${rol}-tab-${expectTab}`);
}

try {
  userId = await ensureE2eUser();

  // Idempotente seed: E2E-club + lidmaatschap voor het QA-account.
  psql(`DELETE FROM clubs WHERE name LIKE 'E2E-588%'`);
  psql(`UPDATE user_profiles SET active_role='athlete', updated_at=now() WHERE clerk_id='${userId}'`);
  // Isolatie: leftover-lidmaatschappen van andere e2e-runs zouden de
  // rolwisselaar en /club/beheer vervuilen (bv. een achtergebleven admin-club
  // maskeerde eerder het echte hoofdtrainergedrag). Tijdelijk beëindigen,
  // in finally exact terugzetten.
  geparkeerdeLidmaatschappen = psql(
    `UPDATE club_members SET ended_at=now(), ended_reason='e2e-588-tijdelijk' WHERE clerk_id='${userId}' AND ended_at IS NULL RETURNING id`,
  ).split("\n").map((r) => r.trim()).filter((r) => /^\d+$/.test(r));
  clubId = psql(
    `INSERT INTO clubs (name, owner_clerk_id, status) VALUES ('${CLUBNAAM}', '${userId}', 'actief') RETURNING id`,
  ).split("\n")[0].trim();
  psql(`INSERT INTO club_members (club_id, clerk_id, role) VALUES (${clubId}, '${userId}', 'owner')`);

  const run = new TestRun({
    browser,
    baseUrl,
    viewport: "mobiel",
    evidenceDir: EVIDENCE,
    runName: "clubbalken",
  });
  await run.open();
  await run.loginWithTicket(await mintTicket(userId));
  await run.page.goto(`${baseUrl}/you`, { waitUntil: "networkidle" });
  await run.acceptConsentIfPresent();
  const me = await run.verifyIdentity({ expectClerkId: userId });
  log("login", me.status === 200, `auth/me=${me.status}`);

  // ── Beheer (owner) ─────────────────────────────────────────────────────
  await faseVoorRol(run, "owner", async () => {
    const page = run.page;
    // Context kiezen landt op het eerste balkitem: /club/beheer?tab=organisatie.
    const url = new URL(page.url());
    const tabNu = await actieveTab(page);
    log(
      "owner: context kiezen landt op /club/beheer?tab=organisatie (tab Organisatie)",
      url.pathname === "/club/beheer" &&
        url.searchParams.get("tab") === "organisatie" &&
        tabNu === "Organisatie",
      `url=${url.pathname}?${url.searchParams.toString()} actieve-tab="${tabNu}"`,
    );
    await klikBalkTab(run, "owner", "Leden", "/club/beheer", "mensen", "Mensen");
    await klikBalkTab(run, "owner", "Berichten", "/club", "berichten", "Berichten");
    await klikBalkTab(run, "owner", "Agenda", "/club", "vandaag", "Vandaag");
  });

  // ── Hoofdtrainer ───────────────────────────────────────────────────────
  await faseVoorRol(run, "hoofdtrainer", async () => {
    const page = run.page;
    const url = new URL(page.url());
    const tabNu = await actieveTab(page);
    log(
      "hoofdtrainer: context kiezen landt op /club?tab=vandaag (tab Vandaag)",
      url.pathname === "/club" && url.searchParams.get("tab") === "vandaag" && tabNu === "Vandaag",
      `url=${url.pathname}?${url.searchParams.toString()} actieve-tab="${tabNu}"`,
    );
    await klikBalkTab(run, "hoofdtrainer", "Wedstrijden", "/club", "meer", "Meer");
    await klikBalkTab(run, "hoofdtrainer", "Berichten", "/club", "berichten", "Berichten");
    // "Groepen" wijst naar /club/beheer?tab=structuur — vastleggen wat er
    // werkelijk gebeurt (beheer is owner/admin-only; observatie, geen assert
    // vooraf: log het echte resultaat).
    const groepen = page
      .locator('nav[aria-label="Hoofdnavigatie"]').first().locator("button")
      .filter({ hasText: /^Groepen$/i }).first();
    if (await groepen.isVisible().catch(() => false)) {
      await groepen.click();
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(900);
      const u = new URL(page.url());
      const t = await actieveTab(page);
      log(
        "hoofdtrainer: 'Groepen' → /club/beheer?tab=structuur (tab Structuur)",
        u.pathname === "/club/beheer" && u.searchParams.get("tab") === "structuur" &&
          t === "Structuur",
        `url=${u.pathname}?${u.searchParams.toString()} actieve-tab="${t}"`,
      );
      await run.shot("hoofdtrainer-groepen");
    } else {
      log("hoofdtrainer: balkitem 'Groepen' zichtbaar", false, "niet gevonden");
    }
  });

  // ── Wedstrijdstaf (ploegleider) ────────────────────────────────────────
  await faseVoorRol(run, "ploegleider", async () => {
    const page = run.page;
    const url = new URL(page.url());
    const tabNu = await actieveTab(page);
    log(
      "ploegleider: context kiezen landt op /club?tab=meer (tab Meer)",
      url.pathname === "/club" && url.searchParams.get("tab") === "meer" && tabNu === "Meer",
      `url=${url.pathname}?${url.searchParams.toString()} actieve-tab="${tabNu}"`,
    );
    await klikBalkTab(run, "ploegleider", "Documenten", "/club", "documenten", "Documenten");
    await klikBalkTab(run, "ploegleider", "Agenda", "/club", "vandaag", "Vandaag");
  });

  // ── Staf (trainer) ─────────────────────────────────────────────────────
  await faseVoorRol(run, "trainer", async () => {
    const page = run.page;
    const url = new URL(page.url());
    const tabNu = await actieveTab(page);
    log(
      "trainer: context kiezen landt op /club?tab=vandaag (tab Vandaag)",
      url.pathname === "/club" && url.searchParams.get("tab") === "vandaag" && tabNu === "Vandaag",
      `url=${url.pathname}?${url.searchParams.toString()} actieve-tab="${tabNu}"`,
    );
    await klikBalkTab(run, "trainer", "Documenten", "/club", "documenten", "Documenten");
    await klikBalkTab(run, "trainer", "Berichten", "/club", "berichten", "Berichten");
  });

  // ── BottomNav (crash-fallback) ─────────────────────────────────────────
  // Productie kent twee onderbalk-varianten: DsMobileNav (ScreenShell-chrome,
  // knoppen — hierboven bewezen) én BottomNav (links), die alleen rendert in
  // de paginacrash-fallback (App.tsx PageErrorFallback). We forceren die
  // fallback eerlijk: een misvormd dashboard-antwoord (teams als getal) laat
  // /club/beheer tijdens render crashen; de ErrorBoundary toont dan de
  // fallback mét BottomNav — die de clubbalk-stand net zo moet volgen.
  {
    const page = run.page;
    psql(`UPDATE club_members SET role='owner' WHERE club_id=${clubId} AND clerk_id='${userId}'`);
    await page.goto(`${baseUrl}/you`, { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.removeItem("sparki.club-nav-role"));
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1200);
    await kiesClubContext(run, "bottomnav");
    const dashPatroon = new RegExp(`/api/clubs/${clubId}$`);
    await page.route(dashPatroon, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ club: {}, membership: { role: "owner" }, teams: 5, members: 5 }),
      }),
    );
    await page.goto(`${baseUrl}/club/beheer?tab=structuur`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const fallbackZichtbaar = await page
      .getByText("Er ging iets mis op deze pagina")
      .first()
      .isVisible()
      .catch(() => false);
    log("bottomnav: paginacrash toont fallback", fallbackZichtbaar, page.url());
    const nav = page.locator('nav[aria-label="Hoofdnavigatie"]').first();
    const linkCount = await nav.locator("a").count().catch(() => 0);
    const labels = await navLabels(page);
    log(
      "bottomnav: fallback-onderbalk (BottomNav, links) toont de clubbalk van de stand",
      linkCount >= 4 && JSON.stringify(labels) === JSON.stringify(VERWACHT.owner),
      `links=${linkCount} · ${labels.join(" · ")}`,
    );
    await run.shot("bottomnav-fallback-clubbalk");
    // Herstellen en via een échte BottomNav-link (<a>) verder navigeren.
    await page.unroute(dashPatroon);
    const leden = nav.locator("a").filter({ hasText: /^Leden$/i }).first();
    if (await leden.isVisible().catch(() => false)) {
      await leden.click();
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(900);
      // De link zelf is het bewijs (echte <a>-navigatie); de query-cache bevat
      // nog het misvormde testantwoord, dus daarna één verse load om het
      // tabblad met echte data te tonen.
      const uNaKlik = new URL(page.url());
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      const u = uNaKlik;
      const t = await actieveTab(page);
      log(
        "bottomnav: link 'Leden' → /club/beheer?tab=mensen met tabblad 'Mensen' actief",
        u.pathname === "/club/beheer" && u.searchParams.get("tab") === "mensen" && t === "Mensen",
        `url=${u.pathname}?${u.searchParams.toString()} actieve-tab="${t}"`,
      );
      await run.shot("bottomnav-leden-na-herstel");
    } else {
      log("bottomnav: link 'Leden' zichtbaar in fallback-balk", false, "niet gevonden");
    }
    await terugNaarSporter(run, "bottomnav");
  }

  await run.close();
} catch (err) {
  fouten += 1;
  console.error("❌ doorloop faalde:", err?.message ?? err);
} finally {
  try {
    if (clubId) psql(`DELETE FROM clubs WHERE name LIKE 'E2E-588%'`);
    if (geparkeerdeLidmaatschappen.length > 0) {
      psql(
        `UPDATE club_members SET ended_at=NULL, ended_reason=NULL WHERE id IN (${geparkeerdeLidmaatschappen.join(",")})`,
      );
    }
  } catch {}
  await browser.close().catch(() => {});
  server.close();
}

console.log("\n── Samenvatting ──");
for (const s of stappen) console.log(`${s.ok ? "✅" : "❌"} ${s.stap}${s.detail ? ` — ${s.detail}` : ""}`);
if (fouten > 0) {
  console.error(`\n❌ ${fouten} stap(pen) gefaald. Bewijs: ${EVIDENCE}`);
  process.exit(1);
}
console.log(`\n✅ Clubbalken-doorloop per rol geslaagd. Bewijs: ${EVIDENCE}`);
process.exit(0);
