// Sparki World — adaptive-feed learning loop test (DB-backed, end-to-end).
//
// The consistency harness (world-consistency) proves the learning effect on
// SYNTHETIC, in-memory feed-scoring inputs. This test closes the missing gap:
// it records REAL view/save/share interactions for a signed-in user, runs the
// real learnAffinity engine against the live DB, and asserts the LIVE feed
// ordering measurably shifts toward what the user behaved like. A regression
// here would silently make the personalised feed static without any error.
//
// It also guards the hard wall: affinity is DERIVED ONLY from in-world
// behaviour, never from real performance data. We prove this two ways:
//   1) On a clean slate (zero world interactions) learnAffinity returns an
//      empty model even when the viewer has real training data — real data is
//      never read into the model.
//   2) No real-performance table is written during the learning cycle.
//
// Requires a seeded world (`seed:sparki-world`) and at least one approved post
// (`sim:world-day`). The viewer is a real user_profiles row; the test cleans up
// its own follows / interactions / affinity afterwards so it is idempotent.

import { eq, and, sql, type SQL } from "drizzle-orm";
import {
  db,
  userProfilesTable,
  athleteProfilesTable,
  virtualAthletesTable,
  userVirtualAffinityTable,
  userVirtualFollowsTable,
  virtualInteractionsTable,
  trainingSessionsTable,
  plannedWorkoutsTable,
  trainingPlansTable,
  planDaysTable,
  workoutFeedbackTable,
  athleteDailyMetricsTable,
  ftpHistoryTable,
  connectorActivitiesTable,
  connectorConsentsTable,
  syncRunsTable,
  equipmentTable,
} from "@workspace/db";
import {
  getWorldFeed,
  recordView,
  toggleSave,
  recordShare,
  type FeedItem,
} from "../engines/world-feed";
import { learnAffinity } from "../engines/world-affinity";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    passed++;
    console.log(`  \u2713 ${name}`);
  } else {
    failed++;
    console.log(`  \u2717 ${name}${detail ? ` \u2014 ${detail}` : ""}`);
  }
}

// The dimensions learnAffinity is allowed to derive — all in-world attributes.
const ALLOWED_DIMENSIONS = new Set([
  "discipline",
  "archetype",
  "role",
  "expertise",
  "cohort",
  "level",
  "topic",
]);

// Count rows in every real-performance table that keys on the viewer. The wall
// holds only if learning touches none of these.
async function realPerformanceCounts(clerkId: string): Promise<Record<string, number>> {
  const count = async (
    label: string,
    table: Parameters<ReturnType<typeof db.select>["from"]>[0],
    where: SQL,
  ): Promise<[string, number]> => {
    const [row] = await db
      .select({ c: sql<number>`cast(count(*) as int)` })
      .from(table)
      .where(where);
    return [label, row?.c ?? 0];
  };

  const entries = await Promise.all([
    count("training_sessions", trainingSessionsTable, eq(trainingSessionsTable.clerkId, clerkId)),
    count("planned_workouts", plannedWorkoutsTable, eq(plannedWorkoutsTable.clerkId, clerkId)),
    count("training_plans", trainingPlansTable, eq(trainingPlansTable.clerkId, clerkId)),
    count("plan_days", planDaysTable, eq(planDaysTable.clerkId, clerkId)),
    count("workout_feedback", workoutFeedbackTable, eq(workoutFeedbackTable.clerkId, clerkId)),
    count("athlete_daily_metrics", athleteDailyMetricsTable, eq(athleteDailyMetricsTable.clerkId, clerkId)),
    count("ftp_history", ftpHistoryTable, eq(ftpHistoryTable.clerkId, clerkId)),
    count("connector_activities", connectorActivitiesTable, eq(connectorActivitiesTable.clerkId, clerkId)),
    count("connector_consents", connectorConsentsTable, eq(connectorConsentsTable.clerkId, clerkId)),
    count("sync_runs", syncRunsTable, eq(syncRunsTable.clerkId, clerkId)),
    count("equipment", equipmentTable, eq(equipmentTable.clerkId, clerkId)),
  ]);
  return Object.fromEntries(entries);
}

// Average position (0 = top) of the posts whose athlete is in `targetIds`.
function averageIndex(items: FeedItem[], targetIds: Set<number>): number {
  const idxs: number[] = [];
  items.forEach((it, i) => {
    if (targetIds.has(it.athlete.id)) idxs.push(i);
  });
  if (idxs.length === 0) return Number.POSITIVE_INFINITY;
  return idxs.reduce((a, b) => a + b, 0) / idxs.length;
}

