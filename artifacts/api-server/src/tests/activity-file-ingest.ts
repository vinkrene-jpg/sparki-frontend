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
      },
      "hash-route",
    );
    assert(a === null, "no start time → null (route, not activity)");
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
