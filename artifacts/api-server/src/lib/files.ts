import { createHash } from "crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import {
  db,
  filesTable,
  fileRetentionCategories,
  type FileRecord,
} from "@workspace/db";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { getObjectAclPolicy } from "./objectAcl";

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
//
// F11 (centrale laag): deze module IS de ene centrale poort. Het volledige,
// eerlijke veiligheidsbeleid (geen echte virusscanner, wél magic-byte-controle,
// her-encoding, PDF-%PDF-controle, whitelist per doel, groottelimiet, geen
// uitvoerbare types) staat in docs/F11_VEILIGHEIDSBELEID.md.

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
      // Her-encodeer: zo verdwijnt meegesmokkelde inhoud (EXIF-payloads,
      // polyglots) en houden we een klein, veilig bestand over.
      // - webp blijft webp;
      // - PNG MET transparantie blijft PNG (her-encode PNG→PNG). Zo verwijderen
      //   we alsnog payloads, maar behouden we het alfakanaal — noodzakelijk voor
      //   afgeleiden zoals de fietsscan-cutout (vrijstaand beeld). Zonder deze
      //   regel zou her-encoding naar jpeg de transparantie platslaan.
      // - al het overige (jpeg, alpha-loze png, heic, …) wordt jpeg.
      if (meta.format === "webp") {
        const bytes = await sharp(input).rotate().webp({ quality: 85 }).toBuffer();
        return { ok: true, bytes, contentType: "image/webp", ext: "webp" };
      }
      if (meta.format === "png" && meta.hasAlpha) {
        const bytes = await sharp(input)
          .rotate()
          .png({ compressionLevel: 9 })
          .toBuffer();
        return { ok: true, bytes, contentType: "image/png", ext: "png" };
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

export type FileVisibility = "private" | "public";

export type RegisterFileInput = {
  ownerClerkId: string;
  base64: string;
  originalName: string;
  retentionCategory?: string;
  // Zichtbaarheid op het serve-pad. Default "private" (alleen eigenaar/admin).
  // "public" = elke ingelogde gebruiker mag lezen (bv. Sparki World-media, die
  // systeem-eigen en transparant-fictief is). De object-ACL wordt hierop gezet
  // en de kolom files.visibility bewaart de regel voor het serve-pad.
  visibility?: FileVisibility;
};

export type RegisterFileResult =
  | { ok: true; file: FileRecord; deduped?: boolean }
  | { ok: false; status: number; reason: string };

// Valideer/normaliseer de retentiecategorie (F11 §3). Onbekende waarden vallen
// fail-closed terug op "algemeen"; nooit een vrije tekst in de kolom.
function normalizeRetentionCategory(raw: string | undefined): string {
  if (raw && (fileRetentionCategories as readonly string[]).includes(raw)) {
    return raw;
  }
  return "algemeen";
}

// DEDUPE (F11 §2): zoek een bestaand, NIET-ingetrokken bestand van DEZELFDE
// eigenaar met identieke sha256 én grootte. Cross-eigenaar wordt NOOIT
// hergebruikt (privacy: één eigenaar mag nooit merken dat iemand anders exact
// hetzelfde bestand heeft). Retourneert het gedeelde objectPath of null.
async function findDedupeObjectPath(
  ownerClerkId: string,
  sha256: string,
  sizeBytes: number,
): Promise<string | null> {
  const [row] = await db
    .select({ objectPath: filesTable.objectPath })
    .from(filesTable)
    .where(
      and(
        eq(filesTable.ownerClerkId, ownerClerkId),
        eq(filesTable.sha256, sha256),
        eq(filesTable.sizeBytes, sizeBytes),
        isNull(filesTable.revokedAt),
      ),
    )
    .limit(1);
  return row?.objectPath ?? null;
}

// registerFile: neemt rauwe base64, draait de VOLLEDIGE scanketen, PUT de
// (eventueel her-encodeerde) bytes naar storage, zet de ACL NA de PUT (memory-
// les: presign→PUT→ACL-on-persist), en legt het metadata-record vast.
//
// DEDUPE-KEUZE (bewust, F11 §2): bij een bestaand sha256+grootte van dezelfde
// eigenaar SLAAN we de bytes niet opnieuw op — we hergebruiken het bestaande
// objectPath. Er wordt WEL een nieuwe files-rij aangemaakt (eigen metadata,
// eigen versie/koppeling). Intrekken (revokedAt) werkt PER files-rij en zet
// nooit de gedeelde object-bytes zelf weg; zolang minstens één niet-ingetrokken
// rij naar het object verwijst blijft het bruikbaar. Zo raakt het intrekken van
// de één de ander niet. Object-bytes worden in DEEL 1 nooit fysiek verwijderd.
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

  const sha256 = createHash("sha256").update(scan.bytes).digest("hex");
  const sizeBytes = scan.bytes.length;
  const retentionCategory = normalizeRetentionCategory(input.retentionCategory);
  const safeName = sanitizeName(input.originalName, scan.ext);
  const visibility: FileVisibility =
    input.visibility === "public" ? "public" : "private";

  // DEDUPE: bestaand object van dezelfde eigenaar hergebruiken?
  let deduped = false;
  let objectPath = await findDedupeObjectPath(input.ownerClerkId, sha256, sizeBytes);
  if (objectPath) {
    deduped = true;
  } else {
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
    // 2. ACL pas NA de PUT: eigenaar-privé of publiek (world-media). Het
    //    serve-pad doet altijd de echte rechtencheck; de object-ACL is de tweede
    //    laag zodat ook de rauwe object-flow geen private bestand lekt.
    objectPath = await svc.trySetObjectEntityAclPolicy(uploadUrl, {
      owner: input.ownerClerkId,
      visibility,
    });
  }

  const [file] = await db
    .insert(filesTable)
    .values({
      ownerClerkId: input.ownerClerkId,
      objectPath,
      originalName: safeName,
      contentType: scan.contentType,
      sizeBytes,
      sha256,
      version: 1,
      retentionCategory,
      visibility,
    })
    .returning();
  // Eerste versie: logicalId gelijk aan de eigen id (start van de keten).
  const [linked] = await db
    .update(filesTable)
    .set({ logicalId: file!.id })
    .where(eq(filesTable.id, file!.id))
    .returning();
  return { ok: true, file: linked!, deduped };
}

