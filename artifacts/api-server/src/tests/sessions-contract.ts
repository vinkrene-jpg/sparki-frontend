// Ritlijst-contract — GET /api/athlete/sessions JSON shape test.
//
// The mobile ride list (artifacts/sparki-mobile/lib/sessions-api.ts) reads
// GET /api/athlete/sessions and depends on an exact wire shape:
//   - sensor fields (avgPower / avgHR / maxHR / avgCadence) are integers when
//     the ride carried real sensor data and null (NOT 0, NOT absent) when not;
//   - numeric DB columns (distanceKm, avgSpeedKph) arrive as STRINGS over JSON
//     (pg numeric round-trip), null when unset;
//   - durationMin / elevationM are plain numbers or null;
//   - sessionDate is a "YYYY-MM-DD" string; sport/source/type are strings.
// A renamed column in lib/db or a reshaped select in the route would silently
// empty or corrupt the mobile list. This test seeds one session WITH and one
// WITHOUT sensor data straight into the DB, boots the REAL Express app, calls
// the endpoint as the seeded dev user, and asserts the exact JSON shape.
//
// Cleanup removes only the rows/user this test created.
//
// Run: `pnpm --filter @workspace/api-server run test:sessions-contract`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true (set by
// the test script). Exits non-zero on any failure.

