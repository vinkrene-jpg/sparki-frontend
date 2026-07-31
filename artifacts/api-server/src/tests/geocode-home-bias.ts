// Bewaakt taak #526: GET /api/routes/geocode is woonplaats-bewust en mag
// nooit meer verre naamgenoten voorstellen wanneer er een geloofwaardige
// kandidaat dichtbij is (bewijs live: "Hengelo" gaf eerst Hengelo Indonesië).
//
// Bewaakte grenzen (mock-geocodeprovider, geen netwerk):
//  1. zonder huisadres blijft de providervolgorde ONGEWIJZIGD (geen sortering,
//     geen filter — we weten immers niet wat "dichtbij" is)
//  2. met huisadres: dichtstbijzijnde naamgenoot voorop, kandidaat >2000 km
//     vervalt zodra er een geloofwaardige kandidaat ≤300 km is; en het
//     huisadres wordt als focus-punt aan de provider doorgegeven
//  3. zonder kandidaat ≤300 km (trainingskamp-zoekopdracht) blijven verre
//     kandidaten gewoon staan — eerlijk: misschien zoekt de renner echt ver weg
//
// Run: `pnpm --filter @workspace/api-server run test:geocode-home-bias`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true.

import type { Server } from "node:http";
import { db, pool, userProfilesTable, athleteProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { ensureAccount, silentLogger } from "../lib/account";
import {
  registerProvider,
  type RoutingProvider,
  type GeocodeResult,
  type LatLon,
} from "../lib/routing";

// ── Mock-provider ────────────────────────────────────────────────────────────
// Vaste kandidatensets in een BEWUST ongunstige providervolgorde (verste
// eerst), zodat elke her-sortering door de route zelf toetsbaar is.

// Huisadres van de testrenner: Deventer (NL).
const HOME = { lat: 52.25, lon: 6.16 };

// "Hengelo": Indonesië (~11.000 km), Hengelo OV (~25 km), Hengelo GLD (~30 km).
const HENGELO: GeocodeResult[] = [
  { lat: -7.05, lon: 110.35, label: "Hengelo, Indonesië" },
  { lat: 52.27, lon: 6.79, label: "Hengelo, Overijssel, Nederland" },
  { lat: 52.05, lon: 6.32, label: "Hengelo, Gelderland, Nederland" },
];

// "Girona"-achtige trainingskampzoekopdracht: ALLES >300 km van huis; de
// verste (>2000 km, Teide) moet dan gewoon blijven staan.
const TRAININGSKAMP: GeocodeResult[] = [
  { lat: 28.27, lon: -16.64, label: "Teide, Tenerife, Spanje" }, // ~3300 km
  { lat: 41.98, lon: 2.82, label: "Girona, Spanje" }, // ~1200 km
];

let lastQuery = "";
let lastFocus: LatLon | undefined;

const mockProvider = {
  name: "mock",
  supportedProfiles: ["cycling-regular"],
  isConfigured: () => true,
  geocode: async () => null,
  reverseGeocode: async () => null,
  geocodeSearch: async (
    text: string,
    _limit?: number,
    focus?: LatLon,
  ): Promise<GeocodeResult[]> => {
    lastQuery = text;
    lastFocus = focus;
    if (/hengelo/i.test(text)) return [...HENGELO];
    if (/trainingskamp/i.test(text)) return [...TRAININGSKAMP];
    return [];
  },
} as unknown as RoutingProvider;

registerProvider("mock", mockProvider);
process.env.ROUTING_PROVIDER = "mock";

const { default: app } = await import("../app");

// ── Harnas ───────────────────────────────────────────────────────────────────
type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ scenario: name, status: "pass" });
    console.log(`[PASS] ${name}`);
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
    console.log(`[FAIL] ${name} — ${err instanceof Error ? err.message : err}`);
  }
}

const RUN = `test_geocode_${Date.now()}`;
const userId = `${RUN}_user`;

let baseUrl = "";
let server: Server | null = null;

async function startServer(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server = (app as import("express").Express).listen(0, (err?: Error) => {
      if (err) return reject(err);
      const addr = server!.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      } else reject(new Error("could not determine server port"));
    });
  });
}

async function stopServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
}

async function cleanup(): Promise<void> {
  await db
    .delete(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, userId));
  await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, userId));
}

async function geocode(q: string): Promise<{ status: number; labels: string[] }> {
  const res = await fetch(
    `${baseUrl}/api/routes/geocode?q=${encodeURIComponent(q)}`,
    { headers: { "x-dev-clerk-id": userId } },
  );
  const body = (await res.json()) as { results?: { label: string }[] };
  return { status: res.status, labels: (body.results ?? []).map((r) => r.label) };
}

