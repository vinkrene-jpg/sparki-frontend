// TAAK 628 — Bewijs met een echte browserklik dat route-aanpassen (via-punt
// plaatsen door op de kaart te tikken) precies ÉÉN nieuwe routeaanvraag start
// en een nieuwe kandidaat oplevert (kaartlijn verandert). Tegen de
// PRODUCTIEBUILD (WP-S1: DEV Preview is geen bewijs).
//
// Aanleiding: René meldde 07-08 dat "Route aanpassen" op zijn telefoon niet
// reageerde op geplaatste punten. Sinds commit 07-08 is er een logregel per
// poging + zichtbare melding (data-testid="aanpas-melding") bij weigering.
//
// Bewijst:
//  A1  kandidaat maken via echte kliks (Activiteit → Racefiets → Maak route)
//  A2  "Aanpassen" aanzetten en met een echte tik op de kaart een via-punt
//      plaatsen ⇒ er start PRECIES ÉÉN nieuwe generate-aanvraag (netwerk
//      geteld op POST /api/routes/generate/start)
//  A3  een tweede snelle tik terwijl de aanvraag loopt wordt zichtbaar
//      geweigerd (aanpas-melding) en start GEEN tweede aanvraag
//  A4  de nieuwe kandidaat heeft andere geometrie ⇒ de kaartlijn verandert
//  A5  het via-punt is zichtbaar als marker op de kaart
//  A6  de logregel per poging ('[route-scherm] aanpassing …') verschijnt in
//      de browserconsole
//
//  A7  de kandidaatlijn staat ECHT gerenderd op de kaart (queryRenderedFeatures
//      via de window.__sparkiKaart-testhaak), vóór én na de tik
//  A0  de pagina is de echte productieshell: GEEN TESTCONTEXT/DEV-Preview-
//      banner (harde poort — de workspace-env zet SPARKI_ACCEPT_MODE=true en
//      een gewone build bakt anders de acceptatieschil in)
//
// Draaien: node e2e/tests/route-aanpassen-klik.mjs
// Vereist: api-server draait (poort 80) + verse prod-build ZONDER accept-mode:
//   (cd artifacts/sparki && env -u SPARKI_ACCEPT_MODE PORT=5000 BASE_PATH=/ pnpm run build)
import { launchBrowser, ensureE2eUser, mintTicket, TestRun } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/route-aanpassen-klik",
);
mkdirSync(EVIDENCE, { recursive: true });

// Westerbork (Drenthe, NL) — bekend werkend corpusgebied (warm in dev).
const SEED = { lat: 52.853, lon: 6.608 };

