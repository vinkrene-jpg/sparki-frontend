import { createHash } from "crypto";
import { and, eq, isNull, lt } from "drizzle-orm";
import { db, filesTable, type FileRecord } from "@workspace/db";
import { ObjectStorageService } from "./objectStorage";

// ── F7: generieke bestandslaag (voorschot op F11) ────────────────────────────
// Eén plek waar bestanden binnenkomen, gescand worden en geserveerd worden.
// Bytes leven in object storage; de database bewaart alleen metadata (files).
//
// VEILIGHEIDSKETEN (bindend, F7 §3 — minimum tot er een echte virusscanner is):
//   1. Groottelimiet (config, FILES_MAX_UPLOAD_BYTES, default 25 MB).
//   2. SNIFFEN op de ECHTE inhoud (magic bytes), niet het geclaimde type.
//      Verkleed bestand ⇒ geweigerd op inhoud, wordt nooit opgeslagen.
//   3. Strikte allowlist: jpeg/png/webp/heic (afbeeldingen) + pdf. Uitvoerbare
//      bestanden, archieven en office-documenten (incl. macro's) worden
//      volledig geweigerd — we kunnen macro's niet uitsluiten, dus office weg.
//   4. Afbeeldingen worden HER-ENCODEERD met sharp (→ jpeg of webp), zodat
//      meegesmokkelde inhoud (EXIF-payloads, polyglots) verdwijnt. Pdf wordt op
//      magic bytes toegelaten (JS-actie-controle is te zwaar voor dit minimum).
//   5. scanFile() is een EXPLICIETE stap in de keten: nu sniff+her-encode+
//      limits, maar het contract is zo dat er later een echte scanner in past
//      zonder de rest te verbouwen.
//
// serveFile draait ALTIJD via de API met Content-Disposition: attachment +
// X-Content-Type-Options: nosniff — nooit inline in de app-context. Een
// ingetrokken bestand (revokedAt) is nergens meer downloadbaar (410), ook niet
// via een oudere link.

const svc = new ObjectStorageService();

export const FILES_MAX_UPLOAD_BYTES = (() => {
  const raw = process.env.FILES_MAX_UPLOAD_BYTES;
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 25 * 1024 * 1024; // 25 MB
})();

export type SniffResult =
  | { ok: true; kind: "image" | "pdf"; contentType: string }
  | { ok: false; reason: string };

// Magic-byte sniffer op de ECHTE inhoud. Bewust conservatief: alleen de
// expliciet toegestane types worden herkend; al het andere is fail-closed.
export function sniffContentType(buf: Buffer): SniffResult {
  if (buf.length < 4) {
    return { ok: false, reason: "Het bestand is leeg of te klein." };
  }
  const b = buf;
  const startsWith = (sig: number[], offset = 0): boolean =>
    sig.every((byte, i) => b[offset + i] === byte);
  const ascii = (s: string, offset = 0): boolean =>
    [...s].every((c, i) => b[offset + i] === c.charCodeAt(0));

  // JPEG: FF D8 FF
  if (startsWith([0xff, 0xd8, 0xff])) {
    return { ok: true, kind: "image", contentType: "image/jpeg" };
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { ok: true, kind: "image", contentType: "image/png" };
  }
  // WEBP: "RIFF"...."WEBP"
  if (ascii("RIFF") && b.length >= 12 && ascii("WEBP", 8)) {
    return { ok: true, kind: "image", contentType: "image/webp" };
  }
  // HEIC/HEIF: ....ftyp{heic,heix,heif,mif1,msf1,hevc}
  if (b.length >= 12 && ascii("ftyp", 4)) {
    const brand = b.subarray(8, 12).toString("latin1");
    if (["heic", "heix", "heif", "mif1", "msf1", "hevc", "hevx"].includes(brand)) {
      return { ok: true, kind: "image", contentType: "image/heic" };
    }
  }
  // PDF: "%PDF-"
  if (ascii("%PDF-")) {
    return { ok: true, kind: "pdf", contentType: "application/pdf" };
  }
  // Expliciet geweigerd op inhoud: ZIP/office (PK), gzip (1F 8B), RAR, ELF/EXE.
  return {
    ok: false,
    reason:
      "Dit bestandstype wordt niet ondersteund. Toegestaan: afbeeldingen (JPEG, PNG, WEBP, HEIC) en PDF. Uitvoerbare bestanden, archieven en Office-documenten worden geweigerd.",
  };
}

export type ScanResult =
  | { ok: true; bytes: Buffer; contentType: string; ext: string }
  | { ok: false; status: number; reason: string };

// De expliciete scanstap. Sniff → (afbeelding) her-encode → klaar. Een echte
// virusscanner haakt hier later in (na de her-encode, vóór de return).
export async function scanFile(input: Buffer): Promise<ScanResult> {
  if (input.length > FILES_MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      status: 400,
      reason: `Bestand is te groot (maximaal ${Math.round(FILES_MAX_UPLOAD_BYTES / (1024 * 1024))} MB).`,
    };
  }
  const sniff = sniffContentType(input);
  if (!sniff.ok) {
    return { ok: false, status: 415, reason: sniff.reason };
  }

  if (sniff.kind === "image") {
    try {
      const sharp = (await import("sharp")).default;
      const img = sharp(input, { failOn: "error" });
      const meta = await img.metadata();
      // Her-encodeer: jpeg voor het gros; webp blijft webp. Zo verdwijnt
      // meegesmokkelde inhoud en houden we een klein, veilig bestand over.
      if (meta.format === "webp") {
        const bytes = await sharp(input).rotate().webp({ quality: 85 }).toBuffer();
        return { ok: true, bytes, contentType: "image/webp", ext: "webp" };
      }
      const bytes = await sharp(input)
        .rotate()
        .jpeg({ quality: 85 })
        .toBuffer();
      return { ok: true, bytes, contentType: "image/jpeg", ext: "jpg" };
    } catch {
      return {
        ok: false,
        status: 415,
        reason:
          "De afbeelding kon niet worden verwerkt; hij is beschadigd of geen echte afbeelding.",
      };
    }
  }

  // PDF: op magic bytes toegelaten, ongewijzigd opgeslagen.
  return { ok: true, bytes: input, contentType: "application/pdf", ext: "pdf" };
}

