// SPARKI_BUILD F11 — centrale bestands-router (generiek versiebeheer + serve).
//
// Dit is de centrale laag. Modules met een eigen zichtbaarheidslogica (F7
// berichten, F8 clubdocumenten) blijven hun eigen serve-pad met hun eigen
// rechtencheck gebruiken — die roepen intern registerFile/serveFile/revokeFile
// aan. Deze router biedt de GENERIEKE operaties op een bestand op basis van
// eigenaarschap (owner) of admin:
//   • GET  /api/files/:id/versions   — versiehistorie van de logische keten.
//   • POST /api/files/:id/replace     — vervang zonder historieverlies.
//   • GET  /api/files/:id/download    — bevoegde download (owner/admin).
//   • POST /api/files/:id/revoke      — intrekken (fail-closed op elke route).
//
// Rechten: uitsluitend de EIGENAAR of een admin. Alles anders ⇒ 404 (nooit
// lekken dat het bestand bestaat). Ingetrokken bestanden weigert serveFile met
// 410 op ELKE route (ook oude links).

import { Router } from "express";
import { requireAuth, getClerkUserId } from "../lib/auth";
import { isAdmin } from "../lib/flags";
import {
  getFile,
  serveFile,
  revokeFile,
  replaceFile,
  listFileVersions,
} from "../lib/files";

const router = Router();

function intParam(v: unknown): number | null {
  const n = typeof v === "string" ? Number.parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : null;
}

// Bevoegd = eigenaar of admin. Fail-closed: alle andere gevallen behandelt de
// aanroeper als 404 (nooit lekken).
function mayAccess(fileOwner: string, caller: string): boolean {
  return fileOwner === caller || isAdmin(caller);
}

// GET /api/files/:id/versions — versiehistorie van de logische keten.
router.get("/:id/versions", requireAuth, async (req, res) => {
  try {
    const caller = getClerkUserId(req)!;
    const id = intParam(req.params["id"]);
    const file = id != null ? await getFile(id) : null;
    if (!file || !mayAccess(file.ownerClerkId, caller)) {
      res.status(404).json({ error: "Bestand niet gevonden." });
      return;
    }
    const versions = await listFileVersions(file.id);
    res.json({
      logicalId: file.logicalId ?? file.id,
      versions: versions.map((v) => ({
        id: v.id,
        version: v.version,
        originalName: v.originalName,
        contentType: v.contentType,
        sizeBytes: v.sizeBytes,
        retentionCategory: v.retentionCategory,
        supersededById: v.supersededById,
        revoked: v.revokedAt != null,
        createdAt: v.createdAt,
        isCurrent: v.supersededById == null && v.revokedAt == null,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "files versions faalde");
    res.status(500).json({ error: "Versiehistorie ophalen is niet gelukt." });
  }
});

// POST /api/files/:id/replace — vervang zonder historieverlies.
// Body: { base64, originalName?, retentionCategory? }.
router.post("/:id/replace", requireAuth, async (req, res) => {
  try {
    const caller = getClerkUserId(req)!;
    const id = intParam(req.params["id"]);
    const file = id != null ? await getFile(id) : null;
    if (!file || !mayAccess(file.ownerClerkId, caller)) {
      res.status(404).json({ error: "Bestand niet gevonden." });
      return;
    }
    const base64 = typeof req.body?.base64 === "string" ? req.body.base64 : "";
    if (!base64) {
      res.status(400).json({ error: "Een bestand is verplicht voor een nieuwe versie." });
      return;
    }
    const originalName =
      typeof req.body?.originalName === "string" ? req.body.originalName : file.originalName;
    const retentionCategory =
      typeof req.body?.retentionCategory === "string"
        ? req.body.retentionCategory
        : file.retentionCategory;

    const result = await replaceFile(file.id, {
      // De nieuwe versie blijft van dezelfde eigenaar als het oorspronkelijke
      // bestand (nooit stilzwijgend van eigenaar wisselen).
      ownerClerkId: file.ownerClerkId,
      base64,
      originalName,
      retentionCategory,
    });
    if (!result.ok) {
      res.status(result.status).json({ error: result.reason });
      return;
    }
    res.status(201).json({
      id: result.file.id,
      version: result.file.version,
      logicalId: result.file.logicalId,
      deduped: result.deduped === true,
    });
  } catch (err) {
    req.log.error({ err }, "files replace faalde");
    res.status(500).json({ error: "Bestand vervangen is niet gelukt." });
  }
});

// GET /api/files/:id/download — bevoegde download. Ook oude (superseded) versies
// blijven downloadbaar voor bevoegden zolang ze niet zijn ingetrokken.
router.get("/:id/download", requireAuth, async (req, res) => {
  try {
    const caller = getClerkUserId(req)!;
    const id = intParam(req.params["id"]);
    const file = id != null ? await getFile(id) : null;
    if (!file || !mayAccess(file.ownerClerkId, caller)) {
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
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${served.downloadName.replace(/"/g, "")}"`,
    );
    res.setHeader("Cache-Control", "private, max-age=0, no-store");
    served.stream.pipe(res);
  } catch (err) {
    req.log.error({ err }, "files download faalde");
    res.status(500).json({ error: "Bestand ophalen is niet gelukt." });
  }
});

// POST /api/files/:id/revoke — intrekken (idempotent, fail-closed).
router.post("/:id/revoke", requireAuth, async (req, res) => {
  try {
    const caller = getClerkUserId(req)!;
    const id = intParam(req.params["id"]);
    const file = id != null ? await getFile(id) : null;
    if (!file || !mayAccess(file.ownerClerkId, caller)) {
      res.status(404).json({ error: "Bestand niet gevonden." });
      return;
    }
    await revokeFile(file.id, caller);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "files revoke faalde");
    res.status(500).json({ error: "Bestand intrekken is niet gelukt." });
  }
});

export default router;
