// Virtual-athlete harness for the Observation & Coach Engine.
//
// Seeds 28 deterministic virtual athletes spanning the scenarios the coach brain
// must handle — fresh, overreached, recovering, sparse-data, youth, experienced,
// contradictory signals, injured/sick, detraining, race week, missed/too-hard
// patterns, plus parent/coach/topsporter views — then runs the engine over every
// one and prints an honest summary table. All data is real (no fabricated UI
// content); re-running is idempotent (stable clerkIds, child rows cleared first).
//
// Run: `pnpm --filter @workspace/api-server run seed:virtual-athletes`
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
  nutritionHydrationLogsTable,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { ensureAccount, silentLogger } from "../lib/account";
import { runCoachAnalysis } from "../engines/observation";

type LoadPattern = "fatigue" | "fresh" | "steady" | "low" | "none";

type Spec = {
  slug: string;
  name: string;
  expect: string; // what this athlete is meant to exercise (for the table)
  profile: {
    experienceLevel?: string;
    competitionLevel?: string;
    birthYear?: number;
    healthStatus?: string;
    ftp?: number;
  };
  role?: { roles: string[]; activeRole: string };
  load: LoadPattern;
  metricDays: number; // 0 = no check-ins logged (sparse)
  hrv?: [number, number]; // [oldest, newest]
  restingHr?: [number, number];
  sleep?: [number, number];
  feel?: number; // newest feel score 1-10
  fatigue?: number; // newest fatigue score 1-10
  ftp?: number[]; // oldest → newest
  raceInDays?: number; // A-priority race
  feedback?: Partial<
    Record<"done" | "missed" | "too_hard" | "too_light" | "pain" | "tired", number>
  >;
  nutritionLogs?: number;
};

