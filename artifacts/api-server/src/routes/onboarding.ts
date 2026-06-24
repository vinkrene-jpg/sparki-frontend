import { Router } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  onboardingStateTable,
  athleteProfilesTable,
  coachAthleteLinksTable,
  userProfilesTable,
} from "@workspace/db";
import { isSportActive, DEFAULT_SPORT } from "@workspace/feature-flags";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { generatePlan } from "../engines/training-plan";
import {
  assignFoundingNumber,
  foundingLabel,
  headTesterLine,
  FOUNDING_LINES,
} from "../engines/insights";
import {
  getMissingOnboardingData,
  EXPERIENCE_LEVELS,
  estimateWeeklyHours,
  estimateFtp,
  defaultAvailableDays,
  selectNextQuestions,
  parseFactAnswer,
  getFact,
  type ExperienceLevel,
  type ProfilePatch,
  type ProgressiveFacts,
} from "../engines/onboarding";

const router = Router();

// GET /api/onboarding/missing-data — required fields the first weekplan needs
// that are still missing after any connector import. Drives the manual fallback.
router.get("/missing-data", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const result = await getMissingOnboardingData(clerkId);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "onboarding.missingData failed");
    res.status(500).json({ error: "Failed to compute missing data" });
  }
});

function defaults(clerkId: string) {
  return {
    clerkId,
    onboardingStartedAt: null,
    onboardingCompletedAt: null,
    coreCompletedAt: null,
    onboardingVersion: "1",
    completedSteps: [] as number[],
    skippedSteps: [] as number[],
    currentStep: 0,
    isComplete: false,
    progressiveFacts: {} as ProgressiveFacts,
    lastSeenAt: null,
  };
}

async function hasAcceptedCoach(athleteClerkId: string): Promise<boolean> {
  const [row] = await db
    .select({ athleteClerkId: coachAthleteLinksTable.athleteClerkId })
    .from(coachAthleteLinksTable)
    .where(
      and(
        eq(coachAthleteLinksTable.athleteClerkId, athleteClerkId),
        eq(coachAthleteLinksTable.status, "accepted"),
      ),
    )
    .limit(1);
  return !!row;
}

// Safely regenerate the autonomous plan after a planning input changes. Never
// lets a plan-generation hiccup fail the onboarding/answer request itself, but
// reports whether a plan was actually built so callers can be honest about it
// (the dashboard renders a general fallback when no plan exists yet).
async function regeneratePlanSafely(
  clerkId: string,
  log: { error: (o: unknown, m: string) => void },
): Promise<boolean> {
  try {
    const coached = await hasAcceptedCoach(clerkId);
    await generatePlan(clerkId, coached ? "advisory" : "autonomous");
    return true;
  } catch (err) {
    log.error({ err }, "onboarding.plan.regenerate failed");
    return false;
  }
}

async function loadProgressiveFacts(clerkId: string): Promise<ProgressiveFacts> {
  const [row] = await db
    .select({ progressiveFacts: onboardingStateTable.progressiveFacts })
    .from(onboardingStateTable)
    .where(eq(onboardingStateTable.clerkId, clerkId));
  return (row?.progressiveFacts as ProgressiveFacts | null) ?? {};
}

// Merge a single fact's lifecycle state into onboarding_state, upserting the row.
async function writeFactState(
  clerkId: string,
  key: string,
  state: ProgressiveFacts[string],
) {
  const current = await loadProgressiveFacts(clerkId);
  const next: ProgressiveFacts = { ...current, [key]: state };
  const now = new Date();
  await db
    .insert(onboardingStateTable)
    .values({
      clerkId,
      onboardingStartedAt: now,
      progressiveFacts: next,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: onboardingStateTable.clerkId,
      set: { progressiveFacts: next, updatedAt: now },
    });
}

// GET /api/onboarding/state — DB is the source of truth; localStorage is a cache.
router.get("/state", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [row] = await db
      .select()
      .from(onboardingStateTable)
      .where(eq(onboardingStateTable.clerkId, clerkId));
    res.json({ onboarding: row ?? defaults(clerkId) });
  } catch (err) {
    req.log.error({ err }, "onboarding.get failed");
    res.status(500).json({ error: "Failed to load onboarding state" });
  }
});

