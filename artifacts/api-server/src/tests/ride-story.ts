// Rit-verhaal (Fase 1 "De keten", flag `rit_verhaal`) — DB-backed route
// contract test.
//
// Boots the REAL Express app and drives the real routes as seeded dev users:
//   GET  /api/ride-story/sync-status
//   GET  /api/ride-story/moment
//   GET  /api/ride-story/session/:id
//   POST /api/input-center/messages   (chat with ride context)
//
// It pins the honesty guarantees the feature depends on:
//   1. sync-status is honest: geen / gereed / mislukt map to real rows only.
//   2. The NA-RIT moment fires ONLY for a hub-imported ride inside the fresh
//      window, and is suppressed when the athlete is ziek/geblesseerd.
//   3. The schemagevolg is deterministic and names the real cause: wedstrijd,
//      voorstel (negative feedback), geen (within tolerance / done / unplanned)
//      and onbekend with exactly WHAT is missing.
//   4. `predictionAvailable` is true ONLY for a prediction snapshot created
//      BEFORE the ride was recorded — a post-hoc snapshot must NEVER count.
//   5. Ownership: athlete B can never read A's story; chat context with a ride
//      that isn't yours is a hard 400 (never a silently-dropped context).
//
// The Sparki chat call (Anthropic) is STUBBED so the context test is
// deterministic and never touches the real model.
//
// Run: `pnpm --filter @workspace/api-server run test:ride-story`
// Requires: DATABASE_URL + NODE_ENV!=production + DEV_AUTH_BYPASS=true (set by
// the test script). Exits non-zero on any failure.

import type { Server } from "node:http";
import {
  db,
  pool,
  athleteProfilesTable,
  connectorActivitiesTable,
  corePredictionsTable,
  plannedWorkoutsTable,
  racesTable,
  syncRunsTable,
  trainingSessionsTable,
  userProfilesTable,
  workoutFeedbackTable,
} from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import app from "../app";
import { ensureAccount, silentLogger } from "../lib/account";

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

// ── Stub the model so the chat-context test never hits Anthropic ─────────────
const origCreate = anthropic.messages.create.bind(anthropic.messages);
(anthropic.messages as unknown as { create: (args: unknown) => unknown }).create =
  async () =>
    ({
      content: [{ type: "text", text: "Testantwoord over je rit." }],
    }) as unknown as Awaited<ReturnType<typeof origCreate>>;

// ── Server boot ──────────────────────────────────────────────────────────────
let baseUrl = "";
let server: Server | null = null;

async function startServer(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, (err?: Error) => {
      if (err) return reject(err);
      const addr = server!.address();
      if (addr && typeof addr === "object") {
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      } else {
        reject(new Error("failed to determine server port"));
      }
    });
  });
}

async function stopServer(): Promise<void> {
  if (!server) return;
  await new Promise<void>((resolve) => server!.close(() => resolve()));
}

// ── Fixtures ─────────────────────────────────────────────────────────────────
const RUN = `test_ridestory_${Date.now()}`;
const clerkId = `${RUN}_athlete`;
const clerkIdB = `${RUN}_athlete_b`;

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 60 * 60 * 1000);
}

// Must match the backend's Amsterdam calendar day (amsterdamToday in
// routes/ride-story.ts) — a server-local date flips around midnight on a
// non-Amsterdam host and makes the race-day scenarios flaky.
function isoToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function seedSession(
  over: Partial<typeof trainingSessionsTable.$inferInsert> = {},
  owner: string = clerkId,
): Promise<number> {
  const [s] = await db
    .insert(trainingSessionsTable)
    .values({
      clerkId: owner,
      sessionDate: isoToday(),
      type: "ride",
      title: "Testrit",
      source: "strava",
      ...over,
    })
    .returning({ id: trainingSessionsTable.id });
  return s!.id;
}

async function seedActivity(
  sessionId: number | null,
  importedAt: Date,
): Promise<number> {
  const [a] = await db
    .insert(connectorActivitiesTable)
    .values({
      clerkId,
      provider: "strava",
      externalActivityId: `${RUN}_${Math.random().toString(36).slice(2)}`,
      normalizedSessionId: sessionId,
      importedAt,
      startedAt: importedAt,
    })
    .returning({ id: connectorActivitiesTable.id });
  return a!.id;
}