const SPECS: Spec[] = [
  { slug: "fris-klaar", name: "Femke Fris", expect: "goede vorm", profile: { experienceLevel: "intermediate", ftp: 240 }, load: "fresh", metricDays: 7, feel: 9, fatigue: 2, sleep: [7.5, 8] },
  { slug: "overbelast", name: "Olaf Over", expect: "opgestapelde vermoeidheid", profile: { experienceLevel: "advanced", ftp: 300 }, load: "fatigue", metricDays: 7, feel: 3, fatigue: 8, restingHr: [50, 58], sleep: [6, 5.5] },
  { slug: "herstellend", name: "Hilde Herstel", expect: "herstelzorg", profile: { experienceLevel: "intermediate", ftp: 220 }, load: "steady", metricDays: 8, hrv: [70, 55], restingHr: [48, 56], sleep: [6, 5.8], feel: 5, fatigue: 6 },
  { slug: "beginner-weinig", name: "Bram Begin", expect: "weinig data (gaten)", profile: { experienceLevel: "beginner" }, load: "none", metricDays: 0 },
  { slug: "jeugd", name: "Jasper Jeugd", expect: "jeugdrenner-toon", profile: { experienceLevel: "beginner", birthYear: new Date().getFullYear() - 16, ftp: 180 }, load: "steady", metricDays: 6, feel: 7, fatigue: 4 },
  { slug: "ervaren-rijk", name: "Erik Ervaren", expect: "ervaren-toon, rijke data", profile: { experienceLevel: "advanced", competitionLevel: "regional", ftp: 320 }, load: "steady", metricDays: 14, hrv: [60, 64], restingHr: [46, 45], sleep: [7.5, 7.8], feel: 8, fatigue: 3, ftp: [305, 312, 320], feedback: { done: 6 } },
  { slug: "tegenstrijdig", name: "Tessa Twijfel", expect: "tegenstrijdig (fris vs moe)", profile: { experienceLevel: "advanced", ftp: 290 }, load: "fatigue", metricDays: 7, feel: 9, fatigue: 2, sleep: [7.5, 8] },
  { slug: "geblesseerd", name: "Gijs Geblesseerd", expect: "blessure → rust", profile: { experienceLevel: "intermediate", healthStatus: "injured", ftp: 250 }, load: "low", metricDays: 5, feel: 5, fatigue: 5 },
  { slug: "ziek", name: "Zoë Ziek", expect: "ziek → rust", profile: { experienceLevel: "intermediate", healthStatus: "sick", ftp: 230 }, load: "low", metricDays: 5, feel: 4, fatigue: 6 },
  { slug: "vormverlies", name: "Daan Detrain", expect: "vormverlies", profile: { experienceLevel: "intermediate", ftp: 210 }, load: "low", metricDays: 5, feel: 6, fatigue: 4, ftp: [240, 225, 210] },
  { slug: "vooruitgang", name: "Pia Power", expect: "vermogen vooruit", profile: { experienceLevel: "intermediate", ftp: 270 }, load: "steady", metricDays: 10, feel: 8, fatigue: 3, ftp: [250, 260, 270], feedback: { done: 5 } },
  { slug: "wedstrijdweek", name: "Wout Wedstrijd", expect: "A-wedstrijd nabij (taper)", profile: { experienceLevel: "advanced", competitionLevel: "regional", ftp: 330 }, load: "fresh", metricDays: 8, feel: 8, fatigue: 3, raceInDays: 2 },
  { slug: "gemist", name: "Maud Mist", expect: "gemiste trainingen", profile: { experienceLevel: "intermediate", ftp: 240 }, load: "low", metricDays: 6, feel: 5, fatigue: 5, feedback: { missed: 3, done: 1 } },
  { slug: "te-zwaar", name: "Hugo Hard", expect: "te zware trainingen", profile: { experienceLevel: "intermediate", ftp: 260 }, load: "fatigue", metricDays: 7, feel: 4, fatigue: 8, feedback: { too_hard: 3, tired: 2 } },
  { slug: "topsporter", name: "Nina Nationaal", expect: "topsporter-toon", profile: { experienceLevel: "elite", competitionLevel: "national", ftp: 360 }, load: "steady", metricDays: 14, hrv: [65, 66], restingHr: [42, 42], sleep: [8, 8], feel: 9, fatigue: 2, ftp: [350, 355, 360], feedback: { done: 8 } },
  { slug: "voeding", name: "Vera Voeding", expect: "voeding gelogd", profile: { experienceLevel: "intermediate", ftp: 250 }, load: "steady", metricDays: 8, feel: 7, fatigue: 4, nutritionLogs: 5 },
  { slug: "geen-ochtend", name: "Stijn Stil", expect: "traint hard, geen ochtenddata", profile: { experienceLevel: "advanced", ftp: 300 }, load: "fatigue", metricDays: 0 },
  { slug: "consistent", name: "Coen Consistent", expect: "consistent patroon", profile: { experienceLevel: "intermediate", ftp: 260 }, load: "steady", metricDays: 12, feel: 7, fatigue: 4, feedback: { done: 7 } },
  { slug: "slechte-slaap", name: "Sanne Slaap", expect: "slechte slaap + herstel", profile: { experienceLevel: "intermediate", ftp: 240 }, load: "steady", metricDays: 8, hrv: [62, 52], restingHr: [50, 57], sleep: [6, 5.5], feel: 5, fatigue: 6 },
  { slug: "acwr-piek", name: "Ruben Ramp", expect: "belastingspiek (ACWR)", profile: { experienceLevel: "advanced", ftp: 300 }, load: "fatigue", metricDays: 6, feel: 4, fatigue: 7 },
  { slug: "stabiel", name: "Steef Stabiel", expect: "normale dag", profile: { experienceLevel: "intermediate", ftp: 250 }, load: "steady", metricDays: 9, feel: 6, fatigue: 4 },
  { slug: "ouder-view", name: "Petra Ouder", expect: "ouder-toon", profile: { experienceLevel: "intermediate", ftp: 240 }, role: { roles: ["athlete", "parent"], activeRole: "parent" }, load: "steady", metricDays: 7, feel: 7, fatigue: 4 },
  { slug: "trainer-view", name: "Coach Kees", expect: "trainer-toon", profile: { experienceLevel: "advanced", competitionLevel: "regional", ftp: 300 }, role: { roles: ["athlete", "coach"], activeRole: "coach" }, load: "steady", metricDays: 10, feel: 7, fatigue: 4 },
  { slug: "masters", name: "Marc Masters", expect: "ervaren masters", profile: { experienceLevel: "advanced", birthYear: new Date().getFullYear() - 48, ftp: 280 }, load: "steady", metricDays: 10, feel: 7, fatigue: 4, ftp: [275, 278, 280] },
  { slug: "onbekend", name: "Iris Intermediate", expect: "beginner-fallback", profile: {}, load: "low", metricDays: 4, feel: 6, fatigue: 4 },
  { slug: "slaap-ok-hr-hoog", name: "Lars Lastig", expect: "tegenstrijdig (slaap ok, HR hoog)", profile: { experienceLevel: "intermediate", ftp: 250 }, load: "steady", metricDays: 8, restingHr: [48, 56], sleep: [8, 8], feel: 6, fatigue: 4 },
  { slug: "herstel-split", name: "Eva Eigenaardig", expect: "tegenstrijdig (HRV+HR beide stijgen)", profile: { experienceLevel: "advanced", ftp: 290 }, load: "steady", metricDays: 8, hrv: [55, 64], restingHr: [48, 55], sleep: [7, 7], feel: 6, fatigue: 4 },
  { slug: "licht-bij-hoog", name: "Tom Tegendraads", expect: "tegenstrijdig (hoge belasting, voelt licht)", profile: { experienceLevel: "advanced", ftp: 300 }, load: "fatigue", metricDays: 6, feel: 7, fatigue: 3, feedback: { too_light: 2 } },
];

