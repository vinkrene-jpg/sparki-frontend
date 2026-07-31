// Taak #513 — privacyzones in de routebibliotheek. DB-backed contract test.
//
// Boot de ECHTE Express-app en seedt: eigenaar A (met huisadres) en vriend F.
// Bewijst:
//   • zone-CRUD: aanmaken (validatie label/kind/locatie/straal), lijst,
//     verwijderen; alleen eigen zones verwijderbaar
//   • gedeelde route (persoon-share) toont de kijker NOOIT een punt binnen
//     750 m van het huisadres van de eigenaar
//   • extra zelfbeheerde zone ("werk") maskeert óók punten binnen die straal
//   • eigenaar ziet altijd de originele, ongewijzigde geometrie
//   • fail-closed: geen huisadres én geen zones ⇒ start/einde afgekapt
//   • suggestExclude: PUT-roundtrip, eigenaarskeuze bewaard
//
// Run: `pnpm --filter @workspace/api-server run test:route-privacy-zones`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import {
  db,
  routesTable,
  routeSharesTable,
  privacyZonesTable,
  athleteProfilesTable,
  userProfilesTable,
} from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";
import {
  haversineMeters,
  segmentMinDistanceMeters,
} from "../lib/world-social/location";

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

const OWNER = "test_pz_owner";
const FRIEND = "test_pz_friend";

// Huis van de eigenaar (Utrecht-omgeving) en een "werk"-locatie ~6 km verderop.
const HOME = { lat: 52.09, lon: 5.12 };
const WORK = { lat: 52.13, lon: 5.18 };
const WORK_RADIUS_M = 1000;

// Route van ~14 km die bij huis start, langs werk loopt en bij huis eindigt.
// Punten elke ~90 m zodat trim/zonefilter genoeg resolutie heeft.
function buildGeometry(): [number, number][] {
  const pts: [number, number][] = [];
  const legs: [{ lat: number; lon: number }, { lat: number; lon: number }][] = [
    [HOME, WORK],
    [WORK, HOME],
  ];
  for (const [a, b] of legs) {
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      pts.push([a.lat + (b.lat - a.lat) * t, a.lon + (b.lon - a.lon) * t]);
    }
  }
  return pts;
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
      "content-type": "application/json",
      "x-dev-clerk-id": clerkId,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* leeg antwoord */
  }
  return { status: res.status, json };
}

async function cleanup(): Promise<void> {
  const ids = [OWNER, FRIEND];
  await db
    .delete(privacyZonesTable)
    .where(inArray(privacyZonesTable.clerkId, ids));
  const routes = await db
    .select({ id: routesTable.id })
    .from(routesTable)
    .where(inArray(routesTable.clerkId, ids));
  if (routes.length > 0) {
    await db.delete(routeSharesTable).where(
      inArray(
        routeSharesTable.routeId,
        routes.map((r) => r.id),
      ),
    );
    await db.delete(routesTable).where(inArray(routesTable.clerkId, ids));
  }
}