// ── Sparki World media (F11-01) ──────────────────────────────────────────────
// De systeem-eigenaar van alle Sparki World-media. Geen echte, inlogbare
// gebruiker — een synthetisch profiel (migratie 0042) puur zodat de
// files.owner_clerk_id-FK bevredigd is voor systeem-eigen bestanden.
export const WORLD_MEDIA_OWNER = "sparki-world";
export const WORLD_MEDIA_RETENTION = "world_media";

// Toegestane video-content-types voor world-media (highlight-clips). Video gaat
// NIET door de her-encode-poort (die is beeld/pdf-only), maar wordt wél via de
// centrale laag geregistreerd (files-rij, publiek, intrekbaar) — dezelfde
// keuze als journey-video in F11 DEEL 2.
const WORLD_MEDIA_VIDEO_TYPES: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

export type RegisterWorldMediaInput = {
  base64: string;
  mimeType: string;
  originalName?: string;
};

// registerWorldMedia (F11-01): registreert gegenereerde Sparki World-bytes via
// de CENTRALE laag als systeem-eigen, PUBLIEK bestand.
//   • Beeld  → volledige scan-/her-encode-poort (registerFile, visibility public).
//   • Video  → geen her-encode (buiten de poort), maar wél een centrale files-rij
//              + publieke object-ACL, zodat intrekking/retentie centraal blijft.
// De cache-first Media Engine (promptKey UNIQUE) blijft ongemoeid: dit is puur
// het opslaan/registreren van de bytes, niet het cachen.
export async function registerWorldMedia(
  input: RegisterWorldMediaInput,
): Promise<RegisterFileResult> {
  const mime = input.mimeType.toLowerCase().split(";")[0]!.trim();
  const originalName = input.originalName || "world-media";

  // Video: raw opslaan (geen her-encode) maar wel centraal geregistreerd.
  const videoExt = WORLD_MEDIA_VIDEO_TYPES[mime];
  if (videoExt) {
    let raw: Buffer;
    try {
      raw = Buffer.from(input.base64, "base64");
    } catch {
      return { ok: false, status: 400, reason: "Ongeldige mediabytes." };
    }
    return registerRawPublicFile({
      ownerClerkId: WORLD_MEDIA_OWNER,
      bytes: raw,
      contentType: mime,
      ext: videoExt,
      originalName,
      retentionCategory: WORLD_MEDIA_RETENTION,
    });
  }

  // Beeld: de volledige centrale veiligheidspoort (scan + her-encode), publiek.
  return registerFile({
    ownerClerkId: WORLD_MEDIA_OWNER,
    base64: input.base64,
    originalName,
    retentionCategory: WORLD_MEDIA_RETENTION,
    visibility: "public",
  });
}

