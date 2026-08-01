// AIE2 F1/F2 — dossier-inzage: "waarop is dit gebaseerd" is altijd opvraagbaar
// (AIE2-28). Owner-only; interne confidence-factoren gaan NIET mee naar de
// client (AIE2-09/82) — alleen het taalniveau.

import { Router } from "express";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  getDossierByKey,
  dossierStatusFor,
  recordAdviceOutcome,
} from "../lib/advice-dossier";

const router = Router();

function publicDossier(row: NonNullable<Awaited<ReturnType<typeof getDossierByKey>>>) {
  // Bewuste weglating: confidenceFactors (interne scores) en dedupeKey.
  const {
    confidenceFactors: _internal,
    dedupeKey: _dk,
    ...rest
  } = row;
  return rest;
}

router.get("/by-key/:adviceKey", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const adviceKey = String(req.params.adviceKey);
  const row = await getDossierByKey(clerkId, adviceKey);
  const status = dossierStatusFor(row);
  res.json({
    dossier: row ? publicDossier(row) : null,
    status: status.status,
    herleidbaar: status.herleidbaar,
    legacyLabel: status.label,
  });
});

router.post("/:id/outcome", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(String(req.params.id));
  const outcome = typeof req.body?.outcome === "string" ? req.body.outcome : "";
  if (!Number.isInteger(id) || !outcome.trim()) {
    res.status(400).json({ error: "Ongeldige uitkomst" });
    return;
  }
  const ok = await recordAdviceOutcome(clerkId, id, outcome);
  if (!ok) {
    res.status(404).json({ error: "Dossier niet gevonden" });
    return;
  }
  res.json({ ok: true });
});

export default router;
