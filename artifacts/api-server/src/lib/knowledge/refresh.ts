import { sql } from "drizzle-orm";
import { db, knowledgeItemsTable } from "@workspace/db";
import { runKnowledgeScan } from "./scan";
import { logger } from "../logger";

// ─────────────────────────────────────────────────────────────────────────────
// Self-healing news freshness.
//
// The full knowledge scan is meant to run as a Replit Scheduled Deployment, but
// if that schedule is never configured the Feed news silently goes stale (the
// symptom that motivated this: news frozen for weeks). To guarantee freshness
// for real users regardless of the schedule, the Feed endpoint calls
// `maybeRefreshNews()` — fire-and-forget: when the newest news row is older than
// STALE_AFTER_MS it kicks off a news-only scan in the BACKGROUND. It never
// blocks the request and is guarded so at most one runs at a time and no more
// than once per MIN_ATTEMPT_GAP_MS. Idempotent (dedupeKey) — safe to retrigger.
//
// News-only (no scientific providers) keeps a refresh fast (~10-15s) so it
// finishes within a normal request-serving window.
// ─────────────────────────────────────────────────────────────────────────────

const STALE_AFTER_MS = 6 * 60 * 60 * 1000; // refresh when newest news > 6h old
const MIN_ATTEMPT_GAP_MS = 60 * 60 * 1000; // never attempt more than hourly
const PER_NEWS_FEED = 12;
const MAX_NEW = 30;

let lastAttemptAt = 0;
let inFlight: Promise<void> | null = null;

async function newestNewsFetchedMs(): Promise<number | null> {
  const [row] = await db
    .select({
      newest: sql<string | null>`max(${knowledgeItemsTable.fetchedAt})`,
    })
    .from(knowledgeItemsTable)
    .where(sql`${knowledgeItemsTable.type} = 'news'`);
  if (!row?.newest) return null;
  const t = new Date(row.newest).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * Trigger a background news refresh when the Feed's news is stale. Non-blocking
 * (returns immediately); at most one refresh runs at a time and at most once per
 * hour. Never throws — failures are logged and swallowed so the feed request is
 * unaffected.
 */
export function maybeRefreshNews(): void {
  const now = Date.now();
  if (inFlight) return;
  if (now - lastAttemptAt < MIN_ATTEMPT_GAP_MS) return;
  lastAttemptAt = now;
  inFlight = (async () => {
    try {
      const newest = await newestNewsFetchedMs();
      // Fresh enough — nothing to do.
      if (newest !== null && now - newest < STALE_AFTER_MS) return;
      logger.info({ newest }, "news-refresh: starting background refresh");
      const result = await runKnowledgeScan({
        researchProviders: [],
        perNewsFeed: PER_NEWS_FEED,
        maxNew: MAX_NEW,
        concurrency: 3,
      });
      logger.info(
        { newItems: result.newItems, fetched: result.fetched },
        "news-refresh: done",
      );
    } catch (err) {
      logger.warn({ err }, "news-refresh: failed");
    } finally {
      inFlight = null;
    }
  })();
}
