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

// Stopwords stripped before comparing news titles for near-duplicate stories.
const NEWS_TITLE_STOPWORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "have", "will", "your",
  "een", "het", "van", "met", "voor", "naar", "door", "over", "tot", "zijn",
  "wordt", "worden", "deze", "dat", "als", "maar", "niet", "wel", "meer", "aan",
  "bij", "een", "ook", "nog", "wordt", "gaat", "komt", "haar", "hun",
]);

// Significant lowercase word set of a title (len>=4, no stopwords) — the basis
// for cross-source near-duplicate detection (same race reported by 3 outlets).
function titleWordSet(title: string): Set<string> {
  const out = new Set<string>();
  for (const w of title.toLowerCase().split(/[^a-z0-9]+/)) {
    if (w.length >= 4 && !NEWS_TITLE_STOPWORDS.has(w)) out.add(w);
  }
  return out;
}

// Overlap coefficient (intersection / smaller set) — robust when titles differ
// in length. 1.0 = one title's significant words are a subset of the other.
function overlapCoefficient(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let inter = 0;
  for (const w of small) if (large.has(w)) inter++;
  return inter / small.size;
}

// Recency is the dominant signal for a *daily* news stream: fresh items lead,
// personalisation only breaks ties among comparably-fresh items.
function recencyPoints(publishedAt: string | null, now: number): number {
  if (!publishedAt) return 0;
  const t = new Date(publishedAt).getTime();
  if (!Number.isFinite(t)) return 0;
  const days = Math.max(0, (now - t) / 86_400_000);
  if (days <= 1) return 12;
  if (days <= 3) return 9;
  if (days <= 7) return 6;
  if (days <= 14) return 4;
  if (days <= 30) return 2;
  if (days <= 60) return 1;
  return 0;
}

