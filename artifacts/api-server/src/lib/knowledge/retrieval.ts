import { desc, eq } from "drizzle-orm";
import {
  db,
  knowledgeItemsTable,
  type KnowledgeItem,
  type KnowledgeDiscipline,
} from "@workspace/db";

export type KnowledgeSource = {
  id: number;
  title: string;
  url: string;
  source: string | null;
  authors: string[];
  publishedAt: string | null;
  summary: string | null;
  disciplines: string[];
};

// Lightweight relevance ranking (no vector DB in v1): score each library item by
// discipline overlap + keyword overlap with the athlete context + recency. This
// runs against the GLOBAL library and returns the top-N real items so the AI can
// cite them. Pure scoring over real stored rows — nothing fabricated.
export async function getRelevantKnowledge(opts: {
  keywords: string[];
  disciplines?: KnowledgeDiscipline[];
  limit?: number;
}): Promise<KnowledgeSource[]> {
  const limit = opts.limit ?? 4;
  // Pull a recent candidate pool; rank in memory. Library is small enough that
  // a few hundred recent rows is plenty for v1.
  const pool: KnowledgeItem[] = await db
    .select()
    .from(knowledgeItemsTable)
    .orderBy(desc(knowledgeItemsTable.publishedAt))
    .limit(300);

  if (!pool.length) return [];

  const kw = opts.keywords
    .map((k) => k.toLowerCase().trim())
    .filter((k) => k.length >= 4);
  const wantDisc = new Set((opts.disciplines ?? []).map((d) => d));
  const now = Date.now();

  const scored = pool.map((item) => {
    let score = 0;
    // Discipline overlap.
    for (const d of item.disciplines) {
      if (wantDisc.has(d as KnowledgeDiscipline)) score += 3;
    }
    // Keyword overlap against title + summary + abstract.
    const hay = `${item.title} ${item.summary ?? ""} ${item.abstract ?? ""}`.toLowerCase();
    for (const k of kw) {
      if (hay.includes(k)) score += 2;
    }
    // Recency: up to +3 for items within ~2 years.
    if (item.publishedAt) {
      const age = now - new Date(item.publishedAt).getTime();
      const years = age / (365 * 24 * 3600 * 1000);
      if (years <= 2) score += 3;
      else if (years <= 5) score += 1;
    }
    // Prefer items that actually have an AI summary to cite.
    if (item.summary) score += 1;
    return { item, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => ({
      id: item.id,
      title: item.title,
      url: item.url,
      source: item.source,
      authors: item.authors,
      publishedAt: item.publishedAt,
      summary: item.summary,
      disciplines: item.disciplines,
    }));
}

// ── Personalised Feed news ───────────────────────────────────────────────────
// A news card surfaced on the Feed. Every field comes from a REAL stored news
// row (type='news'); nothing is fabricated. `summary` is the Sparki Dutch
// summary written by the daily scan from the article's real excerpt.
export type FeedNewsItem = {
  id: number;
  title: string;
  url: string;
  source: string | null;
  authors: string[];
  doi: string | null;
  summary: string | null;
  abstract: string | null;
  publishedAt: string | null;
  disciplines: string[];
};

// Personalised sports-news ranking for the Feed. Pure scoring over real stored
// news rows: athlete keyword/discipline overlap + recency. ALWAYS falls back to
// most-recent news (the DB order) so the feed is never empty when news exists —
// personalisation only re-orders the same real items, it never invents any.
export async function getPersonalizedNews(opts: {
  keywords: string[];
  disciplines?: KnowledgeDiscipline[];
  limit?: number;
}): Promise<FeedNewsItem[]> {
  const limit = opts.limit ?? 24;
  const pool: KnowledgeItem[] = await db
    .select()
    .from(knowledgeItemsTable)
    .where(eq(knowledgeItemsTable.type, "news"))
    .orderBy(
      desc(knowledgeItemsTable.publishedAt),
      desc(knowledgeItemsTable.fetchedAt),
    )
    .limit(200);

  if (!pool.length) return [];

  const kw = opts.keywords
    .map((k) => k.toLowerCase().trim())
    .filter((k) => k.length >= 3);
  const wantDisc = new Set((opts.disciplines ?? []).map((d) => d));
  const now = Date.now();

  const scored = pool.map((item, idx) => {
    let score = 0;
    for (const d of item.disciplines) {
      if (wantDisc.has(d as KnowledgeDiscipline)) score += 3;
    }
    const hay =
      `${item.title} ${item.summary ?? ""} ${item.abstract ?? ""}`.toLowerCase();
    for (const k of kw) {
      if (hay.includes(k)) score += 2;
    }
    if (item.publishedAt) {
      const days = (now - new Date(item.publishedAt).getTime()) / 86_400_000;
      if (days <= 7) score += 4;
      else if (days <= 30) score += 2;
      else if (days <= 90) score += 1;
    }
    if (item.summary) score += 1;
    // idx preserves the DB recency order as a stable tiebreak.
    return { item, score, idx };
  });

  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);

  return scored.slice(0, limit).map(({ item }) => ({
    id: item.id,
    title: item.title,
    url: item.url,
    source: item.source,
    authors: item.authors,
    doi: item.doi,
    summary: item.summary,
    abstract: item.abstract,
    publishedAt: item.publishedAt,
    disciplines: item.disciplines,
  }));
}

// Render sources as a compact, citation-ready block for the LLM prompt. Each
// entry includes the real title + URL so the model can cite name + link.
export function formatKnowledgeForPrompt(sources: KnowledgeSource[]): string {
  if (!sources.length) return "";
  const lines = sources.map((s, i) => {
    const who = s.authors.length
      ? `${s.authors.slice(0, 3).join(", ")}${s.authors.length > 3 ? " et al." : ""}`
      : (s.source ?? "onbekende bron");
    const when = s.publishedAt ? ` (${s.publishedAt.slice(0, 4)})` : "";
    const desc = s.summary ?? "";
    return `[${i + 1}] "${s.title}" — ${who}${when}. ${desc}\n    Link: ${s.url}`;
  });
  return lines.join("\n");
}
