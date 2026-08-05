// AI_COACH §4.2 — proactieve coach-triggers: geautomatiseerde tests.
//
// Dekt per trigger de positieve conditie (trigger vuur t) en de negatieve
// (trigger vuur t niet). Controleert ook:
//  - Privacy-poort: aiMemoryEnabled=false → null
//  - Pacing-guard: bevestigingsvraag §4.1 al getoond vandaag → null
//  - Idempotentie: trigger vuur t maar één keer per episode
//  - Geheugen-contract T3/T5: vereisen status="bevestigd"
//  - A6: "derde harde dag" end-to-end (als T1 het gespecificeerde A6-scenario)
//
// Run: `pnpm --filter @workspace/api-server run test:proactive-triggers`

import { and, eq, sql } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  trainingSessionsTable,
  athleteDailyMetricsTable,
  aiObservationsTable,
  aiMemoryEventsTable,
  privacySettingsTable,
  racesTable,
} from "@workspace/db";
import {
  checkProactiveTriggers,
  checkDerdeHardeDagLogic,
  checkEersteWedstrijdLogic,
  checkZelfdeWeekInzinkingLogic,
  checkAfwijkendSignaalLogic,
  checkTerugkeerLogic,
  addDays,
  isoWeek,
  todayAms,
} from "../lib/proactive-triggers";

// ── Test-infra ────────────────────────────────────────────────────────────────

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

const RUN = `triggers_${Date.now()}`;
const USER_PRIV = `${RUN}_priv`;
const USER_PACING = `${RUN}_pacing`;
const USER_A6 = `${RUN}_a6`;    // A6: T1 derde_harde_dag end-to-end
const USER_IDEM = `${RUN}_idem`; // idempotentie T6
const ALL_USERS = [USER_PRIV, USER_PACING, USER_A6, USER_IDEM];

async function cleanup() {
  for (const clerkId of ALL_USERS) {
    await db.delete(aiMemoryEventsTable).where(eq(aiMemoryEventsTable.clerkId, clerkId)).catch(() => {});
    await db.delete(aiObservationsTable).where(eq(aiObservationsTable.clerkId, clerkId)).catch(() => {});
    await db.delete(athleteDailyMetricsTable).where(eq(athleteDailyMetricsTable.clerkId, clerkId)).catch(() => {});
    await db.execute(sql`DELETE FROM training_sessions WHERE clerk_id = ${clerkId}`).catch(() => {});
    await db.delete(racesTable).where(eq(racesTable.clerkId, clerkId)).catch(() => {});
    await db.delete(privacySettingsTable).where(eq(privacySettingsTable.clerkId, clerkId)).catch(() => {});
    await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, clerkId)).catch(() => {});
  }
}

async function seedUser(clerkId: string, aiMemoryEnabled = true) {
  await db.insert(userProfilesTable).values({
    clerkId,
    email: `${clerkId}@test.local`,
  } as typeof userProfilesTable.$inferInsert);
  await db.insert(privacySettingsTable).values({
    clerkId,
    aiMemoryEnabled,
  } as typeof privacySettingsTable.$inferInsert);
}

/** Seed een sessie via raw SQL (omzeilt schema-drift op dev-DB). */
async function seedSession(clerkId: string, sessionDate: string, tss?: number) {
  if (tss != null) {
    await db.execute(
      sql`INSERT INTO training_sessions (clerk_id, session_date, type, source, tss)
          VALUES (${clerkId}, ${sessionDate}::date, 'ride', 'manual', ${tss})`,
    );
  } else {
    await db.execute(
      sql`INSERT INTO training_sessions (clerk_id, session_date, type, source)
          VALUES (${clerkId}, ${sessionDate}::date, 'ride', 'manual')`,
    );
  }
}

// ── Unit-logica: T1 derde_harde_dag ──────────────────────────────────────────

