// WP-R0 — rol-testidentiteiten in de DEV Preview (opdracht René 31-07-2026).
//
// Per testidentiteit, via ECHTE kliks in de dev preview:
//   1. open de TESTCONTEXT-banner → klik de identiteit in "Kijk als gebruiker";
//   2. controleer server-side identiteit + rol via /api/auth/me (faalt hard bij
//      dev-fallback of verkeerde rol);
//   3. controleer de rolbewuste startpagina + banner;
//   4. rechtenprobes met PRODUCTIE-rechtenpaden (geen bypass):
//      /api/admin/status (alleen admin 200, rest 403),
//      /api/coach/athletes (alleen gekoppelde coach ziet sporters),
//      /api/parent/athletes (alleen ouder met koppeling).
//
// Draaien: node e2e/tests/wp-r0-rollen.mjs  (dev-servers moeten draaien)
import { launchBrowser, TestRun } from "../harness.mjs";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "http://127.0.0.1:80";
const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/wp-r0-rollen",
);
mkdirSync(EVIDENCE, { recursive: true });

// Verwachtingen per identiteit — server-side rechten EXACT als productie.
const IDENTITEITEN = [
  { id: "governor-fixture-parent", naam: "TESTFIXTURE Ouder", rol: "parent", admin: false, coachAthletes: null, parentAthletes: 1 },
  { id: "governor-fixture-trainer-zelfstandig", naam: "TESTFIXTURE Trainer Zelfstandig", rol: "coach", admin: false, coachAthletes: 1, parentAthletes: null },
  // Trainer-1 ziet 2 sporters: 1 directe link + clubteam-toewijzing (Team A
  // bevat ook de jeugdsporter) — hasCoachAccess = link ∪ clubtoewijzing.
  { id: "governor-fixture-trainer-1", naam: "TESTFIXTURE Trainer Een", rol: "coach", admin: false, coachAthletes: 2, parentAthletes: null },
  { id: "governor-fixture-trainer-2", naam: "TESTFIXTURE Trainer Twee (niet gekoppeld)", rol: "coach", admin: false, coachAthletes: 0, parentAthletes: null },
  { id: "governor-fixture-hoofdtrainer", naam: "TESTFIXTURE Hoofdtrainer", rol: "coach", admin: false, coachAthletes: 0, parentAthletes: null },
  { id: "governor-fixture-clubbeheerder", naam: "TESTFIXTURE Clubbeheerder", rol: "athlete", admin: false, coachAthletes: null, parentAthletes: null },
  { id: "governor-fixture-mechanieker", naam: "TESTFIXTURE Mechanieker", rol: "athlete", admin: false, coachAthletes: null, parentAthletes: null },
  { id: "governor-fixture-tester", naam: "TESTFIXTURE Tester", rol: "athlete", admin: false, hoofdtester: true, coachAthletes: null, parentAthletes: null },
  { id: "governor-fixture-admin", naam: "TESTFIXTURE Admin Testbeheer", rol: "athlete", admin: true, coachAthletes: null, parentAthletes: null },
];

// Zelfde gedrag als apiFetch in de app: in DEV gaat de gekozen identiteit als
// x-dev-clerk-id-header mee (kale fetch zonder die header = dev-fallback).
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

