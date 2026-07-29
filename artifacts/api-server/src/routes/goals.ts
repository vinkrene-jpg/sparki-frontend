import { Router } from "express";
import { and, asc, eq, like, sql } from "drizzle-orm";
import { db, athleteGoalsTable, goalEventsTable } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  loadGoalPicture,
  buildMonthlyProposals,
  decideProposal,
  recordGoalEvent,
  isValidHorizon,
  isValidStatus,
} from "../engines/goals";

const router = Router();

const strOrNull = (v: unknown): string | null =>
  typeof v === "string" && v.trim() !== "" ? v.trim() : null;

const isIsoDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(new Date(v + "T00:00:00Z").getTime());

// GET /api/goals — the full goal picture: manual goals with deterministic
// progress, derived goals from existing sources, open proposals and the one
// next question (doorvraagladder).
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const picture = await loadGoalPicture(clerkId);
    res.json(picture);
  } catch (err) {
    req.log.error({ err }, "goals.picture failed");
    res.status(500).json({ error: "Kon doelen niet laden" });
  }
});

// POST /api/goals — create a goal (main or sub).
router.post("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const title = strOrNull(body.title);
  if (!title) {
    res.status(400).json({ error: "Een doel heeft een titel nodig" });
    return;
  }
  const horizon = isValidHorizon(body.horizon) ? body.horizon : "season";
  const targetDate = body.targetDate == null || body.targetDate === "" ? null : body.targetDate;
  if (targetDate != null && !isIsoDate(targetDate)) {
    res.status(400).json({ error: "Ongeldige streefdatum (JJJJ-MM-DD)" });
    return;
  }
  const priorityNum = Number(body.priority);
  const priority = [1, 2, 3].includes(priorityNum) ? priorityNum : 2;

  let parentGoalId: number | null = null;
  if (body.parentGoalId != null) {
    const pid = Number(body.parentGoalId);
    if (!Number.isInteger(pid)) {
      res.status(400).json({ error: "Ongeldig hoofddoel" });
      return;
    }
    const [parent] = await db
      .select({ id: athleteGoalsTable.id })
      .from(athleteGoalsTable)
      .where(and(eq(athleteGoalsTable.id, pid), eq(athleteGoalsTable.clerkId, clerkId)));
    if (!parent) {
      res.status(400).json({ error: "Hoofddoel niet gevonden" });
      return;
    }
    parentGoalId = pid;
  }

  // Optioneel: atomaire update-of-aanmaak op titelprefix (Wattage-lab).
  // Zonder unieke index dwingen we serialisatie af met een advisory xact-lock
  // per (atleet, prefix) binnen één transactie — dubbelkliks of twee tabbladen
  // kunnen zo nooit twee doelen voor dezelfde duur maken.
  const dedupePrefix = strOrNull(body.dedupeTitlePrefix);

  try {
    const values = {
      clerkId,
      parentGoalId,
      title,
      description: strOrNull(body.description),
      horizon,
      targetDate: targetDate as string | null,
      measure: strOrNull(body.measure),
      targetValue: strOrNull(body.targetValue),
      priority,
    };

    const { goal, updated } = await db.transaction(async (tx) => {
      if (dedupePrefix) {
        await tx.execute(
          sql`SELECT pg_advisory_xact_lock(hashtext(${`goal-dedupe|${clerkId}|${dedupePrefix}`}))`,
        );
        const [existing] = await tx
          .select({ id: athleteGoalsTable.id })
          .from(athleteGoalsTable)
          .where(
            and(
              eq(athleteGoalsTable.clerkId, clerkId),
              eq(athleteGoalsTable.status, "active"),
              like(athleteGoalsTable.title, `${dedupePrefix}%`),
            ),
          )
          .limit(1);
        if (existing) {
          const [row] = await tx
            .update(athleteGoalsTable)
            .set({
              title: values.title,
              description: values.description,
              horizon: values.horizon,
              targetDate: values.targetDate,
              measure: values.measure,
              targetValue: values.targetValue,
              priority: values.priority,
              updatedAt: new Date(),
            })
            .where(eq(athleteGoalsTable.id, existing.id))
            .returning();
          return { goal: row!, updated: true };
        }
      }
      const [row] = await tx.insert(athleteGoalsTable).values(values).returning();
      return { goal: row!, updated: false };
    });

    await recordGoalEvent({
      clerkId,
      goalId: goal.id,
      eventType: updated ? "adjusted" : "created",
      note: title,
    });
    res.status(updated ? 200 : 201).json({ goal, updated });
  } catch (err) {
    req.log.error({ err }, "goals.create failed");
    res.status(500).json({ error: "Kon doel niet opslaan" });
  }
});

