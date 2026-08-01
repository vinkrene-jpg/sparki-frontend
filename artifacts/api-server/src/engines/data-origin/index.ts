// Data Origin Service — centrale herleidbaarheid van waarden en conclusies.
//
// Eén dienst die voor elke waarde kan zeggen: waar komt die vandaan, wanneer
// ontvangen/verwerkt, van wie, via welke synchronisatie, hoe betrouwbaar en
// welke versie. Bouwt UITSLUITEND op bestaande herkomstvelden (training_sessions
// source/sources/fieldSources/manualFields/mergeLog/externalRef, sync_runs,
// activity_imports, ai_observations engine/signals/missingData) en registreert
// persistente berekende waarden aanvullend in `computation_traces`.
// Geen mockdata, geen fallback: wat niet herleidbaar is heet expliciet
// "Onvoldoende gegevens beschikbaar."

import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  db,
  computationTracesTable,
  trainingSessionsTable,
  activityImportsTable,
  syncRunsTable,
  aiObservationsTable,
  type ComputationInputRef,
  type NewComputationTrace,
} from "@workspace/db";
import { logger } from "../../lib/logger";
import {
  classifyValue,
  klasseMeta,
  type DataTrustClass,
  type KlasseMeta,
} from "./classification";

export * from "./classification";

export const ONVOLDOENDE = "Onvoldoende gegevens beschikbaar.";

/** Nederlandse bronlabels zoals de gebruiker ze kent. */
const BRON_LABELS: Record<string, string> = {
  manual: "handmatig",
  strava: "Strava",
  garmin: "Garmin",
  wahoo: "Wahoo",
  file: "bestand (GPX/FIT/TCX)",
  gpx: "GPX-bestand",
  fit: "FIT-bestand",
  tcx: "TCX-bestand",
  sensor: "sensor",
  mobiel: "Sparki mobiel",
  sparki: "Sparki-berekening",
  coach: "coach",
  derived: "berekening",
};

export function bronLabel(source: string | null | undefined): string {
  if (!source) return ONVOLDOENDE;
  return BRON_LABELS[source] ?? source;
}

/** Herkomst-metadata die sportdata-API's additief meesturen. */
export interface OriginMeta {
  bron: string;
  bronnen: string[];
  ontvangen: string | null;
  verwerkt: string | null;
  gebruiker: string;
  apparaat: string | null;
  synchronisatieId: number | null;
  betrouwbaarheid: "gemeten" | "afgeleid" | "geschat" | "handmatig";
  versie: string;
  veldBronnen: Record<string, string> | null;
  handmatigeVelden: string[] | null;
  conflicten: number;
  /** Centrale data-trust-classificatie (DATA_TRUST_01) — additief. */
  klasse: DataTrustClass;
}

type SessionRow = typeof trainingSessionsTable.$inferSelect;

/**
 * Pure opbouw van herkomst-metadata voor één trainingssessie, uitsluitend uit
 * de velden die de Data Hub al vastlegt. `syncRunId`/`apparaat` komen uit de
 * gekoppelde import/syncrun als die er is (anders eerlijk null).
 */
export function sessionOrigin(
  session: SessionRow,
  extra?: { syncRunId?: number | null; apparaat?: string | null },
): OriginMeta {
  const sources = Array.isArray(session.sources) ? session.sources : [];
  const mergeLog = Array.isArray(session.mergeLog) ? session.mergeLog : [];
  const manual = session.source === "manual";
  return {
    bron: bronLabel(session.source),
    bronnen: (sources.length > 0 ? sources : [session.source]).map(bronLabel),
    ontvangen: session.createdAt ? session.createdAt.toISOString() : null,
    verwerkt: session.updatedAt
      ? session.updatedAt.toISOString()
      : session.createdAt
        ? session.createdAt.toISOString()
        : null,
    gebruiker: session.clerkId,
    apparaat: extra?.apparaat ?? null,
    synchronisatieId: extra?.syncRunId ?? null,
    betrouwbaarheid: manual ? "handmatig" : "gemeten",
    versie: "1",
    veldBronnen: session.fieldSources ?? null,
    handmatigeVelden: session.manualFields ?? null,
    conflicten: mergeLog.length,
    klasse: classifyValue({
      ownerClerkId: session.clerkId,
      source: session.source,
    }),
  };
}

/** Registreer één persistente berekende waarde. Best-effort mag hier NIET —
 * de aanroeper bepaalt of de registratie in dezelfde transactie hoort. */
export async function recordComputation(
  trace: Omit<NewComputationTrace, "id" | "createdAt" | "computedAt"> & {
    computedAt?: Date;
  },
  tx: Pick<typeof db, "insert"> = db,
): Promise<void> {
  await tx.insert(computationTracesTable).values({
    ...trace,
    computedAt: trace.computedAt ?? new Date(),
  });
}

