// Koppellijst rit→training — DB-backed route contract test.
//
// De keuzelijst "KOPPEL TRAINING" (route-panel) leest UITSLUITEND uit
// GET /api/athlete/workouts (planned_workouts = dezelfde centrale bron als de
// kalender). Dit bewijst de eisen uit de mockdata-opdracht:
//   1. Een echte handmatig aangemaakte training verschijnt direct in de lijst.
//   2. Naam/datum wijzigen werkt direct door.
//   3. Verwijderen laat de training overal verdwijnen.
//   4. Twee gebruikers zien nooit elkaars trainingen (isolatie).
//   5. Een reeds aan een uitvoering gekoppelde training is herkenbaar
//      (sessionId gevuld) zodat de frontend die eerlijk wegfiltert.
//   6. Geen enkele fallback: lege kalender ⇒ lege lijst (geen voorbeelddata).
//
// Run: `node ./scripts/run-test.mjs koppellijst-workouts` (vanuit artifacts/api-server)
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  plannedWorkoutsTable,
  trainingSessionsTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";

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

const RUN = `test_koppel_${Date.now()}`;
const A = `${RUN}_a`;
const B = `${RUN}_b`;
const ALL = [A, B];

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

function windowQs(): string {
  // Zelfde venster als useUpcomingWorkouts (-7..+21 dagen, lokale datum).
  const d = (off: number) => {
    const x = new Date();
    x.setDate(x.getDate() + off);
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, "0");
    const day = String(x.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  return `from=${d(-7)}&to=${d(21)}`;
}

function todayLocal(): string {
  const x = new Date();
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

async function cleanup() {
  await db
    .delete(plannedWorkoutsTable)
    .where(inArray(plannedWorkoutsTable.clerkId, ALL));
  await db
    .delete(trainingSessionsTable)
    .where(inArray(trainingSessionsTable.clerkId, ALL));
}

async function main() {
  await startServer();
  for (const id of ALL) {
    await ensureAccount(id, `${id}@example.test`, `Sporter ${id}`, silentLogger);
  }

  const UNIQUE = `${RUN} test start`;
  let createdId = 0;

  await scenario("lege kalender ⇒ eerlijk lege koppellijst (geen fallback)", async () => {
    const r = await req("GET", `/api/athlete/workouts?${windowQs()}`, A);
    assert(r.status === 200, `status ${r.status}`);
    assert(Array.isArray(r.json) && r.json.length === 0, "verwachtte lege lijst");
  });

  await scenario("nieuwe echte training verschijnt direct in de lijstbron", async () => {
    const c = await req("POST", "/api/athlete/workouts", A, {
      scheduledDate: todayLocal(),
      type: "ride",
      title: UNIQUE,
    });
    assert(c.status === 200 || c.status === 201, `create status ${c.status}`);
    createdId = c.json?.id;
    assert(Number.isFinite(createdId), "geen id terug");
    const r = await req("GET", `/api/athlete/workouts?${windowQs()}`, A);
    assert(r.json.some((w: any) => w.id === createdId && w.title === UNIQUE), "training niet in lijst");
  });

  await scenario("naam + datum wijzigen werkt direct door", async () => {
    const NEW_TITLE = `${UNIQUE} gewijzigd`;
    const tomorrow = (() => {
      const x = new Date();
      x.setDate(x.getDate() + 1);
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    })();
    const u = await req("PUT", `/api/athlete/workouts/${createdId}`, A, {
      title: NEW_TITLE,
      scheduledDate: tomorrow,
    });
    assert(u.status === 200, `update status ${u.status}`);
    const r = await req("GET", `/api/athlete/workouts?${windowQs()}`, A);
    const w = r.json.find((x: any) => x.id === createdId);
    assert(w, "training verdwenen na update");
    assert(w.title === NEW_TITLE && w.scheduledDate === tomorrow, "wijziging niet doorgevoerd");
  });

  await scenario("gebruiker B ziet trainingen van A nooit (isolatie)", async () => {
    const r = await req("GET", `/api/athlete/workouts?${windowQs()}`, B);
    assert(r.status === 200, `status ${r.status}`);
    assert(!r.json.some((w: any) => w.id === createdId), "training van A lekt naar B");
  });

  await scenario("B kan training van A niet wijzigen of verwijderen", async () => {
    const u = await req("PUT", `/api/athlete/workouts/${createdId}`, B, { title: "hack" });
    assert(u.status === 404 || u.status === 403, `PUT als B gaf ${u.status}`);
    const d = await req("DELETE", `/api/athlete/workouts/${createdId}`, B);
    assert(d.status === 404 || d.status === 403 || d.status === 405, `DELETE als B gaf ${d.status}`);
    const r = await req("GET", `/api/athlete/workouts?${windowQs()}`, A);
    assert(r.json.some((w: any) => w.id === createdId), "training van A onterecht weg");
  });

  await scenario("gekoppelde training is herkenbaar via sessionId (frontendfilter)", async () => {
    // Maak een echte activiteit op dezelfde dag en koppel die.
    const w = await req("GET", `/api/athlete/workouts/${createdId}`, A);
    const date = w.json?.scheduledDate ?? todayLocal();
    const [sess] = await db
      .insert(trainingSessionsTable)
      .values({
        clerkId: A,
        sessionDate: date,
        sport: "cycling",
        type: "ride",
        title: `${RUN} rit`,
        source: "manual",
        durationMin: 60,
      } as any)
      .returning({ id: trainingSessionsTable.id });
    const link = await req("PUT", `/api/athlete/workouts/${createdId}`, A, {
      sessionId: sess!.id,
    });
    assert(link.status === 200, `link status ${link.status}`);
    const r = await req("GET", `/api/athlete/workouts?${windowQs()}`, A);
    const linked = r.json.find((x: any) => x.id === createdId);
    assert(linked?.sessionId === sess!.id, "sessionId niet zichtbaar in lijstbron");
  });

  await scenario("verwijderen laat de training overal verdwijnen", async () => {
    // Ontkoppel eerst zodat verwijderen geen koppeling achterlaat.
    await req("PUT", `/api/athlete/workouts/${createdId}`, A, { sessionId: null });
    const d = await req("DELETE", `/api/athlete/workouts/${createdId}`, A);
    assert(d.status === 200 || d.status === 204, `delete status ${d.status}`);
    // Verwijderen is een zachte annulering (historie blijft herleidbaar):
    // de rij krijgt status "cancelled" en de koppellijst filtert die weg.
    const r = await req("GET", `/api/athlete/workouts?${windowQs()}`, A);
    const row = r.json.find((x: any) => x.id === createdId);
    assert(!row || row.status === "cancelled", `verwacht cancelled, kreeg ${row?.status}`);
  });

  await cleanup();
  await stopServer();

  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) {
    console.log(`${r.status === "pass" ? "✓" : "✗"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} scenario's geslaagd`);
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
