// SPARKI_BUILD_01 F7 — lijn 3b: zelfstandige trainer ↔ gekoppelde sporter.
//
// Dit valt BUITEN de club. Er wordt GEEN tweede berichtensysteem gebouwd: we
// hergebruiken exact dezelfde berichtenlaag (club_messages) met context
// "coach_link" en club_id NULL. De lijn loopt op coachClerkId/athleteClerkId
// via de bestaande coach_athlete_links.
//
// TWEE RICHTINGEN: zowel de trainer als de sporter mag sturen/reageren.
//
// JEUGDVEILIGHEID (hard, server-side, fail-closed):
// - Zonder ACTIEVE koppeling bestaat er geen gesprekspad ⇒ 403/404, nooit stil.
// - Bij een sporter <16 (of onbekende leeftijd = fail-closed als <16) leest de
//   gekoppelde ouder ALLE berichten volledig mee (leestoegang, geen kopie).
//
// Gelezenstatus per ontvanger (club_message_reads) en dezelfde bijlagelaag als
// de clubberichten (message_attachments + files).

import { Router } from "express";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  clubMessagesTable,
  clubMessageReadsTable,
  messageAttachmentsTable,
  filesTable,
} from "@workspace/db";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  hasActiveCoachLink,
  isMinorUser,
  linkedParentsOf,
} from "../lib/club-permissions";
import { registerFile, getFile, serveFile, revokeFile } from "../lib/files";
import { createNotification } from "../lib/notifications";

const router = Router();

