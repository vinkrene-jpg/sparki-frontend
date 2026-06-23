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
import { selectRoutingProfile, profileToSurface } from "../engines/route";
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
