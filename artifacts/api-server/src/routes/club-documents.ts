// HERSTEL_EN_AANVULLING_01 F6 (HA-26/HA-27) — clubdocumenten.
// Gemount onder /api/clubs/:clubId/documents (routes/index.ts).
//
// Bindend:
// • Alleen opslaan en tonen — geen workflows, geen versiebeheer.
// • Alleen clubbeheer plaatst en verwijdert; hoofdtrainer/trainers niet.
// • Documenten hangen aan de club, niet aan een persoon; elk actief clublid
//   kan ze lezen.
// • Bestaande bestandenlaag (object storage, presign→PUT→ACL) — geen aparte
//   bibliotheek per module; bytes nooit in de DB.

import { Router } from "express";
import { db, clubDocumentsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { getClubContext, canManageClub } from "../lib/club-permissions";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const router = Router({ mergeParams: true });
const svc = new ObjectStorageService();

const CATEGORIEEN = ["gedragscode", "ouderafspraken", "reglement", "overig"] as const;
const MAX_BYTES = 15 * 1024 * 1024; // 15 MB — documenten, geen media-archief.
const TOEGESTANE_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
]);

function intParam(v: unknown): number | null {
  const n = typeof v === "string" ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : null;
}

async function ctxVoor(req: import("express").Request, res: import("express").Response) {
  const clubId = intParam(req.params["clubId"]);
  if (clubId == null) {
    res.status(400).json({ error: "Ongeldige club." });
    return null;
  }
  const ctx = await getClubContext(clubId, getClerkUserId(req)!);
  if (!ctx) {
    res.status(403).json({ error: "Je bent geen actief lid van deze club." });
    return null;
  }
  return ctx;
}

// Lijst — elk actief clublid.
router.get("/", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxVoor(req, res);
    if (!ctx) return;
    const docs = await db
      .select({
        id: clubDocumentsTable.id,
        title: clubDocumentsTable.title,
        category: clubDocumentsTable.category,
        mediaType: clubDocumentsTable.mediaType,
        sizeBytes: clubDocumentsTable.sizeBytes,
        createdAt: clubDocumentsTable.createdAt,
      })
      .from(clubDocumentsTable)
      .where(eq(clubDocumentsTable.clubId, ctx.club.id))
      .orderBy(desc(clubDocumentsTable.createdAt));
    res.json({ documents: docs, magPlaatsen: canManageClub(ctx) });
  } catch (err) {
    req.log.error({ err }, "clubdocumenten lijst faalde");
    res.status(500).json({ error: "Documenten ophalen is niet gelukt." });
  }
});

// Plaatsen — alleen clubbeheer (HA-27). Bytes als base64 door de bestaande
// opslaglaag; ACL pas ná de PUT (Input Center-regel).
router.post("/", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxVoor(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen clubbeheer plaatst documenten." });
      return;
    }
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const category = typeof req.body?.category === "string" ? req.body.category : "overig";
    const base64 = typeof req.body?.base64 === "string" ? req.body.base64 : "";
    const mediaType = typeof req.body?.mediaType === "string" ? req.body.mediaType : "";
    if (!title || !base64 || !(CATEGORIEEN as readonly string[]).includes(category)) {
      res.status(400).json({ error: "Titel, categorie en bestand zijn verplicht." });
      return;
    }
    if (!TOEGESTANE_TYPES.has(mediaType)) {
      res.status(400).json({ error: "Dit bestandstype wordt niet ondersteund (PDF, tekst, Word, PNG of JPEG)." });
      return;
    }
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length === 0 || buffer.length > MAX_BYTES) {
      res.status(400).json({ error: "Het bestand is leeg of groter dan 15 MB." });
      return;
    }
    const uploadUrl = await svc.getObjectEntityUploadURL();
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": mediaType },
      body: buffer,
      signal: AbortSignal.timeout(30_000),
    });
    if (!put.ok) {
      res.status(502).json({ error: "Opslag van het bestand is niet gelukt." });
      return;
    }
    const objectPath = await svc.trySetObjectEntityAclPolicy(uploadUrl, {
      owner: ctx.membership.clerkId,
      visibility: "private",
    });
    const [row] = await db
      .insert(clubDocumentsTable)
      .values({
        clubId: ctx.club.id,
        title,
        category,
        objectPath,
        mediaType,
        sizeBytes: buffer.length,
        uploadedByClerkId: ctx.membership.clerkId,
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "clubdocument plaatsen faalde");
    res.status(500).json({ error: "Document plaatsen is niet gelukt." });
  }
});

// Downloaden/bekijken — elk actief clublid; toegang loopt via de club-check,
// daarna streamen we het object (de rij zelf is het toegangsbewijs).
router.get("/:documentId/download", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxVoor(req, res);
    if (!ctx) return;
    const documentId = intParam(req.params["documentId"]);
    const [doc] = await db
      .select()
      .from(clubDocumentsTable)
      .where(and(eq(clubDocumentsTable.id, documentId ?? -1), eq(clubDocumentsTable.clubId, ctx.club.id)));
    if (!doc) {
      res.status(404).json({ error: "Document niet gevonden." });
      return;
    }
    const file = await svc.getObjectEntityFile(doc.objectPath);
    const [metadata] = await file.getMetadata();
    res.setHeader("Content-Type", doc.mediaType);
    if (metadata.size) res.setHeader("Content-Length", String(metadata.size));
    res.setHeader("Content-Disposition", `inline; filename="${doc.title.replace(/[^\w. -]+/g, "_")}"`);
    res.setHeader("Cache-Control", "private, max-age=3600");
    file.createReadStream().pipe(res);
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Het bestand bestaat niet meer in de opslag." });
      return;
    }
    req.log.error({ err }, "clubdocument download faalde");
    res.status(500).json({ error: "Document openen is niet gelukt." });
  }
});

// Verwijderen — alleen clubbeheer.
router.delete("/:documentId", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxVoor(req, res);
    if (!ctx) return;
    if (!canManageClub(ctx)) {
      res.status(403).json({ error: "Alleen clubbeheer verwijdert documenten." });
      return;
    }
    const documentId = intParam(req.params["documentId"]);
    const [gone] = await db
      .delete(clubDocumentsTable)
      .where(and(eq(clubDocumentsTable.id, documentId ?? -1), eq(clubDocumentsTable.clubId, ctx.club.id)))
      .returning({ id: clubDocumentsTable.id });
    if (!gone) {
      res.status(404).json({ error: "Document niet gevonden." });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "clubdocument verwijderen faalde");
    res.status(500).json({ error: "Document verwijderen is niet gelukt." });
  }
});

export default router;
