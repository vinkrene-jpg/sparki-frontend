// Draadloze onderdelen (garage sensors) — DB-backed route contract test.
//
// Pins the honesty + ownership contract of /api/garage/sensors:
// - CRUD works for the owner, sensors show up in the garage overview
// - `pairable` is derived honestly from the kind (only power/HR/CSC true)
// - watch/derailleur never persist a deviceName (register-only kinds)
// - bike linking validates ownership (cannot attach to someone else's bike)
// - another account cannot read, update, move or delete the owner's sensors
//
// Run: `pnpm --filter @workspace/api-server run test:garage-sensors`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  pool,
  garageBikesTable,
  garageSensorsTable,
  userProfilesTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => Promise<void>) {
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

const RUN = `test_gsensors_${Date.now()}`;
const userA = `${RUN}_a`;
const userB = `${RUN}_b`;

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
      } else {
        reject(new Error("failed to determine server port"));
      }
    });
  });
}

async function stopServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
}

async function api(
  clerkId: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "x-dev-clerk-id": clerkId,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, json };
}

async function main() {
  await startServer();
  await ensureAccount(userA, `${userA}@test.local`, "Sensor A", silentLogger);
  await ensureAccount(userB, `${userB}@test.local`, "Sensor B", silentLogger);

  // Seed one bike per user via the real route.
  const bikeA = (
    await api(userA, "POST", "/api/garage/bikes", {
      bikeType: "race",
      name: "Testfiets A",
    })
  ).json.bike;
  const bikeB = (
    await api(userB, "POST", "/api/garage/bikes", {
      bikeType: "gravel",
      name: "Testfiets B",
    })
  ).json.bike;

  let sensorId = 0;

  await scenario("koppelbare sensor: aanmaken op eigen fiets, pairable=true", async () => {
    const { status, json } = await api(userA, "POST", "/api/garage/sensors", {
      bikeId: bikeA.id,
      kind: "wattagemeter",
      brand: "Garmin",
      model: "Rally RS200",
      deviceName: "Rally RS200 12345",
      batteryNote: "AAA, vervangen juli 2026",
    });
    assert(status === 200, `verwacht 200, kreeg ${status}`);
    assert(json.sensor.pairable === true, "wattagemeter moet pairable zijn");
    assert(json.sensor.deviceName === "Rally RS200 12345", "deviceName bewaard");
    assert(json.sensor.bikeId === bikeA.id, "gekoppeld aan fiets A");
    sensorId = json.sensor.id;
  });

  await scenario("register-only soort: horloge krijgt pairable=false en GEEN deviceName", async () => {
    const { status, json } = await api(userA, "POST", "/api/garage/sensors", {
      kind: "horloge",
      brand: "Garmin",
      model: "Forerunner 965",
      deviceName: "mag-niet-blijven",
    });
    assert(status === 200, `verwacht 200, kreeg ${status}`);
    assert(json.sensor.pairable === false, "horloge is niet live koppelbaar");
    assert(json.sensor.deviceName === null, "deviceName mag niet persist voor horloge");
    assert(json.sensor.bikeId === null, "los onderdeel (geen fiets)");
  });

  await scenario("onbekend soort wordt geweigerd", async () => {
    const { status } = await api(userA, "POST", "/api/garage/sensors", {
      kind: "telepathie",
    });
    assert(status === 400, `verwacht 400, kreeg ${status}`);
  });

  await scenario("kan niet koppelen aan andermans fiets", async () => {
    const { status } = await api(userA, "POST", "/api/garage/sensors", {
      bikeId: bikeB.id,
      kind: "cadans_snelheid",
    });
    assert(status === 404, `verwacht 404, kreeg ${status}`);
  });

  await scenario("overzicht: sensoren van de eigenaar staan in GET /api/garage", async () => {
    const { status, json } = await api(userA, "GET", "/api/garage");
    assert(status === 200, `verwacht 200, kreeg ${status}`);
    const ids = (json.sensors ?? []).map((s: any) => s.id);
    assert(ids.includes(sensorId), "sensor van A in overzicht van A");
    const other = await api(userB, "GET", "/api/garage");
    const idsB = (other.json.sensors ?? []).map((s: any) => s.id);
    assert(!idsB.includes(sensorId), "sensor van A NIET in overzicht van B");
  });

  await scenario("verplaatsen: losmaken (bikeId null) en terugzetten op eigen fiets", async () => {
    const detach = await api(userA, "PATCH", `/api/garage/sensors/${sensorId}`, {
      bikeId: null,
    });
    assert(detach.status === 200 && detach.json.sensor.bikeId === null, "losmaken");
    const attach = await api(userA, "PATCH", `/api/garage/sensors/${sensorId}`, {
      bikeId: bikeA.id,
      batteryNote: "nieuw geplaatst",
    });
    assert(attach.status === 200 && attach.json.sensor.bikeId === bikeA.id, "terugzetten");
    assert(attach.json.sensor.batteryNote === "nieuw geplaatst", "batterijnotitie bijgewerkt");
  });

  await scenario("verplaatsen naar andermans fiets wordt geweigerd", async () => {
    const { status } = await api(userA, "PATCH", `/api/garage/sensors/${sensorId}`, {
      bikeId: bikeB.id,
    });
    assert(status === 404, `verwacht 404, kreeg ${status}`);
  });

  await scenario("isolatie: B kan sensor van A niet bijwerken of verwijderen", async () => {
    const patch = await api(userB, "PATCH", `/api/garage/sensors/${sensorId}`, {
      brand: "Gekaapt",
    });
    assert(patch.status === 404, `patch: verwacht 404, kreeg ${patch.status}`);
    const del = await api(userB, "DELETE", `/api/garage/sensors/${sensorId}`);
    assert(del.status === 404, `delete: verwacht 404, kreeg ${del.status}`);
    // Positive control: the row must still exist and be unchanged.
    const [row] = await db
      .select()
      .from(garageSensorsTable)
      .where(eq(garageSensorsTable.id, sensorId));
    assert(row && row.brand === "Garmin", "rij van A onaangetast");
  });

  await scenario("fiets verwijderen laat de sensor los (bikeId null), verwijdert hem niet", async () => {
    const del = await api(userA, "DELETE", `/api/garage/bikes/${bikeA.id}`);
    assert(del.status === 200, `verwacht 200, kreeg ${del.status}`);
    const [row] = await db
      .select()
      .from(garageSensorsTable)
      .where(eq(garageSensorsTable.id, sensorId));
    assert(row, "sensor bestaat nog na verwijderen fiets");
    assert(row!.bikeId === null, "sensor is losgemaakt (bikeId null)");
  });

  await scenario("eigenaar kan verwijderen", async () => {
    const { status } = await api(userA, "DELETE", `/api/garage/sensors/${sensorId}`);
    assert(status === 200, `verwacht 200, kreeg ${status}`);
    const [row] = await db
      .select()
      .from(garageSensorsTable)
      .where(eq(garageSensorsTable.id, sensorId));
    assert(!row, "rij is echt weg");
  });

  // Cleanup — only our own rows; profile cascade removes bikes/sensors.
  await db
    .delete(garageSensorsTable)
    .where(inArray(garageSensorsTable.clerkId, [userA, userB]));
  await db
    .delete(garageBikesTable)
    .where(inArray(garageBikesTable.clerkId, [userA, userB]));
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, [userA, userB]));

  await stopServer();
  await pool.end();

  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✓" : "✗";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("test run failed:", err);
  process.exit(1);
});
