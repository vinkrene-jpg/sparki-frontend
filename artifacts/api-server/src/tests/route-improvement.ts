// Routebibliotheek-verbeterlus: slecht beoordeelde routes (gem. < 3 bij
// ≥ 3 echte stemmen) worden automatisch vervangen door een nieuwe echte
// variant; terugkerende opmerkingen sturen de kandidaatkeuze.
//
// Asserts:
// 1. Pure themalogica: terugkerend = ≥ 2 verschillende gebruikers; opties-
//    mapping incl. tegenstrijdige hoogtefeedback → geen sturing.
// 2. Drempel: alleen actief + gem. < 3 + ≥ 3 stemmen.
// 3. DB-flow: vervanging maakt een opvolger (generatie+1, sparki_verbeterd,
//    eerlijke improveNote), markeert het origineel "vervangen" met verwijzing,
//    en de bbox-lijst toont alleen de opvolger.
// 4. Idempotent: tweede aanroep vervangt niets meer.
// 5. Goed beoordeelde routes blijven onaangeroerd.
//
// Run: `pnpm --filter @workspace/api-server run test:route-improvement`
// Requires: DATABASE_URL. Exits non-zero on any failure.

import {
  db,
  pool,
  routeLibraryTable,
  routeLibraryCommentsTable,
  userProfilesTable,
} from "@workspace/db";
import { eq, inArray, like } from "drizzle-orm";
import {
  registerProvider,
  type RouteResult,
  type RoutingProvider,
} from "../lib/routing";

// ── Mock provider (before importing the improvement module is fine — it
// resolves the provider per call) ───────────────────────────────────────────
let loopCalls = 0;
function fakeLoop(): RouteResult {
  loopCalls += 1;
  // Een klein maar echt-ogend lusje: 5 punten, alle verschillend, ~40 km.
  const base = 52.0 + loopCalls * 0.001;
  const pts: [number, number][] = [
    [base, 5.0],
    [base + 0.05, 5.05],
    [base + 0.1, 5.0],
    [base + 0.05, 4.95],
    [base, 5.0],
  ];
  return {
    points: pts.map(([lat, lon]) => ({ lat, lon, ele: null })),
    path: pts,
    distanceKm: 40,
    durationSec: 5400,
    ascentM: 120,
    steps: [],
  };
}
const mockProvider: RoutingProvider = {
  name: "mock",
  profiles: ["cycling-road", "cycling-mountain", "cycling-regular"],
  isConfigured: () => true,
  generateLoop: async () => fakeLoop(),
  routePointToPoint: async () => fakeLoop(),
  routeWaypoints: async () => fakeLoop(),
  geocode: async () => null,
  geocodeSearch: async () => [],
  reverseGeocode: async () => "Testlocatie",
} as unknown as RoutingProvider;
registerProvider("mock", mockProvider);
process.env.ROUTING_PROVIDER = "mock";

