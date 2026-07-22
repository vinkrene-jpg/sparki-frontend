import { Router, type Request, type Response } from "express";
import { Readable } from "stream";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";
import { isAdmin } from "../lib/flags";
import { rateLimit } from "../lib/security/rate-limit";
import { writeAudit } from "../lib/security/audit";

// Object storage routes for the Sparki Input Center.
//
// Uploads use the presigned-URL flow: the client asks for a signed PUT URL
// (this endpoint, cookie-authenticated), then uploads the bytes DIRECTLY to
// Google Cloud Storage — never through this server. On request we record an ACL
// policy that makes the athlete (clerkId) the private owner, so only they (or a
// future authorised viewer) can read it back via the protected serve route.

const router = Router();
const objectStorageService = new ObjectStorageService();

// POST /api/storage/uploads/request-url — request a presigned upload URL.
// Body: { name, size, contentType }. Returns { uploadURL, objectPath }.
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "application/gpx+xml",
  "application/xml",
  "text/xml",
  "application/octet-stream", // FIT-bestanden
  "text/plain",
];

router.post(
  "/storage/uploads/request-url",
  requireAuth,
  rateLimit({ scope: "uploads", max: 30, windowMs: 10 * 60_000 }),
  async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req)!;
    const body = req.body as {
      name?: unknown;
      size?: unknown;
      contentType?: unknown;
    };
    const name = typeof body.name === "string" ? body.name : "";
    const contentType =
      typeof body.contentType === "string" ? body.contentType : "";
    if (!name || !contentType) {
      res.status(400).json({ error: "name en contentType zijn verplicht" });
      return;
    }
    const size = typeof body.size === "number" ? body.size : null;
    if (size != null && (size <= 0 || size > MAX_UPLOAD_BYTES)) {
      void writeAudit({
        event: "upload_rejected",
        actorClerkId: clerkId,
        meta: { reden: "grootte", size },
        req,
      });
      res.status(400).json({ error: "Bestand is te groot (maximaal 25 MB)." });
      return;
    }
    if (!ALLOWED_UPLOAD_TYPES.includes(contentType.toLowerCase().split(";")[0].trim())) {
      void writeAudit({
        event: "upload_rejected",
        actorClerkId: clerkId,
        meta: { reden: "bestandstype", contentType },
        req,
      });
      res.status(400).json({ error: "Dit bestandstype wordt niet ondersteund." });
      return;
    }

    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      // The object does not exist yet (the client uploads to uploadURL next), so
      // we cannot set its ACL here — that happens when the message is persisted,
      // once the bytes are really in storage. We only hand back the canonical
      // object path the client will reference.
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);
      res.json({ uploadURL, objectPath });
    } catch (err) {
      req.log.error({ err }, "storage.request-url failed");
      res.status(500).json({ error: "Uploadlink aanmaken mislukt" });
    }
  },
);

// GET /api/storage/objects/* — serve a private object entity. Owner-gated:
// only the athlete who owns the object (or an authorised access group) may read
// it. Cookie session resolves the caller.
router.get(
  "/storage/objects/*path",
  requireAuth,
  async (req: Request, res: Response) => {
    const clerkId = getClerkUserId(req)!;
    try {
      const raw = (req.params as Record<string, unknown>).path;
      const wildcardPath = Array.isArray(raw) ? raw.join("/") : String(raw);
      const objectPath = `/objects/${wildcardPath}`;
      const objectFile =
        await objectStorageService.getObjectEntityFile(objectPath);

      // Admins may read any object so they can review tester-submitted bug
      // screenshots (which are owned privately by the reporter). Everyone else
      // is owner/ACL-gated as normal.
      const canAccess =
        isAdmin(clerkId) ||
        (await objectStorageService.canAccessObjectEntity({
          userId: clerkId,
          objectFile,
          requestedPermission: ObjectPermission.READ,
        }));
      if (!canAccess) {
        res.status(403).json({ error: "Geen toegang tot dit bestand" });
        return;
      }

      const response = await objectStorageService.downloadObject(objectFile);
      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      if (response.body) {
        const nodeStream = Readable.fromWeb(
          response.body as ReadableStream<Uint8Array>,
        );
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (err) {
      if (err instanceof ObjectNotFoundError) {
        res.status(404).json({ error: "Bestand niet gevonden" });
        return;
      }
      req.log.error({ err }, "storage.serve failed");
      res.status(500).json({ error: "Bestand ophalen mislukt" });
    }
  },
);

export default router;
