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

import { and, eq, isNull, lt, inArray } from "drizzle-orm";
import {
  db,
  clubMessagesTable,
  messageAttachmentsTable,
  filesTable,
} from "@workspace/db";
import { revokeFilesForRetention } from "./files";
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

  // Oude berichten selecteren.
  const old = await db
    .select({ id: clubMessagesTable.id })
    .from(clubMessagesTable)
    .where(lt(clubMessagesTable.createdAt, cutoff));
  const messageIds = old.map((m) => m.id);

  let filesRevoked = 0;
  if (messageIds.length > 0) {
    // Bijbehorende files intrekken (fail-closed) vóór verwijderen — bijlagen
    // volgen het bericht.
    const atts = await db
      .select({ fileId: messageAttachmentsTable.fileId })
      .from(messageAttachmentsTable)
      .where(inArray(messageAttachmentsTable.messageId, messageIds));
    const fileIds = atts.map((a) => a.fileId).filter((v): v is number => v != null);
    if (fileIds.length > 0) {
      const revoked = await db
        .update(filesTable)
        .set({ revokedAt: now, revokedByClerkId: "system:retentie" })
        .where(and(inArray(filesTable.id, fileIds), isNull(filesTable.revokedAt)))
        .returning({ id: filesTable.id });
      filesRevoked = revoked.length;
    }
    // Berichten verwijderen (cascade: reacties via parentId niet — die staan als
    // aparte rijen met eigen createdAt en worden bij hun eigen leeftijd
    // opgeruimd; message_attachments + club_message_reads cascaden wel).
    await db.delete(clubMessagesTable).where(inArray(clubMessagesTable.id, messageIds));
  }

  // Vangnet: trek ook losse "club_message"-bestanden in die de termijn
  // gepasseerd zijn maar (door welke reden dan ook) geen bericht meer hebben.
  filesRevoked += await revokeFilesForRetention("club_message", cutoff);

  if (messageIds.length > 0 || filesRevoked > 0) {
    logger.info(
      { clubMessageRetention: "job", days, messagesDeleted: messageIds.length, filesRevoked },
      "club message retention run done",
    );
  }
  return { messagesDeleted: messageIds.length, filesRevoked };
}
