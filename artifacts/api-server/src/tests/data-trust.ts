// Data-trust audit — applicatiebrede controle op mockdata.
//
// Bewijst de drie harde eisen uit de audit-opdracht:
//   1. Een gloednieuw (leeg) account krijgt OVERAL een eerlijk lege lijst —
//      nooit voorbeeld-, demo- of fallbackdata.
//   2. Twee gebruikers zien nooit elkaars gegevens (isolatie).
//   3. De admin-gegevensbroncontrole is afgeschermd (403 voor niet-admins)
//      en toont voor een admin per blok echte brontabel + record-telling.
//
// Run: `node ./scripts/run-test.mjs data-trust` (vanuit artifacts/api-server)
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  plannedWorkoutsTable,
  trainingSessionsTable,
  userProfilesTable,
  athleteProfilesTable,
  ftpHistoryTable,
  garageBikesTable,
  aiObservationsTable,
} from "@workspace/db";
import { inArray, eq, and } from "drizzle-orm";

const RUN = `test_trust_${Date.now()}`;
const A = `${RUN}_a`;
const B = `${RUN}_b`;
const ALL = [A, B];

// Admin-gate: A wordt admin gemaakt vóór de app importeert routes die
// isAdmin() per request evalueren (leest env bij elke call, dus dit werkt).
process.env["SPARKI_ADMIN_IDS"] = `${process.env["SPARKI_ADMIN_IDS"] ?? ""},${A}`;

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

let baseUrl = "";
let server: Server | null = null;

async function req(
  method: string,
  path: string,
  actor: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-dev-clerk-id": actor },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* leeg */
  }
  return { status: res.status, json };
}

function emptyOf(json: any): unknown[] | null {
  // Accepteer zowel kale arrays als { items: [] }-achtige antwoorden.
  if (Array.isArray(json)) return json;
  if (json && typeof json === "object") {
    for (const key of [
      "workouts",
      "sessions",
      "goals",
      "routes",
      "races",
      "logs",
      "notifications",
      "observations",
      "groups",
      "items",
    ]) {
      if (Array.isArray(json[key])) return json[key];
    }
  }
  return null;
}

async function cleanup() {
  await db
    .delete(plannedWorkoutsTable)
    .where(inArray(plannedWorkoutsTable.clerkId, ALL));
  await db
    .delete(trainingSessionsTable)
    .where(inArray(trainingSessionsTable.clerkId, ALL));
  await db
    .delete(athleteProfilesTable)
    .where(inArray(athleteProfilesTable.clerkId, ALL));
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, ALL));
}

