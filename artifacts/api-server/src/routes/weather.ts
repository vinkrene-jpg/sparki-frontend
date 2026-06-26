import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, athleteProfilesTable } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { getHomeWeather } from "../lib/weather/home";

const router = Router();

// GET /api/weather/home — today's real conditions + a short outlook at the
// signed-in athlete's saved home location, for everyday (non-race) coaching.
// Honest: when there is no home location, or today falls outside the forecast
// horizon, it says so plainly (available:false + reason) and never fabricates.
router.get("/home", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const [athlete] = await db
      .select({
        homeLat: athleteProfilesTable.homeLat,
        homeLon: athleteProfilesTable.homeLon,
        homeLabel: athleteProfilesTable.homeLabel,
      })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId));

    const weather = await getHomeWeather(
      athlete?.homeLat,
      athlete?.homeLon,
      athlete?.homeLabel,
    );
    res.json(weather);
  } catch (err) {
    req.log.error({ err }, "weather.home failed");
    res.status(500).json({ error: "Kon het weer niet ophalen" });
  }
});

export default router;
