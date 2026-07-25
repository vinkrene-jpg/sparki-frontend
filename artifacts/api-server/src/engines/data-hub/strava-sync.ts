// Sparki Data Hub — Strava-synchronisatiestrategie (webhook-eerst).
//
// Uitgangspunt: webhooks zijn het primaire kanaal. Iedere nieuwe of gewijzigde
// activiteit komt binnen als gerichte push-melding en wordt direct, gericht
// opgehaald (alleen die ene activiteit). Daarom draait er GEEN zware volledige
// sync bij iedere app-opening of login — dat zou dubbel werk en onnodige
// rate-limit-druk zijn.
//
// Bewuste actualiteitsgrens: tussen twee momenten kan de weergave maximaal zo
// oud zijn als STALE_SYNC_HOURS wanneer webhooks (nog) niet zijn geregistreerd
// of gemist zijn. De inhaalsync hieronder dicht dat gat: bij het openen van de
// koppelingenlijst wordt — alléén wanneer de laatste sync verouderd of mislukt
// is — op de achtergrond een begrensde, hervatbare inhaalsync gestart die
// uitsluitend activiteiten ná het laatste succesvolle syncmoment ophaalt
// (met overlap). Herhaald draaien is veilig: de centrale dedupe maakt dubbele
// verwerking onschadelijk, dus een afgebroken inhaalsync hervat gewoon bij de
// volgende poging zonder duplicaten.

import { and, desc, eq } from "drizzle-orm";
import {
  db,
  connectorConnectionsTable,
  syncRunsTable,
  type ConnectorConnection,
} from "@workspace/db";
import { runSync, HubError } from "./index";

/** Ouder dan dit = verouderd; de inhaalsync komt in actie. */
export const STALE_SYNC_HOURS = 24;

// Minimale wachttijd tussen twee inhaalpogingen. Zonder deze rem zou tijdens
// een Strava-storing (of bij een kapot token dat nog "connected" staat) elke
// app-opening opnieuw een poging vuren en het gedeelde rate-limit opeten.
export const RETRY_COOLDOWN_MIN = 15;

// Overlap bij het bepalen van het "vanaf"-moment: klokverschil, vertraagde
// webhooks en een sync die midden in een upload viel worden zo opgevangen.
// Dedupe maakt de overlap onschadelijk.
const CATCH_UP_OVERLAP_SEC = 48 * 3600;

// Zonder eerder syncmoment kijken we begrensd terug (geen volledige historie —
// daarvoor bestaat de expliciete backfill-knop).
const CATCH_UP_DEFAULT_LOOKBACK_SEC = 30 * 86_400;

export interface CatchUpDecision {
  catchUp: boolean;
  reason:
    | "geen_koppeling"
    | "niet_verbonden"
    | "geen_token"
    | "nooit_gesynct"
    | "verouderd"
    | "vorige_sync_mislukt"
    | "recent_geprobeerd"
    | "actueel";
}

/**
 * Pure beslisregel: is een inhaalsync nodig? Alleen voor een echt verbonden
 * koppeling mét token, wanneer er nooit is gesynct, de laatste sync ouder is
 * dan STALE_SYNC_HOURS, of de laatst afgeronde run mislukte. Als er minder dan
 * RETRY_COOLDOWN_MIN minuten geleden al een poging is gestart, wachten we
 * eerst af (rem tegen herhaald vuren tijdens een storing).
 */
