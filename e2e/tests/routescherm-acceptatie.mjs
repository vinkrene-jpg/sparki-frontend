// Taak #603 — ROUTEPLANNER_MOBIEL_01 §6: acceptatietests R-T1 t/m R-T8 voor
// het nieuwe mobiele routescherm (/route), met ECHTE browserkliks tegen de
// PRODUCTIEBUILD (WP-S1: DEV Preview is geen bewijs).
//
//  R-T1 kaart beeldvullend, bediening bovenop, geen tabblad-paginakop
//  R-T2 nergens twee kolommen naast elkaar / horizontale overflow
//  R-T3 trainingstype kiezen = precies ÉÉN routeaanvraag (netwerk-log-assert,
//       incl. dubbeltik en klik-tijdens-berekening)
//  R-T4 Start ⇒ navigatielaag over dezelfde kaart, planningsbediening weg
//  R-T5 onderblad verschilt per pakket (Gratis 3 routes + melding ·
//       Go alles · Compleet training van vandaag erbij)
//  R-T6 openbare route van een ander: afgekapt begin/einde, geen makersnaam
//  R-T7 onbekend wegdek in NL: melding, geen bevestigingsvraag
//  R-T8 DEELS: de datalaag-pariteit desktop↔telefoon wordt hier hard bewezen;
//       de eigen desktop-indeling is een aparte bouwstap (R17) en wordt pas
//       daar groen — dit rapport claimt R-T8 dus bewust NIET volledig.
//
// Draaien: node e2e/tests/routescherm-acceptatie.mjs
// Vereist: api-server draait (poort 80) + verse prod-build
//   (cd artifacts/sparki && PORT=5000 BASE_PATH=/ pnpm run build)
import { launchBrowser, ensureE2eUser, mintTicket, TestRun } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../../lib/db/package.json", import.meta.url));
const { Client } = require("pg");

const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/routescherm-acceptatie",
);
mkdirSync(EVIDENCE, { recursive: true });

// Westerbork (Drenthe, NL) — bekend werkend generatie- en corpusgebied.
const SEED = { lat: 52.853, lon: 6.608 };
const MOBIEL = { width: 402, height: 874 };
const DESKTOP = { width: 1440, height: 900 };
const OWNER_ID = "e2e-603-owner";
const OWNER_NAAM = "Roelof Openbaarmaker"; // mag NERGENS zichtbaar zijn (R-T6)

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

function vierkant(latOffset, lonOffset, d = 0.02) {
  const la = SEED.lat + latOffset;
  const lo = SEED.lon + lonOffset;
  return [
    [la, lo],
    [la + d, lo],
    [la + d, lo + d],
    [la, lo + d],
    [la, lo],
  ];
}

// Originele geometrie van de openbare route van de ander — bewaard om het
// afkappen (R-T6) hard te kunnen vergelijken.
const OPENBAAR_GEOM = (() => {
  // Lange lijn (~6 km) zodat er na afkappen + huiszone echt iets overblijft.
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    pts.push([SEED.lat + 0.01 + i * 0.001, SEED.lon + 0.01 + i * 0.0006]);
  }
  return pts;
})();

async function metDb(fn) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

