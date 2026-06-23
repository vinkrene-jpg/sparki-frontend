import type { KnowledgeProvider } from "@workspace/db";
import { KNOWLEDGE_TOPICS, NEWS_FEEDS, type KnowledgeTopic } from "./topics";

// ── Common normalised shape ──────────────────────────────────────────────────
// Every fetcher returns this. NOTHING here is invented — each field is read
// straight from the real API/feed response. Missing fields are left null/empty
// rather than guessed.
export type RawItem = {
  provider: KnowledgeProvider;
  type: "research" | "news";
  title: string;
  authors: string[];
  source: string | null;
  url: string;
  doi: string | null;
  publishedAt: string | null; // YYYY-MM-DD
  abstract: string | null;
  sourceQuery: string;
};

const UA =
  "SparkiKnowledgeBot/1.0 (https://sparki.app; cycling performance app)";
const TIMEOUT_MS = 15_000;

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { "User-Agent": UA, ...init?.headers },
    });
  } finally {
    clearTimeout(timer);
  }
}

function toIsoDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    // arXiv/EPMC sometimes give bare years — keep YYYY-01-01 if it's a year.
    const m = value.match(/^(\d{4})$/);
    if (m) return `${m[1]}-01-01`;
    return null;
  }
  return d.toISOString().slice(0, 10);
}

function stripTags(s: string): string {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normDoi(doi: unknown): string | null {
  if (typeof doi !== "string" || !doi.trim()) return null;
  return doi
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
}

// Honest relevance guard for research items. The scientific APIs match queries
// loosely and return clearly off-topic papers (soil salinity, effluent
// treatment, astrophysics) that only share a word with our query. We keep a real
// item ONLY if its title/abstract genuinely mentions a sport-/exercise-/athlete-
// related term. This never fabricates — it only drops irrelevant hits.
//
// Matching is WORD-BOUNDARY based on purpose: naive substring matching produced
// false positives like "transport" → "sport" and "cyclic"/"recycling" → "cycl",
// and generic terms like "aerobic"/"running" appear in chemistry/physics. Each
// pattern below is therefore anchored and sport-specific.
const RELEVANCE_PATTERNS: RegExp[] = [
  /\bsport/i, // sport, sports, sporting (not "transport": \b precedes)
  /\bexercis/i, // exercise, exercising
  /\bathlet/i, // athlete, athletic, athletes, athletics
  /\bcycling\b/i,
  /\bcyclist/i,
  /\bbicycle/i,
  /\bendurance\b/i,
  /\bvo2\s?max/i,
  /\bvo₂/i,
  /\blactate\b/i,
  /\bergometer/i,
  /\btreadmill/i,
  /\bpeloton/i,
  /\bmuscle\b/i,
  /\bmuscular\b/i,
  /\bcardiorespiratory\b/i,
  /\bmarathon/i,
  /\bsprinter/i,
  /\btriathl/i,
  /\browing\b/i,
  /\bswimmer/i,
  /\brunner/i,
  /physical (fitness|activity|performance)/i,
  /athletic performance/i,
  /aerobic (capacity|exercise|fitness|power|performance)/i,
  /training load/i,
];

function isResearchRelevant(item: RawItem): boolean {
  const hay = `${item.title} ${item.abstract ?? ""}`;
  // Require at least one genuine sport/exercise term. Generic words like
  // "fatigue", "recovery", "psychology" or "physiology" alone are not enough,
  // since they appear across unrelated fields (clinical, agricultural, etc.).
  return RELEVANCE_PATTERNS.some((re) => re.test(hay));
}

// ── Europe PMC (covers PubMed + Agricola + preprints) ────────────────────────
// Free REST API, no key. Docs: https://europepmc.org/RestfulWebService
async function fetchEuropePmc(topic: KnowledgeTopic, limit: number): Promise<RawItem[]> {
  const q = encodeURIComponent(`${topic.query} AND (HAS_ABSTRACT:Y)`);
  const url = `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${q}&format=json&pageSize=${limit}&sort=P_PDATE_D desc&resultType=core`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`EuropePMC ${res.status}`);
  const data = (await res.json()) as {
    resultList?: { result?: Array<Record<string, unknown>> };
  };
  const rows = data.resultList?.result ?? [];
  const items: RawItem[] = [];
  for (const r of rows) {
    const title = typeof r.title === "string" ? stripTags(r.title) : "";
    if (!title) continue;
    const doi = normDoi(r.doi);
    const pmid = typeof r.pmid === "string" ? r.pmid : null;
    const pmcid = typeof r.pmcid === "string" ? r.pmcid : null;
    const url = doi
      ? `https://doi.org/${doi}`
      : pmid
        ? `https://europepmc.org/article/MED/${pmid}`
        : pmcid
          ? `https://europepmc.org/article/PMC/${pmcid}`
          : null;
    if (!url) continue;
    const authorString =
      typeof r.authorString === "string" ? r.authorString : "";
    const authors = authorString
      ? authorString
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean)
          .slice(0, 12)
      : [];
    items.push({
      provider: "europepmc",
      type: "research",
      title,
      authors,
      source: typeof r.journalTitle === "string" ? r.journalTitle : null,
      url,
      doi,
      publishedAt:
        toIsoDate(r.firstPublicationDate) ?? toIsoDate(r.pubYear),
      abstract:
        typeof r.abstractText === "string" ? stripTags(r.abstractText) : null,
      sourceQuery: topic.query,
    });
  }
  return items;
}