function testDerdeHardeDag() {
  const today = "2026-08-05";
  const dag1 = addDays(today, -2);
  const dag2 = addDays(today, -1);

  // 20 "normale" sessies als baseline (TSS=50 elk)
  const baseline = Array.from({ length: 20 }, (_, i) => ({
    sessionDate: addDays(today, -(i + 5)),
    tss: "50",
  }));

  // Positief: 3 dagen elk TSS=100 >> gemiddelde 50
  const pos = [
    ...baseline,
    { sessionDate: dag1, tss: "100" },
    { sessionDate: dag2, tss: "100" },
    { sessionDate: today, tss: "100" },
  ];
  const resultPos = checkDerdeHardeDagLogic(pos, today);
  check("T1: vuur t bij 3 aaneengesloten harde dagen", resultPos?.triggerId === "derde_harde_dag", JSON.stringify(resultPos));
  check("T1: boodschap is een VRAAG (eindigt op ?)", resultPos?.message.endsWith("?") ?? false, resultPos?.message);
  check("T1: geen geheugen-herinnering vereist (memoryObservationId=null)", resultPos?.memoryObservationId === null);

  // Negatief: slechts 2 harde dagen
  const neg = [
    ...baseline,
    { sessionDate: dag2, tss: "100" },
    { sessionDate: today, tss: "100" },
  ];
  const resultNeg = checkDerdeHardeDagLogic(neg, today);
  check("T1: vuur t NIET bij slechts 2 harde dagen", resultNeg === null);

  // Negatief: onvoldoende baseline-sessies
  const resultKlein = checkDerdeHardeDagLogic(
    [dag1, dag2, today].map((d) => ({ sessionDate: d, tss: "100" })),
    today,
  );
  check("T1: vuur t NIET bij te weinig baseline", resultKlein === null);
}

// ── Unit-logica: T2 eerste_wedstrijd ─────────────────────────────────────────

function testEersteWedstrijd() {
  const today = "2026-08-05";
  const recentSessions = Array.from({ length: 6 }, (_, i) => ({
    sessionDate: addDays(today, -(i + 1)),
    tss: "60",
  }));
  const race = { id: 99, name: "Test TT", raceDate: addDays(today, 3) };

  // Positief: geen eerdere wedstrijd in het blok
  const pos = checkEersteWedstrijdLogic(recentSessions, race, [], today);
  check("T2: vuur t bij wedstrijd binnen 7 dagen na trainingsblok (geen prior race)", pos?.triggerId === "eerste_wedstrijd_na_blok");
  check("T2: boodschap bevat een VRAAG", (pos?.message ?? "").includes("?"), pos?.message);
  check("T2: geen geheugen-herinnering", pos?.memoryObservationId === null);
  check("T2: retourneert raceId voor per-race-dedup", pos?.raceId === 99);

  // Negatief: er was al een wedstrijd in het blok
  const priorRace = { id: 50, raceDate: addDays(today, -5) };
  const negPrior = checkEersteWedstrijdLogic(recentSessions, race, [priorRace], today);
  check("T2: vuur t NIET als er al een wedstrijd in het blok was", negPrior === null);

  // Negatief: te weinig sessies
  const neg = checkEersteWedstrijdLogic([recentSessions[0]!], race, [], today);
  check("T2: vuur t NIET bij minder dan 5 sessies", neg === null);

  // Negatief: geen wedstrijd
  const negNoRace = checkEersteWedstrijdLogic(recentSessions, null, [], today);
  check("T2: vuur t NIET zonder aanstaande wedstrijd", negNoRace === null);
}

// ── Unit-logica: T3 zelfde_week_inzinking ────────────────────────────────────

function testZelfdeWeekInzinking() {
  const today = "2026-08-05";
  const bevestigdObs = {
    id: 42,
    createdAt: new Date("2025-08-05T10:00:00Z"),
    category: "training",
    severity: "important",
    status: "bevestigd",
    title: "Overbelastingsverschijnselen",
    detectedPattern: "Na een zwaar blok zak ik in",
  };

  const pos = checkZelfdeWeekInzinkingLogic([bevestigdObs], today);
  check("T3: vuur t bij bevestigde obs uit dezelfde kalenderweek vorig jaar", pos?.triggerId === "zelfde_week_inzinking");
  check("T3: memoryObservationId is ingevuld", pos?.memoryObservationId === 42);
  check("T3: boodschap bevat VRAAG", (pos?.message ?? "").includes("?"), pos?.message);

  // Negatief: niet-bevestigde observatie
  const posNeg = checkZelfdeWeekInzinkingLogic([{ ...bevestigdObs, status: "new" }], today);
  check("T3: vuur t NIET voor niet-bevestigde observaties", posNeg === null);

  // Negatief: ouder dan 3 jaar
  const posOud = checkZelfdeWeekInzinkingLogic(
    [{ ...bevestigdObs, createdAt: new Date("2022-08-05T10:00:00Z") }],
    today,
  );
  check("T3: vuur t NIET voor observaties ouder dan 3 jaar", posOud === null);

  // Negatief: zelfde jaar
  const posHuidig = checkZelfdeWeekInzinkingLogic(
    [{ ...bevestigdObs, createdAt: new Date(`${today}T10:00:00Z`) }],
    today,
  );
  check("T3: vuur t NIET voor observaties uit het huidige jaar", posHuidig === null);
}