const {
  extractRecurringThemes,
  themeGenerationOptions,
  buildImproveNote,
  shouldReplaceRoute,
  maybeReplacePoorRoute,
} = await import("../lib/route-improvement");
const { routesInBbox } = await import("../lib/route-library");

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => Promise<void>): Promise<void> {
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

const RUN = `test_routeimp_${Date.now()}`;
const CELL = `${RUN}_cell`;
const users = [1, 2, 3].map((i) => `${RUN}_user${i}`);

async function seedRoute(over: Partial<typeof routeLibraryTable.$inferInsert>) {
  const [row] = await db
    .insert(routeLibraryTable)
    .values({
      cellKey: CELL,
      name: "Racefiets-lus · ~40 km",
      bikeType: "racefiets",
      targetKm: 40,
      startLat: 52.05,
      startLon: 5.02,
      distanceKm: 41,
      elevationGainM: 90,
      durationSec: 5000,
      geometry: [
        [52.05, 5.02],
        [52.06, 5.03],
        [52.05, 5.02],
      ],
      seed: 123,
      source: "sparki_auto",
      ...over,
    })
    .returning();
  return row!;
}

async function seedComments(
  routeId: number,
  entries: { user: string; rating: number | null; comment: string | null }[],
) {
  for (const e of entries) {
    await db.insert(routeLibraryCommentsTable).values({
      libraryRouteId: routeId,
      clerkId: e.user,
      rating: e.rating,
      comment: e.comment,
    });
  }
  // Zelfde deterministische herberekening als het commentaar-endpoint.
  const ratings = entries.filter((e) => e.rating != null);
  const avg =
    ratings.length > 0
      ? ratings.reduce((s, e) => s + (e.rating as number), 0) / ratings.length
      : null;
  await db
    .update(routeLibraryTable)
    .set({ avgRating: avg, ratingCount: ratings.length })
    .where(eq(routeLibraryTable.id, routeId));
}

async function main() {
  for (const u of users) {
    await db
      .insert(userProfilesTable)
      .values({ clerkId: u, email: `${u}@test.local` })
      .onConflictDoNothing();
  }

  await scenario("terugkerend thema vereist 2 verschillende gebruikers", async () => {
    const one = extractRecurringThemes([
      { clerkId: "a", comment: "veel te druk verkeer" },
      { clerkId: "a", comment: "echt druk met stoplichten" },
    ]);
    assert(one.length === 0, `één gebruiker mag niet sturen: ${one}`);
    const two = extractRecurringThemes([
      { clerkId: "a", comment: "veel te druk verkeer" },
      { clerkId: "b", comment: "veel verkeerslichten onderweg" },
      { clerkId: "c", comment: null },
    ]);
    assert(two.includes("druk_verkeer"), `verwacht druk_verkeer: ${two}`);
  });

  await scenario("opties-mapping incl. tegenstrijdige hoogtefeedback", async () => {
    const o = themeGenerationOptions(["druk_verkeer", "bochtig"]);
    assert(o.scenery?.avoidTrafficLights === true, "avoidTrafficLights verwacht");
    assert(o.preferUninterrupted === true, "preferUninterrupted verwacht");
    assert(o.elevationPreference === "any", "geen hoogte-sturing verwacht");
    const conflict = themeGenerationOptions(["te_vlak", "te_zwaar"]);
    assert(
      conflict.elevationPreference === "any",
      "tegenstrijdig → geen sturing",
    );
    const hilly = themeGenerationOptions(["te_vlak"]);
    assert(hilly.elevationPreference === "hilly", "te_vlak → hilly");
    assert(buildImproveNote([]) === null, "geen thema → geen note");
    assert(
      (buildImproveNote(["saai"]) ?? "").includes("natuur"),
      "note noemt natuur",
    );
  });

  await scenario("drempel: alleen actief + gem. < 3 + ≥ 3 stemmen", async () => {
    assert(
      shouldReplaceRoute({ status: "actief", avgRating: 2.5, ratingCount: 3 }),
      "2.5/3 stemmen moet vervangen",
    );
    assert(
      !shouldReplaceRoute({ status: "actief", avgRating: 2.5, ratingCount: 2 }),
      "2 stemmen niet",
    );
    assert(
      !shouldReplaceRoute({ status: "actief", avgRating: 3, ratingCount: 5 }),
      "gem. 3 niet",
    );
    assert(
      !shouldReplaceRoute({ status: "actief", avgRating: null, ratingCount: 0 }),
      "zonder scores nooit (geen verzonnen data)",
    );
    assert(
      !shouldReplaceRoute({ status: "vervangen", avgRating: 1, ratingCount: 9 }),
      "vervangen route niet nogmaals",
    );
  });

  const poor = await seedRoute({});
  await seedComments(poor.id, [
    { user: users[0]!, rating: 2, comment: "veel te druk verkeer" },
    { user: users[1]!, rating: 2, comment: "druk en veel stoplichten" },
    { user: users[2]!, rating: 3, comment: "saai stuk industrie" },
  ]);

  await scenario("slechte route wordt vervangen door echte variant", async () => {
    const out = await maybeReplacePoorRoute(poor.id);
    assert(out.replaced === true, `verwacht vervangen, kreeg ${JSON.stringify(out)}`);
    if (!out.replaced) return;
    assert(out.themes.includes("druk_verkeer"), `themes: ${out.themes}`);
    const [old] = await db
      .select()
      .from(routeLibraryTable)
      .where(eq(routeLibraryTable.id, poor.id));
    assert(old!.status === "vervangen", "origineel op vervangen");
    assert(old!.replacedById === out.newId, "verwijzing naar opvolger");
    assert(old!.replacedAt != null, "replacedAt gezet");
    const [next] = await db
      .select()
      .from(routeLibraryTable)
      .where(eq(routeLibraryTable.id, out.newId));
    assert(next!.generation === 2, "generatie 2");
    assert(next!.source === "sparki_verbeterd", "bron sparki_verbeterd");
    assert(next!.status === "actief", "opvolger actief");
    assert(
      (next!.improveNote ?? "").includes("verkeer"),
      `improveNote eerlijk over feedback: ${next!.improveNote}`,
    );
    assert(next!.avgRating == null && next!.ratingCount === 0, "opvolger start zonder verzonnen scores");
    assert(loopCalls > 0, "echte (mock-)provider is aangeroepen");
  });

  await scenario("bbox-lijst toont alleen de opvolger", async () => {
    const rows = await routesInBbox({
      minLat: 52.0,
      maxLat: 52.1,
      minLon: 5.0,
      maxLon: 5.1,
    });
    const mine = rows.filter((r) => r.cellKey === CELL);
    assert(!mine.some((r) => r.id === poor.id), "vervangen route weg uit lijst");
    assert(
      mine.some((r) => r.generation === 2 && r.status === "actief"),
      "opvolger zichtbaar",
    );
  });

  await scenario("tweede aanroep vervangt niets meer (idempotent)", async () => {
    const again = await maybeReplacePoorRoute(poor.id);
    assert(again.replaced === false, "vervangen route niet nogmaals vervangen");
  });

  await scenario("goed beoordeelde route blijft onaangeroerd", async () => {
    const good = await seedRoute({ targetKm: 60, name: "Racefiets-lus · ~60 km" });
    await seedComments(good.id, [
      { user: users[0]!, rating: 5, comment: "prachtig" },
      { user: users[1]!, rating: 4, comment: "mooi rond" },
      { user: users[2]!, rating: 5, comment: null },
    ]);
    const out = await maybeReplacePoorRoute(good.id);
    assert(out.replaced === false, "goede route nooit vervangen");
    const [row] = await db
      .select()
      .from(routeLibraryTable)
      .where(eq(routeLibraryTable.id, good.id));
    assert(row!.status === "actief", "blijft actief");
  });
}

try {
  await main();
} finally {
  // Opruimen: eerst commentaar (FK), dan routes, dan gebruikers.
  try {
    const rows = await db
      .select({ id: routeLibraryTable.id })
      .from(routeLibraryTable)
      .where(eq(routeLibraryTable.cellKey, CELL));
    const ids = rows.map((r) => r.id);
    if (ids.length > 0) {
      await db
        .delete(routeLibraryCommentsTable)
        .where(inArray(routeLibraryCommentsTable.libraryRouteId, ids));
      await db
        .delete(routeLibraryTable)
        .where(inArray(routeLibraryTable.id, ids));
    }
    await db
      .delete(userProfilesTable)
      .where(like(userProfilesTable.clerkId, `${RUN}%`));
  } catch (err) {
    console.error("cleanup faalde:", err);
  }
  await pool.end();
}

let failed = 0;
for (const r of results) {
  const mark = r.status === "pass" ? "✅" : "❌";
  console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  if (r.status === "fail") failed += 1;
}
console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
process.exit(failed > 0 ? 1 : 0);
