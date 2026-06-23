import { runKnowledgeScan, knowledgeCount } from "../lib/knowledge/scan";
import { logger } from "../lib/logger";

// CLI entry for the daily Sparki Knowledge Base scan. Intended to be run by a
// Replit Scheduled Deployment (the user configures the schedule in the
// Publishing UI). Safe to run repeatedly — it is idempotent via dedupeKey.
function intEnv(name: string): number | undefined {
  const v = process.env[name];
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function main() {
  const start = Date.now();
  // Optional tuning knobs (Scheduled Deployment can set these). maxNew caps how
  // many genuinely-new items are AI-summarised in a single run; concurrency
  // controls parallel Claude calls (raise cautiously — anthropic rate limits).
  const maxNew = intEnv("KNOWLEDGE_MAX_NEW");
  const concurrency = intEnv("KNOWLEDGE_CONCURRENCY");
  // News-only mode skips the (slow) scientific providers and fetches just the
  // RSS news feeds — used to quickly populate / refresh the Feed news stream.
  const newsOnly = process.env.KNOWLEDGE_NEWS_ONLY === "true";
  const perNewsFeed = intEnv("KNOWLEDGE_PER_NEWS");
  logger.info(
    { maxNew, concurrency, newsOnly, perNewsFeed },
    "knowledge-scan: starting",
  );
  const before = await knowledgeCount();
  const result = await runKnowledgeScan({
    maxNew,
    concurrency,
    perNewsFeed,
    ...(newsOnly ? { researchProviders: [] } : {}),
  });
  const after = await knowledgeCount();
  const summary = {
    ...result,
    libraryBefore: before,
    libraryAfter: after,
    durationMs: Date.now() - start,
  };
  logger.info(summary, "knowledge-scan: done");
  if (result.fetchErrors.length) {
    logger.warn({ fetchErrors: result.fetchErrors }, "knowledge-scan: fetch errors");
  }
  if (result.summariseErrors.length) {
    logger.warn(
      { summariseErrors: result.summariseErrors },
      "knowledge-scan: summarise errors",
    );
  }
  // Synchronous stdout summary so the outcome is always visible — the pretty
  // pino transport (dev) runs in a worker thread whose buffer is lost on
  // process.exit, and this is the line a Scheduled Deployment surfaces.
  console.log("knowledge-scan summary:", JSON.stringify(summary));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "knowledge-scan: fatal");
    console.error("knowledge-scan FATAL:", err);
    process.exit(1);
  });