// Optionele deelrun (shell-timeouts): WP_R0_FILTER="parent,tester" beperkt de
// set; het rapport wordt dan aangevuld i.p.v. overschreven.
const filter = (process.env.WP_R0_FILTER ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const TE_TESTEN = filter.length > 0
  ? IDENTITEITEN.filter((w) => filter.some((f) => w.id.includes(f)))
  : IDENTITEITEN;

const browser = await launchBrowser();
const rapport = [];
let failures = 0;
try {
  for (const wie of TE_TESTEN) {
    const run = new TestRun({
      browser, baseUrl: BASE, viewport: "desktop",
      evidenceDir: EVIDENCE, runName: `rol-${wie.id.replace("governor-fixture-", "")}`,
    });
    await run.open();
    const regels = [];
    const fout = (msg) => { failures += 1; regels.push({ status: "FOUT", detail: msg }); };
    try {
      // Stap 1: open de preview als standaard-gebruiker en KLIK de identiteit.
      await run.page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await run.page.waitForTimeout(800);
      await run.shot("start-standaard");
      await run.page.locator("button", { hasText: "TESTCONTEXT" }).first().click();
      await run.page.waitForTimeout(400);
      await run.shot("panel-open");
      const pill = run.page.locator("button", { hasText: wie.naam }).first();
      if (!(await pill.isVisible().catch(() => false))) {
        fout(`identiteit "${wie.naam}" niet zichtbaar in de kiezer`);
      } else {
        await pill.scrollIntoViewIfNeeded();
        await Promise.all([
          run.page.waitForLoadState("load"),
          pill.click(),
        ]);
        await run.page.waitForTimeout(1200);
        regels.push({ status: "GEKLIKT", detail: `identiteit ${wie.naam} gekozen (echte klik + herlaad)` });
      }

      // Stap 2: server-side identiteit + rol (met de dev-identiteitsheader,
      // exact zoals de app zelf via apiFetch doet).
      const me = await probe(run.page, "/api/auth/me");
      if (me.status !== 200 || me.body?.clerkId !== wie.id)
        throw new Error(`VERKEERDE IDENTITEIT: verwacht ${wie.id}, kreeg ${me.body?.clerkId ?? me.status} — dev-fallback-valkuil`);
      if (me.body?.activeRole !== wie.rol)
        throw new Error(`VERKEERDE ROL: verwacht ${wie.rol}, kreeg ${me.body?.activeRole}`);
      regels.push({ status: "OK", detail: `/api/auth/me → ${me.body?.clerkId} rol ${me.body?.activeRole}` });
      if (wie.hoofdtester && me.body?.isHeadTester !== true) fout("hoofdtester-vlag ontbreekt server-side");

      // Stap 3: rolbewuste startpagina + banner.
      await run.page.waitForTimeout(600);
      const home = await run.shot("home-als-identiteit");
      const banner = await run.page.locator("button", { hasText: "TESTCONTEXT" }).first().innerText().catch(() => "");
      if (!banner.includes("TESTCONTEXT")) fout("TESTCONTEXT-banner niet zichtbaar");
      if (!banner.toLowerCase().includes(wie.rol)) fout(`banner mist rol "${wie.rol}": "${banner}"`);
      regels.push({ status: "OK", detail: `banner: "${banner}" (bewijs: ${home})` });

      // Stap 3b: rolbewuste paginalijst in het DEV-paneel (viewsForRole).
      await run.page.locator("button", { hasText: "TESTCONTEXT" }).first().click();
      await run.page.waitForTimeout(400);
      const startLabel = wie.rol === "coach" ? "Start (trainer)" : wie.rol === "parent" ? "Start (ouder)" : "Start";
      const startPill = run.page.locator("button", { hasText: startLabel }).first();
      if (!(await startPill.isVisible().catch(() => false)))
        fout(`paginalijst mist rol-startknop "${startLabel}"`);
      const clubBeheer = await run.page.locator("button", { hasText: "Club-beheer" }).count();
      const clubBeheerVerwacht = wie.rol === "athlete";
      if (clubBeheerVerwacht ? clubBeheer === 0 : clubBeheer > 0)
        fout(`paginalijst "Club-beheer" ${clubBeheer > 0 ? "getoond" : "ontbreekt"} voor rol ${wie.rol}`);
      regels.push({ status: "OK", detail: `paginalijst rolbewust ("${startLabel}"${clubBeheerVerwacht ? " + Club-beheer" : ", geen Club-beheer"})` });
      await run.page.keyboard.press("Escape").catch(() => {});

      // Stap 4: rechtenprobes — productie-rechtenpaden.
      const admin = await probe(run.page, "/api/admin/status");
      if (wie.admin ? admin.status !== 200 : admin.status !== 403)
        fout(`/api/admin/status → ${admin.status}, verwacht ${wie.admin ? 200 : 403}`);
      else regels.push({ status: "OK", detail: `/api/admin/status → ${admin.status} (403-bewijs waar verwacht)` });

      if (wie.coachAthletes != null) {
        const c = await probe(run.page, "/api/coach/athletes");
        const n = Array.isArray(c.body?.athletes) ? c.body.athletes.length : Array.isArray(c.body) ? c.body.length : null;
        if (c.status !== 200 || n !== wie.coachAthletes)
          fout(`/api/coach/athletes → ${c.status}, ${n} sporters; verwacht ${wie.coachAthletes}`);
        else regels.push({ status: "OK", detail: `/api/coach/athletes → ${n} gekoppelde sporter(s)` });
      }
      if (wie.parentAthletes != null) {
        const p = await probe(run.page, "/api/parent/athletes");
        const n = Array.isArray(p.body?.athletes) ? p.body.athletes.length : Array.isArray(p.body) ? p.body.length : null;
        if (p.status !== 200 || n !== wie.parentAthletes)
          fout(`/api/parent/athletes → ${p.status}, ${n} kinderen; verwacht ${wie.parentAthletes}`);
        else regels.push({ status: "OK", detail: `/api/parent/athletes → ${n} kind(eren)` });
      }
    } catch (err) {
      fout(String(err?.message ?? err));
    } finally {
      // Identiteit terugzetten zodat de volgende run schoon start.
      await run.page.evaluate(() => window.localStorage.removeItem("sparki.dev.previewAthlete")).catch(() => {});
      await run.close();
    }
    rapport.push({ identiteit: wie.id, rol: wie.rol, regels });
  }
} finally {
  await browser.close();
}

const rapportPad = path.join(EVIDENCE, "rapport.json");
let bestaand = [];
try { bestaand = JSON.parse(readFileSync(rapportPad, "utf8")); } catch { /* eerste run */ }
const samengevoegd = [...bestaand.filter((r) => !rapport.some((n) => n.identiteit === r.identiteit)), ...rapport];
writeFileSync(rapportPad, JSON.stringify(samengevoegd, null, 2));
for (const r of rapport) {
  console.log(`\n=== ${r.identiteit} (rol ${r.rol})`);
  for (const s of r.regels) console.log(`  [${s.status}] ${s.detail}`);
}
console.log(`\nBewijs: ${EVIDENCE}`);
if (failures > 0) {
  console.error(`\n${failures} FOUT(EN) — WP-R0 e2e faalt.`);
  process.exit(1);
}
console.log("\nAlle rol-identiteiten geslaagd.");
