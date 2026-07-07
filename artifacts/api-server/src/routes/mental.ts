// Mentale Weerbaarheid routes — read-only overview for the Lab card.

import { Router, type Request, type Response } from "express";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { getMentalOverview } from "../engines/mental";

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

export default router;
