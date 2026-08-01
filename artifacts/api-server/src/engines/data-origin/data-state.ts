// Zeven toestanden, niet één lege doos — DATA_TRUST_01 §4.
//
// Eén server-side bepaling van de datatoestand per domein, afgeleid uit wat
// er al is: rijaantallen, sync_runs en connector_connections. De frontend
// classificeert nooit zelf; rechtenproblemen (403) en technische fouten (5xx)
// blijven HTTP-statussen die de interface apart benoemt.

import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  connectorConnectionsTable,
  plannedWorkoutsTable,
  syncRunsTable,
  trainingSessionsTable,
} from "@workspace/db";

export type DataStateKind =
  | "ok"
  | "geen_data"
  | "onvoldoende_data"
  | "verouderd"
  | "sync_bezig"
  | "providerfout";

export interface DataState {
  domein: string;
  toestand: DataStateKind;
  /** NL-melding die de interface één-op-één mag tonen. */
  melding: string | null;
  /** Wat de gebruiker kan doen. */
  actie: string | null;
  aantal: number;
  laatsteSync: string | null;
}

// Het domein "kalender" is gebruikersgepland (geen provider-gevoede bron):
// sync_bezig / providerfout / verouderd zijn daar bewust niet van toepassing.
export const DATA_STATE_DOMEINEN = ["sessies", "kalender", "belasting"] as const;
export type DataStateDomein = (typeof DATA_STATE_DOMEINEN)[number];

const STALE_DAGEN = 7;

async function syncInfo(clerkId: string): Promise<{
  bezig: boolean;
  laatsteOk: Date | null;
  laatsteFout: boolean;
  heeftKoppeling: boolean;
}> {
  const [conn] = await db
    .select({ id: connectorConnectionsTable.id })
    .from(connectorConnectionsTable)
    .where(
      and(
        eq(connectorConnectionsTable.clerkId, clerkId),
        eq(connectorConnectionsTable.status, "connected"),
      ),
    )
    .limit(1);
  const [running] = await db
    .select({ id: syncRunsTable.id })
    .from(syncRunsTable)
    .where(
      and(
        eq(syncRunsTable.clerkId, clerkId),
        eq(syncRunsTable.status, "running"),
      ),
    )
    .limit(1);
  const [laatste] = await db
    .select({
      status: syncRunsTable.status,
      finishedAt: syncRunsTable.finishedAt,
    })
    .from(syncRunsTable)
    .where(eq(syncRunsTable.clerkId, clerkId))
    .orderBy(desc(syncRunsTable.startedAt))
    .limit(1);
  const [laatsteSucces] = await db
    .select({ finishedAt: syncRunsTable.finishedAt })
    .from(syncRunsTable)
    .where(
      and(
        eq(syncRunsTable.clerkId, clerkId),
        eq(syncRunsTable.status, "success"),
      ),
    )
    .orderBy(desc(syncRunsTable.startedAt))
    .limit(1);
  return {
    bezig: Boolean(running),
    laatsteOk: laatsteSucces?.finishedAt ?? null,
    laatsteFout: laatste?.status === "error",
    heeftKoppeling: Boolean(conn),
  };
}

function dagenGeleden(d: Date): number {
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

/**
 * Bepaal de toestand voor één domein. Volgorde is bindend:
 * sync_bezig > providerfout > geen_data > onvoldoende_data > verouderd > ok.
 */
export async function bepaalDataState(
  clerkId: string,
  domein: DataStateDomein,
): Promise<DataState> {
  let aantal = 0;
  if (domein === "kalender") {
    const [r] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(plannedWorkoutsTable)
      .where(eq(plannedWorkoutsTable.clerkId, clerkId));
    aantal = r?.n ?? 0;
  } else {
    const [r] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(trainingSessionsTable)
      .where(eq(trainingSessionsTable.clerkId, clerkId));
    aantal = r?.n ?? 0;
  }

  const sync = await syncInfo(clerkId);
  const laatsteSync = sync.laatsteOk ? sync.laatsteOk.toISOString() : null;
  const basis = { domein, aantal, laatsteSync };

  if (domein !== "kalender" && sync.bezig) {
    return {
      ...basis,
      toestand: "sync_bezig",
      melding: "Bezig met ophalen van je activiteiten.",
      actie: "Even geduld — dit scherm ververst vanzelf.",
    };
  }
  if (domein !== "kalender" && sync.laatsteFout) {
    return {
      ...basis,
      toestand: "providerfout",
      melding:
        aantal > 0
          ? "De laatste synchronisatie is mislukt — je ziet mogelijk niet je nieuwste activiteiten."
          : "De koppeling is tijdelijk niet bereikbaar.",
      actie: "Controleer je koppeling bij Instellingen → Koppelingen of probeer later opnieuw.",
    };
  }
  if (aantal === 0) {
    return {
      ...basis,
      toestand: "geen_data",
      melding:
        domein === "kalender"
          ? "Nog geen geplande trainingen."
          : "Nog geen activiteiten gesynchroniseerd of ingevoerd.",
      actie:
        domein === "kalender"
          ? "Plan een training of laat een weekplan maken."
          : sync.heeftKoppeling
            ? "Start een synchronisatie of voeg een activiteit handmatig toe."
            : "Koppel Strava/Garmin of voeg een activiteit handmatig toe.",
    };
  }
  if (domein === "belasting" && aantal < 3) {
    return {
      ...basis,
      toestand: "onvoldoende_data",
      melding: "Nog onvoldoende activiteiten voor een betrouwbare trend.",
      actie: "Na een paar extra geregistreerde ritten verschijnt hier je belastingstrend.",
    };
  }
  if (
    domein !== "kalender" &&
    sync.heeftKoppeling &&
    sync.laatsteOk &&
    dagenGeleden(sync.laatsteOk) > STALE_DAGEN
  ) {
    return {
      ...basis,
      toestand: "verouderd",
      melding: `Laatste synchronisatie was ${dagenGeleden(sync.laatsteOk)} dagen geleden.`,
      actie: "Start een synchronisatie om je gegevens bij te werken.",
    };
  }
  return { ...basis, toestand: "ok", melding: null, actie: null };
}
