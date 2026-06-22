import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, onboardingStateTable } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";

const router = Router();

function defaults(clerkId: string) {
  return {
    clerkId,
    onboardingStartedAt: null,
    onboardingCompletedAt: null,
    onboardingVersion: "1",
    completedSteps: [] as number[],
    skippedSteps: [] as number[],
    currentStep: 0,
    isComplete: false,
    lastSeenAt: null,
  };
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

export default router;