// registerRawPublicFile: interne helper voor bytes die NIET door de her-encode-
// poort gaan (video). Slaat de bytes op, zet een publieke object-ACL en legt een
// centrale files-rij vast met dedupe op checksum (per systeem-eigenaar). Wordt
// uitsluitend voor world-media video gebruikt.
async function registerRawPublicFile(input: {
  ownerClerkId: string;
  bytes: Buffer;
  contentType: string;
  ext: string;
  originalName: string;
  retentionCategory: string;
}): Promise<RegisterFileResult> {
  if (input.bytes.length > FILES_MAX_UPLOAD_BYTES * 8) {
    // Video mag groter zijn dan beeld, maar niet ongelimiteerd.
    return { ok: false, status: 400, reason: "Mediabestand is te groot." };
  }
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const sizeBytes = input.bytes.length;
  const retentionCategory = normalizeRetentionCategory(input.retentionCategory);
  const safeName = sanitizeName(input.originalName, input.ext);

  let deduped = false;
  let objectPath = await findDedupeObjectPath(input.ownerClerkId, sha256, sizeBytes);
  if (objectPath) {
    deduped = true;
  } else {
    const uploadUrl = await svc.getObjectEntityUploadURL();
    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": input.contentType },
      body: input.bytes,
      signal: AbortSignal.timeout(60_000),
    });
    if (!put.ok) {
      return { ok: false, status: 502, reason: "Mediabestand opslaan is niet gelukt." };
    }
    objectPath = await svc.trySetObjectEntityAclPolicy(uploadUrl, {
      owner: input.ownerClerkId,
      visibility: "public",
    });
  }

  const [file] = await db
    .insert(filesTable)
    .values({
      ownerClerkId: input.ownerClerkId,
      objectPath,
      originalName: safeName,
      contentType: input.contentType,
      sizeBytes,
      sha256,
      version: 1,
      retentionCategory,
      visibility: "public",
    })
    .returning();
  const [linked] = await db
    .update(filesTable)
    .set({ logicalId: file!.id })
    .where(eq(filesTable.id, file!.id))
    .returning();
  return { ok: true, file: linked!, deduped };
}

// registerWorldMediaFromObjectPath (F11-01, lazy backfill): een BESTAANDE
// virtual_media-rij (van vóór de omlegging) heeft de bytes al als publiek object
// staan maar nog geen centrale files-rij. Bij de eerstvolgende serve halen we de
// bytes op en registreren ze alsnog centraal, zodat óók oude media intrekbaar en
// centraal beheerd wordt — zonder eenmalige bulk-backfill en zonder stille 500's.
export async function registerWorldMediaFromObjectPath(
  objectPath: string,
): Promise<RegisterFileResult> {
  let got: { base64: string; mimeType: string };
  try {
    got = await svc.getObjectBytes(objectPath);
  } catch {
    return { ok: false, status: 404, reason: "Mediabestand niet gevonden." };
  }
  return registerWorldMedia({
    base64: got.base64,
    mimeType: got.mimeType,
    originalName: "world-media",
  });
}

// claimPresignObject (F11 §5, verplichte eigendomsclaim): een via presign→PUT
// geüpload object heeft nog GEEN ACL (de bytes bestonden nog niet toen de URL
// werd getekend). Deze functie maakt de caller de private eigenaar — maar NOOIT
// via takeover: is het object al van een ANDER, dan weigeren we (403). Zo kan
// niemand met een geraden/bekend objectPath andermans bytes als "eigen" bestand
// laten finaliseren (IDOR-gat). Alleen een ongeclaimd object of een object dat
// de caller al bezit mag door. Faalt het object niet te bestaan ⇒ 400.
async function claimPresignObject(
  ownerClerkId: string,
  objectPath: string,
): Promise<{ ok: true } | { ok: false; status: number; reason: string }> {
  let file;
  try {
    file = await svc.getObjectEntityFile(objectPath);
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      return {
        ok: false,
        status: 400,
        reason: "Het bestand is nog niet geüpload. Probeer het opnieuw.",
      };
    }
    return { ok: false, status: 400, reason: "Het bestand kon niet worden vastgelegd." };
  }
  const existing = await getObjectAclPolicy(file);
  if (existing?.owner && existing.owner !== ownerClerkId) {
    // Takeover geblokkeerd: dit object hoort bij iemand anders.
    return {
      ok: false,
      status: 403,
      reason: "Dit bestand hoort bij een andere gebruiker.",
    };
  }
  await svc.trySetObjectEntityAclPolicy(objectPath, {
    owner: ownerClerkId,
    visibility: "private",
  });
  return { ok: true };
}