// ── Crossref ─────────────────────────────────────────────────────────────────
// Free, no key. Docs: https://api.crossref.org
async function fetchCrossref(topic: KnowledgeTopic, limit: number): Promise<RawItem[]> {
  const q = encodeURIComponent(topic.query);
  const url = `https://api.crossref.org/works?query=${q}&rows=${limit}&sort=published&order=desc&select=DOI,title,author,abstract,container-title,published`;
  const res = await fetchWithTimeout(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Crossref ${res.status}`);
  const data = (await res.json()) as {
    message?: { items?: Array<Record<string, unknown>> };
  };
  const rows = data.message?.items ?? [];
  const items: RawItem[] = [];
  for (const r of rows) {
    const titleArr = Array.isArray(r.title) ? (r.title as string[]) : [];
    const title = titleArr[0] ? stripTags(titleArr[0]) : "";
    const doi = normDoi(r.DOI);
    if (!title || !doi) continue;
    const authorsRaw = Array.isArray(r.author)
      ? (r.author as Array<Record<string, unknown>>)
      : [];
    const authors = authorsRaw
      .map((a) => {
        const given = typeof a.given === "string" ? a.given : "";
        const family = typeof a.family === "string" ? a.family : "";
        return `${given} ${family}`.trim();
      })
      .filter(Boolean)
      .slice(0, 12);
    const container = Array.isArray(r["container-title"])
      ? (r["container-title"] as string[])[0]
      : null;
    const published = r.published as
      | { "date-parts"?: number[][] }
      | undefined;
    const parts = published?.["date-parts"]?.[0];
    const publishedAt =
      parts && parts.length
        ? `${parts[0]}-${String(parts[1] ?? 1).padStart(2, "0")}-${String(
            parts[2] ?? 1,
          ).padStart(2, "0")}`
        : null;
    items.push({
      provider: "crossref",
      type: "research",
      title,
      authors,
      source: container ?? null,
      url: `https://doi.org/${doi}`,
      doi,
      publishedAt,
      abstract:
        typeof r.abstract === "string" ? stripTags(r.abstract) : null,
      sourceQuery: topic.query,
    });
  }
  return items;
}