async function main() {
  const { default: app } = await import("../app");
  const { ensureAccount, silentLogger } = await import("../lib/account");

  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => {
      if (err) return reject(err);
      const addr = server!.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      } else reject(new Error("failed to determine server port"));
    });
  });

  await ensureAccount(A, `${A}@test.local`, "Trust A", silentLogger);
  await ensureAccount(B, `${B}@test.local`, "Trust B", silentLogger);

  // 1. Leeg account ⇒ overal eerlijk leeg (geen fallback/voorbeelddata).
  const SURFACES: { name: string; path: string }[] = [
    { name: "kalender (workouts)", path: "/api/athlete/workouts" },
    { name: "sessies", path: "/api/sessions" },
    { name: "doelen", path: "/api/goals" },
    { name: "routes", path: "/api/routes" },
    { name: "wedstrijden", path: "/api/races" },
    { name: "voedingslogs", path: "/api/nutrition/logs" },
    { name: "meldingen", path: "/api/notifications" },
    { name: "observaties", path: "/api/ai/observations" },
  ];
  for (const s of SURFACES) {
    await scenario(`leeg account: ${s.name} is eerlijk leeg`, async () => {
      const r = await req("GET", s.path, B);
      assert(
        r.status === 200 || r.status === 404,
        `${s.path} status ${r.status}`,
      );
      if (r.status === 200) {
        const arr = emptyOf(r.json);
        assert(arr !== null, `${s.path}: geen lijst herkend in antwoord`);
        assert(arr!.length === 0, `${s.path}: ${arr!.length} onverwachte records`);
      }
    });
  }

  // 2. Isolatie: A maakt een training, B ziet 'm nooit.
  let workoutId: number | null = null;
  await scenario("isolatie: training van A onzichtbaar voor B", async () => {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const created = await req("POST", "/api/athlete/workouts", A, {
      scheduledDate: date,
      title: "Trust-audit duurtraining",
      type: "endurance",
    });
    assert(created.status === 200 || created.status === 201, `create ${created.status}`);
    workoutId = created.json?.workout?.id ?? created.json?.id ?? null;
    assert(workoutId != null, "geen workout-id terug");
    const seenByB = await req("GET", "/api/athlete/workouts", B);
    const arr = emptyOf(seenByB.json) ?? [];
    assert(
      !arr.some((w: any) => w?.id === workoutId),
      "B ziet de training van A",
    );
  });

  // 3a. Gegevensbroncontrole: niet-admin krijgt 403 (fail-closed).
  // De dev-bypass maakt isAdmin() onvoorwaardelijk true; isAdmin leest de env
  // per aanroep, dus we schakelen de bypass tijdelijk uit zodat de ECHTE
  // SPARKI_ADMIN_IDS-lijst (A wél, B niet) getest wordt. De auth-resolutie
  // zelf blijft werken omdat IS_DEV bij moduleload is vastgelegd.
  const savedBypass = process.env["DEV_AUTH_BYPASS"];
  process.env["DEV_AUTH_BYPASS"] = "false";
  await scenario("gegevensbroncontrole: 403 voor niet-admin", async () => {
    const r = await req("GET", `/api/admin/data-provenance?clerkId=${A}`, B);
    assert(r.status === 403, `verwacht 403, kreeg ${r.status}`);
  });

  // 3b. Admin ziet echte herkomst: brontabel + telling klopt met werkelijkheid.
  await scenario("gegevensbroncontrole: echte bron + telling", async () => {
    const r = await req("GET", `/api/admin/data-provenance?clerkId=${A}`, A);
    assert(r.status === 200, `status ${r.status}`);
    const surfaces: any[] = r.json?.surfaces ?? [];
    const expectedKeys = [
      "profiel",
      "kalender",
      "sessies",
      "doelen",
      "routes",
      "wedstrijden",
      "voeding",
      "meldingen",
      "observaties",
      "chat",
    ];
    const keys = surfaces.map((s) => s.key).sort();
    assert(
      JSON.stringify(keys) === JSON.stringify([...expectedKeys].sort()),
      `blokken wijken af: ${keys.join(",")}`,
    );
    const kal = surfaces.find((s) => s.key === "kalender");
    assert(kal, "kalender-blok ontbreekt");
    assert(String(kal.bron).startsWith("planned_workouts"), `bron ${kal.bron}`);
    assert(kal.aantalRecords === 1, `verwacht 1 record, kreeg ${kal.aantalRecords}`);
    assert(kal.laatsteRecordId === workoutId, "record-id wijst niet naar de echte rij");
    // Leeg blok blijft eerlijk 0 — geen verzonnen data.
    const sess = surfaces.find((s) => s.key === "sessies");
    assert(sess && sess.aantalRecords === 0, "sessies-blok niet eerlijk leeg");
  });

  // 3c. Onbekende gebruiker ⇒ eerlijke 404, nooit vervangende data.
  await scenario("gegevensbroncontrole: onbekende gebruiker 404", async () => {
    const r = await req("GET", "/api/admin/data-provenance?clerkId=bestaat_niet_xyz", A);
    assert(r.status === 404, `verwacht 404, kreeg ${r.status}`);
  });
  process.env["DEV_AUTH_BYPASS"] = savedBypass;

  // 4. FTP-zelfherstel: een profiel dat onterecht als schatting bleef staan
  //    (oude bug: import zette ftpEstimated niet op false) wordt bij de
  //    recalibratie hersteld naar de nieuwste ECHTE invoer.
  const { recalibrateEstimatedFtp } = await import(
    "../lib/derived-load-backfill"
  );
  await scenario("ftp-zelfherstel: echte invoer wint van oude schatting", async () => {
    await db
      .update(athleteProfilesTable)
      .set({ ftp: 331, ftpEstimated: true })
      .where(eq(athleteProfilesTable.clerkId, A));
    await db.insert(ftpHistoryTable).values([
      { clerkId: A, measuredAt: "2026-06-01", ftpWatts: 331, testType: "derived" },
      { clerkId: A, measuredAt: "2026-06-26", ftpWatts: 258, testType: "strava" },
    ]);
    const r = await recalibrateEstimatedFtp(A);
    assert(r.changed === true, "zelfherstel voerde geen wijziging door");
    assert(r.ftp === 258, `verwacht 258, kreeg ${r.ftp}`);
    const [p] = await db
      .select({ ftp: athleteProfilesTable.ftp, est: athleteProfilesTable.ftpEstimated })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, A));
    assert(p?.ftp === 258 && p?.est === false, `profiel niet hersteld: ${p?.ftp}/${p?.est}`);
    // De achterhaalde afgeleide rij blijft bestaan maar is gemarkeerd …
    const [derivedRow] = await db
      .select({ notes: ftpHistoryTable.notes })
      .from(ftpHistoryTable)
      .where(
        and(
          eq(ftpHistoryTable.clerkId, A),
          eq(ftpHistoryTable.testType, "derived"),
          eq(ftpHistoryTable.measuredAt, "2026-06-01"),
        ),
      );
    assert(derivedRow, "afgeleide rij is ten onrechte verwijderd");
    assert(
      (derivedRow!.notes ?? "").startsWith("[achterhaald]"),
      `afgeleide rij niet gemarkeerd: ${derivedRow!.notes}`,
    );
    // … en verschijnt niet meer in de toonbare FTP-historie.
    const hist = await req("GET", "/api/athlete/ftp", A);
    assert(hist.status === 200, `ftp-historie status ${hist.status}`);
    const shownDerived = (hist.json ?? []).filter(
      (r: any) => r.testType === "derived" && r.measuredAt === "2026-06-01",
    );
    assert(shownDerived.length === 0, "achterhaalde rij wordt nog getoond");
    // … en telt óók niet meer mee in afgeleide berekeningen: een rit van
    // 60 min op 258 W NP moet met FTP 258 (IF 1.0) scoren, niet met 331.
    const [tssSess] = await db
      .insert(trainingSessionsTable)
      .values({
        clerkId: A,
        sessionDate: "2026-06-10",
        durationMin: 60,
        normalizedPower: 258,
      })
      .returning({ id: trainingSessionsTable.id });
    const { backfillTssForAthlete } = await import(
      "../lib/derived-load-backfill"
    );
    await backfillTssForAthlete(A);
    const [scored] = await db
      .select({
        tss: trainingSessionsTable.tss,
        intensityFactor: trainingSessionsTable.intensityFactor,
      })
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.id, tssSess!.id));
    assert(scored?.tss === 100, `verwacht TSS 100 (FTP 258), kreeg ${scored?.tss}`);
  });

  // 4b. Een echte (niet-geschatte) FTP wordt daarna NOOIT stil verhoogd.
  await scenario("ftp: echte waarde wordt niet automatisch aangepast", async () => {
    const r = await recalibrateEstimatedFtp(A);
    assert(r.changed === false, "echte FTP werd onterecht gewijzigd");
    assert(r.ftp === 258, `FTP veranderde naar ${r.ftp}`);
  });

  // 5. Fiets-autokoppeling: ritten van vóór de registratiedatum van de fiets
  //    worden NIET gekoppeld en een eerdere foute auto-koppeling wordt
  //    losgemaakt (zelfherstel) — handmatige keuzes blijven staan.
  await scenario("fiets-autokoppeling: geen historische ritten meer", async () => {
    const { autoLinkSessions } = await import("../lib/bike-usage");
    const [bike] = await db
      .insert(garageBikesTable)
      .values({ clerkId: A, name: "Trust-testfiets" })
      .returning({ id: garageBikesTable.id });
    assert(bike, "geen fiets aangemaakt");
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const [oldSess] = await db
      .insert(trainingSessionsTable)
      .values({
        clerkId: A,
        sessionDate: "2022-05-01",
        durationMin: 90,
        bikeId: bike!.id,
        bikeLinkSource: "auto",
      })
      .returning({ id: trainingSessionsTable.id });
    const [newSess] = await db
      .insert(trainingSessionsTable)
      .values({ clerkId: A, sessionDate: todayStr, durationMin: 60 })
      .returning({ id: trainingSessionsTable.id });
    await autoLinkSessions(A);
    const [oldRow] = await db
      .select({ bikeId: trainingSessionsTable.bikeId })
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.id, oldSess!.id));
    assert(oldRow?.bikeId == null, "historische rit bleef gekoppeld");
    const [newRow] = await db
      .select({ bikeId: trainingSessionsTable.bikeId })
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.id, newSess!.id));
    assert(newRow?.bikeId === bike!.id, "rit ná registratie niet gekoppeld");
  });

  // 6. Admin-opschoning: droogdraai toont exact de vervuiling (Engelstalige
  //    observaties + dubbele ftp-rijen), apply verwijdert alléén die rijen.
  await scenario("opschoning: droogdraai + gerichte verwijdering", async () => {
    const [engObs] = await db
      .insert(aiObservationsTable)
      .values({
        clerkId: A,
        sourceType: "test",
        title: "Your training consistency is improving",
        observationText: "You completed more sessions this month.",
      })
      .returning({ id: aiObservationsTable.id });
    const [nlObs] = await db
      .insert(aiObservationsTable)
      .values({
        clerkId: A,
        sourceType: "test",
        title: "Je trainingsritme wordt stabieler",
        observationText: "Je hebt deze maand meer getraind dan vorige maand.",
      })
      .returning({ id: aiObservationsTable.id });
    await db.insert(ftpHistoryTable).values([
      { clerkId: A, measuredAt: "2026-07-01", ftpWatts: 260, testType: "strava" },
      { clerkId: A, measuredAt: "2026-07-01", ftpWatts: 260, testType: "strava" },
    ]);

    const dry = await req("POST", "/api/admin/data-trust/cleanup", A, {
      clerkId: A,
    });
    assert(dry.status === 200, `droogdraai status ${dry.status}`);
    assert(dry.json?.modus === "droogdraai", "geen droogdraai-modus");
    const engIds = (dry.json?.kandidaten?.engelstaligeObservaties ?? []).map(
      (o: any) => o.id,
    );
    assert(engIds.includes(engObs!.id), "Engelse observatie niet herkend");
    assert(!engIds.includes(nlObs!.id), "Nederlandse observatie onterecht kandidaat");
    assert(
      (dry.json?.kandidaten?.dubbeleFtpHistorie ?? []).length === 1,
      "dubbele ftp-rij niet herkend",
    );
    // Profiel is hier al echt (scenario 4) ⇒ geen actualisatie nodig.
    assert(
      dry.json?.kandidaten?.ftpActualisatie?.nodig === false,
      "ftpActualisatie onterecht nodig bij echte FTP",
    );

    const applied = await req("POST", "/api/admin/data-trust/cleanup", A, {
      clerkId: A,
      apply: true,
    });
    assert(applied.status === 200, `apply status ${applied.status}`);
    assert(applied.json?.verwijderd?.observaties >= 1, "observatie niet verwijderd");
    assert(applied.json?.verwijderd?.ftpHistorie === 1, "ftp-duplicaat niet verwijderd");
    const [nlStill] = await db
      .select({ id: aiObservationsTable.id })
      .from(aiObservationsTable)
      .where(eq(aiObservationsTable.id, nlObs!.id));
    assert(nlStill, "Nederlandse observatie is onterecht verwijderd");
    const dupLeft = await db
      .select({ id: ftpHistoryTable.id })
      .from(ftpHistoryTable)
      .where(
        and(eq(ftpHistoryTable.clerkId, A), eq(ftpHistoryTable.measuredAt, "2026-07-01")),
      );
    assert(dupLeft.length === 1, `verwacht 1 overgebleven rij, kreeg ${dupLeft.length}`);
  });

  await cleanup();
  if (server) await new Promise<void>((res) => server!.close(() => res()));

  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) {
    console.log(`${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} scenario's geslaagd`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("data-trust test crashte:", err);
  try {
    await cleanup();
  } catch {
    /* leeg */
  }
  process.exit(1);
});