export type RegisterFileInput = {
  ownerClerkId: string;
  base64: string;
  originalName: string;
  retentionCategory?: string;
};

export type RegisterFileResult =
  | { ok: true; file: FileRecord }
  | { ok: false; status: number; reason: string };

// registerFile: neemt rauwe base64, draait de VOLLEDIGE scanketen, PUT de
// (eventueel her-encodeerde) bytes naar storage, zet de ACL NA de PUT (memory-
// les: presign→PUT→ACL-on-persist), en legt het metadata-record vast.
export async function registerFile(
  input: RegisterFileInput,
): Promise<RegisterFileResult> {
  let raw: Buffer;
  try {
    raw = Buffer.from(input.base64, "base64");
  } catch {
    return { ok: false, status: 400, reason: "Ongeldige bestandsinhoud." };
  }
  const scan = await scanFile(raw);
  if (!scan.ok) {
    return { ok: false, status: scan.status, reason: scan.reason };
  }

  // 1. PUT de veilige bytes naar object storage (aparte oorsprong).
  const uploadUrl = await svc.getObjectEntityUploadURL();
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": scan.contentType },
    body: scan.bytes,
    signal: AbortSignal.timeout(30_000),
  });
  if (!put.ok) {
    return { ok: false, status: 502, reason: "Bestand opslaan is niet gelukt." };
  }
  // 2. ACL pas NA de PUT: eigenaar privé (serve-pad doet de echte rechtencheck).
  const objectPath = await svc.trySetObjectEntityAclPolicy(uploadUrl, {
    owner: input.ownerClerkId,
    visibility: "private",
  });

  const sha256 = createHash("sha256").update(scan.bytes).digest("hex");
  const safeName = sanitizeName(input.originalName, scan.ext);
  const [file] = await db
    .insert(filesTable)
    .values({
      ownerClerkId: input.ownerClerkId,
      objectPath,
      originalName: safeName,
      contentType: scan.contentType,
      sizeBytes: scan.bytes.length,
      sha256,
      version: 1,
      retentionCategory: input.retentionCategory ?? "algemeen",
    })
    .returning();
  return { ok: true, file: file! };
}

// Trek een bestand in (fail-closed). Idempotent; retourneert het record.
export async function revokeFile(
  fileId: number,
  revokedByClerkId: string,
): Promise<FileRecord | null> {
  const [row] = await db
    .update(filesTable)
    .set({ revokedAt: new Date(), revokedByClerkId })
    .where(and(eq(filesTable.id, fileId), isNull(filesTable.revokedAt)))
    .returning();
  if (row) return row;
  const [existing] = await db.select().from(filesTable).where(eq(filesTable.id, fileId));
  return existing ?? null;
}

export async function getFile(fileId: number): Promise<FileRecord | null> {
  const [row] = await db.select().from(filesTable).where(eq(filesTable.id, fileId));
  return row ?? null;
}

export type ServeResult =
  | { ok: true; stream: NodeJS.ReadableStream; contentType: string; downloadName: string }
  | { ok: false; status: number; reason: string };

// serveFile: streamt de bytes MET download-header en nosniff. Een ingetrokken
// bestand levert 410 op — óók met een oude link. De AANROEPER doet eerst de
// bericht-zichtbaarheidscheck; deze functie voegt de intrekking-poort toe.
export async function serveFile(file: FileRecord): Promise<ServeResult> {
  if (file.revokedAt) {
    return { ok: false, status: 410, reason: "Dit bestand is ingetrokken en niet meer beschikbaar." };
  }
  try {
    const objectFile = await svc.getObjectEntityFile(file.objectPath);
    const stream = objectFile.createReadStream();
    return {
      ok: true,
      stream,
      contentType: file.contentType,
      downloadName: file.originalName,
    };
  } catch {
    // Bytes weg in storage ⇒ behandel als niet meer beschikbaar (404).
    return { ok: false, status: 404, reason: "Bestand niet gevonden." };
  }
}

// Retentie-opruiming: trek alle nog-actieve bestanden in die vóór `before`
// zijn aangemaakt in de gegeven categorie. Niet-destructief: de rij blijft, het
// bestand wordt ingetrokken (revokedAt) zodat oude links direct dichtvallen.
export async function revokeFilesForRetention(
  retentionCategory: string,
  before: Date,
): Promise<number> {
  const rows = await db
    .update(filesTable)
    .set({ revokedAt: new Date(), revokedByClerkId: "system:retentie" })
    .where(
      and(
        eq(filesTable.retentionCategory, retentionCategory),
        isNull(filesTable.revokedAt),
        lt(filesTable.createdAt, before),
      ),
    )
    .returning({ id: filesTable.id });
  return rows.length;
}

// Zorg dat de weergavenaam een veilige, bij het echte type passende extensie
// heeft (nooit een misleidende .exe/.docx-naam op een her-encodeerde afbeelding).
function sanitizeName(name: string, ext: string): string {
  const base = (name || "bestand")
    .replace(/[/\\]/g, "_")
    .replace(/\.[a-z0-9]+$/i, "")
    .slice(0, 120)
    .trim();
  return `${base || "bestand"}.${ext}`;
}
