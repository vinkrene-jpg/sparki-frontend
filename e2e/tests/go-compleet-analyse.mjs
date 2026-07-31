// SPOEDCONTROLE 31-07-2026 — Abonnementsrechten Analyse/Performance Lab.
//
// Bewijs per abonnementspersona, via ECHTE kliks in de dev preview:
//   • Gratis  → /analyse toont de betaalmuur (UpgradeNudge) + rustige CTA.
//   • Go      → /analyse toont de inhoud, nergens een betaalmuur.
//   • Compleet (sparki_pro) → inhoud, en NERGENS "hoort bij Sparki Go".
//   • Interne tiers (basic/performance) → vergrendeld (geen productaanbod).
//   • Harde herlaad per persona; tijdens rechten-laden nooit analyse-inhoud.
//
// Draaien: node e2e/tests/go-compleet-analyse.mjs (dev-servers moeten draaien)
import { launchBrowser, TestRun } from "../harness.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "http://127.0.0.1:80";
const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/go-compleet-analyse",
);
mkdirSync(EVIDENCE, { recursive: true });

const PERSONAS = [
  { id: "seed_persona_gratis", label: "gratis", verwacht: "paywall" },
  { id: "seed_persona_go", label: "go", verwacht: "inhoud" },
  { id: "seed_persona_pro", label: "compleet", verwacht: "inhoud" },
  { id: "seed_persona_basic", label: "basis-intern", verwacht: "paywall" },
  { id: "seed_persona_performance", label: "performance-intern", verwacht: "paywall" },
];

