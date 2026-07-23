// Mechanieker — fietsgebruik & activiteit↔fiets-koppeling.
//
// Kernprincipe: kilometerstanden en gebruiksuren worden NOOIT als teller
// bijgehouden, maar altijd live AFGELEID uit de gekoppelde activiteiten
// (training_sessions.bike_id). Daardoor is alles vanzelf idempotent:
// een dubbele import telt niet dubbel (de hub dedupliceert de sessie) en een
// verwijderde activiteit corrigeert de stand automatisch.
//
// Auto-koppeling (eerlijk, nooit gokken):
// 1. Strava-gear: de raw activiteit draagt `gear_id`; via equipment
//    (source=strava, external_id=gear_id) → garage_bikes.equipment_id.
// 2. Anders: alleen als de renner precies ÉÉN actieve fiets heeft.
// 3. Anders: niet koppelen — de gebruiker kiest zelf (handmatige correctie).
// Een handmatige keuze (bike_link_source = "handmatig") wordt nooit door de
// auto-koppeling overschreven — ook een handmatige ONTkoppeling niet.

import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import {
  db,
  trainingSessionsTable,
  connectorActivitiesTable,
  equipmentTable,
  garageBikesTable,
  garageComponentsTable,
  type GarageBike,
  type GarageComponent,
} from "@workspace/db";

export interface UsageTotals {
  km: number;
  hours: number;
  rides: number;
}

// Som van km/uren/ritten van alle sessies die aan deze fiets gekoppeld zijn,
// optioneel vanaf een datum (YYYY-MM-DD, bijv. montagedatum van een component).
export async function bikeUsageSince(
  clerkId: string,
  bikeId: number,
  sinceDate?: string | null,
): Promise<UsageTotals> {
  const conds = [
    eq(trainingSessionsTable.clerkId, clerkId),
    eq(trainingSessionsTable.bikeId, bikeId),
  ];
  if (sinceDate) conds.push(gte(trainingSessionsTable.sessionDate, sinceDate));
  const [row] = await db
    .select({
      km: sql<string>`coalesce(sum(${trainingSessionsTable.distanceKm}), 0)`,
      minutes: sql<string>`coalesce(sum(${trainingSessionsTable.durationMin}), 0)`,
      rides: sql<string>`count(*)`,
    })
    .from(trainingSessionsTable)
    .where(and(...conds));
  return {
    km: Math.round(Number(row?.km ?? 0) * 10) / 10,
    hours: Math.round((Number(row?.minutes ?? 0) / 60) * 10) / 10,
    rides: Number(row?.rides ?? 0),
  };
}

// Gebruik van één component: afgeleid vanaf de montagedatum (of, wanneer die
// onbekend is, vanaf de registratiedatum — dat wordt eerlijk zo benoemd).
export async function componentUsage(
  clerkId: string,
  component: Pick<GarageComponent, "bikeId" | "installedAt" | "createdAt">,
): Promise<UsageTotals & { basis: "montagedatum" | "registratiedatum" | "geen_fiets" }> {
  if (component.bikeId == null) {
    return { km: 0, hours: 0, rides: 0, basis: "geen_fiets" };
  }
  const since =
    component.installedAt ??
    component.createdAt.toISOString().slice(0, 10);
  const totals = await bikeUsageSince(clerkId, component.bikeId, since);
  return {
    ...totals,
    basis: component.installedAt ? "montagedatum" : "registratiedatum",
  };
}

