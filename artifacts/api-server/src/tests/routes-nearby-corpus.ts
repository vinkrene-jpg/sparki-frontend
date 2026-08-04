// Kaart-eerst routevoorstellen (taak #560) — DB-backed corpus-volledigheids-
// test voor GET /api/routes/nearby. Bewaakt de kernbelofte "het hele corpus":
// een OUDE route dichtbij mag NOOIT stil verdrongen worden door grote
// aantallen NIEUWERE routes verder weg. De implementatie mag daarom pas ná de
// afstandsranking afkappen; de ophaal loopt met bbox-voorselectie + volledige
// paginering (pagina's van 500) over elke bron.
//
// Scenario's:
//  1. eigen routes: 520 nieuwere routes op ~100 km (binnen de ophaal-bbox,
//     buiten de straal — dus dwars door twee ophaalpagina's heen) + 1 oudere
//     route dichtbij ⇒ de oude route dichtbij wordt geleverd, de verre niet;
//  2. kandidaten: 220 nieuwere kandidaten ver weg + 1 oudere dichtbij ⇒ idem;
//  3. de verre rijen verschijnen wél bij een grote straal (bewijs dat ze echt
//     opgehaald zijn en alleen door de afstandscheck afvielen).
//
// Boots de echte Express-app; schrijft alleen eigen wegwerp-rijen en ruimt op.
// Run: `pnpm --filter @workspace/api-server run test:routes-nearby-corpus`
// (vereist DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true).

import type { Server } from "node:http";
import {
  db,
  pool,
  routesTable,
  routeCandidatesTable,
  userProfilesTable,
  type RoutePathPoint,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";

const CLERK_ID = "test_nearby_corpus_user";
const CENTER = { lat: 52.266, lon: 6.793 }; // Hengelo
const FAR = { lat: 53.16, lon: 6.8 }; // ~100 km noordelijk: binnen bbox (straal
// 25 + marge 150), buiten straal 25.

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

function lusRond(c: { lat: number; lon: number }, straalKm = 1.5): RoutePathPoint[] {
  const pts: RoutePathPoint[] = [];
  for (let i = 0; i <= 8; i++) {
    const hoek = (i / 8) * 2 * Math.PI;
    pts.push([
      c.lat + (Math.cos(hoek) * straalKm) / 111.19,
      c.lon + (Math.sin(hoek) * straalKm) / (111.19 * Math.cos((c.lat * Math.PI) / 180)),
    ]);
  }
  return pts;
}

let server: Server | null = null;
let baseUrl = "";
async function startServer() {
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => {
      if (err) return reject(err);
      const addr = server!.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      } else reject(new Error("geen serverpoort"));
    });
  });
}

async function nearby(query: string) {
  const res = await fetch(`${baseUrl}/api/routes/nearby?${query}`, {
    headers: { "x-dev-clerk-id": CLERK_ID },
  });
  assert(res.ok, `nearby gaf ${res.status}`);
  return (await res.json()) as {
    total: number;
    afgekapt: boolean;
    routes: { key: string; bron: string; naam: string }[];
  };
}

let nearbyRouteId = 0;
let nearbyCandidateId = 0;
let doorkruisendeRouteId = 0;

// Noord-zuid-lijn die ver buiten de bbox start maar dwars door `via` loopt
// (punten ± 1 km uit elkaar, zoals echte sporen).
function doorkruisendeLijn(
  startLat: number,
  endLat: number,
  lon: number,
): RoutePathPoint[] {
  const pts: RoutePathPoint[] = [];
  const n = Math.max(2, Math.round(Math.abs(endLat - startLat) * 111));
  for (let i = 0; i <= n; i++) {
    pts.push([startLat + ((endLat - startLat) * i) / n, lon]);
  }
  return pts;
}