const stappen = [];
let exitCode = 0;
function log(stap, ok, detail = "") {
  const status = ok ? "OK" : "FOUT";
  if (!ok) exitCode = 1;
  stappen.push({ stap, status, detail, t: new Date().toISOString() });
  console.log(`[${status}] ${stap}${detail ? ` — ${detail}` : ""}`);
}
function info(stap, detail = "") {
  stappen.push({ stap, status: "INFO", detail, t: new Date().toISOString() });
  console.log(`[INFO] ${stap}${detail ? ` — ${detail}` : ""}`);
}

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();
try {
  const userId = await ensureE2eUser();
  const run = new TestRun({
    browser,
    baseUrl,
    viewport: "mobiel",
    evidenceDir: EVIDENCE,
    runName: "aanpassen",
  });
  await run.open();
  await run.context.grantPermissions(["geolocation"]);
  await run.context.setGeolocation({ latitude: SEED.lat, longitude: SEED.lon });

  // ── Meetinstrumenten: netwerk (start-aanvragen) + kandidaten + console ──
  const page = run.page;
  const startAanvragen = []; // elke POST /api/routes/generate/start
  page.on("request", (req) => {
    if (req.url().includes("/api/routes/generate/start") && req.method() === "POST") {
      startAanvragen.push({ t: Date.now(), postData: req.postData()?.slice(0, 400) ?? null });
    }
  });
  const kandidaten = []; // elk afgerond jobresultaat mét kandidaat-geometrie
  page.on("response", async (res) => {
    if (!res.url().includes("/api/routes/generate-jobs/")) return;
    try {
      const body = await res.json();
      const geom = body?.done ? body?.body?.candidate?.geometry : null;
      if (Array.isArray(geom) && geom.length > 0) {
        kandidaten.push({ t: Date.now(), geometry: geom, name: body.body.candidate.name ?? null });
      }
    } catch {
      /* geen JSON of al gesloten — negeren */
    }
  });
  const consoleRegels = [];
  page.on("console", (msg) => {
    const t = msg.text();
    if (t.includes("[route-scherm] aanpassing")) consoleRegels.push(t);
  });

  // ── Login + routescherm openen (echte Clerk-ticketlogin) ────────────────
  await run.loginWithTicket(await mintTicket(userId));
  await page.goto(`${baseUrl}/route`, { waitUntil: "networkidle" });
  await run.acceptConsentIfPresent();
  if (new URL(page.url()).pathname !== "/route") {
    await page.goto(`${baseUrl}/route`, { waitUntil: "networkidle" });
  }
  await run.verifyIdentity({ expectClerkId: userId });
  await page.waitForTimeout(2500);

  // ── A0: harde productieshell-poort (WP-S1) ──────────────────────────────
  // De workspace-env zet SPARKI_ACCEPT_MODE=true; een gewone build bakt dan
  // de acceptatie-/DEV-Preview-schil in. Die is herkenbaar aan de altijd
  // zichtbare TESTCONTEXT-banner. Staat die er, dan is NIETS hierna bewijs:
  // hard stoppen.
  const testcontextZichtbaar = await page
    .locator("text=TESTCONTEXT")
    .first()
    .isVisible()
    .catch(() => false);
  log(
    "A0: echte productieshell — geen TESTCONTEXT/DEV-Preview-banner",
    !testcontextZichtbaar,
    testcontextZichtbaar
      ? "TESTCONTEXT-banner zichtbaar — build opnieuw met env -u SPARKI_ACCEPT_MODE"
      : "banner afwezig",
  );
  if (testcontextZichtbaar) {
    throw new Error(
      "Acceptatiebuild gedetecteerd (TESTCONTEXT) — geen geldig WP-S1-bewijs. " +
        "Bouw met: env -u SPARKI_ACCEPT_MODE PORT=5000 BASE_PATH=/ pnpm run build",
    );
  }
  await run.shot("scherm-open");

  // ── A1: kandidaat maken via echte kliks ─────────────────────────────────
  const rij = page.getByTestId("knoppenrij").locator("visible=true").first();
  await rij.waitFor({ timeout: 20000 });
  await rij.getByText("Activiteit").click();
  const racefiets = page.getByText("Racefiets", { exact: true }).locator("visible=true").first();
  await racefiets.waitFor({ timeout: 5000 });
  await racefiets.click();
  await page.waitForTimeout(600);
  await run.shot("activiteit-gekozen");

  // Afstand naar 30 km via de Verfijnen-schuif (echte toetsen op de slider):
  // kleinere lus = minder blokkade-tegels ⇒ betrouwbaar binnen het
  // Overpass-budget (de controle zelf blijft volledig echt).
  await rij.getByText("+ Verfijnen").click();
  const slider = page.locator('input[type="range"]:visible').first();
  await slider.waitFor({ timeout: 5000 });
  await slider.focus();
  await slider.press("Home"); // min (20 km voor racefiets)
  for (let i = 0; i < 10; i++) await slider.press("ArrowRight"); // → 30 km
  await page.getByRole("button", { name: /^Kies \d+ km$/ }).click();
  await page.waitForTimeout(500);
  info("afstand via schuif op 30 km gezet");

  await page.getByTestId("escape-sparki").locator("visible=true").first().click();
  info("routeaanvraag gestart via 'Maak route'");
  const aanpassenKnop = page.getByRole("button", { name: "Aanpassen", exact: true }).first();
  try {
    await aanpassenKnop.waitFor({ timeout: 240000 });
  } catch {
    log("A1: kandidaat op het scherm", false, "geen kandidaat binnen 240s — geen verdere claims mogelijk");
    throw new Error("Geen kandidaat — test kan aanpassen niet bewijzen");
  }
  log("A1: kandidaat op het scherm (Gebruiken/Opnieuw/Aanpassen zichtbaar)", true);
  log(
    "A1: eerste kandidaat kwam uit precies één start-aanvraag",
    startAanvragen.length === 1,
    `starts=${startAanvragen.length}`,
  );
  if (kandidaten.length === 0) {
    log("A1: kandidaat-geometrie gezien in jobantwoord", false);
    throw new Error("Geen geometrie gevangen — vergelijking onmogelijk");
  }
  const eersteGeom = JSON.stringify(kandidaten[kandidaten.length - 1].geometry);
  info("eerste kandidaat", `${kandidaten[kandidaten.length - 1].geometry.length} punten`);

  // ── A7: de kandidaatlijn is ECHT GERENDERD op de kaart (niet alleen in de
  // API-respons). Via de WP-S1-testhaak (window.__sparkiKaart) vragen we
  // MapLibre welke features de kandidaatlaag daadwerkelijk tekent, en nemen
  // we een geometrie-monster van de gerenderde lijn voor de vóór/na-
  // vergelijking. Faalt hard als er geen lijn op het scherm staat.
  const leesGerenderdeLijn = () =>
    page.evaluate(() => {
      const kaart = window.__sparkiKaart;
      if (!kaart) return { fout: "geen kaart-testhaak" };
      if (!kaart.getLayer("sparki-kandidaat-lijn")) return { fout: "kandidaatlaag ontbreekt" };
      const features = kaart.queryRenderedFeatures({ layers: ["sparki-kandidaat-lijn"] });
      const coords = features.flatMap((f) =>
        f.geometry.type === "LineString" ? f.geometry.coordinates : [],
      );
      return { aantal: features.length, monster: JSON.stringify(coords.slice(0, 200)) };
    });
  let gerenderdVoor = { aantal: 0 };
  for (let i = 0; i < 30 && !(gerenderdVoor.aantal > 0); i++) {
    await page.waitForTimeout(1000);
    gerenderdVoor = await leesGerenderdeLijn();
  }
  log(
    "A7: kandidaatlijn daadwerkelijk gerenderd op de kaart (queryRenderedFeatures)",
    (gerenderdVoor.aantal ?? 0) > 0,
    gerenderdVoor.fout ?? `gerenderde lijnfeatures=${gerenderdVoor.aantal}`,
  );
  await run.shot("kandidaat");

  // ── A2: Aanpassen aan + echte tik op de kaart = één nieuwe aanvraag ─────
  await aanpassenKnop.click();
  await page.waitForTimeout(400);
  const uitleg = await page
    .getByText("Tik op de lijn om de route daar vast te pinnen", { exact: false })
    .locator("visible=true")
    .first()
    .isVisible()
    .catch(() => false);
  log("A2: aanpasmodus actief (uitleg zichtbaar)", uitleg);
  await run.shot("aanpassen-aan");

  const startsVoorTik = startAanvragen.length;
  const kandidatenVoorTik = kandidaten.length;
  // Echte tik op de kaart, in het zichtbare kaartdeel boven het onderblad.
  // Raakt de tik de kandidaatlijn dan is het "punt vastpinnen", ernaast is
  // het een waypoint — beide plaatsen een via-punt en beide moeten in
  // precies ÉÉN routeaanvraag eindigen (R16).
  await page.mouse.click(201, 230);
  await page.waitForTimeout(250);
  await run.shot("na-tik");

  // ── A3: tweede snelle tik ⇒ zichtbare weigering, géén tweede aanvraag ──
  await page.mouse.click(140, 190);
  const melding = page.getByTestId("aanpas-melding");
  const meldingGezien = await melding
    .waitFor({ timeout: 3000 })
    .then(() => true)
    .catch(() => false);
  const meldingTekst = meldingGezien ? (await melding.innerText()).trim() : "";
  await run.shot("tweede-tik-weigering");
  log(
    "A3: tweede tik tijdens lopende aanvraag zichtbaar geweigerd",
    meldingGezien && meldingTekst.includes("Nog bezig"),
    meldingTekst || "geen melding gezien",
  );

  // ── A4: nieuwe kandidaat afwachten (kaartlijn verandert) ────────────────
  const deadline = Date.now() + 240000;
  while (kandidaten.length <= kandidatenVoorTik && Date.now() < deadline) {
    await page.waitForTimeout(1000);
  }
  const nieuw = kandidaten.length > kandidatenVoorTik ? kandidaten[kandidaten.length - 1] : null;
  log("A4: aanpassing leverde een nieuwe kandidaat op", nieuw != null);
  if (nieuw) {
    const nieuweGeom = JSON.stringify(nieuw.geometry);
    log(
      "A4: kaartlijn verandert (geometrie nieuwe kandidaat ≠ oude)",
      nieuweGeom !== eersteGeom,
      `oud=${kandidaten[0].geometry.length} punten, nieuw=${nieuw.geometry.length} punten`,
    );
  }
  // A7-slot: de NIEUWE kandidaat staat ook echt gerenderd op de kaart en de
  // gerenderde lijn is aantoonbaar anders dan het vóór-monster.
  let gerenderdNa = { aantal: 0 };
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    gerenderdNa = await leesGerenderdeLijn();
    if ((gerenderdNa.aantal ?? 0) > 0 && gerenderdNa.monster !== gerenderdVoor.monster) break;
  }
  log(
    "A7: nieuwe kandidaatlijn gerenderd én zichtbaar anders dan de oude",
    (gerenderdNa.aantal ?? 0) > 0 && gerenderdNa.monster !== gerenderdVoor.monster,
    gerenderdNa.fout ??
      `features na=${gerenderdNa.aantal}, gerenderd monster gewijzigd=${gerenderdNa.monster !== gerenderdVoor.monster}`,
  );
  await run.shot("nieuwe-kandidaat");

  // A2-kern: in de hele tik-episode (tik + geweigerde tweede tik) is er
  // precies ÉÉN start-aanvraag bijgekomen.
  log(
    "A2: precies één nieuwe generate-aanvraag door de tik",
    startAanvragen.length - startsVoorTik === 1,
    `starts vóór tik=${startsVoorTik}, na episode=${startAanvragen.length}`,
  );

  // ── A5: via-punt zichtbaar als marker op de kaart ───────────────────────
  const viaMarkers = await page
    .locator('span[style*="rgb(139, 92, 246)"], span[style*="#8b5cf6"]')
    .count();
  log("A5: via-punt(en) zichtbaar als marker op de kaart", viaMarkers >= 1, `markers=${viaMarkers}`);

  // ── A6: logregel per poging in de browserconsole ────────────────────────
  const pogingen = consoleRegels.filter((r) => r.includes("poging")).length;
  const geweigerd = consoleRegels.filter((r) => r.includes("GEWEIGERD")).length;
  log(
    "A6: logregel per poging in de console (incl. weigering)",
    pogingen >= 2 && geweigerd >= 1,
    `pogingen=${pogingen}, geweigerd=${geweigerd}`,
  );

  await run.context.close();
} catch (err) {
  log("test", false, String(err));
} finally {
  await browser.close();
  server.close();
}

writeFileSync(
  path.join(EVIDENCE, "rapport.json"),
  JSON.stringify({ stappen, exitCode, t: new Date().toISOString() }, null, 2),
);
console.log(`\nKlaar — exitcode ${exitCode} (${stappen.length} checks)`);
process.exit(exitCode);
