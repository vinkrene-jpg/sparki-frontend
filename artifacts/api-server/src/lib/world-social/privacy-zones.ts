// Privacyzones van een eigenaar (taak #513) — de ENIGE bron voor elke
// gedeelde of getoonde weergave van andermans route of rit. Het huisadres uit
// het profiel telt altijd impliciet mee (750 m); daarnaast tellen alle door de
// gebruiker beheerde zones (woning/werk/gevoelig, eigen straal). Lege lijst =
// niets bekend; applyLocationPrivacy valt dan fail-closed terug op
// start/einde verbergen.

import { db, athleteProfilesTable, privacyZonesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { PrivacyZoneCircle } from "./location";

export const HOME_ZONE_RADIUS_M = 750;

export async function loadOwnerPrivacyZones(
  clerkId: string,
): Promise<PrivacyZoneCircle[]> {
  const [profiles, rows] = await Promise.all([
    db
      .select({
        homeLat: athleteProfilesTable.homeLat,
        homeLon: athleteProfilesTable.homeLon,
      })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId))
      .limit(1),
    db
      .select({
        lat: privacyZonesTable.lat,
        lon: privacyZonesTable.lon,
        radiusM: privacyZonesTable.radiusM,
      })
      .from(privacyZonesTable)
      .where(eq(privacyZonesTable.clerkId, clerkId)),
  ]);
  const zones: PrivacyZoneCircle[] = rows.map((r) => ({
    lat: Number(r.lat),
    lon: Number(r.lon),
    radiusM: Number(r.radiusM),
  }));
  const p = profiles[0];
  if (p?.homeLat != null && p?.homeLon != null) {
    zones.push({
      lat: Number(p.homeLat),
      lon: Number(p.homeLon),
      radiusM: HOME_ZONE_RADIUS_M,
    });
  }
  return zones;
}
