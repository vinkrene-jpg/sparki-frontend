import { Router, type Request, type Response } from "express";
import { Readable } from "stream";
import { requireAuth, getClerkUserId } from "../lib/auth";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";
import { findFilesByObjectPath, serveFile } from "../lib/files";
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
  "image/svg+xml", // clublogo (CLUB_ONBOARDING_01)
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

      // F11: als dit object in de files-tabel staat, is het door de CENTRALE
      // laag beheerd. Zo'n bestand gaat NOOIT via de rauwe object-flow uit
      // (die kent geen intrekking/nosniff), maar via de centrale serveFile-poort:
      // die dwingt intrekking (revokedAt ⇒ 410, ook via een oude link) en
      // nosniff/no-store af. De rechten hier: uitsluitend de EIGENAAR of een
      // admin (fail-closed 404 voor de rest — nooit lekken dat het bestaat).
      // Modules met een eigen zichtbaarheidsmodel (F7-berichten, F8-clubdocumenten)
      // hebben bovendien hun eigen serve-pad met de bredere rechtencheck; die
      // blijven leidend voor niet-eigenaren (bv. ontvangers/clubleden). Zo blijven
      // media-previews van eigen bestanden (Photo Lab, Journey, Input Center,
      // sfeerbeeld) transparant werken via /api/storage, mét intrekbaarheid.
      const managed = await findFilesByObjectPath(objectPath);
      if (managed.length > 0) {
        // Één opgeslagen object kan meerdere files-rijen delen (dedupe op
        // checksum maakt per eigenaar — en zelfs per eigenaar meermaals — een
        // eigen rij). Beperk tot de rijen van de rechthebbende (admin mag elke
        // rij). Bezit de caller geen enkele rij ⇒ 404 (nooit lekken dat het
        // bestaat).
        const owned = managed.filter(
          (f) => f.ownerClerkId === clerkId || isAdmin(clerkId),
        );
        if (owned.length === 0) {
          res.status(404).json({ error: "Bestand niet gevonden" });
          return;
        }
        // KORREKTE dedupe-revoke-semantiek: serveer zolang er ≥1 LEVENDE rij van
        // de rechthebbende is (ingetrokken rijen tellen niet mee). Intrekken van
        // rij A mag de nog levende rij B NIET doden — anders zou een gedeeld
        // object onterecht dichtvallen. Pas als ALLE rijen van die eigenaar
        // ingetrokken zijn, is de link dood (410, fail-closed).
        const live = owned.filter((f) => !f.revokedAt);
        if (live.length === 0) {
          res
            .status(410)
            .json({ error: "Dit bestand is ingetrokken en niet meer beschikbaar." });
          return;
        }
        const served = await serveFile(live[0]!);
        if (!served.ok) {
          res.status(served.status).json({ error: served.reason });
          return;
        }
        res.setHeader("Content-Type", served.contentType);
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Cache-Control", "private, max-age=0, no-store");
        served.stream.pipe(res);
        return;
      }

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