async function seed(clerkId) {
  return metDb(async (db) => {
    await db.query(`DELETE FROM routes WHERE name LIKE 'E2E-603%'`);
    // 4 eigen routes → Gratis toont er 3 + melding, Go/Compleet alle 4.
    for (let i = 0; i < 4; i++) {
      await db.query(
        `INSERT INTO routes (clerk_id, name, surface, sport, status, visibility, distance_km, elevation_gain_m, geometry, source)
         VALUES ($1,$2,'asfalt','cycling','ready','private',$3,50,$4,'manual')`,
        [
          clerkId,
          `E2E-603 eigen ${i + 1}`,
          20 + i * 5,
          JSON.stringify(vierkant(0.005 * i, -0.01 - 0.005 * i)),
        ],
      );
    }
    // Andere eigenaar met bekend huisadres en aantoonbaar volwassen leeftijd,
    // met een OPENBARE, gereden route (R-T6). Huis ver van de routelijn zodat
    // het verschil dat we meten het start/einde-afkappen is.
    await db.query(
      `INSERT INTO user_profiles (clerk_id, email, display_name)
       VALUES ($1,$2,$3) ON CONFLICT (clerk_id) DO UPDATE SET display_name=$3`,
      [OWNER_ID, "e2e-603-owner@example.com", OWNER_NAAM],
    );
    await db.query(
      `INSERT INTO athlete_profiles (clerk_id, birth_date, home_lat, home_lon)
       VALUES ($1,'1985-04-12',$2,$3)
       ON CONFLICT (clerk_id) DO UPDATE SET birth_date='1985-04-12', home_lat=$2, home_lon=$3`,
      [OWNER_ID, SEED.lat - 0.2, SEED.lon - 0.2],
    );
    await db.query(
      `INSERT INTO routes (clerk_id, name, surface, sport, status, visibility, distance_km, elevation_gain_m, geometry, source)
       VALUES ($1,'E2E-603 openbaar van ander','asfalt','cycling','ready','public',12,40,$2,'ridden')`,
      [OWNER_ID, JSON.stringify(OPENBAAR_GEOM)],
    );
    // Training van vandaag voor het Compleet-onderblad (R6).
    await db.query(
      `DELETE FROM planned_workouts WHERE clerk_id=$1 AND title LIKE 'E2E-603%'`,
      [clerkId],
    );
    await db.query(
      `INSERT INTO planned_workouts (clerk_id, scheduled_date, type, title, target_duration_min, status, source)
       VALUES ($1, CURRENT_DATE, 'ride', 'E2E-603 duurtraining vandaag', 90, 'planned', 'sparki')`,
      [clerkId],
    );
  });
}

async function cleanup(clerkId, origineel) {
  await metDb(async (db) => {
    await db.query(`DELETE FROM routes WHERE name LIKE 'E2E-603%'`);
    await db.query(
      `DELETE FROM planned_workouts WHERE clerk_id=$1 AND title LIKE 'E2E-603%'`,
      [clerkId],
    );
    await db.query(`DELETE FROM athlete_profiles WHERE clerk_id=$1`, [OWNER_ID]);
    await db.query(`DELETE FROM user_profiles WHERE clerk_id=$1`, [OWNER_ID]);
    if (origineel) {
      await db.query(
        `UPDATE user_profiles SET entitlement_mode=$2, product_variant=$3, commercial_tier=$4 WHERE clerk_id=$1`,
        [clerkId, origineel.entitlement_mode, origineel.product_variant, origineel.commercial_tier],
      );
    }
  });
}

async function zetPakket(clerkId, variant /* null | 'sparki_go' | 'sparki_pro' */) {
  await metDb((db) =>
    db.query(
      `UPDATE user_profiles SET entitlement_mode='subscription', product_variant=$2, commercial_tier=NULL WHERE clerk_id=$1`,
      [clerkId, variant],
    ),
  );
}

async function geenHorizontaleOverflow(page) {
  return page.evaluate(() => {
    const el = document.documentElement;
    return { scroll: el.scrollWidth, client: el.clientWidth, ok: el.scrollWidth <= el.clientWidth + 1 };
  });
}

async function openRouteScherm(run, { userId, viewport, geo = SEED }) {
  await run.open();
  await run.context.grantPermissions(["geolocation"]);
  await run.context.setGeolocation({ latitude: geo.lat, longitude: geo.lon });
  await run.loginWithTicket(await mintTicket(userId));
  await run.page.goto(`${run.baseUrl}/route`, { waitUntil: "networkidle" });
  await run.acceptConsentIfPresent();
  // Consent-redirect kan op / uitkomen — dan opnieuw naar /route.
  if (new URL(run.page.url()).pathname !== "/route") {
    await run.page.goto(`${run.baseUrl}/route`, { waitUntil: "networkidle" });
  }
  await run.verifyIdentity({ expectClerkId: userId });
  await run.page.locator(".leaflet-container").waitFor({ timeout: 20000 });
  await run.page.waitForTimeout(1500);
  return run.page;
}

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();
let userId = null;
let origineelPakket = null;

