import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  nutritionHydrationLogsTable,
  nutritionContexts,
  type NutritionContext,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { analyzeNutritionLog } from "../lib/nutrition-rules";
import { persistObservation } from "../lib/ai-memory";

const router = Router();

const numStr = (v: unknown): string | null =>
  v == null || v === "" ? null : String(v);

const intOrNull = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const strOrNull = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

// GET /api/nutrition?limit= — recent logs, newest first.
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  try {
    const logs = await db
      .select()
      .from(nutritionHydrationLogsTable)
      .where(eq(nutritionHydrationLogsTable.clerkId, clerkId))
      .orderBy(desc(nutritionHydrationLogsTable.logDate))
      .limit(limit);
    res.json({ logs });
  } catch (err) {
    req.log.error({ err }, "nutrition.list failed");
    res.status(500).json({ error: "Kon voedingslogboek niet laden" });
  }
});

// POST /api/nutrition — create a log, then run AI rules → observations.
router.post("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;

  const logDate = strOrNull(body.logDate);
  if (!logDate) {
    res.status(400).json({ error: "logDate is verplicht (YYYY-MM-DD)" });
    return;
  }
  const rawContext = strOrNull(body.context) ?? "normal_day";
  const context: NutritionContext = (
    nutritionContexts as readonly string[]
  ).includes(rawContext)
    ? (rawContext as NutritionContext)
    : "normal_day";

  try {
    const [log] = await db
      .insert(nutritionHydrationLogsTable)
      .values({
        clerkId,
        logDate,
        context,
        preTrainingFood: strOrNull(body.preTrainingFood),
        duringTrainingCarbsGrams: intOrNull(body.duringTrainingCarbsGrams),
        duringTrainingFluidMl: intOrNull(body.duringTrainingFluidMl),
        duringTrainingSodiumMg: intOrNull(body.duringTrainingSodiumMg),
        postTrainingFood: strOrNull(body.postTrainingFood),
        bodyWeightBefore: numStr(body.bodyWeightBefore),
        bodyWeightAfter: numStr(body.bodyWeightAfter),
        stomachIssues: body.stomachIssues === true,
        notes: strOrNull(body.notes),
      })
      .returning();

    // AI rule analysis — privacy-gated inside persistObservation.
    const observations = analyzeNutritionLog(log);
    void Promise.all(observations.map((o) => persistObservation(o))).catch(
      (err) => req.log.error({ err }, "nutrition.analyze failed"),
    );

    res.status(201).json({ log, flagged: observations.length });
  } catch (err) {
    req.log.error({ err }, "nutrition.create failed");
    res.status(500).json({ error: "Kon log niet opslaan" });
  }
});

// DELETE /api/nutrition/:id — remove a log (owner only).
router.delete("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    await db
      .delete(nutritionHydrationLogsTable)
      .where(
        and(
          eq(nutritionHydrationLogsTable.id, id),
          eq(nutritionHydrationLogsTable.clerkId, clerkId),
        ),
      );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "nutrition.delete failed");
    res.status(500).json({ error: "Kon log niet verwijderen" });
  }
});

export default router;
