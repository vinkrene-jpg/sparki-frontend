import { Router } from "express";
import {
  db,
  userProfilesTable,
  intelCardKinds,
  intelTopics,
  mythAnswers,
  type IntelCardKind,
  type IntelTopic,
  type MythAnswer,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { resolveFlags } from "../lib/flags";
import {
  getFeed,
  getCard,
  setFlag,
  recordMythAnswer,
  type FeedFilter,
} from "../engines/intel";

const router = Router();

// The Performance Intelligence Hub shares the knowledge_base flag with the
// research library — both live under the Kennis surface. Centralised gate.
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
    req.log.error({ err }, "intel.flag-gate failed");
    res.status(500).json({ error: "Internal server error" });
  }
}

function parseKind(raw: unknown): IntelCardKind | undefined {
  const s = String(raw ?? "").trim();
  return intelCardKinds.includes(s as IntelCardKind)
    ? (s as IntelCardKind)
    : undefined;
}

function parseTopic(raw: unknown): IntelTopic | undefined {
  const s = String(raw ?? "").trim();
  return intelTopics.includes(s as IntelTopic)
    ? (s as IntelTopic)
    : undefined;
}

// GET /api/intel/meta — taxonomy for filter UI (kinds + topics).
router.get("/meta", requireAuth, requireKnowledgeFlag, (_req, res) => {
  res.json({ kinds: intelCardKinds, topics: intelTopics });
});

// GET /api/intel?kind=&topic=&q=&scope=  — the personalised "Voor jou" feed.
router.get("/", requireAuth, requireKnowledgeFlag, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const filter: FeedFilter = {
    kind: parseKind(req.query.kind),
    topic: parseTopic(req.query.topic),
    q: typeof req.query.q === "string" ? req.query.q.trim() : undefined,
    scope: req.query.scope === "saved" ? "saved" : "all",
  };
  try {
    const items = await getFeed(clerkId, filter);
    res.json({ items });
  } catch (err) {
    req.log.error({ err }, "intel.feed failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/intel/:id — a single card with the athlete's interaction state.
router.get("/:id", requireAuth, requireKnowledgeFlag, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const item = await getCard(clerkId, id);
    if (!item) {
      res.status(404).json({ error: "Card not found" });
      return;
    }
    res.json({ item });
  } catch (err) {
    req.log.error({ err }, "intel.card failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/intel/:id/answer  { answer } — record a Myth Buster answer and
// reveal whether it was correct (judged against the card's real verdict).
router.post(
  "/:id/answer",
  requireAuth,
  requireKnowledgeFlag,
  async (req, res) => {
    const clerkId = getClerkUserId(req)!;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const answer = String((req.body ?? {}).answer ?? "").trim();
    if (!mythAnswers.includes(answer as MythAnswer)) {
      res.status(400).json({ error: "Invalid answer" });
      return;
    }
    try {
      const result = await recordMythAnswer(
        clerkId,
        id,
        answer as MythAnswer,
      );
      if (!result) {
        res.status(404).json({ error: "Myth card not found" });
        return;
      }
      res.json(result);
    } catch (err) {
      req.log.error({ err }, "intel.answer failed");
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// POST /api/intel/:id/flag  { field, value } — toggle save / read-later /
// interesting for the athlete on this card.
router.post("/:id/flag", requireAuth, requireKnowledgeFlag, async (req, res) => {
  const clerkId = getClerkUserId(req)!;
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const body = (req.body ?? {}) as { field?: unknown; value?: unknown };
  const field = String(body.field ?? "");
  if (!["saved", "readLater", "interesting"].includes(field)) {
    res.status(400).json({ error: "Invalid field" });
    return;
  }
  if (typeof body.value !== "boolean") {
    res.status(400).json({ error: "Invalid value" });
    return;
  }
  try {
    const state = await setFlag(
      clerkId,
      id,
      field as "saved" | "readLater" | "interesting",
      body.value,
    );
    if (!state) {
      res.status(404).json({ error: "Card not found" });
      return;
    }
    res.json({ interaction: state });
  } catch (err) {
    req.log.error({ err }, "intel.flag failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