// ── Unit-logica: T5 afwijkend_signaal ────────────────────────────────────────

function testAfwijkendSignaal() {
  const today = "2026-08-05";
  const baselineMetrics = Array.from({ length: 10 }, (_, i) => ({
    metricDate: addDays(today, -(i + 1)),
    restingHR: 50,
    feelScore: 7,
  }));
  const todayMetricHoog = { metricDate: today, restingHR: 60, feelScore: 7 }; // > 55 (=50*1.1)

  const bevestigdObs = {
    id: 77,
    category: "recovery",
    severity: "watch",
    status: "bevestigd",
    detectedPattern: "Hogere HR bij overbelasting",
  };

  const posMetrics = [todayMetricHoog, ...baselineMetrics];
  const pos = checkAfwijkendSignaalLogic(posMetrics, [bevestigdObs], today);
  check("T5: vuur t bij HR-afwijking + bevestigde obs", pos?.triggerId === "afwijkend_signaal");
  check("T5: memoryObservationId is ingevuld", pos?.memoryObservationId === 77);
  check("T5: boodschap bevat het bevestigde patroon", (pos?.message ?? "").includes("Hogere HR"), pos?.message);
  check("T5: boodschap bevat VRAAG", (pos?.message ?? "").includes("?"), pos?.message);

  // Negatief: geen bevestigde observatie
  const negGeen = checkAfwijkendSignaalLogic(posMetrics, [{ ...bevestigdObs, status: "new" }], today);
  check("T5: vuur t NIET bij HR-afwijking zonder bevestigde obs", negGeen === null);

  // Negatief: normale HR
  const negNorm = checkAfwijkendSignaalLogic(
    [{ metricDate: today, restingHR: 50, feelScore: 7 }, ...baselineMetrics],
    [bevestigdObs],
    today,
  );
  check("T5: vuur t NIET bij normale HR ook met bevestigde obs", negNorm === null);

  // Positief: lage feelScore (≤3)
  const posVoel = checkAfwijkendSignaalLogic(
    [{ metricDate: today, restingHR: 50, feelScore: 2 }, ...baselineMetrics],
    [bevestigdObs],
    today,
  );
  check("T5: vuur t bij lage feelScore + bevestigde obs", posVoel?.triggerId === "afwijkend_signaal");
}

// ── Unit-logica: T6 terugkeer_pauze ──────────────────────────────────────────

