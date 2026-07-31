// GET /api/today — de Today Orchestrator-uitkomst voor de ingelogde gebruiker.
// POST /api/today/interactions — klik/afronding registreren (weergavehistorie).
//
// Dun routelaagje: alle logica zit in engines/today (deterministisch, geen AI).

import { Router } from "express";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { orchestrateToday, recordTodayInteraction } from "../engines/today";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req);
  if (!clerkId) {
    res.status(401).json({ error: "Niet ingelogd" });
    return;
  }
  try {
    const result = await orchestrateToday(clerkId);
    res.json(result);
  } catch (err) {
    req.log?.error?.({ err }, "today.orchestrate failed");
    res
      .status(500)
      .json({ error: "Sparki kon je startpagina nu niet samenstellen" });
  }
});

router.post("/interactions", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req);
  if (!clerkId) {
    res.status(401).json({ error: "Niet ingelogd" });
    return;
  }
  const itemKey = typeof req.body?.itemKey === "string" ? req.body.itemKey : "";
  const action = req.body?.action;
  if (!itemKey || (action !== "clicked" && action !== "completed")) {
    res.status(400).json({ error: "itemKey en action (clicked|completed) vereist" });
    return;
  }
  try {
    const found = await recordTodayInteraction(clerkId, itemKey, action);
    if (!found) {
      res.status(404).json({ error: "Onbekende boodschap-sleutel" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log?.error?.({ err }, "today.interaction failed");
    res.status(500).json({ error: "Kon interactie niet opslaan" });
  }
});

export default router;
