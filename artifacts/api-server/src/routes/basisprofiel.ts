// WEDSTRIJDDOEL_BASIS Laag 0 — leesendpoint voor het basisprofiel wielrennen.
//
// GET /api/wedstrijddoel/basisprofiel
// Zuivere leeslaag over bestaande opslag (FTP/eFTP + power_bests); zie
// src/lib/basisprofiel.ts voor de regels. Geen schrijfacties.

import { Router } from "express";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { computeBasisprofiel } from "../lib/basisprofiel";

const router = Router();

router.get("/basisprofiel", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const profiel = await computeBasisprofiel(clerkId);
    if (!profiel) {
      res.status(404).json({ error: "Profiel niet gevonden" });
      return;
    }
    res.json(profiel);
  } catch (err) {
    req.log?.error({ err }, "basisprofiel: berekening faalde");
    res.status(500).json({ error: "Basisprofiel kon niet worden berekend" });
  }
});

export default router;
