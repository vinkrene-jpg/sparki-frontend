// Golf 21 — Beheerde kennislaag (governance) bovenop de bestaande kennisbank.
//
// knowledge_items (gescande literatuur/nieuws) blijft bestaan; dit bestand
// beheert de GECONTROLEERDE vakkennis: items met status, versie,
// betrouwbaarheid en herleidbaar gebruik per engine.
//
// Eerlijkheidscontract:
// - Nieuw advies gebruikt UITSLUITEND items met status "actief".
// - Ieder gebruik pint de versie (knowledge_usage_events) zodat historische
//   analyses herleidbaar blijven, ook na wijziging of intrekking.
// - Het promptblok verbiedt het model expliciet om buiten de aangeleverde
//   broninhoud te treden; zonder bron is er geen vakkennis-claim.
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  managedKnowledgeItemsTable,
  managedKnowledgeVersionsTable,
  knowledgeUsageEventsTable,
  knowledgeFeedbackTable,
  managedKnowledgeDomains,
  managedKnowledgeStatuses,
  managedKnowledgeReliabilities,
  managedKnowledgeAudiences,
  type ManagedKnowledgeItem,
  type ManagedKnowledgeDomain,
} from "@workspace/db";

export {
  managedKnowledgeDomains,
  managedKnowledgeStatuses,
  managedKnowledgeReliabilities,
  managedKnowledgeAudiences,
};

// ── Actieve kennis ophalen ───────────────────────────────────────────────────

export async function getActiveKnowledge(opts: {
  domain?: ManagedKnowledgeDomain | ManagedKnowledgeDomain[];
  discipline?: string | null;
  audience?: string | null;
  topicLike?: string | null;
  limit?: number;
}): Promise<ManagedKnowledgeItem[]> {
  const domains = opts.domain
    ? Array.isArray(opts.domain)
      ? opts.domain
      : [opts.domain]
    : null;
  const conds = [eq(managedKnowledgeItemsTable.status, "actief")];
  if (domains && domains.length > 0)
    conds.push(inArray(managedKnowledgeItemsTable.domain, domains));
  const rows = await db
    .select()
    .from(managedKnowledgeItemsTable)
    .where(and(...conds))
    .orderBy(desc(managedKnowledgeItemsTable.updatedAt))
    .limit(200);
  // Discipline/doelgroep-filter in JS: null-discipline items gelden voor alle
  // disciplines; doelgroep "iedereen" geldt voor iedereen.
  const filtered = rows.filter((r) => {
    if (
      opts.discipline &&
      r.discipline != null &&
      r.discipline !== opts.discipline
    )
      return false;
    if (
      opts.audience &&
      r.audience !== "iedereen" &&
      r.audience !== opts.audience
    )
      return false;
    if (opts.topicLike) {
      const needle = opts.topicLike.toLowerCase();
      if (
        !r.topic.toLowerCase().includes(needle) &&
        !r.body.toLowerCase().includes(needle)
      )
        return false;
    }
    return true;
  });
  return filtered.slice(0, opts.limit ?? 5);
}

// ── Gebruik registreren (versie-pin) ─────────────────────────────────────────

export type KnowledgeEngineName =
  | "vandaag"
  | "analyse"
  | "plan"
  | "voeding"
  | "race"
  | "mechanieker"
  | "coach"
  | "uitleg";

export async function recordKnowledgeUsage(
  items: Pick<ManagedKnowledgeItem, "id" | "version">[],
  engine: KnowledgeEngineName,
  clerkId: string | null,
  contextRef?: string | null,
): Promise<void> {
  if (items.length === 0) return;
  await db.insert(knowledgeUsageEventsTable).values(
    items.map((i) => ({
      itemId: i.id,
      version: i.version,
      engine,
      clerkId,
      contextRef: contextRef ?? null,
    })),
  );
}

// ── Promptblok (AI mag alleen samenvatten/uitleggen, nooit verzinnen) ───────

const CAUTION_DOMAINS: ManagedKnowledgeDomain[] = [
  "voeding",
  "herstel",
  "veiligheid",
];

