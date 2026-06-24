import { ObjectStorageService } from "../objectStorage";
import { ObjectPermission } from "../objectAcl";

// Server-side photo storage for the Materiaalcoach. Photos are real uploads:
// the client sends the bytes (base64), we persist them in object storage under
// the private dir with the owner's clerkId on the ACL, and store the normalized
// object path on the analysis row. We never keep raw image bytes in the DB.

export type StoredPhotoInput = {
  // Raw base64 (no data-URL prefix).
  base64: string;
  mediaType: string;
};

const svc = new ObjectStorageService();

// Upload one photo and return its normalized object path ("/objects/...").
export async function uploadMaterialPhoto(
  clerkId: string,
  photo: StoredPhotoInput,
): Promise<string> {
  const uploadUrl = await svc.getObjectEntityUploadURL();
  const buffer = Buffer.from(photo.base64, "base64");

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": photo.mediaType },
    body: buffer,
    signal: AbortSignal.timeout(30_000),
  });
  if (!put.ok) {
    throw new Error(`Foto-upload mislukt (status ${put.status})`);
  }

  return svc.trySetObjectEntityAclPolicy(uploadUrl, {
    owner: clerkId,
    visibility: "private",
  });
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
