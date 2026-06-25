import { Router } from "express";
import {
  db,
  testerEventsTable,
  telemetryEventTypes,
  type InsertTesterEvent,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";

const router = Router();

const TYPES = new Set<string>(telemetryEventTypes);
const MAX_BATCH = 50;

function str(v: unknown, max = 64): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

// POST /api/telemetry — any signed-in user/tester reports a batch of real usage
// events (screen views, feature use, heartbeats). The clerkId is taken from the
// authenticated session, never the body. Unknown event types are dropped. This
// is the ONLY writer of tester_events; the Test Management Dashboard derives all
// usage/coverage stats from these rows.
router.post("/", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const rawEvents = Array.isArray(body.events) ? body.events : [];
  if (rawEvents.length === 0) {
    res.status(204).end();
    return;
  }

  const appVersion = str(req.get("x-sparki-app-version"), 32);

  const rows: InsertTesterEvent[] = [];
  for (const raw of rawEvents.slice(0, MAX_BATCH)) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    const type = typeof e.type === "string" ? e.type : "";
    if (!TYPES.has(type)) continue;
    const sessionId = str(e.sessionId);
    if (!sessionId) continue;
    rows.push({
      clerkId,
      sessionId,
      type,
      screen: str(e.screen, 48),
      feature: str(e.feature, 64),
      appVersion,
      platform: str(e.platform, 24),
    });
  }

  if (rows.length === 0) {
    res.status(204).end();
    return;
  }

  try {
    await db.insert(testerEventsTable).values(rows);
    res.status(202).json({ accepted: rows.length });
  } catch (err) {
    req.log.error({ err }, "telemetry.ingest failed");
    res.status(500).json({ error: "Kon telemetrie niet opslaan" });
  }
});

export default router;
