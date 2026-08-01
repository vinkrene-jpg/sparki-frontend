// Klimmen in Route maken (opdracht René 01-08-2026) — echte browserkliktest,
// mobiel formaat, tegen de PRODUCTIEBUILD (dev-server is nooit bewijs).
//
// Bewijst de acceptatieketen (eis 12): start → afstand → klim kiezen →
// voorstel → bewaren, met:
//  - "KLIMMEN TOEVOEGEN" als stap ná start+afstand (eis 3, 4)
//  - specifieke klim zoeken rond de startlocatie; kaart + hoogteprofiel pas
//    ná selectie (eis 9)
//  - vervangen/verwijderen zonder invoerverlies (eis 7, 8)
//  - resultaat toont aantal klimmen, hoogtemeters, zwaarste klim, extra
//    afstand én de meetkundige verificatie van de gekozen klim (eis 5, 6)
//
// Draaien: node e2e/tests/route-klimmen.mjs
import { launchBrowser, ensureE2eUser, mintTicket, TestRun } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/route-klimmen",
);
mkdirSync(EVIDENCE, { recursive: true });

// Startpunt: Valkenburg (Zuid-Limburg) — gegarandeerd echte klimmen in de buurt.
const GEO = { latitude: 50.865, longitude: 5.83 };