// Auto-koppeling van nog niet gekoppelde fietsritten aan de juiste fiets.
// Retourneert hoeveel sessies gekoppeld werden (per methode). Veilig om
// herhaald aan te roepen (idempotent) — reeds gekoppelde of handmatig
// gekozen sessies worden nooit aangeraakt.
export async function autoLinkSessions(clerkId: string): Promise<{
  linkedByGear: number;
  linkedBySingleBike: number;
}> {
  const bikes = await db
    .select()
    .from(garageBikesTable)
    .where(eq(garageBikesTable.clerkId, clerkId));
  const activeBikes = bikes.filter((b) => b.status === "actief");
  if (bikes.length === 0) return { linkedByGear: 0, linkedBySingleBike: 0 };

  // Zelfherstel (idempotent): eerder automatisch gekoppelde ritten van VÓÓR de
  // registratiedatum van de fiets worden losgemaakt — die koppeling was een
  // aanname zonder bewijs en blies kilometerstanden op met historische ritten.
  // Ritten met écht bewijs (Strava gear_id) worden hieronder direct opnieuw
  // gekoppeld; handmatige keuzes worden nooit aangeraakt.
  for (const bike of bikes) {
    const regDate = bike.createdAt.toISOString().slice(0, 10);
    await db
      .update(trainingSessionsTable)
      .set({ bikeId: null, bikeLinkSource: null })
      .where(
        and(
          eq(trainingSessionsTable.clerkId, clerkId),
          eq(trainingSessionsTable.bikeId, bike.id),
          eq(trainingSessionsTable.bikeLinkSource, "auto"),
          sql`${trainingSessionsTable.sessionDate} < ${regDate}`,
        ),
      );
  }

  // gear_id (Strava) → bikeId, via equipment.external_id → bikes.equipment_id.
  const equipmentIds = bikes
    .map((b) => b.equipmentId)
    .filter((id): id is number => id != null);
  const gearToBike = new Map<string, number>();
  if (equipmentIds.length > 0) {
    const eqRows = await db
      .select({
        id: equipmentTable.id,
        externalId: equipmentTable.externalId,
      })
      .from(equipmentTable)
      .where(
        and(
          eq(equipmentTable.clerkId, clerkId),
          inArray(equipmentTable.id, equipmentIds),
        ),
      );
    for (const e of eqRows) {
      if (!e.externalId) continue;
      const bike = bikes.find((b) => b.equipmentId === e.id);
      if (bike) gearToBike.set(e.externalId, bike.id);
    }
  }

  // Alle nog niet gekoppelde fietsritten zonder handmatige keuze.
  const sessions = await db
    .select({
      id: trainingSessionsTable.id,
      sessionDate: trainingSessionsTable.sessionDate,
    })
    .from(trainingSessionsTable)
    .where(
      and(
        eq(trainingSessionsTable.clerkId, clerkId),
        eq(trainingSessionsTable.sport, "cycling"),
        isNull(trainingSessionsTable.bikeId),
        isNull(trainingSessionsTable.bikeLinkSource),
      ),
    );
  if (sessions.length === 0) return { linkedByGear: 0, linkedBySingleBike: 0 };
  const sessionIds = sessions.map((s) => s.id);

  // Strava gear_id per sessie uit de raw provenance-rij.
  const rawRows = await db
    .select({
      sessionId: connectorActivitiesTable.normalizedSessionId,
      gearId: sql<string | null>`${connectorActivitiesTable.raw} ->> 'gear_id'`,
    })
    .from(connectorActivitiesTable)
    .where(
      and(
        eq(connectorActivitiesTable.clerkId, clerkId),
        inArray(connectorActivitiesTable.normalizedSessionId, sessionIds),
      ),
    );
  const gearBySession = new Map<number, string>();
  for (const r of rawRows) {
    if (r.sessionId != null && r.gearId) gearBySession.set(r.sessionId, r.gearId);
  }

  let linkedByGear = 0;
  let linkedBySingleBike = 0;
  const singleActive: GarageBike | null =
    activeBikes.length === 1 ? activeBikes[0]! : null;
  // Eén-fiets-terugval geldt alleen voor ritten VANAF de registratiedatum van
  // die fiets: historische ritten (bijv. jaren oude Strava-import) zijn
  // aantoonbaar niet per se op deze fiets gereden. Zonder bewijs (gear_id)
  // blijven die eerlijk ongekoppeld — de gebruiker kan zelf koppelen.
  const singleActiveSince: string | null = singleActive
    ? singleActive.createdAt.toISOString().slice(0, 10)
    : null;

  for (const s of sessions) {
    const gearId = gearBySession.get(s.id);
    let bikeId: number | null = null;
    if (gearId && gearToBike.has(gearId)) {
      bikeId = gearToBike.get(gearId)!;
      linkedByGear++;
    } else if (
      singleActive &&
      singleActiveSince != null &&
      s.sessionDate >= singleActiveSince
    ) {
      bikeId = singleActive.id;
      linkedBySingleBike++;
    }
    if (bikeId != null) {
      await db
        .update(trainingSessionsTable)
        .set({ bikeId, bikeLinkSource: "auto" })
        .where(
          and(
            eq(trainingSessionsTable.id, s.id),
            eq(trainingSessionsTable.clerkId, clerkId),
            // Guard tegen race met een gelijktijdige handmatige keuze.
            isNull(trainingSessionsTable.bikeLinkSource),
          ),
        );
    }
  }
  return { linkedByGear, linkedBySingleBike };
}

// Ontkoppel alle sessies van een fiets (bij verwijderen van de fiets) — de
// activiteiten zelf blijven onaangetast bestaan.
export async function unlinkBikeSessions(
  clerkId: string,
  bikeId: number,
): Promise<void> {
  await db
    .update(trainingSessionsTable)
    .set({ bikeId: null, bikeLinkSource: null })
    .where(
      and(
        eq(trainingSessionsTable.clerkId, clerkId),
        eq(trainingSessionsTable.bikeId, bikeId),
      ),
    );
}

// Handmatige koppeling/correctie van één sessie. bikeId null = bewust "geen
// fiets" — ook dat is een handmatige keuze die auto-link respecteert.
export async function setSessionBike(
  clerkId: string,
  sessionId: number,
  bikeId: number | null,
): Promise<boolean> {
  if (bikeId != null) {
    const [bike] = await db
      .select({ id: garageBikesTable.id })
      .from(garageBikesTable)
      .where(
        and(
          eq(garageBikesTable.id, bikeId),
          eq(garageBikesTable.clerkId, clerkId),
        ),
      );
    if (!bike) return false;
  }
  const rows = await db
    .update(trainingSessionsTable)
    .set({ bikeId, bikeLinkSource: "handmatig" })
    .where(
      and(
        eq(trainingSessionsTable.id, sessionId),
        eq(trainingSessionsTable.clerkId, clerkId),
      ),
    )
    .returning({ id: trainingSessionsTable.id });
  return rows.length > 0;
}

// Volledig gebruiksoverzicht per fiets + per component (voor de garage-UI).
export async function garageUsageOverview(clerkId: string): Promise<
  Map<number, UsageTotals>
> {
  const rows = await db
    .select({
      bikeId: trainingSessionsTable.bikeId,
      km: sql<string>`coalesce(sum(${trainingSessionsTable.distanceKm}), 0)`,
      minutes: sql<string>`coalesce(sum(${trainingSessionsTable.durationMin}), 0)`,
      rides: sql<string>`count(*)`,
    })
    .from(trainingSessionsTable)
    .where(eq(trainingSessionsTable.clerkId, clerkId))
    .groupBy(trainingSessionsTable.bikeId);
  const map = new Map<number, UsageTotals>();
  for (const r of rows) {
    if (r.bikeId == null) continue;
    map.set(r.bikeId, {
      km: Math.round(Number(r.km) * 10) / 10,
      hours: Math.round((Number(r.minutes) / 60) * 10) / 10,
      rides: Number(r.rides),
    });
  }
  return map;
}

export type { GarageComponent };
