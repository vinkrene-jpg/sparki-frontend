// Dev-preview athletes for the Home coach hero (Task #56).
//
// Seeds three deterministic, clearly distinct athletes so the dev preview can
// switch the ACTIVE athlete and watch Sparki's daily coach analysis change —
// different personality, confidence, observations and follow-ups for each:
//
//   • Dylan (U23)        → topsporter-toon, rijke data, hoge zekerheid
//   • Sanne (recreatief) → beginner-toon, weinig data, lagere zekerheid + vragen
//   • Erik (ervaren)     → ervaren-toon, rijke data, technische framing
//
// All data is real (no fabricated UI content); the engine is then run over each
// athlete to print an honest summary. Re-running is idempotent (stable clerkIds,
// child rows cleared first).
//
// Run: `pnpm --filter @workspace/api-server run seed:preview`
// Requires: DATABASE_URL.

import {
  db,
  pool,
  userProfilesTable,
  athleteProfilesTable,
  trainingSessionsTable,
  athleteDailyMetricsTable,
  ftpHistoryTable,
  racesTable,
  plannedWorkoutsTable,
  workoutFeedbackTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { ensureAccount, silentLogger } from "../lib/account";
import { runCoachAnalysis } from "../engines/observation";
import { PREVIEW_CLERK_IDS } from "../lib/preview-athletes";

type LoadPattern = "fatigue" | "fresh" | "steady" | "low";

type Spec = {
  clerkId: string;
  name: string;
  email: string;
  expect: string;
  profile: {
    experienceLevel?: string;
    competitionLevel?: string;
    birthYear?: number;
    ftp?: number;
    goals?: string;
    weeklyHourTarget?: number;
  };
  load: LoadPattern;
  metricDays: number;
  hrv?: [number, number];
  restingHr?: [number, number];
  sleep?: [number, number];
  feel?: number;
  fatigue?: number;
  ftp?: number[];
  raceInDays?: number;
  feedback?: Partial<Record<"done" | "missed" | "too_hard" | "too_light", number>>;
};

const THIS_YEAR = new Date().getFullYear();

const SPECS: Spec[] = [
  {
    clerkId: "seed_preview_dylan",
    name: "Dylan (U23)",
    email: "dylan-u23@preview.sparki",
    expect: "topsporter-toon, rijke data",
    profile: {
      experienceLevel: "elite",
      competitionLevel: "national",
      birthYear: THIS_YEAR - 20,
      ftp: 345,
      goals: "Piek voor het NK op de weg",
      weeklyHourTarget: 16,
    },
    load: "steady",
    metricDays: 14,
    hrv: [64, 66],
    restingHr: [44, 43],
    sleep: [8, 8.2],
    feel: 8,
    fatigue: 3,
    ftp: [330, 338, 345],
    raceInDays: 5,
    feedback: { done: 8 },
  },
  {
    clerkId: "seed_preview_recreatief",
    name: "Sanne (recreatief)",
    email: "sanne-recreatief@preview.sparki",
    expect: "beginner-toon, weinig data",
    profile: {
      experienceLevel: "beginner",
      birthYear: THIS_YEAR - 34,
    },
    load: "low",
    metricDays: 4,
    feel: 6,
    fatigue: 5,
  },
  {
    clerkId: "seed_preview_ervaren",
    name: "Erik (ervaren)",
    email: "erik-ervaren@preview.sparki",
    expect: "ervaren-toon, rijke data",
    profile: {
      experienceLevel: "advanced",
      competitionLevel: "regional",
      birthYear: THIS_YEAR - 41,
      ftp: 315,
      goals: "Sterker worden richting de Gran Fondo in juni",
      weeklyHourTarget: 10,
    },
    load: "steady",
    metricDays: 14,
    hrv: [60, 62],
    restingHr: [47, 46],
    sleep: [7.4, 7.8],
    feel: 7,
    fatigue: 4,
    ftp: [300, 308, 315],
    feedback: { done: 6 },
  },
];

// ── Generators (deterministic) ───────────────────────────────────────────────

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split("T")[0]!;
}

function sessionsFor(pattern: LoadPattern) {
  const rows: { sessionDate: string; tss: number; durationMin: number; type: string }[] = [];
  const add = (dayAgo: number, tss: number) =>
    rows.push({ sessionDate: isoDaysAgo(dayAgo), tss, durationMin: Math.round(tss * 0.8), type: "ride" });
  if (pattern === "low") {
    for (let d = 27; d >= 0; d -= 4) add(d, 50);
    return rows;
  }
  if (pattern === "steady") {
    for (let d = 27; d >= 0; d -= 2) add(d, 75);
    return rows;
  }
  if (pattern === "fresh") {
    for (let d = 27; d >= 8; d -= 2) add(d, 100);
    for (let d = 6; d >= 2; d -= 2) add(d, 40);
    return rows;
  }
  // fatigue
  for (let d = 27; d >= 8; d -= 2) add(d, 70);
  for (let d = 6; d >= 0; d -= 1) add(d, 130);
  return rows;
}

function lerp(range: [number, number], i: number, n: number): number {
  if (n <= 1) return range[1];
  return range[0] + ((range[1] - range[0]) * i) / (n - 1);
}

