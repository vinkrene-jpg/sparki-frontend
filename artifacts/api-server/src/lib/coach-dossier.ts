// AI_COACH_KOPPELING_EN_GEHEUGEN_01 — R3: het adviesdossier daadwerkelijk
// aanmaken. Elk advies uit /brief, /ask, workout-explain(-extended) en
// workout-adjust krijgt een dossier VOORDAT het advies naar de sporter gaat:
// zonder dossier geen advies (DossierIncompleteError blokkeert).
//
// In het dossier zit minimaal (§R3): de gebruikte datapunten met datum, de
// gebruikte herinneringen, het meetniveau op dat moment, en waarom het
// alternatief niet is gekozen. Alles komt uit ECHTE bronnen — niets verzonnen;
// wat ontbreekt wordt eerlijk als afwezig genoteerd.

import { createHash } from "node:crypto";
import { db, athleteDailyMetricsTable, trainingSessionsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import type { AdviceDossierRow } from "@workspace/db";
import {
  createAdviceDossier,
  type AdviceType,
  type DossierDataPoint,
} from "./advice-dossier";
import { getContextObservations } from "./ai-memory";
import { observeSporen } from "../engines/meetniveau/derive";
import { interneCode } from "../engines/meetniveau/compute";
import { todayStr } from "./athlete-context";

export type CoachDossierInput = {
  clerkId: string;
  adviceType: AdviceType;
  adviceKey: string;
  title: string;
  adviceText: string;
  /** Metadata-doel van de modelaanroep (gateway purpose). */
  aiPurpose: string;
  /** Extra echte datapunten die de route zelf al in handen heeft. */
  extraBasedOn?: DossierDataPoint[];
  extraRules?: string[];
  knowledgeRefs?: { evidenceId: number; version: number }[];
  whyAlternativeRejected: string;
  alternativesConsidered: { option: string }[];
  risks?: { risk: string }[];
};

/**
 * Verzamelt de werkelijk beschikbare onderbouwing en maakt het dossier aan.
 * Gooit (o.a. DossierIncompleteError) als het dossier niet compleet kan —
 * de aanroepende route mag het advies dan NIET tonen.
 */
export async function maakCoachDossier(input: CoachDossierInput): Promise<AdviceDossierRow> {
  const vandaag = todayStr();

  const [herinneringen, checkin, laatsteSessie, sporen] = await Promise.all([
    getContextObservations(input.clerkId),
    db
      .select({
        date: athleteDailyMetricsTable.metricDate,
        hrv: athleteDailyMetricsTable.hrv,
        restingHr: athleteDailyMetricsTable.restingHR,
        sleepHours: athleteDailyMetricsTable.sleepHours,
        fatigue: athleteDailyMetricsTable.fatigueScore,
      })
      .from(athleteDailyMetricsTable)
      .where(eq(athleteDailyMetricsTable.clerkId, input.clerkId))
      .orderBy(desc(athleteDailyMetricsTable.metricDate))
      .limit(1),
    db
      .select({
        date: trainingSessionsTable.sessionDate,
        tss: trainingSessionsTable.tss,
        np: trainingSessionsTable.normalizedPower,
      })
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.clerkId, input.clerkId))
      .orderBy(desc(trainingSessionsTable.sessionDate))
      .limit(1),
    // Meetniveau eerlijk waarnemen; als de waarneming zelf faalt, noteren we
    // dat expliciet in plaats van een niveau te verzinnen.
    observeSporen(input.clerkId).catch(() => null),
  ]);

  const basedOn: DossierDataPoint[] = [];
  if (checkin[0]) {
    basedOn.push({
      kind: "checkin",
      label: "laatste dagmeting",
      value: JSON.stringify(checkin[0]),
      date: String(checkin[0].date),
    });
  }
  if (laatsteSessie[0]) {
    basedOn.push({
      kind: "sessie",
      label: "laatste training",
      value: JSON.stringify(laatsteSessie[0]),
      date: String(laatsteSessie[0].date),
    });
  }
  for (const h of herinneringen) {
    basedOn.push({
      kind: "herinnering",
      label: h.title,
      value: `observatie #${h.id} (${h.category}, ${h.severity})`,
      date: h.createdAt ? new Date(h.createdAt).toISOString().slice(0, 10) : vandaag,
    });
  }
  basedOn.push(...(input.extraBasedOn ?? []));
  if (basedOn.length === 0) {
    // Nooit een leeg dossier opvullen met verzinsels: benoem het gat expliciet
    // als eigen datapunt zodat het advies herleidbaar "op weinig" rust.
    basedOn.push({
      kind: "leemte",
      label: "geen dagmeting, training of herinnering beschikbaar",
      value: "advies rust alleen op profielgegevens in de context",
      date: vandaag,
    });
  }

  const meetniveau = sporen ? interneCode(sporen) : "onbekend (waarneming mislukt)";

  return createAdviceDossier({
    clerkId: input.clerkId,
    adviceType: input.adviceType,
    adviceKey: input.adviceKey,
    title: input.title,
    adviceText: input.adviceText,
    basedOn,
    sourcesUsed: ["training_sessions", "athlete_daily_metrics", "ai_observations"],
    sourcesExcluded: sporen
      ? []
      : [{ source: "meetniveau", reason: "waarneming mislukte op het moment van advies" }],
    rulesApplied: [
      "coach-dossier-v1:context-uit-bestaande-engines",
      "coach-dossier-v1:herinneringen-expliciet-vermeld",
      `coach-dossier-v1:meetniveau=${meetniveau}`,
      ...(input.extraRules ?? []),
    ],
    knowledgeRefs: input.knowledgeRefs ?? [],
    confidenceFactors: {
      meetniveau,
      herinneringen: herinneringen.length,
      dagmeting: !!checkin[0],
      adviesDigest: createHash("sha256").update(input.adviceText).digest("hex").slice(0, 16),
    },
    confidenceLevel: checkin[0] || laatsteSessie[0] ? "redelijk_zeker" : "voorzichtig",
    alternativesConsidered: input.alternativesConsidered,
    whyAlternativeRejected: input.whyAlternativeRejected,
    risks: input.risks ?? [
      { risk: "Taalmodel-formulering kan stelliger klinken dan de onderliggende data draagt." },
    ],
    computedBy: [{ engine: "coach-dossier", version: "v1" }, { engine: "buildAthleteContext" }],
    aiInvolvement: { used: true, purpose: input.aiPurpose },
  });
}