// quarantinePresignObject (F11 §5, poort-hygiëne): na een geslaagde registratie
// is de her-encodeerde, veilige kopie leidend (nieuw object via registerFile).
// De RAUWE presign-bron (ongescand, kan EXIF-payloads/polyglots bevatten) mag
// niet blijven bestaan: die is via /api/storage voor de eigenaar bereikbaar en
// omzeilt de poort. We proberen hem te verwijderen; lukt dat niet, dan zetten we
// zijn ACL fail-closed op een niet-bestaande eigenaar (quarantaine) zodat niemand
// hem meer kan ophalen. Best-effort: registratie is al geslaagd, dit is opruimen.
async function quarantinePresignObject(objectPath: string): Promise<void> {
  try {
    const file = await svc.getObjectEntityFile(objectPath);
    try {
      await file.delete();
      return;
    } catch {
      // Verwijderen kan mislukken (permissies); val terug op quarantaine-ACL.
    }
    await svc
      .trySetObjectEntityAclPolicy(objectPath, {
        owner: "__quarantine__",
        visibility: "private",
      })
      .catch(() => undefined);
  } catch {
    // Bron bestaat al niet meer / niet bereikbaar: niets te doen.
  }
}

// registerFromObjectPath (F11 §5, presign-flow): modules die een presign→PUT→
// ACL-op-persist-flow gebruiken (Input Center, Journey-media, Photo Lab) hebben
// de bytes al in object storage staan wanneer ze finaliseren. Deze functie:
//   1. CLAIMT het bronobject verplicht op naam van de caller (nooit takeover) —
//      de claim zit IN deze functie zodat geen enkele aanroeper hem kan vergeten
//      (voorkomt IDOR: finaliseren van andermans objectPath);
//   2. haalt de bytes op en draait ze door de VOLLEDIGE centrale veiligheidspoort
//      (scanFile: grootte, magic-byte-sniff, her-encoding). De veilige bytes
//      komen onder een NIEUW object (via registerFile);
//   3. QUARANTAINEERT de rauwe presign-bron (verwijderen, anders ACL dichtzetten)
//      zodat de ongescande bytes niet via /api/storage bereikbaar blijven.
export async function registerFromObjectPath(input: {
  // Verplicht: op wiens naam het bronobject geclaimd moet worden. Zonder
  // geldige claim registreren we niets (fail-closed tegen IDOR).
  ownerClerkId: string;
  objectPath: string;
  originalName: string;
  retentionCategory?: string;
}): Promise<RegisterFileResult> {
  // 1. Verplichte, niet-overslaanbare eigendomsclaim (nooit takeover).
  const claim = await claimPresignObject(input.ownerClerkId, input.objectPath);
  if (!claim.ok) {
    return { ok: false, status: claim.status, reason: claim.reason };
  }

  // 2. Bytes ophalen en door de poort halen.
  let base64: string;
  try {
    const got = await svc.getObjectBytes(input.objectPath);
    base64 = got.base64;
  } catch {
    return {
      ok: false,
      status: 400,
      reason: "Het bestand is nog niet geüpload. Probeer het opnieuw.",
    };
  }
  const result = await registerFile({
    ownerClerkId: input.ownerClerkId,
    base64,
    originalName: input.originalName,
    retentionCategory: input.retentionCategory,
  });

  // 3. Bij succes: de rauwe bron opruimen/quarantaineren (alleen als het geen
  //    dedupe-hergebruik van exact dit bronobject is — dat kan bij presign niet,
  //    want de veilige kopie krijgt altijd een eigen nieuw pad).
  if (result.ok && result.file.objectPath !== input.objectPath) {
    await quarantinePresignObject(input.objectPath);
  }
  return result;
}

export type ReplaceFileResult =
  | { ok: true; file: FileRecord; deduped?: boolean }
  | { ok: false; status: number; reason: string };

