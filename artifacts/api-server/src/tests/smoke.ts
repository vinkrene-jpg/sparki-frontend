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

import {
  computeZones,
  COACHING_DIMENSIONS,
  dominantValue,
  parseCoachingAnswer,
} from "../engines/profile";
import {
  computeLoad,
  computeReadiness,
  computeRiskSignal,
} from "../engines/recovery-load";
import {
  getContextObservations,
  getActiveObservations,
  getPreferences,
  styleDirective,
  formatObservationsForPrompt,
  coachingProfileDirective,
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
  explainTopic,
  listTopics,
  resolveTopicKey,
} from "../engines/knowledge";
import {
  connectorRegistry,
  getConnectorDefinition,
  isConnectorAvailable,
  isStravaConfigured,
  buildStravaAuthorizeUrl,
} from "../engines/integration";
import {
  buildRaceIntel,
  buildPrepTimeline,
  buildRaceFuel,
  buildRaceDayReport,
} from "../engines/race";
import type { Race } from "@workspace/db";
import {
  deriveDerived,
  applyAnswers,
  fieldsToRacePatch,
  isSupportedMediaType,
} from "../engines/document-analysis";

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

  await run("Recovery & Load", "computeRiskSignal levels", () => {
    const fresh = computeReadiness(null);
    // A calm, balanced athlete → low risk.
    const low = computeRiskSignal({
      load: { ctl: 50, atl: 48, tsb: 2 },
      readiness: { ...fresh, label: "fresh" },
      healthStatus: "ok",
    });
    assert(low.level === "low", `expected low, got ${low.level}`);
    // Deep negative form + acute spike + tired → high risk.
    const high = computeRiskSignal({
      load: { ctl: 40, atl: 70, tsb: -32 },
      readiness: { ...fresh, label: "tired" },
      healthStatus: "ok",
    });
    assert(high.level === "high", `expected high, got ${high.level}`);
    assert(high.score > low.score, "high risk scores above low risk");
    assert(high.reasons.length > 0, "high risk lists reasons");
    // Injury is a hard override toward high.
    const injured = computeRiskSignal({
      load: { ctl: 50, atl: 48, tsb: 2 },
      readiness: { ...fresh, label: "fresh" },
      healthStatus: "injured",
    });
    assert(injured.level === "high", "injury → high risk");
  });

  await run("Profile", "coaching dimensions catalog", () => {
    assert(COACHING_DIMENSIONS.length === 8, "8 coaching dimensions");
    for (const d of COACHING_DIMENSIONS) {
      assert(d.options.length > 0, `${d.key} has options`);
      assert(typeof d.prompt === "string" && d.prompt.length > 0, "dutch prompt");
    }
  });

  await run("Profile", "dominantValue + parseCoachingAnswer", () => {
    // No evidence → no winner.
    assert(dominantValue(undefined) === null, "empty tally → null");
    // A single deliberate answer (weight 5) lands at high confidence.
    const got = dominantValue({ data_driven: 5 });
    assert(got?.value === "data_driven", "winner is data_driven");
    assert(got?.confidence === "high", "single direct answer → high");
    // Validation guards reject unknown keys/values.
    const key = COACHING_DIMENSIONS[0]!.key;
    const okValue = COACHING_DIMENSIONS[0]!.options[0]!.value;
    assert(parseCoachingAnswer(key, okValue)?.value === okValue, "valid parses");
    assert(parseCoachingAnswer("not_a_dimension", okValue) === null, "bad key");
    assert(parseCoachingAnswer(key, "bogus_value") === null, "bad value");
  });

  await run("Coaching", "coachingProfileDirective", () => {
    // Null profile + no motivation → empty (nothing to inject).
    assert(coachingProfileDirective(null) === "", "null profile → empty");
    // Motivation alone produces a directive even with no learned dimensions.
    const withMotivation = coachingProfileDirective(null, "ik wil het WK rijden");
    assert(
      withMotivation.includes("WK") || withMotivation.length > 0,
      "motivation injected",
    );
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
    assert(strava!.authType === "oauth", "strava is per-user OAuth");
    assert(typeof isConnectorAvailable("strava") === "boolean", "availability");
  });

  await run("Integration", "strava authorize URL", () => {
    // Temporarily provide credentials so we can validate the consent URL Sparki
    // builds (scopes, redirect_uri, state, response_type) without any network.
    const prevId = process.env.STRAVA_CLIENT_ID;
    const prevSecret = process.env.STRAVA_CLIENT_SECRET;
    process.env.STRAVA_CLIENT_ID = "test_client";
    process.env.STRAVA_CLIENT_SECRET = "test_secret";
    try {
      assert(isStravaConfigured() === true, "configured with creds");
      const redirectUri =
        "https://example.com/api/connectors/strava/callback";
      const url = buildStravaAuthorizeUrl({
        redirectUri,
        state: "user_abc",
      });
      const u = new URL(url);
      assert(
        u.origin + u.pathname === "https://www.strava.com/oauth/authorize",
        "points at Strava authorize endpoint",
      );
      assert(u.searchParams.get("client_id") === "test_client", "client_id");
      assert(u.searchParams.get("response_type") === "code", "response_type");
      assert(u.searchParams.get("redirect_uri") === redirectUri, "redirect_uri");
      assert(u.searchParams.get("state") === "user_abc", "state = athlete id");
      const scope = u.searchParams.get("scope") ?? "";
      assert(scope.includes("activity:read_all"), "requests activity scope");
      assert(scope.includes("profile:read_all"), "requests profile scope");
    } finally {
      if (prevId === undefined) delete process.env.STRAVA_CLIENT_ID;
      else process.env.STRAVA_CLIENT_ID = prevId;
      if (prevSecret === undefined) delete process.env.STRAVA_CLIENT_SECRET;
      else process.env.STRAVA_CLIENT_SECRET = prevSecret;
    }
  });

  await run("Race Intelligence", "buildRaceIntel (pure)", () => {
    // A fixed "today" keeps day-derived status deterministic.
    const today = new Date(2026, 5, 1); // 1 June 2026, local midnight
    const base: Race = {
      id: 42,
      clerkId: "user_test",
      name: "Omloop van het Houtland",
      raceDate: "2026-06-08", // 7 days out
      startTime: "13:00",
      location: "Lichtervelde",
      priority: "A",
      discipline: "weg",
      notes: null,
      plannedWorkoutId: null,
      travelDate: null,
      course: null,
      distanceKm: "120.00",
      elevationM: 850,
      technicalSections: "Kasseistrook op 30 km",
      weatherNote: null,
      teamName: null,
      teamInfo: null,
      coachInstructions: null,
      raceType: null,
      result: null,
      logistics: null,
      checklist: null,
      teamRiders: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const intel = buildRaceIntel(base, null, today);
    assert(intel.raceId === 42, "raceId echoed");
    assert(intel.daysUntil === 7, `daysUntil 7, got ${intel.daysUntil}`);

    // Prep timeline: 7/5/3/2/1 + race day = 6 milestones, exactly one active.
    assert(intel.prep.length === 6, "6 prep phases");
    const active = intel.prep.filter((p) => p.status === "active");
    assert(active.length === 1, `exactly one active phase, got ${active.length}`);
    assert(active[0]!.daysBefore === 7, "week-out phase active at 7 days");
    const techPhase = intel.prep.find((p) => p.askTechnicalGuide);
    assert(!!techPhase, "a phase asks for the technical guide");
    assert(techPhase!.daysBefore === 3, "technical-guide ask sits 3 days out");
    // distanceKm/elevation present ⇒ guide treated as received.
    assert(
      techPhase!.technicalGuideReceived === true,
      "guide marked received when course data exists",
    );

    // Report: distance + elevation known ⇒ honest course read, no fabrication.
    const course = intel.report.sections.find((s) => s.id === "koerskarakter");
    assert(!!course, "koerskarakter section present");
    assert(
      course!.items.find((i) => i.label === "Afstand")?.value === "120.00 km",
      "distance rendered from race data",
    );
    // weatherNote is null ⇒ it must be listed as a known gap, never invented.
    assert(
      intel.report.dataGaps.includes("weersinschatting"),
      "missing weather honestly flagged as a gap",
    );
    assert(
      intel.report.personalNote.includes(base.name),
      "personal note references the race",
    );

    // Fuel: 120 km @ weg(34 km/h) ≈ 212 min ⇒ long-race carb band + totals.
    const fuel = buildRaceFuel(base);
    assert(fuel.durationKnown === true, "duration derived from distance");
    assert(fuel.isEstimate === true, "duration always flagged as estimate");
    assert(
      fuel.carbsPerHourG.min === 60 && fuel.carbsPerHourG.max === 90,
      "long race ⇒ 60–90 g/h band",
    );
    assert(fuel.totalCarbsG != null, "totals computed when duration known");
    assert(fuel.tiers.length === 3, "three budget tiers");
    assert(
      fuel.tiers[0]!.id === "laag",
      "cheapest tier comes first (not the priciest by default)",
    );

    // Unknown distance ⇒ honest per-hour guidance, no fabricated totals.
    const noDistance = buildRaceFuel({ ...base, distanceKm: null });
    assert(noDistance.durationKnown === false, "no distance ⇒ duration unknown");
    assert(noDistance.totalCarbsG === null, "no totals without a distance");

    // Checklist groups: spread across days, electronica vs documenten split.
    assert(intel.checklistGroups.length >= 4, "multiple checklist groups");
    const elektronica = intel.checklistGroups.find((g) => g.id === "elektronica");
    assert(!!elektronica, "elektronica group present");
    assert(
      elektronica!.itemIds.length > 0 && elektronica!.itemLabels.length > 0,
      "checklist group carries persistable item ids + labels",
    );

    // A finished race (date in the past) ⇒ all phases done, none active.
    const past = buildPrepTimeline({ ...base, raceDate: "2026-05-01" }, today);
    assert(
      past.every((p) => p.status === "done"),
      "past race ⇒ every phase done",
    );

    // A sparse race ⇒ report stays honest (gaps listed, no invented values).
    const sparse = buildRaceDayReport(
      { ...base, distanceKm: null, elevationM: null, technicalSections: null },
      null,
      today,
    );
    assert(
      sparse.dataGaps.includes("afstand") &&
        sparse.dataGaps.includes("hoogtemeters"),
      "sparse race lists distance + elevation as gaps",
    );
    const sparseCourse = sparse.sections.find((s) => s.id === "koerskarakter");
    assert(
      sparseCourse!.items.every((i) => i.label !== "Afstand" || !i.known),
      "no distance value fabricated when unknown",
    );
  });

  await run("Knowledge", "topic library (pure)", () => {
    const topics = listTopics();
    assert(topics.length === 4, "4 core topics");
    assert(resolveTopicKey("leg de trainingszones uit") === "zones", "zones alias");
    assert(resolveTopicKey("hoe herstel ik?") === "recovery", "recovery alias");
    assert(resolveTopicKey("voeding voor de race") === "nutrition", "nutrition");
    assert(resolveTopicKey("iets totaal onbekends xyz") === null, "unknown → null");
  });

  await run("Document Analysis", "derive + answers + race patch (pure)", () => {
    assert(isSupportedMediaType("application/pdf"), "pdf supported");
    assert(isSupportedMediaType("image/png"), "png supported");
    assert(!isSupportedMediaType("text/plain"), "txt rejected");

    const fields = {
      startTime: { key: "startTime", value: "10:30", confidence: "high" as const },
      distanceKm: { key: "distanceKm", value: null, confidence: null },
      startLocation: {
        key: "startLocation",
        value: "Gent",
        confidence: "low" as const,
      },
    };
    const d = deriveDerived(fields);
    assert(d.foundFields.includes("startTime"), "startTime found");
    assert(d.missingFields.includes("distanceKm"), "distanceKm missing");
    // A low-confidence value earns a confirm question; missing fields earn one too.
    assert(
      d.followUpQuestions.some((q) => q.toLowerCase().includes("kilometer")),
      "asks for distance",
    );
    assert(
      d.followUpQuestions.some((q) => q.includes("Gent")),
      "confirms low-confidence value",
    );

    const merged = applyAnswers(fields, { distanceKm: "142" });
    assert(
      merged.foundFields.includes("distanceKm"),
      "answered field becomes found",
    );

    const patch = fieldsToRacePatch(merged.extractedFields);
    assert(patch.startTime === "10:30", "race patch maps startTime");
    assert(patch.distanceKm === "142", "race patch maps distance");
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
    // knowledgeCount + explainTopic need no user (explainTopic reads the global
    // library, but works on an empty one — sources simply come back empty).
    await run("Knowledge", "knowledgeCount", async () => {
      const n = await knowledgeCount();
      assert(typeof n === "number", "knowledgeCount number");
    });
    await run("Knowledge", "explainTopic", async () => {
      const zones = await explainTopic("trainingszones");
      assert(zones?.topic === "zones", "explains zones");
      assert(zones!.summary.length > 0 && zones!.keyPoints.length > 0, "has body");
      assert(Array.isArray(zones!.sources), "sources array");
      assert((await explainTopic("onbekend xyz")) === null, "unknown → null");
    });
  } else {
    const id = clerkId;
    await run("Training Plan", "gatherInputs+checkCompleteness", async () => {
      const inputs = await gatherInputs(id);
      assert(!!inputs, "gatherInputs returns inputs");
      assert(!!inputs.load && typeof inputs.load.tsb === "number", "load present");
      assert(
        ["low", "moderate", "high"].includes(inputs.risk.level),
        "risk level present",
      );
      const completeness = checkCompleteness(inputs);
      assert(typeof completeness.ready === "boolean", "completeness.ready bool");
      assert(Array.isArray(completeness.missing), "completeness.missing array");
      const start = new Date().toISOString().split("T")[0]!;
      const skeleton = buildSkeleton(inputs, start);
      assert(Array.isArray(skeleton), "buildSkeleton array");

      // Behavioural: the same athlete under a forced HIGH risk signal must not
      // train MORE in the committed week than under a forced LOW signal. The
      // plan adapts down to risk.
      const trainingMin = (days: typeof skeleton) =>
        days
          .slice(0, 7)
          .reduce((sum, d) => sum + (d.isRest ? 0 : d.estDurationMin ?? 0), 0);
      const lowPlan = buildSkeleton(
        { ...inputs, risk: { ...inputs.risk, level: "low" } },
        start,
      );
      const highPlan = buildSkeleton(
        { ...inputs, risk: { ...inputs.risk, level: "high" } },
        start,
      );
      assert(
        trainingMin(highPlan) <= trainingMin(lowPlan),
        "high-risk week volume ≤ low-risk week volume",
      );
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