export function knowledgeSourceBlock(
  items: ManagedKnowledgeItem[],
): string | null {
  if (items.length === 0) return null;
  const lines = items.map((i, idx) => {
    const meta = [
      `bron: ${i.sourceName}`,
      i.publishedAt ? `publicatie: ${i.publishedAt}` : null,
      i.reviewedAt ? `gecontroleerd: ${i.reviewedAt}` : null,
      `versie ${i.version}`,
      `betrouwbaarheid: ${i.reliability}`,
    ]
      .filter(Boolean)
      .join("; ");
    const extra = [
      i.limitations ? `Beperkingen: ${i.limitations}` : null,
      i.professionalCheck ? `Professionele controle: ${i.professionalCheck}` : null,
    ]
      .filter(Boolean)
      .join(" ");
    return `[K${idx + 1}] ${i.topic} (${meta})\n${i.body}${extra ? `\n${extra}` : ""}`;
  });
  const hasCaution = items.some((i) =>
    CAUTION_DOMAINS.includes(i.domain as ManagedKnowledgeDomain),
  );
  return [
    "GECONTROLEERDE VAKKENNIS (beheerde bronnen):",
    ...lines,
    "",
    "HARDE REGELS VOOR DEZE VAKKENNIS:",
    "- Gebruik voor vakinhoudelijke uitspraken UITSLUITEND de bovenstaande broninhoud, de meegegeven sporterdata en de meegegeven deterministische conclusies.",
    "- Verzin NOOIT meetwaarden, diagnoses, bronverwijzingen, onderzoeksresultaten of trainingsregels die hier niet letterlijk staan.",
    "- Verwijs bij gebruik compact naar de bron (bv. \"volgens [K1]\").",
    "- Ontbreekt kennis over een vraag, zeg dan eerlijk dat daar geen gecontroleerde bron voor is.",
    ...(hasCaution
      ? [
          "- Medisch/voeding/veiligheid: geen diagnose, geen behandeladvies, geen gegarandeerde uitkomst; adviseer bij risico of twijfel een bevoegde professional (arts, sportdiëtist).",
        ]
      : []),
  ].join("\n");
}

// ── Compacte bronvermelding voor de frontend ─────────────────────────────────

export type SourceCitation = {
  itemId: number;
  version: number;
  kind: "vakkennis";
  topic: string;
  sourceName: string;
  sourceUrl: string | null;
  publishedAt: string | null;
  reviewedAt: string | null;
  reliability: string;
  limitations: string | null;
  professionalCheck: string | null;
};

export function buildSourceCitations(
  items: ManagedKnowledgeItem[],
): SourceCitation[] {
  return items.map((i) => ({
    itemId: i.id,
    version: i.version,
    kind: "vakkennis" as const,
    topic: i.topic,
    sourceName: i.sourceName,
    sourceUrl: i.sourceUrl,
    publishedAt: i.publishedAt,
    reviewedAt: i.reviewedAt,
    reliability: i.reliability,
    limitations: i.limitations,
    professionalCheck: i.professionalCheck,
  }));
}

// ── Beheer: publiceren / intrekken / verouderd ───────────────────────────────

export async function publishKnowledgeItem(
  itemId: number,
  publishedBy: string,
): Promise<{ ok: true; version: number } | { ok: false; error: string }> {
  return db.transaction(async (tx) => {
    const [item] = await tx
      .select()
      .from(managedKnowledgeItemsTable)
      .where(eq(managedKnowledgeItemsTable.id, itemId))
      .limit(1)
      .for("update");
    if (!item) return { ok: false as const, error: "Kennisitem niet gevonden" };
    if (item.status === "ingetrokken")
      return {
        ok: false as const,
        error: "Ingetrokken kennis kan niet opnieuw worden gepubliceerd; maak een nieuw item",
      };
    const nextVersion = item.version + 1;
    await tx
      .update(managedKnowledgeItemsTable)
      .set({
        status: "actief",
        version: nextVersion,
        statusReason: null,
        updatedAt: new Date(),
      })
      .where(eq(managedKnowledgeItemsTable.id, itemId));
    await tx.insert(managedKnowledgeVersionsTable).values({
      itemId,
      version: nextVersion,
      topic: item.topic,
      domain: item.domain,
      body: item.body,
      limitations: item.limitations,
      professionalCheck: item.professionalCheck,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      publishedAt: item.publishedAt,
      reviewedAt: item.reviewedAt,
      reliability: item.reliability,
      publishedBy,
    });
    return { ok: true as const, version: nextVersion };
  });
}

