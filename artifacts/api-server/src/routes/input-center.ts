import { Router, type Request, type Response } from "express";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  inputAttachmentKinds,
  type InputAttachment,
  type InputAttachmentKind,
} from "@workspace/db";
import { getConversation, postMessage } from "../engines/input-center";

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
    };
    const text = typeof body.text === "string" ? body.text : null;
    const link = typeof body.link === "string" ? body.link : null;
    const attachments = parseAttachments(body.attachments);

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
      const result = await postMessage({ clerkId, text, link, attachments });
      res.json(result);
    } catch (err) {
      req.log.error({ err }, "input-center.messages failed");
      res.status(500).json({ error: "Sparki kon niet antwoorden. Probeer het opnieuw." });
    }
  },
);

export default router;
