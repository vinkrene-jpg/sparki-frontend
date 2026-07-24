// Sparki Foundation — Knowledge Engine.
//
// Scientific-evidence layer on top of the existing knowledge tables. It never
// duplicates item content: knowledge_items keeps DOI/author/source/date; the
// knowledge_evidence table adds evidence level, quality score, validity,
// conflicts and curated tags. No dataset is imported here — full support only.

import { desc, eq, inArray, sql } from "drizzle-orm";
import {
  db,
  knowledgeItemsTable,
  knowledgeEvidenceTable,
  evidenceLevels,
} from "@workspace/db";
import type { EvidenceRecord, KnowledgeEngine } from "./contracts";
import { FOUNDATION_CONFIG } from "./config";
import { engineLogger } from "./logging";

const log = engineLogger("knowledge");

const SCORING_VERSION = "kwaliteit-1.0.0";

/** Deterministic 0–100 quality score. Same inputs ⇒ same score, versioned. */
function scoreQuality(input: {
  evidenceLevel: string;
  publicatiedatum: string | null;
  reliability?: string | null;
}): { score: number; versie: string } {
  const base: Record<string, number> = {
    "meta-analyse": 90,
    rct: 80,
    cohort: 65,
    "case-study": 45,
    "expert-opinie": 30,
    onbekend: 10,
  };
  let score = base[input.evidenceLevel] ?? 10;
  // Recency: publications older than 10 years lose up to 15 points.
  if (input.publicatiedatum) {
    const years =
      (Date.now() - new Date(input.publicatiedatum).getTime()) /
      (365.25 * 24 * 3600 * 1000);
    if (Number.isFinite(years) && years > 10) {
      score -= Math.min(15, Math.round(years - 10));
    }
  }
  if (input.reliability === "hoog") score += 5;
  if (input.reliability === "laag") score -= 10;
  return { score: Math.max(0, Math.min(100, score)), versie: SCORING_VERSION };
}

function toRecord(row: {
  evidence: typeof knowledgeEvidenceTable.$inferSelect;
  titel: string | null;
  bron: string | null;
  auteurs: string[] | null;
  doi: string | null;
  publishedAt: string | null;
}): EvidenceRecord {
  const today = new Date().toISOString().split("T")[0]!;
  return {
    evidenceId: row.evidence.id,
    titel: row.titel ?? "(onbekende titel)",
    bron: row.bron,
    auteurs: row.auteurs && row.auteurs.length > 0 ? row.auteurs.join(", ") : null,
    doi: row.doi,
    publicatiedatum: row.publishedAt,
    evidenceLevel: row.evidence.evidenceLevel,
    kwaliteitsscore: row.evidence.qualityScore,
    scoringVersie: row.evidence.scoringVersion,
    geldigTot: row.evidence.validUntil,
    verlopen: row.evidence.validUntil != null && row.evidence.validUntil < today,
    conflicten: row.evidence.conflictsWith ?? [],
    tags: row.evidence.tags ?? [],
    versie: null,
  };
}

export function createKnowledgeEngine(): KnowledgeEngine {
  return {
    scoreQuality,

    async findEvidence({ tags, limit }): Promise<EvidenceRecord[]> {
      const cfg = FOUNDATION_CONFIG.knowledge;
      const max = Math.min(limit ?? 20, Number(cfg.parameters["maxResultaten"] ?? 20));
      const rows = await db
        .select({
          evidence: knowledgeEvidenceTable,
          titel: knowledgeItemsTable.title,
          bron: knowledgeItemsTable.source,
          auteurs: knowledgeItemsTable.authors,
          doi: knowledgeItemsTable.doi,
          publishedAt: knowledgeItemsTable.publishedAt,
        })
        .from(knowledgeEvidenceTable)
        .leftJoin(
          knowledgeItemsTable,
          eq(knowledgeEvidenceTable.knowledgeItemId, knowledgeItemsTable.id),
        )
        .where(
          tags && tags.length > 0
            ? sql`${knowledgeEvidenceTable.tags} && ${sql.param(tags)}`
            : undefined,
        )
        .orderBy(desc(knowledgeEvidenceTable.qualityScore))
        .limit(max);
      return rows.map(toRecord);
    },

    async registerEvidence(input): Promise<EvidenceRecord> {
      if (!evidenceLevels.includes(input.evidenceLevel as never)) {
        throw new Error(`Ongeldig evidence-niveau: ${input.evidenceLevel}`);
      }
      if (
        input.subjectKind === "knowledge_item" &&
        input.knowledgeItemId == null
      ) {
        throw new Error("knowledgeItemId is verplicht voor knowledge_item");
      }
      if (input.subjectKind === "managed_item" && input.managedItemId == null) {
        throw new Error("managedItemId is verplicht voor managed_item");
      }

      // Quality score needs the publication date when the item is linked.
      let publishedAt: string | null = null;
      if (input.knowledgeItemId != null) {
        const [item] = await db
          .select({ publishedAt: knowledgeItemsTable.publishedAt })
          .from(knowledgeItemsTable)
          .where(eq(knowledgeItemsTable.id, input.knowledgeItemId));
        if (!item) throw new Error("Kennisitem niet gevonden");
        publishedAt = item.publishedAt;
      }
      const quality = scoreQuality({
        evidenceLevel: input.evidenceLevel,
        publicatiedatum: publishedAt,
      });

      const values = {
        subjectKind: input.subjectKind,
        knowledgeItemId: input.knowledgeItemId ?? null,
        managedItemId: input.managedItemId ?? null,
        evidenceLevel: input.evidenceLevel,
        qualityScore: quality.score,
        scoringVersion: quality.versie,
        validFrom: input.validFrom ?? null,
        validUntil: input.validUntil ?? null,
        conflictsWith: input.conflictsWith ?? [],
        tags: input.tags ?? [],
        notes: input.notes ?? null,
        updatedAt: new Date(),
      };
      const [row] = await db
        .insert(knowledgeEvidenceTable)
        .values(values)
        .onConflictDoUpdate({
          target: [
            knowledgeEvidenceTable.subjectKind,
            knowledgeEvidenceTable.knowledgeItemId,
            knowledgeEvidenceTable.managedItemId,
          ],
          set: values,
        })
        .returning();
      if (!row) throw new Error("Evidence-registratie mislukt");
      log.info(
        { evidenceId: row.id, level: row.evidenceLevel, score: row.qualityScore },
        "foundation.knowledge.registerEvidence",
      );

      let meta: { title: string | null; source: string | null; authors: string[] | null; doi: string | null; publishedAt: string | null } = {
        title: null,
        source: null,
        authors: null,
        doi: null,
        publishedAt: null,
      };
      if (row.knowledgeItemId != null) {
        const [item] = await db
          .select({
            title: knowledgeItemsTable.title,
            source: knowledgeItemsTable.source,
            authors: knowledgeItemsTable.authors,
            doi: knowledgeItemsTable.doi,
            publishedAt: knowledgeItemsTable.publishedAt,
          })
          .from(knowledgeItemsTable)
          .where(eq(knowledgeItemsTable.id, row.knowledgeItemId));
        if (item) meta = item;
      }
      return toRecord({
        evidence: row,
        titel: meta.title,
        bron: meta.source,
        auteurs: meta.authors,
        doi: meta.doi,
        publishedAt: meta.publishedAt,
      });
    },
  };
}