async function seed() {
  await ensureAccount(CLERK_ID, "nearby-corpus@test.local", "Nearby Corpus", silentLogger);

  // Oudere route DICHTBIJ eerst (laagste id = oudste rij).
  const [oud] = await db
    .insert(routesTable)
    .values({
      clerkId: CLERK_ID,
      name: "Oude route dichtbij",
      geometry: lusRond(CENTER),
      distanceKm: 12,
      elevationGainM: 40,
      surface: "asfalt",
      sport: "cycling",
      createdAt: new Date("2024-01-01T10:00:00Z"),
    })
    .returning({ id: routesTable.id });
  nearbyRouteId = oud!.id;

  // Route die ~330 km noordelijk start (ver buiten bbox-marge) maar dwars
  // door het zoekcentrum loopt — moet gewoon meetellen.
  const [kruisend] = await db
    .insert(routesTable)
    .values({
      clerkId: CLERK_ID,
      name: "Doorkruisende route van ver",
      geometry: doorkruisendeLijn(55.23, 51.3, CENTER.lon),
      distanceKm: 437,
      elevationGainM: 900,
      surface: "asfalt",
      sport: "cycling",
    })
    .returning({ id: routesTable.id });
  doorkruisendeRouteId = kruisend!.id;

  // 520 nieuwere routes VER weg (meer dan één ophaalpagina van 500).
  const batch: (typeof routesTable.$inferInsert)[] = [];
  for (let i = 0; i < 520; i++) {
    batch.push({
      clerkId: CLERK_ID,
      name: `Verre route ${i}`,
      geometry: lusRond(FAR),
      distanceKm: 30,
      elevationGainM: 100,
      surface: "asfalt",
      sport: "cycling",
    });
  }
  for (let i = 0; i < batch.length; i += 100) {
    await db.insert(routesTable).values(batch.slice(i, i + 100));
  }

  // Oudere kandidaat dichtbij + 220 nieuwere kandidaten ver weg.
  const track = lusRond(CENTER);
  const [kand] = await db
    .insert(routeCandidatesTable)
    .values({
      clerkId: CLERK_ID,
      fingerprint: "nearby-corpus-dichtbij",
      geometry: track,
      cells: ["c0"],
      startLat: CENTER.lat,
      startLon: CENTER.lon,
      endLat: CENTER.lat,
      endLon: CENTER.lon,
      isLoop: true,
      distanceKm: 15,
      elevationM: 60,
      sport: "cycling",
    })
    .returning({ id: routeCandidatesTable.id });
  nearbyCandidateId = kand!.id;
  const farTrack = lusRond(FAR);
  const kandBatch: (typeof routeCandidatesTable.$inferInsert)[] = [];
  for (let i = 0; i < 220; i++) {
    kandBatch.push({
      clerkId: CLERK_ID,
      fingerprint: `nearby-corpus-ver-${i}`,
      geometry: farTrack,
      cells: ["c1"],
      startLat: FAR.lat,
      startLon: FAR.lon,
      endLat: FAR.lat,
      endLon: FAR.lon,
      isLoop: true,
      distanceKm: 20,
      elevationM: 80,
      sport: "cycling",
    });
  }
  for (let i = 0; i < kandBatch.length; i += 100) {
    await db.insert(routeCandidatesTable).values(kandBatch.slice(i, i + 100));
  }
}

async function cleanup() {
  await db.delete(routeCandidatesTable).where(eq(routeCandidatesTable.clerkId, CLERK_ID));
  await db.delete(routesTable).where(eq(routesTable.clerkId, CLERK_ID));
  await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, CLERK_ID));
}

async function main() {
  await startServer();
  await cleanup(); // restanten van een eerdere afgebroken run
  await seed();

  await scenario(
    "oude eigen route dichtbij wordt geleverd ondanks 520 nieuwere routes ver weg",
    async () => {
      const res = await nearby(
        `lat=${CENTER.lat}&lon=${CENTER.lon}&sport=cycling&radiusKm=25`,
      );
      assert(
        res.routes.some((r) => r.key === `route-${nearbyRouteId}`),
        "oude route dichtbij ontbreekt in het antwoord (afgekapt vóór de ranking?)",
      );
      assert(
        !res.routes.some((r) => r.naam.startsWith("Verre route")),
        "route buiten de straal lekte door",
      );
    },
  );

  await scenario(
    "route die ver buiten de bbox start maar door het zoekgebied loopt telt mee",
    async () => {
      const res = await nearby(
        `lat=${CENTER.lat}&lon=${CENTER.lon}&sport=cycling&radiusKm=25`,
      );
      const rij = res.routes.find(
        (r) => r.key === `route-${doorkruisendeRouteId}`,
      );
      assert(
        rij,
        "doorkruisende route (start ~330 km ver) ontbreekt — voorselectie strept op startpunt",
      );
    },
  );

  await scenario(
    "oude kandidaat dichtbij wordt geleverd ondanks 220 nieuwere kandidaten ver weg",
    async () => {
      const res = await nearby(
        `lat=${CENTER.lat}&lon=${CENTER.lon}&sport=cycling&radiusKm=25`,
      );
      assert(
        res.routes.some((r) => r.key === `kandidaat-${nearbyCandidateId}`),
        "oude kandidaat dichtbij ontbreekt in het antwoord",
      );
    },
  );

  await scenario(
    "verre rijen zijn écht opgehaald: bij straal 100 km + afkapmelding kloppen ze",
    async () => {
      const res = await nearby(
        `lat=${FAR.lat}&lon=${FAR.lon}&sport=cycling&radiusKm=25`,
      );
      // Rond het verre punt staan 520 routes + 220 kandidaten binnen de
      // straal ⇒ meer dan het leverplafond van 250: total is eerlijk volledig
      // en afgekapt=true.
      assert(res.total >= 740, `total te laag (${res.total}) — bron niet volledig doorbladerd`);
      assert(res.afgekapt === true, "afkap boven het leverplafond niet eerlijk gemeld");
      assert(res.routes.length === 250, `leverplafond niet toegepast (${res.routes.length})`);
    },
  );

  await cleanup();
  await new Promise<void>((resolve) => server!.close(() => resolve()));
  await pool.end();

  let failures = 0;
  for (const r of results) {
    if (r.status === "pass") console.log(`  ok: ${r.scenario}`);
    else {
      failures += 1;
      console.error(`  FAIL: ${r.scenario} — ${r.note}`);
    }
  }
  if (failures > 0) {
    console.error(`\n${failures} scenario('s) gefaald`);
    process.exit(1);
  }
  console.log("\nAlle corpus-scenario's geslaagd");
}

main().catch(async (err) => {
  console.error("testrun faalde:", err);
  try {
    await cleanup();
  } catch {}
  process.exit(1);
});