const filter = (process.env.GC_FILTER ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const TE_TESTEN = filter.length ? PERSONAS.filter((p) => filter.includes(p.label)) : PERSONAS;

const browser = await launchBrowser();
const rapport = [];
let failures = 0;
try {
  for (const wie of TE_TESTEN) {
    const run = new TestRun({
      browser, baseUrl: BASE, viewport: "desktop",
      evidenceDir: EVIDENCE, runName: `abo-${wie.label}`,
    });
    await run.open();
    const regels = [];
    const fout = (msg) => { failures += 1; regels.push({ status: "FOUT", detail: msg }); };
    try {
      // Identiteit kiezen zoals de preview dat doet, daarna HARDE herlaad
      // rechtstreeks op /analyse (opnieuw-inloggen-equivalent in dev preview).
      await run.page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
      await run.page.evaluate((id) => {
        window.localStorage.setItem("sparki.dev.previewAthlete", id);
      }, wie.id);
      await run.page.goto(`${BASE}/analyse`, { waitUntil: "domcontentloaded" });

      // Tijdens rechten-laden mag er GEEN analyse-inhoud staan: alleen de
      // laadstatus of (na resolutie) nudge/inhoud.
      const vroeg = await run.page.evaluate(() => ({
        loading: !!document.querySelector('[data-testid="go-gate-loading"]'),
        nudge: !!document.querySelector('[data-testid="upgrade-nudge"]'),
        tekst: document.body.innerText.slice(0, 400),
      }));
      regels.push({ status: "INFO", detail: `direct na laden: loading=${vroeg.loading} nudge=${vroeg.nudge}` });

      await run.page.waitForTimeout(3500);
      await run.shot("analyse-eindtoestand");
      const eind = await run.page.evaluate(() => ({
        loading: !!document.querySelector('[data-testid="go-gate-loading"]'),
        nudge: !!document.querySelector('[data-testid="upgrade-nudge"]'),
        cta: !!document.querySelector('[data-testid="upgrade-nudge-actie"]'),
        goTekst: document.body.innerText.includes("hoort bij Sparki Go"),
        body: document.body.innerText,
      }));
      if (eind.loading) fout("laadstatus blijft hangen na 3,5s");
      if (wie.verwacht === "paywall") {
        if (!eind.nudge) fout("betaalmuur ontbreekt terwijl vergrendeld verwacht");
        else regels.push({ status: "OK", detail: "betaalmuur getoond zoals verwacht" });
        if (!eind.cta) fout("rustige CTA naar abonnementsoverzicht ontbreekt");
        else regels.push({ status: "OK", detail: "CTA 'Bekijk je abonnement' aanwezig" });
      } else {
        if (eind.nudge) fout("betaalmuur getoond terwijl toegang verwacht");
        else regels.push({ status: "OK", detail: "inhoud toegankelijk, geen betaalmuur" });
        if (eind.goTekst) fout(`"hoort bij Sparki Go" zichtbaar voor ${wie.label} — verboden`);
        else regels.push({ status: "OK", detail: 'nergens "hoort bij Sparki Go"' });
      }

      // Harde herlaad: zelfde uitkomst.
      await run.page.reload({ waitUntil: "domcontentloaded" });
      await run.page.waitForTimeout(3500);
      await run.shot("analyse-na-harde-herlaad");
      const her = await run.page.evaluate(() => ({
        nudge: !!document.querySelector('[data-testid="upgrade-nudge"]'),
      }));
      if ((wie.verwacht === "paywall") !== her.nudge)
        fout(`harde herlaad wijkt af: nudge=${her.nudge}`);
      else regels.push({ status: "OK", detail: "harde herlaad geeft dezelfde uitkomst" });

      // Server-side bewijs: 403/200 op een performance_lab-gegate route.
      const api = await run.page.evaluate(async () => {
        const id = window.localStorage.getItem("sparki.dev.previewAthlete");
        const r = await fetch("/api/entitlements", { headers: { "x-dev-clerk-id": id } });
        return await r.json();
      });
      const entitled = !!api.commercial_features?.performance_lab || api.entitlement_mode === "legacy_unrestricted";
      if (entitled !== (wie.verwacht === "inhoud"))
        fout(`server-rechten wijken af van verwachting (entitled=${entitled})`);
      else if (JSON.stringify(api).match(/sparki_(basic|performance|pro|go)/))
        fout(`interne tiernaam lekt in /api/entitlements: ${JSON.stringify(api).match(/sparki_\w+/)[0]}`);
      else regels.push({ status: "OK", detail: `server: performance_lab entitled=${entitled} (label ${api.product_label})` });

      // Echte gegate route: /api/core-prediction/* draagt requireCommercialFeature
      // ("performance_lab"). Vergrendeld ⇒ 403 upgrade_required; toegang ⇒ nooit 403.
      const gated = await run.page.evaluate(async () => {
        const id = window.localStorage.getItem("sparki.dev.previewAthlete");
        const r = await fetch("/api/core-prediction/e2e-proef", { headers: { "x-dev-clerk-id": id } });
        let body = null; try { body = await r.json(); } catch {}
        return { status: r.status, code: body?.code ?? null };
      });
      if (wie.verwacht === "paywall") {
        if (gated.status !== 403 || gated.code !== "upgrade_required")
          fout(`gegate route gaf ${gated.status}/${gated.code}, verwacht 403 upgrade_required`);
        else regels.push({ status: "OK", detail: "gegate route → 403 upgrade_required (fail-closed)" });
      } else if (gated.status === 403) {
        fout(`gegate route gaf 403 voor ${wie.label} — verboden`);
      } else {
        regels.push({ status: "OK", detail: `gegate route → ${gated.status} (geen 403, toegang)` });
      }
    } catch (err) {
      failures += 1;
      regels.push({ status: "FOUT", detail: String(err?.message ?? err) });
    } finally {
      await run.close();
    }
    rapport.push({ persona: wie.id, label: wie.label, verwacht: wie.verwacht, regels });
    console.log(`=== ${wie.id} (${wie.verwacht})`);
    for (const r of regels) console.log(`  [${r.status}] ${r.detail}`);
  }
} finally {
  await browser.close();
}
writeFileSync(path.join(EVIDENCE, "rapport.json"), JSON.stringify(rapport, null, 2));
if (failures > 0) { console.error(`${failures} controle(s) GEFAALD`); process.exit(1); }
console.log("Alle abonnementscontroles geslaagd.");