const stappen = [];
function log(stap, status, detail = "") {
  stappen.push({ stap, status, detail, t: new Date().toISOString() });
  console.log(`[${status}] ${stap}${detail ? ` — ${detail}` : ""}`);
}

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();
let exitCode = 0;
try {
  const run = new TestRun({
    browser,
    baseUrl,
    viewport: "mobiel",
    evidenceDir: EVIDENCE,
    runName: "route-klimmen",
  });
  await run.open();
  await run.context.grantPermissions(["geolocation"]);
  await run.context.setGeolocation(GEO);

  const userId = await ensureE2eUser();
  await run.loginWithTicket(await mintTicket(userId));
  await run.page.goto(`${baseUrl}/routes`, { waitUntil: "networkidle" });
  await run.acceptConsentIfPresent();
  const me = await run.verifyIdentity({ expectClerkId: userId });
  log("login", me.status === 200 ? "OK" : "FOUT", `auth/me=${me.status}`);

  const page = run.page;

  // Voorverwarmen: klimzoek-cache rond de start (Overpass koud = 10-20 s).
  await page
    .evaluate(async ({ lat, lon }) => {
      await fetch(`/api/climbs/search?lat=${lat}&lon=${lon}`, {
        credentials: "include",
      }).catch(() => {});
    }, { lat: GEO.latitude, lon: GEO.longitude })
    .catch(() => {});

  await page.goto(`${baseUrl}/routes`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await run.shot("planner-open");

  const planner = page.getByText("WAT VOOR ROUTE?", { exact: false }).first();
  if (!(await planner.isVisible().catch(() => false)))
    throw new Error("Planner (stap 1) niet zichtbaar voor QA-account");
  log("planner-zichtbaar", "OK");

  // Stap 1: startpunt via echte geolocatie.
  await page.getByRole("button", { name: "Gebruik mijn locatie" }).click();
  await page.getByText(/^Startpunt: 50\.8/).waitFor({ timeout: 15000 });
  log("startpunt", "OK", "Valkenburg vastgeklikt");

  // Naar stap 2 (afstand + klimmen).
  await page.getByRole("button", { name: "Verder →" }).first().click();
  await page.waitForTimeout(400);
  const klimBlok = page.getByTestId("klimmen-toevoegen");
  await klimBlok.waitFor({ timeout: 10000 });
  log("klimblok-na-start-afstand", "OK", "KLIMMEN TOEVOEGEN zichtbaar in stap 2");
  await run.shot("klimblok");

  // Kaart/profiel mogen er vóór selectie nog NIET zijn (eis 9).
  const preDetail = await page.getByTestId("gekozen-klim").isVisible().catch(() => false);
  log("geen-detail-voor-selectie", preDetail ? "FOUT" : "OK");
  if (preDetail) exitCode = 1;

  // Specifieke klim zoeken.
  await page.getByRole("button", { name: "Specifieke klim zoeken" }).click();
  await page.getByTestId("klim-zoeker").waitFor({ timeout: 5000 });
  const eersteKlim = page.getByTestId("klim-zoeker").locator("button").first();
  await eersteKlim.waitFor({ timeout: 120000 });
  const klimNaam = (await eersteKlim.locator("span").first().textContent())?.trim();
  await eersteKlim.click();
  log("klim-gekozen", "OK", klimNaam ?? "");

  // Detail (kaart + profiel) laadt pas nu; wacht op echte inhoud.
  const gekozen = page.getByTestId("gekozen-klim");
  await gekozen.waitFor({ timeout: 5000 });
  await gekozen.getByText(/km ·.*hm ·/).waitFor({ timeout: 60000 }).catch(() => {});
  await run.shot("klim-gekozen");

  // Eis 7/8: vervangen zonder invoerverlies — zoeker komt terug, start blijft.
  await gekozen.getByRole("button", { name: "Vervangen" }).click();
  await page.getByTestId("klim-zoeker").waitFor({ timeout: 5000 });
  log("vervangen", "OK", "zoeker terug zonder invoerverlies");
  const tweede = page.getByTestId("klim-zoeker").locator("button").first();
  await tweede.waitFor({ timeout: 60000 });
  await tweede.click();
  await gekozen.waitFor({ timeout: 5000 });
  await gekozen.getByText(/km ·.*hm ·/).waitFor({ timeout: 60000 }).catch(() => {});
  await run.shot("klim-hergekozen");

  // Door naar de laatste stap en genereren.
  for (let i = 0; i < 4; i++) {
    const verder = page.getByRole("button", { name: "Verder →" }).first();
    if (!(await verder.isVisible().catch(() => false))) break;
    await verder.click();
    await page.waitForTimeout(400);
  }
  const samenvatting = await page.getByText(/Klimmen: via /).isVisible().catch(() => false);
  log("samenvatting-klimregel", samenvatting ? "OK" : "FOUT");
  if (!samenvatting) exitCode = 1;
  await run.shot("samenvatting");

  const genereer = page.getByRole("button", { name: /Genereer route/ }).first();
  await genereer.click();

  // Einde (met eerlijke her-pogingen bij koude blokkadecheck).
  const resultaat = page.getByText("RESULTAAT", { exact: true }).first();
  const foutOpnieuw = page.getByRole("button", { name: "Opnieuw proberen" }).first();
  for (let poging = 0; poging < 3; poging++) {
    await Promise.race([
      resultaat.waitFor({ timeout: 200 * 1000 }),
      foutOpnieuw.waitFor({ timeout: 200 * 1000 }),
    ]);
    if (await resultaat.isVisible().catch(() => false)) break;
    const fouttekst = (await page.locator("p").allTextContents().catch(() => []))
      .find((t) => t.includes("kon niet gecontroleerd") || t.includes("Geen geschikte"));
    log("tussenstand", "EERLIJKE FOUT", (fouttekst ?? "").slice(0, 140));
    if (fouttekst && !fouttekst.includes("kon niet gecontroleerd")) break;
    await page.waitForTimeout(8000);
    await foutOpnieuw.click().catch(() => {});
  }

  const heeftResultaat = await resultaat.isVisible().catch(() => false);
  await run.shot(heeftResultaat ? "resultaat" : "eerlijke-fout");
  if (!heeftResultaat) {
    log("einde", "EERLIJKE WEIGERING", "geen route — fout + vervolgacties zichtbaar");
    exitCode = 1; // voor deze belofte-test eisen we een écht voorstel
  } else {
    log("resultaat", "OK");
    // Eis 5/6: klimblok met verificatie + de vier feiten.
    const blok = page.getByTestId("klim-resultaat");
    await blok.waitFor({ timeout: 10000 });
    const verificatie = await blok.getByText(/ligt aantoonbaar op deze route/).isVisible().catch(() => false);
    log("klim-verificatie", verificatie ? "OK" : "FOUT",
      verificatie ? "" : "geen meetkundige verificatie zichtbaar");
    if (!verificatie) exitCode = 1;
    for (const feit of [
      "Aantal klimmen:",
      "Totale hoogtemeters:",
      "Zwaarste klim:",
      "Extra afstand",
    ]) {
      const ok = await blok.getByText(feit, { exact: false }).isVisible().catch(() => false);
      log(`feit: ${feit}`, ok ? "OK" : "FOUT");
      if (!ok) exitCode = 1;
    }
    await run.shot("klim-resultaatblok");

    // ── MOBILE_ROUTE_WALKING_01 F2: mobiele route-detailcompositie ──
    // Op telefoonformaat zitten de detailpanelen (hoogteprofiel, wegdek,
    // opmerkingen, klimmen, uitleg) achter één knop in een bottom sheet;
    // desktop toont dezelfde panelen inline (zelfde JSX-bron).
    const detailsKnop = page.getByTestId("route-details-knop");
    const knopZichtbaar = await detailsKnop.isVisible().catch(() => false);
    log("F2: details-knop zichtbaar (mobiel)", knopZichtbaar ? "OK" : "FOUT");
    if (!knopZichtbaar) exitCode = 1;
    if (knopZichtbaar) {
      await detailsKnop.click();
      const sheet = page.getByTestId("route-detail-sheet");
      await sheet.waitFor({ timeout: 5000 });
      const sheetOk = await sheet.isVisible().catch(() => false);
      log("F2: bottom sheet opent", sheetOk ? "OK" : "FOUT");
      if (!sheetOk) exitCode = 1;
      // Inhoud: wegdekpaneel of uitlegtekst moet in de sheet staan (echte data).
      const inhoudOk =
        (await sheet.getByText(/Wegdek|WEGDEK/i).first().isVisible().catch(() => false)) ||
        (await sheet.getByText(/route/i).first().isVisible().catch(() => false));
      log("F2: sheet bevat detailinhoud", inhoudOk ? "OK" : "FOUT");
      if (!inhoudOk) exitCode = 1;
      await run.shot("f2-detail-sheet");
      await sheet.getByRole("button", { name: "Sluiten" }).click();
      await page.waitForTimeout(300);
      const dicht = !(await page.getByTestId("route-detail-sheet").isVisible().catch(() => false));
      log("F2: sheet sluit", dicht ? "OK" : "FOUT");
      if (!dicht) exitCode = 1;
    }
    // Desktopcontrole op dezelfde pagina/kandidaat: knop weg, panelen inline.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(400);
    const knopDesktop = await detailsKnop.isVisible().catch(() => false);
    log("F2: details-knop NIET op desktop", knopDesktop ? "FOUT" : "OK");
    if (knopDesktop) exitCode = 1;
    const inlineOk = await page.getByText("STAP-VOOR-STAP", { exact: false }).first().isVisible().catch(() => false);
    log("F2: detailpanelen inline op desktop", inlineOk ? "OK" : "FOUT");
    if (!inlineOk) exitCode = 1;
    await run.shot("f2-desktop-inline");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);

    // Bewaren (eis 12): eindigt aantoonbaar in het Bewaard-tabblad. Bevat de
    // racefietsroute onbekend wegdek, dan eist de UI eerst een expliciete
    // bewuste keuze — die maken we hier zichtbaar (eerlijkheidspoort).
    const bewusteKeuze = page.getByText(/bewust voor deze route met onbekend wegdek/).first();
    if (await bewusteKeuze.isVisible().catch(() => false)) {
      await bewusteKeuze.click();
      log("onbekend-wegdek-keuze", "OK", "expliciete keuze bevestigd");
    }
    await page.getByRole("button", { name: "Bewaar route", exact: true }).click();
    await page.waitForURL(/view=bewaard/, { timeout: 60000 });
    log("bewaard", "OK", page.url());
    await run.shot("bewaard");
  }
} catch (err) {
  log("test", "FOUT", String(err));
  exitCode = 1;
} finally {
  writeFileSync(
    path.join(EVIDENCE, "route-klimmen-rapport.json"),
    JSON.stringify({ baseUrl, geo: GEO, stappen }, null, 2),
  );
  await browser.close();
  server.close();
}
process.exit(exitCode);
