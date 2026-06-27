// developmentGoal save/clear contract test (PUT/GET /api/athlete/profile).
//
// Locks down the whitelist that protects the `development_goal` column, which
// now drives coaching context and the Ontwikkelkompas. A regression here (a bad
// value slipping through, a missing clear-on-null, or a dropped valid key) would
// silently distort coaching advice, so this test exercises the REAL route over
// HTTP against the dev DB.
//
// It boots the actual Express app and uses the dev-auth bypass (the
// `x-dev-clerk-id` header) to act as a disposable seeded user, so the full
// requireAuth → handler → DB path is covered. Each run uses a unique clerkId/
// email and cleans up afterwards, so it is safe to re-run against a shared DB.
//
// Run: `pnpm --filter @workspace/api-server run test:development-goal`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true (set by
// the test script). Exits non-zero on any failure.

import type { Server } from "node:http";
import { db, pool, athleteProfilesTable, userProfilesTable } from "@workspace/db";
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

const RUN = `test_devgoal_${Date.now()}`;
const ids: string[] = [];
function newId(tag: string): string {
  const id = `${RUN}_${tag}`;
  ids.push(id);
  return id;
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

// Helpers acting as a given dev user via the x-dev-clerk-id header.
async function putProfile(
  clerkId: string,
  body: Record<string, unknown>,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}/api/athlete/profile`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": clerkId,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  return { status: res.status, json };
}

async function getProfile(
  clerkId: string,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}/api/athlete/profile`, {
    method: "GET",
    headers: { "x-dev-clerk-id": clerkId },
  });
  const json = (await res.json()) as Record<string, unknown>;
  return { status: res.status, json };
}

// Read the column straight from the DB to verify true persistence (not just the
// route's echoed response).
async function dbDevelopmentGoal(clerkId: string): Promise<string | null> {
  const [row] = await db
    .select({ developmentGoal: athleteProfilesTable.developmentGoal })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId));
  return row?.developmentGoal ?? null;
}

async function cleanup() {
  if (ids.length === 0) return;
  await db
    .delete(athleteProfilesTable)
    .where(inArray(athleteProfilesTable.clerkId, ids));
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, ids));
}

async function main() {
  await startServer();

  // Sanity: the dev-auth bypass must actually be active, otherwise every request
  // is a 401 and the contract assertions below would be meaningless.
  await scenario("dev-auth bypass is active (precondition)", async () => {
    const id = newId("precond");
    await ensureAccount(id, `${id}@example.test`, "Pre", silentLogger);
    const { status } = await getProfile(id);
    assert(
      status === 200,
      `expected GET to authorize via dev bypass (200), got ${status} — ` +
        `ensure NODE_ENV!=production and DEV_AUTH_BYPASS=true`,
    );
  });

  // 1. A valid enum key persists and round-trips via GET + DB.
  await scenario("geldige enum-waarde wordt opgeslagen", async () => {
    const id = newId("valid");
    await ensureAccount(id, `${id}@example.test`, "Valid", silentLogger);

    const put = await putProfile(id, { developmentGoal: "granfondo" });
    assert(put.status === 200, `PUT should succeed, got ${put.status}`);
    assert(
      put.json["developmentGoal"] === "granfondo",
      `PUT response should echo granfondo, got ${String(put.json["developmentGoal"])}`,
    );

    const get = await getProfile(id);
    assert(
      get.json["developmentGoal"] === "granfondo",
      `GET should round-trip granfondo, got ${String(get.json["developmentGoal"])}`,
    );
    assert(
      (await dbDevelopmentGoal(id)) === "granfondo",
      "DB column should hold granfondo",
    );
  });

  // 2. An unknown string is ignored — the previous valid value is untouched.
  await scenario("onbekende waarde wordt genegeerd (niet opgeslagen)", async () => {
    const id = newId("unknown");
    await ensureAccount(id, `${id}@example.test`, "Unknown", silentLogger);

    // Seed a known-good value first.
    await putProfile(id, { developmentGoal: "topamateur" });
    assert(
      (await dbDevelopmentGoal(id)) === "topamateur",
      "precondition: topamateur stored",
    );

    // A bogus value must NOT overwrite or corrupt the stored value.
    const put = await putProfile(id, { developmentGoal: "wereldkampioen" });
    assert(put.status === 200, `PUT should still succeed, got ${put.status}`);
    assert(
      put.json["developmentGoal"] === "topamateur",
      `bad value must not overwrite; expected topamateur, got ${String(put.json["developmentGoal"])}`,
    );
    assert(
      (await dbDevelopmentGoal(id)) === "topamateur",
      "DB column must remain topamateur after a bad value",
    );

    // Empty string is also not a valid key and must be ignored.
    await putProfile(id, { developmentGoal: "" });
    assert(
      (await dbDevelopmentGoal(id)) === "topamateur",
      "empty string must be ignored, topamateur must remain",
    );
  });

  // 3. Explicit null clears the field.
  await scenario("expliciete null wist het veld", async () => {
    const id = newId("clear");
    await ensureAccount(id, `${id}@example.test`, "Clear", silentLogger);

    await putProfile(id, { developmentGoal: "prof" });
    assert((await dbDevelopmentGoal(id)) === "prof", "precondition: prof stored");

    const put = await putProfile(id, { developmentGoal: null });
    assert(put.status === 200, `PUT null should succeed, got ${put.status}`);
    assert(
      put.json["developmentGoal"] === null,
      `PUT response should report cleared (null), got ${String(put.json["developmentGoal"])}`,
    );

    const get = await getProfile(id);
    assert(
      get.json["developmentGoal"] === null,
      `GET should round-trip null, got ${String(get.json["developmentGoal"])}`,
    );
    assert((await dbDevelopmentGoal(id)) === null, "DB column should be null");
  });

  // 4. Omitting developmentGoal leaves the stored value untouched.
  await scenario("weglaten van het veld laat de waarde ongemoeid", async () => {
    const id = newId("omit");
    await ensureAccount(id, `${id}@example.test`, "Omit", silentLogger);

    await putProfile(id, { developmentGoal: "elite_u23" });
    assert(
      (await dbDevelopmentGoal(id)) === "elite_u23",
      "precondition: elite_u23 stored",
    );

    // A PUT that updates something else but omits developmentGoal entirely.
    const put = await putProfile(id, { goals: "Op weg naar het NK" });
    assert(put.status === 200, `PUT should succeed, got ${put.status}`);
    assert(
      put.json["developmentGoal"] === "elite_u23",
      `omitted field must be untouched, got ${String(put.json["developmentGoal"])}`,
    );
    assert(
      (await dbDevelopmentGoal(id)) === "elite_u23",
      "DB column must remain elite_u23 when the field is omitted",
    );
  });
}

async function shutdown(code: number) {
  await stopServer().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(code);
}

main()
  .then(async () => {
    await cleanup();
    const failed = results.filter((r) => r.status === "fail");
    console.log("\n=== developmentGoal save/clear contract — test results ===");
    for (const r of results) {
      const mark = r.status === "pass" ? "PASS" : "FAIL";
      console.log(`[${mark}] ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    }
    console.log(
      `\n${results.length - failed.length}/${results.length} passed.\n`,
    );
    await shutdown(failed.length > 0 ? 1 : 0);
  })
  .catch(async (err) => {
    console.error("test harness crashed:", err);
    await cleanup().catch(() => {});
    await shutdown(1);
  });