export async function latestComputation(
  clerkId: string,
  subjectType: string,
  subjectId?: string,
) {
  const where = subjectId
    ? and(
        eq(computationTracesTable.clerkId, clerkId),
        eq(computationTracesTable.subjectType, subjectType),
        eq(computationTracesTable.subjectId, subjectId),
      )
    : and(
        eq(computationTracesTable.clerkId, clerkId),
        eq(computationTracesTable.subjectType, subjectType),
      );
  const [row] = await db
    .select()
    .from(computationTracesTable)
    .where(where)
    .orderBy(desc(computationTracesTable.computedAt))
    .limit(1);
  return row ?? null;
}

// ── Explain-payloads ─────────────────────────────────────────────────────────

export interface ExplainPayload {
  onderwerp: string;
  /** Gebruikte gegevens: echte bronverwijzingen of expliciet "onvoldoende". */
  gebruikteGegevens: Array<{
    label: string;
    bron: string;
    detail?: string | null;
  }>;
  berekeningen: Array<{
    engine: string;
    versie: string;
    parameters: Record<string, unknown> | null;
  }>;
  ai: { gebruikt: boolean; toelichting: string };
  betrouwbaarheid: string;
  ontbrekend: string[];
  melding: string | null; // ONVOLDOENDE wanneer er niets herleidbaars is
  /** Centrale data-trust-classificatie (DATA_TRUST_01) — additief. */
  trust: KlasseMeta;
}

/** Uitleg voor één sessie (owner-scoped door de aanroepende route). */
export async function explainSession(
  clerkId: string,
  sessionId: number,
): Promise<ExplainPayload | null> {
  const [session] = await db
    .select()
    .from(trainingSessionsTable)
    .where(
      and(
        eq(trainingSessionsTable.id, sessionId),
        eq(trainingSessionsTable.clerkId, clerkId),
      ),
    )
    .limit(1);
  if (!session) return null;

  const [imp] = await db
    .select({
      id: activityImportsTable.id,
      fileName: activityImportsTable.fileName,
      fileType: activityImportsTable.fileType,
      uploadedAt: activityImportsTable.uploadedAt,
    })
    .from(activityImportsTable)
    .where(
      and(
        eq(activityImportsTable.linkedTrainingSessionId, session.id),
        eq(activityImportsTable.clerkId, clerkId),
      ),
    )
    .limit(1);

  const gegevens: ExplainPayload["gebruikteGegevens"] = [];
  const veldBronnen = session.fieldSources ?? {};
  for (const [veld, bron] of Object.entries(veldBronnen)) {
    gegevens.push({ label: veld, bron: bronLabel(bron) });
  }
  if (gegevens.length === 0) {
    gegevens.push({
      label: "volledige sessie",
      bron: bronLabel(session.source),
      detail: session.externalRef ?? null,
    });
  }
  if (imp) {
    gegevens.push({
      label: "bronbestand",
      bron: bronLabel(imp.fileType ?? "file"),
      detail: imp.fileName ?? null,
    });
  }

  // Berekende velden op deze sessie (bv. afgeleide belastingscore).
  const traces = await db
    .select()
    .from(computationTracesTable)
    .where(
      and(
        eq(computationTracesTable.clerkId, clerkId),
        eq(computationTracesTable.subjectType, "derived_tss"),
        eq(computationTracesTable.subjectId, String(session.id)),
      ),
    )
    .orderBy(desc(computationTracesTable.computedAt))
    .limit(3);

  return {
    onderwerp: `Sessie ${session.sessionDate} (${session.sport})`,
    gebruikteGegevens: gegevens,
    berekeningen: traces.map((t) => ({
      engine: t.engine,
      versie: t.engineVersion,
      parameters: t.parameters ?? null,
    })),
    ai: {
      gebruikt: false,
      toelichting: "Sessiegegevens zijn gemeten of handmatig — geen taalmodel betrokken.",
    },
    betrouwbaarheid: session.source === "manual" ? "handmatig" : "gemeten",
    ontbrekend: [],
    melding: null,
    trust: klasseMeta({
      ownerClerkId: session.clerkId,
      source: session.source,
    }),
  };
}

