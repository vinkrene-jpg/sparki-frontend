// SPARKI_BUILD_01 F8 — Clubdocumenten (versies + publicatie + zichtbaarheid).
// Gemount onder /api/clubs/:clubId/documents (routes/index.ts).
//
// Bouwt voort op HA-26/HA-27 (opslaan/tonen) en breidt uit met:
// • Uitbreidbare categorielijst (gedragscode, huisregels, ouderafspraken,
//   privacyinformatie, vertrouwenscontactpersoon, noodprocedures,
//   clubinstructies; reglement/overig behouden voor bestaande rijen).
// • Versies met expliciete status concept → gepubliceerd. Bij een nieuwe versie
//   blijft de oude ALTIJD bewaard; één actieve gepubliceerde versie per document
//   (club_documents.currentVersionId). Versienummer + publicatiedatum vastgelegd.
// • Rol-afhankelijke zichtbaarheid per document (leden_en_ouders default |
//   trainers_bestuur). Server-side afgedwongen op lijst ÉN download ÉN directe
//   file/API-toegang (404/403 — nooit lekken). Concepten alleen voor beheer.
// • Nieuwe uploads lopen via de F7-bestandenlaag (lib/files.ts: scan/sniff/
//   her-encode/allowlist + attachment+nosniff serve + intrekking). De generieke
//   storage-route weigert files-tabel-paden, dus downloaden kan uitsluitend via
//   dít route met de rechten- en zichtbaarheidscheck ervoor.
//
// Beheer (aanmaken/wijzigen/publiceren/verwijderen): owner/admin/hoofdtrainer
// (canManageClubDocuments — bestaand rechtenpatroon, geen tweede rechtenlaag).

import { Router } from "express";
import {
  db,
  clubDocumentsTable,
  clubDocumentVersionsTable,
  clubMembersTable,
  parentAthleteLinksTable,
  clubDocumentCategories,
  clubDocumentVisibilities,
  type ClubDocumentVisibility,
} from "@workspace/db";
import { and, desc, eq, isNull, max } from "drizzle-orm";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  getClubContext,
  canManageClubDocuments,
  canViewTrainersBestuurDocs,
  type ClubContext,
} from "../lib/club-permissions";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { registerFile, getFile, serveFile } from "../lib/files";

const router = Router({ mergeParams: true });
const svc = new ObjectStorageService();

function intParam(v: unknown): number | null {
  const n = typeof v === "string" ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : null;
}

// Resolve de clubcontext van een ACTIEF clublid. Retourneert null en schrijft
// het antwoord bij een probleem.
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

// F8 — mag deze context (een clublid) een document met deze zichtbaarheid zien?
// Concepten worden elders afgevangen; dit gaat puur over de rolzichtbaarheid.
function mayViewVisibility(ctx: ClubContext, visibility: string): boolean {
  if (visibility === "trainers_bestuur") return canViewTrainersBestuurDocs(ctx);
  return true; // leden_en_ouders: elk actief clublid
}

// F8 — ouder-ingang: is deze gebruiker (geen clublid) een gekoppelde ouder van
// een ACTIEF lid van deze club? Zo ja, dan mag hij de voor ouders relevante
// GEPUBLICEERDE documenten (zichtbaarheid leden_en_ouders) inzien. Fail-closed:
// geen actieve koppeling naar een actief lid ⇒ geen toegang.
async function isLinkedParentOfClubMember(
  clubId: number,
  parentClerkId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ x: clubMembersTable.id })
    .from(parentAthleteLinksTable)
    .innerJoin(
      clubMembersTable,
      and(
        eq(clubMembersTable.clerkId, parentAthleteLinksTable.athleteClerkId),
        eq(clubMembersTable.clubId, clubId),
        isNull(clubMembersTable.endedAt),
      ),
    )
    .where(
      and(
        eq(parentAthleteLinksTable.parentClerkId, parentClerkId),
        eq(parentAthleteLinksTable.status, "accepted"),
        isNull(parentAthleteLinksTable.endedAt),
      ),
    );
  return !!row;
}

