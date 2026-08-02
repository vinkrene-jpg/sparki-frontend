// DASHBOARD_01 Fase C — startscherm-per-pakket schermbewijs op 402×874.
//
// Per pakket-testidentiteit (governor-fixtures stand A/B/C) via ECHTE kliks in
// de DEV preview (accept-mode build): kies de identiteit in de TESTCONTEXT-
// banner, open het startscherm en leg de landing + het onderblad + de fold
// (402×874) vast. Rechten-/data-probes gaan met de x-dev-clerk-id-header, exact
// zoals de app zelf (productie-rechtenpaden).
//
// Verwachting (bindend besluit DASHBOARD_01 §4/§5/§8):
//   • Gratis  → landt op de KAART; onderblad = zoeken + bewaarde routes
//                (data-pakket="gratis"); GEEN sporter-dashboard.
//   • Go      → landt op de KAART; onderblad = routevoorstel van vandaag met
//                reden (data-pakket="go"); Dashboard is nav-positie 1.
//   • Compleet→ landt op het sporter-DASHBOARD (drie lagen, één gedaante);
//                geen kaart-onderblad.
//
// VOOR/NA met dezelfde harness:
//   • DASH_PAK_SHOT_DIR=voor → oude build (alle pakketten op CommercialToday).
//   • DASH_PAK_SHOT_DIR=na   → deze build (pakketgestuurde landing).
//
// Draaien (dev-servers moeten draaien; accept-mode preview vereist een build
// met SPARKI_ACCEPT_MODE=true):
//   DASH_PAK_SHOT_DIR=na node e2e/tests/dashboard-pakketten.mjs
import { launchBrowser, TestRun } from "../harness.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.DASH_PAK_BASE ?? "http://127.0.0.1:80";
const SUB = path.basename(process.env.DASH_PAK_SHOT_DIR ?? "na") || "na";
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EVIDENCE = path.join(
  REPO_ROOT,
  "docs/proof-evidence/DASHBOARD_01_PAKKETTEN",
  SUB,
);
mkdirSync(EVIDENCE, { recursive: true });

// De drie pakket-fixtures (WP-R0 governor-fixtures, stand A/B/C).
// `landing` = "kaart" | "dashboard"; `onderblad` = verwachte data-pakket-waarde.
const PAKKETTEN = [
  {
    id: "governor-fixture-stand-a-gratis",
    naam: "TESTFIXTURE Stand A Gratis Vers",
    pakket: "Gratis",
    landing: "kaart",
    onderblad: "gratis",
    // Eerlijkheid accounttype (memory): fixture A = gratis ZONDER carve-out
    // (entitlementMode subscription, geen productVariant/tier ⇒ isGratisBeperkt).
    probes: ["/api/billing/status", "/api/entitlements"],
  },
  {
    id: "governor-fixture-stand-b-go",
    naam: "TESTFIXTURE Stand B Go Vers",
    pakket: "Go",
    landing: "kaart",
    onderblad: "go",
    probes: ["/api/billing/status"],
  },
  {
    id: "governor-fixture-stand-c-compleet",
    naam: "TESTFIXTURE Stand C Compleet Vers",
    pakket: "Compleet",
    landing: "dashboard",
    onderblad: null,
    probes: ["/api/billing/status"],
  },
];

