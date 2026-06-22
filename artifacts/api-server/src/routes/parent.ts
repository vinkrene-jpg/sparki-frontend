import { Router } from "express";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import {
  db,
  parentAthleteLinksTable,
  userProfilesTable,
  athleteProfilesTable,
  athleteDailyMetricsTable,
  plannedWorkoutsTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  parentSharingLevel,
  hasRole,
  getEffectiveParentConsent,
} from "../lib/sharing";

const router = Router();

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// GET /api/parent/athletes — linked children with a wellbeing/safety view.
// dataSharingParent gates the depth: none → nothing, safety_only → health +
// recovery + wellbeing signals, summary → + upcoming schedule.
router.get("/athletes", requireAuth, async (req, res) => {
  const parentId = getClerkUserId(req)!;
  if (!(await hasRole(parentId, "parent"))) {
    res.status(403).json({ error: "Ouder-rol vereist" });
    return;
  }
  try {
    const links = await db
      .select({ athleteClerkId: parentAthleteLinksTable.athleteClerkId })
      .from(parentAthleteLinksTable)
      .where(
        and(
          eq(parentAthleteLinksTable.parentClerkId, parentId),
          eq(parentAthleteLinksTable.status, "accepted"),
        ),
      );
    const ids = links.map((l) => l.athleteClerkId);
    if (ids.length === 0) {
      res.json({ athletes: [] });
      return;
    }

    const profiles = await db
      .select({
        clerkId: userProfilesTable.clerkId,
        displayName: userProfilesTable.displayName,
        healthStatus: athleteProfilesTable.healthStatus,
      })
      .from(userProfilesTable)
      .leftJoin(
        athleteProfilesTable,
        eq(athleteProfilesTable.clerkId, userProfilesTable.clerkId),
      )
      .where(inArray(userProfilesTable.clerkId, ids));

    const athletes = await Promise.all(
      profiles.map(async (p) => {
        const sharing = await parentSharingLevel(p.clerkId);
        const consent = await getEffectiveParentConsent(p.clerkId);
        const base = {
          athleteClerkId: p.clerkId,
          displayName: p.displayName,
          sharing,
          parentConsentStatus: consent.parentConsentStatus,
        };
        if (sharing === "none") return base;

        const [metric] = await db
          .select()
          .from(athleteDailyMetricsTable)
          .where(eq(athleteDailyMetricsTable.clerkId, p.clerkId))
          .orderBy(desc(athleteDailyMetricsTable.metricDate))
          .limit(1);

        // Wellbeing/safety signals only — no power/training-performance data.
        const wellbeing = metric
          ? {
              metricDate: metric.metricDate,
              sleepHours: metric.sleepHours,
              sleepQuality: metric.sleepQuality,
              fatigueScore: metric.fatigueScore,
              feelScore: metric.feelScore,
            }
          : null;

        const result: Record<string, unknown> = {
          ...base,
          healthStatus: p.healthStatus,
          wellbeing,
        };

        if (sharing === "summary") {
          const schedule = await db
            .select({
              scheduledDate: plannedWorkoutsTable.scheduledDate,
              title: plannedWorkoutsTable.title,
              type: plannedWorkoutsTable.type,
            })
            .from(plannedWorkoutsTable)
            .where(
              and(
                eq(plannedWorkoutsTable.clerkId, p.clerkId),
                gte(plannedWorkoutsTable.scheduledDate, todayISO()),
              ),
            )
            .orderBy(plannedWorkoutsTable.scheduledDate)
            .limit(5);
          result.schedule = schedule;
        }
        return result;
      }),
    );
    res.json({ athletes });
  } catch (err) {
    req.log.error({ err }, "parent.athletes failed");
    res.status(500).json({ error: "Kon gekoppelde atleten niet laden" });
  }
});

export default router;
