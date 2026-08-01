// AIE2 F1 — Adviesdossier: één registratielaag voor NIEUWE adviezen.
//
// Principes (AIE2-27/28/29/30):
// - Elk nieuw advies dat via deze laag wordt uitgeleverd krijgt een dossier
//   met twintig velden. Onvolledig dossier = harde fout, geen stille null.
// - De twee "structureel vergeten" velden (waarom is het alternatief niet
//   gekozen · latere uitkomst) zijn hier expliciet: het eerste is verplicht
//   bij aanmaak, het tweede wordt later ingevuld via recordAdviceOutcome —
//   nooit verzonnen bij aanmaak.
// - Bestaande adviezen krijgen GEEN backfill met verzonnen waarden: een
//   advies zonder dossier is per definitie LEGACY_NIET_VOLLEDIG_HERLEIDBAAR
//   (afgeleid bij lezen). De regel "zonder dossier niet tonen" geldt alleen
//   voor nieuwe adviezen, na een bewezen overgang (AIE2-30).
// - Interne confidence-factoren blijven intern; naar de gebruiker gaat
//   uitsluitend één van vier taalniveaus (AIE2-09/32).

import { db, adviceDossiersTable, type AdviceDossierRow } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";

// Register van adviesvormen (F0 §7.5: één register, geen twaalfde losse vorm).
export const ADVICE_TYPES = [
  "dag_advies",
  "coach_besluit",
  "coach_signaal",
  "wijzigingsvoorstel",
  "observatie",
  "race_advies",
  "voeding_richtwaarde",
  "plan_aanpassing",
  "herstel_advies",
  "doel_bewaking",
] as const;
export type AdviceType = (typeof ADVICE_TYPES)[number];

// Vier gebruikersniveaus in gewone taal (AIE2-32). Geen scores naar buiten.
export const CONFIDENCE_LEVELS = [
  "zeker",
  "redelijk_zeker",
  "voorzichtig",
  "slag_om_de_arm",
] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const LEGACY_STATUS = "LEGACY_NIET_VOLLEDIG_HERLEIDBAAR" as const;

export type DossierDataPoint = {
  kind: string;
  label: string;
  value: string;
  date?: string;
};

export type AdviceDossierInput = {
  clerkId: string;
  adviceType: AdviceType;
  adviceKey: string; // stabiele verwijzing naar het advies (bv. "dag:2026-08-01")
  title: string;
  adviceText: string;
  basedOn: DossierDataPoint[]; // minimaal 1 echt datapunt
  sourcesUsed: string[]; // source-quality keys
  sourcesExcluded: { source: string; reason: string }[];
  rulesApplied: string[]; // deterministische regel-ids
  knowledgeRefs: { evidenceId: number; version: number }[]; // KENNIS_01
  confidenceFactors: Record<string, unknown>; // intern rekenkader (F3 vult de 8 factoren)
  confidenceLevel: ConfidenceLevel;
  alternativesConsidered: { option: string }[];
  whyAlternativeRejected: string; // verplicht (AIE2-27)
  risks: { risk: string }[];
  validUntil?: Date | null;
  computedBy: { engine: string; version?: string }[];
  aiInvolvement: { used: boolean; purpose?: string }; // metadata-only
  audience?: "sporter" | "trainer" | "ouder";
};

export class DossierIncompleteError extends Error {
  constructor(public missing: string[]) {
    super(`Adviesdossier onvolledig: ${missing.join(", ")}`);
    this.name = "DossierIncompleteError";
  }
}

function missingFields(input: AdviceDossierInput): string[] {
  const missing: string[] = [];
  const req: [string, boolean][] = [
    ["clerkId", !!input.clerkId],
    ["adviceType", (ADVICE_TYPES as readonly string[]).includes(input.adviceType)],
    ["adviceKey", !!input.adviceKey?.trim()],
    ["title", !!input.title?.trim()],
    ["adviceText", !!input.adviceText?.trim()],
    ["basedOn", Array.isArray(input.basedOn) && input.basedOn.length > 0],
    ["sourcesUsed", Array.isArray(input.sourcesUsed)],
    ["sourcesExcluded", Array.isArray(input.sourcesExcluded)],
    ["rulesApplied", Array.isArray(input.rulesApplied) && input.rulesApplied.length > 0],
    ["knowledgeRefs", Array.isArray(input.knowledgeRefs)],
    ["confidenceFactors", input.confidenceFactors != null],
    [
      "confidenceLevel",
      (CONFIDENCE_LEVELS as readonly string[]).includes(input.confidenceLevel),
    ],
    [
      "alternativesConsidered",
      Array.isArray(input.alternativesConsidered) &&
        input.alternativesConsidered.length > 0,
    ],
    ["whyAlternativeRejected", !!input.whyAlternativeRejected?.trim()],
    ["risks", Array.isArray(input.risks)],
    ["computedBy", Array.isArray(input.computedBy) && input.computedBy.length > 0],
    ["aiInvolvement", typeof input.aiInvolvement?.used === "boolean"],
  ];
  for (const [name, ok] of req) if (!ok) missing.push(name);
  return missing;
}

