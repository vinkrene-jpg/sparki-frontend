import { inArray, sql } from "drizzle-orm";
import {
  db,
  knowledgeItemsTable,
  knowledgeDisciplines,
  type KnowledgeDiscipline,
} from "@workspace/db";
import { anthropic } from "@workspace/integrations-anthropic-ai";
import { batchProcess } from "@workspace/integrations-anthropic-ai/batch";
import {
  fetchAllSources,
  computeDedupeKey,
  type RawItem,
  type FetchOptions,
} from "./sources";

const MODEL = "claude-sonnet-4-6";
const VALID_DISCIPLINES = new Set<string>(knowledgeDisciplines);

export type ScanResult = {
  fetched: number;
  unique: number;
  newItems: number;
  summarised: number;
  skippedExisting: number;
  fetchErrors: string[];
  summariseErrors: string[];
};

// AI summary + discipline tagging for ONE real item. The model is given the real
// title/abstract and is instructed (data-honesty) to summarise only what is
// present and never invent findings. Returns null on failure (item then stored
// without a summary rather than blocking the whole run).
async function summariseAndTag(
  item: RawItem,
): Promise<{
  summary: string;
  titleNl: string | null;
  disciplines: KnowledgeDiscipline[];
} | null> {
  const abstract = item.abstract?.slice(0, 6000) ?? "";
  const prompt = `Je bent een sportwetenschappelijke redacteur voor een wielerprestatie-app (Sparki).

Hieronder staat een ECHT artikel (titel + samenvatting/abstract zoals opgehaald uit de bron). 
STRIKTE EERLIJKHEIDSREGEL: vat uitsluitend samen wat er letterlijk staat. Verzin GEEN bevindingen, getallen, auteurs of conclusies. Als de abstract leeg of onduidelijk is, baseer je samenvatting alleen op de titel en blijf neutraal/beschrijvend.

Beschikbare disciplines (kies 1 t/m 3 die het beste passen):
${knowledgeDisciplines.join(", ")}

Type bron: ${item.type === "news" ? "nieuws/equipment" : "wetenschappelijk artikel"}
Titel: ${item.title}
Bron: ${item.source ?? "onbekend"}
Abstract: ${abstract || "(geen abstract beschikbaar)"}

Geef UITSLUITEND geldige JSON terug, zonder extra tekst:
{
  "summary": "2-3 zinnen in het Nederlands, neutraal en feitelijk, alleen gebaseerd op bovenstaande tekst",
  "titleNl": "de titel in natuurlijk Nederlands vertaald; is de titel al Nederlands, geef hem dan ongewijzigd terug; eigennamen (renners, koersen, merken) blijven onvertaald",
  "disciplines": ["..."]
}`;

  const msg = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
  const block = msg.content[0];
  const text = block && block.type === "text" ? block.text : "";
  const parsed = extractJson(text);
  if (!parsed) return null;

  const summary =
    typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  const titleNl =
    typeof parsed.titleNl === "string" && parsed.titleNl.trim()
      ? parsed.titleNl.trim().slice(0, 500)
      : null;
  const rawDisc = Array.isArray(parsed.disciplines) ? parsed.disciplines : [];
  let disciplines = rawDisc
    .filter((d): d is string => typeof d === "string")
    .map((d) => d.trim().toLowerCase())
    .filter((d) => VALID_DISCIPLINES.has(d)) as KnowledgeDiscipline[];
  disciplines = [...new Set(disciplines)].slice(0, 3);
  // Fall back to a sensible default tag from the source query if AI gave none.
  if (disciplines.length === 0) {
    disciplines = item.type === "news" ? ["sportnieuws"] : ["sportwetenschap"];
  }
  if (!summary) return null;
  return { summary, titleNl, disciplines };
}

function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

