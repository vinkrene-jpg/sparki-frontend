import { Router } from "express";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import {
  db,
  knowledgeItemsTable,
  knowledgeDisciplines,
  knowledgeItemTypes,
  userProfilesTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { resolveFlags, isAdmin } from "../lib/flags";
import { managedKnowledgeDomains } from "@workspace/db";
import {
  getActiveKnowledge,
  buildSourceCitations,
  submitKnowledgeFeedback,
} from "../lib/knowledge/governance";
import {
  runKnowledgeScan,
  knowledgeCount,
  explainTopic,
  listTopics,
} from "../engines/knowledge";

const router = Router();

// All knowledge surfaces require the knowledge_base flag to be enabled for the
// user. Centralised here so list + detail share the same gate.
async function requireKnowledgeFlag(
  req: Parameters<typeof requireAuth>[0],
  res: Parameters<typeof requireAuth>[1],
  next: Parameters<typeof requireAuth>[2],
) {
  const clerkId = getClerkUserId(req);
  if (!clerkId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const [profile] = await db
      .select({ activeRole: userProfilesTable.activeRole })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.clerkId, clerkId));
    const activeRole = String(profile?.activeRole ?? "athlete");
    const flags = await resolveFlags(clerkId, activeRole);
    if (!flags.knowledge_base) {
      res.status(403).json({ error: "Knowledge base not enabled" });
      return;
    }
    next();
  } catch (err) {
    req.log.error({ err }, "knowledge.flag-gate failed");
    res.status(500).json({ error: "Internal server error" });
  }
}

function requireAdmin(
  req: Parameters<typeof requireAuth>[0],
  res: Parameters<typeof requireAuth>[1],
  next: Parameters<typeof requireAuth>[2],
) {
  const clerkId = getClerkUserId(req);
  if (!clerkId || !isAdmin(clerkId)) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

// ─────────────────────────────────────────────
// GET /api/knowledge/meta
// Discipline list + library size (for filter UI).
// ─────────────────────────────────────────────
router.get("/meta", requireAuth, requireKnowledgeFlag, async (req, res) => {
  try {
    const total = await knowledgeCount();
    res.json({
      disciplines: knowledgeDisciplines,
      types: knowledgeItemTypes,
      total,
    });
  } catch (err) {
    req.log.error({ err }, "knowledge.meta failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// GET /api/knowledge?q=&discipline=&type=&limit=
// Browse / search the global library. Returns only real stored items.
// ─────────────────────────────────────────────
router.get("/", requireAuth, requireKnowledgeFlag, async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const discipline =
    typeof req.query.discipline === "string" ? req.query.discipline.trim() : "";
  const type = typeof req.query.type === "string" ? req.query.type.trim() : "";
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.trunc(limitRaw), 1), 100)
    : 40;

  const conditions: SQL[] = [];
  if (q) {
    const term = `%${q}%`;
    const search = or(
      ilike(knowledgeItemsTable.title, term),
      ilike(knowledgeItemsTable.summary, term),
      ilike(knowledgeItemsTable.abstract, term),
    );
    if (search) conditions.push(search);
  }
  if (discipline && knowledgeDisciplines.includes(discipline as never)) {
    conditions.push(
      sql`${discipline} = ANY(${knowledgeItemsTable.disciplines})`,
    );
  }
  if (type && knowledgeItemTypes.includes(type as never)) {
    conditions.push(eq(knowledgeItemsTable.type, type));
  }

  try {
    const where = conditions.length ? and(...conditions) : undefined;
    const rows = await db
      .select()
      .from(knowledgeItemsTable)
      .where(where)
      .orderBy(
        desc(knowledgeItemsTable.publishedAt),
        desc(knowledgeItemsTable.fetchedAt),
      )
      .limit(limit);
    res.json({ items: rows });
  } catch (err) {
    req.log.error({ err }, "knowledge.list failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// POST /api/knowledge/scan  (admin only)
// Manual trigger of the scan (the daily run is a Scheduled Deployment).
// Body: { maxNew?: number } — cap new items for a quick test run.
// ─────────────────────────────────────────────
router.post("/scan", requireAuth, requireAdmin, async (req, res) => {
  const body = (req.body ?? {}) as { maxNew?: number };
  const maxNew =
    typeof body.maxNew === "number" && body.maxNew > 0
      ? Math.trunc(body.maxNew)
      : undefined;
  try {
    const result = await runKnowledgeScan({ maxNew });
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "knowledge.scan failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// GET /api/knowledge/explain?topic=zones
// Athlete-facing, plain-Dutch explanation of a core topic (zones/recovery/
// nutrition/mental), paired with real library sources to read further.
// Without ?topic, returns the list of askable core topics.
// ─────────────────────────────────────────────
router.get("/explain", requireAuth, requireKnowledgeFlag, async (req, res) => {
  const topic = String(req.query.topic ?? "").trim();
  if (!topic) {
    res.json({ topics: listTopics() });
    return;
  }
  try {
    const explanation = await explainTopic(topic);
    if (!explanation) {
      res.status(404).json({ error: "Unknown topic", topics: listTopics() });
      return;
    }
    res.json(explanation);
  } catch (err) {
    req.log.error({ err }, "knowledge.explain failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─────────────────────────────────────────────
// GET /api/knowledge/bronnen?domain=&topic=&discipline=
// Publiek (ingelogd): compacte bronvermelding van ACTIEVE beheerde kennis.
// Geen knowledge_base-flag nodig: bronvermelding hoort bij ieder advies.
// ─────────────────────────────────────────────
router.get("/bronnen", requireAuth, async (req, res) => {
  const domain = String(req.query.domain ?? "").trim();
  const topic = String(req.query.topic ?? "").trim();
  const discipline = String(req.query.discipline ?? "").trim();
  try {
    const items = await getActiveKnowledge({
      domain: (managedKnowledgeDomains as readonly string[]).includes(domain)
        ? (domain as (typeof managedKnowledgeDomains)[number])
        : undefined,
      topicLike: topic || null,
      discipline: discipline || null,
      limit: 8,
    });
    res.json({ bronnen: buildSourceCitations(items) });
  } catch (err) {
    req.log.error({ err }, "knowledge.bronnen failed");
    res.status(500).json({ error: "Bronnen konden niet worden geladen" });
  }
});

// ─────────────────────────────────────────────
// POST /api/knowledge/feedback — fout melden op een kennisitem.
// ─────────────────────────────────────────────
router.post("/feedback", requireAuth, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const itemId = Number((req.body ?? {}).itemId);
  const message = String((req.body ?? {}).message ?? "").trim();
  if (!Number.isInteger(itemId) || !message)
    return res.status(400).json({ error: "itemId en message zijn verplicht" });
  try {
    const result = await submitKnowledgeFeedback({ itemId, clerkId, message });
    if (!result.ok) return res.status(404).json({ error: result.error });
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "knowledge.feedback failed");
    return res.status(500).json({ error: "Feedback kon niet worden verstuurd" });
  }
});

export default router;