const filter = (process.env.DASH_PAK_FILTER ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const TE_TESTEN = filter.length
  ? PAKKETTEN.filter((r) => filter.some((f) => r.id.includes(f)))
  : PAKKETTEN;

async function probe(page, url) {
  return page.evaluate(async (u) => {
    const id = window.localStorage.getItem("sparki.dev.previewAthlete");
    const headers = id ? { "x-dev-clerk-id": id } : {};
    const r = await fetch(u, { credentials: "include", headers });
    let body = null;
    try { body = await r.json(); } catch { /* geen JSON */ }
    return { status: r.status, body };
  }, url);
}

async function foldShot(run, prefix) {
  await run.page.evaluate(() => window.scrollTo(0, 0));
  await run.page.waitForTimeout(300);
  return run.shot(`${prefix}-fold`);
}

const browser = await launchBrowser();
const rapport = [];
let failures = 0;

try {
  for (const wie of TE_TESTEN) {
    const run = new TestRun({
      browser, baseUrl: BASE, viewport: "mobiel",
      evidenceDir: EVIDENCE,
      runName: `pakket-${wie.id.replace("governor-fixture-", "")}`,
    });
    await run.open();
    const regels = [];
    const fout = (m) => { failures += 1; regels.push({ status: "FOUT", detail: m }); };
    try {
      // Kies de identiteit via de echte TESTCONTEXT-banner.
      await run.page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await run.page.waitForTimeout(600);
      await run.page.locator("button", { hasText: "TESTCONTEXT" }).first().click();
      await run.page.waitForTimeout(400);
      const pill = run.page.locator("button", { hasText: wie.naam }).first();
      if (!(await pill.isVisible().catch(() => false))) {
        fout(`identiteit "${wie.naam}" niet zichtbaar in de kiezer`);
      } else {
        await pill.scrollIntoViewIfNeeded();
        await Promise.all([run.page.waitForLoadState("load"), pill.click()]);
        await run.page.waitForTimeout(1400);
      }

      // Server-side identiteit + rol.
      const me = await probe(run.page, "/api/auth/me");
      if (me.status !== 200 || me.body?.clerkId !== wie.id)
        throw new Error(`VERKEERDE IDENTITEIT: verwacht ${wie.id}, kreeg ${me.body?.clerkId ?? me.status}`);
      regels.push({ status: "OK", detail: `identiteit ${me.body.clerkId} rol ${me.body.activeRole}` });

      // Eerlijk pakketlabel uit /api/entitlements (accounttype benoemen) — dit
      // is de bron waarop usePackage de landing baseert (product_label).
      const ent = await probe(run.page, "/api/entitlements");
      regels.push({
        status: ent.status === 200 ? "OK" : "INFO",
        detail: `entitlements → ${ent.status} · product_label="${ent.body?.product_label ?? "?"}" mode=${ent.body?.entitlement_mode ?? "?"} (verwacht pakket: ${wie.pakket})`,
      });
      const bill = await probe(run.page, "/api/billing/status");
      regels.push({
        status: bill.status === 200 ? "OK" : "INFO",
        detail: `billing/status → ${bill.status} · status=${bill.body?.status ?? "?"} tier=${bill.body?.tier ?? "?"}`,
      });

      // Landing = het startscherm; leg de fold vast (L1/onderblad boven de vouw).
      await run.page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await run.page.waitForTimeout(1600);
      const fold = await foldShot(run, "start");
      regels.push({ status: "OK", detail: `startscherm-fold / (bewijs: ${fold})` });

      // Detecteer de landing: kaart-onderblad vs sporter-dashboard.
      const onderblad = run.page.locator('[data-testid="kaart-onderblad"]');
      const dashboard = run.page.locator('[data-testid="sporter-dashboard"]');
      const heeftOnderblad = await onderblad.count();
      const heeftDashboard = await dashboard.count();
      const onderbladPakket = heeftOnderblad
        ? await onderblad.first().getAttribute("data-pakket")
        : null;
      regels.push({
        status: "INFO",
        detail: `onderblad=${heeftOnderblad} (pakket=${onderbladPakket ?? "-"}) · sporter-dashboard=${heeftDashboard}`,
      });

      if (SUB === "na") {
        if (wie.landing === "kaart") {
          if (heeftOnderblad === 0) fout(`${wie.pakket}: verwacht landing op de kaart (onderblad ontbreekt)`);
          else if (onderbladPakket !== wie.onderblad)
            fout(`${wie.pakket}: onderblad data-pakket "${onderbladPakket}" ≠ verwacht "${wie.onderblad}"`);
          if (heeftDashboard > 0) fout(`${wie.pakket}: sporter-dashboard mag NIET de landing zijn (kaart verwacht)`);
        } else {
          if (heeftDashboard === 0) fout(`${wie.pakket}: verwacht landing op het sporter-dashboard`);
          if (heeftOnderblad > 0) fout(`${wie.pakket}: kaart-onderblad mag NIET de landing zijn (dashboard verwacht)`);
        }
      }

      // DSH-15 (bewijs op dashboardniveau): open het sporterdashboard direct.
      // Go heeft toegang tot /dashboard (geen redirect zoals Gratis), maar de
      // meerweekse laag-3-onderdelen (weekstrook "Deze week", seizoensband)
      // moeten dan ONTBREKEN; Compleet toont ze wél. Gratis wordt netjes
      // weggeleid (DSH-22) en heeft geen dashboard om te meten.
      if (wie.pakket !== "Gratis") {
        await run.page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
        await run.page.waitForTimeout(1600);
        await run.shot("dashboard-direct");
        const weekstrook = await run.page.locator('[data-testid="laag3-weekstrook"]').count();
        const seizoensband = await run.page.locator('[data-testid="laag3-seizoensband"]').count();
        regels.push({
          status: "INFO",
          detail: `/dashboard meerweekse laag 3 → weekstrook=${weekstrook} seizoensband=${seizoensband}`,
        });
        if (SUB === "na") {
          if (wie.pakket === "Go" && (weekstrook > 0 || seizoensband > 0))
            fout(`Go: meerweekse laag-3-onderdelen moeten ONTBREKEN (weekstrook=${weekstrook}, seizoensband=${seizoensband})`);
          if (wie.pakket === "Compleet" && weekstrook === 0 && seizoensband === 0)
            fout("Compleet: verwacht ten minste één meerweeks laag-3-onderdeel (weekstrook of seizoensband)");
        }
        // Terug naar het startscherm voor de resterende probes.
        await run.page.goto(`${BASE}/`, { waitUntil: "networkidle" });
        await run.page.waitForTimeout(1200);
      }

      // Onderblad-inhoud (laag 2) — controleer de verwachte kopregel.
      if (SUB === "na" && wie.landing === "kaart") {
        const kop =
          wie.onderblad === "go"
            ? "Jouw rit van vandaag"
            : "Wat wil je vandaag rijden?";
        const zichtbaar = await run.page.locator("text=" + kop).first().isVisible().catch(() => false);
        regels.push({
          status: zichtbaar ? "OK" : "INFO",
          detail: `onderblad-kop "${kop}" zichtbaar=${zichtbaar}`,
        });
      }

      // DSH-14: bij Gratis GEEN Dashboard-nav-item; bij Go WEL (positie 1).
      const dashboardNav = await run.page
        .locator('nav a[href$="/dashboard"], [role="tab"][href$="/dashboard"], a[href="/dashboard"]')
        .count();
      const navTekst = await run.page.locator("nav").allInnerTexts().catch(() => []);
      const heeftDashboardLabel = navTekst.join(" ").includes("Dashboard");
      regels.push({
        status: "INFO",
        detail: `nav bevat "Dashboard"=${heeftDashboardLabel} (dashboard-links=${dashboardNav})`,
      });
      if (SUB === "na" && wie.pakket === "Gratis" && heeftDashboardLabel)
        fout("Gratis mag GEEN Dashboard-item in de navigatie tonen (DSH-14)");
      if (SUB === "na" && wie.pakket === "Go" && !heeftDashboardLabel)
        fout("Go moet een Dashboard-item in de navigatie hebben (DSH-13)");

      // Fold-hoogtebewijs.
      const scrollH = await run.page.evaluate(() => document.documentElement.scrollHeight);
      const viewH = await run.page.evaluate(() => window.innerHeight);
      regels.push({ status: "INFO", detail: `paginahoogte=${scrollH}px venster=${viewH}px schermen=${(scrollH / viewH).toFixed(1)}` });
      await run.page.evaluate(() => window.scrollTo(0, window.innerHeight));
      await run.page.waitForTimeout(300);
      await run.shot("start-scroll-1");
      await run.page.evaluate(() => window.scrollTo(0, 0));

      // Databron-probes (productie-rechtenpaden, met dev-identiteitsheader).
      for (const url of wie.probes) {
        const p = await probe(run.page, url);
        regels.push({ status: p.status === 200 ? "OK" : "INFO", detail: `${url} → ${p.status}` });
      }
    } catch (err) {
      fout(String(err?.message ?? err));
    } finally {
      await run.page.evaluate(() => window.localStorage.removeItem("sparki.dev.previewAthlete")).catch(() => {});
      await run.close();
    }
    rapport.push({ identiteit: wie.id, pakket: wie.pakket, landing: wie.landing, regels });
  }
} finally {
  await browser.close();
}

writeFileSync(path.join(EVIDENCE, "rapport.json"), JSON.stringify(rapport, null, 2));
for (const r of rapport) {
  console.log(`\n=== ${r.identiteit} (${r.pakket} → ${r.landing})`);
  for (const s of r.regels) console.log(`  [${s.status}] ${s.detail}`);
}
console.log(`\nBewijs: ${EVIDENCE}`);
if (failures > 0) {
  console.error(`\n${failures} FOUT(EN) — DASHBOARD_01 pakket-bewijs faalt.`);
  process.exit(1);
}
console.log("\nPakket-startschermbewijs vastgelegd.");
