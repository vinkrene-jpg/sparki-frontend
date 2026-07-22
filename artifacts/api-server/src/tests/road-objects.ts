// Sparki Traffic Database — testsuite voor de deterministische kern.
//
// Test de PURE lagen (geen netwerk): stop-detectie in getimede tracks,
// de kansverdeling van classifyStop (incl. zelflerende context-shift),
// het lazy tijdsverval van effectiveConfidence, de GPX/TCX-trackextractie
// en de owner-check + contract van de /api/road-objects routes.
//
// Run: `pnpm --filter @workspace/api-server run test:road-objects`
// Exits non-zero on any failure.

import {
  findStops,
  classifyStop,
  cellKeyFor,
  haversineM,
  extractTimedTrackFromGpx,
  extractTimedTrackFromTcx,
  type TimedTrackPoint,
} from "../lib/road-objects/detect";
import { effectiveConfidence, confirmObject } from "../lib/road-objects/store";
import { getRoadObjectsAlongRoute } from "../lib/road-objects/along-route";
import type { RoadObject, RoutePathPoint } from "@workspace/db";
import {
  db,
  pool,
  roadObjectsTable,
  roadObjectReportsTable,
  userProfilesTable,
} from "@workspace/db";
import { and, eq, inArray, like } from "drizzle-orm";

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

// Bouw een track: rijden met ~8 m/s, dan stilstaan op een vaste plek.
// 1e-5 graden lat ≈ 1,11 m.
function buildTrack(
  segments: { seconds: number; speedMps: number }[],
): TimedTrackPoint[] {
  const pts: TimedTrackPoint[] = [];
  let lat = 52.09;
  const lon = 5.12;
  let t = Date.UTC(2026, 5, 1, 9, 0, 0);
  for (const seg of segments) {
    for (let s = 0; s < seg.seconds; s++) {
      pts.push({ lat, lon, timeMs: t });
      lat += (seg.speedMps / 111_320) * 1; // per seconde
      t += 1000;
    }
  }
  pts.push({ lat, lon, timeMs: t });
  return pts;
}