// PUT /api/onboarding/state — upsert progress. Sets started/completed timestamps.
router.put("/state", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = req.body as {
    completedSteps?: unknown;
    skippedSteps?: unknown;
    currentStep?: unknown;
    isComplete?: unknown;
  };

  const asNumberArray = (v: unknown): number[] | undefined =>
    Array.isArray(v) ? v.map(Number).filter((n) => Number.isFinite(n)) : undefined;

  const completedSteps = asNumberArray(body.completedSteps);
  const skippedSteps = asNumberArray(body.skippedSteps);
  const currentStep =
    typeof body.currentStep === "number" ? body.currentStep : undefined;
  const isComplete =
    typeof body.isComplete === "boolean" ? body.isComplete : undefined;

  const now = new Date();
  const set: Record<string, unknown> = { lastSeenAt: now, updatedAt: now };
  if (completedSteps !== undefined) set.completedSteps = completedSteps;
  if (skippedSteps !== undefined) set.skippedSteps = skippedSteps;
  if (currentStep !== undefined) set.currentStep = currentStep;
  if (isComplete !== undefined) {
    set.isComplete = isComplete;
    if (isComplete) set.onboardingCompletedAt = now;
  }

  try {
    const [row] = await db
      .insert(onboardingStateTable)
      .values({
        clerkId,
        onboardingStartedAt: now,
        completedSteps: completedSteps ?? [],
        skippedSteps: skippedSteps ?? [],
        currentStep: currentStep ?? 0,
        isComplete: isComplete ?? false,
        onboardingCompletedAt: isComplete ? now : null,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: onboardingStateTable.clerkId,
        set,
      })
      .returning();
    res.json({ onboarding: row });
  } catch (err) {
    req.log.error({ err }, "onboarding.put failed");
    res.status(500).json({ error: "Failed to save onboarding state" });
  }
});

// POST /api/onboarding/quick-start — the 4-question core. Writes the answers,
// derives ESTIMATED weekly hours + FTP + a default weekday spread, builds the
// athlete's first autonomous plan, and marks the app usable. Everything else is
// gathered gradually afterward via the adaptive prompts.
router.post("/quick-start", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = req.body as {
    sport?: string;
    goals?: string;
    experienceLevel?: string;
    trainingDaysPerWeek?: number;
  };

  // Sport availability is governed by the shared sport registry. Only sports
  // with a built training engine are marked "active"; everything else is blocked
  // here (no placeholder support for sports that don't really work yet).
  const sport = (body.sport ?? DEFAULT_SPORT).toLowerCase();
  if (!isSportActive(sport)) {
    res
      .status(400)
      .json({ error: "Deze sport is nog niet beschikbaar in Sparki." });
    return;
  }
  if (
    !body.experienceLevel ||
    !EXPERIENCE_LEVELS.includes(body.experienceLevel as ExperienceLevel)
  ) {
    res.status(400).json({
      error: `experienceLevel must be one of: ${EXPERIENCE_LEVELS.join(", ")}`,
    });
    return;
  }
  const days = Number(body.trainingDaysPerWeek);
  if (!Number.isFinite(days) || days < 1 || days > 7) {
    res.status(400).json({ error: "trainingDaysPerWeek must be 1–7" });
    return;
  }
  const experience = body.experienceLevel as ExperienceLevel;
  const trainingDaysPerWeek = Math.round(days);
  const goals = typeof body.goals === "string" ? body.goals.trim().slice(0, 600) : null;

  const patch: ProfilePatch = {
    sport,
    experienceLevel: experience,
    trainingDaysPerWeek,
    availableDays: defaultAvailableDays(trainingDaysPerWeek),
    weeklyHourTarget: estimateWeeklyHours(experience, trainingDaysPerWeek),
    weeklyHourTargetEstimated: true,
    ftp: estimateFtp(experience),
    ftpEstimated: true,
    ...(goals ? { goals } : {}),
  };

  const now = new Date();
  try {
    // The athlete_profiles insert below has an FK to user_profiles. If sync
    // never created the parent row (e.g. it errored), inserting here would throw
    // a raw FK 500 and brick onboarding. Fail with a clear, recoverable error.
    const [parent] = await db
      .select({ clerkId: userProfilesTable.clerkId })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkId));
    if (!parent) {
      res.status(409).json({ error: "Je account is nog niet klaar. Log opnieuw in en probeer het nog eens." });
      return;
    }

    await db
      .insert(athleteProfilesTable)
      .values({ clerkId, ...patch })
      .onConflictDoUpdate({
        target: athleteProfilesTable.clerkId,
        set: { ...patch, updatedAt: now },
      });

    await db
      .insert(onboardingStateTable)
      .values({
        clerkId,
        onboardingStartedAt: now,
        coreCompletedAt: now,
        onboardingCompletedAt: now,
        isComplete: true,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: onboardingStateTable.clerkId,
        set: {
          coreCompletedAt: now,
          onboardingCompletedAt: now,
          isComplete: true,
          lastSeenAt: now,
          updatedAt: now,
        },
      });

    // Build the first real plan immediately so the dashboard is usable. A plan
    // hiccup never fails onboarding (the home degrades to a general day), but we
    // report planReady honestly so the client never claims a plan that isn't there.
    const planReady = await regeneratePlanSafely(clerkId, req.log);

    res.status(201).json({
      ok: true,
      planReady,
      estimated: { weeklyHourTarget: patch.weeklyHourTarget, ftp: patch.ftp },
    });
  } catch (err) {
    req.log.error({ err }, "onboarding.quick-start failed");
    res.status(500).json({ error: "Failed to complete quick start" });
  }
});