// Personalised sports-news ranking for the Feed. Pure scoring over real stored
// news rows: recency-dominant, then athlete keyword/discipline overlap. On top
// of scoring it (1) collapses near-duplicate stories across sources, keeping the
// best-scored real row, and (2) interleaves sources so one outlet never floods
// the head. ALWAYS falls back to the most-recent real news so the feed is never
// empty — presentation only re-orders/de-dupes real items, never invents any.
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
      if (wantDisc.has(d as KnowledgeDiscipline)) score += 2;
    }
    const hay =
      `${item.title} ${item.summary ?? ""} ${item.abstract ?? ""}`.toLowerCase();
    let kwHits = 0;
    for (const k of kw) if (hay.includes(k)) kwHits++;
    score += Math.min(kwHits, 3) * 2; // cap keyword weight so recency leads
    const rec = recencyPoints(item.publishedAt, now);
    score += rec;
    if (item.summary) score += 1;
    // idx preserves the DB recency order as a stable tiebreak.
    return { item, score, rec, idx, words: titleWordSet(item.title) };
  });

  scored.sort((a, b) => b.score - a.score || b.rec - a.rec || a.idx - b.idx);

  // Drop stale items (>60 days, recency 0) from the daily stream — but only when
  // enough fresh items remain to fill it, so the feed is never left empty.
  const fresh = scored.filter((s) => s.rec > 0);
  const base = fresh.length >= limit ? fresh : scored;

  // Collapse near-duplicate stories across sources: walking best-first, skip an
  // item whose significant title words substantially overlap one already kept.
  const kept: typeof base = [];
  for (const s of base) {
    const dup = kept.some(
      (k) =>
        k.words.size >= 3 &&
        s.words.size >= 3 &&
        overlapCoefficient(k.words, s.words) >= 0.6,
    );
    if (!dup) kept.push(s);
  }

  // Source diversity: greedy pick the best remaining item from a source other
  // than the previous pick, so no single outlet dominates the top of the feed.
  const remaining = [...kept];
  const ordered: typeof kept = [];
  let lastSource: string | null | undefined;
  while (remaining.length && ordered.length < limit) {
    let pick = remaining.findIndex((r) => r.item.source !== lastSource);
    if (pick === -1) pick = 0; // only same-source items left
    const [chosen] = remaining.splice(pick, 1);
    ordered.push(chosen!);
    lastSource = chosen!.item.source;
  }

  return ordered.slice(0, limit).map(({ item }) => ({
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

// ── Athlete-facing topic explanations ────────────────────────────────────────
// A deterministic, plain-Dutch core-topic library so an athlete can ask "leg
// trainingszones uit" and get a stable, trustworthy answer — never invented per
// request. Each explanation is paired with REAL retrieved sources from the
// library so the athlete can read further. No user-facing "AI" wording.

export type TopicExplanation = {
  topic: TopicKey;
  title: string;
  summary: string;
  keyPoints: string[];
  sources: KnowledgeSource[];
};

export type TopicKey = "zones" | "recovery" | "nutrition" | "mental";

type TopicEntry = {
  title: string;
  summary: string;
  keyPoints: string[];
  // Retrieval hints: keywords + disciplines used to attach real library sources.
  keywords: string[];
  disciplines: KnowledgeDiscipline[];
  // Aliases the athlete might type; matched case-insensitively as substrings.
  aliases: string[];
};

const TOPIC_LIBRARY: Record<TopicKey, TopicEntry> = {
  zones: {
    title: "Trainingszones",
    summary:
      "Trainingszones verdelen je inspanning in niveaus, meestal op basis van je FTP (vermogen) of hartslag. Door bewust in een zone te trainen, stuur je precies de aanpassing die je wilt: lange rustige ritten bouwen je basis, drempelblokken verhogen je duurvermogen en korte felle intervallen scherpen je topvermogen.",
    keyPoints: [
      "Zone 1–2 (rustig): bouwt je aerobe basis en helpt herstellen. Hier breng je de meeste uren door.",
      "Zone 3–4 (tempo/drempel): verhoogt het vermogen dat je lang kunt volhouden.",
      "Zone 5+ (VO2max en hoger): korte, felle blokken die je topvermogen en explosiviteit aanscherpen.",
      "Polariseren werkt: veel rustig, weinig maar gericht hard, en het middengebied bewust doseren.",
    ],
    keywords: ["zone", "ftp", "drempel", "threshold", "vo2", "power", "vermogen", "intensity"],
    disciplines: ["inspanningsfysiologie", "fysiologie", "sportwetenschap"],
    aliases: ["zone", "zones", "trainingszone", "intensiteit", "ftp", "vermogen", "hartslagzone"],
  },
  recovery: {
    title: "Herstel",
    summary:
      "Je wordt niet sterker tijdens de training maar tijdens het herstel erna. Slaap, voeding en rustige dagen laten je lichaam de prikkel verwerken en bovenop je oude niveau terugkomen. Te weinig herstel stapelt vermoeidheid op en verhoogt je blessurerisico; goed herstel maakt je harde trainingen pas effectief.",
    keyPoints: [
      "Slaap is je belangrijkste hersteltool: streef naar voldoende én regelmatige nachten.",
      "Wissel zware en rustige dagen af — twee zware dagen op rij vragen om een echte rustdag.",
      "Let op signalen: een hoge rusthartslag, slechte slaap of weinig zin kunnen op restvermoeidheid wijzen.",
      "Actief herstel (heel rustig fietsen) kan beter werken dan volledige stilstand.",
    ],
    keywords: ["recovery", "herstel", "sleep", "slaap", "rest", "fatigue", "vermoeidheid", "hrv"],
    disciplines: ["fysiologie", "inspanningsfysiologie", "sportwetenschap"],
    aliases: ["herstel", "recovery", "rust", "slaap", "vermoeidheid", "overtraining"],
  },
  nutrition: {
    title: "Voeding",
    summary:
      "Voeding is je brandstof: koolhydraten leveren de energie voor harde inspanning, eiwitten herstellen je spieren en vocht houdt je prestatie op peil. Wat en wanneer je eet, bepaalt of je een training goed doorkomt en er sterker uit terugkomt.",
    keyPoints: [
      "Eet rond langere of intensieve ritten extra koolhydraten — voor, tijdens en erna.",
      "Neem na een zware training eiwitten op om je spieren te laten herstellen.",
      "Drink genoeg; zelfs licht uitdrogen verlaagt je vermogen merkbaar.",
      "Train je darmen: oefen tijdens trainingen met de voeding die je in wedstrijden wilt gebruiken.",
    ],
    keywords: ["nutrition", "voeding", "carbohydrate", "koolhydraat", "protein", "eiwit", "hydration", "fuel"],
    disciplines: ["voedingsleer", "fysiologie", "sportwetenschap"],
    aliases: ["voeding", "nutrition", "eten", "koolhydraten", "eiwit", "drinken", "hydratatie"],
  },
  mental: {
    title: "Mentale training",
    summary:
      "Je kop is net zo trainbaar als je benen. Omgaan met spanning, gefocust blijven en vertrouwen houden na een mindere dag bepaalt vaak hoe je presteert als het er echt toe doet. Mentale vaardigheden oefen je net als een interval: bewust en herhaald.",
    keyPoints: [
      "Werk met doelen die je zelf in de hand hebt (je eigen inzet), niet alleen de uitslag.",
      "Gebruik een vaste routine voor de start om zenuwen om te zetten in focus.",
      "Praat tegen jezelf zoals je tegen een teamgenoot zou praten — streng mag, afbreken niet.",
      "Evalueer rustig na afloop: wat ging goed, wat neem je mee, en laat de rest los.",
    ],
    keywords: ["mental", "mentaal", "psychology", "motivation", "focus", "stress", "confidence", "mindset"],
    disciplines: ["sportpsychologie", "psychologie"],
    aliases: ["mentaal", "mental", "mindset", "motivatie", "focus", "spanning", "zenuwen", "psychologie"],
  },
};

/** Resolve a free-text topic request to a known core topic, or null. */
export function resolveTopicKey(input: string): TopicKey | null {
  const q = input.toLowerCase().trim();
  if (!q) return null;
  for (const key of Object.keys(TOPIC_LIBRARY) as TopicKey[]) {
    if (key === q) return key;
    for (const alias of TOPIC_LIBRARY[key].aliases) {
      if (q.includes(alias)) return key;
    }
  }
  return null;
}

/** The set of core topics the athlete can ask about (for menus/validation). */
export function listTopics(): Array<{ key: TopicKey; title: string }> {
  return (Object.keys(TOPIC_LIBRARY) as TopicKey[]).map((key) => ({
    key,
    title: TOPIC_LIBRARY[key].title,
  }));
}

/**
 * Athlete-facing explanation of a core topic: a stable, deterministic Dutch
 * explanation paired with REAL retrieved library sources to read further.
 * Returns null when the request doesn't map to a known topic.
 */
export async function explainTopic(input: string): Promise<TopicExplanation | null> {
  const key = resolveTopicKey(input);
  if (!key) return null;
  const entry = TOPIC_LIBRARY[key];
  const sources = await getRelevantKnowledge({
    keywords: entry.keywords,
    disciplines: entry.disciplines,
    limit: 3,
  });
  return {
    topic: key,
    title: entry.title,
    summary: entry.summary,
    keyPoints: entry.keyPoints,
    sources,
  };
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