async function main() {
  await scenario("findStops: rijden zonder stop levert geen stops", () => {
    const stops = findStops(buildTrack([{ seconds: 120, speedMps: 8 }]));
    assert(stops.length === 0, `verwacht 0 stops, kreeg ${stops.length}`);
  });

  await scenario("findStops: 30 s stilstand wordt één stop met juiste duur", () => {
    const stops = findStops(
      buildTrack([
        { seconds: 60, speedMps: 8 },
        { seconds: 30, speedMps: 0 },
        { seconds: 60, speedMps: 8 },
      ]),
    );
    assert(stops.length === 1, `verwacht 1 stop, kreeg ${stops.length}`);
    const s = stops[0]!;
    assert(Math.abs(s.stopSec - 30) <= 2, `stopSec ${s.stopSec} niet ~30`);
    assert(Math.abs(s.atSec - 60) <= 2, `atSec ${s.atSec} niet ~60`);
    assert(s.cellKey.startsWith("cell:"), "cellKey ontbreekt");
  });

  await scenario("findStops: korte hapering (<5 s) telt niet als stop", () => {
    const stops = findStops(
      buildTrack([
        { seconds: 60, speedMps: 8 },
        { seconds: 3, speedMps: 0 },
        { seconds: 60, speedMps: 8 },
      ]),
    );
    assert(stops.length === 0, `verwacht 0 stops, kreeg ${stops.length}`);
  });

  await scenario("findStops: opnamegat (>120 s) telt nooit als stilstand", () => {
    const a = buildTrack([{ seconds: 60, speedMps: 8 }]);
    const lastT = a[a.length - 1]!.timeMs;
    const last = a[a.length - 1]!;
    // Zelfde plek, 10 minuten later verder — zonder gat-guard zou dit een
    // "600 s stop" worden.
    const b: TimedTrackPoint[] = [];
    for (let s = 0; s < 30; s++) {
      b.push({ lat: last.lat, lon: last.lon, timeMs: lastT + 600_000 + s * 1000 });
    }
    const stops = findStops([...a, ...b]);
    const long = stops.find((s) => s.stopSec > 120);
    assert(!long, `gat werd als stop geteld: ${JSON.stringify(long)}`);
  });

  await scenario("findStops: twee losse stops blijven gescheiden", () => {
    const stops = findStops(
      buildTrack([
        { seconds: 60, speedMps: 8 },
        { seconds: 20, speedMps: 0 },
        { seconds: 120, speedMps: 8 },
        { seconds: 45, speedMps: 0 },
        { seconds: 60, speedMps: 8 },
      ]),
    );
    assert(stops.length === 2, `verwacht 2 stops, kreeg ${stops.length}`);
  });

  await scenario("classifyStop: 40 s zonder context → verkeerslicht bovenaan, nooit 100%", () => {
    const c = classifyStop(40, {
      nearKnownSignal: false,
      nearKnownRailway: false,
      priorReports: 0,
      distinctUsers: 0,
    });
    assert(c[0]!.kind === "traffic_signal", `top is ${c[0]!.kind}`);
    assert(c.every((x) => x.confidence <= 0.97), "confidence boven cap 0,97");
    const sum = c.reduce((a, x) => a + x.confidence, 0);
    assert(sum > 0.9 && sum <= 1.05, `verdeling sommeert vreemd: ${sum}`);
  });

  await scenario("classifyStop: bekend verkeerslicht vlakbij verhoogt de kans", () => {
    const base = classifyStop(40, {
      nearKnownSignal: false, nearKnownRailway: false, priorReports: 0, distinctUsers: 0,
    }).find((x) => x.kind === "traffic_signal")!.confidence;
    const near = classifyStop(40, {
      nearKnownSignal: true, nearKnownRailway: false, priorReports: 0, distinctUsers: 0,
    }).find((x) => x.kind === "traffic_signal")!.confidence;
    assert(near > base, `nearKnownSignal verhoogt niet (${base} → ${near})`);
  });

  await scenario("classifyStop: lange stilstand (>5 min) is vrijwel altijd pauze", () => {
    const c = classifyStop(600, {
      nearKnownSignal: false, nearKnownRailway: false, priorReports: 0, distinctUsers: 0,
    });
    assert(c[0]!.kind === "pause", `top is ${c[0]!.kind}`);
  });

  await scenario("classifyStop: herhaalde stops van meerdere renners verschuiven weg van pauze", () => {
    const solo = classifyStop(90, {
      nearKnownSignal: false, nearKnownRailway: false, priorReports: 0, distinctUsers: 0,
    });
    const learned = classifyStop(90, {
      nearKnownSignal: false, nearKnownRailway: false, priorReports: 5, distinctUsers: 3,
    });
    const sig = (c: typeof solo) => c.find((x) => x.kind === "traffic_signal")!.confidence;
    const pauze = (c: typeof solo) => c.find((x) => x.kind === "pause")!.confidence;
    assert(sig(learned) > sig(solo), "leren verhoogt verkeerslicht-kans niet");
    assert(pauze(learned) < pauze(solo), "leren verlaagt pauze-kans niet");
  });

  await scenario("classifyStop: zelflerend effect geldt NIET voor lange pauzes (>300 s)", () => {
    const learned = classifyStop(600, {
      nearKnownSignal: false, nearKnownRailway: false, priorReports: 6, distinctUsers: 4,
    });
    assert(learned[0]!.kind === "pause", `top is ${learned[0]!.kind}`);
  });

  await scenario("effectiveConfidence: binnen respijt (120 d) geen verval", () => {
    const obj = {
      confidence: 0.9,
      source: "osm",
      lastValidatedAt: new Date(Date.now() - 100 * 86_400_000),
    } as unknown as RoadObject;
    assert(effectiveConfidence(obj) === 0.9, "verval binnen respijt");
  });

  await scenario("effectiveConfidence: na respijt −0,004/dag met bron-bodem", () => {
    const obj = {
      confidence: 0.9,
      source: "osm",
      lastValidatedAt: new Date(Date.now() - 220 * 86_400_000),
    } as unknown as RoadObject;
    const v = effectiveConfidence(obj);
    assert(Math.abs(v - 0.5) <= 0.02, `verwacht ~0,50, kreeg ${v}`);
    const old = {
      confidence: 0.9,
      source: "detection",
      lastValidatedAt: new Date(Date.now() - 3000 * 86_400_000),
    } as unknown as RoadObject;
    assert(effectiveConfidence(old) === 0.05, "detectie-bodem 0,05 niet gehanteerd");
    const oldOsm = { ...old, source: "osm" } as unknown as RoadObject;
    assert(effectiveConfidence(oldOsm) === 0.35, "osm-bodem 0,35 niet gehanteerd");
  });

  await scenario("cellKeyFor: zelfde plek zelfde cel, 100 m verder andere cel", () => {
    assert(
      cellKeyFor(52.09001, 5.12001) === cellKeyFor(52.090012, 5.120008),
      "micro-drift wisselt van cel",
    );
    assert(
      cellKeyFor(52.09, 5.12) !== cellKeyFor(52.091, 5.12),
      "100 m verder valt in dezelfde cel",
    );
    assert(Math.abs(haversineM(52.09, 5.12, 52.091, 5.12) - 111) < 5, "haversine afwijkend");
  });

  await scenario("extractTimedTrackFromGpx: leest lat/lon/tijd, negeert punten zonder tijd", () => {
    const gpx = `<gpx><trk><trkseg>
      <trkpt lat="52.1" lon="5.1"><time>2026-06-01T09:00:00Z</time></trkpt>
      <trkpt lat="52.2" lon="5.2"></trkpt>
      <trkpt lat="52.3" lon="5.3"><time>2026-06-01T09:00:05Z</time></trkpt>
    </trkseg></trk></gpx>`;
    const t = extractTimedTrackFromGpx(gpx);
    assert(t.length === 2, `verwacht 2 punten, kreeg ${t.length}`);
    assert(t[1]!.timeMs - t[0]!.timeMs === 5000, "tijdsverschil klopt niet");
  });

  await scenario("extractTimedTrackFromTcx: leest Trackpoints incl. namespace-prefix", () => {
    const tcx = `<TrainingCenterDatabase><Track>
      <Trackpoint><Time>2026-06-01T09:00:00Z</Time><Position>
        <LatitudeDegrees>52.1</LatitudeDegrees><LongitudeDegrees>5.1</LongitudeDegrees>
      </Position></Trackpoint>
      <Trackpoint><ns3:Time>2026-06-01T09:00:10Z</ns3:Time><Position>
        <ns3:LatitudeDegrees>52.11</ns3:LatitudeDegrees><ns3:LongitudeDegrees>5.11</ns3:LongitudeDegrees>
      </Position></Trackpoint>
    </Track></TrainingCenterDatabase>`;
    const t = extractTimedTrackFromTcx(tcx);
    assert(t.length === 2, `verwacht 2 punten, kreeg ${t.length}`);
  });

  // ── DB-gedragen regressietests (echte database, eigen opruiming) ──
  // Uniek testgebied ver op zee zodat echte data nooit interfereert.
  const T_LAT = 0.5001;
  const T_LON = -30.5001;
  const cleanup = async () => {
    await db
      .delete(roadObjectReportsTable)
      .where(like(roadObjectReportsTable.activityExternalId, "test-ro-%"));
    await db
      .delete(roadObjectsTable)
      .where(like(roadObjectsTable.externalId, "test-ro-%"));
  };

  await scenario("dedupe langs route: beste kandidaat wint (hoogste confidence), niet de eerste rij", async () => {
    await cleanup();
    const [low] = await db
      .insert(roadObjectsTable)
      .values({
        kind: "traffic_signal", source: "detection", externalId: "test-ro-low",
        lat: T_LAT, lon: T_LON, roadName: null, country: null,
        confidence: 0.5, confirmations: 1,
      })
      .returning();
    const [high] = await db
      .insert(roadObjectsTable)
      .values({
        kind: "traffic_signal", source: "osm", externalId: "test-ro-high",
        lat: T_LAT + 0.00001, lon: T_LON, roadName: null, country: null,
        confidence: 0.9, confirmations: 3,
      })
      .returning();
    try {
      const geometry: RoutePathPoint[] = [
        [T_LAT - 0.001, T_LON],
        [T_LAT, T_LON],
        [T_LAT + 0.001, T_LON],
      ];
      const result = await getRoadObjectsAlongRoute(geometry, { skipOsmSync: true });
      assert(result, "geen resultaat");
      const signals = result!.objects.filter((o) => o.kind === "traffic_signal");
      assert(signals.length === 1, `verwacht 1 gededuped object, kreeg ${signals.length}`);
      assert(
        signals[0]!.id === high!.id,
        `verkeerde winnaar: id ${signals[0]!.id} (low=${low!.id}, high=${high!.id})`,
      );
    } finally {
      await cleanup();
    }
  });

  await scenario("confirm: zonder eigen stop-bewijs → no_evidence; met bewijs idempotent", async () => {
    await cleanup();
    const [user] = await db
      .select({ clerkId: userProfilesTable.clerkId })
      .from(userProfilesTable)
      .limit(1);
    assert(user, "geen gebruiker in testdatabase");
    const clerkId = user!.clerkId;
    const [obj] = await db
      .insert(roadObjectsTable)
      .values({
        kind: "traffic_signal", source: "osm", externalId: "test-ro-confirm",
        lat: T_LAT, lon: T_LON, roadName: null, country: null,
        confidence: 0.6, confirmations: 0,
      })
      .returning();
    try {
      // Zonder bewijs: weigeren.
      const denied = await confirmObject(obj!.id, clerkId);
      assert(denied.status === "no_evidence", `verwacht no_evidence, kreeg ${denied.status}`);

      // Eigen echte stop-waarneming vlakbij → bevestigen mag, precies één keer.
      await db.insert(roadObjectReportsTable).values({
        clerkId, cellKey: cellKeyFor(T_LAT, T_LON),
        lat: T_LAT, lon: T_LON, stopSec: 35,
        guessedKind: "traffic_signal", confidence: 0.6,
        activityExternalId: "test-ro-evidence",
      });
      const first = await confirmObject(obj!.id, clerkId);
      assert(first.status === "confirmed", `verwacht confirmed, kreeg ${first.status}`);
      const second = await confirmObject(obj!.id, clerkId);
      assert(
        second.status === "already_confirmed",
        `verwacht already_confirmed, kreeg ${second.status}`,
      );
      const [after] = await db
        .select()
        .from(roadObjectsTable)
        .where(eq(roadObjectsTable.id, obj!.id))
        .limit(1);
      assert(after!.confirmations === 1, `confirmations ${after!.confirmations} ≠ 1 (opjagen mogelijk)`);
    } finally {
      // Ook de door confirmObject zelf geschreven confirm-rij opruimen.
      await db
        .delete(roadObjectReportsTable)
        .where(
          and(
            eq(roadObjectReportsTable.clerkId, clerkId),
            inArray(roadObjectReportsTable.activityExternalId, [
              `confirm:${obj!.id}`,
              "test-ro-evidence",
            ]),
          ),
        );
      await cleanup();
    }
  });

  // Routecontract: onbestaande/andermans route levert een eerlijke 404 —
  // nooit data van een ander. (Draait met dev-bypass, dus ingelogd.)
  await scenario("routes: along-route van onbestaande route → 404", async () => {
    const { default: app } = await import("../app");
    const { createServer } = await import("node:http");
    const server = createServer(app);
    await new Promise<void>((r) => server.listen(0, () => r()));
    const addr = server.address();
    const port = addr && typeof addr === "object" ? addr.port : 0;
    try {
      const res = await fetch(
        `http://127.0.0.1:${port}/api/road-objects/along-route/999999999`,
      );
      assert(res.status === 404, `verwacht 404, kreeg ${res.status}`);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });

  // ── Rapport ──
  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✓" : "✗";
    if (r.status === "fail") failed++;
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
  }
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd`);
  await pool.end().catch(() => {});
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("testsuite crashte:", err);
  process.exit(1);
});