// ── OpenAlex ─────────────────────────────────────────────────────────────────
// Free, no key. Docs: https://docs.openalex.org
async function fetchOpenAlex(topic: KnowledgeTopic, limit: number): Promise<RawItem[]> {
  const q = encodeURIComponent(topic.query);
  const url = `https://api.openalex.org/works?search=${q}&per-page=${limit}&sort=publication_date:desc&filter=has_abstract:true`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`OpenAlex ${res.status}`);
  const data = (await res.json()) as {
    results?: Array<Record<string, unknown>>;
  };
  const rows = data.results ?? [];
  const items: RawItem[] = [];
  for (const r of rows) {
    const title = typeof r.title === "string" ? stripTags(r.title) : "";
    if (!title) continue;
    const doi = normDoi(r.doi);
    const id = typeof r.id === "string" ? r.id : null;
    const url = doi ? `https://doi.org/${doi}` : id;
    if (!url) continue;
    const authorships = Array.isArray(r.authorships)
      ? (r.authorships as Array<Record<string, unknown>>)
      : [];
    const authors = authorships
      .map((a) => {
        const author = a.author as { display_name?: string } | undefined;
        return author?.display_name ?? "";
      })
      .filter(Boolean)
      .slice(0, 12);
    const primary = r.primary_location as
      | { source?: { display_name?: string } }
      | undefined;
    // OpenAlex stores abstracts as an inverted index; reconstruct it.
    const abstract = reconstructOpenAlexAbstract(
      r.abstract_inverted_index as Record<string, number[]> | null | undefined,
    );
    items.push({
      provider: "openalex",
      type: "research",
      title,
      authors,
      source: primary?.source?.display_name ?? null,
      url,
      doi,
      publishedAt: toIsoDate(r.publication_date),
      abstract,
      sourceQuery: topic.query,
    });
  }
  return items;
}

function reconstructOpenAlexAbstract(
  inverted: Record<string, number[]> | null | undefined,
): string | null {
  if (!inverted || typeof inverted !== "object") return null;
  const positions: Array<[number, string]> = [];
  for (const [word, idxs] of Object.entries(inverted)) {
    for (const i of idxs) positions.push([i, word]);
  }
  if (!positions.length) return null;
  positions.sort((a, b) => a[0] - b[0]);
  return stripTags(positions.map((p) => p[1]).join(" ")).slice(0, 4000);
}

// ── arXiv ────────────────────────────────────────────────────────────────────
// Free Atom API. Docs: https://info.arxiv.org/help/api
async function fetchArxiv(topic: KnowledgeTopic, limit: number): Promise<RawItem[]> {
  const q = encodeURIComponent(`all:${topic.query}`);
  const url = `https://export.arxiv.org/api/query?search_query=${q}&start=0&max_results=${limit}&sortBy=submittedDate&sortOrder=descending`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`arXiv ${res.status}`);
  const xml = await res.text();
  const entries = xml.split(/<entry>/).slice(1);
  const items: RawItem[] = [];
  for (const entry of entries) {
    const get = (tag: string): string | null => {
      const m = entry.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return m ? stripTags(m[1]!) : null;
    };
    const title = get("title");
    const idMatch = entry.match(/<id>([\s\S]*?)<\/id>/);
    const url = idMatch ? idMatch[1]!.trim() : null;
    if (!title || !url) continue;
    const authors = [...entry.matchAll(/<name>([\s\S]*?)<\/name>/g)]
      .map((m) => stripTags(m[1]!))
      .filter(Boolean)
      .slice(0, 12);
    const doiMatch = entry.match(/<arxiv:doi[^>]*>([\s\S]*?)<\/arxiv:doi>/);
    items.push({
      provider: "arxiv",
      type: "research",
      title,
      authors,
      source: "arXiv",
      url,
      doi: normDoi(doiMatch?.[1]),
      publishedAt: toIsoDate(get("published")),
      abstract: get("summary"),
      sourceQuery: topic.query,
    });
  }
  return items;
}

