// Sterren-beoordelingen op gebouwde onderdelen (build_ratings) — contracttest.
//
// Dekt: idempotente upsert (nieuwe score + toelichting verversen de HELE rij),
// validatie (register van onderwerp-typen, 1–5, toelichting optioneel),
// eigen-beoordelingen-lezen (nooit die van een ander) en de admin-aggregatie
// (/api/admin/build-ratings: gemiddelde + aantal, alleen aggregaten).
//
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.
// Run: `pnpm --filter @workspace/api-server run test:build-ratings`

import type { Server } from "node:http";
import app from "../app";
import { and, eq, like } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  buildRatingsTable,
} from "@workspace/db";

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

const RUN = `test_bldrating_${Date.now()}`;
const clerkId = `${RUN}_athlete`;
const clerkIdB = `${RUN}_athlete_b`;

async function api(
  method: string,
  path: string,
  actor: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-dev-clerk-id": actor,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    // sommige fouten hebben geen JSON-body
  }
  return { status: res.status, json: json as any };
}

async function seed() {
  await db.insert(userProfilesTable).values([
    { clerkId, email: `${clerkId}@test.local`, displayName: "Bld A" },
    { clerkId: clerkIdB, email: `${clerkIdB}@test.local`, displayName: "Bld B" },
  ]);
}

async function cleanup() {
  await db
    .delete(buildRatingsTable)
    .where(like(buildRatingsTable.clerkId, `${RUN}%`));
  await db
    .delete(userProfilesTable)
    .where(like(userProfilesTable.clerkId, `${RUN}%`));
}

async function main() {
  await seed();
  await startServer();
  const subjectId = `${RUN}_route_1`;

  try {
    await scenario("onbekend onderwerp-type wordt geweigerd (400)", async () => {
      const r = await api("PUT", "/api/build-ratings", clerkId, {
        subjectType: "verzonnen_type",
        subjectId,
        rating: 4,
      });
      assert(r.status === 400, `verwacht 400, kreeg ${r.status}`);
    });

    await scenario("score buiten 1–5 wordt geweigerd (400)", async () => {
      const r0 = await api("PUT", "/api/build-ratings", clerkId, {
        subjectType: "bewaarde_route",
        subjectId,
        rating: 0,
      });
      const r6 = await api("PUT", "/api/build-ratings", clerkId, {
        subjectType: "bewaarde_route",
        subjectId,
        rating: 6,
      });
      assert(r0.status === 400 && r6.status === 400, "0 en 6 moeten 400 geven");
    });

    await scenario("eerste beoordeling: één tik, zonder toelichting", async () => {
      const r = await api("PUT", "/api/build-ratings", clerkId, {
        subjectType: "bewaarde_route",
        subjectId,
        rating: 4,
      });
      assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
      assert(r.json.rating.rating === 4, "score moet 4 zijn");
      assert(r.json.rating.comment === null, "toelichting hoort null te zijn");
    });

    await scenario(
      "idempotente upsert: nieuwe score + toelichting ververst de HELE rij",
      async () => {
        await api("PUT", "/api/build-ratings", clerkId, {
          subjectType: "bewaarde_route",
          subjectId,
          rating: 5,
          comment: "Prachtige route",
        });
        // Opnieuw zonder toelichting: rij volledig ververst → toelichting weg.
        const r = await api("PUT", "/api/build-ratings", clerkId, {
          subjectType: "bewaarde_route",
          subjectId,
          rating: 2,
          comment: null,
        });
        assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
        const rows = await db
          .select()
          .from(buildRatingsTable)
          .where(
            and(
              eq(buildRatingsTable.clerkId, clerkId),
              eq(buildRatingsTable.subjectType, "bewaarde_route"),
              eq(buildRatingsTable.subjectId, subjectId),
            ),
          );
        assert(rows.length === 1, `verwacht precies 1 rij, kreeg ${rows.length}`);
        assert(rows[0]!.rating === 2, "score moet overschreven zijn naar 2");
        assert(rows[0]!.comment === null, "oude toelichting moet weg zijn");
      },
    );

    await scenario("lezen geeft alleen EIGEN beoordelingen terug", async () => {
      await api("PUT", "/api/build-ratings", clerkIdB, {
        subjectType: "bewaarde_route",
        subjectId,
        rating: 1,
      });
      const r = await api(
        "GET",
        `/api/build-ratings?subjectType=bewaarde_route&subjectIds=${encodeURIComponent(subjectId)}`,
        clerkId,
      );
      assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
      assert(r.json.ratings.length === 1, "precies één eigen beoordeling");
      assert(r.json.ratings[0].rating === 2, "eigen score (2), nooit die van B");
    });

    await scenario(
      "admin-aggregatie telt beide gebruikers, alleen aggregaten",
      async () => {
        // Dev-bypass behandelt de aanroeper als admin in deze testomgeving —
        // het gaat hier om het contract van de respons.
        const r = await api("GET", "/api/admin/build-ratings", clerkId);
        assert(r.status === 200, `verwacht 200, kreeg ${r.status}`);
        const agg = (r.json.aggregates as any[]).find(
          (a) => a.subjectType === "bewaarde_route",
        );
        assert(agg, "aggregate voor bewaarde_route ontbreekt");
        assert(agg.count >= 2, `count moet ≥ 2 zijn, kreeg ${agg.count}`);
        assert(
          typeof agg.average === "number",
          "average moet een getal zijn",
        );
        const raw = JSON.stringify(r.json);
        assert(
          !raw.includes(clerkId) && !raw.includes(clerkIdB),
          "respons mag nooit clerk-ids bevatten (privacy)",
        );
      },
    );
  } finally {
    await stopServer();
    await cleanup();
    await pool.end();
  }

  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✅" : "❌";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Testrun crashte:", err);
  process.exit(1);
});