function intParam(v: unknown): number | null {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

type AttachmentInput =
  | { kind: "link"; url: string; title: string | null }
  | { kind: "file"; base64: string; name: string };

function parseAttachments(raw: unknown): AttachmentInput[] | { error: string } {
  if (raw == null) return [];
  if (!Array.isArray(raw)) return { error: "Bijlagen moeten een lijst zijn." };
  const out: AttachmentInput[] = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") return { error: "Ongeldige bijlage." };
    const o = a as Record<string, unknown>;
    if (typeof o["url"] === "string" && o["url"].trim()) {
      const u = o["url"].trim();
      if (!/^https?:\/\//i.test(u)) return { error: "Een link moet met http(s):// beginnen." };
      out.push({ kind: "link", url: u, title: typeof o["title"] === "string" ? o["title"] : null });
    } else if (typeof o["base64"] === "string" && o["base64"].length > 0) {
      out.push({ kind: "file", base64: o["base64"], name: typeof o["name"] === "string" ? o["name"] : "bestand" });
    } else {
      return { error: "Een bijlage is een link of een bestand." };
    }
  }
  return out;
}

// Bepaal de rol van de caller binnen deze coach-link-conversatie (of null =
// geen toegang). Fail-closed: zonder actieve koppeling bestaat de conversatie
// niet voor deze caller.
async function resolveRole(
  caller: string,
  coachClerkId: string,
  athleteClerkId: string,
): Promise<"coach" | "athlete" | "parent" | null> {
  if (caller === coachClerkId) {
    return (await hasActiveCoachLink(coachClerkId, athleteClerkId)) ? "coach" : null;
  }
  if (caller === athleteClerkId) {
    return (await hasActiveCoachLink(coachClerkId, athleteClerkId)) ? "athlete" : null;
  }
  // Ouder-meeleestoegang bij een jeugdsporter <16.
  if (await isMinorUser(athleteClerkId)) {
    const parents = await linkedParentsOf(athleteClerkId);
    if (parents.includes(caller) && (await hasActiveCoachLink(coachClerkId, athleteClerkId))) {
      return "parent";
    }
  }
  return null;
}

// GET /api/coach-messages/:coachClerkId/:athleteClerkId — lees de conversatie.
router.get("/:coachClerkId/:athleteClerkId", requireAuth, async (req, res) => {
  try {
    const caller = getClerkUserId(req)!;
    const coachClerkId = String(req.params["coachClerkId"]);
    const athleteClerkId = String(req.params["athleteClerkId"]);
    const role = await resolveRole(caller, coachClerkId, athleteClerkId);
    if (!role) {
      res.status(403).json({ error: "Geen toegang tot dit gesprek." });
      return;
    }
    const messages = await db
      .select()
      .from(clubMessagesTable)
      .where(
        and(
          eq(clubMessagesTable.context, "coach_link"),
          eq(clubMessagesTable.coachClerkId, coachClerkId),
          eq(clubMessagesTable.athleteClerkId, athleteClerkId),
        ),
      )
      .orderBy(desc(clubMessagesTable.createdAt))
      .limit(200);

    const ids = messages.length > 0 ? messages.map((m) => m.id) : [-1];
    const reads = await db
      .select()
      .from(clubMessageReadsTable)
      .where(and(inArray(clubMessageReadsTable.messageId, ids), eq(clubMessageReadsTable.clerkId, caller)));
    const readSet = new Set(reads.map((r) => r.messageId));
    const attachments = await db
      .select()
      .from(messageAttachmentsTable)
      .where(inArray(messageAttachmentsTable.messageId, ids));
    const fileIds = attachments.map((a) => a.fileId).filter((v): v is number => v != null);
    const files = fileIds.length > 0 ? await db.select().from(filesTable).where(inArray(filesTable.id, fileIds)) : [];
    const fileById = new Map(files.map((f) => [f.id, f]));
    const attByMessage = new Map<number, unknown[]>();
    for (const a of attachments) {
      const f = a.fileId != null ? fileById.get(a.fileId) : null;
      const entry =
        a.kind === "link"
          ? { id: a.id, kind: "link", url: a.linkUrl, title: a.linkTitle }
          : {
              id: a.id,
              kind: a.kind,
              fileId: a.fileId,
              name: f?.originalName ?? null,
              contentType: f?.contentType ?? null,
              sizeBytes: f?.sizeBytes ?? null,
              revoked: f?.revokedAt != null,
              url: `/api/coach-messages/${coachClerkId}/${athleteClerkId}/attachments/${a.id}`,
            };
      const list = attByMessage.get(a.messageId) ?? [];
      list.push(entry);
      attByMessage.set(a.messageId, list);
    }
    res.json({
      role,
      parentReadsAlong: role === "parent" || (await isMinorUser(athleteClerkId)),
      messages: messages.map((m) => ({
        ...m,
        read: readSet.has(m.id),
        attachments: attByMessage.get(m.id) ?? [],
      })),
    });
  } catch (err) {
    req.log.error({ err }, "coach-messages list failed");
    res.status(500).json({ error: "Gesprek ophalen is niet gelukt." });
  }
});

// POST /api/coach-messages/:coachClerkId/:athleteClerkId — stuur een bericht.
// Twee richtingen: alleen de trainer of de sporter (NIET de ouder — die leest
// mee, stuurt niet in deze lijn).
router.post("/:coachClerkId/:athleteClerkId", requireAuth, async (req, res) => {
  try {
    const caller = getClerkUserId(req)!;
    const coachClerkId = String(req.params["coachClerkId"]);
    const athleteClerkId = String(req.params["athleteClerkId"]);
    const role = await resolveRole(caller, coachClerkId, athleteClerkId);
    if (!role || role === "parent") {
      // Geen koppeling ⇒ geen ongevraagd contact; ouder mag alleen meelezen.
      res.status(403).json({ error: "Je kunt in dit gesprek geen bericht sturen." });
      return;
    }
    const body = str(req.body?.body);
    const parsed = parseAttachments(req.body?.attachments);
    if ("error" in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    if (!body && parsed.length === 0) {
      res.status(400).json({ error: "Het bericht mag niet leeg zijn." });
      return;
    }
    const [msg] = await db
      .insert(clubMessagesTable)
      .values({
        clubId: null,
        context: "coach_link",
        scope: "coach_link",
        coachClerkId,
        athleteClerkId,
        authorClerkId: caller,
        body: body ?? "",
        allowReplies: true,
      })
      .returning();
    for (const a of parsed) {
      if (a.kind === "link") {
        await db.insert(messageAttachmentsTable).values({ messageId: msg!.id, kind: "link", linkUrl: a.url, linkTitle: a.title });
        continue;
      }
      const result = await registerFile({
        ownerClerkId: caller,
        base64: a.base64,
        originalName: a.name,
        retentionCategory: "club_message",
      });
      if (!result.ok) {
        await db.delete(clubMessagesTable).where(eq(clubMessagesTable.id, msg!.id));
        res.status(result.status).json({ error: result.reason });
        return;
      }
      await db.insert(messageAttachmentsTable).values({
        messageId: msg!.id,
        kind: result.file.contentType.startsWith("image/") ? "afbeelding" : "bestand",
        fileId: result.file.id,
      });
    }
    // Neutrale notificatie — nooit tekst/bestandsnaam. Naar de wederpartij, en
    // bij een jeugdsporter <16 ook naar de meelezende ouder(s).
    const recipients = new Set<string>();
    recipients.add(caller === coachClerkId ? athleteClerkId : coachClerkId);
    if (await isMinorUser(athleteClerkId)) {
      for (const p of await linkedParentsOf(athleteClerkId)) recipients.add(p);
    }
    recipients.delete(caller);
    for (const clerkId of recipients) {
      await createNotification({
        clerkId,
        type: "coach_update",
        title: "Nieuw bericht van je trainer",
        body: null,
        actionUrl: `/coach-messages/${coachClerkId}/${athleteClerkId}`,
        source: "coach",
        audience: clerkId === coachClerkId ? "coach" : clerkId === athleteClerkId ? "athlete" : "parent",
      }).catch(() => {});
    }
    res.status(201).json(msg);
  } catch (err) {
    req.log.error({ err }, "coach-messages post failed");
    res.status(500).json({ error: "Bericht sturen is niet gelukt." });
  }
});

// POST read — gelezenstatus per ontvanger (ook voor de meelezende ouder).
router.post("/:coachClerkId/:athleteClerkId/messages/:messageId/read", requireAuth, async (req, res) => {
  try {
    const caller = getClerkUserId(req)!;
    const coachClerkId = String(req.params["coachClerkId"]);
    const athleteClerkId = String(req.params["athleteClerkId"]);
    const role = await resolveRole(caller, coachClerkId, athleteClerkId);
    if (!role) {
      res.status(403).json({ error: "Geen toegang tot dit gesprek." });
      return;
    }
    const messageId = intParam(req.params["messageId"]);
    const [msg] = await db
      .select()
      .from(clubMessagesTable)
      .where(
        and(
          eq(clubMessagesTable.id, messageId ?? -1),
          eq(clubMessagesTable.context, "coach_link"),
          eq(clubMessagesTable.coachClerkId, coachClerkId),
          eq(clubMessagesTable.athleteClerkId, athleteClerkId),
        ),
      );
    if (!msg) {
      res.status(404).json({ error: "Bericht niet gevonden." });
      return;
    }
    await db
      .insert(clubMessageReadsTable)
      .values({ messageId: msg.id, clerkId: caller })
      .onConflictDoNothing();
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "coach-messages read failed");
    res.status(500).json({ error: "Gelezen-status opslaan is niet gelukt." });
  }
});

// GET attachment download — bericht-zichtbaarheid → file-toegang; ingetrokken
// ⇒ 410; altijd als download met nosniff.
router.get("/:coachClerkId/:athleteClerkId/attachments/:attachmentId", requireAuth, async (req, res) => {
  try {
    const caller = getClerkUserId(req)!;
    const coachClerkId = String(req.params["coachClerkId"]);
    const athleteClerkId = String(req.params["athleteClerkId"]);
    const attachmentId = intParam(req.params["attachmentId"]);
    const role = await resolveRole(caller, coachClerkId, athleteClerkId);
    if (!role) {
      res.status(403).json({ error: "Geen toegang tot deze bijlage." });
      return;
    }
    const [att] = await db
      .select()
      .from(messageAttachmentsTable)
      .innerJoin(clubMessagesTable, eq(clubMessagesTable.id, messageAttachmentsTable.messageId))
      .where(
        and(
          eq(messageAttachmentsTable.id, attachmentId ?? -1),
          eq(clubMessagesTable.context, "coach_link"),
          eq(clubMessagesTable.coachClerkId, coachClerkId),
          eq(clubMessagesTable.athleteClerkId, athleteClerkId),
        ),
      );
    if (!att || att.message_attachments.fileId == null) {
      res.status(404).json({ error: "Bijlage niet gevonden." });
      return;
    }
    const file = await getFile(att.message_attachments.fileId);
    if (!file) {
      res.status(404).json({ error: "Bestand niet gevonden." });
      return;
    }
    const served = await serveFile(file);
    if (!served.ok) {
      res.status(served.status).json({ error: served.reason });
      return;
    }
    res.setHeader("Content-Type", served.contentType);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `attachment; filename="${served.downloadName.replace(/"/g, "")}"`);
    res.setHeader("Cache-Control", "private, max-age=0, no-store");
    served.stream.pipe(res);
  } catch (err) {
    req.log.error({ err }, "coach-messages attachment serve failed");
    res.status(500).json({ error: "Bijlage ophalen is niet gelukt." });
  }
});

