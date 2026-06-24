// Engine smoke-test harness.
//
// Verifies every engine's public entry points are reachable and behave through
// their typed interface — NOT through the old scattered lib/ helpers. It is a
// smoke test, not a unit suite: pure functions are asserted on known inputs, and
// read-only DB-bound entry points are exercised against a seeded dev user.
//
// Run: `pnpm --filter @workspace/api-server run test:smoke`
// Requires: DATABASE_URL. Pure-function checks always run; DB-bound checks are
// skipped (not failed) when no seeded user exists, so the harness is usable on a
// fresh database. Exits non-zero on any failure.

import { db, pool, userProfilesTable, athleteProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

import { computeZones } from "../engines/profile";
import { computeLoad, computeReadiness } from "../engines/recovery-load";
import {
  getContextObservations,
  getActiveObservations,
  getPreferences,
  styleDirective,
  formatObservationsForPrompt,
} from "../engines/coaching";
import {
  gatherInputs,
  checkCompleteness,
  buildSkeleton,
} from "../engines/training-plan";
import {
  selectRoutingProfile,
  profileToSurface,
  buildGpx,
  buildTcx,
} from "../engines/route";
import {
  getMissingOnboardingData,
  selectNextQuestions,
  estimateFtp,
} from "../engines/onboarding";
import {
  getRelevantKnowledge,
  getPersonalizedNews,
  knowledgeCount,
} from "../engines/knowledge";
import {
  connectorRegistry,
  getConnectorDefinition,
  isConnectorAvailable,
} from "../engines/integration";

type Status = "pass" | "fail" | "skip";
const results: { engine: string; check: string; status: Status; note?: string }[] =
  [];

async function run(
  engine: string,
  check: string,
  fn: () => void | Promise<void>,
) {
  try {
    await fn();
    results.push({ engine, check, status: "pass" });
  } catch (err) {
    results.push({
      engine,
      check,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

function skip(engine: string, check: string, note: string) {
  results.push({ engine, check, status: "skip", note });
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
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
  // ── Pure-function entry points (always runnable) ──────────────────────────
  await run("Profile", "computeZones", () => {
    const zones = computeZones(250);
    assert(zones.length === 6, "expected 6 zones");
    assert(zones[0]!.min === 0, "Z1 starts at 0");
  });

  await run("Recovery & Load", "computeLoad", () => {
    const load = computeLoad([
      { sessionDate: new Date().toISOString().split("T")[0]!, tss: 100 },
    ]);
    assert(
      typeof load.ctl === "number" &&
        typeof load.atl === "number" &&
        typeof load.tsb === "number",
      "load returns ctl/atl/tsb numbers",
    );
  });

  await run("Recovery & Load", "computeReadiness", () => {
    const r = computeReadiness(null);
    assert(typeof r.score === "number" || r.score === null, "readiness shape");
  });

  await run("Coaching", "styleDirective+format", () => {
    const directive = styleDirective(null);
    assert(typeof directive === "string", "styleDirective returns string");
    const prompt = formatObservationsForPrompt([]);
    assert(typeof prompt === "string", "formatObservationsForPrompt string");
  });

  await run("Route", "selectRoutingProfile", () => {
    const profile = selectRoutingProfile({
      sport: "cycling",
      bikeType: "racefiets",
    });
    assert(profile === "cycling-road", "racefiets → cycling-road");
    assert(typeof profileToSurface(profile) === "string", "surface string");
  });

  await run("Route", "buildGpx course points", () => {
    const geometry: [number, number][] = [
      [52.0, 4.0],
      [52.01, 4.01],
      [52.02, 4.02],
      [52.03, 4.03],
    ];
    // With nav cues → embedded Garmin course points + fallback waypoints.
    const withNav = buildGpx({
      name: "Test route",
      geometry,
      profile: [10, 20, 30, 40],
      nav: [
        { km: 0, dir: "Vertrek", note: "Start hier" },
        { km: 1.2, dir: "Links", note: "Sla linksaf" },
        { km: 2.5, dir: "Scherp rechts", note: "Scherp naar rechts" },
        { km: 3.4, dir: "Rechtdoor", note: "Blijf rechtdoor gaan" },
      ],
    });
    assert(withNav != null, "buildGpx returns gpx with nav");
    assert(
      withNav!.includes('xmlns:gpxx="http://www.garmin.com/xmlschemas/GpxExtensions/v3"'),
      "declares gpxx namespace when course points exist",
    );
    assert(
      withNav!.includes("<gpxx:CoursePointExtension>"),
      "embeds CoursePointExtension in track",
    );
    assert(
      withNav!.includes("<gpxx:PointType>Left</gpxx:PointType>"),
      "maps 'Links' → Left",
    );
    assert(
      withNav!.includes("<gpxx:PointType>Right</gpxx:PointType>"),
      "maps 'Scherp rechts' → Right",
    );
    assert(
      withNav!.includes("<gpxx:PointType>Straight</gpxx:PointType>"),
      "maps 'Rechtdoor' → Straight",
    );
    assert(
      withNav!.includes("<gpxx:PointType>Generic</gpxx:PointType>"),
      "maps 'Vertrek' → Generic",
    );
    assert(withNav!.includes("<wpt "), "keeps waypoint fallback");

    // Climbs → Summit course points anchored at the summit km, even with no nav.
    const withClimbs = buildGpx({
      name: "Climb route",
      geometry,
      profile: [10, 20, 30, 40],
      nav: null,
      climbs: [{ name: "Klim 1", summitKm: 2.5 }],
    });
    assert(withClimbs != null, "buildGpx returns gpx with climbs");
    assert(
      withClimbs!.includes("<gpxx:PointType>Summit</gpxx:PointType>"),
      "emits Summit course point for a climb",
    );
    assert(
      withClimbs!.includes("<gpxx:PointName>Klim 1</gpxx:PointName>"),
      "names the climb course point",
    );
    assert(
      withClimbs!.includes("<type>climb-summit</type>"),
      "keeps climb waypoint fallback",
    );
    // Climb without a finite summit km → never fabricated into a point.
    const badClimb = buildGpx({
      name: "Bad climb",
      geometry,
      profile: null,
      nav: null,
      climbs: [{ name: "Klim ?", summitKm: Number.NaN }],
    });
    assert(
      badClimb != null && !badClimb.includes("Summit"),
      "skips climbs without a summit position",
    );

    // No nav cues → plain track, no gpxx namespace, no course points (graceful).
    const noNav = buildGpx({ name: "Bare", geometry, profile: null, nav: null });
    assert(noNav != null, "buildGpx returns gpx without nav");
    assert(!noNav!.includes("gpxx"), "no gpxx namespace when no cues");
    assert(!noNav!.includes("<wpt "), "no waypoints when no cues");
    assert(!noNav!.includes("<extensions>"), "no course points when no cues");

    // No usable geometry → null (caller responds 422).
    assert(
      buildGpx({ name: "x", geometry: [], nav: null }) === null,
      "null on empty geometry",
    );
  });

  await run("Route", "buildTcx course points", () => {
    const geometry: [number, number][] = [
      [52.0, 4.0],
      [52.01, 4.01],
      [52.02, 4.02],
      [52.03, 4.03],
    ];
    // With nav cues → a TCX Course with embedded <CoursePoint> turn prompts.
    const withNav = buildTcx({
      name: "Test route",
      geometry,
      profile: [10, 20, 30, 40],
      durationSec: 600,
      nav: [
        { km: 0, dir: "Vertrek", note: "Start hier" },
        { km: 1.2, dir: "Links", note: "Sla linksaf" },
        { km: 2.5, dir: "Scherp rechts", note: "Scherp naar rechts" },
        { km: 3.4, dir: "Rechtdoor", note: "Blijf rechtdoor gaan" },
      ],
    });
    assert(withNav != null, "buildTcx returns tcx with nav");
    assert(
      withNav!.includes(
        'xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"',
      ),
      "declares TrainingCenterDatabase v2 namespace",
    );
    assert(
      withNav!.includes("<Course>") && withNav!.includes("<Lap>"),
      "emits Course + Lap structure",
    );
    assert(
      withNav!.includes("<CoursePoint>") && withNav!.includes("</CoursePoint>"),
      "emits CoursePoint turn prompts",
    );
    assert(
      withNav!.includes("<PointType>Left</PointType>"),
      "maps 'Links' → Left",
    );
    assert(
      withNav!.includes("<PointType>Right</PointType>"),
      "maps 'Scherp rechts' → Right",
    );
    assert(
      withNav!.includes("<PointType>Straight</PointType>"),
      "maps 'Rechtdoor' → Straight",
    );
    assert(
      withNav!.includes("<PointType>Generic</PointType>"),
      "maps 'Vertrek' → Generic",
    );
    assert(
      withNav!.includes("<AltitudeMeters>") &&
        withNav!.includes("<DistanceMeters>"),
      "emits real altitude + distance on trackpoints",
    );
    assert(withNav!.includes("<Time>"), "emits schema-required Time elements");

    // Summit mapping (TCX-only vocabulary beyond the gpxx set).
    const climb = buildTcx({
      name: "Klim",
      geometry,
      profile: [10, 20, 30, 40],
      durationSec: 600,
      nav: [{ km: 2.5, dir: "Top van de klim", note: "Boven" }],
    });
    assert(
      climb!.includes("<PointType>Summit</PointType>"),
      "maps 'Top'/'klim' → Summit",
    );

    // No nav cues → a plain course (still valid), no CoursePoint.
    const noNav = buildTcx({
      name: "Bare",
      geometry,
      profile: null,
      durationSec: null,
      nav: null,
    });
    assert(noNav != null, "buildTcx returns tcx without nav (nominal pace)");
    assert(
      !noNav!.includes("<CoursePoint>"),
      "no CoursePoint when no cues",
    );
    assert(
      noNav!.includes("<Track>") && noNav!.includes("<Trackpoint>"),
      "still emits a plain course track",
    );

    // No usable geometry → null (caller responds 422).
    assert(
      buildTcx({ name: "x", geometry: [], nav: null }) === null,
      "null on empty geometry",
    );
  });

  await run("Onboarding", "estimateFtp", () => {
    const ftp = estimateFtp("intermediate");
    assert(typeof ftp === "number" && ftp > 0, "estimateFtp positive");
  });

  await run("Integration", "registry", () => {
    assert(connectorRegistry.length > 0, "registry not empty");
    const strava = getConnectorDefinition("strava");
    assert(!!strava, "strava defined");
    assert(typeof isConnectorAvailable("strava") === "boolean", "availability");
  });

  // ── DB-bound read-only entry points (need a seeded user) ──────────────────
  let clerkId: string | null = null;
  try {
    clerkId = await resolveDevClerkId();
  } catch (err) {
    skip(
      "Harness",
      "resolveDevClerkId",
      err instanceof Error ? err.message : String(err),
    );
  }

  if (!clerkId) {
    for (const [engine, check] of [
      ["Training Plan", "gatherInputs"],
      ["Onboarding", "getMissingOnboardingData"],
      ["Onboarding", "selectNextQuestions"],
      ["Coaching", "observations+preferences"],
      ["Knowledge", "getRelevantKnowledge"],
      ["Knowledge", "getPersonalizedNews"],
    ] as const) {
      skip(engine, check, "no seeded user_profiles row");
    }
    // knowledgeCount needs no user.
    await run("Knowledge", "knowledgeCount", async () => {
      const n = await knowledgeCount();
      assert(typeof n === "number", "knowledgeCount number");
    });
  } else {
    const id = clerkId;
    await run("Training Plan", "gatherInputs+checkCompleteness", async () => {
      const inputs = await gatherInputs(id);
      assert(!!inputs, "gatherInputs returns inputs");
      const completeness = checkCompleteness(inputs);
      assert(typeof completeness.ready === "boolean", "completeness.ready bool");
      assert(Array.isArray(completeness.missing), "completeness.missing array");
      const skeleton = buildSkeleton(
        inputs,
        new Date().toISOString().split("T")[0]!,
      );
      assert(Array.isArray(skeleton), "buildSkeleton array");
    });

    await run("Onboarding", "getMissingOnboardingData", async () => {
      const missing = await getMissingOnboardingData(id);
      assert(typeof missing.complete === "boolean", "missing.complete bool");
    });

    await run("Onboarding", "selectNextQuestions", async () => {
      const [profile] = await db
        .select()
        .from(athleteProfilesTable)
        .where(eq(athleteProfilesTable.clerkId, id));
      if (!profile) {
        throw new Error("no athlete_profiles row for seeded user");
      }
      const questions = selectNextQuestions(profile, {});
      assert(Array.isArray(questions), "selectNextQuestions array");
    });

    await run("Coaching", "observations+preferences", async () => {
      const ctx = await getContextObservations(id);
      assert(Array.isArray(ctx), "context observations array");
      const active = await getActiveObservations(id);
      assert(Array.isArray(active), "active observations array");
      const prefs = await getPreferences(id);
      assert(prefs === null || typeof prefs === "object", "preferences shape");
    });

    await run("Knowledge", "getRelevantKnowledge", async () => {
      const sources = await getRelevantKnowledge({
        keywords: ["training", "endurance"],
      });
      assert(Array.isArray(sources), "knowledge sources array");
    });

    await run("Knowledge", "getPersonalizedNews", async () => {
      const news = await getPersonalizedNews({
        keywords: ["wielrennen", "training"],
      });
      assert(Array.isArray(news), "news array");
    });

    await run("Knowledge", "knowledgeCount", async () => {
      const n = await knowledgeCount();
      assert(typeof n === "number", "knowledgeCount number");
    });
  }

  // ── Report ────────────────────────────────────────────────────────────────
  const pass = results.filter((r) => r.status === "pass").length;
  const fail = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;

  for (const r of results) {
    const icon =
      r.status === "pass" ? "✓" : r.status === "fail" ? "✗" : "·";
    const note = r.note ? `  — ${r.note}` : "";
    // eslint-disable-next-line no-console
    console.log(`${icon} [${r.engine}] ${r.check}${note}`);
  }
  // eslint-disable-next-line no-console
  console.log(`\n${pass} passed, ${fail} failed, ${skipped} skipped`);

  await pool.end();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error("smoke harness crashed:", err);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
