// DATABRONNEN_EN_FTP_01 — historische stream-backfill voor Strava (#609).
// Eerder geïmporteerde activiteiten misten reeksen (watts/heartrate/cadence/
// altitude/time). Deze backfill haalt ze met terugwerkende kracht op, in
// PORTIES binnen de Strava-aanroeplimiet, en meldt de voortgang eerlijk in het
// logboek. Nieuwste ritten eerst — die zijn voor analyse het meest waard.
//
// Per opgehaalde activiteit:
//   • connector_activities.streams gevuld (grafieken + sessie-detail-terugval);
//   • gekoppelde sessie: eigen Coggan-NP (bron "sparki"), power bests en
//     HR-samenvatting alleen waar die ontbraken;
//   • belastingscore (TSS/IF) gewist en direct opnieuw afgeleid met de
//     leidende FTP-historie — nooit een oude score op nieuwe reeksen.
import { and, desc, eq, isNull, isNotNull, sql } from "drizzle-orm";
import {
  db,
  connectorActivitiesTable,
  trainingSessionsTable,
} from "@workspace/db";

export type StreamBackfillResult = {
  attempted: number;
  fetched: number;
  updatedSessions: number;
  remaining: number;
  stoppedByRateLimit: boolean;
  /** false = scores gewist maar herafleiding faalde — zichtbaar, niet stil. */
  tssRederived: boolean;
};

/** Porties: max. stream-calls per backfillronde — losstaand van het budget van
 * de live sync-verrijking, samen ruim binnen de gemeten Strava-limiet. */
const BACKFILL_CALL_BUDGET = 25;

export async function backfillStravaStreamsForUser(
  clerkId: string,
  opts: { budget?: number } = {},
): Promise<StreamBackfillResult> {
  const budget = Math.max(1, Math.min(opts.budget ?? BACKFILL_CALL_BUDGET, 100));

  // Eerlijke voortgang: de restteller telt de VOLLEDIGE achterstand, niet
  // alleen de portie van deze ronde.
  const pendingWhere = and(
    eq(connectorActivitiesTable.clerkId, clerkId),
    eq(connectorActivitiesTable.provider, "strava"),
    isNull(connectorActivitiesTable.streams),
    isNotNull(connectorActivitiesTable.externalActivityId),
  );
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(connectorActivitiesTable)
    .where(pendingWhere);

  // Kandidaten voor deze portie: nieuwste eerst.
  const candidates = await db
    .select({
      id: connectorActivitiesTable.id,
      externalId: connectorActivitiesTable.externalActivityId,
      sessionId: connectorActivitiesTable.normalizedSessionId,
    })
    .from(connectorActivitiesTable)
    .where(pendingWhere)
    .orderBy(desc(connectorActivitiesTable.startedAt))
    .limit(budget);

  const result: StreamBackfillResult = {
    attempted: 0,
    fetched: 0,
    updatedSessions: 0,
    remaining: total ?? candidates.length,
    stoppedByRateLimit: false,
    tssRederived: true,
  };
  if (candidates.length === 0) return result;

  const { getValidStravaAccessToken } = await import(
    "./connectors/providers/strava-oauth"
  );
  const { fetchStravaStreamEnrichment } = await import(
    "./connectors/providers/strava"
  );
  const accessToken = await getValidStravaAccessToken(clerkId);

  const touchedSessions: number[] = [];
  for (const cand of candidates) {
    if (result.attempted >= budget) break;
    result.attempted++;
    let enrichment = null;
    try {
      enrichment = await fetchStravaStreamEnrichment(
        accessToken,
        cand.externalId!,
      );
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 429) {
        // Aanroeplimiet bereikt — eerlijk stoppen; de volgende sync gaat verder.
        result.stoppedByRateLimit = true;
        break;
      }
      continue; // deze activiteit overslaan, rest van de portie doorzetten
    }
    result.remaining--;
    if (!enrichment) {
      // Geen reeksen bij de bron (handmatig gelogd/verwijderd). Markeer als
      // afgehandeld met een expliciet leeg-maar-echt antwoord zodat we deze
      // rit niet elke ronde opnieuw opvragen.
      await db
        .update(connectorActivitiesTable)
        .set({ streams: { none: true } as object })
        .where(eq(connectorActivitiesTable.id, cand.id));
      continue;
    }
    result.fetched++;

    await db
      .update(connectorActivitiesTable)
      .set({ streams: enrichment.streams as object })
      .where(eq(connectorActivitiesTable.id, cand.id));

    if (cand.sessionId == null) continue;
    const [session] = await db
      .select({
        id: trainingSessionsTable.id,
        avgHR: trainingSessionsTable.avgHR,
        maxHR: trainingSessionsTable.maxHR,
        powerBests: trainingSessionsTable.powerBests,
        fieldSources: trainingSessionsTable.fieldSources,
      })
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.id, cand.sessionId),
          eq(trainingSessionsTable.clerkId, clerkId),
        ),
      );
    if (!session) continue;

    const patch: Record<string, unknown> = {};
    const fieldSources: Record<string, string> = {
      ...(session.fieldSources ?? {}),
    };
    if (enrichment.normalizedPower != null) {
      patch.normalizedPower = enrichment.normalizedPower;
      fieldSources.normalizedPower = "sparki"; // eigen Coggan-berekening (D5)
      // Score hoort bij de reeks: wissen en hieronder opnieuw afleiden.
      patch.tss = null;
      patch.intensityFactor = null;
    }
    if (enrichment.powerBests && session.powerBests == null)
      patch.powerBests = enrichment.powerBests;
    if (enrichment.avgHR != null && session.avgHR == null)
      patch.avgHR = enrichment.avgHR;
    if (enrichment.maxHR != null && session.maxHR == null)
      patch.maxHR = enrichment.maxHR;
    if (Object.keys(patch).length === 0) continue;
    patch.fieldSources = fieldSources;
    patch.updatedAt = new Date();

    await db
      .update(trainingSessionsTable)
      .set(patch)
      .where(eq(trainingSessionsTable.id, session.id));
    touchedSessions.push(session.id);
    result.updatedSessions++;
  }

  // Gewiste scores direct opnieuw afleiden met de leidende FTP-historie.
  // Faalt dat, dan is dat ZICHTBAAR in het resultaat/logboek (nooit stil):
  // de scores staan dan op null tot de volgende backfill-/bootronde ze vult.
  if (touchedSessions.length > 0) {
    try {
      const { backfillTssForAthlete } = await import("./derived-load-backfill");
      await backfillTssForAthlete(clerkId);
    } catch (err) {
      result.tssRederived = false;
      console.warn(
        `[data-hub] streams-backfill: herafleiding belastingscore faalde (${touchedSessions.length} sessies wachten op de volgende ronde): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return result;
}

/** Eén regel eerlijke voortgang voor het logboek. */
export function beschrijfBackfill(r: StreamBackfillResult): string {
  let basis = `streams-backfill: ${r.fetched} reeksen opgehaald (${r.attempted} geprobeerd), ${r.updatedSessions} sessies bijgewerkt, ${r.remaining} activiteiten resterend`;
  if (r.stoppedByRateLimit)
    basis += " — gestopt op de Strava-aanroeplimiet, volgende sync gaat verder";
  if (!r.tssRederived)
    basis +=
      " — LET OP: belastingscores nog niet herafgeleid (volgende ronde probeert opnieuw)";
  return basis;
}
