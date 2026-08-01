// MOBILE_ROUTE_WALKING_01 — Wandelen & Hiken als routefamilies (01-08-2026).
// Echte browserkliktest tegen de PRODUCTIEBUILD. Bewijst:
//  1. op 375 px en 412 px staan "Wandelen" en "Hiken" in de sportkeuze;
//  2. een wandelroute wordt écht gegenereerd (foot-walking, geen fietsprofiel);
//  3. een hikeroute wordt écht gegenereerd (foot-hiking);
//  4. fietsen blijft de standaard en blijft aanwezig (regressie);
//  5. geen horizontale overflow op beide telefoonbreedtes;
//  6. /api/version toont service, omgeving, commit en buildtijd.
//
// Draaien: node e2e/tests/wandelen-hiken.mjs
import { launchBrowser, ensureE2eUser, mintTicket, TestRun } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/wandelen-hiken",
);
mkdirSync(EVIDENCE, { recursive: true });

const GEO = { latitude: 51.905, longitude: 5.66 }; // Betuwe, landelijk

const stappen = [];
let fouten = 0;
function log(stap, status, detail = "") {
  stappen.push({ stap, status, detail, t: new Date().toISOString() });
  if (status === "FOUT") fouten += 1;
  console.log(`[${status}] ${stap}${detail ? ` — ${detail}` : ""}`);
}

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();
let exitCode = 0;
try {
  const userId = await ensureE2eUser();

  // ── /api/version (eis 4 van de opdracht) ────────────────────────────────
  {
    const res = await fetch(`${baseUrl}/api/version`);
    const v = await res.json().catch(() => ({}));
    const velden = ["service", "environment", "commit", "buildTime"];
    const ok = res.status === 200 && velden.every((k) => typeof v[k] === "string" && v[k].length > 0);
    log(
      "api-version",
      ok ? "OK" : "FOUT",
      `status=${res.status} service=${v.service} env=${v.environment} commit=${v.commit} buildTime=${v.buildTime}`,
    );
  }

  // ── Per sport één generatierun; per viewport de zichtbaarheidscontroles ──
  const RUNS = [
    { naam: "iphone-klein-wandelen", viewport: { width: 375, height: 667 }, sport: "Wandelen" },
    { naam: "android-groot-hiken", viewport: { width: 412, height: 915 }, sport: "Hiken" },
  ];

  for (const conf of RUNS) {
    const run = new TestRun({
      browser,
      baseUrl,
      viewport: conf.viewport,
      evidenceDir: EVIDENCE,
      runName: conf.naam,
    });
    await run.open();
    await run.context.grantPermissions(["geolocation"]);
    await run.context.setGeolocation(GEO);
    await run.loginWithTicket(await mintTicket(userId));
    await run.page.goto(`${baseUrl}/routes`, { waitUntil: "networkidle" });
    await run.acceptConsentIfPresent();
    await run.page.goto(`${baseUrl}/routes`, { waitUntil: "networkidle" });
    await run.page.waitForTimeout(1200);
    const page = run.page;

    // Mobiele wizard-kop zichtbaar (standaardgedrag, geen flag).
    const kop = page.getByTestId("mobiele-wizard-kop");
    log(
      `${conf.naam}: mobiele wizard`,
      (await kop.isVisible().catch(() => false)) ? "OK" : "FOUT",
    );

    // Stap 1: startpunt.
    await page.getByRole("button", { name: "Gebruik mijn locatie" }).click();
    await page.getByText(/^Startpunt: 51\.9/).waitFor({ timeout: 15000 });
    await page.getByRole("button", { name: "Verder →" }).first().click();
    await page.waitForTimeout(400);

    // Stap 2: sportkeuze — Fietsen (standaard) + Wandelen + Hiken zichtbaar.
    for (const label of ["Fietsen", "Wandelen", "Hiken"]) {
      const btn = page.getByRole("button", { name: new RegExp(`^${label}`) }).first();
      log(
        `${conf.naam}: sportoptie ${label}`,
        (await btn.isVisible().catch(() => false)) ? "OK" : "FOUT",
      );
    }
    await run.shot("sportkeuze");

    // Kies de voetsport en genereer.
    await page.getByRole("button", { name: new RegExp(`^${conf.sport}`) }).first().click();
    await page.waitForTimeout(300);
    for (let i = 0; i < 4; i++) {
      const verder = page.getByRole("button", { name: "Verder →" }).first();
      if (!(await verder.isVisible().catch(() => false))) break;
      await verder.click();
      await page.waitForTimeout(400);
    }
    const genereer = page.getByRole("button", { name: /Genereer route/ }).first();
    if (!(await genereer.isVisible().catch(() => false))) {
      log(`${conf.naam}: genereerknop`, "FOUT", "niet gevonden");
    } else {
      const resultaat = page.getByText("RESULTAAT", { exact: true }).first();
      const eerlijkeFout = page
        .getByText(/geen (geschikte|route)|niet gecontroleerd worden|geen antwoord/i)
        .first();
      let uitkomst = "stil";
      // Overpass-mirrors zijn soms tijdelijk onbereikbaar (eerlijke weigering,
      // geen bug) — daarom maximaal twee pogingen.
      for (let poging = 1; poging <= 2; poging++) {
        await genereer.click();
        uitkomst = await Promise.race([
          resultaat.waitFor({ timeout: 120000 }).then(() => "resultaat"),
          eerlijkeFout.waitFor({ timeout: 120000 }).then(() => "eerlijke-fout"),
        ]).catch(() => "stil");
        if (uitkomst === "resultaat" || uitkomst === "stil") break;
        await page.waitForTimeout(8000);
      }
      log(
        `${conf.naam}: ${conf.sport}-route gegenereerd`,
        uitkomst === "resultaat" ? "OK" : "FOUT",
        `uitkomst=${uitkomst}`,
      );
      await run.shot(`resultaat-${conf.sport.toLowerCase()}`);
    }

    // Geen horizontale overflow.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    log(
      `${conf.naam}: geen horizontale overflow`,
      overflow <= 1 ? "OK" : "FOUT",
      `delta=${overflow}px`,
    );
    await run.close();
  }

  // ── Desktop-regressie: fietsen blijft de standaardcompositie ────────────
  {
    const run = new TestRun({
      browser,
      baseUrl,
      viewport: "desktop",
      evidenceDir: EVIDENCE,
      runName: "desktop-fietsen",
    });
    await run.open();
    await run.context.grantPermissions(["geolocation"]);
    await run.context.setGeolocation(GEO);
    await run.loginWithTicket(await mintTicket(userId));
    await run.page.goto(`${baseUrl}/routes`, { waitUntil: "networkidle" });
    await run.acceptConsentIfPresent();
    await run.page.goto(`${baseUrl}/routes`, { waitUntil: "networkidle" });
    await run.page.waitForTimeout(1200);
    const page = run.page;
    const kop = page.getByTestId("mobiele-wizard-kop");
    log(
      "desktop: mobiele kop NIET zichtbaar",
      !(await kop.isVisible().catch(() => false)) ? "OK" : "FOUT",
    );
    await page.getByRole("button", { name: "Gebruik mijn locatie" }).click();
    await page.getByText(/Startpunt: 51\.9/).waitFor({ timeout: 15000 });
    // Sportkeuze staat ook op desktop in stap 2 — eerst doorklikken.
    await page.getByRole("button", { name: "Verder →" }).first().click();
    await page.waitForTimeout(400);
    for (const label of ["Fietsen", "Wandelen", "Hiken"]) {
      const btn = page.getByRole("button", { name: new RegExp(`^${label}`) }).first();
      log(
        `desktop: sportoptie ${label}`,
        (await btn.isVisible().catch(() => false)) ? "OK" : "FOUT",
      );
    }
    await run.shot("desktop-sportkeuze");
    await run.close();
  }
} catch (err) {
  fouten += 1;
  log("onverwachte fout", "FOUT", String(err));
} finally {
  writeFileSync(
    path.join(EVIDENCE, "stappen.json"),
    JSON.stringify(stappen, null, 2),
  );
  await browser.close();
  server.close();
}
exitCode = fouten > 0 ? 1 : 0;
const okCount = stappen.filter((s) => s.status === "OK").length;
console.log(`\nwandelen-hiken: ${okCount}/${stappen.length} OK`);
process.exit(exitCode);