// ── Lijst ─────────────────────────────────────────────────────────────────────
// Elk actief clublid: ziet de gepubliceerde documenten die bij zijn rol passen.
// Beheer ziet daarnaast concepten en de conceptstatus per document.
router.get("/", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxVoor(req, res);
    if (!ctx) return;
    const beheer = canManageClubDocuments(ctx);

    const docs = await db
      .select()
      .from(clubDocumentsTable)
      .where(eq(clubDocumentsTable.clubId, ctx.club.id))
      .orderBy(desc(clubDocumentsTable.createdAt));

    // Alle versies van deze club in één slag ophalen (kleine dataset).
    const allVersions = await db
      .select()
      .from(clubDocumentVersionsTable)
      .innerJoin(clubDocumentsTable, eq(clubDocumentsTable.id, clubDocumentVersionsTable.documentId))
      .where(eq(clubDocumentsTable.clubId, ctx.club.id))
      .orderBy(desc(clubDocumentVersionsTable.versionNumber));

    const versionsByDoc = new Map<number, typeof clubDocumentVersionsTable.$inferSelect[]>();
    for (const row of allVersions) {
      const v = row.club_document_versions;
      const list = versionsByDoc.get(v.documentId) ?? [];
      list.push(v);
      versionsByDoc.set(v.documentId, list);
    }

    const out = [];
    for (const d of docs) {
      // Rolzichtbaarheid eerst.
      if (!mayViewVisibility(ctx, d.visibility)) continue;
      const vs = versionsByDoc.get(d.id) ?? [];
      const current = vs.find((v) => v.id === d.currentVersionId) ?? null;
      // Zonder gepubliceerde versie is het document alleen voor beheer zichtbaar.
      if (!current && !beheer) continue;
      out.push({
        id: d.id,
        title: d.title,
        category: d.category,
        visibility: d.visibility,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        current: current
          ? {
              id: current.id,
              versionNumber: current.versionNumber,
              mediaType: current.mediaType,
              sizeBytes: current.sizeBytes,
              publishedAt: current.publishedAt,
            }
          : null,
        // Alleen beheer krijgt versiehistorie en conceptstatus mee.
        versions: beheer
          ? vs.map((v) => ({
              id: v.id,
              versionNumber: v.versionNumber,
              status: v.status,
              mediaType: v.mediaType,
              sizeBytes: v.sizeBytes,
              publishedAt: v.publishedAt,
              createdAt: v.createdAt,
              isCurrent: v.id === d.currentVersionId,
            }))
          : undefined,
      });
    }

    res.json({
      documents: out,
      magBeheren: beheer,
      categorieen: clubDocumentCategories,
      zichtbaarheden: clubDocumentVisibilities,
    });
  } catch (err) {
    req.log.error({ err }, "clubdocumenten lijst faalde");
    res.status(500).json({ error: "Documenten ophalen is niet gelukt." });
  }
});

// ── Nieuw document (met eerste versie als concept) ────────────────────────────
router.post("/", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxVoor(req, res);
    if (!ctx) return;
    if (!canManageClubDocuments(ctx)) {
      res.status(403).json({ error: "Alleen clubbeheer plaatst documenten." });
      return;
    }
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const category = typeof req.body?.category === "string" ? req.body.category : "overig";
    const visibility = typeof req.body?.visibility === "string" ? req.body.visibility : "leden_en_ouders";
    const base64 = typeof req.body?.base64 === "string" ? req.body.base64 : "";
    const originalName = typeof req.body?.originalName === "string" ? req.body.originalName : title;
    const publish = req.body?.publish === true;

    if (!title || !base64) {
      res.status(400).json({ error: "Titel en bestand zijn verplicht." });
      return;
    }
    if (!(clubDocumentCategories as readonly string[]).includes(category)) {
      res.status(400).json({ error: "Onbekende documentcategorie." });
      return;
    }
    if (!(clubDocumentVisibilities as readonly string[]).includes(visibility)) {
      res.status(400).json({ error: "Onbekende zichtbaarheid." });
      return;
    }

    // Bytes via de F7-bestandenlaag: scan/sniff/her-encode/allowlist.
    const reg = await registerFile({
      ownerClerkId: ctx.membership.clerkId,
      base64,
      originalName,
      retentionCategory: "club_document",
    });
    if (!reg.ok) {
      res.status(reg.status).json({ error: reg.reason });
      return;
    }

    // Gekoppelde schrijfacties in één transactie: document + eerste versie
    // (+ eventueel direct publiceren).
    const result = await db.transaction(async (tx) => {
      const [doc] = await tx
        .insert(clubDocumentsTable)
        .values({
          clubId: ctx.club.id,
          title,
          category,
          visibility: visibility as ClubDocumentVisibility,
          uploadedByClerkId: ctx.membership.clerkId,
        })
        .returning();
      const now = new Date();
      const [version] = await tx
        .insert(clubDocumentVersionsTable)
        .values({
          documentId: doc!.id,
          versionNumber: 1,
          status: publish ? "gepubliceerd" : "concept",
          fileId: reg.file.id,
          objectPath: reg.file.objectPath,
          mediaType: reg.file.contentType,
          sizeBytes: reg.file.sizeBytes,
          uploadedByClerkId: ctx.membership.clerkId,
          publishedAt: publish ? now : null,
          publishedByClerkId: publish ? ctx.membership.clerkId : null,
        })
        .returning();
      if (publish) {
        await tx
          .update(clubDocumentsTable)
          .set({ currentVersionId: version!.id, updatedAt: now })
          .where(eq(clubDocumentsTable.id, doc!.id));
      }
      return { doc: doc!, version: version! };
    });

    res.status(201).json({ id: result.doc.id, versionId: result.version.id });
  } catch (err) {
    req.log.error({ err }, "clubdocument plaatsen faalde");
    res.status(500).json({ error: "Document plaatsen is niet gelukt." });
  }
});

