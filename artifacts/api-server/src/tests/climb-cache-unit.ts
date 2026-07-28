// Klimmenverkenner — hermetische unit-test op het eerlijkheidscontract van de
// DB-cachelaag (lib/climbs/cache.ts + gebruik in lib/climbs/index.ts):
//
//   1. Een geldige (verse) cache-rij wordt gebruikt — geen live fetch.
//   2. Een verlopen rij (TTL voorbij) wordt genegeerd — een verse échte fetch
//      volgt, zodat een cache-hit nooit stiekem verouderde data kan tonen.
//   3. Een DB-fout is nooit fataal — alles valt terug op de live bron.
//   4. CLIMB_CACHE_DISABLED=1 zet de cache volledig uit (test-schakelaar).
//
// Hermetisch: de echte DB wordt vervangen via __setClimbCacheDbForTests en
// alle netwerk-calls lopen door een fetch-stub (zelfde patroon als
// climb-search-unit.ts, maar hier staat de cache juist AAN).
//
// Run: `pnpm --filter @workspace/api-server run test:climb-cache-unit`
// (via shell — de workflow-limiet is bereikt; bewust geen nieuwe workflow.)

import {
  cacheGetDb,
  cachePutDb,
  __setClimbCacheDbForTests,
} from "../lib/climbs/cache";
import { searchClimbs } from "../lib/climbs";
import type { ClimbHit } from "../lib/climbs/overpass";
import type { GeoArea } from "../lib/climbs/geocode";

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

// ---------------------------------------------------------------------------
// Stub-DB: programmeerbare select-antwoorden (FIFO per aanroep) + insert-log.
// cacheGetDb doet select().from().where(); cachePutDb doet
// insert().values().onConflictDoUpdate().
// ---------------------------------------------------------------------------

type SelectResult = { rows?: unknown[]; error?: Error };
let selectQueue: SelectResult[] = [];
let selectCalls = 0;
let insertCalls: { cacheKey: string; payload: unknown }[] = [];
let insertError: Error | null = null;

const stubDb = {
  select() {
    return {
      from() {
        return {
          where() {
            selectCalls += 1;
            const next = selectQueue.shift();
            if (!next) return Promise.resolve([]);
            if (next.error) return Promise.reject(next.error);
            return Promise.resolve(next.rows ?? []);
          },
        };
      },
    };
  },
  insert() {
    return {
      values(v: { cacheKey: string; payload: unknown }) {
        return {
          onConflictDoUpdate() {
            if (insertError) return Promise.reject(insertError);
            insertCalls.push({ cacheKey: v.cacheKey, payload: v.payload });
            return Promise.resolve();
          },
        };
      },
    };
  },
} as unknown as Parameters<typeof __setClimbCacheDbForTests>[0];

function resetStubDb() {
  selectQueue = [];
  selectCalls = 0;
  insertCalls = [];
  insertError = null;
}

function freshRow(payload: unknown): SelectResult {
  return { rows: [{ payload, fetchedAt: new Date() }] };
}
function expiredRow(payload: unknown, ttlMs: number): SelectResult {
  // Ruim voorbij de TTL — dus verplicht genegeerd.
  return { rows: [{ payload, fetchedAt: new Date(Date.now() - ttlMs - 60_000) }] };
}

// ---------------------------------------------------------------------------
// fetch-stub: Nominatim → vast centrum; Overpass → telbaar + gemockte hits.
// ---------------------------------------------------------------------------

let overpassCalls = 0;
const liveClimbName = "Live-berg";
const geocodeCenter = { lat: 50.86, lon: 5.83, label: "Valkenburg, Nederland" };

const realFetch = globalThis.fetch;

