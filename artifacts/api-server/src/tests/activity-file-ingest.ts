// Uploaded activity files as a canonical Data Hub source — test harness.
//
// Proves the source-neutrality contract for manual uploads: a parsed GPX/FIT/TCX
// file flows through the SAME `ingestBatch` pipeline as a connector, so it
// becomes a real training session with derived TSS, is idempotent on re-upload,
// and MERGES with a same-time connector ride into one canonical row carrying
// both sources. Pure-function checks (TCX parser, canonical mapping) always run;
// DB-bound checks require DATABASE_URL + a seeded user and clean up after
// themselves. Exits non-zero on any failure.
//
// Run: `pnpm --filter @workspace/api-server run test:activity-file-ingest`

import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  trainingSessionsTable,
  connectorActivitiesTable,
  type ConnectorDataType,
} from "@workspace/db";
import { parseTcx } from "../lib/tcx-parse";
import { parseGpx } from "../lib/gpx-parse";
import {
  summaryToCanonicalActivity,
  ingestActivityFile,
  fileExternalId,
  unlinkedImportStatus,
  FILE_PROVIDER,
} from "../lib/activity-file-ingest";
import {
  ingestBatch,
  computeActivityDedupeKey,
  type NormalizedBatch,
} from "../engines/data-hub";

type Status = "pass" | "fail" | "skip";
const results: { area: string; check: string; status: Status; note?: string }[] =
  [];

async function run(area: string, check: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    results.push({ area, check, status: "pass" });
  } catch (err) {
    results.push({
      area,
      check,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}
function skip(area: string, check: string, note: string) {
  results.push({ area, check, status: "skip", note });
}
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// A small but realistic cycling TCX with a Lap total + trackpoints carrying
// HR / power (namespaced <ns3:Watts>) / cadence / altitude.
function sampleTcx(startIso: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
 <Activities>
  <Activity Sport="Biking">
   <Id>${startIso}</Id>
   <Lap StartTime="${startIso}">
    <TotalTimeSeconds>3600</TotalTimeSeconds>
    <DistanceMeters>40000</DistanceMeters>
    <Track>
     <Trackpoint>
      <Time>${startIso}</Time>
      <AltitudeMeters>10</AltitudeMeters>
      <DistanceMeters>0</DistanceMeters>
      <HeartRateBpm><Value>120</Value></HeartRateBpm>
      <Cadence>85</Cadence>
      <Extensions><ns3:TPX><ns3:Watts>200</ns3:Watts></ns3:TPX></Extensions>
     </Trackpoint>
     <Trackpoint>
      <Time>${new Date(Date.parse(startIso) + 1800_000).toISOString()}</Time>
      <AltitudeMeters>60</AltitudeMeters>
      <DistanceMeters>20000</DistanceMeters>
      <HeartRateBpm><Value>160</Value></HeartRateBpm>
      <Cadence>95</Cadence>
      <Extensions><ns3:TPX><ns3:Watts>260</ns3:Watts></ns3:TPX></Extensions>
     </Trackpoint>
     <Trackpoint>
      <Time>${new Date(Date.parse(startIso) + 3600_000).toISOString()}</Time>
      <AltitudeMeters>30</AltitudeMeters>
      <DistanceMeters>40000</DistanceMeters>
      <HeartRateBpm><Value>150</Value></HeartRateBpm>
      <Cadence>90</Cadence>
      <Extensions><ns3:TPX><ns3:Watts>230</ns3:Watts></ns3:TPX></Extensions>
     </Trackpoint>
    </Track>
   </Lap>
  </Activity>
 </Activities>
</TrainingCenterDatabase>`;
}

// Reproduce EXACTLY the GPX shape a Sparki phone ride serializes
// (`artifacts/sparki-mobile/lib/ride-gpx.ts` → `buildRideGpx`): a GPX 1.1 track
// whose <trkpt>s carry only the real lat/lon and the wall-clock <time> each
// point was recorded (no <ele>/power/HR — the phone doesn't measure them). This
// mirror is what the mobile save path posts to /api/activity-imports; the test
// locks the client→parser→ingest contract so a drift in that shape can't
// silently turn saved rides into parse-failures with no session.
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
function buildRideGpx(
  points: { latitude: number; longitude: number; time: number }[],
  name: string,
  note?: string,
): string | null {
  if (points.length < 2) return null;
  const trkName = esc(name.trim() || "Sparki rit");
  const trimmedNote = (note ?? "").trim();
  const descEl = trimmedNote ? `    <desc>${esc(trimmedNote)}</desc>\n` : "";
  const trkpts = points
    .map(
      (p) =>
        `      <trkpt lat="${p.latitude}" lon="${p.longitude}">` +
        `<time>${new Date(p.time).toISOString()}</time></trkpt>`,
    )
    .join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="Sparki" xmlns="http://www.topografix.com/GPX/1/1">\n` +
    `  <metadata>\n    <name>${trkName}</name>\n${descEl}  </metadata>\n` +
    `  <trk>\n    <name>${trkName}</name>\n    <trkseg>\n${trkpts}\n    </trkseg>\n  </trk>\n` +
    `</gpx>\n`
  );
}

// A short but real recorded ride: a few points along a line over ~30 minutes.
// Coordinates spaced so the haversine distance is clearly non-zero and the time
// window gives a real duration.
function sampleRidePoints(
  startMs: number,
): { latitude: number; longitude: number; time: number }[] {
  return [
    { latitude: 52.09, longitude: 5.11, time: startMs },
    { latitude: 52.1, longitude: 5.13, time: startMs + 600_000 },
    { latitude: 52.11, longitude: 5.16, time: startMs + 1_200_000 },
    { latitude: 52.12, longitude: 5.18, time: startMs + 1_800_000 },
  ];
}

async function resolveDevClerkId(): Promise<string | null> {
  const pinned = process.env.DEV_AUTH_CLERK_ID;
  if (pinned) {
    const [row] = await db
      .select({ clerkId: userProfilesTable.clerkId })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, pinned));
    if (row) return row.clerkId;
  }
  const [first] = await db
    .select({ clerkId: userProfilesTable.clerkId })
    .from(userProfilesTable)
    .limit(1);
  return first?.clerkId ?? null;
}