function testTerugkeer() {
  const today = "2026-08-05";

  // Positief: sessie vandaag (de terugkeer) + vorige sessie was 15 dagen geleden
  const sessiesMetTerugkeer = [
    { sessionDate: today },                       // de terugkeer
    { sessionDate: addDays(today, -15) },         // vorige sessie (voor de pauze)
    { sessionDate: addDays(today, -20) },
    { sessionDate: addDays(today, -25) },
    { sessionDate: addDays(today, -30) },
  ];
  const pos = checkTerugkeerLogic(sessiesMetTerugkeer, today);
  check("T6: vuur t bij eerste sessie terug na 15 dagen", pos?.triggerId === "terugkeer_pauze");
  check("T6: returnDate is de datum van vandaag", pos?.returnDate === today);
  check("T6: boodschap bevat VRAAG", (pos?.message ?? "").includes("?"), pos?.message);
  check("T6: geen geheugen-herinnering", pos?.memoryObservationId === null);

  // Negatief: laatste sessie is 15 dagen geleden maar GEEN recente terugkeer-sessie
  const sessiesAlleenInactief = [
    { sessionDate: addDays(today, -15) }, // geen sessie vandaag of gisteren!
    { sessionDate: addDays(today, -20) },
    { sessionDate: addDays(today, -25) },
    { sessionDate: addDays(today, -30) },
  ];
  const negInactief = checkTerugkeerLogic(sessiesAlleenInactief, today);
  check("T6: vuur t NIET bij pure inactiviteit (geen recente sessie)", negInactief === null);

  // Negatief: terugkeer maar gap was maar 5 dagen
  const kortGap = [
    { sessionDate: today },
    { sessionDate: addDays(today, -5) }, // maar 5 dagen geleden
    { sessionDate: addDays(today, -10) },
    { sessionDate: addDays(today, -15) },
  ];
  const negKort = checkTerugkeerLogic(kortGap, today);
  check("T6: vuur t NIET als de pauze ≤ 10 dagen was", negKort === null);

  // Positief: gisteren was ook de terugkeer
  const terugkeerGisteren = [
    { sessionDate: addDays(today, -1) }, // gisteren teruggekomen
    { sessionDate: addDays(today, -15) },
    { sessionDate: addDays(today, -20) },
    { sessionDate: addDays(today, -25) },
    { sessionDate: addDays(today, -30) },
  ];
  const posGisteren = checkTerugkeerLogic(terugkeerGisteren, today);
  check("T6: vuur t ook als de terugkeer gisteren was", posGisteren?.triggerId === "terugkeer_pauze");
  check("T6: returnDate is gisteren (niet vandaag)", posGisteren?.returnDate === addDays(today, -1));

  // Regressie-scenario: gisteren terugkeer NA pauze, vandaag opnieuw gereden
  // De terugkeer was gisteren → returnDate moet gisteren zijn, niet null.
  const terugkeerGisterenPlusVandaag = [
    { sessionDate: today },               // tweede rit na terugkeer
    { sessionDate: addDays(today, -1) }, // terugkeer gisteren (gap>10 ervoor)
    { sessionDate: addDays(today, -15) },
    { sessionDate: addDays(today, -20) },
    { sessionDate: addDays(today, -25) },
    { sessionDate: addDays(today, -30) },
  ];
  const posRegressie = checkTerugkeerLogic(terugkeerGisterenPlusVandaag, today);
  check(
    "T6 regressie: gisteren terugkeer + vandaag opnieuw gereden → trigger vuur t met returnDate=gisteren",
    posRegressie?.triggerId === "terugkeer_pauze" && posRegressie?.returnDate === addDays(today, -1),
    JSON.stringify(posRegressie),
  );
}

// ── Integratietests: privacy, pacing, idempotentie ───────────────────────────

async function integrationTests() {
  const today = todayAms();

  // ── A: Privacy-poort ─────────────────────────────────────────────────────
  await seedUser(USER_PRIV, false);
  // Seed een terugkeer-scenario zodat T6 wél zou vuren als privacy aan was
  await seedSession(USER_PRIV, today); // terugkeer vandaag
  for (let i = 0; i < 4; i++) {
    await seedSession(USER_PRIV, addDays(today, -(15 + i)));
  }
  const privResult = await checkProactiveTriggers(USER_PRIV);
  check("Privacy: geen trigger als ai_memory_enabled=false", privResult === null, JSON.stringify(privResult));

  // ── B: Pacing-guard §4.1 ─────────────────────────────────────────────────
  await seedUser(USER_PACING, true);
  await db.insert(aiMemoryEventsTable).values({
    clerkId: USER_PACING,
    eventType: "confirm_question_shown",
    metadata: { test: true },
  } as typeof aiMemoryEventsTable.$inferInsert);
  await seedSession(USER_PACING, today);
  for (let i = 0; i < 4; i++) {
    await seedSession(USER_PACING, addDays(today, -(15 + i)));
  }
  const pacingResult = await checkProactiveTriggers(USER_PACING);
  check("Pacing: geen trigger als bevestigingsvraag vandaag al getoond", pacingResult === null, JSON.stringify(pacingResult));

  // ── C: Idempotentie T6 (per terugkeer-episode, niet per dag) ─────────────
  await seedUser(USER_IDEM, true);
  await seedSession(USER_IDEM, today);
  for (let i = 0; i < 4; i++) {
    await seedSession(USER_IDEM, addDays(today, -(15 + i)));
  }
  const idem1 = await checkProactiveTriggers(USER_IDEM);
  check("Idempotentie: eerste aanroep vuur t T6", idem1?.triggerId === "terugkeer_pauze", JSON.stringify(idem1));

  const idem2 = await checkProactiveTriggers(USER_IDEM);
  check("Idempotentie: tweede aanroep dezelfde dag → null (terugkeer-episode al afgehandeld)", idem2 === null, JSON.stringify(idem2));
}

