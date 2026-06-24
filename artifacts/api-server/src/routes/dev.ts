import { Router } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, userProfilesTable, athleteProfilesTable } from "@workspace/db";
import { resolvePersonality } from "../engines/observation";
import { PREVIEW_CLERK_IDS } from "../lib/preview-athletes";

// Dev-only routes. This router is mounted ONLY when NODE_ENV !== "production"
// (see routes/index.ts), so in production these endpoints simply do not exist
// (404). Nothing here touches real auth or grants access — it only lists the
// seeded preview athletes so the dev preview switcher knows who it can switch to.
const router = Router();

// GET /api/dev/preview-athletes — the seeded preview athletes that actually
// exist, in their canonical order. Honest: an id that was never seeded is
// omitted (no fabricated entries). Each carries the personality Sparki would
// actually resolve for that profile, so the switcher can label them truthfully.
router.get("/preview-athletes", async (req, res) => {
  try {
    const rows = await db
      .select({
        clerkId: userProfilesTable.clerkId,
        displayName: userProfilesTable.displayName,
        activeRole: userProfilesTable.activeRole,
        birthYear: athleteProfilesTable.birthYear,
        experienceLevel: athleteProfilesTable.experienceLevel,
        competitionLevel: athleteProfilesTable.competitionLevel,
      })
      .from(userProfilesTable)
      .leftJoin(
        athleteProfilesTable,
        eq(athleteProfilesTable.clerkId, userProfilesTable.clerkId),
      )
      .where(inArray(userProfilesTable.clerkId, [...PREVIEW_CLERK_IDS]));

    const byId = new Map(rows.map((r) => [r.clerkId, r]));
    const athletes = PREVIEW_CLERK_IDS.map((id) => byId.get(id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((r) => {
        const personality = resolvePersonality({
          birthYear: r.birthYear,
          experienceLevel: r.experienceLevel,
          competitionLevel: r.competitionLevel,
          activeRole: r.activeRole,
        });
        return {
          clerkId: r.clerkId,
          name: r.displayName,
          personaLabel: personality.label,
          basis: personality.basis,
        };
      });

    res.json({ athletes });
  } catch (err) {
    req.log.error({ err }, "dev.preview-athletes failed");
    res.status(500).json({ error: "Kon preview-atleten niet laden" });
  }
});

export default router;