// The five self-claims an athlete can make in onboarding V2. Free-form keys; the
// engine never treats them as ground truth — only as a claim to test against data.
const SELF_TYPES = [
  "diesel",
  "sprinter",
  "alleskunner",
  "geen_idee",
  "ik_zie_wel",
] as const;

// POST /api/onboarding/complete-v2 — finish the narrative onboarding. Saves the
// self-claim, seeds sensible planning defaults ONLY for values not already set
// (so a returning athlete keeps their real numbers), assigns the Founding Athlete
// number atomically, builds the first real plan, and marks onboarding complete.
router.post("/complete-v2", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const selfType = (req.body as { selfType?: string }).selfType;
  if (!selfType || !SELF_TYPES.includes(selfType as (typeof SELF_TYPES)[number])) {
    res
      .status(400)
      .json({ error: `selfType must be one of: ${SELF_TYPES.join(", ")}` });
    return;
  }

  const sport = DEFAULT_SPORT.toLowerCase();
  const experience: ExperienceLevel = "beginner";
  const trainingDaysPerWeek = 3;
  const now = new Date();

  try {
    // FK guard: athlete_profiles references user_profiles. Fail clearly (not a
    // raw FK 500) if sync never created the parent row.
    const [parent] = await db
      .select({ clerkId: userProfilesTable.clerkId })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkId));
    if (!parent) {
      res.status(409).json({
        error: "Je account is nog niet klaar. Log opnieuw in en probeer het nog eens.",
      });
      return;
    }

    const [existing] = await db
      .select()
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId));

    // Seed planning defaults ONLY where nothing real exists yet.
    const seed: ProfilePatch = {};
    if (!existing?.experienceLevel) seed.experienceLevel = experience;
    if (!existing?.sport) seed.sport = sport;
    if (existing?.trainingDaysPerWeek == null) {
      seed.trainingDaysPerWeek = trainingDaysPerWeek;
      seed.availableDays = defaultAvailableDays(trainingDaysPerWeek);
    }
    if (existing?.weeklyHourTarget == null) {
      seed.weeklyHourTarget = estimateWeeklyHours(experience, trainingDaysPerWeek);
      seed.weeklyHourTargetEstimated = true;
    }
    if (existing?.ftp == null) {
      seed.ftp = estimateFtp(experience);
      seed.ftpEstimated = true;
    }
    const patch: ProfilePatch = { ...seed, selfType };

    await db
      .insert(athleteProfilesTable)
      .values({ clerkId, ...patch })
      .onConflictDoUpdate({
        target: athleteProfilesTable.clerkId,
        set: { ...patch, updatedAt: now },
      });

    await db
      .insert(onboardingStateTable)
      .values({
        clerkId,
        onboardingStartedAt: now,
        coreCompletedAt: now,
        onboardingCompletedAt: now,
        onboardingVersion: "2",
        isComplete: true,
        lastSeenAt: now,
      })
      .onConflictDoUpdate({
        target: onboardingStateTable.clerkId,
        set: {
          coreCompletedAt: now,
          onboardingCompletedAt: now,
          onboardingVersion: "2",
          isComplete: true,
          lastSeenAt: now,
          updatedAt: now,
        },
      });

    // Earn the Founding Athlete badge (atomic + idempotent).
    const foundingNumber = await assignFoundingNumber(clerkId);

    // Build the first real plan immediately so the app is usable on landing. A
    // plan hiccup never fails onboarding (the home degrades to a general day),
    // but planReady is reported honestly so the client never claims a missing plan.
    const planReady = await regeneratePlanSafely(clerkId, req.log);

    res.status(201).json({
      ok: true,
      planReady,
      foundingNumber,
      foundingLabel: foundingLabel(foundingNumber),
      foundingLines: FOUNDING_LINES,
    });
  } catch (err) {
    req.log.error({ err }, "onboarding.complete-v2 failed");
    res.status(500).json({ error: "Kon onboarding niet afronden." });
  }
});