async function seedWorkout(
  over: Partial<typeof plannedWorkoutsTable.$inferInsert> = {},
): Promise<number> {
  const [w] = await db
    .insert(plannedWorkoutsTable)
    .values({
      clerkId,
      scheduledDate: isoToday(),
      type: "ride",
      title: "Geplande training",
      status: "planned",
      source: "sparki",
      ...over,
    })
    .returning({ id: plannedWorkoutsTable.id });
  return w!.id;
}

async function api(
  path: string,
  actor: string = clerkId,
  init: RequestInit = {},
): Promise<{ status: number; body: any }> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-dev-clerk-id": actor,
      ...(init.headers ?? {}),
    },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function setHealth(status: string) {
  await db
    .update(athleteProfilesTable)
    .set({ healthStatus: status })
    .where(eq(athleteProfilesTable.clerkId, clerkId));
}

async function cleanup() {
  // FK cascades from user_profiles cover sessions/activities/workouts/races/
  // predictions/feedback/sync runs.
  for (const id of [clerkId, clerkIdB]) {
    await db
      .delete(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, id))
      .catch(() => {});
  }
}

async function main() {
  await startServer();
  await ensureAccount(clerkId, `${clerkId}@example.test`, "Testatleet", silentLogger);
  await ensureAccount(clerkIdB, `${clerkIdB}@example.test`, "Testatleet B", silentLogger);

  // 1 ── sync-status is honest when there is nothing ───────────────────────────
  await scenario(
    "sync-status: fresh athlete without connection/rides reports 'geen' (precondition: dev bypass works)",
    async () => {
      const { status, body } = await api("/api/ride-story/sync-status");
      assert(
        status === 200,
        `expected 200 via dev bypass, got ${status} — ensure NODE_ENV!=production and DEV_AUTH_BYPASS=true`,
      );
      assert(body.status === "geen", `expected status geen, got ${body.status}`);
      assert(body.hasConnection === false, "fresh athlete must have hasConnection=false");
      assert(body.lastActivity === null, "fresh athlete must have lastActivity=null");
      assert(body.analysis === "geen", `expected analysis geen, got ${body.analysis}`);
    },
  );

  // 2 ── sync-status maps real rows to gereed / mislukt ───────────────────────
  await scenario(
    "sync-status: imported ride → 'gereed' + analyse 'gereed'; newer failed sync → 'mislukt'",
    async () => {
      const sessionId = await seedSession({ tss: 70, durationMin: 90 });
      await seedActivity(sessionId, hoursAgo(2));

      let r = await api("/api/ride-story/sync-status");
      assert(r.body.status === "gereed", `expected gereed, got ${r.body.status}`);
      assert(r.body.analysis === "gereed", `expected analysis gereed, got ${r.body.analysis}`);
      assert(
        r.body.lastActivity?.sessionId === sessionId,
        "lastActivity must point to the imported session",
      );

      // A failed sync run NEWER than the last import must surface as mislukt.
      await db.insert(syncRunsTable).values({
        clerkId,
        provider: "strava",
        status: "failed",
        startedAt: hoursAgo(1),
        finishedAt: hoursAgo(1),
        error: "test failure",
      });
      r = await api("/api/ride-story/sync-status");
      assert(r.body.status === "mislukt", `expected mislukt, got ${r.body.status}`);

      // Clean the failed run so later scenarios see 'gereed' again.
      await db.delete(syncRunsTable).where(eq(syncRunsTable.clerkId, clerkId));
    },
  );

  // 3 ── NA-RIT moment: only fresh hub-imports fire it ────────────────────────
  await scenario(
    "moment: fresh imported ride (within 18h) carries a story; stale-only import does not",
    async () => {
      // The fresh activity from scenario 2 exists → story present.
      let r = await api("/api/ride-story/moment");
      assert(r.status === 200, `moment expected 200, got ${r.status}`);
      assert(r.body.suppressed === false, "moment must not be suppressed for a healthy athlete");
      assert(r.body.story != null, "fresh import must produce a story");

      // Push the import outside the fresh window → no story (honest silence).
      await db
        .update(connectorActivitiesTable)
        .set({ importedAt: hoursAgo(30) })
        .where(eq(connectorActivitiesTable.clerkId, clerkId));
      r = await api("/api/ride-story/moment");
      assert(r.body.story === null, "a stale import must NOT produce a NA-RIT moment");
      // Chain step 1 stays visible: even without a fresh story the honest
      // sync status must be present so the UI can keep showing it.
      assert(r.body.sync != null, "sync status must accompany a story-less moment payload");
      assert(
        r.body.sync.lastActivity != null,
        "story-less moment must still carry the real last import so the UI keeps the status line",
      );

      // Restore freshness for the next scenarios.
      await db
        .update(connectorActivitiesTable)
        .set({ importedAt: hoursAgo(2) })
        .where(eq(connectorActivitiesTable.clerkId, clerkId));
    },
  );

  // 4 ── Safety: ziek/geblesseerd suppresses the moment ───────────────────────
  await scenario(
    "moment: suppressed (story withheld) while the athlete is ziek — health surface leads",
    async () => {
      await setHealth("sick");
      const r = await api("/api/ride-story/moment");
      assert(r.body.suppressed === true, "sick athlete must have suppressed=true");
      assert(r.body.suppressReason === "health", `expected reason health, got ${r.body.suppressReason}`);
      assert(r.body.story === null, "suppressed moment must carry NO story");
      await setHealth("ok");

      const back = await api("/api/ride-story/moment");
      assert(back.body.suppressed === false && back.body.story != null,
        "recovered athlete must get the moment again");
    },
  );

  // 5 ── Schemagevolg: wedstrijd / voorstel / geen ─────────────────────────────
  await scenario(
    "consequence: race day → 'wedstrijd'; negative feedback → 'voorstel' with real causeLine; within tolerance → 'geen'",
    async () => {
      // wedstrijd — a real race row on the session date.
      const raceSession = await seedSession({ tss: 95, durationMin: 120 });
      const [race] = await db
        .insert(racesTable)
        .values({ clerkId, name: "Testkoers", raceDate: isoToday() })
        .returning({ id: racesTable.id });
      let r = await api(`/api/ride-story/session/${raceSession}`);
      assert(r.status === 200, `story expected 200, got ${r.status}`);
      assert(r.body.consequence.status === "wedstrijd",
        `race day expected wedstrijd, got ${r.body.consequence.status}`);
      await db.delete(racesTable).where(eq(racesTable.id, race!.id));

      // voorstel — linked workout + negative feedback.
      const s1 = await seedSession({ tss: 90, durationMin: 100 });
      const w1 = await seedWorkout({ sessionId: s1, targetTSS: 60, status: "completed" });
      await db.insert(workoutFeedbackTable).values({
        clerkId,
        workoutId: w1,
        feedbackType: "too_hard",
      });
      r = await api(`/api/ride-story/session/${s1}`);
      assert(r.body.consequence.status === "voorstel",
        `negative feedback expected voorstel, got ${r.body.consequence.status}`);
      assert(typeof r.body.consequence.causeLine === "string" &&
        r.body.consequence.causeLine.includes("te zwaar"),
        "voorstel must name the real feedback in the causeLine");
      assert(r.body.consequence.canPropose === true, "voorstel must set canPropose");

      // geen — real load within tolerance of the plan, no negative feedback.
      const s2 = await seedSession({ tss: 62, durationMin: 90 });
      await seedWorkout({ sessionId: s2, targetTSS: 60, status: "completed" });
      r = await api(`/api/ride-story/session/${s2}`);
      assert(r.body.consequence.status === "geen",
        `within tolerance expected geen, got ${r.body.consequence.status}`);
      assert(r.body.consequence.reason.includes("62") && r.body.consequence.reason.includes("60"),
        "geen must cite the REAL compared numbers");
    },
  );

  // 6 ── Schemagevolg: onbekend names exactly what is missing ─────────────────
  await scenario(
    "consequence: 'onbekend' is honest — big deviation asks for feedback; no sensor data names sensorgegevens",
    async () => {
      // Clear deviation without feedback → onbekend, missing feedback.
      const s1 = await seedSession({ tss: 120, durationMin: 150 });
      await seedWorkout({ sessionId: s1, targetTSS: 60, status: "completed" });
      let r = await api(`/api/ride-story/session/${s1}`);
      assert(r.body.consequence.status === "onbekend",
        `big deviation without feedback expected onbekend, got ${r.body.consequence.status}`);
      assert(r.body.consequence.missing.includes("feedback"),
        "deviation-onbekend must name feedback as missing");

      // No load and no duration at all → sensorgegevens (and feedback) missing.
      const s2 = await seedSession({ tss: null, durationMin: null });
      await seedWorkout({ sessionId: s2, targetTSS: 60 });
      r = await api(`/api/ride-story/session/${s2}`);
      assert(r.body.consequence.status === "onbekend",
        `no data expected onbekend, got ${r.body.consequence.status}`);
      assert(r.body.consequence.missing.includes("sensorgegevens"),
        "no-data onbekend must name sensorgegevens as missing");

      // Unplanned ride WITH numbers → geen, schedule explicitly stands.
      const s3 = await seedSession({ tss: 55, durationMin: 75 });
      r = await api(`/api/ride-story/session/${s3}`);
      assert(r.body.consequence.status === "geen",
        `unplanned ride with data expected geen, got ${r.body.consequence.status}`);
      assert(r.body.workout === null, "unplanned ride must carry no workout");
    },
  );

  // 7 ── Prediction honesty: pre-existing only, NEVER post-hoc ────────────────
  await scenario(
    "predictionAvailable: true only for a snapshot created BEFORE the ride; post-hoc snapshot stays false",
    async () => {
      // Post-hoc: prediction created AFTER the session row → must be false.
      const s1 = await seedSession({ tss: 70, durationMin: 90 });
      const w1 = await seedWorkout({ sessionId: s1, targetTSS: 70 });
      await db.insert(corePredictionsTable).values({
        clerkId,
        plannedWorkoutId: w1,
        inputHash: `${RUN}_posthoc`,
        prediction: { test: true },
        createdAt: new Date(Date.now() + 5000),
      });
      let r = await api(`/api/ride-story/session/${s1}`);
      assert(r.body.predictionAvailable === false,
        "a post-hoc prediction snapshot must NEVER set predictionAvailable");

      // Pre-existing: snapshot older than the session row → true.
      const s2 = await seedSession({ tss: 70, durationMin: 90 });
      const w2 = await seedWorkout({ sessionId: s2, targetTSS: 70 });
      await db.insert(corePredictionsTable).values({
        clerkId,
        plannedWorkoutId: w2,
        inputHash: `${RUN}_prior`,
        prediction: { test: true },
        createdAt: hoursAgo(6),
      });
      r = await api(`/api/ride-story/session/${s2}`);
      assert(r.body.predictionAvailable === true,
        "a snapshot created before the ride must set predictionAvailable");
    },
  );

  // 8 ── Ownership: story + chat context are athlete-scoped ───────────────────
  await scenario(
    "ownership: athlete B gets 404 on A's story; chat context with A's ride is a hard 400 for B, valid for A",
    async () => {
      const sessionA = await seedSession({ tss: 70, durationMin: 90 });

      // B cannot read A's story.
      let r = await api(`/api/ride-story/session/${sessionA}`, clerkIdB);
      assert(r.status === 404, `B on A's story expected 404, got ${r.status}`);

      // B cannot smuggle A's ride in as chat context — hard 400, never dropped.
      r = await api("/api/input-center/messages", clerkIdB, {
        method: "POST",
        body: JSON.stringify({
          text: "Hoe ging deze rit?",
          context: { kind: "session", sessionId: sessionA },
        }),
      });
      assert(r.status === 400, `B with A's ride as context expected 400, got ${r.status}`);

      // Malformed context is rejected too.
      r = await api("/api/input-center/messages", clerkId, {
        method: "POST",
        body: JSON.stringify({
          text: "Hoe ging deze rit?",
          context: { kind: "bogus", sessionId: sessionA },
        }),
      });
      assert(r.status === 400, `bad context kind expected 400, got ${r.status}`);

      // The owner with a valid context gets a (stubbed) answer.
      r = await api("/api/input-center/messages", clerkId, {
        method: "POST",
        body: JSON.stringify({
          text: "Hoe ging deze rit?",
          context: { kind: "session", sessionId: sessionA },
        }),
      });
      assert(r.status === 200, `owner with valid context expected 200, got ${r.status}`);
    },
  );

  // 9 ── Racedag-fasen: RACEDAG → RIT-BINNEN → NA-RIT ─────────────────────────
  await scenario(
    "moment phases: race today w/o activity → racedag (no invented weather); pending import → verwerken; analysed today-ride displaces → na-rit",
    async () => {
      // Make every earlier import stale so the race day starts clean.
      await db
        .update(connectorActivitiesTable)
        .set({ importedAt: hoursAgo(30) })
        .where(eq(connectorActivitiesTable.clerkId, clerkId));

      const [race] = await db
        .insert(racesTable)
        .values({
          clerkId,
          name: "46e Wielerronde van Testdorp",
          raceDate: isoToday(),
          startTime: "15:30",
          distanceKm: "90",
          raceType: "criterium",
          notes: "56 rondes",
          // location intentionally absent → weather must stay null (honest).
        })
        .returning({ id: racesTable.id });

      // Phase 1 — RACEDAG: race today, no fresh activity.
      let r = await api("/api/ride-story/moment");
      assert(r.body.phase === "racedag", `expected racedag, got ${r.body.phase}`);
      assert(r.body.story === null, "racedag must carry no story");
      assert(r.body.raceDay?.race?.name === "46e Wielerronde van Testdorp",
        "racedag must carry the real race row");
      assert(r.body.raceDay.race.startTime === "15:30" && r.body.raceDay.race.notes === "56 rondes",
        "racedag must expose the real known fields");
      assert(r.body.raceDay.weather === null,
        "without a location the weather must be null — never invented");
      assert(r.body.sync != null, "racedag payload must keep the honest sync status");

      // Phase 2 — RIT-BINNEN: an import arrived but no session row yet.
      await seedActivity(null, hoursAgo(0));
      r = await api("/api/ride-story/moment");
      assert(r.body.phase === "verwerken", `expected verwerken, got ${r.body.phase}`);
      assert(r.body.story === null, "verwerken must carry no story yet");
      assert(r.body.raceDay != null, "verwerken keeps the race context");

      // Phase 3 — NA-RIT: the analysed today-ride displaces the racedag block.
      const raceRide = await seedSession({ tss: 95, durationMin: 130, title: "Wedstrijdrit" });
      await seedActivity(raceRide, hoursAgo(0));
      r = await api("/api/ride-story/moment");
      assert(r.body.phase === "na-rit", `expected na-rit, got ${r.body.phase}`);
      assert(r.body.story?.session?.id === raceRide,
        "na-rit must lead with the fresh race ride");
      assert(r.body.story.consequence.status === "wedstrijd",
        `race-day story expected consequence wedstrijd, got ${r.body.story?.consequence?.status}`);
      assert(r.body.raceDay === null, "a fresh race ride must displace the racedag block");

      await db.delete(racesTable).where(eq(racesTable.id, race!.id));
    },
  );

  await cleanup();
  await stopServer();
  await pool.end();

  // ── Report ─────────────────────────────────────────────────────────────────
  const width = Math.max(...results.map((r) => r.scenario.length));
  console.log("\nRit-verhaal — resultaten\n");
  for (const r of results) {
    const mark = r.status === "pass" ? "PASS" : "FAIL";
    console.log(`  [${mark}] ${r.scenario.padEnd(width)}${r.note ? `\n         ↳ ${r.note}` : ""}`);
  }
  const failed = results.filter((r) => r.status === "fail").length;
  console.log(`\n${results.length - failed}/${results.length} scenario's geslaagd\n`);
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error("test run crashed:", err);
  await cleanup().catch(() => {});
  await stopServer().catch(() => {});
  await pool.end().catch(() => {});
  process.exit(1);
});