// ── Generators (deterministic) ───────────────────────────────────────────────

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split("T")[0]!;
}

function sessionsFor(slug: string, pattern: LoadPattern) {
  const rows: { sessionDate: string; tss: number; durationMin: number; type: string }[] = [];
  const add = (dayAgo: number, tss: number) =>
    rows.push({ sessionDate: isoDaysAgo(dayAgo), tss, durationMin: Math.round(tss * 0.8), type: "ride" });
  if (pattern === "none") return rows;
  if (pattern === "low") {
    for (let d = 27; d >= 0; d -= 4) add(d, 50);
    return rows;
  }
  if (pattern === "steady") {
    for (let d = 27; d >= 0; d -= 2) add(d, 72);
    return rows;
  }
  if (pattern === "fresh") {
    for (let d = 27; d >= 8; d -= 2) add(d, 100); // built base
    for (let d = 6; d >= 2; d -= 2) add(d, 40); // recent taper
    return rows;
  }
  // fatigue: moderate base + heavy recent week → negative TSB, high ACWR
  for (let d = 27; d >= 8; d -= 2) add(d, 70);
  for (let d = 6; d >= 0; d -= 1) add(d, 130);
  return rows;
}

function lerp(range: [number, number], i: number, n: number): number {
  if (n <= 1) return range[1];
  return range[0] + ((range[1] - range[0]) * i) / (n - 1);
}

const SEED_SLUGS = SPECS.map((s) => `seed_va_${s.slug}`);

async function clearChildRows(clerkIds: string[]): Promise<void> {
  if (clerkIds.length === 0) return;
  await db.delete(workoutFeedbackTable).where(inArray(workoutFeedbackTable.clerkId, clerkIds));
  await db.delete(plannedWorkoutsTable).where(inArray(plannedWorkoutsTable.clerkId, clerkIds));
  await db.delete(trainingSessionsTable).where(inArray(trainingSessionsTable.clerkId, clerkIds));
  await db.delete(athleteDailyMetricsTable).where(inArray(athleteDailyMetricsTable.clerkId, clerkIds));
  await db.delete(ftpHistoryTable).where(inArray(ftpHistoryTable.clerkId, clerkIds));
  await db.delete(racesTable).where(inArray(racesTable.clerkId, clerkIds));
  await db.delete(nutritionHydrationLogsTable).where(inArray(nutritionHydrationLogsTable.clerkId, clerkIds));
}

