import { Router } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  athleteProfilesTable,
  feedPrefsTable,
  type SavedFeedItemRow,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { getPersonalizedNews } from "../engines/knowledge";
import { maybeRefreshNews } from "../lib/knowledge/refresh";
import { sessionSeed, windowedReorder } from "../lib/variation";

const router = Router();

// Tokens that carry no interest signal — stripped before keyword matching.
const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "have",
  "want",
  "improve",
  "increase",
  "better",
  "more",
  "myself",
  "naar",
  "voor",
  "meer",
  "beter",
  "mijn",
  "een",
  "het",
  "van",
  "met",
]);

// Build a real interest keyword set from the athlete's own profile (discipline +
// goals). These are the words used to personalise the news ranking — derived
// entirely from data the athlete entered, never invented.
function buildInterestKeywords(
  discipline: string | null,
  goals: string | null,
): string[] {
  const out = new Set<string>();
  const harvest = (s: string | null | undefined) => {
    if (!s) return;
    for (const w of s.toLowerCase().split(/[^a-z0-9]+/)) {
      if (w.length >= 3 && !STOPWORDS.has(w)) out.add(w);
    }
  };
  harvest(discipline);
  harvest(goals);

  // Expand the athlete's stated discipline into the real vocabulary that sports
  // news actually uses, so a "road" rider gets road-race news, etc.
  const d = (discipline ?? "").toLowerCase();
  if (/road|weg|wieler|cycl|crit/.test(d)) {
    ["cycling", "wielrennen", "peloton", "klassieker", "etappe", "ronde"].forEach(
      (k) => out.add(k),
    );
  }
  if (/mtb|mountain|gravel|cross|veld/.test(d)) {
    ["mountainbike", "gravel", "veldrijden", "cyclocross"].forEach((k) =>
      out.add(k),
    );
  }
  if (/run|loop|marathon|atlet/.test(d)) {
    ["running", "hardlopen", "marathon", "atletiek"].forEach((k) => out.add(k));
  }
  if (/tri|duath/.test(d)) {
    ["triathlon", "duathlon", "ironman"].forEach((k) => out.add(k));
  }

  return [...out];
}

// ─────────────────────────────────────────────
// GET /api/feed/news?limit=
// Personalised stream of REAL sports news for the Feed, ranked by the athlete's
// own discipline/goals + recency. Auth-only (news is public content); returns
// most-recent news when there is no personal signal so the feed is never empty.
// ─────────────────────────────────────────────
router.get("/news", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req);
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.trunc(limitRaw), 1), 50)
    : 24;

  // Keep the news stream fresh without depending on a Scheduled Deployment:
  // if the newest news is stale, this kicks off a background refresh (at most
  // once/hour, non-blocking). This request still serves the current items; the
  // refresh lands for the next visit.
  maybeRefreshNews();

  try {
    const [profile] = await db
      .select({
        discipline: athleteProfilesTable.discipline,
        goals: athleteProfilesTable.goals,
      })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId));

    const keywords = buildInterestKeywords(
      profile?.discipline ?? null,
      profile?.goals ?? null,
    );

    const items = await getPersonalizedNews({
      keywords,
      disciplines: ["sportnieuws", "materiaal"],
      limit,
    });

    // Keep the most-relevant items near the top, but vary the order within small
    // windows by the per-app-open session seed so the feed feels fresh each
    // visit. Pure reordering of real items — relevance ranking is preserved.
    res.json({
      items: windowedReorder(items, sessionSeed(req)),
      personalized: keywords.length > 0,
    });
  } catch (err) {
    req.log.error({ err }, "feed.news failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// Account-brede feedvoorkeuren (bewaard + "minder hiervan").
// GET  /api/feed/prefs — huidige voorkeuren; { prefs: null } zolang er nog
//      geen rij is (eerlijk: geen voorkeuren, niets verzonnen).
// PUT  /api/feed/prefs — volledige vervanging (de client stuurt de gemergde
//      set; localStorage blijft de per-apparaat fallback/migratiebron).
// ─────────────────────────────────────────────

const MAX_BEWAARD = 200;
const MAX_LIJST = 100;
const MAX_STR = 500;

function cleanStr(v: unknown, max = MAX_STR): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().slice(0, max);
  return s.length > 0 ? s : null;
}

function sanitizeBewaard(v: unknown): SavedFeedItemRow[] {
  if (!Array.isArray(v)) return [];
  const out: SavedFeedItemRow[] = [];
  const seen = new Set<string>();
  for (const raw of v) {
    if (out.length >= MAX_BEWAARD) break;
    if (typeof raw !== "object" || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const key = cleanStr(r.key, 200);
    const titel = cleanStr(r.titel);
    const categorie = cleanStr(r.categorie, 50);
    if (!key || !titel || !categorie || seen.has(key)) continue;
    seen.add(key);
    const item: SavedFeedItemRow = {
      key,
      titel,
      categorie,
      bewaardOp: cleanStr(r.bewaardOp, 40) ?? new Date().toISOString(),
    };
    const url = cleanStr(r.url, 1000);
    if (url) item.url = url;
    const bron = cleanStr(r.bron, 200);
    if (bron) item.bron = bron;
    out.push(item);
  }
  return out;
}

function sanitizeLijst(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const raw of v) {
    if (out.length >= MAX_LIJST) break;
    const s = cleanStr(raw, 200);
    if (s && !out.includes(s)) out.push(s);
  }
  return out;
}

router.get("/prefs", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req);
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const [row] = await db
      .select()
      .from(feedPrefsTable)
      .where(eq(feedPrefsTable.clerkId, clerkId))
      .limit(1);
    res.json({
      prefs: row
        ? {
            bewaard: row.bewaard,
            minderCategorie: row.minderCategorie,
            minderBron: row.minderBron,
            updatedAt: row.updatedAt.toISOString(),
          }
        : null,
    });
  } catch (err) {
    req.log.error({ err }, "feed.prefs.get failed");
    res.status(500).json({ error: "Kon feedvoorkeuren niet laden" });
  }
});

router.put("/prefs", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req);
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const bewaard = sanitizeBewaard(body.bewaard);
  const minderCategorie = sanitizeLijst(body.minderCategorie);
  const minderBron = sanitizeLijst(body.minderBron);
  try {
    const [row] = await db
      .insert(feedPrefsTable)
      .values({ clerkId, bewaard, minderCategorie, minderBron })
      .onConflictDoUpdate({
        target: feedPrefsTable.clerkId,
        set: { bewaard, minderCategorie, minderBron, updatedAt: new Date() },
      })
      .returning();
    res.json({
      prefs: {
        bewaard: row.bewaard,
        minderCategorie: row.minderCategorie,
        minderBron: row.minderBron,
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    req.log.error({ err }, "feed.prefs.put failed");
    res.status(500).json({ error: "Kon feedvoorkeuren niet opslaan" });
  }
});

export default router;
