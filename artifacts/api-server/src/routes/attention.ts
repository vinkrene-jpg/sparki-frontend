import { Router, type IRouter } from "express";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  amsterdamToday,
  getSuppressedKeys,
  isValidAttentionKey,
  recordImpression,
} from "../lib/attention-rotation";

// Aandacht-rotatie — zie ../lib/attention-rotation.ts voor de regels. Deze
// routes sturen uitsluitend de presentatie van niet-kritieke meerijdende
// berichten; ze wijzigen nooit de onderliggende meldingen of situaties.

const router: IRouter = Router();

const MAX_KEYS_PER_CALL = 12;

// GET /api/attention — welke sleutels vandaag in pauze staan.
router.get("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  try {
    const today = amsterdamToday();
    const suppressed = await getSuppressedKeys(clerkId, today);
    res.json({ today, suppressed });
  } catch (err) {
    req.log.error({ err }, "attention.state failed");
    res.status(500).json({ error: "Kon aandachtstatus niet ophalen" });
  }
});

// POST /api/attention/seen { keys: string[] } — registreer dat deze items
// vandaag echt getoond zijn. Idempotent per Amsterdamse kalenderdag.
router.post("/seen", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const raw = (req.body as { keys?: unknown } | undefined)?.keys;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_KEYS_PER_CALL) {
    res.status(400).json({ error: "Ongeldige lijst met sleutels" });
    return;
  }
  const keys: string[] = [];
  for (const k of raw) {
    if (!isValidAttentionKey(k)) {
      res.status(400).json({ error: "Ongeldige sleutel" });
      return;
    }
    if (!keys.includes(k)) keys.push(k);
  }
  try {
    const today = amsterdamToday();
    for (const key of keys) {
      await recordImpression(clerkId, key, today);
    }
    const suppressed = await getSuppressedKeys(clerkId, today);
    res.json({ today, suppressed });
  } catch (err) {
    req.log.error({ err }, "attention.seen failed");
    res.status(500).json({ error: "Kon aandachtstatus niet bijwerken" });
  }
});

export default router;
