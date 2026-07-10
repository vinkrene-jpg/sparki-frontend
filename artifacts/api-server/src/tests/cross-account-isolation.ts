// Cross-account isolation — DB-backed route contract test.
//
// Task #182 pinned cross-account isolation for the workout feedback/adjust/apply
// chain. The SAME leak risk exists on every other athlete-owned surface that
// resolves a record by :id — races, saved routes, planned-workout GET, nutrition
// logs, and owner-checked photo/object serving. None of those had an automated
// "athlete B is denied on athlete A's record" check, so a future ownership-filter
// regression on any of them would silently become a cross-account data leak or
// mutation.
//
// This test boots the REAL Express app, seeds TWO disposable athletes (A and B)
// via ensureAccount, and for each athlete-owned resource that takes an :id:
//   1. proves A (the owner) CAN reach their own record (positive control, so the
//      test can never falsely pass by everyone getting 404), then
//   2. proves B is DENIED on A's record (404/403) with ZERO read of A's data and
//      ZERO mutation of A's record.
//
// Covered surfaces (all resolve by :id, ownership-scoped by clerkId):
//   • races    — GET :id/intel, GET :id/context, GET :id/evaluation,
//                PUT :id, PUT :id/checklist, DELETE :id
//   • routes   — GET :id, GET :id/gpx, GET :id/tcx, DELETE :id
//   • workouts — GET /api/athlete/workouts/:id
//   • nutrition— GET /api/nutrition/photo/:id/:idx, DELETE /api/nutrition/:id
//   • material — GET /api/material/photo/:id/:idx
//
// Note on the nutrition DELETE: like races/routes DELETE, it uses `.returning()`
// and returns 404 for a non-owned id (ownership-scoped delete matches nothing).
// B therefore gets 404 and A's row must survive. The security guarantee is
// "zero mutation", which this test asserts explicitly.
//
// Photo/object serving uses REAL object storage: A's photo rows are seeded with
// a genuinely uploaded object so A's positive control returns 200 (proving the
// gate lets the owner through AND the object exists), while B is denied 404 by
// the ownership query before any bytes are streamed.
//
// Cleanup removes only rows this test created; the two seeded profiles are
// removed last (their owned rows cascade).
//
// Run: `pnpm --filter @workspace/api-server run test:cross-account-isolation`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true (set by
// the test script) + object storage env (PRIVATE_OBJECT_DIR). Exits non-zero on
// any failure.

import type { Server } from "node:http";
import {
  db,
  pool,
  racesTable,
  routesTable,
  plannedWorkoutsTable,
  nutritionHydrationLogsTable,
  materialAnalysesTable,
  userProfilesTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";
import { uploadMaterialPhoto } from "../lib/material/storage";

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

// ── Seeded fixtures ──────────────────────────────────────────────────────────
const RUN = `test_xacct_${Date.now()}`;
const clerkA = `${RUN}_athlete_a`;
const clerkB = `${RUN}_athlete_b`;

const seeded = {
  raceId: 0,
  routeId: 0,
  workoutId: 0,
  nutritionId: 0,
  materialId: 0,
};

function isoOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// A 1×1 transparent PNG — enough bytes for a real object-storage upload so the
// owner's photo-serve positive control returns actual 200 image bytes.
const PNG_1x1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// ── HTTP helper acting as a seeded dev athlete via x-dev-clerk-id ─────────────
async function req(
  method: string,
  path: string,
  actor: string,
  body?: unknown,
): Promise<{ status: number; text: string; json: unknown }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": actor,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: res.status, text, json };
}

// ── Row readers (unscoped by clerk — read A's raw row directly for no-mutation)
async function raceRow(id: number) {
  const [r] = await db.select().from(racesTable).where(eq(racesTable.id, id));
  return r ?? null;
}
async function routeRow(id: number) {
  const [r] = await db.select().from(routesTable).where(eq(routesTable.id, id));
  return r ?? null;
}
async function nutritionRow(id: number) {
  const [r] = await db
    .select()
    .from(nutritionHydrationLogsTable)
    .where(eq(nutritionHydrationLogsTable.id, id));
  return r ?? null;
}
async function workoutRow(id: number) {
  const [r] = await db
    .select()
    .from(plannedWorkoutsTable)
    .where(eq(plannedWorkoutsTable.id, id));
  return r ?? null;
}