/** Uitleg voor één analyse/conclusie (ai_observations). */
export async function explainObservation(
  clerkId: string,
  observationId: number,
): Promise<ExplainPayload | null> {
  const [obs] = await db
    .select()
    .from(aiObservationsTable)
    .where(
      and(
        eq(aiObservationsTable.id, observationId),
        eq(aiObservationsTable.clerkId, clerkId),
      ),
    )
    .limit(1);
  if (!obs) return null;

  const signals = Array.isArray(obs.signals) ? obs.signals : [];
  const missing = Array.isArray(obs.missingData) ? obs.missingData : [];
  const gegevens = signals.map((s) => ({
    label: s.label,
    bron: "eigen gegevens",
    detail:
      s.value !== undefined && s.value !== null
        ? `${s.value}${s.date ? ` (${s.date})` : ""}`
        : (s.date ?? null),
  }));

  const heeftVerantwoording =
    gegevens.length > 0 || obs.engine || obs.confidenceScore;

  return {
    onderwerp: obs.title ?? "Analyse",
    gebruikteGegevens: gegevens,
    berekeningen: obs.engine
      ? [
          {
            engine: obs.engine + (obs.ruleKey ? ` · regel ${obs.ruleKey}` : ""),
            versie: obs.engineVersion ?? "1",
            parameters: null,
          },
        ]
      : [],
    ai: {
      gebruikt: true,
      toelichting:
        "De cijfers en drempels komen uit deterministische regels; een taalmodel verwoordde alleen de conclusie.",
    },
    betrouwbaarheid: obs.confidenceScore
      ? `${Math.round(Number(obs.confidenceScore) * 100)}% zeker (${obs.confidence})`
      : obs.confidence,
    ontbrekend: missing,
    melding: heeftVerantwoording ? null : ONVOLDOENDE,
    trust: klasseMeta({
      ownerClerkId: obs.clerkId,
      source: heeftVerantwoording ? "derived" : null,
      hasComputationTrace: Boolean(heeftVerantwoording),
    }),
  };
}

/** Uitleg voor de nieuwste persistente berekening van een type. */
export async function explainComputation(
  clerkId: string,
  subjectType: string,
  subjectId?: string,
): Promise<ExplainPayload | null> {
  const trace = await latestComputation(clerkId, subjectType, subjectId);
  if (!trace) return null;
  const inputs = Array.isArray(trace.inputs) ? trace.inputs : [];
  return {
    onderwerp: subjectType,
    gebruikteGegevens: inputs.map((i: ComputationInputRef) => ({
      label: i.veld ? `${i.tabel}.${i.veld}` : i.tabel,
      bron: bronLabel(i.bron),
      detail: i.periode ?? (i.recordId != null ? `record ${i.recordId}` : null),
    })),
    berekeningen: [
      {
        engine: trace.engine,
        versie: trace.engineVersion,
        parameters: trace.parameters ?? null,
      },
    ],
    ai: {
      gebruikt: trace.aiUsed === "ja",
      toelichting:
        trace.aiUsed === "ja"
          ? "Een taalmodel verwoordde de uitkomst; de berekening zelf is deterministisch."
          : "Volledig deterministisch berekend — geen taalmodel betrokken.",
    },
    betrouwbaarheid: trace.reliability,
    ontbrekend: [],
    melding: inputs.length === 0 ? ONVOLDOENDE : null,
    trust: klasseMeta({
      ownerClerkId: trace.clerkId,
      source: "derived",
      hasComputationTrace: inputs.length > 0,
      estimated: trace.reliability === "geschat",
    }),
  };
}

/** Vind de syncrun-koppeling voor een sessie (voor synchronisatie-ID in meta). */
export async function findSessionSyncRun(
  clerkId: string,
  provider: string | null,
  sessionCreatedAt?: Date | null,
): Promise<number | null> {
  // Eerlijkheidscontract: alleen een sync-ID teruggeven als de koppeling
  // exact bewijsbaar is. Zonder tijdstip van aanmaak is er geen bewijs — dan
  // liever null dan een gok (de "nieuwste run" kan van een andere import zijn).
  if (!provider || provider === "manual" || !sessionCreatedAt) return null;
  try {
    // De sessie hoort bij een run als haar aanmaakmoment binnen precies één
    // run van deze provider valt (started_at .. finished_at, met een kleine
    // marge voor commit-volgorde). Nul of meerdere kandidaten ⇒ null.
    const runs = await db
      .select({ id: syncRunsTable.id })
      .from(syncRunsTable)
      .where(
        and(
          eq(syncRunsTable.clerkId, clerkId),
          eq(syncRunsTable.provider, provider),
          lte(syncRunsTable.startedAt, sessionCreatedAt),
          gte(
            sql`coalesce(${syncRunsTable.finishedAt}, ${syncRunsTable.startedAt} + interval '15 minutes')`,
            sessionCreatedAt,
          ),
        ),
      )
      .limit(2);
    return runs.length === 1 ? (runs[0]?.id ?? null) : null;
  } catch (err) {
    logger.warn({ err }, "data-origin.findSessionSyncRun failed");
    return null;
  }
}
