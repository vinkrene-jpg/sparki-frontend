// DATABRONNEN_EN_FTP_01 (05-08-2026) — H1: herstel van door een Strava-import
// overschreven FTP's.
//
// Wat er misging: de Strava-profielimport nam het FTP-veld uit het
// Strava-profiel over als leidende waarde. Bij minstens één sporter
// overschreef dat op 05-08-2026 een handmatig ingevoerde trainer-FTP
// (345 → 272 W). Belasting schaalt met het kwadraat van de FTP-verhouding:
// (345/272)² = 1,61 — elke nieuwe rit telde 61% te zwaar.
//
// Aanpak (generiek, alle sporters, idempotent):
//   1. Voor elke sporter met strava-rijen in ftp_history: bepaal per
//      strava-rij of hij volgens de D2-rangorde leidend had mogen zijn
//      (import verliest van elke leidende hogere bron op of vóór die datum).
//      Zo niet → leidend = false (blijft bewaard als niet-leidende rij, H1).
//   2. Is er iets gedemoveerd: zet de profiel-FTP terug op de waarde die
//      volgens de leidende historie vandaag geldt (via het Sportpaspoort,
//      met herkomst-event — nooit stil).
//   3. NULL de tss/intensity_factor van sessies vanaf de vroegste
//      gedemoveerde datum, zodat backfillDerivedLoad ze herleidt met de
//      juiste FTP-keten. De repair moet daarom VÓÓR backfillDerivedLoad
//      draaien (zie index.ts).
//   4. Rapporteer het aantal getroffen sporters/rijen (H1: "controleer of
//      dit bij meer sporters is gebeurd en rapporteer dat aantal").
//
// Idempotent: de leidend-vlag zelf is de marker — een tweede run vindt geen
// leidende strava-rijen meer die gedemoveerd moeten worden.

import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import {
  db,
  ftpHistoryTable,
  athleteProfilesTable,
  trainingSessionsTable,
} from "@workspace/db";
import { ftpAtDate, isFtpLeidend } from "./derived-load";
import { logger } from "./logger";

export type RepairStravaFtpResult = {
  usersAffected: number;
  rowsDemoted: number;
  profilesRestored: number;
  sessionsNulled: number;
};

export async function repairStravaFtpOverride(): Promise<RepairStravaFtpResult> {
  const result: RepairStravaFtpResult = {
    usersAffected: 0,
    rowsDemoted: 0,
    profilesRestored: 0,
    sessionsNulled: 0,
  };

  // Alle sporters met een nog-leidende strava-importrij.
  const candidates = await db
    .selectDistinct({ clerkId: ftpHistoryTable.clerkId })
    .from(ftpHistoryTable)
    .where(
      and(
        eq(ftpHistoryTable.testType, "strava"),
        eq(ftpHistoryTable.leidend, true),
      ),
    );

  for (const { clerkId } of candidates) {
    const rows = await db
      .select({
        id: ftpHistoryTable.id,
        measuredAt: ftpHistoryTable.measuredAt,
        ftpWatts: ftpHistoryTable.ftpWatts,
        testType: ftpHistoryTable.testType,
        bron: ftpHistoryTable.bron,
        leidend: ftpHistoryTable.leidend,
        notes: ftpHistoryTable.notes,
      })
      .from(ftpHistoryTable)
      .where(eq(ftpHistoryTable.clerkId, clerkId));

    // Rangorde-context: alle NIET-strava leidende rijen (achterhaalde
    // afgeleide rijen zijn al leidend=false via de migratie).
    const context = rows
      .filter((r) => r.testType !== "strava")
      .map((r) => ({
        bron: r.bron,
        measuredAt: r.measuredAt,
        leidend: r.leidend,
      }));

    const demote = rows.filter(
      (r) =>
        r.testType === "strava" &&
        r.leidend &&
        !isFtpLeidend("import", r.measuredAt, context),
    );
    if (demote.length === 0) continue;

    result.usersAffected += 1;
    let earliest = demote[0].measuredAt;
    for (const r of demote) {
      if (r.measuredAt < earliest) earliest = r.measuredAt;
      await db
        .update(ftpHistoryTable)
        .set({
          leidend: false,
          bron: "import",
          notes:
            (r.notes ? r.notes + " — " : "") +
            "[niet leidend] Strava-import mocht een hogere bron niet overschrijven (DATABRONNEN_EN_FTP_01 H1)",
        })
        .where(eq(ftpHistoryTable.id, r.id));
      result.rowsDemoted += 1;
    }

    // Profiel-FTP terugzetten op de leidende waarde van vandaag, als het
    // profiel nu de gedemoveerde importwaarde draagt.
    const leadingHistory = rows
      .filter(
        (r) =>
          r.leidend &&
          !demote.some((d) => d.id === r.id) &&
          !(
            r.testType === "derived" &&
            (r.notes ?? "").startsWith("[achterhaald]")
          ),
      )
      .map((r) => ({ measuredAt: r.measuredAt, ftpWatts: r.ftpWatts }));
    const today = new Date().toISOString().slice(0, 10);
    const correct = ftpAtDate(leadingHistory, today, null);
    const [profile] = await db
      .select({ ftp: athleteProfilesTable.ftp })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.clerkId, clerkId))
      .limit(1);
    if (
      correct != null &&
      profile &&
      profile.ftp !== correct &&
      demote.some((d) => d.ftpWatts === profile.ftp)
    ) {
      // Via het Sportpaspoort: waarde + herkomst-event in één transactie.
      const { applyValueChange } = await import("./passport");
      await applyValueChange({
        clerkId,
        field: "ftp",
        newValue: String(correct),
        origin: "handmatig",
        actorType: "engine",
        actorId: "repair-strava-ftp-override",
        note:
          "Systeemherstel: Strava-import had deze waarde niet mogen overschrijven (DATABRONNEN_EN_FTP_01 H1)",
      });
      result.profilesRestored += 1;
    }

    // Belasting herleiden voor alle sessies vanaf de vroegste demotiedatum.
    // Alleen sessies met eigen vermogensdata: die zijn (her)afleidbaar en
    // hun score kwam uit de FTP-keten. Een handmatig ingevoerde TSS zonder
    // vermogen blijft onaangeraakt.
    const nulled = await db
      .update(trainingSessionsTable)
      .set({ tss: null, intensityFactor: null, updatedAt: new Date() })
      .where(
        and(
          eq(trainingSessionsTable.clerkId, clerkId),
          gte(trainingSessionsTable.sessionDate, earliest),
          isNotNull(trainingSessionsTable.tss),
          sql`(${trainingSessionsTable.normalizedPower} IS NOT NULL OR ${trainingSessionsTable.avgPower} IS NOT NULL)`,
        ),
      )
      .returning({ id: trainingSessionsTable.id });
    result.sessionsNulled += nulled.length;
  }

  if (result.usersAffected > 0) {
    logger.warn(
      { repair: "strava-ftp-override", ...result },
      "FTP-herstel uitgevoerd: Strava-importrijen gedemoveerd naar niet-leidend",
    );
  }
  return result;
}