// replaceFile (F11 §1, generiek): vervang een bestaand bestand door een nieuwe
// versie ZONDER historieverlies. De nieuwe versie deelt de logicalId van de
// keten, krijgt versie = hoogste+1, en de VORIGE (actuele) versie wordt via
// supersededById naar de nieuwe gewezen. De oude versie blijft bewaard en
// downloadbaar voor bevoegden zolang die niet is ingetrokken. Onafhankelijk van
// F8 (dat een eigen versietabel heeft die óók naar files.id wijst — dat mag
// blijven; deze centrale keten werkt ook zonder F8).
export async function replaceFile(
  currentFileId: number,
  input: RegisterFileInput,
): Promise<ReplaceFileResult> {
  const current = await getFile(currentFileId);
  if (!current) {
    return { ok: false, status: 404, reason: "Bestand niet gevonden." };
  }
  const logicalId = current.logicalId ?? current.id;
  // Bepaal de hoogste versie binnen de logische keten.
  const chain = await db
    .select({ version: filesTable.version })
    .from(filesTable)
    .where(eq(filesTable.logicalId, logicalId));
  const nextVersion = chain.reduce((mx, r) => Math.max(mx, r.version), current.version) + 1;

  const reg = await registerFile(input);
  if (!reg.ok) return reg;

  // De nieuwe rij in de keten hangen + versie zetten.
  const [linked] = await db
    .update(filesTable)
    .set({ logicalId, version: nextVersion })
    .where(eq(filesTable.id, reg.file.id))
    .returning();
  // De vorige actuele versie naar de nieuwe wijzen (historie blijft bewaard).
  await db
    .update(filesTable)
    .set({ supersededById: reg.file.id })
    .where(eq(filesTable.id, currentFileId));
  return { ok: true, file: linked!, deduped: reg.deduped };
}

// Alle versies van de logische keten waar dit bestand toe behoort, oplopend op
// versienummer. Handig voor "historie tonen aan bevoegden".
export async function listFileVersions(fileId: number): Promise<FileRecord[]> {
  const file = await getFile(fileId);
  if (!file) return [];
  const logicalId = file.logicalId ?? file.id;
  return db
    .select()
    .from(filesTable)
    .where(eq(filesTable.logicalId, logicalId))
    .orderBy(asc(filesTable.version));
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

// Hard-verwijder één files-rij (GEEN object-bytes). Bedoeld om een wees-rij op te
// ruimen die ontstond doordat twee gelijktijdige lazy-koppelingen elk een rij
// registreerden en er precies één de virtual_media-claim wint. De bytes zijn
// dedupe-gedeeld en blijven staan; we verwijderen enkel de overtollige rij zodat
// er exact één files-rij per virtual_media-rij overblijft.
export async function deleteFileRow(fileId: number): Promise<void> {
  await db.delete(filesTable).where(eq(filesTable.id, fileId));
}

// Zoek een F7-bestand op zijn kanonieke object-pad. Wordt gebruikt door de
// GENERIEKE storage-route om F7-bestanden fail-closed te herkennen: die mogen
// nooit via de generieke (eigenaar-)route uit, maar uitsluitend via het
// F7-serve-pad (dat intrekking + bericht-zichtbaarheid + attachment/nosniff
// afdwingt). Een niet-F7-object heeft geen file-record en blijft ongemoeid.
export async function findFileByObjectPath(objectPath: string): Promise<FileRecord | null> {
  const [row] = await db.select().from(filesTable).where(eq(filesTable.objectPath, objectPath));
  return row ?? null;
}

// Alle files-rijen die naar hetzelfde opgeslagen object wijzen. Dedupe op
// checksum kan per eigenaar een eigen rij aanmaken die dezelfde bytes (en dus
// hetzelfde object) deelt; de generieke serve-route moet daarom per caller de
// juiste rij kiezen (levend vs. ingetrokken) i.p.v. een willekeurige.
export async function findFilesByObjectPath(objectPath: string): Promise<FileRecord[]> {
  return db.select().from(filesTable).where(eq(filesTable.objectPath, objectPath));
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

// VEILIGE BESTANDSNAAM (F11 §5): de originele naam is UITSLUITEND metadata voor
// de weergave; het opslagpad blijft een uuid. We saneren hard:
// - pad-tekens (/ \) en control chars (incl. \0, newlines, tabs) verwijderd;
// - geen pad-traversal ("..", losse punten) meer mogelijk;
// - lengtegrens (120 tekens voor de basisnaam);
// - de extensie wordt ALTIJD forcefully afgeleid van het ECHTE (gesnifte) type,
//   nooit van de door de client geclaimde naam (geen misleidende .exe/.docx).
export function sanitizeName(name: string, ext: string): string {
  const base = (name || "bestand")
    // Control chars (0x00–0x1F, 0x7F) weg — voorkomt \0, CR/LF, tab-injectie.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    // Pad-scheidingstekens weg.
    .replace(/[/\\]/g, "_")
    // Bestaande extensie strippen (we forceren de veilige extensie hieronder).
    .replace(/\.[a-z0-9]+$/i, "")
    // Losse punten (pad-traversal ".." / "." ) neutraliseren.
    .replace(/\.+/g, "_")
    .slice(0, 120)
    .trim();
  return `${base || "bestand"}.${ext}`;
}
