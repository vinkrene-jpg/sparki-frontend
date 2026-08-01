// Data Origin routes — de "Uitleg/herkomst"-knop achter elke waarde/analyse.
//
// GET /api/data-origin/explain/session/:id      — herkomst van één sessie
// GET /api/data-origin/explain/observation/:id  — verantwoording van één analyse
// GET /api/data-origin/explain/computation/:type — nieuwste persistente berekening
//
// Alles owner-scoped op clerkId. Wat niet herleidbaar is meldt eerlijk
// "Onvoldoende gegevens beschikbaar." — nooit een verzonnen verantwoording.

import { Router, type IRouter } from "express";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  explainSession,
  explainObservation,
  explainComputation,
  ONVOLDOENDE,
} from "../engines/data-origin";
import {
  bepaalDataState,
  DATA_STATE_DOMEINEN,
  type DataStateDomein,
} from "../engines/data-origin/data-state";

const router: IRouter = Router();

// Vaste lijst toegestane berekeningstypes — identifiers NOOIT uit het verzoek
// naar SQL, en geen open einde dat interne types lekt.
const COMPUTATION_TYPES = new Set([
  "derived_tss",
  "ftp_floor",
  "load_series",
]);

router.get("/explain/session/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Ongeldige sessie" });
    return;
  }
  try {
    const payload = await explainSession(clerkId, id);
    if (!payload) {
      res.status(404).json({ error: "Sessie niet gevonden" });
      return;
    }
    res.json(payload);
  } catch (err) {
    req.log.error({ err }, "data-origin.explainSession failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/explain/observation/:id", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = parseInt(String(req.params["id"]), 10);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Ongeldige analyse" });
    return;
  }
  try {
    const payload = await explainObservation(clerkId, id);
    if (!payload) {
      res.status(404).json({ error: "Analyse niet gevonden" });
      return;
    }
    res.json(payload);
  } catch (err) {
    req.log.error({ err }, "data-origin.explainObservation failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/explain/computation/:type", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const type = String(req.params["type"]);
  if (!COMPUTATION_TYPES.has(type)) {
    res.status(400).json({ error: "Onbekend berekeningstype" });
    return;
  }
  const subjectId = req.query["subjectId"]
    ? String(req.query["subjectId"])
    : undefined;
  try {
    const payload = await explainComputation(clerkId, type, subjectId);
    if (!payload) {
      res.json({
        onderwerp: type,
        gebruikteGegevens: [],
        berekeningen: [],
        ai: { gebruikt: false, toelichting: ONVOLDOENDE },
        betrouwbaarheid: "onbekend",
        ontbrekend: [],
        melding: ONVOLDOENDE,
      });
      return;
    }
    res.json(payload);
  } catch (err) {
    req.log.error({ err }, "data-origin.explainComputation failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /api/data-origin/state/:domein ──────────────────────────────────────
// Zeven-toestandencontract (DATA_TRUST_01 §4): één server-side bepaling van
// geen_data / onvoldoende_data / verouderd / sync_bezig / providerfout / ok.
// Rechtenproblemen (403) en technische fouten (5xx) blijven HTTP-statussen.
router.get("/state/:domein", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const domein = String(req.params["domein"]);
  if (!(DATA_STATE_DOMEINEN as readonly string[]).includes(domein)) {
    res.status(400).json({ error: "Onbekend domein" });
    return;
  }
  try {
    res.json(await bepaalDataState(clerkId, domein as DataStateDomein));
  } catch (err) {
    req.log.error({ err }, "data-origin.dataState failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