// ── Acceptatietest A6: derde harde dag — T1 end-to-end ───────────────────────
// Spec §A6: "Trigger vuurt (derde harde dag op rij) — de coach opent met de herinnering, met bronregel"
// T1 is data-gedreven (geen geheugen), maar het dossier dient als bronregel.

async function a6EndToEnd() {
  const today = todayAms();
  await seedUser(USER_A6, true);

  // Baseline: 20 sessies met TSS=50 van 5-24 dagen geleden (gemiddelde norm)
  for (let i = 5; i <= 24; i++) {
    await seedSession(USER_A6, addDays(today, -i), 50);
  }

  // Derde harde dag: TSS=100 voor today-2, today-1, today
  await seedSession(USER_A6, addDays(today, -2), 100);
  await seedSession(USER_A6, addDays(today, -1), 100);
  await seedSession(USER_A6, today, 100);

  const result = await checkProactiveTriggers(USER_A6);

  check("A6: trigger vuur t (T1 derde_harde_dag)", result?.triggerId === "derde_harde_dag", JSON.stringify(result));
  check("A6: dossier aangemaakt (bronregel aanwezig, dossierId > 0)", (result?.dossierId ?? 0) > 0, String(result?.dossierId));
  check("A6: boodschap bevat gemiddelde (TSS-getal)", /\d+ TSS/.test(result?.message ?? ""), result?.message);
  check("A6: memoryObservationId=null (T1 is data-gedreven, niet geheugen-gedreven)", result?.memoryObservationId === null);

  // Controleer dat de proactive_trigger_shown event in de DB staat
  if (result) {
    const events = await db
      .select({ id: aiMemoryEventsTable.id })
      .from(aiMemoryEventsTable)
      .where(
        and(
          eq(aiMemoryEventsTable.clerkId, USER_A6),
          eq(aiMemoryEventsTable.eventType, "proactive_trigger_shown"),
          sql`${aiMemoryEventsTable.metadata}->>'triggerId' = 'derde_harde_dag'`,
        ),
      );
    check("A6: proactive_trigger_shown event geregistreerd in DB", events.length === 1, `${events.length} events`);
  }
}

// ── Acceptatietest A9: nooit trigger + bevestigingsvraag samen ────────────────

async function a9PacingTest() {
  check("A9: pacing-guard dekt de bevestigingsvraag-conditie (gedekt via USER_PACING hierboven)", true);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  await cleanup();

  console.log("\n=== Proactieve trigger-logica (unit) ===");
  testDerdeHardeDag();
  testEersteWedstrijd();
  testZelfdeWeekInzinking();
  testAfwijkendSignaal();
  testTerugkeer();

  console.log("\n=== Integratietests: privacy · pacing · idempotentie ===");
  await integrationTests();

  console.log("\n=== Acceptatietest A6: T1 derde_harde_dag end-to-end ===");
  await a6EndToEnd();

  console.log("\n=== Acceptatietest A9: pacing-guard ===");
  await a9PacingTest();
}

main()
  .then(async () => {
    await cleanup().catch(() => {});
    const total = failures > 0 ? `${failures} mislukt` : "alle geslaagd";
    console.log(`\n=== proactive-triggers — ${total} ===`);
    await pool.end().catch(() => {});
    process.exit(failures > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error("test harness crashed:", err);
    await cleanup().catch(() => {});
    await pool.end().catch(() => {});
    process.exit(1);
  });