export async function setKnowledgeStatus(
  itemId: number,
  status: "verouderd" | "ingetrokken" | "concept",
  reason: string | null,
): Promise<boolean> {
  const rows = await db
    .update(managedKnowledgeItemsTable)
    .set({ status, statusReason: reason, updatedAt: new Date() })
    .where(eq(managedKnowledgeItemsTable.id, itemId))
    .returning({ id: managedKnowledgeItemsTable.id });
  return rows.length > 0;
}

// ── Conflicterende bronnen + verouderingssignaal ─────────────────────────────

export async function findKnowledgeConflicts(): Promise<
  { topic: string; domain: string; items: { id: number; sourceName: string; reliability: string }[] }[]
> {
  const active = await db
    .select()
    .from(managedKnowledgeItemsTable)
    .where(eq(managedKnowledgeItemsTable.status, "actief"));
  const byKey = new Map<string, ManagedKnowledgeItem[]>();
  for (const i of active) {
    const key = `${i.domain}::${i.topic.trim().toLowerCase()}`;
    byKey.set(key, [...(byKey.get(key) ?? []), i]);
  }
  return [...byKey.values()]
    .filter((g) => g.length > 1)
    .map((g) => ({
      topic: g[0].topic,
      domain: g[0].domain,
      items: g.map((i) => ({
        id: i.id,
        sourceName: i.sourceName,
        reliability: i.reliability,
      })),
    }));
}

const STALE_REVIEW_DAYS = 365;

export async function findStaleKnowledge(): Promise<
  { id: number; topic: string; reviewedAt: string | null; daysSinceReview: number | null }[]
> {
  const active = await db
    .select()
    .from(managedKnowledgeItemsTable)
    .where(eq(managedKnowledgeItemsTable.status, "actief"));
  const now = Date.now();
  return active
    .map((i) => {
      const ref = i.reviewedAt ?? i.publishedAt;
      const days = ref
        ? Math.floor((now - new Date(`${ref}T00:00:00Z`).getTime()) / 86400000)
        : null;
      return { id: i.id, topic: i.topic, reviewedAt: i.reviewedAt, daysSinceReview: days };
    })
    .filter((i) => i.daysSinceReview == null || i.daysSinceReview > STALE_REVIEW_DAYS);
}

// ── Gebruik & feedback (beheeroverzichten) ───────────────────────────────────

export async function knowledgeUsageByEngine(): Promise<
  { engine: string; itemId: number; topic: string; uses: number; lastUsedAt: string | null }[]
> {
  const rows = await db
    .select({
      engine: knowledgeUsageEventsTable.engine,
      itemId: knowledgeUsageEventsTable.itemId,
      topic: managedKnowledgeItemsTable.topic,
      uses: sql<number>`count(*)::int`,
      lastUsedAt: sql<string | null>`max(${knowledgeUsageEventsTable.usedAt})::text`,
    })
    .from(knowledgeUsageEventsTable)
    .innerJoin(
      managedKnowledgeItemsTable,
      eq(knowledgeUsageEventsTable.itemId, managedKnowledgeItemsTable.id),
    )
    .groupBy(
      knowledgeUsageEventsTable.engine,
      knowledgeUsageEventsTable.itemId,
      managedKnowledgeItemsTable.topic,
    )
    .orderBy(desc(sql`count(*)`));
  return rows;
}

export async function submitKnowledgeFeedback(input: {
  itemId: number;
  clerkId: string;
  message: string;
}): Promise<{ ok: boolean; error?: string }> {
  const [item] = await db
    .select({ id: managedKnowledgeItemsTable.id })
    .from(managedKnowledgeItemsTable)
    .where(eq(managedKnowledgeItemsTable.id, input.itemId))
    .limit(1);
  if (!item) return { ok: false, error: "Kennisitem niet gevonden" };
  await db.insert(knowledgeFeedbackTable).values({
    itemId: input.itemId,
    clerkId: input.clerkId,
    message: input.message.slice(0, 2000),
  });
  return { ok: true };
}
