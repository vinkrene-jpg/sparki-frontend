// Sporterskernreis — end-to-end route/contract test (Afbouwgolf 1).
//
// Pint de sluitende kernreis vast:
//   onboarding → beginsituatie → doelen-vraag → handmatige activiteit via de
//   Data Hub (dag-niveau dedupe) → import die een handmatige sessie samenvoegt
//   → eerlijke sensor-gaten → coachautoriteit (coachtraining wordt nooit
//   zelfstandig herschreven).
//
// Boot de ECHTE Express-app en drijft de echte routes als dev-gebruiker.
// De Sparki-modelaanroep (Anthropic) is gestubd zodat de test deterministisch
// is; de coachautoriteitscheck bewijst juist dat het model NIET wordt
// aangeroepen voor een coachtraining.
//
// Run: `pnpm --filter @workspace/api-server run test:kernreis`
// Vereist: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  athleteProfilesTable,
  onboardingStateTable,
  plannedWorkoutsTable,
  trainingSessionsTable,
  userProfilesTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";
import { ingestBatch } from "../engines/data-hub/ingest";
import type { ConnectorDataType } from "@workspace/db";

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

// ── Model-stub: elke onverwachte aanroep faalt hard ──────────────────────────
let modelCalls = 0;
(anthropic.messages as unknown as { create: (args: unknown) => unknown }).create =
  async () => {
    modelCalls += 1;
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            recommendation: "adjust",
            title: "Iets lichter",
            message: "We verlagen de belasting.",
            changes: { targetTSS: 50 },
          }),
        },
      ],
    };
  };

// ── Server boot ──────────────────────────────────────────────────────────────
let baseUrl = "";
let server: Server | null = null;

async function startServer(): Promise<void> {
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
}

async function stopServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
}

// ── Fixtures ─────────────────────────────────────────────────────────────────
const RUN = `test_kernreis_${Date.now()}`;
const clerkId = `${RUN}_athlete`;

function localDate(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function api(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": clerkId,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function sessionsFor(date: string) {
  return db
    .select()
    .from(trainingSessionsTable)
    .where(
      and(
        eq(trainingSessionsTable.clerkId, clerkId),
        eq(trainingSessionsTable.sessionDate, date),
      ),
    );
}

async function cleanup() {
  await db
    .delete(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, clerkId))
    .catch(() => {});
}