// Run the full knowledge scan: fetch real sources → dedupe (in-batch + vs DB) →
// AI summarise/tag only the genuinely-new items → upsert. Idempotent: re-running
// inserts nothing new because dedupeKey already exists.
export async function runKnowledgeScan(
  opts: FetchOptions & { concurrency?: number; maxNew?: number } = {},
): Promise<ScanResult> {
  const { items, errors: fetchErrors } = await fetchAllSources(opts);

  // In-batch dedupe by computed key (keep the one with the richer abstract).
  const byKey = new Map<string, RawItem>();
  for (const it of items) {
    const key = computeDedupeKey(it);
    const existing = byKey.get(key);
    if (!existing || (it.abstract?.length ?? 0) > (existing.abstract?.length ?? 0)) {
      byKey.set(key, it);
    }
  }
  const uniqueKeys = [...byKey.keys()];

  // Which keys already exist in the global library?
  let existingKeys = new Set<string>();
  if (uniqueKeys.length) {
    const rows = await db
      .select({ dedupeKey: knowledgeItemsTable.dedupeKey })
      .from(knowledgeItemsTable)
      .where(inArray(knowledgeItemsTable.dedupeKey, uniqueKeys));
    existingKeys = new Set(rows.map((r) => r.dedupeKey));
  }

  let newCandidates = [...byKey.entries()]
    .filter(([key]) => !existingKeys.has(key))
    .map(([key, item]) => ({ key, item }));

  if (typeof opts.maxNew === "number") {
    // Share the cap FAIRLY across sources (round-robin) instead of slicing in
    // fetch order — otherwise feeds listed first consume the whole budget every
    // run and later feeds (e.g. the Dutch ones) are permanently starved.
    const bySource = new Map<string, typeof newCandidates>();
    for (const c of newCandidates) {
      const s = c.item.source ?? "";
      const arr = bySource.get(s);
      if (arr) arr.push(c);
      else bySource.set(s, [c]);
    }
    const groups = [...bySource.values()];
    const picked: typeof newCandidates = [];
    let idx = 0;
    while (picked.length < opts.maxNew) {
      let took = false;
      for (const g of groups) {
        if (idx < g.length && picked.length < opts.maxNew) {
          picked.push(g[idx]!);
          took = true;
        }
      }
      if (!took) break;
      idx++;
    }
    newCandidates = picked;
  }

  const summariseErrors: string[] = [];
  let summarised = 0;

  // Summarise+tag new items with bounded concurrency / retries.
  const enriched = await batchProcess(
    newCandidates,
    async ({ key, item }) => {
      let result: Awaited<ReturnType<typeof summariseAndTag>> = null;
      try {
        result = await summariseAndTag(item);
      } catch (err) {
        summariseErrors.push(
          `${item.title.slice(0, 60)}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
      if (result) summarised++;
      return { key, item, enrichment: result };
    },
    { concurrency: opts.concurrency ?? 3, retries: 3 },
  );

  // Upsert. onConflictDoNothing keeps the run idempotent under races.
  let newItems = 0;
  for (const { key, item, enrichment } of enriched) {
    const inserted = await db
      .insert(knowledgeItemsTable)
      .values({
        dedupeKey: key,
        type: item.type,
        provider: item.provider,
        title: item.title,
        titleNl: enrichment?.titleNl ?? null,
        authors: item.authors,
        source: item.source,
        url: item.url,
        doi: item.doi,
        publishedAt: item.publishedAt,
        abstract: item.abstract,
        summary: enrichment?.summary ?? null,
        disciplines:
          enrichment?.disciplines ??
          (item.type === "news" ? ["sportnieuws"] : ["sportwetenschap"]),
        sourceQuery: item.sourceQuery,
      })
      .onConflictDoNothing({ target: knowledgeItemsTable.dedupeKey })
      .returning({ id: knowledgeItemsTable.id });
    if (inserted.length) newItems++;
  }

  return {
    fetched: items.length,
    unique: uniqueKeys.length,
    newItems,
    summarised,
    skippedExisting: uniqueKeys.length - newCandidates.length,
    fetchErrors,
    summariseErrors,
  };
}

// ── Dutch-title backfill ─────────────────────────────────────────────────────
// Older rows were stored before Dutch titles existed. This translates the REAL
// stored title of news items that still lack one — pure translation, never a
// rewrite: proper nouns stay, no facts added. Bounded per run so it heals
// gradually on the read path without a big burst.
export async function translateMissingNewsTitles(
  opts: { max?: number; concurrency?: number } = {},
): Promise<{ candidates: number; translated: number; errors: string[] }> {
  const max = opts.max ?? 30;
  const rows = await db
    .select({ id: knowledgeItemsTable.id, title: knowledgeItemsTable.title })
    .from(knowledgeItemsTable)
    .where(
      sql`${knowledgeItemsTable.type} = 'news' and ${knowledgeItemsTable.titleNl} is null`,
    )
    .orderBy(sql`${knowledgeItemsTable.publishedAt} desc nulls last`)
    .limit(max);

  const errors: string[] = [];
  let translated = 0;

  await batchProcess(
    rows,
    async (row) => {
      try {
        const msg = await anthropic.messages.create({
          model: MODEL,
          max_tokens: 300,
          messages: [
            {
              role: "user",
              content: `Vertaal deze nieuwskop naar natuurlijk Nederlands. STRIKT: alleen vertalen, niets toevoegen of weglaten; eigennamen (renners, koersen, merken, plaatsen) blijven onvertaald; is de kop al Nederlands, geef hem dan exact ongewijzigd terug.

Kop: ${row.title}

Geef UITSLUITEND geldige JSON terug: {"titleNl":"..."}`,
            },
          ],
        });
        const block = msg.content[0];
        const text = block && block.type === "text" ? block.text : "";
        const parsed = extractJson(text);
        const titleNl =
          parsed && typeof parsed.titleNl === "string" && parsed.titleNl.trim()
            ? parsed.titleNl.trim().slice(0, 500)
            : null;
        if (!titleNl) return;
        await db
          .update(knowledgeItemsTable)
          .set({ titleNl, updatedAt: new Date() })
          .where(sql`${knowledgeItemsTable.id} = ${row.id}`);
        translated++;
      } catch (err) {
        errors.push(
          `#${row.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
    { concurrency: opts.concurrency ?? 3, retries: 2 },
  );

  return { candidates: rows.length, translated, errors };
}

// Count current library size (used by job logging / admin endpoint).
export async function knowledgeCount(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(knowledgeItemsTable);
  return row?.n ?? 0;
}