async function setHome(lat: number | null, lon: number | null): Promise<void> {
  await db
    .insert(athleteProfilesTable)
    .values({
      clerkId: userId,
      homeLat: lat == null ? null : String(lat),
      homeLon: lon == null ? null : String(lon),
    })
    .onConflictDoUpdate({
      target: athleteProfilesTable.clerkId,
      set: {
        homeLat: lat == null ? null : String(lat),
        homeLon: lon == null ? null : String(lon),
      },
    });
}

// ── Scenario's ───────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  await cleanup();
  await startServer();

  await scenario("precondition: dev user kan inloggen (dev bypass)", async () => {
    await ensureAccount(userId, `${userId}@example.test`, "GeoTest", silentLogger);
    const { status } = await geocode("He"); // korte query, mag gewoon 200 zijn
    assert(status === 200,
      `expected 200 via dev bypass, got ${status} — NODE_ENV!=production en DEV_AUTH_BYPASS=true vereist`);
  });

  await scenario(
    "zonder huisadres blijft de providervolgorde ONGEWIJZIGD (geen sortering, geen filter)",
    async () => {
      await setHome(null, null);
      const { status, labels } = await geocode("Hengelo");
      assert(status === 200, `expected 200, got ${status}`);
      assert(
        JSON.stringify(labels) === JSON.stringify(HENGELO.map((h) => h.label)),
        `volgorde moet exact de providervolgorde zijn, kreeg: ${labels.join(" | ")}`,
      );
      assert(lastFocus === undefined,
        "zonder huisadres mag er geen focus-punt aan de provider worden doorgegeven");
    },
  );

  await scenario(
    "met huisadres: dichtstbijzijnde naamgenoot voorop en kandidaat >2000 km vervalt",
    async () => {
      await setHome(HOME.lat, HOME.lon);
      const { status, labels } = await geocode("Hengelo");
      assert(status === 200, `expected 200, got ${status}`);
      assert(!labels.some((l) => l.includes("Indonesië")),
        `Hengelo Indonesië (>2000 km) moet vervallen, kreeg: ${labels.join(" | ")}`);
      assert(labels.length === 2, `verwacht 2 NL-kandidaten, kreeg ${labels.length}`);
      // Vanuit Deventer is Hengelo (GLD, ~25 km) dichterbij dan Hengelo
      // (OV, ~43 km) — de providervolgorde had OV vóór GLD, dus dit toetst
      // dat er echt op afstand-tot-huis wordt gesorteerd.
      assert(labels[0] === "Hengelo, Gelderland, Nederland",
        `dichtstbijzijnde (Gelderland, ~25 km) moet voorop, kreeg: ${labels[0]}`);
      assert(labels[1] === "Hengelo, Overijssel, Nederland",
        `tweede moet Overijssel (~43 km) zijn, kreeg: ${labels[1]}`);
      assert(
        lastFocus != null &&
          Math.abs(lastFocus.lat - HOME.lat) < 1e-9 &&
          Math.abs(lastFocus.lon - HOME.lon) < 1e-9,
        "het huisadres moet als focus-punt aan de provider worden doorgegeven",
      );
      assert(lastQuery === "Hengelo", "query moet ongewijzigd doorgaan naar de provider");
    },
  );

  await scenario(
    "zonder kandidaat ≤300 km (trainingskamp) blijven verre kandidaten staan",
    async () => {
      await setHome(HOME.lat, HOME.lon);
      const { status, labels } = await geocode("trainingskamp Teide");
      assert(status === 200, `expected 200, got ${status}`);
      assert(labels.length === 2,
        `beide verre kandidaten moeten blijven staan, kreeg ${labels.length}: ${labels.join(" | ")}`);
      assert(labels.includes("Teide, Tenerife, Spanje"),
        "ook de kandidaat >2000 km (Teide) moet blijven staan — er is niets ≤300 km");
      assert(labels.includes("Girona, Spanje"), "Girona moet blijven staan");
    },
  );

  await stopServer();
  await cleanup();

  const failed = results.filter((r) => r.status === "fail");
  console.log(
    `\n${results.length - failed.length}/${results.length} scenario's geslaagd`,
  );
  if (failed.length > 0) {
    for (const f of failed) console.log(`  FAIL: ${f.scenario} — ${f.note}`);
    process.exitCode = 1;
  }
}

try {
  await run();
} finally {
  await pool.end();
}
