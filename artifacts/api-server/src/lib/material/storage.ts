import { ObjectStorageService } from "../objectStorage";
import { ObjectPermission } from "../objectAcl";
import { registerFile } from "../files";

// Server-side photo storage for the Materiaalcoach (en de mede-gebruikers
// Voeding, Garage en Fietsscan). Photos are real uploads: the client sends the
// bytes (base64) and we persist them. We never keep raw image bytes in the DB.
//
// F11 (reviewpunt 4a): de bytes lopen nu VERPLICHT door de centrale
// veiligheidspoort (registerFile: grootte, magic-byte-sniff, her-encoding). Zo
// is er geen ongescande upload-route meer. Her-encoding maakt van het gros een
// jpeg; een PNG MET transparantie blijft PNG (nodig voor de fietsscan-cutout —
// zie scanFile). Dedupe/retentie/intrekbaarheid komen automatisch mee via de
// centrale files-rij.

export type StoredPhotoInput = {
  // Raw base64 (no data-URL prefix).
  base64: string;
  mediaType: string;
};

const svc = new ObjectStorageService();

// Fout die de httpStatus van de poort meedraagt (415 verkeerd type, 400 te
// groot), zodat routes een eerlijke statuscode kunnen teruggeven.
export class MaterialPhotoRejected extends Error {
  httpStatus: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "MaterialPhotoRejected";
    this.httpStatus = status;
  }
}

// Upload één foto via de centrale poort en geef de centrale files-rij terug
// (objectPath + fileId). fileId is de bron van waarheid (intrekbaar via files).
export async function storeMaterialPhotoViaGate(
  clerkId: string,
  photo: StoredPhotoInput,
  retentionCategory: string = "media",
): Promise<{ objectPath: string; fileId: number; contentType: string }> {
  const reg = await registerFile({
    ownerClerkId: clerkId,
    base64: photo.base64,
    originalName: "foto",
    retentionCategory,
  });
  if (!reg.ok) {
    throw new MaterialPhotoRejected(reg.status, reg.reason);
  }
  return {
    objectPath: reg.file.objectPath,
    fileId: reg.file.id,
    contentType: reg.file.contentType,
  };
}

// Backward-compatibele wrapper: geeft alleen het genormaliseerde objectPath
// ("/objects/...") terug, maar loopt nu WEL door de centrale poort. Bestaande
// aanroepers (Voeding, Garage, Fietsscan) hoeven hun opslagvorm niet te wijzigen;
// de foto is voortaan gescand en her-encodeerd.
export async function uploadMaterialPhoto(
  clerkId: string,
  photo: StoredPhotoInput,
): Promise<string> {
  const stored = await storeMaterialPhotoViaGate(clerkId, photo, "media");
  return stored.objectPath;
}

// Read a stored photo back as base64 (used when re-running analysis with an
// added photo so the whole case is judged together).
export async function readMaterialPhotoBase64(
  objectPath: string,
): Promise<StoredPhotoInput> {
  const file = await svc.getObjectEntityFile(objectPath);
  const [metadata] = await file.getMetadata();
  const [buffer] = await file.download();
  return {
    base64: buffer.toString("base64"),
    mediaType: (metadata.contentType as string) || "image/jpeg",
  };
}

// Stream a stored photo to an Express response, after the caller has verified
// ownership. Returns false when the object is missing.
export async function streamMaterialPhoto(
  objectPath: string,
  res: {
    setHeader: (k: string, v: string) => void;
    status: (n: number) => unknown;
  },
): Promise<NodeJS.ReadableStream> {
  const file = await svc.getObjectEntityFile(objectPath);
  const [metadata] = await file.getMetadata();
  res.setHeader(
    "Content-Type",
    (metadata.contentType as string) || "application/octet-stream",
  );
  res.setHeader("Cache-Control", "private, max-age=3600");
  if (metadata.size) res.setHeader("Content-Length", String(metadata.size));
  return file.createReadStream();
}

export { ObjectPermission };
