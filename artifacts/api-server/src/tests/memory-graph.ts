// Memory-graph (cross-domain connection) test harness.
//
// Proves Sparki's deterministic correlation layer: pure-function confidence
// math always runs; the DB-bound checks seed a clean, far-future cross-domain
// pattern (short sleep ↔ low training feel) for the dev user, run the REAL
// gather → derive pipeline, and assert the connection comes back fully
// explainable (signals + confidenceScore + alternativeExplanations). It also
// round-trips persistObservation's new columns. Everything seeded is cleaned
// up afterwards — no fabricated data leaks into real memory.
//
// Run: `pnpm --filter @workspace/api-server run test:memory-graph`
// Requires: DATABASE_URL + a seeded user_profiles row (skips DB-bound checks
// otherwise). Pure-function checks always run. Exits non-zero on any failure.

import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  userProfilesTable,
  trainingSessionsTable,
  athleteDailyMetricsTable,
  aiObservationsTable,
} from "@workspace/db";
import type {
  Race,
  AthleteDailyMetric,
  TrainingSession,
  AiObservation,
} from "@workspace/db";
import { gatherSignals, type SignalBundle } from "../engines/memory-graph/gather";
import { deriveConnections } from "../engines/memory-graph/correlations";
import { runConnectionAnalysis } from "../engines/memory-graph";
import { buildConfidence, scoreToConfidence } from "../engines/memory-graph/types";
import { persistObservation } from "../lib/ai-memory";

// Build a minimal in-memory SignalBundle for pure correlation tests. Only the
// fields the rules actually read are populated; the rest are cast through to
// keep the harness focused on behaviour, not row plumbing.
function makeBundle(parts: {
  sessions?: { date: string; feel?: number; tss?: number; durationMin?: number }[];
  metrics?: { date: string; sleep?: number; rhr?: number; hrv?: number }[];
  races?: {
    name: string;
    date: string;
    status?: "finished" | "dnf" | "dns" | "dsq";
    position?: number;
    fieldSize?: number;
  }[];
}): SignalBundle {
  const sessions = (parts.sessions ?? []).map(
    (s) =>
      ({
        sessionDate: s.date,
        feelScore: s.feel ?? null,
        tss: s.tss ?? null,
        durationMin: s.durationMin ?? null,
      }) as unknown as TrainingSession,
  );
  const metrics = (parts.metrics ?? []).map(
    (m) =>
      ({
        metricDate: m.date,
        sleepHours: m.sleep != null ? m.sleep.toFixed(2) : null,
        restingHR: m.rhr ?? null,
        hrv: m.hrv ?? null,
        feelScore: null,
      }) as unknown as AthleteDailyMetric,
  );
  const races = (parts.races ?? []).map(
    (r) =>
      ({
        name: r.name,
        raceDate: r.date,
        result: {
          status: r.status ?? "finished",
          position: r.position ?? null,
          fieldSize: r.fieldSize ?? null,
        },
      }) as unknown as Race,
  );
  return {
    windowDays: 45,
    sessions,
    metrics,
    races,
    feedback: [],
    priorObservations: [] as AiObservation[],
  };
}

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

// Far-future marker dates so seeded rows never collide with real data and can
// be cleaned up precisely. They still fall inside the gather window (gte cutoff).
const SEED_DATES = [
  "2099-01-01",
  "2099-01-02",
  "2099-01-03",
  "2099-01-04",
  "2099-01-05",
  "2099-01-06",
];
// Short nights → low feel, normal nights → good feel. A deliberate, clean
// pattern so the sleep→feel rule must fire.
const SEED = [
  { date: "2099-01-01", sleep: "5.00", feel: 2 },
  { date: "2099-01-02", sleep: "5.20", feel: 2 },
  { date: "2099-01-03", sleep: "8.00", feel: 4 },
  { date: "2099-01-04", sleep: "8.20", feel: 4 },
  { date: "2099-01-05", sleep: "7.80", feel: 5 },
  { date: "2099-01-06", sleep: "5.10", feel: 2 },
];

async function cleanupSeed(clerkId: string) {
  await db
    .delete(trainingSessionsTable)
    .where(
      and(
        eq(trainingSessionsTable.clerkId, clerkId),
        inArray(trainingSessionsTable.sessionDate, SEED_DATES),
      ),
    );
  await db
    .delete(athleteDailyMetricsTable)
    .where(
      and(
        eq(athleteDailyMetricsTable.clerkId, clerkId),
        inArray(athleteDailyMetricsTable.metricDate, SEED_DATES),
      ),
    );
}