export function shouldCatchUp(
  row: Pick<ConnectorConnection, "status" | "accessToken" | "lastSyncAt"> | null,
  lastRunStatus: string | null,
  now: Date = new Date(),
  lastRunStartedAt: Date | null = null,
): CatchUpDecision {
  if (!row) return { catchUp: false, reason: "geen_koppeling" };
  if (row.status !== "connected")
    return { catchUp: false, reason: "niet_verbonden" };
  if (!row.accessToken) return { catchUp: false, reason: "geen_token" };
  const coolingDown =
    lastRunStartedAt != null &&
    now.getTime() - new Date(lastRunStartedAt).getTime() <
      RETRY_COOLDOWN_MIN * 60_000;
  if (!row.lastSyncAt) {
    if (coolingDown) return { catchUp: false, reason: "recent_geprobeerd" };
    return { catchUp: true, reason: "nooit_gesynct" };
  }
  const ageMs = now.getTime() - new Date(row.lastSyncAt).getTime();
  if (ageMs > STALE_SYNC_HOURS * 3_600_000) {
    if (coolingDown) return { catchUp: false, reason: "recent_geprobeerd" };
    return { catchUp: true, reason: "verouderd" };
  }
  if (lastRunStatus === "failed") {
    if (coolingDown) return { catchUp: false, reason: "recent_geprobeerd" };
    return { catchUp: true, reason: "vorige_sync_mislukt" };
  }
  return { catchUp: false, reason: "actueel" };
}

/** "Vanaf"-moment (unix-seconden) voor de inhaalsync, met overlap. */
export function computeCatchUpAfterEpochSec(
  lastSyncAt: Date | null,
  now: Date = new Date(),
): number {
  if (lastSyncAt) {
    return Math.max(
      0,
      Math.floor(new Date(lastSyncAt).getTime() / 1000) - CATCH_UP_OVERLAP_SEC,
    );
  }
  return Math.max(
    0,
    Math.floor(now.getTime() / 1000) - CATCH_UP_DEFAULT_LOOKBACK_SEC,
  );
}

// In-process wacht: per gebruiker maximaal één inhaalsync tegelijk vanaf dit
// proces. De runSync-"busy"-wacht dekt de database-kant af.
const inFlight = new Set<string>();

/**
 * Kijk of een Strava-inhaalsync nodig is en start die dan op de achtergrond
 * (fire-and-forget). Nooit blokkerend voor de aanroepende request; fouten
 * worden in de sync-run zelf eerlijk gelogd. Retourneert de beslissing zodat
 * aanroepers (en tests) kunnen zien wat er gebeurde.
 */
export async function maybeScheduleStravaCatchUp(
  clerkId: string,
  log?: { info: (o: unknown, m: string) => void; warn: (o: unknown, m: string) => void },
): Promise<CatchUpDecision & { scheduled: boolean }> {
  const [row] = await db
    .select()
    .from(connectorConnectionsTable)
    .where(
      and(
        eq(connectorConnectionsTable.clerkId, clerkId),
        eq(connectorConnectionsTable.provider, "strava"),
      ),
    )
    .limit(1);

  const [lastFinishedRun] = await db
    .select({ status: syncRunsTable.status, startedAt: syncRunsTable.startedAt })
    .from(syncRunsTable)
    .where(
      and(
        eq(syncRunsTable.clerkId, clerkId),
        eq(syncRunsTable.provider, "strava"),
      ),
    )
    .orderBy(desc(syncRunsTable.startedAt))
    .limit(1);

  const decision = shouldCatchUp(
    row ?? null,
    lastFinishedRun?.status ?? null,
    new Date(),
    lastFinishedRun?.startedAt ?? null,
  );
  if (!decision.catchUp) return { ...decision, scheduled: false };
  if (inFlight.has(clerkId)) return { ...decision, scheduled: false };

  const afterEpochSec = computeCatchUpAfterEpochSec(row?.lastSyncAt ?? null);
  inFlight.add(clerkId);
  void runSync(clerkId, "strava", "scheduled", { afterEpochSec })
    .then(() => {
      log?.info({ clerkId, afterEpochSec }, "strava.catchup completed");
    })
    .catch((err: unknown) => {
      // "busy" = er loopt al een sync (geen probleem); andere fouten staan
      // eerlijk in de sync-run + verbindingsstatus.
      if (!(err instanceof HubError && err.code === "busy")) {
        log?.warn({ err, clerkId }, "strava.catchup failed");
      }
    })
    .finally(() => {
      inFlight.delete(clerkId);
    });
  return { ...decision, scheduled: true };
}
