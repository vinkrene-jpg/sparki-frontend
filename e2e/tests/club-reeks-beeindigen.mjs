// Taak #593 — Bewijs met echte browserkliks dat "Beëindigen" en "Annuleren"
// per reeks in /club/beheer (Training plannen-venster, taak 586/C1) doen wat
// de API-test C-T4 al bewees:
//  1. "Beëindigen" op een reeks met deels verstreken trainingen: alleen de
//     toekomstige geplande trainingen verdwijnen; verstreken/uitgevoerde
//     trainingen blijven staan (DB) en de uitgevoerde training van vandaag
//     blijft zichtbaar in de trainingslijst (/club → Clubtrainingen);
//  2. "Annuleren" op een tweede reeks: álle nog geplande trainingen van die
//     reeks verdwijnen (ook verstreken geplande), de reeks wordt geannuleerd.
//
// Deterministische data: het QA-account krijgt vóór de kliks een eigen verse
// club (owner, actief) + actief seizoen; de reeksen + trainingen worden direct
// geseed (deels in het verleden — dat kan niet via de UI). Datums zijn
// relatief aan vandaag (Europe/Amsterdam) zodat de test groen blijft.
//
// Draaien: node e2e/tests/club-reeks-beeindigen.mjs
// Vereist: api-server draait (poort 80) + verse prod-build
//   (cd artifacts/sparki && PORT=5000 BASE_PATH=/ pnpm run build)
import { launchBrowser, ensureE2eUser, mintTicket, TestRun } from "../harness.mjs";
import { startProdServer } from "../serve-prod.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// pg is geen directe workspace-dep van e2e/ — resolve via lib/db.
const require = createRequire(new URL("../../lib/db/package.json", import.meta.url));
const { Client } = require("pg");

const EVIDENCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../evidence/club-reeks-beeindigen",
);
mkdirSync(EVIDENCE, { recursive: true });

const CLUBNAAM = "E2E-593 Reeksclub";
const TITEL_A = "E2E-593 Duurtraining"; // reeks die we Beëindigen
const TITEL_B = "E2E-593 Sprinttraining"; // reeks die we Annuleren

// Vandaag in Europe/Amsterdam (zelfde definitie als amsterdamToday server-side).
function amsterdamToday() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });
}
function plusDagen(iso, n) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function fmt(iso) {
  // Zelfde weergave als formatDate in club.tsx: "ma 17 aug".
  return new Date(`${iso}T12:00:00`).toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const VANDAAG = amsterdamToday();
// Reeks A: verleden gepland, gisteren uitgevoerd, vandaag uitgevoerd, 2× toekomst gepland.
const A = {
  verledenGepland: plusDagen(VANDAAG, -8),
  gisterenUitgevoerd: plusDagen(VANDAAG, -1),
  vandaagUitgevoerd: VANDAAG,
  toekomst1: plusDagen(VANDAAG, 6),
  toekomst2: plusDagen(VANDAAG, 13),
};
// Reeks B: verleden gepland + 2× toekomst gepland — alles moet weg bij Annuleren.
const B = {
  verledenGepland: plusDagen(VANDAAG, -7),
  toekomst1: plusDagen(VANDAAG, 7),
  toekomst2: plusDagen(VANDAAG, 14),
};

const stappen = [];
let fouten = 0;
function log(stap, status, detail = "") {
  stappen.push({ stap, status, detail, t: new Date().toISOString() });
  if (status === "FOUT") fouten += 1;
  console.log(`[${status}] ${stap}${detail ? ` — ${detail}` : ""}`);
}

// ── Seed: verse club (owner) + seizoen + twee reeksen met deels verstreken
//    trainingen. UI kan geen verleden-trainingen aanmaken; de seed spiegelt
//    exact wat de reeks-aanmaakroute materialiseert (series_id-koppeling).
async function seed(clerkId) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query(`DELETE FROM clubs WHERE name = $1`, [CLUBNAAM]);
    await db.query(
      `UPDATE club_members SET ended_at = now(), ended_reason = 'e2e-593 reset'
       WHERE clerk_id = $1 AND ended_at IS NULL`,
      [clerkId],
    );
    const club = await db.query(
      `INSERT INTO clubs (name, owner_clerk_id, status, organisation_type)
       VALUES ($1, $2, 'actief', 'CLUB') RETURNING id`,
      [CLUBNAAM, clerkId],
    );
    const clubId = club.rows[0].id;
    await db.query(
      `INSERT INTO club_members (club_id, clerk_id, role) VALUES ($1, $2, 'owner')`,
      [clubId, clerkId],
    );
    await db.query(
      `INSERT INTO club_seasons (club_id, name, starts_on, ends_on, status)
       VALUES ($1, 'E2E 2026', $2, $3, 'actief')`,
      [clubId, plusDagen(VANDAAG, -60), plusDagen(VANDAAG, 120)],
    );

    async function seedReeks(titel, startDate, endDate, trainingen) {
      const s = await db.query(
        `INSERT INTO club_training_series
           (club_id, frequency, start_date, end_date, status, title, start_time, created_by_clerk_id)
         VALUES ($1, 'weekly', $2, $3, 'active', $4, '18:30', $5) RETURNING id`,
        [clubId, startDate, endDate, titel, clerkId],
      );
      const seriesId = s.rows[0].id;
      for (const { d, status } of trainingen) {
        await db.query(
          `INSERT INTO club_trainings
             (club_id, title, training_date, start_time, status, series_id, created_by_clerk_id)
           VALUES ($1, $2, $3, '18:30', $4, $5, $6)`,
          [clubId, titel, d, status, seriesId, clerkId],
        );
      }
      return seriesId;
    }

    const seriesA = await seedReeks(TITEL_A, A.verledenGepland, A.toekomst2, [
      { d: A.verledenGepland, status: "gepland" },
      { d: A.gisterenUitgevoerd, status: "uitgevoerd" },
      { d: A.vandaagUitgevoerd, status: "uitgevoerd" },
      { d: A.toekomst1, status: "gepland" },
      { d: A.toekomst2, status: "gepland" },
    ]);
    const seriesB = await seedReeks(TITEL_B, B.verledenGepland, B.toekomst2, [
      { d: B.verledenGepland, status: "gepland" },
      { d: B.toekomst1, status: "gepland" },
      { d: B.toekomst2, status: "gepland" },
    ]);
    return { clubId, seriesA, seriesB };
  } finally {
    await db.end();
  }
}