async function clearChildRows(clerkIds: string[]): Promise<void> {
  if (clerkIds.length === 0) return;
  await db.delete(workoutFeedbackTable).where(inArray(workoutFeedbackTable.clerkId, clerkIds));
  await db.delete(plannedWorkoutsTable).where(inArray(plannedWorkoutsTable.clerkId, clerkIds));
  await db.delete(trainingSessionsTable).where(inArray(trainingSessionsTable.clerkId, clerkIds));
  await db.delete(athleteDailyMetricsTable).where(inArray(athleteDailyMetricsTable.clerkId, clerkIds));
  await db.delete(ftpHistoryTable).where(inArray(ftpHistoryTable.clerkId, clerkIds));
  await db.delete(racesTable).where(inArray(racesTable.clerkId, clerkIds));
}

async function seedOne(spec: Spec): Promise<void> {
  const { clerkId } = spec;
  await ensureAccount(clerkId, spec.email, spec.name, silentLogger);

  await db
    .insert(athleteProfilesTable)
    .values({
      clerkId,
      ftp: spec.profile.ftp ?? null,
      experienceLevel: spec.profile.experienceLevel ?? null,
      competitionLevel: spec.profile.competitionLevel ?? null,
      birthYear: spec.profile.birthYear ?? null,
      goals: spec.profile.goals ?? null,
      weeklyHourTarget: spec.profile.weeklyHourTarget ?? null,
      healthStatus: "ok",
    })
    .onConflictDoUpdate({
      target: athleteProfilesTable.clerkId,
      set: {
        ftp: spec.profile.ftp ?? null,
        experienceLevel: spec.profile.experienceLevel ?? null,
        competitionLevel: spec.profile.competitionLevel ?? null,
        birthYear: spec.profile.birthYear ?? null,
        goals: spec.profile.goals ?? null,
        weeklyHourTarget: spec.profile.weeklyHourTarget ?? null,
        healthStatus: "ok",
      },
    });

  const sessions = sessionsFor(spec.load);
  if (sessions.length > 0) {
    await db.insert(trainingSessionsTable).values(sessions.map((s) => ({ clerkId, ...s })));
  }

  if (spec.metricDays > 0) {
    const rows = [];
    const n = spec.metricDays;
    for (let i = 0; i < n; i++) {
      const dayAgo = n - 1 - i;
      rows.push({
        clerkId,
        metricDate: isoDaysAgo(dayAgo),
        hrv: spec.hrv ? Math.round(lerp(spec.hrv, i, n)) : null,
        restingHR: spec.restingHr ? Math.round(lerp(spec.restingHr, i, n)) : null,
        sleepHours: spec.sleep ? lerp(spec.sleep, i, n).toFixed(2) : null,
        feelScore: spec.feel ?? null,
        fatigueScore: spec.fatigue ?? null,
        sleepQuality: spec.feel ?? null,
      });
    }
    await db.insert(athleteDailyMetricsTable).values(rows);
  }

  if (spec.ftp && spec.ftp.length > 0) {
    const rows = spec.ftp.map((w, i) => ({
      clerkId,
      measuredAt: isoDaysAgo((spec.ftp!.length - 1 - i) * 21),
      ftpWatts: w,
    }));
    await db.insert(ftpHistoryTable).values(rows);
  }

  if (spec.raceInDays != null) {
    await db.insert(racesTable).values({
      clerkId,
      name: "Ronde van de regio",
      raceDate: isoDaysAgo(-spec.raceInDays),
      priority: "A",
    });
  }

  if (spec.feedback) {
    const [pw] = await db
      .insert(plannedWorkoutsTable)
      .values({ clerkId, scheduledDate: isoDaysAgo(0), title: "Geplande training" })
      .returning({ id: plannedWorkoutsTable.id });
    const rows: { clerkId: string; workoutId: number; feedbackType: string }[] = [];
    for (const [type, count] of Object.entries(spec.feedback)) {
      for (let i = 0; i < (count ?? 0); i++) rows.push({ clerkId, workoutId: pw!.id, feedbackType: type });
    }
    if (rows.length > 0) await db.insert(workoutFeedbackTable).values(rows);
  }

  // Athlete role only — preview athletes are sporters, not coaches/parents.
  await db
    .update(userProfilesTable)
    .set({ roles: ["athlete"], activeRole: "athlete" })
    .where(eq(userProfilesTable.clerkId, clerkId));
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

async function main(): Promise<void> {
  console.log(`Seeding ${SPECS.length} dev-preview athletes …`);
  await clearChildRows([...PREVIEW_CLERK_IDS]);
  for (const spec of SPECS) await seedOne(spec);
  console.log("Seed complete. Running the coach engine over every preview athlete:\n");

  console.log(
    pad("athleet", 22) +
      pad("persoonlijkheid", 16) +
      pad("zekerheid", 11) +
      pad("obs", 5) +
      pad("vragen", 8) +
      pad("gaten", 7) +
      "advies",
  );
  console.log("-".repeat(110));

  for (const spec of SPECS) {
    const a = await runCoachAnalysis(spec.clerkId);
    const advice = a.adviesVandaag.slice(0, 40);
    console.log(
      pad(spec.name, 22) +
        pad(a.personality.label, 16) +
        pad(`${a.advice.confidence.score}%`, 11) +
        pad(String(a.observations.length), 5) +
        pad(String(a.followUps.length), 8) +
        pad(String(a.missing.length), 7) +
        `${a.advice.intensity} — ${advice}`,
    );
  }

  console.log("-".repeat(110));
  console.log(
    `\n${SPECS.length} preview athletes seeded. Every analysis above is built from the seeded real data — no fabricated content.`,
  );
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