import type { Server } from "node:http";
import {
  db,
  pool,
  trainingSessionsTable,
  userProfilesTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
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

const RUN = `test_sessct_${Date.now()}`;
const userId = `${RUN}_user`;

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

async function fetchSessions(): Promise<{
  status: number;
  body: unknown;
}> {
  const res = await fetch(`${baseUrl}/api/athlete/sessions?limit=50`, {
    headers: { "x-dev-clerk-id": userId },
  });
  return { status: res.status, body: await res.json() };
}

// The exact set of keys the mobile SessionSummary type reads. The row may
// carry MORE keys (extra columns are backwards-compatible), but every one of
// these must be present with the right runtime type.
type Row = Record<string, unknown>;

function assertString(row: Row, key: string) {
  assert(
    typeof row[key] === "string",
    `${key} must be a string, got ${typeof row[key]} (${JSON.stringify(row[key])})`,
  );
}

function assertIntOrNull(row: Row, key: string, expectNull: boolean) {
  const v = row[key];
  if (expectNull) {
    assert(v === null, `${key} must stay null (never 0/undefined), got ${JSON.stringify(v)}`);
  } else {
    assert(
      typeof v === "number" && Number.isInteger(v),
      `${key} must be an integer, got ${JSON.stringify(v)}`,
    );
  }
}

function assertNumericString(row: Row, key: string, expectNull: boolean) {
  const v = row[key];
  if (expectNull) {
    assert(v === null, `${key} must stay null, got ${JSON.stringify(v)}`);
  } else {
    assert(
      typeof v === "string" && /^\d+(\.\d+)?$/.test(v),
      `${key} must arrive as a numeric STRING over JSON, got ${typeof v} (${JSON.stringify(v)})`,
    );
  }
}

const WITH_SENSORS = {
  sessionDate: "2026-07-19",
  type: "ride",
  title: "Rit met sensoren",
  durationMin: 95,
  distanceKm: "52.30",
  elevationM: 410,
  avgPower: 212,
  avgHR: 148,
  maxHR: 179,
  avgCadence: 88,
  avgSpeedKph: "33.10",
  sport: "cycling",
  source: "manual",
} as const;

const WITHOUT_SENSORS = {
  sessionDate: "2026-07-18",
  type: "ride",
  title: "Rit zonder sensoren",
  durationMin: 60,
  distanceKm: null,
  elevationM: null,
  avgPower: null,
  avgHR: null,
  maxHR: null,
  avgCadence: null,
  avgSpeedKph: null,
  sport: "cycling",
  source: "manual",
} as const;

async function cleanup() {
  await db
    .delete(trainingSessionsTable)
    .where(eq(trainingSessionsTable.clerkId, userId));
  await db
    .delete(userProfilesTable)
    .where(eq(userProfilesTable.clerkId, userId));
}

async function main() {
  await startServer();

  await scenario("dev user can reach the endpoint (precondition)", async () => {
    await ensureAccount(userId, `${userId}@example.test`, "Sessies", silentLogger);
    const { status } = await fetchSessions();
    assert(
      status === 200,
      `expected 200 via dev bypass, got ${status} — ensure NODE_ENV!=production ` +
        `and DEV_AUTH_BYPASS=true`,
    );
  });

  await scenario("seeded sessions come back, newest first", async () => {
    await db.insert(trainingSessionsTable).values([
      { clerkId: userId, ...WITH_SENSORS },
      { clerkId: userId, ...WITHOUT_SENSORS },
    ]);

    const { status, body } = await fetchSessions();
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(body), "response must be a JSON array");
    const rows = body as Row[];
    assert(rows.length === 2, `expected exactly 2 rows for this user, got ${rows.length}`);
    assert(
      rows[0]!["title"] === WITH_SENSORS.title &&
        rows[1]!["title"] === WITHOUT_SENSORS.title,
      "sessions must be ordered newest sessionDate first",
    );
  });

  await scenario("session WITH sensor data has the exact wire shape", async () => {
    const { body } = await fetchSessions();
    const row = (body as Row[]).find((r) => r["title"] === WITH_SENSORS.title);
    assert(row, "seeded sensor session missing from response");
    const r = row!;

    assert(typeof r["id"] === "number", `id must be a number, got ${typeof r["id"]}`);
    assert(
      r["sessionDate"] === WITH_SENSORS.sessionDate,
      `sessionDate must be the plain date string ${WITH_SENSORS.sessionDate}, got ${JSON.stringify(r["sessionDate"])}`,
    );
    assertString(r, "type");
    assertString(r, "sport");
    assertString(r, "source");
    assert(r["title"] === WITH_SENSORS.title, "title must round-trip");

    assertIntOrNull(r, "durationMin", false);
    assert(r["durationMin"] === WITH_SENSORS.durationMin, "durationMin must round-trip");
    assertIntOrNull(r, "elevationM", false);
    assert(r["elevationM"] === WITH_SENSORS.elevationM, "elevationM must round-trip");

    // Sensor fields: integers when real data exists.
    assertIntOrNull(r, "avgPower", false);
    assert(r["avgPower"] === WITH_SENSORS.avgPower, "avgPower must round-trip");
    assertIntOrNull(r, "avgHR", false);
    assert(r["avgHR"] === WITH_SENSORS.avgHR, "avgHR must round-trip");
    assertIntOrNull(r, "maxHR", false);
    assert(r["maxHR"] === WITH_SENSORS.maxHR, "maxHR must round-trip");
    assertIntOrNull(r, "avgCadence", false);
    assert(r["avgCadence"] === WITH_SENSORS.avgCadence, "avgCadence must round-trip");

    // Numeric columns: STRINGS over JSON — the mobile contract's sharp edge.
    assertNumericString(r, "distanceKm", false);
    assert(r["distanceKm"] === WITH_SENSORS.distanceKm, "distanceKm string must round-trip");
    assertNumericString(r, "avgSpeedKph", false);
    assert(r["avgSpeedKph"] === WITH_SENSORS.avgSpeedKph, "avgSpeedKph string must round-trip");
  });

  await scenario("session WITHOUT sensor data keeps every gap null", async () => {
    const { body } = await fetchSessions();
    const row = (body as Row[]).find((r) => r["title"] === WITHOUT_SENSORS.title);
    assert(row, "seeded sensorless session missing from response");
    const r = row!;

    // Every key must still be PRESENT (null, never absent/undefined) so the
    // mobile UI can distinguish "no data" honestly instead of crashing on
    // missing keys.
    for (const key of [
      "distanceKm",
      "elevationM",
      "avgPower",
      "avgHR",
      "maxHR",
      "avgCadence",
      "avgSpeedKph",
    ]) {
      assert(key in r, `${key} must be present as an explicit null, not absent`);
    }

    assertIntOrNull(r, "avgPower", true);
    assertIntOrNull(r, "avgHR", true);
    assertIntOrNull(r, "maxHR", true);
    assertIntOrNull(r, "avgCadence", true);
    assertIntOrNull(r, "elevationM", true);
    assertNumericString(r, "distanceKm", true);
    assertNumericString(r, "avgSpeedKph", true);

    assertIntOrNull(r, "durationMin", false);
    assert(r["durationMin"] === WITHOUT_SENSORS.durationMin, "durationMin must round-trip");
  });
}

async function shutdown(code: number) {
  await stopServer().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(code);
}

main()
  .then(async () => {
    await cleanup().catch(() => {});
    const failed = results.filter((r) => r.status === "fail");
    console.log("\n=== ritlijst-contract (GET /api/athlete/sessions) — test results ===");
    for (const r of results) {
      const mark = r.status === "pass" ? "PASS" : "FAIL";
      console.log(`[${mark}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    }
    console.log(`\n${results.length - failed.length}/${results.length} passed.\n`);
    await shutdown(failed.length > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error("test harness crashed:", err);
    await cleanup().catch(() => {});
    await shutdown(1);
  });
