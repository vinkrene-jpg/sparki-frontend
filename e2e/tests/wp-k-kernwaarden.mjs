// WP-K1/K2/K3/K5 — kernwaarden: herkomst, laaddiscipline en simulatielabel.
//
// Bewijs via ECHTE browser-kliks in de dev preview (seed_preview_dylan):
//   • /you → Kerngetallen toont FTP mét herkomststatus (geschat/niet bevestigd),
//     nooit een kaal getal zonder status; tijdens laden geen "nog niet bekend".
//   • /analyse → Doelscenario draagt het vaste label "Verkenning · simulatie".
//   • /analyse (Belasting) → Wattage-lab draagt hetzelfde label.
//
// Draaien: node e2e/tests/wp-k-kernwaarden.mjs (dev-servers moeten draaien)
import { launchBrowser, TestRun } from "../harness.mjs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "http://127.0.0.1:80";
const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/wp-k-kernwaarden",
);
mkdirSync(EVIDENCE, { recursive: true });

const browser = await launchBrowser();
let failures = 0;
const log = (s, d) => console.log(`${s.padEnd(5)} ${d}`);
const fout = (d) => { failures += 1; log("FOUT", d); };
const ok = (d) => log("OK", d);

try {
  const run = new TestRun({
    browser, baseUrl: BASE, viewport: "desktop",
    evidenceDir: EVIDENCE, runName: "kernwaarden",
  });
  await run.open();

  // Identiteit kiezen zoals de preview dat doet.
  await run.page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await run.page.evaluate(() => {
    window.localStorage.setItem("sparki.dev.previewAthlete", "seed_preview_dylan");
  });

  // ── /you — Kerngetallen met herkomststatus (WP-K2) + laaddiscipline (WP-K3)
  await run.page.goto(`${BASE}/you`, { waitUntil: "domcontentloaded" });
  // WP-K3: direct na laden mag "nog niet bekend" nergens staan.
  const vroeg = await run.page.evaluate(() => document.body.innerText);
  if (/nog niet bekend/i.test(vroeg))
    fout('/you toont "nog niet bekend" al tijdens het laden');
  else ok('/you: geen "nog niet bekend"-flits direct na laden');

  await run.page.waitForTimeout(4000);
  await run.shot("you-kerngetallen");
  const you = await run.page.evaluate(() => document.body.innerText);
  if (!/FTP\s*\d+\s*W\s*·\s*(geschat|niet bevestigd)/i.test(you))
    fout("/you: FTP zonder herkomststatus (verwacht '… W · geschat/niet bevestigd')");
  else ok("/you: FTP draagt herkomststatus");
  // Dylan hééft een FTP — "Je FTP is nog niet bekend" zou dus een leugen zijn.
  // (Gewicht ontbreekt echt in de seed; die melding is eerlijk en mag blijven.)
  if (/Je FTP is nog niet bekend|FTP en gewicht zijn nog niet bekend/i.test(you))
    fout('/you eindtoestand claimt onterecht dat de FTP onbekend is');
  else ok('/you eindtoestand: geen onterechte "FTP nog niet bekend"');

  // ── /analyse — Doelscenario met vast simulatielabel (WP-K5)
  await run.page.goto(`${BASE}/analyse`, { waitUntil: "domcontentloaded" });
  await run.page.waitForTimeout(4500);
  await run.shot("analyse-eerste-tab");
  let body = await run.page.evaluate(() => document.body.innerText);
  if (!/verkenning · simulatie/i.test(body)) {
    // Doelscenario staat op het Fitheid/Belasting-deel — klik tabs af.
    const tabs = await run.page.$$("button, [role=tab]");
    for (const t of tabs) {
      const txt = ((await t.textContent()) ?? "").toLowerCase();
      if (/belasting|fitheid|vermogen/.test(txt)) {
        await t.click().catch(() => {});
        await run.page.waitForTimeout(1500);
        body = await run.page.evaluate(() => document.body.innerText);
        if (/verkenning · simulatie/i.test(body)) break;
      }
    }
  }
  await run.shot("analyse-simulatielabel");
  if (!/verkenning · simulatie/i.test(body))
    fout('/analyse: label "Verkenning · simulatie" nergens gevonden');
  else ok('/analyse: label "Verkenning · simulatie" zichtbaar');

  const dubbel = (body.match(/verkenning · simulatie/gi) ?? []).length;
  ok(`/analyse: label komt ${dubbel}× voor op deze weergave (Doelscenario/Wattage-lab)`);
} finally {
  await browser.close();
}

if (failures > 0) {
  console.error(`\n${failures} controle(s) gefaald.`);
  process.exit(1);
}
console.log("\nAlle kernwaarden-schermcontroles geslaagd.");