// ── RSS news feeds ───────────────────────────────────────────────────────────
function parseRss(rawXml: string): Array<{
  title: string;
  link: string;
  date: string | null;
  desc: string | null;
}> {
  const out: Array<{
    title: string;
    link: string;
    date: string | null;
    desc: string | null;
  }> = [];
  // Unwrap CDATA first: many feeds (e.g. NOS) wrap <title>/<link> in
  // <![CDATA[ ... ]]>, and the tag-stripper would otherwise swallow the link.
  const xml = rawXml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // Support both RSS <item> and Atom <entry>.
  const blocks = xml.includes("<item")
    ? xml.split(/<item[\s>]/).slice(1)
    : xml.split(/<entry[\s>]/).slice(1);
  const isAtom = !xml.includes("<item");
  for (const b of blocks) {
    const titleM = b.match(/<title[^>]*>([\s\S]*?)<\/title>/);
    let link: string | null = null;
    if (isAtom) {
      const lm = b.match(/<link[^>]*href="([^"]+)"/);
      link = lm ? lm[1]! : null;
    } else {
      const lm = b.match(/<link[^>]*>([\s\S]*?)<\/link>/);
      link = lm ? stripTags(lm[1]!) : null;
    }
    const dateM = b.match(
      /<(?:pubDate|published|updated|dc:date)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated|dc:date)>/,
    );
    const descM = b.match(
      /<(?:description|summary|content)[^>]*>([\s\S]*?)<\/(?:description|summary|content)>/,
    );
    const title = titleM ? stripTags(titleM[1]!) : "";
    if (!title || !link) continue;
    out.push({
      title,
      link: link.trim(),
      date: dateM ? dateM[1]!.trim() : null,
      desc: descM ? stripTags(descM[1]!).slice(0, 1200) : null,
    });
  }
  return out;
}

async function fetchNewsFeed(
  feed: (typeof NEWS_FEEDS)[number],
  limit: number,
): Promise<RawItem[]> {
  const res = await fetchWithTimeout(feed.url, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml" },
  });
  if (!res.ok) throw new Error(`RSS ${feed.source} ${res.status}`);
  const xml = await res.text();
  const parsed = parseRss(xml).slice(0, limit);
  return parsed.map((p) => ({
    provider: "rss" as const,
    type: "news" as const,
    title: p.title,
    authors: [],
    source: feed.source,
    url: p.link,
    doi: null,
    publishedAt: toIsoDate(p.date),
    abstract: p.desc,
    sourceQuery: `${feed.source} (${feed.discipline})`,
  }));
}

// ── Orchestration ────────────────────────────────────────────────────────────
export type FetchOptions = {
  perResearchSource?: number; // items per (topic × provider)
  perNewsFeed?: number;
  // Limit which research providers run (default: all). Useful for testing.
  researchProviders?: KnowledgeProvider[];
};

// Fetch everything across all topics and feeds. Each fetch is isolated: a single
// failing source NEVER aborts the run (we log and continue). Returns the raw,
// real items (not yet deduped/summarised).
export async function fetchAllSources(
  opts: FetchOptions = {},
): Promise<{ items: RawItem[]; errors: string[] }> {
  const perResearch = opts.perResearchSource ?? 6;
  const perNews = opts.perNewsFeed ?? 8;
  const providers = opts.researchProviders ?? [
    "europepmc",
    "crossref",
    "openalex",
    "arxiv",
  ];

  const errors: string[] = [];
  const items: RawItem[] = [];

  const researchFetchers: Record<
    string,
    (t: KnowledgeTopic, n: number) => Promise<RawItem[]>
  > = {
    europepmc: fetchEuropePmc,
    crossref: fetchCrossref,
    openalex: fetchOpenAlex,
    arxiv: fetchArxiv,
  };

  // Research: run topic×provider sequentially-ish but politely. We await each to
  // respect rate limits rather than hammering all at once.
  for (const topic of KNOWLEDGE_TOPICS) {
    for (const provider of providers) {
      const fetcher = researchFetchers[provider];
      if (!fetcher) continue;
      try {
        const got = await fetcher(topic, perResearch);
        items.push(...got.filter(isResearchRelevant));
      } catch (err) {
        errors.push(
          `${provider}/${topic.discipline}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
      // Small courtesy delay between calls to the same/different hosts.
      await sleep(250);
    }
  }

  // News feeds.
  for (const feed of NEWS_FEEDS) {
    try {
      const got = await fetchNewsFeed(feed, perNews);
      items.push(...got);
    } catch (err) {
      errors.push(
        `rss/${feed.source}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
    await sleep(250);
  }

  return { items, errors };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Normalised de-dup key: DOI → normalised URL → normalised title.
export function computeDedupeKey(item: RawItem): string {
  if (item.doi) return `doi:${item.doi}`;
  const urlNorm = item.url
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[#?].*$/, "")
    .replace(/\/$/, "");
  if (urlNorm) return `url:${urlNorm}`;
  const titleNorm = item.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return `title:${titleNorm}`;
}