// PUT /api/goals/:id — adjust a goal (records an event; never silent).
router.put("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;

  const patch: Partial<typeof athleteGoalsTable.$inferInsert> = {};
  if (body.title !== undefined) {
    const t = strOrNull(body.title);
    if (!t) {
      res.status(400).json({ error: "Titel mag niet leeg zijn" });
      return;
    }
    patch.title = t;
  }
  if (body.description !== undefined) patch.description = strOrNull(body.description);
  if (body.measure !== undefined) patch.measure = strOrNull(body.measure);
  if (body.targetValue !== undefined) patch.targetValue = strOrNull(body.targetValue);
  if (body.horizon !== undefined) {
    if (!isValidHorizon(body.horizon)) {
      res.status(400).json({ error: "Ongeldige horizon" });
      return;
    }
    patch.horizon = body.horizon;
  }
  if (body.targetDate !== undefined) {
    if (body.targetDate === null || body.targetDate === "") patch.targetDate = null;
    else if (isIsoDate(body.targetDate)) patch.targetDate = body.targetDate;
    else {
      res.status(400).json({ error: "Ongeldige streefdatum (JJJJ-MM-DD)" });
      return;
    }
  }
  if (body.priority !== undefined) {
    const p = Number(body.priority);
    if (![1, 2, 3].includes(p)) {
      res.status(400).json({ error: "Ongeldige prioriteit" });
      return;
    }
    patch.priority = p;
  }
  let statusChanged: string | null = null;
  if (body.status !== undefined) {
    if (!isValidStatus(body.status)) {
      res.status(400).json({ error: "Ongeldige status" });
      return;
    }
    patch.status = body.status;
    patch.statusReason = strOrNull(body.statusReason);
    statusChanged = body.status;
  }
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "Niets om bij te werken" });
    return;
  }
  patch.updatedAt = new Date();

  try {
    const [updated] = await db
      .update(athleteGoalsTable)
      .set(patch)
      .where(and(eq(athleteGoalsTable.id, id), eq(athleteGoalsTable.clerkId, clerkId)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Doel niet gevonden" });
      return;
    }
    const eventType =
      statusChanged === "achieved"
        ? "achieved"
        : statusChanged === "dropped"
          ? "dropped"
          : statusChanged === "paused"
            ? "paused"
            : statusChanged === "active"
              ? "resumed"
              : "adjusted";
    await recordGoalEvent({
      clerkId,
      goalId: id,
      eventType,
      note: strOrNull(body.statusReason) ?? "Bijgewerkt door de sporter",
      payload: patch,
    });
    res.json({ goal: updated });
  } catch (err) {
    req.log.error({ err }, "goals.update failed");
    res.status(500).json({ error: "Kon doel niet bijwerken" });
  }
});

// DELETE /api/goals/:id — remove a goal entirely (events cascade).
router.delete("/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    await db
      .delete(athleteGoalsTable)
      .where(and(eq(athleteGoalsTable.id, id), eq(athleteGoalsTable.clerkId, clerkId)));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "goals.delete failed");
    res.status(500).json({ error: "Kon doel niet verwijderen" });
  }
});

// GET /api/goals/:id/events — full history of one goal.
router.get("/:id/events", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Ongeldige id" });
    return;
  }
  try {
    const events = await db
      .select()
      .from(goalEventsTable)
      .where(and(eq(goalEventsTable.goalId, id), eq(goalEventsTable.clerkId, clerkId)))
      .orderBy(asc(goalEventsTable.createdAt));
    res.json({ events });
  } catch (err) {
    req.log.error({ err }, "goals.events failed");
    res.status(500).json({ error: "Kon geschiedenis niet laden" });
  }
});

// POST /api/goals/proposals/build — on-demand run of the monthly review.
router.post("/proposals/build", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const result = await buildMonthlyProposals(clerkId);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "goals.proposals.build failed");
    res.status(500).json({ error: "Kon voorstellen niet opstellen" });
  }
});

// POST /api/goals/proposals/:id/decision — accept or reject a proposal.
router.post("/proposals/:id/decision", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  const decision = (req.body ?? {}).decision;
  if (!Number.isInteger(id) || (decision !== "accepted" && decision !== "rejected")) {
    res.status(400).json({ error: "Ongeldig verzoek" });
    return;
  }
  try {
    const updated = await decideProposal(clerkId, id, decision);
    if (!updated) {
      res.status(404).json({ error: "Voorstel niet gevonden of al beslist" });
      return;
    }
    res.json({ proposal: updated });
  } catch (err) {
    req.log.error({ err }, "goals.proposals.decision failed");
    res.status(500).json({ error: "Kon beslissing niet verwerken" });
  }
});

export default router;
