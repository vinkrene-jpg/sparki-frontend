// Data Hub pipeline test harness.
//
// Exercises the central ingest → validate → dedup → merge → consent → provenance
// path against the REAL dev database, then cleans up after itself. Proves the
// core promise: the same ride arriving from two sources collapses into ONE
// canonical session carrying both sources.
//
// Run: `pnpm --filter @workspace/api-server run test:data-hub`
// Requires: DATABASE_URL + a seeded user_profiles row (skips DB-bound checks
// otherwise). Pure-function checks always run. Exits non-zero on any failure.

import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  trainingSessionsTable,
  connectorActivitiesTable,
  type ConnectorDataType,
} from "@workspace/db";
import {
  computeActivityDedupeKey,
  candidateDedupeKeys,
  buildMergePatch,
  mergeSources,
  buildMergeLogEntry,
  deriveSourceConflicts,
  type MergeLogEntry,
  normalizeSport,
  matchSport,
  cleanActivity,
  resolveReadiness,
  ingestBatch,
  effectiveImportedDataTypes,
  type NormalizedBatch,
} from "../engines/data-hub";
import { getConnectorDefinition } from "../engines/integration";

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

const ALL_ALLOWED = (): Set<ConnectorDataType> =>
  new Set<ConnectorDataType>([
    "activities",
    "training_history",
    "ftp",
    "hrv",
    "resting_hr",
    "sleep",
    "recovery",
    "weight",
  ]);

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
  await run("Sports", "normalizeSport + matchSport", () => {
    assert(normalizeSport("Ride") === "cycling", "Strava 'Ride' → cycling");
    assert(normalizeSport("VirtualRide") === "cycling", "VirtualRide → cycling");
    assert(normalizeSport("Run") === "running", "Run → running");
    assert(matchSport("OpenWaterSwim") === "swimming", "OpenWaterSwim → swimming");
    assert(matchSport("MountainBikeRide") === "mountainbike", "MTB → mountainbike");
    assert(matchSport("totally-unknown") === null, "unknown → null (strict)");
    assert(normalizeSport("totally-unknown") === "cycling", "unknown → cycling default");
  });

  await run("Dedupe", "same ride from two sources detected as duplicate", () => {
    // Realistic cross-source drift: 2.5 min start offset, duration/distance off
    // by ~1%. Matching uses neighbour-bucket candidates, not exact key equality.
    const garmin = computeActivityDedupeKey({
      sport: "cycling",
      startedAt: "2026-06-20T07:00:00.000Z",
    });
    const stravaCandidates = candidateDedupeKeys({
      sport: "cycling",
      startedAt: "2026-06-20T07:02:30.000Z",
    });
    assert(
      stravaCandidates.includes(garmin),
      `strava candidates ${JSON.stringify(stravaCandidates)} must include garmin key ${garmin}`,
    );

    const otherSport = computeActivityDedupeKey({
      sport: "running",
      startedAt: "2026-06-20T07:00:00.000Z",
    });
    assert(otherSport !== garmin, "different sport → different key");
    assert(
      !stravaCandidates.includes(otherSport),
      "different sport never matches",
    );
  });

  await run("Dedupe", "buildMergePatch fills gaps, existing wins", () => {
    const existing = { avgPower: 240, avgHR: null, tss: null, title: "Ochtendrit" };
    const incoming = { avgPower: 999, avgHR: 152, tss: 81, title: "Morning Ride" };
    const patch = buildMergePatch(existing, incoming);
    assert(patch.avgPower === undefined, "existing avgPower preserved");
    assert(patch.avgHR === 152, "missing avgHR filled");
    assert(patch.tss === 81, "missing tss filled");
    assert(patch.title === undefined, "existing title preserved");
  });

  await run("Dedupe", "mergeSources dedupes provider set", () => {
    const merged = mergeSources(["garmin"], "strava");
    assert(merged.length === 2 && merged.includes("strava"), "two sources");
    const again = mergeSources(merged, "strava");
    assert(again.length === 2, "no duplicate source");
  });

  await run("Dedupe", "bronconflict vastgelegd en terugvindbaar per veld", () => {
    // Strava 250 W staat al; het bestand biedt 243 W aan. Sparki houdt stil
    // de bestaande waarde, maar het verschil moet als conflict terug te
    // vinden zijn: welke bronnen, welke waarden, welke gekozen.
    const existing = {
      avgPower: 250,
      avgHR: null,
      fieldSources: { avgPower: "strava" },
      manualFields: null,
    };
    const incoming = { avgPower: 243, avgHR: 149 };
    const patch = buildMergePatch(existing, incoming);
    const entry = buildMergeLogEntry(existing, incoming, patch, "file", [
      "strava",
      "file",
    ]);
    const conflicts = deriveSourceConflicts([entry]);
    assert(conflicts.length === 1, "exactly one field conflict");
    const c = conflicts[0]!;
    assert(c.field === "avgPower", "conflict on avgPower");
    assert(c.chosen === 250 && c.chosenSource === "strava", "chosen = strava 250");
    assert(c.offered === 243 && c.offeredSource === "file", "offered = file 243");

    // Latere merge van hetzelfde veld overschrijft de oudere constatering.
    const entry2: MergeLogEntry = {
      ...entry,
      at: "2026-07-30T10:00:00.000Z",
      source: "garmin",
      differences: [
        { field: "avgPower", kept: 250, offered: 247, keptSource: "strava" },
      ],
    };
    const latest = deriveSourceConflicts([entry, entry2]);
    assert(latest.length === 1, "still one row per field");
    assert(
      latest[0]!.offered === 247 && latest[0]!.offeredSource === "garmin",
      "recentste conflict wint",
    );
    assert(deriveSourceConflicts(null).length === 0, "geen log → geen conflicten");
  });

  await run("Validation", "cleanActivity rejects junk", () => {
    const ok = cleanActivity({
      externalId: "1",
      sport: "cycling",
      startedAt: "2026-06-20T07:00:00.000Z",
      durationMin: 92,
    });
    assert(!!ok, "valid activity accepted");
    const bad = cleanActivity({
      externalId: "",
      sport: "cycling",
      startedAt: "not-a-date",
    });
    assert(bad === null, "invalid activity rejected");
  });

  await run(
    "Consent",
    "effectiveImportedDataTypes never claims blocked activity import",
    () => {
      const batch: NormalizedBatch = {
        importedDataTypes: ["activities", "training_history", "ftp"],
        activities: [
          {
            externalId: "1",
            sport: "cycling",
            startedAt: "2026-06-20T07:00:00.000Z",
            durationMin: 60,
          },
        ],
      };

      // Both consents present + activities fetched → claimed.
      const full = effectiveImportedDataTypes(batch, ALL_ALLOWED());
      assert(full.includes("activities"), "activities claimed when allowed");
      assert(
        full.includes("training_history"),
        "training_history claimed when allowed",
      );
      assert(full.includes("ftp"), "non-activity type untouched");

      // Revoke "activities" only → AND gate blocks BOTH activity types, ftp stays.
      const noActivities = ALL_ALLOWED();
      noActivities.delete("activities");
      const r1 = effectiveImportedDataTypes(batch, noActivities);
      assert(!r1.includes("activities"), "activities dropped when revoked");
      assert(
        !r1.includes("training_history"),
        "training_history dropped when activities revoked (AND gate)",
      );
      assert(r1.includes("ftp"), "ftp still reported");

      // Revoke "training_history" only → same: both activity types dropped.
      const noHistory = ALL_ALLOWED();
      noHistory.delete("training_history");
      const r2 = effectiveImportedDataTypes(batch, noHistory);
      assert(
        !r2.includes("activities") && !r2.includes("training_history"),
        "both activity types dropped when training_history revoked",
      );

      // No activities fetched → never claim activity import even with full consent.
      const empty: NormalizedBatch = {
        importedDataTypes: ["activities", "training_history"],
        activities: [],
      };
      const r3 = effectiveImportedDataTypes(empty, ALL_ALLOWED());
      assert(
        !r3.includes("activities") && !r3.includes("training_history"),
        "no activity claim when nothing fetched",
      );
    },
  );

  await run("Readiness", "4-state resolution", () => {
    const strava = getConnectorDefinition("strava")!;
    const r1 = resolveReadiness(strava, undefined);
    assert(r1.state === "beschikbaar", "strava idle → beschikbaar");
    const r2 = resolveReadiness(strava, "connected");
    assert(r2.state === "actief", "strava connected → actief");
    const garmin = getConnectorDefinition("garmin")!;
    const r3 = resolveReadiness(garmin, undefined);
    assert(
      r3.state === "testbaar" || r3.state === "voorbereid",
      "garmin idle → testbaar/voorbereid (not beschikbaar)",
    );
    assert(r3.available === false, "garmin not available yet");
  });

  // ── DB-bound integration check: two-source merge ──────────────────────────
  let clerkId: string | null = null;
  try {
    clerkId = await resolveDevClerkId();
  } catch (err) {
    skip("Harness", "resolveDevClerkId", err instanceof Error ? err.message : String(err));
  }

  if (!clerkId) {
    skip("Ingest", "two-source duplicate → one merged session", "no seeded user");
  } else {
    const id = clerkId;
    // Unique, far-future marker so we never collide with real data and can
    // clean up precisely by externalRef.
    const startedAt = "2099-01-02T06:30:00.000Z";
    const cleanup = async () => {
      const acts = await db
        .select({ sid: connectorActivitiesTable.normalizedSessionId })
        .from(connectorActivitiesTable)
        .where(
          and(
            eq(connectorActivitiesTable.clerkId, id),
            inArray(connectorActivitiesTable.provider, ["garmin", "strava"]),
            inArray(connectorActivitiesTable.externalActivityId, [
              "test-garmin-1",
              "test-strava-1",
            ]),
          ),
        );
      await db
        .delete(connectorActivitiesTable)
        .where(
          and(
            eq(connectorActivitiesTable.clerkId, id),
            inArray(connectorActivitiesTable.externalActivityId, [
              "test-garmin-1",
              "test-strava-1",
            ]),
          ),
        );
      const sids = acts.map((a) => a.sid).filter((s): s is number => s != null);
      if (sids.length > 0) {
        await db
          .delete(trainingSessionsTable)
          .where(
            and(
              eq(trainingSessionsTable.clerkId, id),
              inArray(trainingSessionsTable.id, sids),
            ),
          );
      }
    };

    await run("Ingest", "two-source duplicate → one merged session", async () => {
      await cleanup();
      try {
        // Source 1: Garmin — has HR + cadence, no power.
        const garminBatch: NormalizedBatch = {
          importedDataTypes: ["activities"],
          activities: [
            {
              externalId: "test-garmin-1",
              sport: "cycling",
              startedAt,
              durationMin: 92,
              distanceKm: 48.2,
              avgHR: 151,
              avgCadence: 88,
              raw: { src: "garmin" },
            },
          ],
        };
        const c1 = await ingestBatch(id, "garmin", garminBatch, {
          allowed: ALL_ALLOWED(),
        });
        assert(c1.activities === 1, "garmin inserts 1 new session");

        // Source 2: Strava — SAME ride (within buckets) + power, no cadence.
        const stravaBatch: NormalizedBatch = {
          importedDataTypes: ["activities"],
          activities: [
            {
              externalId: "test-strava-1",
              sport: "cycling",
              startedAt: "2099-01-02T06:32:00.000Z",
              durationMin: 93,
              distanceKm: 48.4,
              avgPower: 238,
              normalizedPower: 251,
              raw: { src: "strava" },
            },
          ],
        };
        const c2 = await ingestBatch(id, "strava", stravaBatch, {
          allowed: ALL_ALLOWED(),
        });
        assert(c2.merged === 1, "strava merges into existing (not a new row)");
        assert((c2.activities ?? 0) === 0, "strava adds no new session");

        // Verify the single canonical session carries both sources + fields.
        const dedupeKey = computeActivityDedupeKey({
          sport: "cycling",
          startedAt,
          durationMin: 92,
          distanceKm: 48.2,
        });
        const sessions = await db
          .select()
          .from(trainingSessionsTable)
          .where(
            and(
              eq(trainingSessionsTable.clerkId, id),
              eq(trainingSessionsTable.dedupeKey, dedupeKey),
            ),
          );
        assert(sessions.length === 1, `exactly one merged session (got ${sessions.length})`);
        const s = sessions[0]!;
        assert(
          (s.sources ?? []).includes("garmin") && (s.sources ?? []).includes("strava"),
          `both sources recorded (got ${JSON.stringify(s.sources)})`,
        );
        assert(s.avgHR === 151, "HR from garmin retained");
        assert(s.avgCadence === 88, "cadence from garmin retained");
        assert(s.avgPower === 238, "power filled from strava");
        assert(s.normalizedPower === 251, "NP filled from strava");

        // Two provenance rows, both pointing at the one session.
        const prov = await db
          .select()
          .from(connectorActivitiesTable)
          .where(
            and(
              eq(connectorActivitiesTable.clerkId, id),
              eq(connectorActivitiesTable.dedupeKey, dedupeKey),
            ),
          );
        assert(prov.length === 2, `two provenance rows (got ${prov.length})`);
        assert(
          prov.every((p) => p.normalizedSessionId === s.id),
          "both provenance rows link the merged session",
        );
      } finally {
        await cleanup();
      }
    });

    await run(
      "Ingest",
      "consent: revoking ONE activity type cannot be bypassed by the other",
      async () => {
        await cleanup();
        try {
          const batch: NormalizedBatch = {
            importedDataTypes: ["activities"],
            activities: [
              {
                externalId: "test-garmin-1",
                sport: "cycling",
                startedAt,
                durationMin: 92,
                distanceKm: 48.2,
              },
            ],
          };
          // Everything allowed EXCEPT "activities" — "training_history" is still
          // granted. Strict AND gating must still block ingestion (no bypass).
          const allowedMinusActivities = ALL_ALLOWED();
          allowedMinusActivities.delete("activities");
          const c1 = await ingestBatch(id, "garmin", batch, {
            allowed: allowedMinusActivities,
          });
          assert(
            (c1.activities ?? 0) === 0,
            "activity blocked when only 'activities' revoked",
          );

          // Conversely, revoking only "training_history" must also block.
          const allowedMinusHistory = ALL_ALLOWED();
          allowedMinusHistory.delete("training_history");
          const c2 = await ingestBatch(id, "garmin", batch, {
            allowed: allowedMinusHistory,
          });
          assert(
            (c2.activities ?? 0) === 0,
            "activity blocked when only 'training_history' revoked",
          );

          // Both granted → ingests.
          const c3 = await ingestBatch(id, "garmin", batch, {
            allowed: ALL_ALLOWED(),
          });
          assert((c3.activities ?? 0) === 1, "activity ingested when both granted");
        } finally {
          await cleanup();
        }
      },
    );
  }

  // ── Report ────────────────────────────────────────────────────────────────
  const pass = results.filter((r) => r.status === "pass").length;
  const fail = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  for (const r of results) {
    const icon = r.status === "pass" ? "✓" : r.status === "fail" ? "✗" : "·";
    const note = r.note ? `  — ${r.note}` : "";
    // eslint-disable-next-line no-console
    console.log(`${icon} [${r.area}] ${r.check}${note}`);
  }
  // eslint-disable-next-line no-console
  console.log(`\n${pass} passed, ${fail} failed, ${skipped} skipped`);
  await pool.end();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error("data-hub harness crashed:", err);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