async function cleanViewer(clerkId: string) {
  await db.delete(userVirtualAffinityTable).where(eq(userVirtualAffinityTable.clerkId, clerkId));
  await db.delete(userVirtualFollowsTable).where(eq(userVirtualFollowsTable.clerkId, clerkId));
  await db
    .delete(virtualInteractionsTable)
    .where(eq(virtualInteractionsTable.actorClerkId, clerkId));
}

async function main() {
  const [viewer] = await db
    .select({ clerkId: userProfilesTable.clerkId })
    .from(userProfilesTable)
    .limit(1);
  if (!viewer) {
    console.error("Geen user_profiles rij — kan affiniteit niet testen.");
    process.exit(1);
  }
  const clerkId = viewer.clerkId;

  await cleanViewer(clerkId);

  // The viewer's own discipline gets a profile-match boost regardless of
  // learning, so we deliberately learn a DIFFERENT discipline to isolate the
  // learned-affinity effect.
  const [vp] = await db
    .select({ discipline: athleteProfilesTable.discipline })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId));
  const myDiscipline = (vp?.discipline ?? "").toLowerCase();

  // ── WALL #1: real data is never read into the model ─────────────────────────
  // Clean slate (zero world interactions) must yield an EMPTY model, even if the
  // viewer has real training data. This proves the model is derived only from
  // in-world behaviour, not real performance.
  const realBefore = await realPerformanceCounts(clerkId);
  const realRowsTotal = Object.values(realBefore).reduce((a, b) => a + b, 0);
  const emptyModel = await learnAffinity(clerkId);
  check(
    "clean-slate learning yields an empty model (real data is not read)",
    emptyModel.rows === 0 && emptyModel.support === 0,
    `rows=${emptyModel.rows} support=${emptyModel.support} (viewer has ${realRowsTotal} real-perf rows)`,
  );

  // ── baseline feed ───────────────────────────────────────────────────────────
  // Use a large limit so every pooled post is returned in pure score order
  // (breadth-injection only triggers when picked < limit), giving a clean rank.
  const POOL_LIMIT = 200;
  const baseFeed = await getWorldFeed(clerkId, POOL_LIMIT);
  check("baseline feed returns approved posts", baseFeed.items.length > 0, `got ${baseFeed.items.length}`);
  if (baseFeed.items.length === 0) {
    console.error("Lege wereld-feed — seed:sparki-world + sim:world-day vereist.");
    process.exit(1);
  }

  // Pick the target discipline: the most-represented discipline in the feed that
  // is NOT the viewer's own. Deterministic (count desc, then name asc).
  const byDiscipline = new Map<string, number[]>(); // discipline -> athleteIds
  for (const it of baseFeed.items) {
    const d = (it.athlete.discipline ?? "").toLowerCase();
    if (!d || d === myDiscipline) continue;
    if (!byDiscipline.has(d)) byDiscipline.set(d, []);
    byDiscipline.get(d)!.push(it.athlete.id);
  }
  const ranked = [...byDiscipline.entries()]
    .map(([d, ids]) => ({ d, count: ids.length }))
    .sort((a, b) => b.count - a.count || a.d.localeCompare(b.d));
  check("a target discipline exists to learn", ranked.length > 0 && (ranked[0]?.count ?? 0) >= 2);
  if (ranked.length === 0) {
    console.error("Onvoldoende disciplinespreiding in de feed om te leren.");
    process.exit(1);
  }
  const targetDiscipline = ranked[0]!.d;

  // Posts (and their athletes) of the target discipline, drawn from the feed.
  const targetPosts = baseFeed.items.filter(
    (it) => (it.athlete.discipline ?? "").toLowerCase() === targetDiscipline,
  );
  const targetAthleteIds = new Set(targetPosts.map((p) => p.athlete.id));

  const baseAvg = averageIndex(baseFeed.items, targetAthleteIds);
  const basePersonalized = baseFeed.personalized;

  // ── record REAL view/save/share interactions on the target posts ───────────
  const interactPosts = targetPosts.slice(0, 8); // cap to keep the test quick
  let interactionRows = 0;
  for (const p of interactPosts) {
    const v = await recordView(clerkId, p.id);
    const s = await toggleSave(clerkId, p.id);
    const sh = await recordShare(clerkId, p.id);
    check(`view recorded for post ${p.id}`, !!v && v.viewed === true);
    check(`save recorded for post ${p.id}`, !!s && s.saved === true);
    check(`share recorded for post ${p.id}`, !!sh && sh.shared === true);
    interactionRows += 3;
  }
  check("recorded multiple interactions", interactionRows >= 6, `rows=${interactionRows}`);

  // ── WALL #2: snapshot real-performance counts right before learning ─────────
  const realPre = await realPerformanceCounts(clerkId);

  // ── learn ───────────────────────────────────────────────────────────────────
  const summary = await learnAffinity(clerkId);
  check("learning produced affinity rows", summary.rows > 0, `rows=${summary.rows}`);
  check(
    "support equals the number of interactions that fed the model",
    summary.support === interactionRows,
    `support=${summary.support} expected=${interactionRows}`,
  );

  // ── WALL #2 assertion: no real-performance table was written ────────────────
  const realPost = await realPerformanceCounts(clerkId);
  check(
    "no real-performance table changed during learning",
    JSON.stringify(realPre) === JSON.stringify(realPost),
    `pre=${JSON.stringify(realPre)} post=${JSON.stringify(realPost)}`,
  );

  // ── learned model only references in-world dimensions ───────────────────────
  const affRows = await db
    .select({
      dimension: userVirtualAffinityTable.dimension,
      key: userVirtualAffinityTable.key,
      score: userVirtualAffinityTable.score,
    })
    .from(userVirtualAffinityTable)
    .where(eq(userVirtualAffinityTable.clerkId, clerkId));
  check(
    "every learned dimension is an in-world attribute",
    affRows.every((r) => ALLOWED_DIMENSIONS.has(r.dimension)),
    affRows
      .filter((r) => !ALLOWED_DIMENSIONS.has(r.dimension))
      .map((r) => r.dimension)
      .join(", "),
  );
  const learnedDiscipline = affRows.find(
    (r) => r.dimension === "discipline" && r.key === targetDiscipline,
  );
  check(
    "the behaved-with discipline was learned",
    !!learnedDiscipline && learnedDiscipline.score > 0,
    `discipline=${targetDiscipline}`,
  );
  // The learned discipline keys must originate in the world (real data could
  // never introduce a key that isn't a Virtual Athlete's discipline).
  const worldDisciplines = new Set(
    (
      await db
        .select({ d: virtualAthletesTable.discipline })
        .from(virtualAthletesTable)
    )
      .map((r) => (r.d ?? "").toLowerCase())
      .filter(Boolean),
  );
  check(
    "learned discipline keys all exist in the world",
    affRows
      .filter((r) => r.dimension === "discipline")
      .every((r) => worldDisciplines.has(r.key)),
  );

  // ── the LIVE feed ordering measurably shifts toward the learned taste ───────
  const newFeed = await getWorldFeed(clerkId, POOL_LIMIT);
  const newAvg = averageIndex(newFeed.items, targetAthleteIds);
  check("feed is personalized after learning", newFeed.personalized === true);
  check(
    "learned posts moved measurably up the feed",
    newAvg < baseAvg,
    `avg index ${baseAvg.toFixed(2)} \u2192 ${newAvg.toFixed(2)} (lager = hoger in feed)`,
  );

  // At least one specific learned post strictly improved its rank.
  const baseRank = new Map(baseFeed.items.map((it, i) => [it.id, i]));
  const newRank = new Map(newFeed.items.map((it, i) => [it.id, i]));
  let improved = 0;
  for (const p of interactPosts) {
    const b = baseRank.get(p.id);
    const n = newRank.get(p.id);
    if (b != null && n != null && n < b) improved++;
  }
  check(
    "at least one behaved-with post climbed the ranking",
    improved > 0,
    `${improved}/${interactPosts.length} climbed`,
  );

  console.log(
    `  \u2139 basePersonalized=${basePersonalized} target="${targetDiscipline}" posts=${targetPosts.length}`,
  );

  // ── learning is deterministic (idempotent full rebuild) ─────────────────────
  const sig = (rows: { dimension: string; key: string; score: number }[]) =>
    rows
      .map((r) => `${r.dimension}|${r.key}|${r.score}`)
      .sort()
      .join("\n");
  const before = sig(affRows);
  await learnAffinity(clerkId);
  const affRows2 = await db
    .select({
      dimension: userVirtualAffinityTable.dimension,
      key: userVirtualAffinityTable.key,
      score: userVirtualAffinityTable.score,
    })
    .from(userVirtualAffinityTable)
    .where(eq(userVirtualAffinityTable.clerkId, clerkId));
  check("re-learning is deterministic (idempotent)", sig(affRows2) === before);

  // ── cleanup ─────────────────────────────────────────────────────────────────
  await cleanViewer(clerkId);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