async function seedOne(spec: Spec): Promise<string> {
  const clerkId = `seed_va_${spec.slug}`;
  await ensureAccount(clerkId, `${spec.slug}@virtual.sparki`, spec.name, silentLogger);

  if (spec.role) {
    await db
      .update(userProfilesTable)
      .set({ roles: spec.role.roles, activeRole: spec.role.activeRole })
      .where(eq(userProfilesTable.clerkId, clerkId));
  }

  // athlete_profiles — upsert the behavioural facts.
  await db
    .insert(athleteProfilesTable)
    .values({
      clerkId,
      ftp: spec.profile.ftp ?? null,
      experienceLevel: spec.profile.experienceLevel ?? null,
      competitionLevel: spec.profile.competitionLevel ?? null,
      birthYear: spec.profile.birthYear ?? null,
      healthStatus: spec.profile.healthStatus ?? "ok",
    })
    .onConflictDoUpdate({
      target: athleteProfilesTable.clerkId,
      set: {
        ftp: spec.profile.ftp ?? null,
        experienceLevel: spec.profile.experienceLevel ?? null,
        competitionLevel: spec.profile.competitionLevel ?? null,
        birthYear: spec.profile.birthYear ?? null,
        healthStatus: spec.profile.healthStatus ?? "ok",
      },
    });

  // training sessions
  const sessions = sessionsFor(spec.slug, spec.load);
  if (sessions.length > 0) {
    await db
      .insert(trainingSessionsTable)
      .values(sessions.map((s) => ({ clerkId, ...s })));
  }

  // daily metrics
  if (spec.metricDays > 0) {
    const rows = [];
    const n = spec.metricDays;
    for (let i = 0; i < n; i++) {
      const dayAgo = n - 1 - i; // i=0 oldest … last = today
      rows.push({
        clerkId,
        metricDate: isoDaysAgo(dayAgo),
        hrv: spec.hrv ? Math.round(lerp(spec.hrv, i, n)) : null,
        restingHR: spec.restingHr ? Math.round(lerp(spec.restingHr, i, n)) : null,
        sleepHours: spec.sleep ? lerp(spec.sleep, i, n).toFixed(2) : null,
        feelScore: dayAgo === 0 ? (spec.feel ?? null) : (spec.feel ?? null),
        fatigueScore: dayAgo === 0 ? (spec.fatigue ?? null) : (spec.fatigue ?? null),
        sleepQuality: spec.feel ?? null,
      });
    }
    await db.insert(athleteDailyMetricsTable).values(rows);
  }

  // ftp history
  if (spec.ftp && spec.ftp.length > 0) {
    const rows = spec.ftp.map((w, i) => ({
      clerkId,
      measuredAt: isoDaysAgo((spec.ftp!.length - 1 - i) * 21),
      ftpWatts: w,
    }));
    await db.insert(ftpHistoryTable).values(rows);
  }

  // race
  if (spec.raceInDays != null) {
    await db.insert(racesTable).values({
      clerkId,
      name: "Omloop Virtueel",
      raceDate: isoDaysAgo(-spec.raceInDays),
      priority: "A",
    });
  }

  // feedback (needs a planned workout to reference)
  if (spec.feedback) {
    const [pw] = await db
      .insert(plannedWorkoutsTable)
      .values({
        clerkId,
        scheduledDate: isoDaysAgo(0),
        title: "Geplande training",
      })
      .returning({ id: plannedWorkoutsTable.id });
    const rows: { clerkId: string; workoutId: number; feedbackType: string }[] = [];
    for (const [type, count] of Object.entries(spec.feedback)) {
      for (let i = 0; i < (count ?? 0); i++)
        rows.push({ clerkId, workoutId: pw!.id, feedbackType: type });
    }
    if (rows.length > 0) await db.insert(workoutFeedbackTable).values(rows);
  }

  // nutrition
  if (spec.nutritionLogs && spec.nutritionLogs > 0) {
    const rows = Array.from({ length: spec.nutritionLogs }, (_, i) => ({
      clerkId,
      logDate: isoDaysAgo(i),
    }));
    await db.insert(nutritionHydrationLogsTable).values(rows);
  }

  return clerkId;
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

async function main(): Promise<void> {
  console.log(`Seeding ${SPECS.length} virtual athletes …`);
  await clearChildRows(SEED_SLUGS);
  for (const spec of SPECS) await seedOne(spec);
  console.log("Seed complete. Running the coach engine over every athlete:\n");

  console.log(
    pad("athleet", 20) +
      pad("persoonlijkheid", 16) +
      pad("obs", 5) +
      pad("vragen", 8) +
      pad("gaten", 7) +
      "advies",
  );
  console.log("-".repeat(110));

  let totalObs = 0;
  for (const spec of SPECS) {
    const clerkId = `seed_va_${spec.slug}`;
    const a = await runCoachAnalysis(clerkId);
    totalObs += a.observations.length;
    const advice = a.adviesVandaag.slice(0, 46);
    console.log(
      pad(spec.name, 20) +
        pad(a.personality.label, 16) +
        pad(String(a.observations.length), 5) +
        pad(String(a.followUps.length), 8) +
        pad(String(a.missing.length), 7) +
        `${a.advice.intensity} — ${advice}`,
    );
  }

  console.log("-".repeat(110));
  console.log(
    `\n${SPECS.length} athletes, ${totalObs} observations total. Every analysis above is built from the seeded real data — no fabricated content.`,
  );
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
