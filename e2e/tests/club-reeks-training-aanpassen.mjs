// Taak #590 — Bewijs met echte browserkliks dat het "Training aanpassen"-
// paneel per reeks (taak 586, /club/beheer → Training plannen-venster) werkt:
//  1. reeks aanmaken via de echte UI (Wekelijks herhalen → "Plan reeks");
//  2. één training verplaatsen ("Alleen deze aanpassen") — alleen die schuift;
//  3. één datum overslaan ("Deze overslaan");
//  4. "Deze en volgende" (reeks splitsen) met nieuwe starttijd;
//  5. controle dat de trainingslijst (/club → Clubtrainingen) het resultaat
//     toont: verplaatste datum zichtbaar, oorspronkelijke + overgeslagen datum
//     weg, en de gesplitste trainingen tonen de nieuwe starttijd.
//
// Deterministische data: het QA-account krijgt vóór de kliks een eigen verse
// club (owner, status actief) + actief seizoen; andere actieve lidmaatschappen
// van het QA-account worden beëindigd zodat /club/beheer déze club toont.
//
// Draaien: node e2e/tests/club-reeks-training-aanpassen.mjs
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
  "../evidence/club-reeks-training-aanpassen",
);
mkdirSync(EVIDENCE, { recursive: true });

const CLUBNAAM = "E2E-590 Reeksclub";
const TITEL = "E2E-590 Duurtraining";

// Reeks: wekelijks vanaf ma 10-08 t/m 07-09 → 10/08, 17/08, 24/08, 31/08, 07/09.
const START = "2026-08-10";
const EIND = "2026-09-07";
const VERPLAATS_VAN = "2026-08-17";
const VERPLAATS_NAAR = "2026-08-18";
const SKIP_DATUM = "2026-08-24";
const SPLIT_VANAF = "2026-08-31";
const NIEUWE_TIJD = "19:30";

function fmt(iso) {
  // Zelfde weergave als formatDate in club.tsx: "ma 17 aug".
  return new Date(`${iso}T12:00:00`).toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const stappen = [];
let fouten = 0;
function log(stap, status, detail = "") {
  stappen.push({ stap, status, detail, t: new Date().toISOString() });
  if (status === "FOUT") fouten += 1;
  console.log(`[${status}] ${stap}${detail ? ` — ${detail}` : ""}`);
}

// ── Seed: verse club (owner) + actief seizoen voor het QA-account ───────────
async function seedClub(clerkId) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    // Oude runs van deze test opruimen.
    await db.query(`DELETE FROM clubs WHERE name = $1`, [CLUBNAAM]);
    // Andere actieve lidmaatschappen beëindigen zodat /club/beheer
    // deterministisch déze club kiest (QA-account is een dedicated testaccount).
    await db.query(
      `UPDATE club_members SET ended_at = now(), ended_reason = 'e2e-590 reset'
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
       VALUES ($1, 'E2E 2026', '2026-08-01', '2026-12-31', 'actief')`,
      [clubId],
    );
    return clubId;
  } finally {
    await db.end();
  }
}

async function trainingsInDb(clubId) {
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const r = await db.query(
      `SELECT training_date::text AS d, start_time AS t, series_id
       FROM club_trainings WHERE club_id = $1 ORDER BY training_date`,
      [clubId],
    );
    return r.rows;
  } finally {
    await db.end();
  }
}

async function statusTekst(page, verwacht) {
  await page
    .locator(`[role="status"]`, { hasText: verwacht })
    .first()
    .waitFor({ state: "visible", timeout: 8000 });
}

const { server, baseUrl } = await startProdServer();
const browser = await launchBrowser();
const userId = await ensureE2eUser();
let exitCode = 0;