async function dbStand(clubId) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const t = await db.query(
      `SELECT title, training_date::text AS d, status, series_id
       FROM club_trainings WHERE club_id = $1 ORDER BY training_date`,
      [clubId],
    );
    const s = await db.query(
      `SELECT id, title, status FROM club_training_series WHERE club_id = $1 ORDER BY id`,
      [clubId],
    );
    return { trainingen: t.rows, reeksen: s.rows };
  } finally {
    await db.end();
  }
}

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();
const userId = await ensureE2eUser();
let exitCode = 0;

// Volledige doorloop per viewport (WP-S1: telefoon én desktop); elke run
// krijgt een eigen verse club + reeksen zodat de stappen deterministisch zijn.
async function doorloop(viewport) {
  const V = viewport;
  const run = new TestRun({
    browser,
    baseUrl,
    viewport,
    evidenceDir: EVIDENCE,
    runName: "reeks-beeindigen",
  });
  await run.open();
  await run.loginWithTicket(await mintTicket(userId));
  await run.page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await run.acceptConsentIfPresent();

  // Identiteit hard controleren (WP-S1): juiste QA-clerkId, anders falen.
  const me = await run.verifyIdentity({ expectClerkId: userId });
  if (me.status !== 200) throw new Error(`/api/auth/me status ${me.status}`);
  log(`[${V}] Login + identiteit QA-account`, "OK", userId);

  const { clubId, seriesA, seriesB } = await seed(me.body.clerkId);
  log(`[${V}] Seed: club + 2 reeksen (deels verstreken)`, "OK", `clubId=${clubId}`);

  // ── /club/beheer → Training plannen-venster ───────────────────────────────
  await run.page.goto(`${baseUrl}/club/beheer`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(1000);
  await run.clickAndVerify({
    label: "training-plannen-venster",
    locator: run.page.getByRole("button", { name: "Training plannen" }).first(),
    expectVisibleText: ["Clubtraining plannen", "Herhalende trainingen", TITEL_A, TITEL_B],
  });
  log(`[${V}] Training plannen-venster toont beide reeksen`, "OK");

  const sheet = run.page.locator('section[aria-label="Training plannen"]');
  const rij = (titel) =>
    sheet.locator("div.pt-2").filter({ has: run.page.getByText(titel, { exact: true }) });

  // ── 1. "Beëindigen" op reeks A ────────────────────────────────────────────
  await run.shot("voor-beeindigen");
  await rij(TITEL_A).getByRole("button", { name: "Beëindigen" }).click();
  // UI-signaal: de reeks verdwijnt uit de lijst met actieve reeksen.
  await rij(TITEL_A).waitFor({ state: "detached", timeout: 8000 });
  await run.shot("na-beeindigen-reeks-weg");
  if (!(await rij(TITEL_B).isVisible())) throw new Error("reeks B verdween ONTERECHT mee");
  log(`[${V}] Klik Beëindigen: reeks A weg uit actieve lijst, B blijft`, "OK");

  let stand = await dbStand(clubId);
  const rijenA = stand.trainingen.filter((t) => t.title === TITEL_A);
  const datumsA = rijenA.map((t) => t.d);
  if (datumsA.includes(A.toekomst1) || datumsA.includes(A.toekomst2))
    throw new Error(`toekomstige geplande trainingen van reeks A staan er nog: ${datumsA.join(",")}`);
  for (const d of [A.verledenGepland, A.gisterenUitgevoerd, A.vandaagUitgevoerd]) {
    if (!datumsA.includes(d)) throw new Error(`verstreken/uitgevoerde training ${d} is ONTERECHT verwijderd`);
  }
  const reeksA = stand.reeksen.find((s) => s.id === seriesA);
  if (reeksA?.status !== "ended") throw new Error(`reeks A status = ${reeksA?.status}, verwacht ended`);
  log(`[${V}] DB na Beëindigen: toekomst weg, historie (3 rijen) intact, status ended`, "OK");

  // ── 2. Historie zichtbaar op het scherm: /club → Clubtrainingen ──────────
  // De uitgevoerde training van vandaag valt binnen het lijstvenster (vanaf
  // vandaag) en moet dus zichtbaar blijven; de beëindigde toekomst niet.
  await run.page.goto(`${baseUrl}/club`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(1000);
  const lijst = run.page.locator("#club-trainingen");
  await lijst.waitFor({ timeout: 8000 });
  let lijstTekst = (await lijst.innerText()).replace(/\s+/g, " ");
  const eisen1 = [
    [fmt(A.vandaagUitgevoerd), true, "uitgevoerde training van vandaag (reeks A) blijft zichtbaar"],
    [fmt(A.toekomst1), false, "beëindigde toekomstige training A+6 weg"],
    [fmt(A.toekomst2), false, "beëindigde toekomstige training A+13 weg"],
    [fmt(B.toekomst1), true, "reeks B (nog actief) toekomst zichtbaar"],
  ];
  for (const [tekst, moet, oms] of eisen1) {
    const zichtbaar = lijstTekst.includes(tekst);
    if (zichtbaar !== moet)
      throw new Error(`trainingslijst: ${oms} faalde ("${tekst}" ${zichtbaar ? "wel" : "niet"} gevonden) — lijst: ${lijstTekst}`);
    log(`[${V}] Trainingslijst: ${oms}`, "OK", tekst);
  }
  await run.shot("trainingslijst-na-beeindigen");

  // ── 3. "Annuleren" op reeks B → hele reeks weg ────────────────────────────
  await run.page.goto(`${baseUrl}/club/beheer`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(1000);
  await run.clickAndVerify({
    label: "training-plannen-venster-2",
    locator: run.page.getByRole("button", { name: "Training plannen" }).first(),
    expectVisibleText: ["Clubtraining plannen", TITEL_B],
  });
  await rij(TITEL_B).getByRole("button", { name: "Annuleren" }).click();
  await rij(TITEL_B).waitFor({ state: "detached", timeout: 8000 });
  await run.shot("na-annuleren-reeks-weg");
  log(`[${V}] Klik Annuleren: reeks B weg uit actieve lijst`, "OK");

  stand = await dbStand(clubId);
  const rijenB = stand.trainingen.filter((t) => t.title === TITEL_B);
  if (rijenB.length !== 0)
    throw new Error(`geannuleerde reeks B heeft nog trainingen: ${JSON.stringify(rijenB)}`);
  const reeksB = stand.reeksen.find((s) => s.id === seriesB);
  if (reeksB?.status !== "cancelled") throw new Error(`reeks B status = ${reeksB?.status}, verwacht cancelled`);
  // Historie van reeks A mag door het annuleren van B niet geraakt zijn.
  if (stand.trainingen.filter((t) => t.title === TITEL_A).length !== 3)
    throw new Error("historie van reeks A is geraakt door annuleren van reeks B");
  log(`[${V}] DB na Annuleren: hele reeks B weg (ook verstreken), historie A intact`, "OK");

  // ── 4. Trainingslijst toont reeks B niet meer, historie A nog wel ────────
  await run.page.goto(`${baseUrl}/club`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(1000);
  await lijst.waitFor({ timeout: 8000 });
  lijstTekst = (await lijst.innerText()).replace(/\s+/g, " ");
  const eisen2 = [
    [fmt(B.toekomst1), false, "geannuleerde training B+7 weg"],
    [fmt(B.toekomst2), false, "geannuleerde training B+14 weg"],
    [fmt(A.vandaagUitgevoerd), true, "uitgevoerde training van vandaag blijft ook nu zichtbaar"],
  ];
  for (const [tekst, moet, oms] of eisen2) {
    const zichtbaar = lijstTekst.includes(tekst);
    if (zichtbaar !== moet)
      throw new Error(`trainingslijst: ${oms} faalde ("${tekst}" ${zichtbaar ? "wel" : "niet"} gevonden) — lijst: ${lijstTekst}`);
    log(`[${V}] Trainingslijst: ${oms}`, "OK", tekst);
  }
  await run.shot("trainingslijst-na-annuleren");

  await run.close();
}

try {
  await doorloop("desktop");
  await doorloop("mobiel");
} catch (err) {
  exitCode = 1;
  log("Doorloop", "FOUT", String(err?.message ?? err));
} finally {
  writeFileSync(
    path.join(EVIDENCE, "verslag.json"),
    JSON.stringify({ stappen, fouten, vandaag: VANDAAG, t: new Date().toISOString() }, null, 2),
  );
  await browser.close();
  server.close();
}

console.log(fouten === 0 ? "✅ Reeks-beëindigen schermbewijs geslaagd" : "❌ Schermbewijs faalde");
console.log(`Bewijs: ${EVIDENCE}`);
process.exit(exitCode);
