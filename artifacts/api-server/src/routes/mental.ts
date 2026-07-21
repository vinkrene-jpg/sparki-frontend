// Mentale Weerbaarheid routes — read-only overview for the Lab card, plus the
// optional first-person mental reflection tied to a completed workout.

import { Router, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  plannedWorkoutsTable,
  workoutMentalReflectionsTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { getMentalOverview } from "../engines/mental";
import { captureContext } from "../engines/context-memory";

const router: Router = Router();

router.get(
  "/mental/overview",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req)!;
    try {
      const overview = await getMentalOverview(clerkId);
      res.json({ overview });
    } catch (err) {
      req.log.error({ err }, "mental.overview failed");
      res.status(500).json({ error: "Overzicht ophalen mislukt" });
    }
  },
);

// The athlete's own mental reflection for one workout. GET returns the existing
// reflection (or null) so the werkblad can confirm what is already known before
// asking; PUT upserts it (one per workout). Ownership is enforced via clerkId.
router.get(
  "/mental/reflection/:workoutId",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req)!;
    const workoutId = parseInt(String(req.params["workoutId"]), 10);
    if (isNaN(workoutId)) {
      res.status(400).json({ error: "Ongeldig trainings-id" });
      return;
    }
    try {
      const [reflection] = await db
        .select()
        .from(workoutMentalReflectionsTable)
        .where(
          and(
            eq(workoutMentalReflectionsTable.workoutId, workoutId),
            eq(workoutMentalReflectionsTable.clerkId, clerkId),
          ),
        );
      res.json({ reflection: reflection ?? null });
    } catch (err) {
      req.log.error({ err }, "mental.reflection.get failed");
      res.status(500).json({ error: "Reflectie ophalen mislukt" });
    }
  },
);

function clampScale(v: unknown): number | null {
  if (v == null) return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n < 1 || n > 5) return null;
  return n;
}

router.put(
  "/mental/reflection/:workoutId",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req)!;
    const workoutId = parseInt(String(req.params["workoutId"]), 10);
    if (isNaN(workoutId)) {
      res.status(400).json({ error: "Ongeldig trainings-id" });
      return;
    }
    const body = req.body as {
      motivationBefore?: unknown;
      mentalEffort?: unknown;
      note?: unknown;
    };
    const motivationBefore = clampScale(body.motivationBefore);
    const mentalEffort = clampScale(body.mentalEffort);
    const note =
      typeof body.note === "string" && body.note.trim()
        ? body.note.trim().slice(0, 2000)
        : null;

    if (motivationBefore == null && mentalEffort == null && note == null) {
      res.status(400).json({
        error:
          "Geef minstens één signaal op: motivatie vooraf, mentale zwaarte of een notitie.",
      });
      return;
    }

    try {
      // Ownership check — the workout must belong to this athlete.
      const [workout] = await db
        .select({ id: plannedWorkoutsTable.id })
        .from(plannedWorkoutsTable)
        .where(
          and(
            eq(plannedWorkoutsTable.id, workoutId),
            eq(plannedWorkoutsTable.clerkId, clerkId),
          ),
        );
      if (!workout) {
        res.status(404).json({ error: "Training niet gevonden" });
        return;
      }

      const [reflection] = await db
        .insert(workoutMentalReflectionsTable)
        .values({ clerkId, workoutId, motivationBefore, mentalEffort, note })
        .onConflictDoUpdate({
          target: workoutMentalReflectionsTable.workoutId,
          set: { motivationBefore, mentalEffort, note, updatedAt: new Date() },
        })
        .returning();

      // Let Sparki pick up a personal-context moment from a free note, same as
      // workout feedback. Best-effort + privacy-gated; never blocks the write.
      if (note) {
        captureContext(clerkId, note).catch((err) =>
          req.log.error({ err }, "mental.reflection context capture failed"),
        );
      }

      res.status(200).json({ reflection });
    } catch (err) {
      req.log.error({ err }, "mental.reflection.put failed");
      res.status(500).json({ error: "Reflectie opslaan mislukt" });
    }
  },
);

export default router;