async function cleanup() {
  // Athlete-owned rows cascade on profile delete, but delete explicitly first so
  // a failed cascade never leaks fixtures.
  await db.delete(racesTable).where(eq(racesTable.clerkId, clerkA)).catch(() => {});
  await db.delete(routesTable).where(eq(routesTable.clerkId, clerkA)).catch(() => {});
  await db
    .delete(nutritionHydrationLogsTable)
    .where(eq(nutritionHydrationLogsTable.clerkId, clerkA))
    .catch(() => {});
  await db
    .delete(materialAnalysesTable)
    .where(eq(materialAnalysesTable.clerkId, clerkA))
    .catch(() => {});
  await db
    .delete(plannedWorkoutsTable)
    .where(eq(plannedWorkoutsTable.clerkId, clerkA))
    .catch(() => {});
  for (const c of [clerkA, clerkB]) {
    await db
      .delete(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, c))
      .catch(() => {});
  }
}

async function main() {
  await startServer();
  await ensureAccount(clerkA, `${clerkA}@example.test`, "Atleet A", silentLogger);
  await ensureAccount(clerkB, `${clerkB}@example.test`, "Atleet B", silentLogger);

  // ── Seed A's records ───────────────────────────────────────────────────────
  const [race] = await db
    .insert(racesTable)
    .values({
      clerkId: clerkA,
      name: "A's wedstrijd",
      raceDate: isoOffset(21),
      priority: "A",
      discipline: "wegwedstrijd",
      location: "Ergens",
    })
    .returning({ id: racesTable.id });
  seeded.raceId = race!.id;

  const [route] = await db
    .insert(routesTable)
    .values({
      clerkId: clerkA,
      name: "A's route",
      surface: "road",
      status: "ready",
      source: "generated",
      distanceKm: 20,
      elevationGainM: 100,
      // Real geometry so GPX/TCX export succeeds for the owner's positive control.
      geometry: [
        [52.1, 5.1],
        [52.2, 5.2],
        [52.3, 5.3],
      ],
      profile: [10, 20, 30],
    })
    .returning({ id: routesTable.id });
  seeded.routeId = route!.id;

  const [workout] = await db
    .insert(plannedWorkoutsTable)
    .values({
      clerkId: clerkA,
      scheduledDate: isoOffset(2),
      type: "ride",
      title: "A's training",
      targetDurationMin: 90,
      targetTSS: 75,
      status: "planned",
      source: "sparki",
    })
    .returning({ id: plannedWorkoutsTable.id });
  seeded.workoutId = workout!.id;

  // Upload a real photo owned by A, then seed the nutrition + material rows that
  // reference it, so the owner's photo-serve returns real 200 bytes.
  const objectPath = await uploadMaterialPhoto(clerkA, {
    base64: PNG_1x1_BASE64,
    mediaType: "image/png",
  });

  const [nlog] = await db
    .insert(nutritionHydrationLogsTable)
    .values({
      clerkId: clerkA,
      logDate: isoOffset(-1),
      context: "normal_day",
      notes: "A's maaltijd",
      photoPaths: [objectPath],
    })
    .returning({ id: nutritionHydrationLogsTable.id });
  seeded.nutritionId = nlog!.id;

  const [manalysis] = await db
    .insert(materialAnalysesTable)
    .values({
      clerkId: clerkA,
      category: "bike",
      userNote: "A's fiets",
      status: "analyzed",
      photoPaths: [objectPath],
      confidence: "unknown",
    })
    .returning({ id: materialAnalysesTable.id });
  seeded.materialId = manalysis!.id;

  // ── Precondition: dev bypass authorizes A on their own record ───────────────
  await scenario("precondition: dev bypass authorizes owner A", async () => {
    const r = await req("GET", `/api/races/${seeded.raceId}/intel`, clerkA);
    assert(
      r.status === 200,
      `expected 200 for A via dev bypass, got ${r.status} — ensure NODE_ENV!=production and DEV_AUTH_BYPASS=true`,
    );
  });

  // ── RACES ───────────────────────────────────────────────────────────────────
  await scenario("races: owner A can read/update its own race (positive control)", async () => {
    const intel = await req("GET", `/api/races/${seeded.raceId}/intel`, clerkA);
    assert(intel.status === 200, `A intel expected 200, got ${intel.status}`);
    const ctx = await req("GET", `/api/races/${seeded.raceId}/context`, clerkA);
    assert(ctx.status === 200, `A context expected 200, got ${ctx.status}`);
    const evalr = await req("GET", `/api/races/${seeded.raceId}/evaluation`, clerkA);
    assert(evalr.status === 200, `A evaluation expected 200, got ${evalr.status}`);
  });

  await scenario(
    "races: athlete B is denied GET/PUT/DELETE on A's race (no read, no mutation)",
    async () => {
      const before = await raceRow(seeded.raceId);
      assert(before != null, "seed of A's race failed");

      // Reads → 404, and B never receives A's race data.
      for (const sub of ["intel", "context", "evaluation"]) {
        const g = await req("GET", `/api/races/${seeded.raceId}/${sub}`, clerkB);
        assert(g.status === 404, `B GET race ${sub} must be 404, got ${g.status}`);
        assert(
          !g.text.includes("A's wedstrijd"),
          `B must not receive A's race name via ${sub}`,
        );
      }

      // PUT → 404, and A's race must be byte-for-byte unchanged.
      const put = await req("PUT", `/api/races/${seeded.raceId}`, clerkB, {
        name: "GEKAAPT DOOR B",
        location: "Hacktown",
        priority: "C",
      });
      assert(put.status === 404, `B PUT race must be 404, got ${put.status}`);

      // PUT checklist → 404.
      const chk = await req(
        "PUT",
        `/api/races/${seeded.raceId}/checklist`,
        clerkB,
        { checklist: { pump: true } },
      );
      assert(chk.status === 404, `B PUT race checklist must be 404, got ${chk.status}`);

      // DELETE → 404, and the race must still exist.
      const del = await req("DELETE", `/api/races/${seeded.raceId}`, clerkB);
      assert(del.status === 404, `B DELETE race must be 404, got ${del.status}`);

      const after = await raceRow(seeded.raceId);
      assert(after != null, "A's race was deleted by B — isolation broken");
      assert(
        after!.name === before!.name &&
          after!.location === before!.location &&
          after!.priority === before!.priority &&
          after!.checklist == before!.checklist,
        "A's race was mutated by B — isolation broken",
      );
    },
  );

  // ── ROUTES ──────────────────────────────────────────────────────────────────
  await scenario("routes: owner A can read/export its own route (positive control)", async () => {
    const g = await req("GET", `/api/routes/${seeded.routeId}`, clerkA);
    assert(g.status === 200, `A GET route expected 200, got ${g.status}`);
    const gpx = await req("GET", `/api/routes/${seeded.routeId}/gpx`, clerkA);
    assert(gpx.status === 200, `A GET route gpx expected 200, got ${gpx.status}`);
    assert(gpx.text.includes("<gpx"), "A's GPX export missing <gpx> root");
    const tcx = await req("GET", `/api/routes/${seeded.routeId}/tcx`, clerkA);
    assert(tcx.status === 200, `A GET route tcx expected 200, got ${tcx.status}`);
  });

  await scenario(
    "routes: athlete B is denied GET/GPX/TCX/DELETE on A's route (no read, no mutation)",
    async () => {
      const before = await routeRow(seeded.routeId);
      assert(before != null, "seed of A's route failed");

      const g = await req("GET", `/api/routes/${seeded.routeId}`, clerkB);
      assert(g.status === 404, `B GET route must be 404, got ${g.status}`);
      assert(!g.text.includes("A's route"), "B must not receive A's route data");

      const gpx = await req("GET", `/api/routes/${seeded.routeId}/gpx`, clerkB);
      assert(gpx.status === 404, `B GET route gpx must be 404, got ${gpx.status}`);
      assert(!gpx.text.includes("<gpx"), "B must not receive A's route as GPX");

      const tcx = await req("GET", `/api/routes/${seeded.routeId}/tcx`, clerkB);
      assert(tcx.status === 404, `B GET route tcx must be 404, got ${tcx.status}`);

      const del = await req("DELETE", `/api/routes/${seeded.routeId}`, clerkB);
      assert(del.status === 404, `B DELETE route must be 404, got ${del.status}`);

      const after = await routeRow(seeded.routeId);
      assert(after != null, "A's route was deleted by B — isolation broken");
      assert(after!.name === before!.name, "A's route was mutated by B — isolation broken");
    },
  );

  // ── WORKOUTS (GET by id) ─────────────────────────────────────────────────────
  await scenario("workouts: owner A can read its own workout (positive control)", async () => {
    const g = await req("GET", `/api/athlete/workouts/${seeded.workoutId}`, clerkA);
    assert(g.status === 200, `A GET workout expected 200, got ${g.status}`);
    assert(g.text.includes("A's training"), "A's workout GET missing its title");
  });

  await scenario(
    "workouts: athlete B is denied GET on A's workout (no read)",
    async () => {
      const before = await workoutRow(seeded.workoutId);
      assert(before != null, "seed of A's workout failed");
      const g = await req("GET", `/api/athlete/workouts/${seeded.workoutId}`, clerkB);
      assert(g.status === 404, `B GET workout must be 404, got ${g.status}`);
      assert(!g.text.includes("A's training"), "B must not receive A's workout data");
      const after = await workoutRow(seeded.workoutId);
      assert(after != null, "A's workout disappeared after B's GET");
    },
  );

  // ── NUTRITION (photo serve + delete) ─────────────────────────────────────────
  await scenario("nutrition: owner A can serve its own meal photo (positive control)", async () => {
    const g = await req("GET", `/api/nutrition/photo/${seeded.nutritionId}/0`, clerkA);
    assert(g.status === 200, `A GET nutrition photo expected 200, got ${g.status}`);
  });

  await scenario(
    "nutrition: athlete B is denied the meal photo and cannot delete A's log (no read, no mutation)",
    async () => {
      const before = await nutritionRow(seeded.nutritionId);
      assert(before != null, "seed of A's nutrition log failed");

      const photo = await req(
        "GET",
        `/api/nutrition/photo/${seeded.nutritionId}/0`,
        clerkB,
      );
      assert(photo.status === 404, `B GET nutrition photo must be 404, got ${photo.status}`);

      // DELETE for a non-owner must return 404 (matching races/routes DELETE)
      // and must NOT delete A's row. The security guarantee is zero mutation.
      const del = await req("DELETE", `/api/nutrition/${seeded.nutritionId}`, clerkB);
      assert(
        del.status === 404,
        `B DELETE nutrition expected 404, got ${del.status}`,
      );
      const after = await nutritionRow(seeded.nutritionId);
      assert(
        after != null,
        "A's nutrition log was deleted by B — cross-account mutation, isolation broken",
      );
      assert(after!.notes === before!.notes, "A's nutrition log was mutated by B");
    },
  );

  // ── MATERIAL (photo serve) ───────────────────────────────────────────────────
  await scenario("material: owner A can serve its own material photo (positive control)", async () => {
    const g = await req("GET", `/api/material/photo/${seeded.materialId}/0`, clerkA);
    assert(g.status === 200, `A GET material photo expected 200, got ${g.status}`);
  });

  await scenario(
    "material: athlete B is denied A's material photo (no read)",
    async () => {
      const photo = await req(
        "GET",
        `/api/material/photo/${seeded.materialId}/0`,
        clerkB,
      );
      assert(photo.status === 404, `B GET material photo must be 404, got ${photo.status}`);
    },
  );
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
    console.log("\n=== cross-account isolation — test results ===");
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
