// MOBIELE_VOUWLIJN_METING_01 — meting, GEEN ontwerpwijzigingen.
//
// Meet per pagina (Dashboard, Trainen, Rijden, Analyse) × viewport (402×874,
// 375×667) × pakket (Gratis/Go/Compleet via governor-fixtures stand A/B/C) de
// boundingBox van de EERSTE primaire actieknop en of die volledig binnen het
// beeld valt. Bij "nee": welke elementen erboven staan en hoeveel pixels.
//
// Identiteitskeuze via de echte TESTCONTEXT-banner (DEV preview), zoals
// e2e/tests/dashboard-pakketten.mjs — de fixture-status blijft staan.
//
// Draaien: node e2e/tests/vouwlijn-meting.mjs
import { launchBrowser, TestRun } from "../harness.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.VOUW_BASE ?? "http://127.0.0.1:80";
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EVIDENCE = path.join(REPO_ROOT, "docs/proof-evidence/MOBIELE_VOUWLIJN_METING_01");
mkdirSync(EVIDENCE, { recursive: true });

const PAKKETTEN = [
  { id: "governor-fixture-stand-a-gratis", naam: "TESTFIXTURE Stand A Gratis Vers", pakket: "Gratis" },
  { id: "governor-fixture-stand-b-go", naam: "TESTFIXTURE Stand B Go Vers", pakket: "Go" },
  { id: "governor-fixture-stand-c-compleet", naam: "TESTFIXTURE Stand C Compleet Vers", pakket: "Compleet" },
];

const VIEWPORTS = [
  { naam: "402x874", width: 402, height: 874 },
  { naam: "375x667", width: 375, height: 667 },
];

const PAGINAS = [
  { naam: "Dashboard", pad: "/dashboard" },
  { naam: "Trainen", pad: "/train" },
  { naam: "Rijden", pad: "/routes" },
  { naam: "Analyse", pad: "/analyse" },
];

// Eerste primaire actieknop: eerste ZICHTBARE button of link-met-knoprol in de
// hoofdinhoud (niet in nav/header/TESTCONTEXT-banner/onderste navigatie), in
// documentvolgorde. Meting in de pagina zelf — code, niet het oog.
async function meetEersteActieknop(page) {
  return page.evaluate(() => {
    const inChrome = (el) =>
      el.closest("nav, header, [data-testid*='testcontext' i], [class*='testcontext' i]") != null ||
      /TESTCONTEXT/.test(el.closest("div[class*='fixed']")?.textContent?.slice(0, 200) ?? "") === true &&
        el.closest("div[class*='fixed']")?.querySelector("button") === el;
    const zichtbaar = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 20) return false;
      const s = getComputedStyle(el);
      return s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity || 1) > 0.05;
    };
    const kandidaten = Array.from(
      document.querySelectorAll("main button, main a[href], [role='main'] button"),
    );
    const alles = kandidaten.length
      ? kandidaten
      : Array.from(document.querySelectorAll("button, a[href]"));
    const knop = alles.find((el) => zichtbaar(el) && !inChrome(el) && (el.textContent ?? "").trim().length > 0);
    if (!knop) return { gevonden: false };
    const r = knop.getBoundingClientRect();
    const vensterH = window.innerHeight;
    const binnen = r.top >= 0 && r.top + r.height <= vensterH;
    let erboven = [];
    if (!binnen) {
      // Directe kinderen van de scroll-container boven de knop, met hun hoogte.
      const containerKinderen = Array.from(
        (knop.closest("main") ?? document.body).children,
      );
      erboven = containerKinderen
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r: rr }) => rr.height > 8 && rr.top < r.top)
        .map(({ el, r: rr }) => ({
          omschrijving:
            (el.getAttribute("data-testid") ?? el.tagName.toLowerCase()) +
            (el.textContent ? ` "${el.textContent.trim().slice(0, 60)}"` : ""),
          hoogtePx: Math.round(rr.height),
        }));
    }
    return {
      gevonden: true,
      tekst: (knop.textContent ?? "").trim().slice(0, 60),
      y: Math.round(r.top),
      yPlusHoogte: Math.round(r.top + r.height),
      vensterHoogte: vensterH,
      binnenBeeld: binnen,
      erboven,
    };
  });
}

const browser = await launchBrowser();
const rijen = [];

try {
  for (const wie of PAKKETTEN) {
    for (const vp of VIEWPORTS) {
      const run = new TestRun({
        browser,
        baseUrl: BASE,
        viewport: { width: vp.width, height: vp.height },
        evidenceDir: EVIDENCE,
        runName: `${wie.pakket.toLowerCase()}-${vp.naam}`,
      });
      await run.open();
      // Identiteit kiezen via de TESTCONTEXT-banner (eenmalig per context).
      await run.page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await run.page.waitForTimeout(800);
      await run.page.locator("button", { hasText: "TESTCONTEXT" }).first().click();
      await run.page.waitForTimeout(400);
      const pill = run.page.locator("button", { hasText: wie.naam }).first();
      await pill.scrollIntoViewIfNeeded();
      await Promise.all([run.page.waitForLoadState("load"), pill.click()]);
      await run.page.waitForTimeout(1400);
      const me = await run.page.evaluate(async () => {
        const id = window.localStorage.getItem("sparki.dev.previewAthlete");
        const r = await fetch("/api/auth/me", {
          credentials: "include",
          headers: id ? { "x-dev-clerk-id": id } : {},
        });
        return r.status === 200 ? (await r.json()).clerkId : `status ${r.status}`;
      });
      if (me !== wie.id) throw new Error(`VERKEERDE IDENTITEIT: verwacht ${wie.id}, kreeg ${me}`);

      for (const pagina of PAGINAS) {
        await run.page.goto(`${BASE}${pagina.pad}`, { waitUntil: "networkidle" });
        await run.page.waitForTimeout(1600);
        await run.page.evaluate(() => window.scrollTo(0, 0));
        await run.page.waitForTimeout(300);
        const eindPad = new URL(run.page.url()).pathname;
        const meting = await meetEersteActieknop(run.page);
        const shot = await run.shot(pagina.naam.toLowerCase());
        rijen.push({
          pakket: wie.pakket,
          viewport: vp.naam,
          pagina: pagina.naam,
          pad: pagina.pad,
          eindPad,
          ...meting,
          screenshot: path.basename(shot),
        });
        const m = meting.gevonden
          ? `knop "${meting.tekst}" y=${meting.y} y+h=${meting.yPlusHoogte} venster=${meting.vensterHoogte} binnen=${meting.binnenBeeld ? "JA" : "NEE"}`
          : "geen actieknop gevonden";
        console.log(`[${wie.pakket} ${vp.naam}] ${pagina.naam} (${eindPad}): ${m}`);
      }
      await run.close();
    }
  }
} finally {
  await browser.close();
}

writeFileSync(path.join(EVIDENCE, "meting.json"), JSON.stringify(rijen, null, 2));
console.log(`\n${rijen.length} metingen → ${path.join(EVIDENCE, "meting.json")}`);