// GET /api/onboarding/identity — Founding Athlete badge + Hoofdtester status.
// Both are real account facts; the rotating tester line is deterministic per day.
router.get("/identity", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [u] = await db
      .select({
        foundingNumber: userProfilesTable.foundingNumber,
        isHeadTester: userProfilesTable.isHeadTester,
      })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkId));
    if (!u) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json({
      foundingNumber: u.foundingNumber,
      foundingLabel: u.foundingNumber != null ? foundingLabel(u.foundingNumber) : null,
      foundingLines: u.foundingNumber != null ? FOUNDING_LINES : [],
      isHeadTester: u.isHeadTester,
      headTesterLine: u.isHeadTester ? headTesterLine() : null,
    });
  } catch (err) {
    req.log.error({ err }, "onboarding.identity failed");
    res.status(500).json({ error: "Kon je status niet laden." });
  }
});

// POST /api/onboarding/coaching-mode — athlete picks coach vs Sparki.
router.post("/coaching-mode", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const mode = (req.body as { mode?: string }).mode;
  if (mode !== "sparki" && mode !== "coach") {
    res.status(400).json({ error: "mode must be 'sparki' or 'coach'" });
    return;
  }
  try {
    const [updated] = await db
      .update(athleteProfilesTable)
      .set({ coachingMode: mode, updatedAt: new Date() })
      .where(eq(athleteProfilesTable.clerkId, clerkId))
      .returning({ id: athleteProfilesTable.id });
    if (!updated) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    await writeFactState(clerkId, "coachingMode", {
      status: "answered",
      lastAskedAt: new Date().toISOString(),
    });
    res.json({ ok: true, mode });
  } catch (err) {
    req.log.error({ err }, "onboarding.coaching-mode failed");
    res.status(500).json({ error: "Failed to save coaching choice" });
  }
});

// GET /api/onboarding/next-questions — adaptive follow-up prompts (top N).
router.get("/next-questions", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const limit = Math.min(
    Math.max(parseInt(String(req.query["limit"] ?? "3"), 10) || 3, 1),
    5,
  );
  try {
    const [profile] = await db
      .select()
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId));
    if (!profile) {
      res.json({ questions: [] });
      return;
    }
    const facts = await loadProgressiveFacts(clerkId);
    res.json({ questions: selectNextQuestions(profile, facts, limit) });
  } catch (err) {
    req.log.error({ err }, "onboarding.next-questions failed");
    res.status(500).json({ error: "Failed to load questions" });
  }
});

// POST /api/onboarding/answer — record a progressive fact answer.
router.post("/answer", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const { key, value } = req.body as { key?: string; value?: unknown };
  if (!key || !getFact(key)) {
    res.status(400).json({ error: "Unknown question" });
    return;
  }
  const parsed = parseFactAnswer(key, value);
  if (!parsed) {
    res.status(400).json({ error: "Invalid answer" });
    return;
  }
  try {
    const [updated] = await db
      .update(athleteProfilesTable)
      .set({ ...parsed.patch, updatedAt: new Date() })
      .where(eq(athleteProfilesTable.clerkId, clerkId))
      .returning({ id: athleteProfilesTable.id });
    if (!updated) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    await writeFactState(clerkId, key, {
      status: "answered",
      lastAskedAt: new Date().toISOString(),
    });
    if (parsed.regeneratePlan) {
      await regeneratePlanSafely(clerkId, req.log);
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "onboarding.answer failed");
    res.status(500).json({ error: "Failed to save answer" });
  }
});

// POST /api/onboarding/skip — snooze a question so it resurfaces later.
router.post("/skip", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const key = (req.body as { key?: string }).key;
  if (!key || !getFact(key)) {
    res.status(400).json({ error: "Unknown question" });
    return;
  }
  try {
    const facts = await loadProgressiveFacts(clerkId);
    const prev = facts[key];
    const snooze = new Date();
    snooze.setUTCDate(snooze.getUTCDate() + 3);
    await writeFactState(clerkId, key, {
      status: "skipped",
      askedCount: (prev?.askedCount ?? 0) + 1,
      lastAskedAt: new Date().toISOString(),
      skippedUntil: snooze.toISOString(),
    });
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "onboarding.skip failed");
    res.status(500).json({ error: "Failed to skip question" });
  }
});

export default router;
