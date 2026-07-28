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
  coachAthleteLinksTable,
  parentAthleteLinksTable,
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
  // Persona-extra's (alle optioneel; default = volwassen sporter, legacy):
  roles?: string[]; // bijv. ["coach"] of ["parent"]
  activeRole?: string;
  entitlementMode?: "legacy_unrestricted" | "subscription";
  productVariant?: string | null; // alleen zinvol bij subscription
  birthDate?: string; // ISO — authoritatief; birthYear wordt in lockstep gezet
  skipAthleteData?: boolean; // coach/ouder: geen eigen sportdata
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

// ── Persona's (Task: previewkiezer "kijk als deze gebruiker") ────────────────
// Alleen rollen/pakketten die het systeem vandaag echt kent. Abonnements-
// persona's staan in subscription-mode; omdat variant_feature_grants bewust
// leeg is tot sales-start, gedragen ze zich nu fail-closed (géén legacy-
// rechten) — precies wat zo'n gebruiker vandaag zou zien.
const PERSONA_SPECS: Spec[] = [
  {
    clerkId: "seed_persona_gratis",
    name: "Gratis (geen pakket)",
    email: "persona-gratis@preview.sparki",
    expect: "subscription zonder variant — fail-closed",
    entitlementMode: "subscription",
    productVariant: null,
    profile: { experienceLevel: "beginner", birthYear: THIS_YEAR - 29 },
    load: "low",
    metricDays: 4,
    feel: 6,
    fatigue: 4,
  },
  {
    clerkId: "seed_persona_go",
    name: "Abonnee Go",
    email: "persona-go@preview.sparki",
    expect: "variant sparki_go",
    entitlementMode: "subscription",
    productVariant: "sparki_go",
    profile: { experienceLevel: "beginner", birthYear: THIS_YEAR - 31 },
    load: "low",
    metricDays: 4,
    feel: 6,
    fatigue: 4,
  },
  {
    clerkId: "seed_persona_basic",
    name: "Abonnee Basis",
    email: "persona-basic@preview.sparki",
    expect: "variant sparki_basic",
    entitlementMode: "subscription",
    productVariant: "sparki_basic",
    profile: { experienceLevel: "intermediate", birthYear: THIS_YEAR - 36 },
    load: "steady",
    metricDays: 7,
    feel: 7,
    fatigue: 4,
  },
  {
    clerkId: "seed_persona_performance",
    name: "Abonnee Performance",
    email: "persona-performance@preview.sparki",
    expect: "variant sparki_performance",
    entitlementMode: "subscription",
    productVariant: "sparki_performance",
    profile: { experienceLevel: "advanced", competitionLevel: "regional", birthYear: THIS_YEAR - 33, ftp: 290 },
    load: "steady",
    metricDays: 10,
    feel: 7,
    fatigue: 4,
  },
  {
    clerkId: "seed_persona_pro",
    name: "Abonnee Pro (compleet)",
    email: "persona-pro@preview.sparki",
    expect: "variant sparki_pro",
    entitlementMode: "subscription",
    productVariant: "sparki_pro",
    profile: { experienceLevel: "elite", competitionLevel: "national", birthYear: THIS_YEAR - 26, ftp: 340, weeklyHourTarget: 14 },
    load: "steady",
    metricDays: 14,
    hrv: [62, 64],
    restingHr: [46, 45],
    sleep: [7.6, 8],
    feel: 8,
    fatigue: 3,
    ftp: [325, 333, 340],
  },
  {
    clerkId: "seed_persona_jeugd14",
    name: "Noa (jeugd, 14)",
    email: "persona-jeugd14@preview.sparki",
    expect: "u16-regels (jeugdbescherming, ouder mag bewerken)",
    birthDate: `${THIS_YEAR - 14}-03-15`,
    profile: { experienceLevel: "beginner", birthYear: THIS_YEAR - 14 },
    load: "low",
    metricDays: 4,
    feel: 7,
    fatigue: 3,
  },
  {
    clerkId: "seed_persona_jeugd17",
    name: "Timo (jeugd, 17)",
    email: "persona-jeugd17@preview.sparki",
    expect: "16-17-regels",
    birthDate: `${THIS_YEAR - 17}-02-10`,
    profile: { experienceLevel: "intermediate", competitionLevel: "regional", birthYear: THIS_YEAR - 17, ftp: 250 },
    load: "steady",
    metricDays: 7,
    feel: 7,
    fatigue: 4,
  },
  {
    clerkId: "seed_persona_renster",
    name: "Fleur (renster)",
    email: "persona-renster@preview.sparki",
    expect: "volwassen renster (app kent nog geen geslachtsveld)",
    profile: { experienceLevel: "advanced", competitionLevel: "regional", birthYear: THIS_YEAR - 28, ftp: 245, weeklyHourTarget: 9 },
    load: "steady",
    metricDays: 10,
    hrv: [58, 60],
    restingHr: [50, 49],
    sleep: [7.5, 7.8],
    feel: 7,
    fatigue: 4,
  },
  {
    clerkId: "seed_persona_coach",
    name: "Coach Bram",
    email: "persona-coach@preview.sparki",
    expect: "coachrol, gekoppeld aan Dylan",
    roles: ["coach"],
    activeRole: "coach",
    skipAthleteData: true,
    profile: { birthYear: THIS_YEAR - 45 },
    load: "low",
    metricDays: 0,
  },
  {
    clerkId: "seed_persona_ouder",
    name: "Ouder van Noa",
    email: "persona-ouder@preview.sparki",
    expect: "ouderrol, bevestigde koppeling met Noa (u16)",
    roles: ["parent"],
    activeRole: "parent",
    skipAthleteData: true,
    profile: { birthYear: THIS_YEAR - 44 },
    load: "low",
    metricDays: 0,
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

  // Veiligheidsguard: ensureAccount her-linkt bestaande rijen op e-mail
  // (account-herstelpad). Voor seeds mag dat NOOIT een echte gebruiker raken —
  // bestaat dit e-mailadres al onder een ander clerkId, dan stoppen we hard.
  const [collision] = await db
    .select({ clerkId: userProfilesTable.clerkId })
    .from(userProfilesTable)
    .where(eq(userProfilesTable.email, spec.email));
  if (collision && collision.clerkId !== clerkId) {
    throw new Error(
      `Seed geweigerd: e-mail ${spec.email} hoort al bij ${collision.clerkId} (niet ${clerkId}). Geen bestaande gebruiker aangepast.`,
    );
  }

  await ensureAccount(clerkId, spec.email, spec.name, silentLogger);

  if (spec.skipAthleteData) {
    // Coach/ouder-persona: geen eigen sportprofiel of trainingsdata.
    await db
      .update(userProfilesTable)
      .set({
        roles: spec.roles ?? ["athlete"],
        activeRole: spec.activeRole ?? "athlete",
        entitlementMode: spec.entitlementMode ?? "legacy_unrestricted",
        productVariant: spec.productVariant ?? null,
      })
      .where(eq(userProfilesTable.clerkId, clerkId));
    return;
  }

  await db
    .insert(athleteProfilesTable)
    .values({
      clerkId,
      birthDate: spec.birthDate ?? null,
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
        birthDate: spec.birthDate ?? null,
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

  // Rol + entitlement-laag expliciet zetten (idempotent; default = volwassen
  // sporter in legacy-mode, precies zoals de bestaande testers).
  await db
    .update(userProfilesTable)
    .set({
      roles: spec.roles ?? ["athlete"],
      activeRole: spec.activeRole ?? "athlete",
      entitlementMode: spec.entitlementMode ?? "legacy_unrestricted",
      productVariant: spec.productVariant ?? null,
    })
    .where(eq(userProfilesTable.clerkId, clerkId));
}

// Koppelingen die de rol-persona's betekenisvol maken: zonder gekoppelde
// sporter ziet een coach/ouder alleen een leeg scherm.
// Vaste datum zodat her-runnen van de seed byte-voor-byte dezelfde staat geeft.
const SEED_CONSENT_AT = new Date("2026-01-01T00:00:00Z");

async function seedPersonaLinks(): Promise<void> {
  await db
    .insert(coachAthleteLinksTable)
    .values({
      coachClerkId: "seed_persona_coach",
      athleteClerkId: "seed_preview_dylan",
      status: "accepted",
    })
    .onConflictDoUpdate({
      target: [coachAthleteLinksTable.coachClerkId, coachAthleteLinksTable.athleteClerkId],
      set: { status: "accepted" },
    });

  await db
    .insert(parentAthleteLinksTable)
    .values({
      parentClerkId: "seed_persona_ouder",
      athleteClerkId: "seed_persona_jeugd14",
      status: "accepted",
      relationship: "ouder",
      ageTierAtConsent: "u16",
      consentConfirmedAt: SEED_CONSENT_AT,
    })
    .onConflictDoUpdate({
      target: [parentAthleteLinksTable.parentClerkId, parentAthleteLinksTable.athleteClerkId],
      set: { status: "accepted", ageTierAtConsent: "u16", consentConfirmedAt: SEED_CONSENT_AT },
    });
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

async function main(): Promise<void> {
  const all = [...SPECS, ...PERSONA_SPECS];
  console.log(`Seeding ${all.length} dev-preview gebruikers (atleten + persona's) …`);
  await clearChildRows([...PREVIEW_CLERK_IDS]);
  for (const spec of all) await seedOne(spec);
  await seedPersonaLinks();
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
