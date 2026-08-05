// Herstel #608 (05-08-2026, opdracht René) — gerichte reparatie voor één
// sporter (Dylan): de trainerwaarde 345 W wordt vanaf 05-08-2026 weer de
// leidende FTP. De 272 W-importrij blijft bewaard als niet-leidende rij, de
// gemeten ondergrens (278 W) blijft zichtbaar als onderbouwing, en de
// belasting van de betrokken ritten wordt herrekend.
//
// Besluiten van René die hier vastliggen:
//   • 345 W blijft leidend maar is gemarkeerd als "niet bevestigd" — er is
//     nog geen FTP-test gedaan (die komt later als eigen functie).
//   • De verdachte rit van 08-07-2026 (±337 W gemiddeld over ±4 uur zonder
//     vermogensreeks) wordt NIET stil weggelaten maar gemarkeerd als
//     twijfelachtige data, met de reden erbij; hij telt niet meer mee voor
//     FTP-afleiding (filter in derived-load-backfill).
//
// Idempotent: elke stap controleert eerst de huidige toestand; een tweede run
// verandert niets meer. Draait vóór backfillDerivedLoad (zie index.ts) en is
// een no-op in omgevingen waar deze sporter niet bestaat (bijv. dev).
import { and, eq, gte, isNull, or, isNotNull, sql } from "drizzle-orm";
import {
  db,
  athleteProfilesTable,
  ftpHistoryTable,
  trainingSessionsTable,
} from "@workspace/db";
import { TWIJFELACHTIG_PREFIX } from "./derived-load";
import { logger } from "./logger";

const DYLAN_CLERK_ID = "user_3FgBt26EBxsHXxacIMIvOB1IYKn";
const TRAINER_FTP = 345;
const TRAINER_DATUM = "2026-08-05";
const HERREKEN_VANAF = "2026-08-01"; // datum waarop de foute 272 W binnenkwam
const TWIJFEL_DATUM = "2026-07-08";

export type RepairTrainerFtp345Result = {
  ran: boolean;
  rowsDemoted: number;
  trainerRowEnsured: boolean;
  profileRestored: boolean;
  doubtfulMarked: number;
  sessionsNulled: number;
};