async function main() {
  // ── Pure-function checks (always runnable) ────────────────────────────────
  await run("Confidence", "buildConfidence is honest and clamped", () => {
    const high = buildConfidence({ sample: 8, effect: 1, agreement: 1 });
    assert(high <= 0.95, "never reaches certainty (≤0.95)");
    assert(high >= 0.7, `strong evidence → high score, got ${high}`);

    const weak = buildConfidence({ sample: 1, effect: 0, agreement: 0 });
    assert(weak >= 0.1, "floored at 0.1");
    assert(weak < 0.4, `thin evidence → low score, got ${weak}`);

    const base = buildConfidence({ sample: 5, effect: 0.5, agreement: 0.5 });
    const boosted = buildConfidence({
      sample: 5,
      effect: 0.5,
      agreement: 0.5,
      memoryReinforced: true,
    });
    assert(boosted > base, "memory reinforcement raises confidence");
    assert(boosted - base <= 0.1 + 1e-9, "reinforcement boost is bounded (≤0.1)");
  });

  await run("Confidence", "scoreToConfidence thresholds", () => {
    assert(scoreToConfidence(0.8) === "high", "0.8 → high");
    assert(scoreToConfidence(0.5) === "medium", "0.5 → medium");
    assert(scoreToConfidence(0.2) === "low", "0.2 → low");
  });

  // ── Rule C honesty: only claims a recovery↔race link when MEASURED ─────────
  await run("Rule C", "fires on a real pre-race recovery ↔ result association", () => {
    // Better sleep before the race lines up with a better (lower-ratio) result.
    const bundle = makeBundle({
      races: [
        { name: "Ronde A", date: "2099-02-10", position: 2, fieldSize: 100 },
        { name: "Ronde B", date: "2099-02-20", position: 80, fieldSize: 100 },
        { name: "Ronde C", date: "2099-03-02", position: 10, fieldSize: 100 },
        { name: "Ronde D", date: "2099-03-12", position: 70, fieldSize: 100 },
      ],
      metrics: [
        // 3 days before Ronde A → good sleep
        { date: "2099-02-09", sleep: 8.0 },
        { date: "2099-02-08", sleep: 8.0 },
        { date: "2099-02-07", sleep: 8.0 },
        // before Ronde B → poor sleep
        { date: "2099-02-19", sleep: 5.0 },
        { date: "2099-02-18", sleep: 5.0 },
        { date: "2099-02-17", sleep: 5.0 },
        // before Ronde C → good sleep
        { date: "2099-03-01", sleep: 7.8 },
        { date: "2099-02-28", sleep: 7.8 },
        { date: "2099-02-27", sleep: 7.8 },
        // before Ronde D → poor sleep
        { date: "2099-03-11", sleep: 5.2 },
        { date: "2099-03-10", sleep: 5.2 },
        { date: "2099-03-09", sleep: 5.2 },
      ],
    });
    const conn = deriveConnections(bundle).find(
      (c) => c.dedupeKey === "conn:recovery-race",
    );
    assert(!!conn, "association present → connection fires");
    assert(conn!.signals.length > 0, "fired connection carries signals");
    assert(
      conn!.confidenceScore > 0.1 && conn!.confidenceScore <= 0.95,
      "confidence within honest bounds",
    );
  });

  await run("Rule C", "stays silent when recovery and result do NOT line up", () => {
    // Anti-association: good sleep → bad result and vice versa.
    const bundle = makeBundle({
      races: [
        { name: "Ronde A", date: "2099-04-05", position: 80, fieldSize: 100 },
        { name: "Ronde B", date: "2099-04-15", position: 5, fieldSize: 100 },
        { name: "Ronde C", date: "2099-04-25", position: 75, fieldSize: 100 },
        { name: "Ronde D", date: "2099-05-05", position: 10, fieldSize: 100 },
      ],
      metrics: [
        { date: "2099-04-04", sleep: 8.0 },
        { date: "2099-04-03", sleep: 8.0 },
        { date: "2099-04-02", sleep: 8.0 },
        { date: "2099-04-14", sleep: 5.0 },
        { date: "2099-04-13", sleep: 5.0 },
        { date: "2099-04-12", sleep: 5.0 },
        { date: "2099-04-24", sleep: 7.8 },
        { date: "2099-04-23", sleep: 7.8 },
        { date: "2099-04-22", sleep: 7.8 },
        { date: "2099-05-04", sleep: 5.2 },
        { date: "2099-05-03", sleep: 5.2 },
        { date: "2099-05-02", sleep: 5.2 },
      ],
    });
    const conn = deriveConnections(bundle).find(
      (c) => c.dedupeKey === "conn:recovery-race",
    );
    assert(!conn, "no measured association → no connection (no over-claim)");
  });

  await run("Rule C", "stays silent with too few races to judge", () => {
    const bundle = makeBundle({
      races: [
        { name: "Ronde A", date: "2099-02-10", position: 2, fieldSize: 100 },
        { name: "Ronde B", date: "2099-02-20", position: 80, fieldSize: 100 },
      ],
      metrics: [
        { date: "2099-02-09", sleep: 8.0 },
        { date: "2099-02-19", sleep: 5.0 },
      ],
    });
    const conn = deriveConnections(bundle).find(
      (c) => c.dedupeKey === "conn:recovery-race",
    );
    assert(!conn, "fewer than 3 usable races → no claim");
  });

  // ── DB-bound: seed a cross-domain pattern and derive a real connection ─────
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
    skip("Connections", "sleep→feel connection derived", "no seeded user");
    skip("Persist", "new columns round-trip", "no seeded user");
  } else {
    const id = clerkId;
    await run(
      "Connections",
      "seeded short-sleep ↔ low-feel pattern derives an explainable connection",
      async () => {
        await cleanupSeed(id);
        try {
          await db.insert(trainingSessionsTable).values(
            SEED.map((s) => ({
              clerkId: id,
              sessionDate: s.date,
              type: "ride",
              sport: "cycling",
              feelScore: s.feel,
              durationMin: 60,
            })),
          );
          await db.insert(athleteDailyMetricsTable).values(
            SEED.map((s) => ({
              clerkId: id,
              metricDate: s.date,
              sleepHours: s.sleep,
            })),
          );

          const bundle = await gatherSignals(id);
          const connections = deriveConnections(bundle);
          const sleepFeel = connections.find(
            (c) => c.dedupeKey === "conn:sleep-feel",
          );
          assert(!!sleepFeel, "sleep→feel connection must fire on this pattern");

          // Explainability contract the UI renders verbatim.
          assert(
            Array.isArray(sleepFeel!.signals) && sleepFeel!.signals.length > 0,
            "connection carries concrete signals",
          );
          assert(
            sleepFeel!.signals.some((s) => s.kind === "sleep"),
            "at least one sleep signal is present",
          );
          assert(
            sleepFeel!.confidenceScore > 0.1 &&
              sleepFeel!.confidenceScore <= 0.95,
            `confidenceScore in (0.1, 0.95], got ${sleepFeel!.confidenceScore}`,
          );
          assert(
            sleepFeel!.confidence ===
              scoreToConfidence(sleepFeel!.confidenceScore),
            "confidence enum matches the numeric score",
          );
          assert(
            sleepFeel!.alternativeExplanations.length >= 2,
            "honest alternative explanations are offered",
          );
          // sorted strongest-first
          for (let i = 1; i < connections.length; i++) {
            assert(
              connections[i - 1]!.confidenceScore >=
                connections[i]!.confidenceScore,
              "connections sorted by confidence desc",
            );
          }
        } finally {
          await cleanupSeed(id);
        }
      },
    );

    // ── persist accounting invariant: created + deduped + gated === derived ──
    await run(
      "Connections",
      "runConnectionAnalysis accounting balances (created + deduped + gated === derived)",
      async () => {
        await cleanupSeed(id);
        try {
          await db.insert(trainingSessionsTable).values(
            SEED.map((s) => ({
              clerkId: id,
              sessionDate: s.date,
              type: "ride",
              sport: "cycling",
              feelScore: s.feel,
              durationMin: 60,
            })),
          );
          await db.insert(athleteDailyMetricsTable).values(
            SEED.map((s) => ({
              clerkId: id,
              metricDate: s.date,
              sleepHours: s.sleep,
            })),
          );

          const first = await runConnectionAnalysis(id);
          assert(
            first.created + first.deduped + first.gated === first.derived,
            `first run balances, got ${first.created}+${first.deduped}+${first.gated} !== ${first.derived}`,
          );

          // Second run on identical data must derive the same connections and,
          // when memory is enabled, route them all through dedupe (no new rows).
          const second = await runConnectionAnalysis(id);
          assert(
            second.created + second.deduped + second.gated === second.derived,
            `second run balances, got ${second.created}+${second.deduped}+${second.gated} !== ${second.derived}`,
          );
          assert(
            second.created === 0,
            `re-running on identical data creates nothing new, got created=${second.created}`,
          );
        } finally {
          await cleanupSeed(id);
        }
      },
    );

    // ── persistObservation new-column round-trip (gating-aware) ──────────────
    await run("Persist", "new columns round-trip via persistObservation", async () => {
      const dedupeKey = `conn:test-harness-${Date.now()}`;
      let insertedId: number | null = null;
      try {
        const row = await persistObservation({
          clerkId: id,
          sourceType: "connection_analysis",
          title: "Testverband (harness)",
          summary: "Tijdelijke observatie voor de test.",
          observationText: "Wordt direct opgeruimd.",
          confidence: "medium",
          category: "recovery",
          severity: "info",
          detectedPattern: "test_harness",
          signals: [
            { kind: "sleep", label: "Korte nacht", value: "5.0 u", date: "2099-01-01" },
          ],
          alternativeExplanations: ["Alleen een test."],
          confidenceScore: 0.42,
          dedupeKey,
        });

        if (!row) {
          // Privacy-gated (ai_memory disabled for this user) — honest skip.
          skip(
            "Persist",
            "new columns round-trip via persistObservation",
            "memory disabled for dev user (privacy gate)",
          );
          return;
        }
        insertedId = row.id;

        const [back] = await db
          .select()
          .from(aiObservationsTable)
          .where(eq(aiObservationsTable.id, row.id));
        assert(!!back, "row readable back");
        assert(
          Array.isArray(back!.signals) && back!.signals!.length === 1,
          "signals persisted as jsonb array",
        );
        assert(
          Array.isArray(back!.alternativeExplanations) &&
            back!.alternativeExplanations!.length === 1,
          "alternativeExplanations persisted",
        );
        assert(
          back!.confidenceScore != null &&
            Math.abs(parseFloat(back!.confidenceScore) - 0.42) < 1e-9,
          `confidenceScore round-trips as numeric, got ${back!.confidenceScore}`,
        );
      } finally {
        if (insertedId != null) {
          await db
            .delete(aiObservationsTable)
            .where(eq(aiObservationsTable.id, insertedId));
        }
      }
    });

    // ── dedupe semantics that the created/deduped accounting relies on ───────
    await run("Dedupe", "second persist of same key returns the existing row", async () => {
      const dedupeKey = `conn:test-dedupe-${Date.now()}`;
      const base = {
        clerkId: id,
        sourceType: "connection_analysis" as const,
        title: "Dedupe-test (harness)",
        observationText: "Wordt direct opgeruimd.",
        category: "recovery" as const,
        confidenceScore: 0.3,
        dedupeKey,
      };
      let insertedId: number | null = null;
      try {
        const first = await persistObservation(base);
        if (!first) {
          skip(
            "Dedupe",
            "second persist of same key returns the existing row",
            "memory disabled for dev user (privacy gate)",
          );
          return;
        }
        insertedId = first.id;
        const second = await persistObservation(base);
        assert(!!second, "second call returns a row, not null");
        assert(
          second!.id === first.id,
          "second call returns the SAME row (deduped, not a new insert)",
        );
        const all = await db
          .select({ id: aiObservationsTable.id })
          .from(aiObservationsTable)
          .where(
            and(
              eq(aiObservationsTable.clerkId, id),
              eq(aiObservationsTable.dedupeKey, dedupeKey),
            ),
          );
        assert(all.length === 1, `exactly one row exists, got ${all.length}`);
      } finally {
        await db
          .delete(aiObservationsTable)
          .where(
            and(
              eq(aiObservationsTable.clerkId, id),
              eq(aiObservationsTable.dedupeKey, dedupeKey),
            ),
          );
        void insertedId;
      }
    });
  }

  // ── report ────────────────────────────────────────────────────────────────
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
  console.error("memory-graph harness crashed:", err);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
