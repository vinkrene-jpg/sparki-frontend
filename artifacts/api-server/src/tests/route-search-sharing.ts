// Integratietest: gedeelde routes in de route-zoeklaag (POST /api/routes/zoek).
//
// Bewijst de fail-closed autorisatie- en privacycontracten op het ECHTE
// endpoint, met echte DB-rijen:
//  1. Route van een VOLWASSEN eigenaar, persoonlijk met de kijker gedeeld,
//     verschijnt in de zoekresultaten — met herkomst "gedeeld" en de veilige
//     kijkersgeometrie (nooit het exacte startpunt van de eigenaar).
//  2. Route van een MINDERJARIGE eigenaar (<16) verschijnt NOOIT in andermans
//     zoekresultaten, óók niet met een expliciete persoon-deling (fail-closed,
//     zelfde contract als /gedeeld).
//  3. Route van een eigenaar ZONDER huisadres verschijnt NOOIT — zonder
//     huisadres is geen veilige kijkersgeometrie te garanderen (fail-closed).
//  4. Route van een eigenaar met ONBEKENDE leeftijd verschijnt NOOIT —
//     alleen aantoonbaar volwassen eigenaren tellen (fail-closed).
//  5. Een niet-gedeelde route van een ander verschijnt nooit (isolatie).
//
// Boot: het echte Express-app-object op een vrije poort, dev-bypass met
// x-dev-clerk-id per actor (zelfde patroon als cross-account-isolation).
//
// Run: `pnpm --filter @workspace/api-server run test:route-search-sharing`

import type { Server } from "node:http";
import {
  db,
  pool,
  routesTable,
  routeSharesTable,
  athleteProfilesTable,
  userProfilesTable,
  type RoutePathPoint,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";

let failures = 0;
function assert(cond: boolean, label: string) {
  if (cond) console.log(`  ✓ ${label}`);
  else {
    failures += 1;
    console.error(`  ✗ ${label}`);
  }
}

let server: Server;
let baseUrl = "";

async function req(
  method: string,
  path: string,
  actor: string,
  body?: unknown,
): Promise<{ status: number; json: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": actor,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* leeg */
  }
  return { status: res.status, json };
}

// Lus rond een middelpunt — start = einde, dicht bij de kijker.
const HOME = { lat: 52.156, lon: 5.387 };
function makeLoop(radiusDeg: number, n = 60): RoutePathPoint[] {
  const pts: RoutePathPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (2 * Math.PI * i) / n;
    pts.push([
      HOME.lat + radiusDeg * Math.sin(a),
      HOME.lon + radiusDeg * Math.cos(a),
    ] as RoutePathPoint);
  }
  return pts;
}

const VIEWER = "test-zoek-viewer";
const ADULT = "test-zoek-adult-owner";
const MINOR = "test-zoek-minor-owner";
const NOHOME = "test-zoek-nohome-owner";
const UNKNOWNAGE = "test-zoek-unknownage-owner";
const ACTORS = [VIEWER, ADULT, MINOR, NOHOME, UNKNOWNAGE];

const createdRouteIds: number[] = [];

async function seedRoute(
  clerkId: string,
  name: string,
  shareWith: string | null,
): Promise<number> {
  const [r] = await db
    .insert(routesTable)
    .values({
      clerkId,
      name,
      surface: "asfalt",
      status: "ready",
      visibility: "private",
      distanceKm: 40,
      elevationGainM: 120,
      durationSec: 5400,
      geometry: makeLoop(0.05),
      source: "manual",
    })
    .returning({ id: routesTable.id });
  createdRouteIds.push(r!.id);
  if (shareWith) {
    await db.insert(routeSharesTable).values({
      routeId: r!.id,
      audience: "persoon",
      targetClerkId: shareWith,
      ownerClerkId: clerkId,
    });
  }
  return r!.id;
}

