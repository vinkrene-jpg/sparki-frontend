import { Router } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  onboardingStateTable,
  athleteProfilesTable,
  coachAthleteLinksTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { getMissingOnboardingData } from "../lib/connectors/missing-data";
import { generatePlan } from "../lib/training-plan";
import {
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
} from "../lib/onboarding-questions";

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
// lets a plan-generation hiccup fail the onboarding/answer request itself.
async function regeneratePlanSafely(clerkId: string, log: { error: (o: unknown, m: string) => void }) {
  try {
    const coached = await hasAcceptedCoach(clerkId);
    await generatePlan(clerkId, coached ? "advisory" : "autonomous");
  } catch (err) {
    log.error({ err }, "onboarding.plan.regenerate failed");
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

  // Only cycling is implemented today (sport is modelled for future sports).
  const sport = (body.sport ?? "cycling").toLowerCase();
  if (sport !== "cycling") {
    res.status(400).json({ error: "Only cycling is supported right now" });
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
    sport: "cycling",
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

    // Build the first real plan immediately so the dashboard is usable.
    await regeneratePlanSafely(clerkId, req.log);

    res.status(201).json({
      ok: true,
      estimated: { weeklyHourTarget: patch.weeklyHourTarget, ftp: patch.ftp },
    });
  } catch (err) {
    req.log.error({ err }, "onboarding.quick-start failed");
    res.status(500).json({ error: "Failed to complete quick start" });
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