// Idempotent: zelfde dedupeKey ⇒ bestaande rij terug, nooit een dubbel dossier.
export async function createAdviceDossier(
  input: AdviceDossierInput,
): Promise<AdviceDossierRow> {
  const missing = missingFields(input);
  if (missing.length > 0) throw new DossierIncompleteError(missing);

  const dedupeKey = `${input.clerkId}:${input.adviceType}:${input.adviceKey}`.slice(0, 200);
  const [inserted] = await db
    .insert(adviceDossiersTable)
    .values({
      clerkId: input.clerkId,
      adviceType: input.adviceType,
      adviceKey: input.adviceKey,
      title: input.title.trim(),
      adviceText: input.adviceText.trim(),
      basedOn: input.basedOn,
      sourcesUsed: input.sourcesUsed,
      sourcesExcluded: input.sourcesExcluded,
      rulesApplied: input.rulesApplied,
      knowledgeRefs: input.knowledgeRefs,
      confidenceFactors: input.confidenceFactors,
      confidenceLevel: input.confidenceLevel,
      alternativesConsidered: input.alternativesConsidered,
      whyAlternativeRejected: input.whyAlternativeRejected.trim(),
      risks: input.risks,
      validUntil: input.validUntil ?? null,
      computedBy: input.computedBy,
      aiInvolvement: input.aiInvolvement,
      audience: input.audience ?? "sporter",
      dedupeKey,
    })
    .onConflictDoNothing({ target: adviceDossiersTable.dedupeKey })
    .returning();
  if (inserted) return inserted;
  const [existing] = await db
    .select()
    .from(adviceDossiersTable)
    .where(eq(adviceDossiersTable.dedupeKey, dedupeKey))
    .limit(1);
  if (!existing) throw new Error("Dossier-dedupe race: rij niet gevonden");
  return existing;
}

// "Latere uitkomst" (AIE2-27): later vastgelegd, nooit bij aanmaak verzonnen.
export async function recordAdviceOutcome(
  clerkId: string,
  dossierId: number,
  outcome: string,
): Promise<boolean> {
  const trimmed = outcome.trim();
  if (!trimmed) return false;
  const rows = await db
    .update(adviceDossiersTable)
    .set({ outcome: trimmed, outcomeAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(adviceDossiersTable.id, dossierId),
        eq(adviceDossiersTable.clerkId, clerkId),
      ),
    )
    .returning({ id: adviceDossiersTable.id });
  return rows.length > 0;
}

export async function getDossierByKey(
  clerkId: string,
  adviceKey: string,
): Promise<AdviceDossierRow | null> {
  const [row] = await db
    .select()
    .from(adviceDossiersTable)
    .where(
      and(
        eq(adviceDossiersTable.clerkId, clerkId),
        eq(adviceDossiersTable.adviceKey, adviceKey),
      ),
    )
    .orderBy(desc(adviceDossiersTable.createdAt))
    .limit(1);
  return row ?? null;
}

// Legacy-afleiding (AIE2-29/30): een advies zonder dossier is legacy en wordt
// in de UI eerlijk zo benoemd — niet verborgen, niet ongemarkeerd getoond.
export function dossierStatusFor(row: AdviceDossierRow | null): {
  status: string;
  herleidbaar: boolean;
  label: string | null;
} {
  if (!row) {
    return {
      status: LEGACY_STATUS,
      herleidbaar: false,
      label: "Dit advies is van vóór het adviesdossier en niet volledig herleidbaar.",
    };
  }
  return { status: row.status, herleidbaar: true, label: null };
}