// ── Nieuwe versie van een bestaand document (concept) ─────────────────────────
router.post("/:documentId/versions", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxVoor(req, res);
    if (!ctx) return;
    if (!canManageClubDocuments(ctx)) {
      res.status(403).json({ error: "Alleen clubbeheer plaatst documenten." });
      return;
    }
    const documentId = intParam(req.params["documentId"]);
    const [doc] = await db
      .select()
      .from(clubDocumentsTable)
      .where(and(eq(clubDocumentsTable.id, documentId ?? -1), eq(clubDocumentsTable.clubId, ctx.club.id)));
    if (!doc) {
      res.status(404).json({ error: "Document niet gevonden." });
      return;
    }
    const base64 = typeof req.body?.base64 === "string" ? req.body.base64 : "";
    const originalName = typeof req.body?.originalName === "string" ? req.body.originalName : doc.title;
    const publish = req.body?.publish === true;
    if (!base64) {
      res.status(400).json({ error: "Een bestand is verplicht voor een nieuwe versie." });
      return;
    }

    const reg = await registerFile({
      ownerClerkId: ctx.membership.clerkId,
      base64,
      originalName,
      retentionCategory: "club_document",
    });
    if (!reg.ok) {
      res.status(reg.status).json({ error: reg.reason });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [{ n }] = await tx
        .select({ n: max(clubDocumentVersionsTable.versionNumber) })
        .from(clubDocumentVersionsTable)
        .where(eq(clubDocumentVersionsTable.documentId, doc.id));
      const nextNumber = (n ?? 0) + 1;
      const now = new Date();
      const [version] = await tx
        .insert(clubDocumentVersionsTable)
        .values({
          documentId: doc.id,
          versionNumber: nextNumber,
          status: publish ? "gepubliceerd" : "concept",
          fileId: reg.file.id,
          objectPath: reg.file.objectPath,
          mediaType: reg.file.contentType,
          sizeBytes: reg.file.sizeBytes,
          uploadedByClerkId: ctx.membership.clerkId,
          publishedAt: publish ? now : null,
          publishedByClerkId: publish ? ctx.membership.clerkId : null,
        })
        .returning();
      if (publish) {
        await tx
          .update(clubDocumentsTable)
          .set({ currentVersionId: version!.id, updatedAt: now })
          .where(eq(clubDocumentsTable.id, doc.id));
      }
      return version!;
    });

    res.status(201).json({ versionId: result.id, versionNumber: result.versionNumber, status: result.status });
  } catch (err) {
    req.log.error({ err }, "clubdocument-versie plaatsen faalde");
    res.status(500).json({ error: "Nieuwe versie plaatsen is niet gelukt." });
  }
});

