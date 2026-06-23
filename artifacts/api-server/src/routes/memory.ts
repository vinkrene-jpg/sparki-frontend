import { Router } from "express";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  captureContext,
  listContextMemories,
  getDueFollowUps,
  answerFollowUp,
  dismissFollowUp,
  setContextEnabled,
  deleteContextMemory,
} from "../engines/context-memory";

const router = Router();

function parseId(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// POST /api/memory/context — tell Sparki something. Deterministically detects a
// context moment and (privacy permitting) stores it with a scheduled follow-up.
router.post("/context", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const statement = String(req.body?.statement ?? "").trim();
  if (!statement) {
    res.status(400).json({ error: "Bericht is leeg" });
    return;
  }
  try {
    const result = await captureContext(clerkId, statement);
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "memory.capture failed");
    res.status(500).json({ error: "Kon je bericht niet verwerken" });
  }
});

// GET /api/memory/context — the athlete's own memory overview.
router.get("/context", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const memories = await listContextMemories(clerkId);
    res.json({ memories });
  } catch (err) {
    req.log.error({ err }, "memory.list failed");
    res.status(500).json({ error: "Kon geheugen niet laden" });
  }
});

// GET /api/memory/follow-ups/due — follow-ups to ask about now (login check).
router.get("/follow-ups/due", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const due = await getDueFollowUps(clerkId);
    res.json({ due });
  } catch (err) {
    req.log.error({ err }, "memory.due failed");
    res.status(500).json({ error: "Kon vervolgvragen niet laden" });
  }
});

// POST /api/memory/follow-ups/:id/answer — record the athlete's answer.
router.post("/follow-ups/:id/answer", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseId(req.params.id);
  if (id == null) {
    res.status(400).json({ error: "Ongeldig id" });
    return;
  }
  const response = String(req.body?.response ?? "").trim();
  if (!response) {
    res.status(400).json({ error: "Antwoord is leeg" });
    return;
  }
  try {
    const memory = await answerFollowUp(clerkId, id, response);
    if (!memory) {
      res.status(404).json({ error: "Niet gevonden" });
      return;
    }
    res.json({ memory });
  } catch (err) {
    req.log.error({ err }, "memory.answer failed");
    res.status(500).json({ error: "Kon antwoord niet opslaan" });
  }
});

// POST /api/memory/follow-ups/:id/dismiss — skip without answering.
router.post("/follow-ups/:id/dismiss", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseId(req.params.id);
  if (id == null) {
    res.status(400).json({ error: "Ongeldig id" });
    return;
  }
  try {
    const memory = await dismissFollowUp(clerkId, id);
    if (!memory) {
      res.status(404).json({ error: "Niet gevonden" });
      return;
    }
    res.json({ memory });
  } catch (err) {
    req.log.error({ err }, "memory.dismiss failed");
    res.status(500).json({ error: "Kon vervolgvraag niet overslaan" });
  }
});

// PATCH /api/memory/context/:id — enable/disable (athlete control).
router.patch("/context/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseId(req.params.id);
  if (id == null) {
    res.status(400).json({ error: "Ongeldig id" });
    return;
  }
  if (typeof req.body?.enabled !== "boolean") {
    res.status(400).json({ error: "enabled moet true of false zijn" });
    return;
  }
  try {
    const memory = await setContextEnabled(clerkId, id, req.body.enabled);
    if (!memory) {
      res.status(404).json({ error: "Niet gevonden" });
      return;
    }
    res.json({ memory });
  } catch (err) {
    req.log.error({ err }, "memory.toggle failed");
    res.status(500).json({ error: "Kon instelling niet opslaan" });
  }
});

// DELETE /api/memory/context/:id — permanently remove a memory.
router.delete("/context/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseId(req.params.id);
  if (id == null) {
    res.status(400).json({ error: "Ongeldig id" });
    return;
  }
  try {
    const removed = await deleteContextMemory(clerkId, id);
    if (!removed) {
      res.status(404).json({ error: "Niet gevonden" });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "memory.delete failed");
    res.status(500).json({ error: "Kon geheugen niet verwijderen" });
  }
});

export default router;
