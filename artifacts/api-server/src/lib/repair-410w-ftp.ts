// One-time idempotent repair: harmoniseer de 410W-FTP-rij van de tweede
// productiegebruiker met het standaard [achterhaald]-markeringsformaat.
//
// Achtergrond (docs/evidence/TSS_410W_AUDIT_2026-07-29.md):
//   ftp_history id 8 (410 W, derived, 2026-05-25) had notes die begonnen met
//   "ACHTERHAALD — …" in plaats van "[achterhaald] …". Het `[achterhaald]%`-
//   filter in derived-load-backfill.ts sloeg die rij daardoor NIET over, waardoor
//   alle 182 belastingscores van die gebruiker vóór 26 juni met 410 W werden
//   afgeleid (onderschat: totaal 8 786 TSS i.p.v. ~19 955).
//
// Aanpak:
//   1. Idempotentiecheck: als de rij al '[achterhaald]%' heeft → skip (al gerepareerd).
//   2. Transactie:
//      a. Prefix notes met '[achterhaald] ' (originele tekst blijft).
//      b. NULL de tss + intensity_factor van alle getroffen sessies, zodat
//         backfillDerivedLoad ze herleidt met de juiste FTP-keten (272 W).
//   3. Geen profiel-FTP of andere data aangeraakt; cross-user: niets.
//
// De repair moet VÓÓR backfillDerivedLoad voltooid zijn (zie index.ts);
// de backfill doet de feitelijke herberekening (tss IS NULL → afleiden).
// Samen zijn ze idempotent.

import { eq, sql, and, lt, isNotNull } from "drizzle-orm";
import { db, ftpHistoryTable, trainingSessionsTable } from "@workspace/db";

// Volledige identiteitsguards — NIET alleen het numerieke id, zodat de repair
// ook correct werkt als rijen in een andere omgeving een ander auto-increment
// id hebben gekregen.
const AFFECTED_CLERK_ID = "user_3FgBt26EBxsHXxacIMIvOB1IYKn";
const AFFECTED_MEASURED_AT = "2026-05-25";
const AFFECTED_FTP_WATTS = 410;
const AFFECTED_TEST_TYPE = "derived";

// Sessies vóór deze datum zijn afgeleid met de foutieve 410 W-FTP.
// Sessies op of na deze datum gebruikten al de Strava-import (272 W, id 2).
const CUTOFF_DATE = "2026-06-26";

export type Repair410wResult = {
  /** true als de repair daadwerkelijk uitgevoerd is; false als al gedaan. */
  applied: boolean;
  sessionsNulled: number;
};

/**
 * Harmoniseer de 410W-FTP-rij en null de getroffen belastingscores.
 * Idempotent: een tweede run is een veilige no-op.
 * Gooit nooit — fouten worden teruggegeven in het resultaat.
 */
export async function repair410wFtp(): Promise<Repair410wResult> {
  // Idempotentiecheck buiten de transactie — goedkoop en voorkomt onnodige locks.
  const [row] = await db
    .select({ id: ftpHistoryTable.id, notes: ftpHistoryTable.notes })
    .from(ftpHistoryTable)
    .where(
      and(
        eq(ftpHistoryTable.clerkId, AFFECTED_CLERK_ID),
        eq(ftpHistoryTable.measuredAt, AFFECTED_MEASURED_AT),
        eq(ftpHistoryTable.ftpWatts, AFFECTED_FTP_WATTS),
        eq(ftpHistoryTable.testType, AFFECTED_TEST_TYPE),
      ),
    )
    .limit(1);

  if (!row) {
    // Rij bestaat niet in deze omgeving (dev zonder de productierij) — skip.
    return { applied: false, sessionsNulled: 0 };
  }

  const notes = row.notes ?? "";
  if (notes.startsWith("[achterhaald]")) {
    // Al geharmoniseerd door een eerdere run.
    return { applied: false, sessionsNulled: 0 };
  }

  // Atomaire repair: prefix + NULL in één transactie.
  let sessionsNulled = 0;
  await db.transaction(async (tx) => {
    // 1. Harmoniseer het markeringsformaat — enkel de rij die aan alle vier
    //    identiteitsguards voldoet. Een extra NOT LIKE-guard voorkomt dat een
    //    concurrent proces een al gemarkeerde rij nogmaals prefixeert.
    await tx
      .update(ftpHistoryTable)
      .set({
        notes: sql`'[achterhaald] ' || coalesce(${ftpHistoryTable.notes}, '')`,
      })
      .where(
        and(
          eq(ftpHistoryTable.clerkId, AFFECTED_CLERK_ID),
          eq(ftpHistoryTable.measuredAt, AFFECTED_MEASURED_AT),
          eq(ftpHistoryTable.ftpWatts, AFFECTED_FTP_WATTS),
          eq(ftpHistoryTable.testType, AFFECTED_TEST_TYPE),
          sql`coalesce(${ftpHistoryTable.notes}, '') NOT LIKE '[achterhaald]%'`,
        ),
      );

    // 2. NULL de belastingscores zodat backfillDerivedLoad ze herleidt.
    const updated = await tx
      .update(trainingSessionsTable)
      .set({
        tss: null,
        intensityFactor: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(trainingSessionsTable.clerkId, AFFECTED_CLERK_ID),
          lt(trainingSessionsTable.sessionDate, CUTOFF_DATE),
          isNotNull(trainingSessionsTable.tss),
        ),
      )
      .returning({ id: trainingSessionsTable.id });

    sessionsNulled = updated.length;
  });

  return { applied: true, sessionsNulled };
}