export async function repairTrainerFtp345(
  // Alleen voor tests: dezelfde reparatie tegen een geseede testgebruiker.
  opts: { clerkId?: string } = {},
): Promise<RepairTrainerFtp345Result> {
  const CLERK_ID = opts.clerkId ?? DYLAN_CLERK_ID;
  const result: RepairTrainerFtp345Result = {
    ran: false,
    rowsDemoted: 0,
    trainerRowEnsured: false,
    profileRestored: false,
    doubtfulMarked: 0,
    sessionsNulled: 0,
  };

  const [profile] = await db
    .select({
      ftp: athleteProfilesTable.ftp,
      ftpEstimated: athleteProfilesTable.ftpEstimated,
    })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, CLERK_ID));
  if (!profile) return result; // sporter bestaat hier niet — eerlijk niets doen
  result.ran = true;

  // 1. Importrijen (o.a. de 272 W van Strava) mogen niet leidend zijn; ze
  //    blijven bewaard als niet-leidende historie.
  const demoted = await db
    .update(ftpHistoryTable)
    .set({ leidend: false })
    .where(
      and(
        eq(ftpHistoryTable.clerkId, CLERK_ID),
        eq(ftpHistoryTable.leidend, true),
        or(
          eq(ftpHistoryTable.bron, "import"),
          eq(ftpHistoryTable.testType, "strava"),
        ),
      ),
    )
    .returning({ id: ftpHistoryTable.id });
  result.rowsDemoted = demoted.length;

  // 2. Trainerwaarde 345 W per 05-08 als leidende rij — expliciet gemarkeerd
  //    als niet bevestigd, met de gemeten ondergrens als onderbouwing.
  const trainerNotes =
    "Trainerwaarde (ijking B8) — nog niet bevestigd met een FTP-test; gemeten ondergrens 278 W blijft als onderbouwing zichtbaar.";
  const [bestaandeTrainerRij] = await db
    .select({
      id: ftpHistoryTable.id,
      leidend: ftpHistoryTable.leidend,
      notes: ftpHistoryTable.notes,
    })
    .from(ftpHistoryTable)
    .where(
      and(
        eq(ftpHistoryTable.clerkId, CLERK_ID),
        eq(ftpHistoryTable.bron, "trainer"),
        eq(ftpHistoryTable.measuredAt, TRAINER_DATUM),
        eq(ftpHistoryTable.ftpWatts, TRAINER_FTP),
      ),
    );
  if (!bestaandeTrainerRij) {
    await db.insert(ftpHistoryTable).values({
      clerkId: CLERK_ID,
      measuredAt: TRAINER_DATUM,
      ftpWatts: TRAINER_FTP,
      testType: "manual",
      bron: "trainer",
      leidend: true,
      notes: trainerNotes,
    });
    result.trainerRowEnsured = true;
  } else if (!bestaandeTrainerRij.leidend) {
    await db
      .update(ftpHistoryTable)
      .set({ leidend: true })
      .where(eq(ftpHistoryTable.id, bestaandeTrainerRij.id));
    result.trainerRowEnsured = true;
  }

  // 3. Profiel-FTP terug op 345 — via het Sportpaspoort (herkomst-event in
  //    dezelfde transactie), nooit stil.
  if (profile.ftp !== TRAINER_FTP || profile.ftpEstimated) {
    const { applyValueChange } = await import("./passport");
    if (profile.ftp !== TRAINER_FTP) {
      await applyValueChange({
        clerkId: CLERK_ID,
        field: "ftp",
        newValue: String(TRAINER_FTP),
        origin: "handmatig",
        // Zelfde tekst als de historierij — applyValueChange ververst de
        // notes van de bestaande manual-rij met deze bron.
        source: trainerNotes,
        actorType: "coach",
        actorId: "herstel-608",
        measuredAt: TRAINER_DATUM,
        note: trainerNotes,
      });
    }
    await db
      .update(athleteProfilesTable)
      .set({ ftpEstimated: false, updatedAt: new Date() })
      .where(eq(athleteProfilesTable.clerkId, CLERK_ID));
    result.profileRestored = true;
  }

  // 4. Verdachte rit 08-07 markeren als twijfelachtige data — mét reden,
  //    nooit stil weglaten. Telt daarna niet meer mee voor FTP-afleiding.
  const twijfelReden = `${TWIJFELACHTIG_PREFIX} 337 W gemiddeld over ±4 uur zonder vermogensreeks of NP — fysiek onwaarschijnlijk, vermoedelijk foutieve vermogensdata van de bron. Telt niet mee voor FTP-afleiding.`;
  const marked = await db
    .update(trainingSessionsTable)
    .set({
      notes: sql`${twijfelReden} || CASE WHEN coalesce(${trainingSessionsTable.notes}, '') = '' THEN '' ELSE E'\n\n' || ${trainingSessionsTable.notes} END`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(trainingSessionsTable.clerkId, CLERK_ID),
        eq(trainingSessionsTable.sessionDate, TWIJFEL_DATUM),
        isNotNull(trainingSessionsTable.avgPower),
        gte(trainingSessionsTable.avgPower, 300),
        isNull(trainingSessionsTable.normalizedPower),
        gte(trainingSessionsTable.durationMin, 180),
        sql`coalesce(${trainingSessionsTable.notes}, '') NOT LIKE '[twijfelachtige data]%'`,
      ),
    )
    .returning({ id: trainingSessionsTable.id });
  result.doubtfulMarked = marked.length;

  // 5. Belasting herrekenen: scores van vermogensritten vanaf de datum van de
  //    foute 272 W wissen; backfillDerivedLoad (direct hierna in de bootketen)
  //    herleidt ze met de nu-leidende historie (345 vanaf 05-08).
  if (result.rowsDemoted > 0 || result.trainerRowEnsured || result.profileRestored) {
    const nulled = await db
      .update(trainingSessionsTable)
      .set({ tss: null, intensityFactor: null, updatedAt: new Date() })
      .where(
        and(
          eq(trainingSessionsTable.clerkId, CLERK_ID),
          gte(trainingSessionsTable.sessionDate, HERREKEN_VANAF),
          or(
            isNotNull(trainingSessionsTable.normalizedPower),
            isNotNull(trainingSessionsTable.avgPower),
          ),
        ),
      )
      .returning({ id: trainingSessionsTable.id });
    result.sessionsNulled = nulled.length;
  }

  logger.info({ herstel: "608", ...result }, "herstel-608 trainer-FTP 345 afgerond");
  return result;
}
