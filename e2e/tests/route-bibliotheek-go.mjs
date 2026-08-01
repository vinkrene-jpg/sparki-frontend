// OPDRACHT 2 (ROUTE_PAKKET_01, SPARKI-BESLUIT-2026-002) — klikbewijs.
//
// Bewijs per abonnementspersona, telefoon én desktop, via echte kliks:
//   • Gratis  → routebibliotheek toont de SIMPELE lijst (nieuwste eerst):
//               geen zoekveld/sortering, alleen "Mijn routes"+"Gedeeld met
//               mij", één rustige verwijzing (compacte nudge, geen muur).
//   • Go      → zoeken/sorteren/scopes zichtbaar, nergens een nudge.
//   • Compleet→ idem Go; en course points + live-kaart server-side open.
// Server-side per persona: 403 upgrade_required op de gepoorte endpoints,
// nooit 403 waar toegang hoort.
//
// Draaien: node e2e/tests/route-bibliotheek-go.mjs (dev-servers draaien)
import { launchBrowser, TestRun } from "../harness.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "http://127.0.0.1:80";
const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/route-bibliotheek-go",
);
mkdirSync(EVIDENCE, { recursive: true });

const PERSONAS = [
  { id: "seed_persona_gratis", label: "gratis", go: false, compleet: false },
  { id: "seed_persona_go", label: "go", go: true, compleet: false },
  { id: "seed_persona_pro", label: "compleet", go: true, compleet: true },
];

const browser = await launchBrowser();
const rapport = [];
let failures = 0;
try {
  for (const wie of PERSONAS) {
    for (const viewport of ["mobiel", "desktop"]) {
      const run = new TestRun({
        browser, baseUrl: BASE, viewport,
        evidenceDir: EVIDENCE, runName: `bieb-${wie.label}-${viewport}`,
      });
      await run.open();
      const regels = [];
      const fout = (msg) => { failures += 1; regels.push({ status: "FOUT", detail: `${viewport}: ${msg}` }); };
      const ok = (msg) => regels.push({ status: "OK", detail: `${viewport}: ${msg}` });
      try {
        await run.page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
        await run.page.evaluate((id) => {
          window.localStorage.setItem("sparki.dev.previewAthlete", id);
        }, wie.id);
        await run.page.goto(`${BASE}/routes?view=bewaard`, { waitUntil: "domcontentloaded" });
        await run.page.waitForTimeout(3500);
        await run.shot("bibliotheek");

        const ui = await run.page.evaluate(() => ({
          zoek: !!document.querySelector('input[placeholder="Zoek op naam…"]'),
          sorteer: !!document.querySelector('select[aria-label="Sorteren"]'),
          nudge: !!document.querySelector('[data-testid="upgrade-nudge"]'),
          favorietenTab: [...document.querySelectorAll("button")].some((b) =>
            b.textContent.trim().startsWith("Favorieten")),
          mijnTab: [...document.querySelectorAll("button")].some((b) =>
            b.textContent.trim().startsWith("Mijn routes")),
          goTekst: document.body.innerText.includes("hoort bij Sparki Go"),
          body: document.body.innerText.slice(0, 600),
        }));
        if (!ui.mijnTab) fout(`"Mijn routes" ontbreekt (verkeerde pagina?): ${ui.body}`);
        if (wie.go) {
          if (!ui.zoek || !ui.sorteer) fout("zoek/sorteer ontbreekt terwijl Go toegang heeft");
          else ok("zoeken + sorteren zichtbaar (toegang)");
          if (!ui.favorietenTab) fout("Favorieten-scope ontbreekt voor Go");
          if (ui.nudge) fout("nudge getoond terwijl toegang verwacht");
          else ok("geen nudge (toegang)");
        } else {
          if (ui.zoek || ui.sorteer) fout("zoek/sorteer zichtbaar zonder Go");
          else ok("simpele lijst: geen zoek/sorteer");
          if (ui.favorietenTab) fout("Favorieten-scope zichtbaar zonder Go");
          else ok("alleen Mijn routes + Gedeeld met mij");
          if (!ui.nudge || !ui.goTekst) fout("rustige verwijzing (nudge) ontbreekt");
          else ok("rustige verwijzing naar Sparki Go aanwezig");
        }

        // Server-side bewijs per persona (via de browser, met dev-identiteit).
        const api = await run.page.evaluate(async () => {
          const id = window.localStorage.getItem("sparki.dev.previewAthlete");
          const call = async (u) => {
            const r = await fetch(u, { headers: { "x-dev-clerk-id": id } });
            let body = null; try { body = await r.json(); } catch {}
            return { status: r.status, code: body?.code ?? null, feature: body?.feature ?? null };
          };
          return {
            simpel: await call("/api/routes"),
            extras: await call("/api/routes?sort=afstand"),
            points: await call("/api/races/999999/points"),
            friends: await call("/api/live-location/friends"),
          };
        });
        if (api.simpel.status !== 200) fout(`simpele lijst gaf ${api.simpel.status}, moet gratis 200 zijn`);
        else ok("GET /api/routes (simpel) → 200 voor iedereen");
        const check = (naam, r, toegang, feature) => {
          if (toegang) {
            if (r.status === 403) fout(`${naam} gaf 403 terwijl toegang hoort`);
            else ok(`${naam} → ${r.status} (geen 403)`);
          } else if (r.status !== 403 || r.code !== "upgrade_required" || r.feature !== feature) {
            fout(`${naam} gaf ${r.status}/${r.code}/${r.feature}, verwacht 403 upgrade_required ${feature}`);
          } else ok(`${naam} → 403 upgrade_required (${feature})`);
        };
        check("routes?sort=afstand", api.extras, wie.go, "route_library_manage");
        check("races/:id/points", api.points, wie.compleet, "route_course_points");
        check("live-location/friends", api.friends, wie.compleet, "live_friends_map");
      } catch (err) {
        failures += 1;
        regels.push({ status: "FOUT", detail: `${viewport}: ${String(err?.message ?? err)}` });
      } finally {
        await run.close();
      }
      rapport.push({ persona: wie.id, viewport, regels });
      console.log(`=== ${wie.id} (${viewport})`);
      for (const r of regels) console.log(`  [${r.status}] ${r.detail}`);
    }
  }
} finally {
  await browser.close();
}
writeFileSync(path.join(EVIDENCE, "rapport.json"), JSON.stringify(rapport, null, 2));
if (failures > 0) { console.error(`${failures} controle(s) GEFAALD`); process.exit(1); }
console.log("Alle routebibliotheek-poortcontroles geslaagd.");
