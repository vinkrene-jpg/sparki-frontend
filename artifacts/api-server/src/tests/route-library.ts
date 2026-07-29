// Sparki-routebibliotheek — DB-backed route contract test.
//
// Pins the honesty contract of /api/routes/bibliotheek*:
// - bbox-validatie: niet-numeriek, min>=max en te grote uitsneden geven 400
// - commentaar-upsert: één mening per gebruiker (upsert, nooit een 2e rij),
//   gemiddelde score deterministisch herberekend uit de echte rijen;
//   comment-only telt niet mee in avg/count
// - "gebruik": kopieert naar eigen routes (privé, source=library, eerlijke
//   surface-mapping), en 404 op onbekend id
// - eerlijk statuscontract van /hier: klaar (cel al gevuld), gestart (achter-
//   grondgeneratie; zonder provider komen er nooit verzonnen rijen), limiet
//   (dagplafond nieuwe cellen), plus 400 op ongeldige locatie
//
// Run: `pnpm --filter @workspace/api-server run test:route-library`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

// Geen routeprovider in deze test: generatie moet dan eerlijk overslaan en
// NOOIT rijen verzinnen. (isConfigured leest env per aanroep.)
delete process.env.ORS_API_KEY;

import type { Server } from "node:http";
import {
  db,
  pool,
  routeLibraryTable,
  routeLibraryCommentsTable,
  routesTable,
  userProfilesTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
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

const RUN = `test_routelib_${Date.now()}`;
const userA = `${RUN}_a`;
const userB = `${RUN}_b`;
const userC = `${RUN}_c`;

// Afgelegen testgebied (zuidelijke Indische Oceaan) — botst met niets.
// Cel-grid is 0,25°; SEED_LAT/LON liggen midden in één cel.
const SEED_LAT = -49.87;
const SEED_LON = 49.87;
// Verse cellen voor gestart/limiet: ruim uit elkaar (0,5° per stap).
function freshCell(i: number): { lat: number; lon: number } {
  return { lat: -47.1, lon: 40.1 + i * 0.5 };
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

const GEOMETRY: [number, number][] = [
  [SEED_LAT, SEED_LON],
  [SEED_LAT + 0.01, SEED_LON + 0.01],
  [SEED_LAT, SEED_LON + 0.02],
  [SEED_LAT, SEED_LON],
];

const seededCellKeys = new Set<string>();
const seededIds: number[] = [];

// Seedt één cel vol (12 rijen = volledige startset: 4 fietstypen × 3
// afstanden) — nodig voor status "klaar" en de bbox-query. Het "klaar"-
// criterium is de VOLLEDIGE set; een lagere drempel telt als niet-vol.
const FULL_SET = 12;
async function seedFullCell(): Promise<void> {
  const cellKey = `${Math.floor(SEED_LAT / 0.25)}:${Math.floor(SEED_LON / 0.25)}`;
  seededCellKeys.add(cellKey);
  const bikes = ["racefiets", "gravel", "mtb", "fiets"] as const;
  for (let i = 0; i < FULL_SET; i++) {
    const [row] = await db
      .insert(routeLibraryTable)
      .values({
        cellKey,
        name: `${RUN} route ${i}`,
        bikeType: bikes[i % bikes.length]!,
        targetKm: 100 + i, // uniek binnen (cel, fietstype, doelafstand)
        startLat: SEED_LAT + i * 0.001,
        startLon: SEED_LON + i * 0.001,
        distanceKm: 20 + i,
        elevationGainM: 50,
        durationSec: 3600,
        geometry: GEOMETRY,
        source: "sparki_auto",
      })
      .onConflictDoNothing()
      .returning({ id: routeLibraryTable.id });
    if (row) seededIds.push(row.id);
  }
}

async function main() {
  await startServer();
  await ensureAccount(userA, `${userA}@test.local`, "Lib A", silentLogger);
  await ensureAccount(userB, `${userB}@test.local`, "Lib B", silentLogger);
  await ensureAccount(userC, `${userC}@test.local`, "Lib C", silentLogger);
  await seedFullCell();
  assert(seededIds.length === FULL_SET, `seed: verwacht ${FULL_SET} bibliotheekroutes`);

  const bboxPath = (q: string) => `/api/routes/bibliotheek?${q}`;
  const tightBbox = `minLat=${SEED_LAT - 0.05}&maxLat=${SEED_LAT + 0.05}&minLon=${SEED_LON - 0.05}&maxLon=${SEED_LON + 0.05}`;

  // ── bbox-validatie ────────────────────────────────────────────────────────
  await scenario("bbox: niet-numerieke parameters geven 400", async () => {
    const { status } = await api(userA, "GET", bboxPath("minLat=abc&maxLat=1&minLon=0&maxLon=1"));
    assert(status === 400, `verwacht 400, kreeg ${status}`);
  });

  await scenario("bbox: ontbrekende parameters geven 400", async () => {
    const { status } = await api(userA, "GET", bboxPath("minLat=0&maxLat=1"));
    assert(status === 400, `verwacht 400, kreeg ${status}`);
  });

  await scenario("bbox: min >= max geeft 400", async () => {
    const lat = await api(userA, "GET", bboxPath("minLat=2&maxLat=1&minLon=0&maxLon=1"));
    assert(lat.status === 400, `lat: verwacht 400, kreeg ${lat.status}`);
    const lon = await api(userA, "GET", bboxPath("minLat=0&maxLat=1&minLon=1&maxLon=1"));
    assert(lon.status === 400, `lon gelijk: verwacht 400, kreeg ${lon.status}`);
  });

  await scenario("bbox: te grote uitsnede (>6° lat of >8° lon) geeft 400", async () => {
    const lat = await api(userA, "GET", bboxPath("minLat=0&maxLat=6.5&minLon=0&maxLon=1"));
    assert(lat.status === 400, `lat-span: verwacht 400, kreeg ${lat.status}`);
    const lon = await api(userA, "GET", bboxPath("minLat=0&maxLat=1&minLon=0&maxLon=8.5"));
    assert(lon.status === 400, `lon-span: verwacht 400, kreeg ${lon.status}`);
  });

  await scenario("bbox: geldige uitsnede levert de geseede routes met contractvelden", async () => {
    const { status, json } = await api(userA, "GET", bboxPath(tightBbox));
    assert(status === 200, `verwacht 200, kreeg ${status}`);
    const ours = (json.routes ?? []).filter((r: any) => seededIds.includes(r.id));
    assert(ours.length === FULL_SET, `verwacht ${FULL_SET} eigen routes, kreeg ${ours.length}`);
    const r = ours[0];
    for (const field of [
      "id", "name", "bikeType", "distanceKm", "elevationGainM",
      "durationSec", "startLat", "startLon", "geometry", "avgRating", "ratingCount",
    ]) {
      assert(field in r, `contractveld ontbreekt: ${field}`);
    }
    assert(Array.isArray(r.geometry) && r.geometry.length >= 2, "geometrie gaat mee");
    assert(r.avgRating === null && r.ratingCount === 0, "vers: geen verzonnen score");
  });

  // ── commentaar-upsert ─────────────────────────────────────────────────────
  const routeId = seededIds[0]!;
  const cPath = (id: number) => `/api/routes/bibliotheek/${id}/commentaar`;

  await scenario("commentaar: score buiten 1–5 geeft 400", async () => {
    const hi = await api(userA, "POST", cPath(routeId), { rating: 9 });
    assert(hi.status === 400, `9: verwacht 400, kreeg ${hi.status}`);
    const lo = await api(userA, "POST", cPath(routeId), { rating: 0 });
    assert(lo.status === 400, `0: verwacht 400, kreeg ${lo.status}`);
  });

  await scenario("commentaar: zonder score én zonder tekst geeft 400", async () => {
    const { status } = await api(userA, "POST", cPath(routeId), {});
    assert(status === 400, `verwacht 400, kreeg ${status}`);
  });

  await scenario("commentaar: onbekende route geeft 404", async () => {
    const { status } = await api(userA, "POST", cPath(999999999), { rating: 4 });
    assert(status === 404, `verwacht 404, kreeg ${status}`);
  });

  await scenario("commentaar: eerste score telt (avg=5, count=1)", async () => {
    const { status, json } = await api(userA, "POST", cPath(routeId), {
      rating: 5,
      comment: "Prachtige lus",
    });
    assert(status === 200, `verwacht 200, kreeg ${status}`);
    assert(json.avgRating === 5, `avg: verwacht 5, kreeg ${json.avgRating}`);
    assert(json.ratingCount === 1, `count: verwacht 1, kreeg ${json.ratingCount}`);
  });

  await scenario("commentaar: zelfde gebruiker opnieuw = upsert (avg=3, count blijft 1, één rij)", async () => {
    const { status, json } = await api(userA, "POST", cPath(routeId), { rating: 3 });
    assert(status === 200, `verwacht 200, kreeg ${status}`);
    assert(json.avgRating === 3, `avg: verwacht 3, kreeg ${json.avgRating}`);
    assert(json.ratingCount === 1, `count: verwacht 1, kreeg ${json.ratingCount}`);
    const rows = await db
      .select()
      .from(routeLibraryCommentsTable)
      .where(
        and(
          eq(routeLibraryCommentsTable.libraryRouteId, routeId),
          eq(routeLibraryCommentsTable.clerkId, userA),
        ),
      );
    assert(rows.length === 1, `verwacht 1 rij voor gebruiker A, kreeg ${rows.length}`);
    assert(rows[0]!.rating === 3, "nieuwste mening telt (rating=3)");
  });

  await scenario("commentaar: tweede gebruiker → herberekend gemiddelde (avg=4, count=2)", async () => {
    const { status, json } = await api(userB, "POST", cPath(routeId), { rating: 5 });
    assert(status === 200, `verwacht 200, kreeg ${status}`);
    assert(json.avgRating === 4, `avg: verwacht 4, kreeg ${json.avgRating}`);
    assert(json.ratingCount === 2, `count: verwacht 2, kreeg ${json.ratingCount}`);
    // De route-rij zelf draagt de herberekende score (rangschikking bbox-query).
    const [row] = await db
      .select()
      .from(routeLibraryTable)
      .where(eq(routeLibraryTable.id, routeId));
    assert(row!.avgRating === 4 && row!.ratingCount === 2, "route-rij bijgewerkt");
  });

  await scenario("commentaar: alleen tekst telt niet mee in score (avg/count ongewijzigd)", async () => {
    const { status, json } = await api(userC, "POST", cPath(routeId), {
      comment: "Mooi maar winderig",
    });
    assert(status === 200, `verwacht 200, kreeg ${status}`);
    assert(json.avgRating === 4, `avg: verwacht 4, kreeg ${json.avgRating}`);
    assert(json.ratingCount === 2, `count: verwacht 2, kreeg ${json.ratingCount}`);
  });

  await scenario("detail: route + commentaar zichtbaar via GET /bibliotheek/:id", async () => {
    const { status, json } = await api(userA, "GET", `/api/routes/bibliotheek/${routeId}`);
    assert(status === 200, `verwacht 200, kreeg ${status}`);
    assert(json.route?.id === routeId, "route in detail");
    assert(json.route.avgRating === 4, "detail draagt herberekende score");
    assert((json.comments ?? []).length === 3, `verwacht 3 commentaren, kreeg ${json.comments?.length}`);
  });

  // ── gebruik (kopie naar eigen routes) ─────────────────────────────────────
  await scenario("gebruik: onbekende route geeft 404", async () => {
    const { status } = await api(userA, "POST", "/api/routes/bibliotheek/999999999/gebruik");
    assert(status === 404, `verwacht 404, kreeg ${status}`);
  });

  await scenario("gebruik: kopie is privé, source=library, eigen eigendom, geometrie mee", async () => {
    const mtbId = seededIds[2]!; // index 2 = mtb (bikes[2])
    const { status, json } = await api(userA, "POST", `/api/routes/bibliotheek/${mtbId}/gebruik`);
    assert(status === 200, `verwacht 200, kreeg ${status}`);
    assert(Number.isInteger(json.routeId), "routeId terug");
    const [row] = await db
      .select()
      .from(routesTable)
      .where(eq(routesTable.id, json.routeId));
    assert(row, "eigen route-rij bestaat");
    assert(row!.clerkId === userA, "eigendom van de kopieerder");
    assert(row!.visibility === "private", "kopie is privé");
    assert(row!.source === "library", "source=library");
    assert(row!.status === "ready", "status=ready");
    assert(row!.surface === "mtb", `mtb → surface mtb, kreeg ${row!.surface}`);
    assert(Array.isArray(row!.geometry) && row!.geometry.length === GEOMETRY.length, "geometrie gekopieerd");
    // B ziet A's kopie niet.
    const other = await api(userB, "GET", `/api/routes/${json.routeId}`);
    assert(other.status === 404, `isolatie: verwacht 404, kreeg ${other.status}`);
  });

  await scenario("gebruik: racefiets → surface asfalt", async () => {
    const raceId = seededIds[0]!; // index 0 = racefiets
    const { status, json } = await api(userB, "POST", `/api/routes/bibliotheek/${raceId}/gebruik`);
    assert(status === 200, `verwacht 200, kreeg ${status}`);
    const [row] = await db
      .select()
      .from(routesTable)
      .where(eq(routesTable.id, json.routeId));
    assert(row!.surface === "asfalt", `racefiets → asfalt, kreeg ${row!.surface}`);
    assert(row!.clerkId === userB, "eigendom van B");
  });

  // ── eerlijk statuscontract van /hier ──────────────────────────────────────
  await scenario("hier: ongeldige locatie geeft 400", async () => {
    const bad = await api(userA, "POST", "/api/routes/bibliotheek/hier", { lat: "x", lon: 5 });
    assert(bad.status === 400, `niet-numeriek: verwacht 400, kreeg ${bad.status}`);
    const range = await api(userA, "POST", "/api/routes/bibliotheek/hier", { lat: 80, lon: 5 });
    assert(range.status === 400, `buiten bereik: verwacht 400, kreeg ${range.status}`);
  });

  await scenario("hier: gevulde cel (≥10 routes) meldt eerlijk 'klaar'", async () => {
    const { status, json } = await api(userA, "POST", "/api/routes/bibliotheek/hier", {
      lat: SEED_LAT,
      lon: SEED_LON,
    });
    assert(status === 200, `verwacht 200, kreeg ${status}`);
    assert(json.status === "klaar", `verwacht 'klaar', kreeg '${json.status}'`);
    assert(json.count >= 10, `count: verwacht ≥10, kreeg ${json.count}`);
  });

  await scenario("hier: verse cel meldt 'gestart' en verzint zonder provider nooit rijen", async () => {
    const { lat, lon } = freshCell(0);
    const { status, json } = await api(userA, "POST", "/api/routes/bibliotheek/hier", { lat, lon });
    assert(status === 200, `verwacht 200, kreeg ${status}`);
    assert(json.status === "gestart", `verwacht 'gestart', kreeg '${json.status}'`);
    assert(json.count === 0, `count: verwacht 0, kreeg ${json.count}`);
    // Achtergrondgeneratie zonder ORS-sleutel slaat eerlijk over: geen rijen.
    await new Promise((r) => setTimeout(r, 300));
    const cellKey = `${Math.floor(lat / 0.25)}:${Math.floor(lon / 0.25)}`;
    const rows = await db
      .select({ id: routeLibraryTable.id })
      .from(routeLibraryTable)
      .where(eq(routeLibraryTable.cellKey, cellKey));
    assert(rows.length === 0, `verwacht 0 verzonnen rijen, kreeg ${rows.length}`);
  });

  await scenario("hier: dagplafond → 11e verse cel meldt eerlijk 'limiet'", async () => {
    // Cel 0 is hierboven al gestart (1/10). Start cel 1..9 → samen 10.
    for (let i = 1; i < 10; i++) {
      const { lat, lon } = freshCell(i);
      const { status, json } = await api(userA, "POST", "/api/routes/bibliotheek/hier", { lat, lon });
      assert(status === 200 && json.status === "gestart", `cel ${i}: verwacht 'gestart', kreeg '${json.json?.status ?? json.status}'`);
    }
    const { lat, lon } = freshCell(10);
    const { status, json } = await api(userA, "POST", "/api/routes/bibliotheek/hier", { lat, lon });
    assert(status === 200, `verwacht 200, kreeg ${status}`);
    assert(json.status === "limiet", `verwacht 'limiet', kreeg '${json.status}'`);
    // Een gevulde cel blijft óók boven het plafond gewoon eerlijk 'klaar'.
    const filled = await api(userA, "POST", "/api/routes/bibliotheek/hier", {
      lat: SEED_LAT,
      lon: SEED_LON,
    });
    assert(filled.json?.status === "klaar", `gevuld boven plafond: verwacht 'klaar', kreeg '${filled.json?.status}'`);
  });

  // ── Cleanup — alleen eigen rijen ─────────────────────────────────────────
  if (seededIds.length > 0) {
    await db
      .delete(routeLibraryTable)
      .where(inArray(routeLibraryTable.id, seededIds)); // cascade ruimt commentaar op
  }
  await db
    .delete(routesTable)
    .where(inArray(routesTable.clerkId, [userA, userB, userC]));
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, [userA, userB, userC]));

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
