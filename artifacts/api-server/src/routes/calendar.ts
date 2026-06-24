// External race/event calendar import. Lets athletes pull events from the public
// calendars that match their sport — Fietssport (toertochten), We-Tri (triatlon)
// and KNWU (openbaar, beperkt) — instead of typing every wedstrijd by hand.
// All data is read live from the source sites; nothing is fabricated.

import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, athleteProfilesTable } from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  CALENDAR_SOURCES,
  resolveEvent,
  searchCalendar,
  sourceInfo,
} from "../lib/calendar";
import { isAllowedUrl } from "../lib/calendar/html";
import type { CalendarSourceId } from "../lib/calendar/types";

const router = Router();
const VALID = new Set<string>(CALENDAR_SOURCES.map((s) => s.id));

function recommendSource(
  sport: string | null,
  discipline: string | null,
): CalendarSourceId {
  const s = `${sport ?? ""} ${discipline ?? ""}`.toLowerCase();
  if (s.includes("tri") || s.includes("duat") || s.includes("aqua"))
    return "wetri";
  if (
    s.includes("weg") ||
    s.includes("veld") ||
    s.includes("baan") ||
    s.includes("wieler") ||
    s.includes("crit")
  )
    return "knwu";
  return "fietssport";
}

// ── GET /api/calendar/sources ────────────────────────────────────────────────
router.get("/sources", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  let recommended: CalendarSourceId = "fietssport";
  try {
    const [athlete] = await db
      .select()
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId));
    recommended = recommendSource(
      athlete?.sport ?? null,
      athlete?.discipline ?? null,
    );
  } catch (err) {
    req.log.error({ err }, "calendar sources profile lookup failed");
  }
  res.json({ sources: CALENDAR_SOURCES, recommended });
});

// ── GET /api/calendar/search ─────────────────────────────────────────────────
router.get("/search", requireAuth, async (req, res) => {
  const source = String(req.query["source"] ?? "") as CalendarSourceId;
  if (!VALID.has(source)) {
    res.status(400).json({ error: "Invalid source" });
    return;
  }

  const q = req.query["q"] ? String(req.query["q"]) : undefined;
  const type = req.query["type"] ? String(req.query["type"]) : undefined;
  const from = req.query["from"] ? String(req.query["from"]) : undefined;
  const to = req.query["to"] ? String(req.query["to"]) : undefined;
  const limitRaw = req.query["limit"]
    ? parseInt(String(req.query["limit"]), 10)
    : undefined;
  const limit = limitRaw != null && !isNaN(limitRaw) ? limitRaw : undefined;

  try {
    const result = await searchCalendar(source, { q, type, from, to, limit });
    res.json(result);
  } catch (err) {
    req.log.error({ err, source }, "calendar search failed");
    res.json({
      source,
      status: "unavailable",
      note: sourceInfo(source).note,
      events: [],
      fetchedAt: new Date().toISOString(),
      error: "Kon de kalender nu niet ophalen. Probeer het later opnieuw.",
    });
  }
});

// ── GET /api/calendar/event ──────────────────────────────────────────────────
// Resolves the exact date (and GPX availability) for a single event whose list
// card didn't carry a precise date (Fietssport). URL is host-allow-listed.
router.get("/event", requireAuth, async (req, res) => {
  const source = String(req.query["source"] ?? "") as CalendarSourceId;
  const url = String(req.query["url"] ?? "");
  if (!VALID.has(source)) {
    res.status(400).json({ error: "Invalid source" });
    return;
  }
  if (!isAllowedUrl(url)) {
    res.status(400).json({ error: "Invalid url" });
    return;
  }

  try {
    const detail = await resolveEvent(source, url);
    res.json(detail);
  } catch (err) {
    req.log.error({ err, source }, "calendar event resolve failed");
    res.status(502).json({ error: "Kon de wedstrijddetails niet ophalen." });
  }
});

export default router;