function installFetchStub() {
  globalThis.fetch = (async (input: unknown) => {
    const url = String(
      typeof input === "string" ? input : (input as { url?: string })?.url ?? input,
    );
    const host = new URL(url).hostname;
    if (host === "nominatim.openstreetmap.org") {
      return new Response(
        JSON.stringify([
          {
            lat: String(geocodeCenter.lat),
            lon: String(geocodeCenter.lon),
            display_name: geocodeCenter.label,
            boundingbox: [
              String(geocodeCenter.lat - 0.01),
              String(geocodeCenter.lat + 0.01),
              String(geocodeCenter.lon - 0.01),
              String(geocodeCenter.lon + 0.01),
            ],
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    // Overpass-mirror: tel de échte bron-fetches.
    overpassCalls += 1;
    return new Response(
      JSON.stringify({
        elements: [
          {
            type: "node",
            id: 900,
            lat: geocodeCenter.lat + 0.01,
            lon: geocodeCenter.lon + 0.01,
            tags: { name: liveClimbName, natural: "peak", ele: "321" },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
}

// Gecachete data die aantoonbaar VERSCHILT van wat de live bron zou geven.
const cachedGeo: GeoArea = {
  label: "Gecachet gebied",
  lat: geocodeCenter.lat,
  lon: geocodeCenter.lon,
  south: geocodeCenter.lat - 0.01,
  west: geocodeCenter.lon - 0.01,
  north: geocodeCenter.lat + 0.01,
  east: geocodeCenter.lon + 0.01,
};
const cachedHit: ClimbHit = {
  osmId: "node/1",
  name: "Gecachete-klim",
  lat: geocodeCenter.lat,
  lon: geocodeCenter.lon,
  elevationM: 123,
  kind: "peak",
  hasDescription: false,
};

const GEOCODE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CLIMB_TTL_MS = 3 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------

async function main() {
  // De cache moet in deze test juist AAN staan.
  delete process.env.CLIMB_CACHE_DISABLED;
  installFetchStub();
  __setClimbCacheDbForTests(stubDb);

  // --- Directe cachelaag ---

  await scenario("cacheGetDb: geldige (verse) rij wordt teruggegeven", async () => {
    resetStubDb();
    selectQueue = [freshRow({ a: 1 })];
    const got = await cacheGetDb<{ a: number }>("k", 60_000);
    assert(got?.a === 1, "verse rij moet als payload terugkomen");
  });

  await scenario("cacheGetDb: verlopen rij wordt genegeerd (null)", async () => {
    resetStubDb();
    selectQueue = [expiredRow({ a: 1 }, 60_000)];
    const got = await cacheGetDb("k", 60_000);
    assert(got === null, "TTL voorbij ⇒ rij MOET genegeerd worden, kreeg payload terug");
  });

  await scenario("cacheGetDb: DB-fout is niet fataal (null, geen throw)", async () => {
    resetStubDb();
    selectQueue = [{ error: new Error("db down") }];
    const got = await cacheGetDb("k", 60_000);
    assert(got === null, "DB-fout moet null geven, nooit gooien");
  });

  await scenario("cachePutDb: DB-fout is niet fataal (geen throw)", async () => {
    resetStubDb();
    insertError = new Error("db down");
    await cachePutDb("k", { a: 1 }); // mag niet gooien
  });

  await scenario("CLIMB_CACHE_DISABLED=1: cache volledig gepasseerd", async () => {
    resetStubDb();
    process.env.CLIMB_CACHE_DISABLED = "1";
    try {
      selectQueue = [freshRow({ a: 1 })];
      const got = await cacheGetDb("k", 60_000);
      assert(got === null, "uitgeschakelde cache moet null geven, zelfs met verse rij");
      await cachePutDb("k", { a: 1 });
      assert(selectCalls === 0 && insertCalls.length === 0, "DB mag niet aangeraakt worden");
    } finally {
      delete process.env.CLIMB_CACHE_DISABLED;
    }
  });

  // --- Via searchClimbs (het echte gebruikspad) ---

  await scenario("searchClimbs: geldige cache-rij ⇒ géén live Overpass-fetch", async () => {
    resetStubDb();
    overpassCalls = 0;
    // 1e select = geocode-cache (hit), 2e = klimmen-cache (hit).
    // Eigen straal per scenario: de overpass-laag heeft óók een korte
    // in-memory bbox-cache; een unieke bbox houdt de scenario's hermetisch.
    selectQueue = [freshRow(cachedGeo), freshRow([cachedHit])];
    const res = await searchClimbs({ q: "Valkenburg", radiusKm: 5 });
    assert(overpassCalls === 0, `cache-hit mag de bron niet raken (fetches: ${overpassCalls})`);
    assert(
      res.climbs.length === 1 && res.climbs[0]!.name === cachedHit.name,
      "gecachete klim moet getoond worden",
    );
    assert(insertCalls.length === 0, "een cache-hit mag geen nieuwe write doen");
  });

  await scenario("searchClimbs: verlopen klim-rij ⇒ verse echte fetch + her-cache", async () => {
    resetStubDb();
    overpassCalls = 0;
    selectQueue = [freshRow(cachedGeo), expiredRow([cachedHit], CLIMB_TTL_MS)];
    const res = await searchClimbs({ q: "Valkenburg", radiusKm: 10 });
    assert(overpassCalls === 1, `verlopen rij moet een verse fetch geven (fetches: ${overpassCalls})`);
    assert(
      res.climbs.length === 1 && res.climbs[0]!.name === liveClimbName,
      `resultaat moet van de LIVE bron komen, kreeg '${res.climbs[0]?.name}' (regressie: verouderde cache getoond)`,
    );
    assert(
      insertCalls.some((c) => c.cacheKey.startsWith("climbs:")),
      "vers resultaat moet opnieuw gecachet worden",
    );
  });

  await scenario("searchClimbs: verlopen geocode-rij ⇒ verse geocode, niet fataal", async () => {
    resetStubDb();
    overpassCalls = 0;
    selectQueue = [expiredRow(cachedGeo, GEOCODE_TTL_MS), freshRow([cachedHit])];
    const res = await searchClimbs({ q: "Valkenburg", radiusKm: 20 });
    assert(res.area?.label === geocodeCenter.label, "gebiedslabel moet van live geocode komen");
    assert(
      insertCalls.some((c) => c.cacheKey.startsWith("geo:")),
      "verse geocode moet opnieuw gecachet worden",
    );
  });

  await scenario("searchClimbs: DB-fout op beide reads ⇒ live bron, geen fout", async () => {
    resetStubDb();
    overpassCalls = 0;
    selectQueue = [{ error: new Error("db down") }, { error: new Error("db down") }];
    insertError = new Error("db down"); // ook writes falen
    const res = await searchClimbs({ q: "Valkenburg", radiusKm: 30 });
    assert(overpassCalls === 1, "DB-fout moet terugvallen op de live bron");
    assert(
      res.climbs.length === 1 && res.climbs[0]!.name === liveClimbName,
      "live resultaat moet gewoon geleverd worden ondanks DB-fout",
    );
  });

  globalThis.fetch = realFetch;
  __setClimbCacheDbForTests(null);

  // Rapport
  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✅" : "❌";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed += 1;
  }
  console.log(
    `\nclimb-cache-unit: ${results.length - failed}/${results.length} scenario's geslaagd`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("climb-cache-unit: onverwachte fout:", err);
  process.exit(1);
});
