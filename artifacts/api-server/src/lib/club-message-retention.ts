// SPARKI_BUILD_01 F7 — retentie van clubberichten, reacties en bijlagen.
//
// Besluit 1 augustus: berichten + reacties 1 jaar bewaren. De termijn is
// CONFIGUREERBAAR via env (CLUB_MESSAGE_RETENTION_DAYS, default 365) en NOOIT
// hardcoded. Bijlagen volgen het bericht: bij het opruimen van een bericht
// wordt het onderliggende file INGETROKKEN (revokedAt), zodat oude links direct
// dichtvallen — daarna verwijderen we het bericht (cascade ruimt reacties,
// gelezenstatus en attachment-rijen op).
//
// De opruimjob draait in het reminder-scheduler-patroon met advisory-lock /
// day-claim via withJobClaim (net als de bestaande jobs), zodat hij hooguit
// één keer per Amsterdamse dag draait, over alle instanties heen.

import { and, isNull, lt, inArray } from "drizzle-orm";
import {
  db,
  clubMessagesTable,
  messageAttachmentsTable,
  filesTable,
} from "@workspace/db";
import { logger } from "./logger";

export function clubMessageRetentionDays(): number {
  const raw = process.env.CLUB_MESSAGE_RETENTION_DAYS;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 365;
}

// Ruim alle berichten (en hun bijlagen) op die ouder zijn dan de bewaartermijn.
// Retourneert het aantal opgeruimde berichten en ingetrokken bestanden.
export async function runClubMessageRetention(
  now: Date = new Date(),
): Promise<{ messagesDeleted: number; filesRevoked: number }> {
  const days = clubMessageRetentionDays();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  // Oude berichten selecteren (ouder dan de bewaartermijn).
  const old = await db
    .select({ id: clubMessagesTable.id })
    .from(clubMessagesTable)
    .where(lt(clubMessagesTable.createdAt, cutoff));
  const messageIds = old.map((m) => m.id);
  if (messageIds.length === 0) {
    return { messagesDeleted: 0, filesRevoked: 0 };
  }

  // Alles in ÉÉN transactie: eerst uitsluitend de bestanden intrekken die via
  // message_attachments aan de te verwijderen berichten hangen, dan de
  // berichten verwijderen. NOOIT categorie-breed — bijlagen van nieuwere
  // berichten of ander gebruik blijven ongemoeid.
  const { filesRevoked } = await db.transaction(async (tx) => {
    const atts = await tx
      .select({ fileId: messageAttachmentsTable.fileId })
      .from(messageAttachmentsTable)
      .where(inArray(messageAttachmentsTable.messageId, messageIds));
    const fileIds = atts.map((a) => a.fileId).filter((v): v is number => v != null);
    let revoked = 0;
    if (fileIds.length > 0) {
      const rows = await tx
        .update(filesTable)
        .set({ revokedAt: now, revokedByClerkId: "system:retentie" })
        .where(and(inArray(filesTable.id, fileIds), isNull(filesTable.revokedAt)))
        .returning({ id: filesTable.id });
      revoked = rows.length;
    }
    // Berichten verwijderen (message_attachments + club_message_reads cascaden
    // via FK ON DELETE CASCADE).
    await tx.delete(clubMessagesTable).where(inArray(clubMessagesTable.id, messageIds));
    return { filesRevoked: revoked };
  });

  {
    logger.info(
      { clubMessageRetention: "job", days, messagesDeleted: messageIds.length, filesRevoked },
      "club message retention run done",
    );
  }
  return { messagesDeleted: messageIds.length, filesRevoked };
}
