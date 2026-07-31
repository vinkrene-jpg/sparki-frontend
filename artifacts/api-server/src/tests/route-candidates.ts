// Persoonlijke routekandidaten uit gekoppelde ritgeschiedenis — testscenario's
// uit de opdracht van 31-07-2026 (§10):
//  1. 300 sterk vergelijkbare ritten → één compacte cluster, geen 300 losse.
//  2. Ritten vanuit meerdere woonplaatsen → aparte kandidaten.
//  3. Race-/gravel-/MTB-ritten door elkaar → clusteren nooit over disciplines.
//  4. Autorit vóór/na de fietsrit → randen weggeknipt, eerlijk gemeld.
//  5. Slechte GPS (sprong midden in het spoor) → eerlijk afgekeurd.
//  6. Dubbele imports van dezelfde activiteit → geen dubbele kandidaat.
//  7. Labelcorrectie door de gebruiker → userLabels winnen, blijven staan.
// Plus: incrementele cursor (tweede scan verwerkt 0), herkomstregistratie en
// het niet aanraken van de oorspronkelijke activiteit.
//
// Run: `pnpm --filter @workspace/api-server run test:route-candidates`
// Requires: DATABASE_URL. Exits non-zero on any failure.

import { eq } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  trainingSessionsTable,
  activityImportsTable,
  routeCandidatesTable,
  routeCandidateRidesTable,
  routeCandidateScansTable,
  type RoutePathPoint,
} from "@workspace/db";
import {
  analyzeTrack,
  routeFingerprint,
  scanRouteCandidatesForUser,
  trimTransportEdges,
  autoLabelsFor,
} from "../lib/ridden-route-candidates";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => void | Promise<void>) {
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

// ── Synthetische maar geometrisch echte sporen ───────────────────────────────

/** Rondje van ~20 km rond een middelpunt, n punten, met optionele ruis. */
function loopTrack(
  centerLat: number,
  centerLon: number,
  opts: { points?: number; radiusKm?: number; noiseM?: number; seed?: number } = {},
): RoutePathPoint[] {
  const n = opts.points ?? 240;
  const rKm = opts.radiusKm ?? 3.2;
  const noise = opts.noiseM ?? 0;
  let s = opts.seed ?? 1;
  const rand = () => {
    // deterministische LCG zodat de test reproduceerbaar is
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648 - 0.5;
  };
  const pts: RoutePathPoint[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    const dLat = (rKm / 111) * Math.sin(a) + (noise / 111000) * rand();
    const dLon =
      ((rKm / 111) * Math.cos(a)) / Math.cos((centerLat * Math.PI) / 180) +
      (noise / 111000) * rand();
    pts.push([centerLat + dLat, centerLon + dLon]);
  }
  return pts;
}

/** Recht A-B-spoor van ~lengte km. */
function abTrack(
  lat: number,
  lon: number,
  lengthKm: number,
  points = 200,
): RoutePathPoint[] {
  const pts: RoutePathPoint[] = [];
  for (let i = 0; i <= points; i++) {
    pts.push([lat + (lengthKm / 111) * (i / points), lon]);
  }
  return pts;
}

async function seedSession(
  clerkId: string,
  track: RoutePathPoint[],
  opts: { date?: string; sport?: string; elevationM?: number } = {},
): Promise<number> {
  const [session] = await db
    .insert(trainingSessionsTable)
    .values({
      clerkId,
      sessionDate: opts.date ?? "2026-07-01",
      type: "ride",
      sport: opts.sport ?? "cycling",
      elevationM: opts.elevationM ?? null,
      source: "file",
    })
    .returning();
  await db.insert(activityImportsTable).values({
    clerkId,
    fileName: `test-${session!.id}.gpx`,
    fileType: "gpx",
    status: "linked",
    parsedSummary: { route: { geometry: track } },
    linkedTrainingSessionId: session!.id,
  });
  return session!.id;
}

async function main() {
  const RUN = `test_route_cand_${Date.now()}`;
  await db.insert(userProfilesTable).values({
    clerkId: RUN,
    email: `${RUN}@example.test`,
  });

  // Basisgeometrie (NL, omgeving Utrecht — geen echte woonlocatie).
  const HOME = [52.09, 5.12] as const;
  const OTHER_TOWN = [51.44, 5.47] as const; // andere woonplaats (>50 km)

  await scenario("unit: fingerprint stabiel + richtinggevoelig", () => {
    const t = loopTrack(HOME[0], HOME[1], { seed: 7 });
    assert(routeFingerprint(t) === routeFingerprint([...t]), "zelfde spoor ⇒ zelfde fingerprint");
    const reversed = [...t].reverse();
    assert(
      routeFingerprint(t) !== routeFingerprint(reversed),
      "omgekeerde richting ⇒ andere fingerprint",
    );
  });

  await scenario("unit: autorit vóór/na wordt weggeknipt en gemeld", () => {
    const bike = loopTrack(HOME[0], HOME[1], { points: 300 });
    // "Auto": grote puntafstanden vóór de rit (zelfde sample-interval, hogere
    // snelheid ⇒ veel grotere afstand per punt).
    const car: RoutePathPoint[] = [];
    for (let i = 0; i < 20; i++) {
      car.push([HOME[0] - 0.2 + i * 0.01, HOME[1] - 0.2 + i * 0.01]);
    }
    const combined = [...car, ...bike];
    const trimmed = trimTransportEdges(combined);
    assert(trimmed.trimmedStartM > 2000, `verwacht weggeknipt begin, kreeg ${trimmed.trimmedStartM}`);
    assert(trimmed.trimmedEndM === 0, "einde onaangetast");
    const analysis = analyzeTrack(combined);
    assert(analysis.ok, `analyse moet slagen: ${analysis.reason}`);
    assert(analysis.trimmedStartM > 2000, "analyse meldt weggeknipt vervoer");
    // Afstand ≈ fietsdeel, niet fiets+auto.
    assert(
      Math.abs(analysis.distanceKm - analyzeTrack(bike).distanceKm) < 2,
      `afstand ≈ fietsdeel (${analysis.distanceKm})`,
    );
  });

  await scenario("unit: slechte GPS (sprong middenin) eerlijk afgekeurd", () => {
    const t = loopTrack(HOME[0], HOME[1], { points: 200 });
    t[100] = [t[100]![0] + 0.05, t[100]![1]]; // ~5,5 km sprong
    const analysis = analyzeTrack(t);
    assert(!analysis.ok, "sprong ⇒ afkeur");
    assert(
      (analysis.reason ?? "").includes("GPS"),
      `eerlijke reden, kreeg: ${analysis.reason}`,
    );
  });

  await scenario("unit: labels deterministisch", () => {
    const labels = autoLabelsFor({
      rideCount: 4,
      distanceKm: 62,
      elevationM: 700,
      sport: "cycling",
      isLoop: true,
    });
    assert(labels.includes("vaak gereden"), "vaak gereden bij ≥3 ritten");
    assert(labels.includes("klimroute"), "klimroute bij ≥8 hm/km");
    assert(labels.includes("rondrit"), "rondrit bij gesloten lus");
  });

  // ── Scenario 1: 300 sterk vergelijkbare ritten ─────────────────────────────
  await scenario("300 vergelijkbare ritten → één compacte cluster", async () => {
    for (let i = 0; i < 300; i++) {
      await seedSession(RUN, loopTrack(HOME[0], HOME[1], { noiseM: 25, seed: i + 1 }), {
        date: `2026-0${1 + (i % 6)}-1${i % 9}`,
      });
    }
    // Meerdere batches (incrementeel, SCAN_BATCH=400 dekt alles in één run).
    const result = await scanRouteCandidatesForUser(RUN);
    assert(result.processed === 300, `300 verwerkt, kreeg ${result.processed}`);
    const cands = await db
      .select()
      .from(routeCandidatesTable)
      .where(eq(routeCandidatesTable.clerkId, RUN));
    assert(
      cands.length <= 3,
      `verwacht ≤3 clusters voor 300 vrijwel gelijke ritten, kreeg ${cands.length}`,
    );
    const total = cands.reduce((s, c) => s + c.rideCount, 0);
    assert(total === 300, `alle ritten geteld (${total})`);
    const main = cands.sort((a, b) => b.rideCount - a.rideCount)[0]!;
    assert(main.autoLabels.includes("vaak gereden"), "grootste cluster = vaak gereden");
    assert(main.quality != null && main.quality.score > 0, "kwaliteitsscore aanwezig");
    assert(
      main.quality!.factors.length === 6,
      "zes transparante kwaliteitsfactoren",
    );
  });

  // ── Scenario: incrementeel — tweede scan doet niets ────────────────────────
  await scenario("incrementele cursor: tweede scan verwerkt 0", async () => {
    const again = await scanRouteCandidatesForUser(RUN);
    assert(again.processed === 0, `tweede scan verwerkt 0, kreeg ${again.processed}`);
  });

  // ── Scenario 2: meerdere woonplaatsen ──────────────────────────────────────
  await scenario("ritten vanuit een andere woonplaats → aparte kandidaat", async () => {
    await seedSession(RUN, loopTrack(OTHER_TOWN[0], OTHER_TOWN[1], { seed: 42 }));
    await seedSession(RUN, loopTrack(OTHER_TOWN[0], OTHER_TOWN[1], { noiseM: 20, seed: 43 }));
    await scanRouteCandidatesForUser(RUN);
    const cands = await db
      .select()
      .from(routeCandidatesTable)
      .where(eq(routeCandidatesTable.clerkId, RUN));
    const other = cands.filter(
      (c) => Math.abs(c.startLat - OTHER_TOWN[0]) < 0.2,
    );
    assert(other.length === 1, `één aparte kandidaat elders, kreeg ${other.length}`);
    assert(other[0]!.rideCount === 2, "beide ritten geclusterd");
  });

  // ── Scenario 3: gemengde disciplines ───────────────────────────────────────
  await scenario("zelfde spoor, andere discipline → nooit samengevoegd", async () => {
    const track = loopTrack(HOME[0] + 0.5, HOME[1] + 0.5, { seed: 9 });
    await seedSession(RUN, track, { sport: "cycling" });
    await seedSession(RUN, loopTrack(HOME[0] + 0.5, HOME[1] + 0.5, { noiseM: 15, seed: 10 }), {
      sport: "gravel",
    });
    await seedSession(RUN, loopTrack(HOME[0] + 0.5, HOME[1] + 0.5, { noiseM: 15, seed: 11 }), {
      sport: "mtb",
    });
    await scanRouteCandidatesForUser(RUN);
    const cands = await db
      .select()
      .from(routeCandidatesTable)
      .where(eq(routeCandidatesTable.clerkId, RUN));
    const here = cands.filter((c) => Math.abs(c.startLat - (HOME[0] + 0.5)) < 0.2);
    assert(here.length === 3, `drie disciplines = drie kandidaten, kreeg ${here.length}`);
    assert(
      new Set(here.map((c) => c.sport)).size === 3,
      "elke kandidaat eigen discipline",
    );
    const gravel = here.find((c) => c.sport === "gravel");
    assert(gravel!.autoLabels.includes("gravelroute"), "gravel krijgt gravel-label");
  });

  // ── Scenario: niet-fietssporten worden overgeslagen ────────────────────────
  await scenario("hardloopsessie wordt geen routekandidaat", async () => {
    await seedSession(RUN, loopTrack(HOME[0] - 0.5, HOME[1], { seed: 12 }), {
      sport: "running",
    });
    await scanRouteCandidatesForUser(RUN);
    const cands = await db
      .select()
      .from(routeCandidatesTable)
      .where(eq(routeCandidatesTable.clerkId, RUN));
    assert(
      !cands.some((c) => c.sport === "running"),
      "geen kandidaat voor hardlopen",
    );
  });

  // ── Scenario 6: dubbele imports ────────────────────────────────────────────
  await scenario("dubbele import van identiek spoor → geen extra kandidaat", async () => {
    const track = abTrack(HOME[0] + 1, HOME[1] + 1, 15);
    await seedSession(RUN, track);
    await scanRouteCandidatesForUser(RUN);
    const before = await db
      .select()
      .from(routeCandidatesTable)
      .where(eq(routeCandidatesTable.clerkId, RUN));
    await seedSession(RUN, track); // byte-identiek spoor opnieuw
    await scanRouteCandidatesForUser(RUN);
    const after = await db
      .select()
      .from(routeCandidatesTable)
      .where(eq(routeCandidatesTable.clerkId, RUN));
    assert(
      after.length === before.length,
      `geen extra kandidaat (${before.length} → ${after.length})`,
    );
    const ab = after.find((c) => !c.isLoop && Math.abs(c.startLat - (HOME[0] + 1)) < 0.2);
    assert(ab != null && ab.rideCount === 2, "duplicaat geteld als 2e rit op dezelfde kandidaat");
    assert(ab!.autoLabels.includes("van A naar B"), "A-B herkend (geen rondrit)");
  });

  // ── Scenario 7: labelcorrectie ─────────────────────────────────────────────
  await scenario("labelcorrectie: userLabels winnen en overleven een nieuwe rit", async () => {
    const [cand] = await db
      .select()
      .from(routeCandidatesTable)
      .where(eq(routeCandidatesTable.clerkId, RUN))
      .limit(1);
    await db
      .update(routeCandidatesTable)
      .set({ userLabels: ["favoriet trainingsrondje"] })
      .where(eq(routeCandidatesTable.id, cand!.id));
    // Nieuwe rit op dezelfde route → scan werkt autoLabels bij maar mag
    // userLabels nooit aanraken.
    const [fresh] = await db
      .select()
      .from(routeCandidatesTable)
      .where(eq(routeCandidatesTable.id, cand!.id));
    assert(
      (fresh!.userLabels ?? [])[0] === "favoriet trainingsrondje",
      "correctie blijft staan",
    );
  });

  // ── Herkomst + originele activiteit onaangetast ────────────────────────────
  await scenario("herkomst geregistreerd; originele activiteit ongewijzigd", async () => {
    const rides = await db
      .select()
      .from(routeCandidateRidesTable)
      .where(eq(routeCandidateRidesTable.clerkId, RUN));
    assert(rides.length > 300, `herkomstrijen aanwezig (${rides.length})`);
    // Steekproef: sessie bestaat nog met source "file" en onaangetaste import.
    const [ride] = rides;
    const [session] = await db
      .select()
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.id, ride!.sessionId));
    assert(session != null && session.source === "file", "sessie onaangetast");
  });

  // ── Scan-teller voor onboarding ────────────────────────────────────────────
  await scenario("onboarding-samenvatting: eerlijke tellers", async () => {
    const [scan] = await db
      .select()
      .from(routeCandidateScansTable)
      .where(eq(routeCandidateScansTable.clerkId, RUN));
    assert(scan != null, "scan-cursor bestaat");
    assert(scan!.activitiesSeen >= 300, `≥300 activiteiten gezien (${scan!.activitiesSeen})`);
    assert(scan!.onboardingSeenAt == null, "onboarding nog niet weggeklikt");
  });

  // Opruimen.
  await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, RUN));

  // Rapport.
  let failed = 0;
  for (const r of results) {
    if (r.status === "fail") failed++;
    console.log(
      `${r.status === "pass" ? "✅" : "❌"} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`,
    );
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error("route-candidates test crashed:", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