async function main() {
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => {
      if (err) return reject(err);
      const addr = server.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });

  // ── Seed accounts ──────────────────────────────────────────────────────────
  for (const id of ACTORS) {
    const p = await ensureAccount(id, `${id}@test.local`, id, silentLogger);
    if (!p) throw new Error(`kon account ${id} niet aanmaken`);
  }
  // Huisadres voor privacyzone (volwassene + minderjarige); NOHOME bewust niet.
  await db
    .update(athleteProfilesTable)
    .set({ homeLat: String(HOME.lat), homeLon: String(HOME.lon) })
    .where(
      inArray(athleteProfilesTable.clerkId, [ADULT, MINOR, VIEWER, UNKNOWNAGE]),
    );
  // Minderjarig: 14 jaar.
  const minorYear = new Date().getFullYear() - 14;
  await db
    .update(athleteProfilesTable)
    .set({ birthDate: `${minorYear}-01-15` })
    .where(eq(athleteProfilesTable.clerkId, MINOR));
  // Volwassen: 34 jaar.
  const adultYear = new Date().getFullYear() - 34;
  await db
    .update(athleteProfilesTable)
    .set({ birthDate: `${adultYear}-01-15` })
    .where(inArray(athleteProfilesTable.clerkId, [ADULT, NOHOME]));

  // ── Seed routes ────────────────────────────────────────────────────────────
  const adultShared = await seedRoute(ADULT, "Volwassen gedeelde lus", VIEWER);
  const minorShared = await seedRoute(MINOR, "Minderjarige gedeelde lus", VIEWER);
  const noHomeShared = await seedRoute(NOHOME, "Zonder-huis gedeelde lus", VIEWER);
  // UNKNOWNAGE: wél huisadres, géén geboortedatum/-jaar (ensureAccount zet die
  // niet) — leeftijd onbekend ⇒ fail-closed.
  const unknownAgeShared = await seedRoute(
    UNKNOWNAGE,
    "Onbekende-leeftijd gedeelde lus",
    VIEWER,
  );
  const notShared = await seedRoute(ADULT, "Niet-gedeelde lus", null);

  try {
    console.log("— POST /api/routes/zoek als kijker —");
    const r = await req("POST", "/api/routes/zoek", VIEWER, {
      mode: "loop",
      startLat: HOME.lat,
      startLon: HOME.lon,
      targetDistanceKm: 40,
      sport: "cycling",
    });
    assert(r.status === 200, `endpoint antwoordt 200 (kreeg ${r.status})`);
    const bekend: any[] = Array.isArray(r.json?.bekend) ? r.json.bekend : [];
    const ids = bekend.map((b) => b.routeId);

    const adultHit = bekend.find((b) => b.routeId === adultShared);
    assert(
      adultHit != null,
      "route van volwassen eigenaar (persoon-deling) verschijnt",
    );
    assert(
      adultHit?.origin === "gedeeld" &&
        typeof adultHit?.originLabel === "string",
      "herkomst 'gedeeld' + label aanwezig",
    );
    // Privacy: de geleverde geometrie is de kijkersweergave — het exacte
    // start-/eindpunt van de eigenaar (= eerste punt van de ruwe lus) mag er
    // niet exact in voorkomen (start/einde afgekapt of privacyzone).
    if (adultHit) {
      const raw0 = makeLoop(0.05)[0]!;
      const exposesStart = (adultHit.geometry as [number, number][]).some(
        (p) => Math.abs(p[0] - raw0[0]) < 1e-9 && Math.abs(p[1] - raw0[1]) < 1e-9,
      );
      assert(!exposesStart, "kijkersgeometrie lekt het exacte startpunt niet");
    }

    assert(
      !ids.includes(minorShared),
      "route van MINDERJARIGE eigenaar verschijnt NOOIT (fail-closed)",
    );
    assert(
      !ids.includes(noHomeShared),
      "route van eigenaar ZONDER huisadres verschijnt nooit (fail-closed)",
    );
    assert(
      !ids.includes(unknownAgeShared),
      "route van eigenaar met ONBEKENDE leeftijd verschijnt nooit (fail-closed)",
    );
    assert(
      !ids.includes(notShared),
      "niet-gedeelde route van een ander verschijnt nooit (isolatie)",
    );

    // Eigenaar zelf: eigen route verschijnt als eigen (niet 'gedeeld').
    const rOwn = await req("POST", "/api/routes/zoek", ADULT, {
      mode: "loop",
      startLat: HOME.lat,
      startLon: HOME.lon,
      targetDistanceKm: 40,
      sport: "cycling",
    });
    const eigen: any[] = Array.isArray(rOwn.json?.bekend) ? rOwn.json.bekend : [];
    assert(
      eigen.some(
        (b) => b.routeId === adultShared && b.ownership === "eigen",
      ),
      "eigenaar ziet zijn eigen route als 'eigen' (positieve controle)",
    );
  } finally {
    // ── Cleanup: alleen wat deze test aanmaakte ──────────────────────────────
    if (createdRouteIds.length > 0) {
      await db
        .delete(routeSharesTable)
        .where(inArray(routeSharesTable.routeId, createdRouteIds));
      await db
        .delete(routesTable)
        .where(inArray(routesTable.id, createdRouteIds));
    }
    await db
      .delete(athleteProfilesTable)
      .where(inArray(athleteProfilesTable.clerkId, ACTORS));
    await db
      .delete(userProfilesTable)
      .where(inArray(userProfilesTable.clerkId, ACTORS));
    server?.close();
    await pool.end();
  }

  console.log(
    failures === 0
      ? "\nAlle zoeklaag-deelcontract-tests geslaagd."
      : `\n${failures} test(s) GEFAALD.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