async function main(): Promise<void> {
  await ensureAccount(OWNER, "pz-owner@test.sparki.local", "PZ Owner", silentLogger);
  await ensureAccount(FRIEND, "pz-friend@test.sparki.local", "PZ Friend", silentLogger);
  await cleanup();

  // Huisadres van de eigenaar zetten.
  await db
    .update(athleteProfilesTable)
    .set({ homeLat: String(HOME.lat), homeLon: String(HOME.lon) })
    .where(eq(athleteProfilesTable.clerkId, OWNER));

  await startServer();

  let routeId = 0;
  let zoneId = 0;

  await scenario("zone aanmaken valideert invoer", async () => {
    const noLabel = await api(OWNER, "POST", "/api/routes/privacyzones", {
      label: " ",
      kind: "werk",
      lat: WORK.lat,
      lon: WORK.lon,
    });
    assert(noLabel.status === 400, `lege naam hoort 400, kreeg ${noLabel.status}`);
    const badKind = await api(OWNER, "POST", "/api/routes/privacyzones", {
      label: "Werk",
      kind: "kantoortuin",
      lat: WORK.lat,
      lon: WORK.lon,
    });
    assert(badKind.status === 400, `fout zonetype hoort 400, kreeg ${badKind.status}`);
    const badRadius = await api(OWNER, "POST", "/api/routes/privacyzones", {
      label: "Werk",
      kind: "werk",
      lat: WORK.lat,
      lon: WORK.lon,
      radiusM: 50,
    });
    assert(badRadius.status === 400, `te kleine straal hoort 400, kreeg ${badRadius.status}`);
    const badLoc = await api(OWNER, "POST", "/api/routes/privacyzones", {
      label: "Werk",
      kind: "werk",
      lat: 123,
      lon: 5,
    });
    assert(badLoc.status === 400, `ongeldige locatie hoort 400, kreeg ${badLoc.status}`);
  });

  await scenario("zone aanmaken + lijst", async () => {
    const created = await api(OWNER, "POST", "/api/routes/privacyzones", {
      label: "Werk",
      kind: "werk",
      lat: WORK.lat,
      lon: WORK.lon,
      radiusM: WORK_RADIUS_M,
    });
    assert(created.status === 201, `aanmaken hoort 201, kreeg ${created.status}`);
    zoneId = created.json.zone.id;
    const list = await api(OWNER, "GET", "/api/routes/privacyzones");
    assert(list.status === 200, `lijst hoort 200, kreeg ${list.status}`);
    assert(list.json.zones.length === 1, "lijst hoort precies 1 zone te tonen");
    assert(list.json.thuisBeschermd === true, "thuisBeschermd hoort true te zijn");
    assert(
      list.json.zones[0].radiusM === WORK_RADIUS_M,
      "straal hoort bewaard te blijven",
    );
  });

  await scenario("route delen met vriend (persoon-share)", async () => {
    const [route] = await db
      .insert(routesTable)
      .values({
        clerkId: OWNER,
        name: "Testroute privacyzones",
        source: "ridden",
        surface: "asfalt",
        geometry: buildGeometry(),
        distanceKm: 14,
      })
      .returning({ id: routesTable.id });
    routeId = route!.id;
    const share = await api(OWNER, "POST", `/api/routes/${routeId}/delen`, {
      audience: "persoon",
      targetClerkId: FRIEND,
    });
    assert(
      share.status === 200 || share.status === 201,
      `delen hoort te lukken, kreeg ${share.status}`,
    );
  });

  await scenario("kijker ziet nooit een punt bij huis óf werkzone", async () => {
    const res = await api(FRIEND, "GET", `/api/routes/${routeId}`);
    assert(res.status === 200, `gedeelde route hoort 200, kreeg ${res.status}`);
    const geom = res.json.route.geometry as [number, number][] | null;
    assert(Array.isArray(geom) && geom.length > 0, "kijker hoort een (gemaskeerde) lijn te zien");
    for (const [lat, lon] of geom!) {
      const dHome = haversineMeters({ lat, lon }, HOME);
      const dWork = haversineMeters({ lat, lon }, WORK);
      assert(dHome > 750, `punt op ${Math.round(dHome)} m van huis gelekt`);
      assert(dWork > WORK_RADIUS_M, `punt op ${Math.round(dWork)} m van werkzone gelekt`);
    }
    // Ook geen LIJNSTUK mag door een zone lopen (kaart trekt rechte lijnen
    // tussen opeenvolgende punten).
    for (let i = 1; i < geom!.length; i++) {
      const a = { lat: geom![i - 1]![0], lon: geom![i - 1]![1] };
      const b = { lat: geom![i]![0], lon: geom![i]![1] };
      assert(
        segmentMinDistanceMeters(a, b, HOME) > 750,
        "lijnstuk snijdt de huiszone",
      );
      assert(
        segmentMinDistanceMeters(a, b, WORK) > WORK_RADIUS_M,
        "lijnstuk snijdt de werkzone",
      );
    }
    assert(res.json.route.nav === null, "nav hoort null voor kijkers");
    assert(res.json.route.profile === null, "profiel hoort null voor kijkers");
    assert(
      typeof res.json.route.privacyNote === "string",
      "privacyNote hoort aanwezig te zijn",
    );
  });

  await scenario("eigenaar ziet de originele geometrie onaangetast", async () => {
    const res = await api(OWNER, "GET", `/api/routes/${routeId}`);
    assert(res.status === 200, `eigen route hoort 200, kreeg ${res.status}`);
    const geom = res.json.route.geometry as [number, number][];
    assert(
      geom.length === buildGeometry().length,
      "eigenaar hoort ALLE punten te zien (geen maskering)",
    );
    const [lat0, lon0] = geom[0]!;
    assert(
      haversineMeters({ lat: lat0, lon: lon0 }, HOME) < 50,
      "eigen startpunt hoort exact bij huis te liggen",
    );
  });

  await scenario("vreemde kan andermans zone niet verwijderen", async () => {
    const res = await api(FRIEND, "DELETE", `/api/routes/privacyzones/${zoneId}`);
    assert(res.status === 404, `andermans zone hoort 404, kreeg ${res.status}`);
    const still = await api(OWNER, "GET", "/api/routes/privacyzones");
    assert(still.json.zones.length === 1, "zone hoort te blijven bestaan");
  });

  await scenario("fail-closed zonder huisadres en zonder zones", async () => {
    // Huisadres én zone tijdelijk weg ⇒ kijker krijgt in elk geval een track
    // zonder de exacte start (eerste ~500 m afgekapt).
    await db
      .update(athleteProfilesTable)
      .set({ homeLat: null, homeLon: null })
      .where(eq(athleteProfilesTable.clerkId, OWNER));
    await db
      .delete(privacyZonesTable)
      .where(eq(privacyZonesTable.clerkId, OWNER));
    const res = await api(FRIEND, "GET", `/api/routes/${routeId}`);
    assert(res.status === 200, `gedeelde route hoort 200, kreeg ${res.status}`);
    const geom = res.json.route.geometry as [number, number][] | null;
    assert(Array.isArray(geom) && geom.length > 0, "kijker hoort een lijn te zien");
    const [lat0, lon0] = geom![0]!;
    assert(
      haversineMeters({ lat: lat0, lon: lon0 }, HOME) > 400,
      "start hoort ook zonder huisadres afgekapt te zijn (fail-closed)",
    );
    // Herstellen voor volgende scenario's.
    await db
      .update(athleteProfilesTable)
      .set({ homeLat: String(HOME.lat), homeLon: String(HOME.lon) })
      .where(eq(athleteProfilesTable.clerkId, OWNER));
  });

  await scenario("suggestExclude PUT-roundtrip", async () => {
    const on = await api(OWNER, "PUT", `/api/routes/${routeId}`, {
      suggestExclude: true,
    });
    assert(on.status === 200, `PUT hoort 200, kreeg ${on.status}`);
    assert(on.json.route.suggestExclude === true, "suggestExclude hoort true");
    const [row] = await db
      .select({ suggestExclude: routesTable.suggestExclude })
      .from(routesTable)
      .where(eq(routesTable.id, routeId));
    assert(row!.suggestExclude === true, "kolom hoort true in de database");
    const off = await api(OWNER, "PUT", `/api/routes/${routeId}`, {
      suggestExclude: false,
    });
    assert(off.json.route.suggestExclude === false, "terugzetten hoort te werken");
  });

  await scenario("eigen zone verwijderen", async () => {
    // Zone was al verwijderd in het fail-closed scenario — opnieuw aanmaken.
    const created = await api(OWNER, "POST", "/api/routes/privacyzones", {
      label: "Werk",
      kind: "werk",
      lat: WORK.lat,
      lon: WORK.lon,
      radiusM: WORK_RADIUS_M,
    });
    assert(created.status === 201, "heraanmaken hoort te lukken");
    const del = await api(
      OWNER,
      "DELETE",
      `/api/routes/privacyzones/${created.json.zone.id}`,
    );
    assert(del.status === 200, `verwijderen hoort 200, kreeg ${del.status}`);
    const list = await api(OWNER, "GET", "/api/routes/privacyzones");
    assert(list.json.zones.length === 0, "lijst hoort leeg te zijn");
  });

  await stopServer();
  await cleanup();
  await db
    .delete(athleteProfilesTable)
    .where(inArray(athleteProfilesTable.clerkId, [OWNER, FRIEND]));
  await db
    .delete(userProfilesTable)
    .where(inArray(userProfilesTable.clerkId, [OWNER, FRIEND]));

  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✓" : "✗";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  console.log(
    `\n${results.length - failed}/${results.length} scenario's geslaagd`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("test run failed:", err);
  process.exit(1);
});
