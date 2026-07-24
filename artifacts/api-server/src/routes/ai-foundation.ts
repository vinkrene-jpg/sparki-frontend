// Sparki Foundation — routes.
//
// Thin layer over engines/ai-foundation: flag-gated (ai_foundation, default
// off), auth required. GET /status shows what the foundation honestly knows;
// POST /analyse runs the full orchestrated analysis; POST /model/extensions
// lets a user add a model dimension explicitly.

import { Router } from "express";
import { db, userProfilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { resolveFlags } from "../lib/flags";
import {
  createFoundationContainer,
  runFoundationAnalyse,
  FOUNDATION_CONFIG,
} from "../engines/ai-foundation";

const router = Router();
const container = createFoundationContainer();

// Central gate: the whole foundation surface sits behind the ai_foundation
// flag — nothing is on by default.
async function requireFoundationFlag(
  req: Parameters<typeof requireAuth>[0],
  res: Parameters<typeof requireAuth>[1],
  next: Parameters<typeof requireAuth>[2],
) {
  const clerkId = getClerkUserId(req);
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const [profile] = await db
      .select({ activeRole: userProfilesTable.activeRole })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkId));
    const activeRole = String(profile?.activeRole ?? "athlete");
    const flags = await resolveFlags(clerkId, activeRole);
    if (!flags.ai_foundation) {
      res.status(403).json({ error: "Foundation niet beschikbaar" });
      return;
    }
    next();
  } catch (err) {
    req.log.error({ err }, "ai-foundation.flag-gate failed");
    res.status(500).json({ error: "Internal server error" });
  }
}

router.use(requireAuth, requireFoundationFlag);

// GET /api/foundation/status — engine versions + honest data availability.
router.get("/status", async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const snapshot = await container.data.collect(clerkId);
    res.json({
      engines: Object.entries(FOUNDATION_CONFIG).map(([engine, cfg]) => ({
        engine,
        versie: cfg.versie,
      })),
      beschikbaar: {
        sessies: snapshot.sessies.length,
        dagmetingen: snapshot.dagmetingen.length,
        wedstrijden: snapshot.wedstrijden.length,
        geplandeTrainingen: snapshot.geplandeTrainingen.length,
        ftp: snapshot.profiel.ftp != null,
      },
      ontbrekend: snapshot.ontbrekend,
    });
  } catch (err) {
    req.log.error({ err }, "ai-foundation.status failed");
    res.status(500).json({ error: "Status kon niet worden bepaald" });
  }
});

// POST /api/foundation/analyse — full orchestrated run.
router.post("/analyse", async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const result = await runFoundationAnalyse(container, clerkId);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "ai-foundation.analyse failed");
    res.status(500).json({ error: "Analyse kon niet worden uitgevoerd" });
  }
});

// POST /api/foundation/model/extensions — explicit model dimension.
router.post("/model/extensions", async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const key = String(req.body?.key ?? "").trim();
  const value = req.body?.value;
  if (!key || key.length > 120) {
    res.status(400).json({ error: "Ongeldige sleutel" });
    return;
  }
  if (value === undefined) {
    res.status(400).json({ error: "Waarde ontbreekt" });
    return;
  }
  try {
    await container.athleteModel.setExtension(clerkId, key, value, "gebruiker");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "ai-foundation.setExtension failed");
    res.status(500).json({ error: "Opslaan mislukt" });
  }
});

export default router;