// ── Versie publiceren (expliciet) ─────────────────────────────────────────────
router.post("/:documentId/versions/:versionId/publish", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxVoor(req, res);
    if (!ctx) return;
    if (!canManageClubDocuments(ctx)) {
      res.status(403).json({ error: "Alleen clubbeheer publiceert documenten." });
      return;
    }
    const documentId = intParam(req.params["documentId"]);
    const versionId = intParam(req.params["versionId"]);
    const [doc] = await db
      .select()
      .from(clubDocumentsTable)
      .where(and(eq(clubDocumentsTable.id, documentId ?? -1), eq(clubDocumentsTable.clubId, ctx.club.id)));
    if (!doc) {
      res.status(404).json({ error: "Document niet gevonden." });
      return;
    }
    const [version] = await db
      .select()
      .from(clubDocumentVersionsTable)
      .where(
        and(
          eq(clubDocumentVersionsTable.id, versionId ?? -1),
          eq(clubDocumentVersionsTable.documentId, doc.id),
        ),
      );
    if (!version) {
      res.status(404).json({ error: "Versie niet gevonden." });
      return;
    }

    // Publiceren: markeer de versie gepubliceerd (oude blijft bewaard) en maak
    // hem de actieve versie. In één transactie (gekoppelde schrijfacties).
    const now = new Date();
    await db.transaction(async (tx) => {
      if (version.status !== "gepubliceerd") {
        await tx
          .update(clubDocumentVersionsTable)
          .set({ status: "gepubliceerd", publishedAt: now, publishedByClerkId: ctx.membership.clerkId })
          .where(eq(clubDocumentVersionsTable.id, version.id));
      }
      await tx
        .update(clubDocumentsTable)
        .set({ currentVersionId: version.id, updatedAt: now })
        .where(eq(clubDocumentsTable.id, doc.id));
    });

    res.json({ ok: true, currentVersionId: version.id });
  } catch (err) {
    req.log.error({ err }, "clubdocument publiceren faalde");
    res.status(500).json({ error: "Publiceren is niet gelukt." });
  }
});

// ── Document bijwerken (titel/categorie/zichtbaarheid) ────────────────────────
router.patch("/:documentId", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxVoor(req, res);
    if (!ctx) return;
    if (!canManageClubDocuments(ctx)) {
      res.status(403).json({ error: "Alleen clubbeheer wijzigt documenten." });
      return;
    }
    const documentId = intParam(req.params["documentId"]);
    const [doc] = await db
      .select()
      .from(clubDocumentsTable)
      .where(and(eq(clubDocumentsTable.id, documentId ?? -1), eq(clubDocumentsTable.clubId, ctx.club.id)));
    if (!doc) {
      res.status(404).json({ error: "Document niet gevonden." });
      return;
    }
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof req.body?.title === "string" && req.body.title.trim()) patch.title = req.body.title.trim();
    if (typeof req.body?.category === "string") {
      if (!(clubDocumentCategories as readonly string[]).includes(req.body.category)) {
        res.status(400).json({ error: "Onbekende documentcategorie." });
        return;
      }
      patch.category = req.body.category;
    }
    if (typeof req.body?.visibility === "string") {
      if (!(clubDocumentVisibilities as readonly string[]).includes(req.body.visibility)) {
        res.status(400).json({ error: "Onbekende zichtbaarheid." });
        return;
      }
      patch.visibility = req.body.visibility;
    }
    const [row] = await db
      .update(clubDocumentsTable)
      .set(patch)
      .where(eq(clubDocumentsTable.id, doc.id))
      .returning();
    res.json({ id: row!.id, title: row!.title, category: row!.category, visibility: row!.visibility });
  } catch (err) {
    req.log.error({ err }, "clubdocument bijwerken faalde");
    res.status(500).json({ error: "Document bijwerken is niet gelukt." });
  }
});

