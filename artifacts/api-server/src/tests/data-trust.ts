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
} from "@workspace/db";
import { inArray } from "drizzle-orm";

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