async function main() {
  await startServer();
  await ensureAccount(clerkId, `${clerkId}@example.test`, "Kernreis Tester", silentLogger);

  // 1. Onboarding voltooien → bruikbare beginsituatie.
  await scenario("onboarding: complete-v2 levert bruikbare beginsituatie", async () => {
    const r = await api("POST", "/api/onboarding/complete-v2", { selfType: "diesel" });
    assert(r.status === 201, `complete-v2 gaf ${r.status}`);
    assert(r.body?.ok === true, "complete-v2 niet ok");
    const [profile] = await db
      .select()
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId));
    assert(profile, "geen athlete_profile na onboarding");
    assert(profile!.ftp != null, "geen (geschatte) FTP na onboarding");
    assert(profile!.weeklyHourTarget != null, "geen uurdoel na onboarding");
    assert(profile!.sport != null, "geen sport na onboarding");
    assert(
      (profile!.availableDays?.length ?? 0) > 0,
      "geen beschikbaarheid na onboarding",
    );
    const [state] = await db
      .select()
      .from(onboardingStateTable)
      .where(eq(onboardingStateTable.clerkId, clerkId));
    assert(state?.isComplete === true, "onboarding niet als voltooid gemarkeerd");
  });

  // 2. Doelen: de ontwikkeldoel-vraag staat vooraan in de adaptieve catalogus
  //    en het antwoord landt op het profiel.
  await scenario("doelen: ontwikkeldoel wordt gevraagd en opgeslagen", async () => {
    const q = await api("GET", "/api/onboarding/next-questions?limit=5");
    assert(q.status === 200, `next-questions gaf ${q.status}`);
    const keys = (q.body?.questions ?? []).map((x: { key: string }) => x.key);
    assert(keys.includes("developmentGoal"), `developmentGoal niet gevraagd (wel: ${keys.join(",")})`);
    const a = await api("POST", "/api/onboarding/answer", {
      key: "developmentGoal",
      value: "granfondo",
    });
    assert(a.status === 200, `answer gaf ${a.status}`);
    const [profile] = await db
      .select({ developmentGoal: athleteProfilesTable.developmentGoal })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId));
    assert(profile?.developmentGoal === "granfondo", "ontwikkeldoel niet opgeslagen");
  });

  // 3. Handmatige activiteit → Data Hub-regels: afgeleide belastingscore.
  const dagA = localDate(-3);
  await scenario("handmatig: belastingscore wordt afgeleid uit vermogen + FTP", async () => {
    const r = await api("POST", "/api/athlete/sessions", {
      sessionDate: dagA,
      type: "ride",
      title: "Duurrit",
      durationMin: 90,
      distanceKm: "45",
      avgPower: 180,
    });
    assert(r.status === 201, `sessions POST gaf ${r.status}`);
    assert(r.body?.merged === false, "eerste sessie zou nieuw moeten zijn");
    assert(r.body?.tss != null, "belastingscore niet afgeleid ondanks vermogen + FTP");
  });

  // 4. Dubbele handmatige invoer → samengevoegd, nooit een tweede rij.
  await scenario("dedupe: dubbele handmatige invoer wordt samengevoegd", async () => {
    const r = await api("POST", "/api/athlete/sessions", {
      sessionDate: dagA,
      type: "ride",
      durationMin: 92,
      distanceKm: "44",
      avgHR: 145,
    });
    assert(r.status === 200, `duplicaat gaf ${r.status} (verwacht 200 merge)`);
    assert(r.body?.merged === true, "duplicaat niet als merge gemarkeerd");
    const rows = await sessionsFor(dagA);
    assert(rows.length === 1, `verwacht 1 sessie, gevonden ${rows.length}`);
    // Merge vult gaten: hartslag uit de tweede invoer op de bestaande rij.
    assert(rows[0]!.avgHR === 145, "merge vulde ontbrekende hartslag niet aan");
  });

  // 5. Eerst handmatig, daarna import → import voegt samen (geen dubbel).
  const dagB = localDate(-2);
  await scenario("dedupe: import voegt eerdere handmatige sessie samen", async () => {
    const r = await api("POST", "/api/athlete/sessions", {
      sessionDate: dagB,
      type: "ride",
      durationMin: 60,
      distanceKm: "30",
    });
    assert(r.status === 201, `sessions POST gaf ${r.status}`);
    const allowed = new Set<ConnectorDataType>(["activities", "training_history"]);
    const counts = await ingestBatch(
      clerkId,
      "file",
      {
        importedDataTypes: ["activities", "training_history"],
        activities: [
          {
            externalId: `${RUN}_gpx_1`,
            sport: "cycling",
            startedAt: `${dagB}T10:00:00.000Z`,
            durationMin: 62,
            distanceKm: 31,
            avgPower: 190,
            title: "Geïmporteerde rit",
          },
        ],
      },
      { allowed },
    );
    assert((counts.merged ?? 0) === 1, `import zou moeten mergen (counts=${JSON.stringify(counts)})`);
    const rows = await sessionsFor(dagB);
    assert(rows.length === 1, `verwacht 1 sessie na import, gevonden ${rows.length}`);
    assert(rows[0]!.dedupeKey != null, "samengevoegde rij kreeg geen dedupeKey");
    assert(rows[0]!.avgPower === 190, "merge vulde vermogen niet aan");
    assert((rows[0]!.sources ?? []).includes("manual"), "bron manual verdween");
    assert((rows[0]!.sources ?? []).includes("file"), "bron file niet geregistreerd");
  });

  // 6. Eerlijke sensor-gaten: geen vermogen ⇒ geen verzonnen belastingscore.
  const dagC = localDate(-1);
  await scenario("eerlijkheid: ontbrekende sensordata blijft leeg", async () => {
    const r = await api("POST", "/api/athlete/sessions", {
      sessionDate: dagC,
      type: "ride",
      durationMin: 45,
    });
    assert(r.status === 201, `sessions POST gaf ${r.status}`);
    assert(r.body?.tss == null, "belastingscore verzonnen zonder vermogen");
    assert(r.body?.avgHR == null, "hartslag verzonnen");
  });

  // 6b. Over-merge-bescherming: twee sessies op dezelfde dag zonder sterke
  //     vergelijker (duur/afstand) blijven twee aparte rijen.
  await scenario("dedupe: zonder vergelijkbare cijfers nooit samenvoegen", async () => {
    const rows0 = await sessionsFor(dagC);
    assert(rows0.length === 1, "uitgangssituatie klopt niet");
    // Tweede invoer zonder duur én zonder afstand → mag NIET op de bestaande
    // (duur-only) sessie mergen.
    const r = await api("POST", "/api/athlete/sessions", {
      sessionDate: dagC,
      type: "ride",
      title: "Tweede losse rit",
    });
    assert(r.status === 201, `verwacht 201 (nieuwe rij), kreeg ${r.status}`);
    assert(r.body?.merged === false, "sessie zonder cijfers werd toch samengevoegd");
    const rows = await sessionsFor(dagC);
    assert(rows.length === 2, `verwacht 2 rijen, gevonden ${rows.length}`);
  });

  // 6c. Ongeldige numerieke invoer wordt hard geweigerd (nooit NaN de dedupe in).
  await scenario("validatie: ongeldige cijfers geven 400", async () => {
    const r1 = await api("POST", "/api/athlete/sessions", {
      sessionDate: dagC,
      type: "ride",
      distanceKm: "abc",
    });
    assert(r1.status === 400, `ongeldige afstand gaf ${r1.status}`);
    const r2 = await api("POST", "/api/athlete/sessions", {
      sessionDate: dagC,
      type: "ride",
      durationMin: "zestig",
    });
    assert(r2.status === 400, `ongeldige duur gaf ${r2.status}`);
    const rows = await sessionsFor(dagC);
    assert(rows.length === 2, "ongeldige invoer veranderde de data toch");
  });

  // 6d. Import mag een losstaande handmatige sessie zonder cijfers niet wegvegen.
  await scenario("dedupe: import veegt cijferloze handmatige sessie niet weg", async () => {
    const counts = await ingestBatch(
      clerkId,
      "file",
      {
        importedDataTypes: ["activities", "training_history"],
        activities: [
          {
            externalId: `${RUN}_gpx_2`,
            sport: "cycling",
            startedAt: `${dagC}T09:00:00.000Z`,
            durationMin: 45,
            distanceKm: 25,
            title: "Losse import",
          },
        ],
      },
      { allowed: new Set<ConnectorDataType>(["activities", "training_history"]) },
    );
    // De bestaande duur-only sessie (45 min) is plausibel dezelfde rit → merge
    // is hier juist; de cijferloze tweede rij moet onaangeroerd blijven.
    const rows = await sessionsFor(dagC);
    const bare = rows.find((r) => r.durationMin == null && r.distanceKm == null);
    assert(bare, "cijferloze handmatige sessie is verdwenen (weggeveegd door import)");
    assert(
      (counts.merged ?? 0) + (counts.activities ?? 0) === 1,
      `import verwerkte niet precies 1 activiteit (${JSON.stringify(counts)})`,
    );
  });

  // 7. Coachautoriteit: coachtraining wordt nooit zelfstandig herschreven.
  await scenario("coach: inhoud van coachtraining is beschermd", async () => {
    const [w] = await db
      .insert(plannedWorkoutsTable)
      .values({
        clerkId,
        scheduledDate: localDate(1),
        type: "ride",
        title: "Coachtraining",
        targetDurationMin: 120,
        targetTSS: 90,
        status: "planned",
        source: "coach",
      })
      .returning({ id: plannedWorkoutsTable.id });
    const id = w!.id;

    // Inhoudelijke wijziging → geweigerd.
    const put = await api("PUT", `/api/athlete/workouts/${id}`, { targetTSS: 40 });
    assert(put.status === 403, `coach-workout PUT gaf ${put.status} (verwacht 403)`);
    assert(put.body?.coachOwned === true, "403 mist coachOwned-vlag");

    // Status registreren (gedaan) → toegestaan.
    const done = await api("PUT", `/api/athlete/workouts/${id}`, { status: "completed" });
    assert(done.status === 200, `status-update gaf ${done.status}`);

    // Aanpassingsvoorstel → deterministisch coach-antwoord, GEEN modelaanroep.
    const before = modelCalls;
    const adj = await api("POST", "/api/ai/workout-adjust", {
      workoutId: id,
      feedbackType: "too_hard",
    });
    assert(adj.status === 200, `workout-adjust gaf ${adj.status}`);
    assert(adj.body?.coachOwned === true, "adjust mist coachOwned");
    assert(adj.body?.proposal?.recommendation === "keep", "coach-voorstel is geen keep");
    assert(adj.body?.proposal?.changes === null, "coach-voorstel bevat wijzigingen");
    assert(modelCalls === before, "model werd aangeroepen voor een coachtraining");

    // DB-bewijs: de coachwaarden staan er nog ongewijzigd.
    const [row] = await db
      .select()
      .from(plannedWorkoutsTable)
      .where(eq(plannedWorkoutsTable.id, id));
    assert(row?.targetTSS === 90, "coach targetTSS werd toch gewijzigd");
    assert(row?.source === "coach", "bron veranderde");
  });

  // 8. Sparki-training blijft wél aanpasbaar (geen overbeveiliging).
  await scenario("sparki-training: voorstel toepassen blijft mogelijk", async () => {
    const [w] = await db
      .insert(plannedWorkoutsTable)
      .values({
        clerkId,
        scheduledDate: localDate(2),
        type: "ride",
        title: "Sparki-training",
        targetDurationMin: 60,
        targetTSS: 55,
        status: "planned",
        source: "sparki",
      })
      .returning({ id: plannedWorkoutsTable.id });
    const put = await api("PUT", `/api/athlete/workouts/${w!.id}`, { targetTSS: 40 });
    assert(put.status === 200, `sparki-workout PUT gaf ${put.status}`);
    assert(put.body?.targetTSS === 40, "aanpassing niet toegepast");
  });

  await cleanup();
  await stopServer();

  // ── Rapport ────────────────────────────────────────────────────────────────
  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✅" : "❌";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed += 1;
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("kernreis test crashed:", err);
  await cleanup().catch(() => {});
  await stopServer().catch(() => {});
  process.exit(1);
});