// ── Downloaden/bekijken ───────────────────────────────────────────────────────
// Rechten- en zichtbaarheidscheck VÓÓR het streamen. Zonder versieId wordt de
// actieve gepubliceerde versie geserveerd. Een concept of een niet-passende
// zichtbaarheid geeft 404 (nooit lekken dat het document bestaat).
router.get("/:documentId/download", requireAuth, async (req, res) => {
  try {
    const clubId = intParam(req.params["clubId"]);
    const documentId = intParam(req.params["documentId"]);
    if (clubId == null) {
      res.status(400).json({ error: "Ongeldige club." });
      return;
    }
    const clerkId = getClerkUserId(req)!;
    const ctx = await getClubContext(clubId, clerkId);

    const [doc] = await db
      .select()
      .from(clubDocumentsTable)
      .where(and(eq(clubDocumentsTable.id, documentId ?? -1), eq(clubDocumentsTable.clubId, clubId)));
    if (!doc) {
      res.status(404).json({ error: "Document niet gevonden." });
      return;
    }

    const beheer = ctx ? canManageClubDocuments(ctx) : false;

    // Kies de versie: expliciete versieId (alleen beheer) of de actieve.
    const reqVersionId = intParam(req.query["versionId"]);
    let versionId = doc.currentVersionId;
    if (reqVersionId != null) {
      if (!beheer) {
        res.status(404).json({ error: "Document niet gevonden." });
        return;
      }
      versionId = reqVersionId;
    }
    if (versionId == null) {
      // Geen gepubliceerde versie: alleen beheer weet dat het bestaat.
      res.status(404).json({ error: "Document niet gevonden." });
      return;
    }

    const [version] = await db
      .select()
      .from(clubDocumentVersionsTable)
      .where(
        and(
          eq(clubDocumentVersionsTable.id, versionId),
          eq(clubDocumentVersionsTable.documentId, doc.id),
        ),
      );
    if (!version) {
      res.status(404).json({ error: "Document niet gevonden." });
      return;
    }

    // Zichtbaarheidsbeslissing (server-side, fail-closed):
    if (beheer) {
      // beheer mag alles van de eigen club (incl. concept).
    } else if (ctx) {
      // Actief clublid: rolzichtbaarheid + alleen gepubliceerd.
      if (version.status !== "gepubliceerd") {
        res.status(404).json({ error: "Document niet gevonden." });
        return;
      }
      if (!mayViewVisibility(ctx, doc.visibility)) {
        res.status(404).json({ error: "Document niet gevonden." });
        return;
      }
    } else {
      // Geen clublid: alleen gekoppelde ouder van een clublid, alleen
      // gepubliceerd én alleen leden_en_ouders-documenten.
      const parentOk =
        version.status === "gepubliceerd" &&
        doc.visibility === "leden_en_ouders" &&
        (await isLinkedParentOfClubMember(clubId, clerkId));
      if (!parentOk) {
        res.status(403).json({ error: "Je hebt geen toegang tot dit document." });
        return;
      }
    }

    // Streamen. Nieuwe versies lopen via de F7-serve (intrekking +
    // attachment/nosniff). Gemigreerde legacy-versies (geen fileId) via de
    // bestaande object-storage-streaming.
    if (version.fileId != null) {
      const file = await getFile(version.fileId);
      if (!file) {
        res.status(404).json({ error: "Het bestand bestaat niet meer in de opslag." });
        return;
      }
      const serve = await serveFile(file);
      if (!serve.ok) {
        res.status(serve.status).json({ error: serve.reason });
        return;
      }
      res.setHeader("Content-Type", serve.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${serve.downloadName.replace(/[^\w. -]+/g, "_")}"`);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "private, max-age=0, no-store");
      serve.stream.pipe(res);
      return;
    }

    // Legacy-versie (gemigreerd): stream het object rechtstreeks.
    const objectFile = await svc.getObjectEntityFile(version.objectPath);
    const [metadata] = await objectFile.getMetadata();
    res.setHeader("Content-Type", version.mediaType);
    if (metadata.size) res.setHeader("Content-Length", String(metadata.size));
    res.setHeader("Content-Disposition", `attachment; filename="${doc.title.replace(/[^\w. -]+/g, "_")}"`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, max-age=0, no-store");
    objectFile.createReadStream().pipe(res);
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Het bestand bestaat niet meer in de opslag." });
      return;
    }
    req.log.error({ err }, "clubdocument download faalde");
    res.status(500).json({ error: "Document openen is niet gelukt." });
  }
});

// ── Verwijderen (heel document + alle versies) ────────────────────────────────
router.delete("/:documentId", requireAuth, async (req, res) => {
  try {
    const ctx = await ctxVoor(req, res);
    if (!ctx) return;
    if (!canManageClubDocuments(ctx)) {
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