// POST revoke attachment — alleen de auteur van het bericht.
router.post("/:coachClerkId/:athleteClerkId/attachments/:attachmentId/revoke", requireAuth, async (req, res) => {
  try {
    const caller = getClerkUserId(req)!;
    const coachClerkId = String(req.params["coachClerkId"]);
    const athleteClerkId = String(req.params["athleteClerkId"]);
    const attachmentId = intParam(req.params["attachmentId"]);
    const role = await resolveRole(caller, coachClerkId, athleteClerkId);
    if (!role || role === "parent") {
      res.status(403).json({ error: "Geen toegang." });
      return;
    }
    const [row] = await db
      .select()
      .from(messageAttachmentsTable)
      .innerJoin(clubMessagesTable, eq(clubMessagesTable.id, messageAttachmentsTable.messageId))
      .where(
        and(
          eq(messageAttachmentsTable.id, attachmentId ?? -1),
          eq(clubMessagesTable.context, "coach_link"),
          eq(clubMessagesTable.coachClerkId, coachClerkId),
          eq(clubMessagesTable.athleteClerkId, athleteClerkId),
        ),
      );
    if (!row || row.message_attachments.fileId == null) {
      res.status(404).json({ error: "Bijlage niet gevonden." });
      return;
    }
    if (row.club_messages.authorClerkId !== caller) {
      res.status(403).json({ error: "Alleen de afzender kan een bijlage intrekken." });
      return;
    }
    await revokeFile(row.message_attachments.fileId, caller);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "coach-messages attachment revoke failed");
    res.status(500).json({ error: "Bijlage intrekken is niet gelukt." });
  }
});

export default router;
