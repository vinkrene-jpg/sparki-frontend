import { Router, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  db,
  trainingSessionsTable,
  inputAttachmentKinds,
  type InputAttachment,
  type InputAttachmentKind,
} from "@workspace/db";
import { getConversation, postMessage } from "../engines/input-center";
import { buildSessionContextBlock } from "../lib/ride-story";

// Sparki Input Center routes.
//
// GET  /api/input-center/conversation — the athlete's persisted conversation.
// POST /api/input-center/messages     — athlete sends text / link / attachments;
//                                       Sparki replies; both turns are persisted.
//
// Uploads themselves go through /api/storage/uploads/request-url (presigned PUT
// straight to object storage). Here we only receive the already-stored object
// paths plus metadata, then ground Sparki's reply on the real bytes.

const router = Router();

const kindSet = new Set<string>(inputAttachmentKinds);

// Validates and normalizes the attachment metadata coming from the client.
// Drops anything missing an object path. Never trusts client-supplied paths to
// be readable — the engine re-checks ownership before downloading bytes.
function parseAttachments(raw: unknown): InputAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: InputAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const a = item as Record<string, unknown>;
    const objectPath = typeof a.objectPath === "string" ? a.objectPath : "";
    const name = typeof a.name === "string" ? a.name : "";
    const contentType =
      typeof a.contentType === "string" ? a.contentType : "application/octet-stream";
    if (!objectPath.startsWith("/objects/") || !name) continue;
    const sizeRaw = a.size;
    const size =
      typeof sizeRaw === "number" && Number.isFinite(sizeRaw) ? sizeRaw : null;
    const kind: InputAttachmentKind = kindSet.has(String(a.kind))
      ? (a.kind as InputAttachmentKind)
      : contentType.startsWith("image/")
        ? "image"
        : contentType === "application/pdf"
          ? "pdf"
          : "file";
    out.push({ objectPath, name, contentType, size, kind });
  }
  return out;
}

router.get(
  "/input-center/conversation",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req)!;
    try {
      const turns = await getConversation(clerkId);
      res.json({ turns });
    } catch (err) {
      req.log.error({ err }, "input-center.conversation failed");
      res.status(500).json({ error: "Gesprek ophalen mislukt" });
    }
  },
);

router.post(
  "/input-center/messages",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req)!;
    const body = req.body as {
      text?: unknown;
      link?: unknown;
      attachments?: unknown;
      context?: unknown;
    };
    const text = typeof body.text === "string" ? body.text : null;
    const link = typeof body.link === "string" ? body.link : null;
    const attachments = parseAttachments(body.attachments);

    // Optional ride context: { kind: "session", sessionId }. Ownership is
    // verified HERE — an unknown or not-owned session is a hard 400, never a
    // silently-dropped context (the athlete sees a visible context chip and
    // must be able to trust that Sparki really got that ride).
    let contextBlock: string | null = null;
    if (body.context !== undefined && body.context !== null) {
      const ctx = body.context as { kind?: unknown; sessionId?: unknown };
      const sessionId = Number(ctx.sessionId);
      if (ctx.kind !== "session" || !Number.isInteger(sessionId)) {
        res.status(400).json({ error: "Ongeldige gesprekscontext" });
        return;
      }
      const [session] = await db
        .select()
        .from(trainingSessionsTable)
        .where(
          and(
            eq(trainingSessionsTable.id, sessionId),
            eq(trainingSessionsTable.clerkId, clerkId),
          ),
        )
        .limit(1);
      if (!session) {
        res.status(400).json({ error: "Deze rit is niet gevonden" });
        return;
      }
      contextBlock = buildSessionContextBlock(session);
    }

    const hasContent =
      (text && text.trim().length > 0) ||
      (link && link.trim().length > 0) ||
      attachments.length > 0;
    if (!hasContent) {
      res
        .status(400)
        .json({ error: "Stuur een vraag, een link of een bestand mee" });
      return;
    }

    try {
      const result = await postMessage({
        clerkId,
        text,
        link,
        attachments,
        contextBlock,
      });
      res.json(result);
    } catch (err) {
      req.log.error({ err }, "input-center.messages failed");
      res.status(500).json({ error: "Er kon geen antwoord gegeven worden. Probeer het opnieuw." });
    }
  },
);

export default router;