// Volledige doorloop per viewport (WP-S1: telefoon én desktop); elke run
// krijgt een eigen verse club zodat de stappen deterministisch blijven.
async function doorloop(viewport) {
  const V = viewport;
  const run = new TestRun({
    browser,
    baseUrl,
    viewport,
    evidenceDir: EVIDENCE,
    runName: "reeks-aanpassen",
  });
  await run.open();
  await run.loginWithTicket(await mintTicket(userId));
  await run.page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await run.acceptConsentIfPresent();

  // Identiteit hard controleren (WP-S1): juiste QA-clerkId, anders falen.
  const me = await run.verifyIdentity({ expectClerkId: userId });
  if (me.status !== 200) throw new Error(`/api/auth/me status ${me.status}`);
  log(`[${V}] Login + identiteit QA-account`, "OK", userId);

  const clubId = await seedClub(me.body.clerkId);
  log(`[${V}] Seed: verse club + actief seizoen`, "OK", `clubId=${clubId}`);

  // ── /club/beheer → Training plannen-venster ───────────────────────────────
  await run.page.goto(`${baseUrl}/club/beheer`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(1000);
  await run.clickAndVerify({
    label: "training-plannen-venster",
    locator: run.page.getByRole("button", { name: "Training plannen" }).first(),
    expectVisibleText: ["Clubtraining plannen", "Wekelijks herhalen"],
  });
  log(`[${V}] Training plannen-venster geopend`, "OK");

  // ── 1. Reeks aanmaken via de echte UI ────────────────────────────────────
  const sheet = run.page.locator('section[aria-label="Training plannen"]');
  await sheet.getByPlaceholder(/Titel/).fill(TITEL);
  await sheet.locator('input[type="date"]').first().fill(START);
  await sheet.locator('input[type="checkbox"]').check();
  await sheet.locator('input[aria-label*="Einddatum"]').fill(EIND);
  await run.shot("reeks-formulier-ingevuld");
  await sheet.getByRole("button", { name: "Plan reeks" }).click();
  await sheet.getByText("Reeks gepland", { exact: false }).waitFor({ timeout: 8000 });
  await run.shot("reeks-gepland");
  const naAanmaak = await trainingsInDb(clubId);
  if (naAanmaak.length !== 5) throw new Error(`verwacht 5 trainingen, kreeg ${naAanmaak.length}`);
  log(`[${V}] Reeks aangemaakt via UI`, "OK", `5 trainingen ${START}…${EIND}`);

  // Paneel openen.
  await sheet.getByText("Herhalende trainingen").waitFor({ timeout: 8000 });
  await run.clickAndVerify({
    label: "training-aanpassen-paneel",
    locator: sheet.getByRole("button", { name: "Training aanpassen" }).first(),
    expectVisibleText: ["Alleen deze aanpassen", "Deze en volgende", "Deze overslaan"],
  });
  log(`[${V}] Training aanpassen-paneel geopend`, "OK");

  const paneel = sheet;
  const veldTrainingOp = () => paneel.getByLabel("Training op");
  const veldNieuweDatum = () => paneel.getByLabel("Nieuwe datum (alleen deze)");

  // ── 2. Eén training verplaatsen (alleen deze) ────────────────────────────
  await veldTrainingOp().fill(VERPLAATS_VAN);
  await veldNieuweDatum().fill(VERPLAATS_NAAR);
  await paneel.getByRole("button", { name: "Alleen deze aanpassen" }).click();
  await statusTekst(run.page, "Alleen deze training is aangepast");
  await run.shot("verplaatst-alleen-deze");
  let rows = await trainingsInDb(clubId);
  if (!rows.some((r) => r.d === VERPLAATS_NAAR) || rows.some((r) => r.d === VERPLAATS_VAN))
    throw new Error(`verplaatsen faalde: ${rows.map((r) => r.d).join(",")}`);
  log(`[${V}] Eén training verplaatst (alleen deze)`, "OK", `${VERPLAATS_VAN} → ${VERPLAATS_NAAR}`);

  // ── 3. Eén datum overslaan ────────────────────────────────────────────────
  await veldNieuweDatum().fill("");
  await veldTrainingOp().fill(SKIP_DATUM);
  await paneel.getByRole("button", { name: "Deze overslaan" }).click();
  await statusTekst(run.page, "Training overgeslagen");
  await run.shot("overgeslagen");
  rows = await trainingsInDb(clubId);
  if (rows.some((r) => r.d === SKIP_DATUM))
    throw new Error(`overslaan faalde: ${SKIP_DATUM} staat er nog`);
  log(`[${V}] Eén datum overgeslagen`, "OK", SKIP_DATUM);

  // ── 4. Deze en volgende (reeks splitsen) met nieuwe starttijd ────────────
  await veldTrainingOp().fill(SPLIT_VANAF);
  await paneel.getByLabel("Nieuwe starttijd").fill(NIEUWE_TIJD);
  await paneel.getByRole("button", { name: "Deze en volgende" }).click();
  await statusTekst(run.page, "reeks gesplitst");
  await run.shot("gesplitst-deze-en-volgende");
  rows = await trainingsInDb(clubId);
  const vanaf = rows.filter((r) => r.d >= SPLIT_VANAF);
  const ervoor = rows.filter((r) => r.d < SPLIT_VANAF);
  if (vanaf.length !== 2 || !vanaf.every((r) => String(r.t).startsWith("19:30")))
    throw new Error(`splitsen faalde: ${JSON.stringify(vanaf)}`);
  if (ervoor.some((r) => String(r.t ?? "").startsWith("19:30")))
    throw new Error("eerdere trainingen kregen ONTERECHT de nieuwe tijd");
  // De eerder verplaatste training is losgekoppeld (series_id null) — telt
  // niet mee; de reeks zelf moet in TWEE reeksen uiteenvallen.
  const seriesIds = new Set(rows.map((r) => r.series_id).filter((s) => s != null));
  if (seriesIds.size !== 2)
    throw new Error(`reeks is niet gesplitst in twee reeksen: ${JSON.stringify(rows)}`);
  log(`[${V}] Deze en volgende (reeks gesplitst)`, "OK", `2 trainingen om ${NIEUWE_TIJD}, eerdere ongewijzigd`);

  // ── 5. Trainingslijst toont het resultaat (/club → Clubtrainingen) ───────
  await run.page.goto(`${baseUrl}/club`, { waitUntil: "networkidle" });
  await run.page.waitForTimeout(1000);
  const lijst = run.page.locator('#club-trainingen');
  await lijst.waitFor({ timeout: 8000 });
  const lijstTekst = (await lijst.innerText()).replace(/\s+/g, " ");
  const eisen = [
    [fmt(VERPLAATS_NAAR), true, "verplaatste datum zichtbaar"],
    [fmt(VERPLAATS_VAN), false, "oorspronkelijke datum weg"],
    [fmt(SKIP_DATUM), false, "overgeslagen datum weg"],
    [`${fmt(SPLIT_VANAF)} · ${NIEUWE_TIJD}`, true, "gesplitste training met nieuwe tijd"],
    [`${fmt(START)}`, true, "eerste (ongewijzigde) training zichtbaar"],
  ];
  for (const [tekst, moet, oms] of eisen) {
    const zichtbaar = lijstTekst.includes(tekst);
    if (zichtbaar !== moet) throw new Error(`trainingslijst: ${oms} faalde ("${tekst}" ${zichtbaar ? "wel" : "niet"} gevonden) — lijst: ${lijstTekst}`);
    log(`[${V}] Trainingslijst: ${oms}`, "OK", tekst);
  }
  await run.shot("trainingslijst-resultaat");

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
    JSON.stringify({ stappen, fouten, t: new Date().toISOString() }, null, 2),
  );
  await browser.close();
  server.close();
}

console.log(fouten === 0 ? "✅ Reeks-aanpassen schermbewijs geslaagd" : "❌ Schermbewijs faalde");
console.log(`Bewijs: ${EVIDENCE}`);
process.exit(exitCode);
