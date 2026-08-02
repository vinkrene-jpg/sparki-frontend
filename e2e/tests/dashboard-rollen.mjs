// DASHBOARD_01 Fase B — rol-dashboards schermbewijs op 402×874 (VOOR/NA).
//
// Per rol-testidentiteit (WP-R0 governor-fixtures) via ECHTE kliks in de DEV
// preview: kies de identiteit in de TESTCONTEXT-banner, open het startscherm
// en leg de fold (402×874) + de drie lagen vast. Rechten-/data-probes gaan met
// de x-dev-clerk-id-header, exact zoals de app zelf (productie-rechtenpaden).
//
// VOOR/NA met dezelfde harness:
//   • DASH_ROLLEN_SHOT_DIR=voor  → oude build (rol-startlijst / rol-home).
//   • DASH_ROLLEN_SHOT_DIR=na    → deze build (drie-lagen dashboard).
//
// Draaien (dev-servers moeten draaien, zoals wp-r0-rollen):
//   DASH_ROLLEN_SHOT_DIR=na node e2e/tests/dashboard-rollen.mjs
//
// Alleen rollen met een WERKENDE login-fixture worden echt vastgelegd; rollen
// zonder fixture (teammanager, ploegleider, hoofdtrainer als eigen inlog)
// worden in VOOR_NA.md eerlijk als niet-inlogbaar gedocumenteerd.
import { launchBrowser, TestRun } from "../harness.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.DASH_ROLLEN_BASE ?? "http://127.0.0.1:80";
// DASH_ROLLEN_SHOT_DIR is een KALE label ("voor"/"na"), geen pad. We nemen
// bewust alleen de basename, zodat een per ongeluk meegegeven pad
// (bv. "docs/proof-evidence/DASHBOARD_01_ROLLEN/na") niet dubbel wordt gejoind.
const SUB = path.basename(process.env.DASH_ROLLEN_SHOT_DIR ?? "na") || "na";
// Bewijsmap is altijd absoluut t.o.v. de repo-root, ongeacht de CWD.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EVIDENCE = path.join(
  REPO_ROOT,
  "docs/proof-evidence/DASHBOARD_01_ROLLEN",
  SUB,
);
mkdirSync(EVIDENCE, { recursive: true });

// Rollen met een werkende WP-R0-login-fixture. `landing` = waar de rol landt na
// keuze; `dashboardRol` beschrijft welk Fase B-dashboard verwacht wordt.
const ROLLEN = [
  {
    id: "governor-fixture-parent",
    naam: "TESTFIXTURE Ouder",
    rol: "parent",
    dashboard: "Ouder",
    start: "/", // activeRole parent → RoleHome/DevPreview rendert ParentDashboard.
    probes: ["/api/parent/overview"],
  },
  {
    id: "governor-fixture-trainer-zelfstandig",
    naam: "TESTFIXTURE Trainer Zelfstandig",
    rol: "coach",
    dashboard: "Zelfstandige trainer (coach)",
    start: "/", // activeRole coach → CoachDashboard.
    probes: ["/api/coach/dashboard"],
  },
  {
    id: "governor-fixture-clubbeheerder",
    naam: "TESTFIXTURE Clubbeheerder",
    rol: "athlete",
    dashboard: "Clubbeheerder",
    // Deze governor-fixture bezit óók de globale athlete-rol, dus zijn athlete-
    // startscherm is /. Zijn CLUBROL-startpunt (waar het clubbeheerder-
    // dashboard leeft, DSH-13a) is /rol-start/admin — dat leggen we vast.
    start: "/rol-start/admin",
    probes: ["/api/clubs"],
  },
];

const filter = (process.env.DASH_ROLLEN_FILTER ?? "")
  .split(",").map((s) => s.trim()).filter(Boolean);
const TE_TESTEN = filter.length
  ? ROLLEN.filter((r) => filter.some((f) => r.id.includes(f)))
  : ROLLEN;

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
      runName: `rol-${wie.id.replace("governor-fixture-", "")}`,
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
        await run.page.waitForTimeout(1200);
      }

      // Server-side identiteit + rol.
      const me = await probe(run.page, "/api/auth/me");
      if (me.status !== 200 || me.body?.clerkId !== wie.id)
        throw new Error(`VERKEERDE IDENTITEIT: verwacht ${wie.id}, kreeg ${me.body?.clerkId ?? me.status}`);
      regels.push({ status: "OK", detail: `identiteit ${me.body.clerkId} rol ${me.body.activeRole}` });

      // Landing = het rol-startscherm (DSH-13a); leg de fold vast (L1 + L2 boven
      // de vouw). Voor clubrollen is dat hun /rol-start/:rol, niet /.
      await run.page.goto(`${BASE}${wie.start}`, { waitUntil: "networkidle" });
      await run.page.waitForTimeout(1600);
      const fold = await foldShot(run, "start");
      regels.push({ status: "OK", detail: `startscherm-fold ${wie.start} (bewijs: ${fold})` });

      // Detecteer de drie lagen (NA-build) via de testids.
      const heeftDashboard = await run.page.locator('[data-testid="role-dashboard"]').count();
      const laag1 = await run.page.locator('[data-testid="dashboard-laag1"]').count();
      const laag2 = await run.page.locator('[data-testid="dashboard-laag2"]').count();
      const laag3 = await run.page.locator('[data-testid="dashboard-laag3"]').count();
      regels.push({
        status: heeftDashboard > 0 ? "OK" : "INFO",
        detail: `role-dashboard=${heeftDashboard} · laag1=${laag1} · laag2=${laag2} · laag3=${laag3} (verwacht: ${wie.dashboard})`,
      });
      if (SUB === "na" && heeftDashboard > 0 && laag1 === 0)
        fout("laag 1 (het ene visuele element) ontbreekt in het dashboard");

      // Fold-hoogtebewijs: hoeveel scroll tot alles bereikbaar is (L3 onder vouw).
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
    rapport.push({ identiteit: wie.id, rol: wie.rol, dashboard: wie.dashboard, regels });
  }
} finally {
  await browser.close();
}

writeFileSync(path.join(EVIDENCE, "rapport.json"), JSON.stringify(rapport, null, 2));
for (const r of rapport) {
  console.log(`\n=== ${r.identiteit} (${r.dashboard})`);
  for (const s of r.regels) console.log(`  [${s.status}] ${s.detail}`);
}
console.log(`\nBewijs: ${EVIDENCE}`);
if (failures > 0) {
  console.error(`\n${failures} FOUT(EN) — DASHBOARD_01 rol-bewijs faalt.`);
  process.exit(1);
}
console.log("\nRol-dashboardbewijs vastgelegd.");