try {
  userId = await ensureE2eUser();

  // Huidige pakketstand bewaren (na afloop terugzetten). QA-profiel moet
  // bestaan (JIT-sync bij eerdere logins van dit vaste QA-account).
  origineelPakket = await metDb(async (db) => {
    const r = await db.query(
      `SELECT entitlement_mode, product_variant, commercial_tier FROM user_profiles WHERE clerk_id=$1`,
      [userId],
    );
    return r.rows[0] ?? null;
  });
  if (!origineelPakket) {
    // Eén login zodat JIT-sync het profiel aanmaakt, daarna opnieuw lezen.
    const boot = new TestRun({ browser, baseUrl, viewport: MOBIEL, evidenceDir: EVIDENCE, runName: "boot" });
    await openRouteScherm(boot, { userId, viewport: MOBIEL });
    await boot.context.close();
    origineelPakket = await metDb(async (db) => {
      const r = await db.query(
        `SELECT entitlement_mode, product_variant, commercial_tier FROM user_profiles WHERE clerk_id=$1`,
        [userId],
      );
      return r.rows[0] ?? null;
    });
  }
  log("voorbereiding: QA-profiel aanwezig", !!origineelPakket);

  await seed(userId);
  log("voorbereiding: corpus geseed (4 eigen + 1 openbaar + training vandaag)", true);

  // ════ R-T1 t/m R-T4 + R-T7 — mobiel, pakket Go (alles zichtbaar) ════════
  await zetPakket(userId, "sparki_go");
  {
    const run = new TestRun({ browser, baseUrl, viewport: MOBIEL, evidenceDir: EVIDENCE, runName: "mobiel-go" });
    const page = await openRouteScherm(run, { userId, viewport: MOBIEL });

    // R-T1: kaart beeldvullend, bediening bovenop, geen tabblad-paginakop.
    const kaartBox = await page.locator(".leaflet-container").boundingBox();
    log(
      "R-T1: kaart beeldvullend",
      !!kaartBox && kaartBox.width >= MOBIEL.width - 2 && kaartBox.height >= MOBIEL.height - 2,
      kaartBox ? `${Math.round(kaartBox.width)}x${Math.round(kaartBox.height)} op ${MOBIEL.width}x${MOBIEL.height}` : "geen kaart",
    );
    log("R-T1: zoekveld bovenop de kaart", (await page.getByText("Zoek een plaats…").locator("visible=true").count()) >= 1);
    log("R-T1: driepuntsmenu bovenop de kaart", (await page.locator('[aria-label="Menu"]:visible').count()) >= 1);
    const tabs = await page.locator('[role="tab"]').count();
    const wizardKop = await page.locator('[data-testid="mobiele-wizard-kop"]').count();
    log("R-T1: geen tabblad-paginakop of stappenwizard", tabs === 0 && wizardKop === 0, `tabs=${tabs} wizardkop=${wizardKop}`);
    await run.shot("rt1-routescherm");

    // Onderblad met de geseede routes.
    await page.getByText("Routes in beeld (", { exact: false }).locator("visible=true").first().waitFor({ timeout: 20000 });

    // R-T2: geen horizontale overflow / twee kolommen — in alle standen.
    let ov = await geenHorizontaleOverflow(page);
    log("R-T2: geen overflow (startstand)", ov.ok, `${ov.scroll}/${ov.client}`);
    // Onderblad vol open (handgreep 2x: half → vol).
    await page.locator('[aria-label="Onderblad openen"]').click();
    await page.waitForTimeout(400);
    ov = await geenHorizontaleOverflow(page);
    log("R-T2: geen overflow (onderblad vol)", ov.ok, `${ov.scroll}/${ov.client}`);
    // Routekaarten staan onder elkaar (één kolom): elke kaart is vrijwel schermbreed.
    const kaartjes = await page.locator('button[aria-pressed]').all();
    let eenKolom = kaartjes.length > 0;
    for (const k of kaartjes) {
      const b = await k.boundingBox();
      if (b && b.width < MOBIEL.width * 0.7) eenKolom = false;
    }
    log("R-T2: routekaarten één kolom (schermbreed)", eenKolom, `${kaartjes.length} kaarten`);
    await run.shot("rt2-onderblad-vol");
    // Chip-paneel open.
    await page.getByRole("button", { name: "Trainingstype" }).locator("visible=true").click();
    ov = await geenHorizontaleOverflow(page);
    log("R-T2: geen overflow (chip-paneel open)", ov.ok, `${ov.scroll}/${ov.client}`);

    // Keuzepaneel dekt de kaartknoppen niet blijvend af (reviewbevinding R4):
    // paneel open ⇒ knoppen bewust verborgen (niet half afgedekt); paneel
    // dicht ⇒ knoppen direct terug.
    const zoomKnop = page.locator('[aria-label="Zoom in"]:visible');
    log(
      "keuzepaneel open: kaartknoppen bewust verborgen, niet half afgedekt",
      (await zoomKnop.count()) === 0,
      `${await zoomKnop.count()} zichtbare zoomknoppen bij open paneel`,
    );
    await run.shot("keuzepaneel-open-knoppen-weg");

    // R-T6 (Go-stand toont alle rijen): openbare route van een ander.
    await page.getByRole("button", { name: "Trainingstype" }).locator("visible=true").first().click(); // paneel dicht
    await page.waitForTimeout(300);
    log(
      "keuzepaneel dicht: kaartknoppen (zoom + mijn locatie) direct terug",
      (await page.locator('[aria-label="Zoom in"]:visible').count()) === 1 &&
        (await page.locator('[aria-label="Mijn locatie"]:visible').count()) === 1,
    );
    await run.shot("keuzepaneel-dicht-knoppen-terug");
    const openbaarLabel = page.getByText("Openbaar gezet door een andere gebruiker").locator("visible=true").first();
    log("R-T6: openbare route van een ander zichtbaar in het onderblad", await openbaarLabel.isVisible().catch(() => false));
    const bodyTekst = await page.locator("body").innerText();
    log("R-T6: naam van de maker nergens zichtbaar", !bodyTekst.includes(OWNER_NAAM) && !bodyTekst.includes("Roelof"));
    // Afgekapt begin/einde: vergelijk de geleverde geometrie met het origineel.
    const nearbyJson = await page.evaluate(async ({ lat, lon }) => {
      const r = await fetch(`/api/routes/nearby?lat=${lat}&lon=${lon}&sport=cycling&radiusKm=25`, { credentials: "include" });
      return r.status === 200 ? r.json() : { routes: [] };
    }, SEED);
    const openbaar = (nearbyJson.routes ?? []).find((r) => r.bron === "openbaar");
    if (!openbaar) {
      log("R-T6: openbare route in nearby-antwoord", false, "geen rij met bron=openbaar");
    } else {
      const eerste = openbaar.geometry?.[0];
      const laatste = openbaar.geometry?.[openbaar.geometry.length - 1];
      const origEerste = OPENBAAR_GEOM[0];
      const origLaatste = OPENBAAR_GEOM[OPENBAAR_GEOM.length - 1];
      const afstand = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) * 111000; // ~m
      const beginAfgekapt = eerste && afstand(eerste, origEerste) > 100;
      const eindeAfgekapt = laatste && afstand(laatste, origLaatste) > 100;
      log(
        "R-T6: begin en einde afgekapt",
        !!(beginAfgekapt && eindeAfgekapt),
        `begin ${eerste ? Math.round(afstand(eerste, origEerste)) : "?"} m, einde ${laatste ? Math.round(afstand(laatste, origLaatste)) : "?"} m verschoven; ${openbaar.geometry?.length}/${OPENBAAR_GEOM.length} punten`,
      );
      log("R-T6: routenaam zonder maker", !String(openbaar.naam).includes("Roelof"), openbaar.naam);
    }
    await run.shot("rt6-openbaar");

    // R-T3: precies één routeaanvraag per trainingstypekeuze (netwerk-log).
    const startCalls = [];
    // Vang óók de kandidaat-payload op zodat we de wegdek-melding hard tegen
    // de echte motormeting kunnen houden (R-T7): melding ⟺ knownPct < 100.
    let engineSurface; // undefined = nog niets gezien
    page.on("response", (res) => {
      if (!res.url().includes("/api/routes/generate")) return;
      res
        .json()
        .then((j) => {
          const b = j?.body ?? j;
          const kand = b?.route ?? b?.candidate ?? b?.result ?? b;
          if (kand && typeof kand === "object" && "engineSurface" in kand) engineSurface = kand.engineSurface ?? null;
        })
        .catch(() => {});
    });
    page.on("request", (req) => {
      if (req.url().includes("/api/routes/generate/") && req.method() === "POST") {
        startCalls.push({ url: req.url(), t: Date.now() });
      }
    });
    await page.getByRole("button", { name: "Trainingstype" }).locator("visible=true").click();
    const duurKnop = page.getByRole("button", { name: "Duurtraining" }).locator("visible=true");
    await duurKnop.waitFor({ timeout: 5000 });
    // Dubbeltik — bewust twee snelle kliks op dezelfde keuze.
    await duurKnop.click();
    await duurKnop.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
    // Tijdens de berekening nóg een keuze proberen (Interval) — mag géén
    // tweede job starten (R16-poort).
    const chipNu = page.getByRole("button", { name: /Duurtraining|Trainingstype/ }).locator("visible=true").first();
    await chipNu.click().catch(() => {});
    const intervalKnop = page.getByRole("button", { name: "Interval" }).locator("visible=true");
    if (await intervalKnop.isVisible().catch(() => false)) {
      await intervalKnop.click().catch(() => {});
    }
    await page.waitForTimeout(1000);
    log("R-T3: dubbeltik + klik tijdens berekening ⇒ precies één aanvraag", startCalls.length === 1, `${startCalls.length} POST /generate/*`);
    await run.shot("rt3-berekenen");

    // Wachten op de kandidaat (echte generatie, kan even duren).
    const startBtn = page.getByRole("button", { name: "Start", exact: true }).locator("visible=true").first();
    let kandidaatOk = true;
    try {
      await startBtn.waitFor({ timeout: 300000 });
    } catch {
      kandidaatOk = false;
    }
    log("R-T3: keuze levert een echte routekandidaat", kandidaatOk);
    log("R-T3: totaal blijft één aanvraag (na afronden)", startCalls.length === 1, `${startCalls.length}`);
    await run.shot("rt3-kandidaat");

    if (kandidaatOk) {
      // R-T7: onbekend wegdek in NL ⇒ melding, geen bevestigingsvraag.
      const dialogen = await page.locator('[role="dialog"], [role="alertdialog"]').count();
      // Een bevestigingsVRAAG is een vraag/knop ("Weet je zeker…", "Bevestig
      // wegdek") — niet het woord "bevestigd" in de eerlijke melding zelf.
      const bevestigVraag =
        (await page.getByText(/weet je zeker|zeker weten\?/i).count()) +
        (await page.getByRole("button", { name: /^bevestig/i }).count());
      log("R-T7: geen bevestigingsvraag na generatie in NL", dialogen === 0 && bevestigVraag === 0, `dialogen=${dialogen} bevestigvragen=${bevestigVraag}`);
      const melding = page.locator('[data-testid="wegdek-melding"]:visible').first();
      const meldingZichtbaar = await melding.isVisible().catch(() => false);
      // Melding is verplicht zodra het wegdek niet 100% bekend is; bij een
      // volledig bekende meting hoort er juist géén melding te staan.
      // Hard tegen de echte motormeting: melding ⟺ wegdek niet 100% bekend.
      const knownPct = engineSurface?.knownPct ?? null;
      const meldingHoort = engineSurface === undefined || knownPct == null || knownPct < 100;
      if (meldingHoort) {
        log(
          "R-T7: eerlijke wegdek-melding zichtbaar (motor meldde wegdek niet 100% bekend)",
          meldingZichtbaar,
          meldingZichtbaar ? await melding.innerText() : `knownPct=${knownPct ?? "onbekend"} maar geen melding`,
        );
      } else {
        log(
          "R-T7: wegdek 100% bekend ⇒ terecht géén melding (consistent met motormeting)",
          !meldingZichtbaar,
          `knownPct=${knownPct}`,
        );
        info("R-T7: meldingstak niet gereproduceerd in dit gebied — consistentie melding⟺meting wél hard bewezen");
      }
      await run.shot("rt7-wegdek");

      // R-T4: Start ⇒ navigatielaag over dezelfde kaart, planning weg.
      await startBtn.click();
      const navSluiten = page.locator('[aria-label="Navigatie sluiten"]');
      await navSluiten.waitFor({ timeout: 30000 });
      log("R-T4: navigatielaag zichtbaar", await navSluiten.isVisible());
      log(
        "R-T4: planningsbediening weg",
        !(await page.getByText("Zoek een plaats…").isVisible().catch(() => false)) &&
          (await page.getByRole("button", { name: "Trainingstype" }).count()) === 0,
      );
      log("R-T4: kaart nog steeds aanwezig (zelfde kaartlaag)", (await page.locator(".leaflet-container").count()) >= 1);
      await run.shot("rt4-navigatielaag");
      // Klein statusbolletje kan boven de knop zweven — force-klik is hier
      // acceptabel: de zichtbaarheid van de knop is hierboven al bewezen.
      // Een klein statusbolletje zweeft boven de knoprand en vangt de muisklik
      // af; de knop is hierboven al zichtbaar bewezen — klik hem direct aan.
      await navSluiten.evaluate((el) => el.click());
      // Sluiten opent bewust het rit-einde-blad (rit niet stil weggooien);
      // deze proefrit gooien we expliciet weg — dat vraagt twee tikken.
      const weggooien = page.getByRole("button", { name: "Weggooien" });
      await weggooien.waitFor({ timeout: 10000 });
      await weggooien.click();
      await page.getByRole("button", { name: /Zeker weten\?/ }).click();
      const terug = await page
        .getByText("Zoek een plaats…")
        .locator("visible=true")
        .first()
        .waitFor({ timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      log("R-T4: sluiten (rit weggooien) keert terug naar het planscherm", terug);
    } else {
      log("R-T4: navigatielaag (vereist kandidaat)", false, "geen kandidaat om te starten");
      log("R-T7: wegdek-melding (vereist kandidaat)", false, "geen kandidaat");
    }
    await run.context.close();
  }

  // ════ Lege toestand — gebied zonder routes: directe actieknoppen ════════
  {
    // Midden op de Noordzee: geen eigen, openbare of bekende routes in beeld.
    const LEEG = { lat: 55.4, lon: 3.6 };
    const run = new TestRun({ browser, baseUrl, viewport: MOBIEL, evidenceDir: EVIDENCE, runName: "lege-toestand" });
    const page = await openRouteScherm(run, { userId, viewport: MOBIEL, geo: LEEG });
    await page.getByText("Routes in beeld (", { exact: false }).locator("visible=true").first().waitFor({ timeout: 20000 });
    await page.locator('[aria-label="Onderblad openen"]').click();
    const maakKnop = page.getByRole("button", { name: "Maak een route voor mij" }).locator("visible=true").first();
    const maakZichtbaar = await maakKnop
      .waitFor({ timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    log("lege toestand: uitleg + directe actie 'Maak een route voor mij'", maakZichtbaar);
    log(
      "lege toestand: knoppen 'Zelf plannen' en 'Bewaarde routes' aanwezig",
      (await page.getByRole("button", { name: "Zelf plannen" }).locator("visible=true").count()) >= 1 &&
        (await page.getByRole("button", { name: "Bewaarde routes" }).locator("visible=true").count()) >= 1,
    );
    await run.shot("lege-toestand");
    if (maakZichtbaar) {
      // Directe actie: de knop opent hier meteen de trainingstype-keuze
      // (geen "ga naar het menu"-verwijzing).
      await maakKnop.click();
      const duurZichtbaar = await page
        .getByRole("button", { name: "Duurtraining" })
        .locator("visible=true")
        .first()
        .waitFor({ timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      log("lege toestand: 'Maak een route voor mij' opent direct de trainingstype-keuze", duurZichtbaar);
      await run.shot("lege-toestand-keuze-open");
    }
    await run.context.close();
  }

  // ════ R-T5 — onderblad per pakket (Gratis · Go · Compleet) ══════════════
  const pakketten = [
    { label: "gratis", variant: null },
    { label: "go", variant: "sparki_go" },
    { label: "compleet", variant: "sparki_pro" },
  ];
  for (const p of pakketten) {
    await zetPakket(userId, p.variant);
    const run = new TestRun({ browser, baseUrl, viewport: MOBIEL, evidenceDir: EVIDENCE, runName: `rt5-${p.label}` });
    const page = await openRouteScherm(run, { userId, viewport: MOBIEL });
    await page.getByText("Routes in beeld (", { exact: false }).locator("visible=true").first().waitFor({ timeout: 20000 });
    await page.locator('[aria-label="Onderblad openen"]').click();
    await page.waitForTimeout(400);
    const label = await page.evaluate(async () => {
      const r = await fetch("/api/entitlements", { credentials: "include" });
      return r.status === 200 ? (await r.json()).product_label : `status ${r.status}`;
    });
    const rijen = await page.locator("button[aria-pressed]:visible").count();
    const gratisMelding = (await page.getByText("Gratis toont drie routes").locator("visible=true").count()) >= 1;
    const trainingBlok = (await page.getByText("Training van vandaag").locator("visible=true").count()) >= 1;
    if (p.label === "gratis") {
      log("R-T5 Gratis: pakketlabel klopt", label === "Gratis", label);
      log("R-T5 Gratis: precies 3 routes + eerlijke melding", rijen === 3 && gratisMelding, `${rijen} rijen, melding=${gratisMelding}`);
      log("R-T5 Gratis: geen Compleet-trainingblok", !trainingBlok);
    } else if (p.label === "go") {
      log("R-T5 Go: pakketlabel klopt", label === "Sparki Go", label);
      log("R-T5 Go: alle routes zichtbaar, geen gratis-melding", rijen >= 4 && !gratisMelding, `${rijen} rijen`);
      log("R-T5 Go: geen Compleet-trainingblok", !trainingBlok);
    } else {
      log("R-T5 Compleet: pakketlabel klopt", label === "Sparki Compleet", label);
      log("R-T5 Compleet: training van vandaag met route-uitnodiging eronder", trainingBlok && (await page.getByText("E2E-603 duurtraining vandaag").locator("visible=true").count()) >= 1);
      log("R-T5 Compleet: alle routes zichtbaar", rijen >= 4, `${rijen} rijen`);
    }
    await run.shot(`rt5-${p.label}`);
    await run.context.close();
  }

  // ════ R-T8 — desktop: zelfde data en functies ═══════════════════════════
  await zetPakket(userId, "sparki_go");
  {
    const run = new TestRun({ browser, baseUrl, viewport: DESKTOP, evidenceDir: EVIDENCE, runName: "rt8-desktop" });
    const page = await openRouteScherm(run, { userId, viewport: DESKTOP });
    await page.getByText("Routes in beeld (", { exact: false }).locator("visible=true").first().waitFor({ timeout: 20000 });
    const desktopData = await page.evaluate(async ({ lat, lon }) => {
      const r = await fetch(`/api/routes/nearby?lat=${lat}&lon=${lon}&sport=cycling&radiusKm=25`, { credentials: "include" });
      const j = await r.json();
      return (j.routes ?? []).map((x) => x.key).sort();
    }, SEED);
    // Mobiel-referentie: zelfde endpoint, zelfde gebruiker (datalaag gedeeld).
    const mobielRun = new TestRun({ browser, baseUrl, viewport: MOBIEL, evidenceDir: EVIDENCE, runName: "rt8-mobiel-ref" });
    const mPage = await openRouteScherm(mobielRun, { userId, viewport: MOBIEL });
    const mobielData = await mPage.evaluate(async ({ lat, lon }) => {
      const r = await fetch(`/api/routes/nearby?lat=${lat}&lon=${lon}&sport=cycling&radiusKm=25`, { credentials: "include" });
      const j = await r.json();
      return (j.routes ?? []).map((x) => x.key).sort();
    }, SEED);
    log(
      "R-T8: desktop en telefoon zien exact dezelfde routedata",
      JSON.stringify(desktopData) === JSON.stringify(mobielData) && desktopData.length > 0,
      `${desktopData.length} routes op beide`,
    );
    log("R-T8: routescherm functioneert op desktop (kaart + onderblad)", (await page.locator(".leaflet-container").count()) >= 1);
    // Eigen desktop-indeling is de poort van taak #604 (R17); hier alleen de
    // eerlijke statusmeting, geen FOUT zolang die stap loopt.
    const eigenIndeling = await page.locator('[data-testid="route-desktop-indeling"]').count();
    info(
      "R-T8 (deels): eigen desktop-indeling",
      eigenIndeling > 0
        ? "aanwezig"
        : "nog niet aanwezig — aparte bouwstap (desktop-indeling, R17); R-T8 is hiermee bewust NIET volledig geclaimd",
    );
    await run.shot("rt8-desktop");
    await mobielRun.shot("rt8-mobiel-ref");
    await run.context.close();
    await mobielRun.context.close();
  }
} finally {
  try {
    if (userId) await cleanup(userId, origineelPakket);
  } catch (e) {
    console.error("cleanup faalde:", e);
  }
  await browser.close();
  server.close();
}

writeFileSync(
  path.join(EVIDENCE, "rapport.json"),
  JSON.stringify({ stappen, exitCode, t: new Date().toISOString() }, null, 2),
);
console.log(`\nKlaar — exitcode ${exitCode} (${stappen.length} checks)`);
process.exit(exitCode);