async function main() {
  // ── Pure-function checks (always runnable) ────────────────────────────────
  await run("TCX", "parses real metrics, omits absent ones", () => {
    const s = parseTcx(sampleTcx("2026-06-20T07:00:00.000Z"));
    assert(s !== null, "TCX parsed");
    assert(s!.sport === "Biking", `sport → ${s!.sport}`);
    assert(s!.startTime === "2026-06-20T07:00:00.000Z", "start time from <Id>");
    assert(s!.durationSec === 3600, `duration from Lap → ${s!.durationSec}`);
    assert(s!.distanceKm === 40, `distance from Lap → ${s!.distanceKm}`);
    assert(s!.avgPower === 230, `avg power → ${s!.avgPower}`);
    assert(s!.maxPower === 260, `max power → ${s!.maxPower}`);
    assert(s!.avgHeartRate === 143, `avg HR → ${s!.avgHeartRate}`);
    assert(s!.maxHeartRate === 160, `max HR → ${s!.maxHeartRate}`);
    assert(s!.avgCadence === 90, `avg cadence → ${s!.avgCadence}`);
    // Elevation gain = (10→60) positive delta only = 50 (60→30 ignored).
    assert(s!.elevationGainM === 50, `elevation gain → ${s!.elevationGainM}`);
    assert(s!.trackpointCount === 3, "3 trackpoints");
  });

  await run("TCX", "non-activity / empty content fails honestly", () => {
    assert(parseTcx("<html>not tcx</html>") === null, "junk → null");
    assert(parseTcx("") === null, "empty → null");
    // An <Activity> with no usable trackpoints/totals → null (never fabricated).
    assert(
      parseTcx(`<Activities><Activity Sport="Biking"></Activity></Activities>`) ===
        null,
      "empty activity → null",
    );
  });

  await run("Mapping", "summaryToCanonicalActivity honours real fields", () => {
    const s = parseTcx(sampleTcx("2026-06-20T07:00:00.000Z"))!;
    const a = summaryToCanonicalActivity("tcx", s, "hash-1");
    assert(a !== null, "mapped");
    assert(a!.sport === "cycling", "Biking → cycling");
    assert(a!.durationMin === 60, "duration → 60 min");
    assert(a!.distanceKm === 40, "distance carried");
    assert(a!.avgPower === 230, "power carried");
    assert(a!.avgSpeedKph === 40, `avg speed = 40 km / 1h → ${a!.avgSpeedKph}`);
  });

  await run("Mapping", "timeless GPX is not turned into an activity", () => {
    const a = summaryToCanonicalActivity(
      "gpx",
      {
        pointCount: 10,
        distanceKm: 12,
        elevationGainM: 100,
        startTime: null,
        endTime: null,
        durationSec: null,
        trackName: "Route zonder tijd",
        notes: null,
      },
      "hash-route",
    );
    assert(a === null, "no start time → null (route, not activity)");
  });

  await run("RideGPX", "Sparki phone ride GPX parses to real distance + duration", () => {
    const start = Date.parse("2026-06-20T07:00:00.000Z");
    const gpx = buildRideGpx(sampleRidePoints(start), "Ochtendrit");
    assert(gpx !== null, "GPX built");
    const s = parseGpx(gpx!);
    assert(s !== null, "GPX parsed (client shape matches parser)");
    assert(s!.pointCount === 4, `4 track points → ${s!.pointCount}`);
    assert(
      s!.distanceKm != null && s!.distanceKm > 0,
      `real distance → ${s!.distanceKm}`,
    );
    assert(s!.durationSec === 1800, `duration from time window → ${s!.durationSec}`);
    assert(
      s!.startTime === "2026-06-20T07:00:00.000Z",
      `start time → ${s!.startTime}`,
    );
    assert(s!.endTime === "2026-06-20T07:30:00.000Z", `end time → ${s!.endTime}`);
    // The phone omits elevation, so the parser must honestly report none.
    assert(s!.elevationGainM === null, "no fabricated elevation");
    assert(s!.trackName === "Ochtendrit", `track name → ${s!.trackName}`);
    // No note supplied → parser reports none (never fabricated).
    assert(s!.notes === null, `no note → ${s!.notes}`);
  });

  await run("RideGPX", "rider name + note flow through GPX into a session", () => {
    const start = Date.parse("2026-06-20T07:00:00.000Z");
    const gpx = buildRideGpx(
      sampleRidePoints(start),
      "Ronde om het meer",
      "Lekker gevoel, wind mee op de terugweg.",
    );
    assert(gpx !== null, "GPX built with note");
    const s = parseGpx(gpx!);
    assert(s !== null, "GPX with note parsed");
    assert(s!.trackName === "Ronde om het meer", `name → ${s!.trackName}`);
    assert(
      s!.notes === "Lekker gevoel, wind mee op de terugweg.",
      `note from metadata desc → ${s!.notes}`,
    );
    const a = summaryToCanonicalActivity("gpx", s!, "hash-note-ride");
    assert(a !== null, "note ride maps to activity");
    assert(a!.title === "Ronde om het meer", `title → ${a!.title}`);
    assert(
      a!.notes === "Lekker gevoel, wind mee op de terugweg.",
      `activity carries note → ${a!.notes}`,
    );
  });

  await run("RideGPX", "phone ride GPX maps to a datable canonical activity", () => {
    const start = Date.parse("2026-06-20T07:00:00.000Z");
    const gpx = buildRideGpx(sampleRidePoints(start), "Ochtendrit")!;
    const a = summaryToCanonicalActivity("gpx", parseGpx(gpx)!, "hash-ride");
    assert(a !== null, "mapped to activity (has real start time)");
    assert(a!.startedAt === "2026-06-20T07:00:00.000Z", "start time carried");
    assert(a!.durationMin === 30, `duration → ${a!.durationMin} min`);
    assert(a!.distanceKm != null && a!.distanceKm > 0, "distance carried");
    assert(a!.title === "Ochtendrit", "track name → title");
  });

  await run("RideGPX", "a <2-point track is rejected honestly (no session)", () => {
    const start = Date.parse("2026-06-20T07:00:00.000Z");
    // buildRideGpx refuses to serialize a single-point track (client guard).
    assert(
      buildRideGpx([{ latitude: 52.09, longitude: 5.11, time: start }], "x") ===
        null,
      "single point → null GPX (never posted)",
    );
    // And even if a 1-point GPX reached the parser, it must not become an
    // activity with fabricated distance/duration. A lone <trkpt> yields a
    // summary with no distance and no duration.
    const oneTrkpt =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<gpx version="1.1" creator="Sparki" xmlns="http://www.topografix.com/GPX/1/1">\n` +
      `  <trk><trkseg>\n` +
      `      <trkpt lat="52.09" lon="5.11"><time>2026-06-20T07:00:00.000Z</time></trkpt>\n` +
      `  </trkseg></trk>\n</gpx>\n`;
    const s = parseGpx(oneTrkpt);
    assert(s !== null && s.pointCount === 1, "1 point parsed");
    assert(s!.distanceKm === null, "no distance from a single point");
    // One timestamp → a zero-length window (never a fabricated positive duration).
    assert(
      s!.durationSec === 0 || s!.durationSec === null,
      `no real duration from a single timestamp → ${s!.durationSec}`,
    );
  });

  await run("Idempotency", "same bytes → same external id", () => {
    const a = fileExternalId("abc", "ride.tcx");
    const b = fileExternalId("abc", "ride.tcx");
    const c = fileExternalId("abd", "ride.tcx");
    assert(a === b, "identical content → identical id");
    assert(a !== c, "different content → different id");
  });

  await run("Idempotency", "identity is content-only (rename ≠ new activity)", () => {
    const a = fileExternalId("abc", "ochtendrit.tcx");
    const b = fileExternalId("abc", "renamed-export.tcx");
    assert(a === b, "same bytes, different filename → same id");
  });

  await run("Unlink", "parsed TCX unlinks back to 'parsed', not 'uploaded'", () => {
    assert(
      unlinkedImportStatus("tcx", true) === "parsed",
      "parsed TCX → parsed",
    );
    assert(unlinkedImportStatus("gpx", true) === "parsed", "parsed GPX → parsed");
    assert(unlinkedImportStatus("fit", true) === "parsed", "parsed FIT → parsed");
    // No parser / no summary → honest placeholder.
    assert(unlinkedImportStatus("csv", true) === "uploaded", "CSV → uploaded");
    assert(
      unlinkedImportStatus("tcx", false) === "uploaded",
      "TCX without summary → uploaded",
    );
  });

  // ── DB-bound checks ───────────────────────────────────────────────────────
  const clerkId = await resolveDevClerkId();
  if (!clerkId) {
    skip("Ingest", "file → canonical session", "no seeded user_profiles row");
    return report();
  }

  // Use a far-future date to avoid colliding with real/seed sessions, and clean
  // up everything we create for this clerk on the chosen day.
  const START = "2031-03-15T08:00:00.000Z";
  const dedupeKey = computeActivityDedupeKey({ sport: "cycling", startedAt: START });

  const cleanup = async () => {
    const sessions = await db
      .select({ id: trainingSessionsTable.id })
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.clerkId, clerkId),
          eq(trainingSessionsTable.dedupeKey, dedupeKey),
        ),
      );
    const ids = sessions.map((s) => s.id);
    await db
      .delete(connectorActivitiesTable)
      .where(
        and(
          eq(connectorActivitiesTable.clerkId, clerkId),
          eq(connectorActivitiesTable.dedupeKey, dedupeKey),
        ),
      );
    if (ids.length > 0) {
      await db
        .delete(trainingSessionsTable)
        .where(inArray(trainingSessionsTable.id, ids));
    }
  };

  try {
    await cleanup();

    await run("Ingest", "file upload creates a canonical session + derives TSS", async () => {
      const tcx = sampleTcx(START);
      const r = await ingestActivityFile(
        clerkId,
        "tcx",
        parseTcx(tcx)!,
        fileExternalId(tcx, "ride.tcx"),
      );
      assert(r.sessionId != null, "session created");
      const [row] = await db
        .select()
        .from(trainingSessionsTable)
        .where(eq(trainingSessionsTable.id, r.sessionId!));
      assert(!!row, "session row exists");
      assert(row!.source === FILE_PROVIDER, `source = file → ${row!.source}`);
      assert(row!.sport === "cycling", "sport canonical");
      assert(row!.avgPower === 230, "power persisted");
      // TSS is derived from power + FTP at date when the athlete has an FTP.
      // We don't assert a specific number (depends on the seeded FTP), only that
      // the pipeline ran and the provenance row was written.
      const prov = await db
        .select()
        .from(connectorActivitiesTable)
        .where(
          and(
            eq(connectorActivitiesTable.clerkId, clerkId),
            eq(connectorActivitiesTable.provider, FILE_PROVIDER),
            eq(connectorActivitiesTable.dedupeKey, dedupeKey),
          ),
        );
      assert(prov.length === 1, `one provenance row → ${prov.length}`);
    });

    await run("Ingest", "re-upload of same file is idempotent (no duplicate)", async () => {
      const tcx = sampleTcx(START);
      await ingestActivityFile(
        clerkId,
        "tcx",
        parseTcx(tcx)!,
        fileExternalId(tcx, "ride.tcx"),
      );
      const sessions = await db
        .select({ id: trainingSessionsTable.id })
        .from(trainingSessionsTable)
        .where(
          and(
            eq(trainingSessionsTable.clerkId, clerkId),
            eq(trainingSessionsTable.dedupeKey, dedupeKey),
          ),
        );
      assert(sessions.length === 1, `still one session → ${sessions.length}`);
    });

    await run("Ingest", "file merges with a same-time connector ride (one row, both sources)", async () => {
      await cleanup();
      // First a "Strava" connector ride lands (no power).
      const stravaBatch: NormalizedBatch = {
        importedDataTypes: ["activities", "training_history"],
        activities: [
          {
            externalId: "strava-xyz",
            sport: "cycling",
            startedAt: START,
            durationMin: 60,
            distanceKm: 40,
            avgHR: 145,
          },
        ],
      };
      const allowed = new Set<ConnectorDataType>([
        "activities",
        "training_history",
      ]);
      await ingestBatch(clerkId, "strava", stravaBatch, { allowed });

      // Then the athlete uploads the FIT/TCX export of the SAME ride (has power).
      const tcx = sampleTcx(START);
      const r = await ingestActivityFile(
        clerkId,
        "tcx",
        parseTcx(tcx)!,
        fileExternalId(tcx, "ride.tcx"),
      );

      const sessions = await db
        .select()
        .from(trainingSessionsTable)
        .where(
          and(
            eq(trainingSessionsTable.clerkId, clerkId),
            eq(trainingSessionsTable.dedupeKey, dedupeKey),
          ),
        );
      assert(sessions.length === 1, `merged into ONE session → ${sessions.length}`);
      const s = sessions[0]!;
      assert(r.sessionId === s.id, "file linked to the merged session");
      const sources = (s.sources ?? []) as string[];
      assert(
        sources.includes("strava") && sources.includes(FILE_PROVIDER),
        `both sources on row → ${JSON.stringify(sources)}`,
      );
      // Existing (Strava) HR wins; the file fills the missing power.
      assert(s.avgHR === 145, "existing HR preserved");
      assert(s.avgPower === 230, "file filled missing power");
    });
  } finally {
    await cleanup();
  }

  report();
}

function report() {
  const pass = results.filter((r) => r.status === "pass").length;
  const fail = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  for (const r of results) {
    const icon = r.status === "pass" ? "✓" : r.status === "fail" ? "✗" : "–";
    console.log(
      `${icon} [${r.area}] ${r.check}${r.note ? ` — ${r.note}` : ""}`,
    );
  }
  console.log(`\n${pass} passed, ${fail} failed, ${skipped} skipped`);
  void pool.end();
  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  void pool.end();
  process.exit(1);
});
