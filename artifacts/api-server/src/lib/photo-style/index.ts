import { editImage } from "@workspace/integrations-gemini-ai/image";
import { ObjectStorageService } from "../objectStorage";
import { getObjectAclPolicy } from "../objectAcl";

// Raised when a caller tries to claim an object that another user already owns.
// The route maps this to 403 (never 500) so the access denial stays honest.
export class PhotoOwnershipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PhotoOwnershipError";
  }
}

// Sparki Photo Lab — server-side "Sparki-style" relight of a real uploaded photo.
//
// The athlete uploads their real photo straight to object storage (the
// "original" variant). Here we read those bytes back, ask the image model to
// relight the SAME real photo into the Sparki-Lab look (never a cartoon/avatar,
// never a distorted face), and store the result as a SECOND object (the
// "sparki_style" variant). The original is never touched, so it always stays
// usable — including when styling fails.

const svc = new ObjectStorageService();

// The single instruction that defines the Sparki-Lab look. It is deliberately
// strict about keeping a realistic photo of the SAME person: relight and calm
// the scene, do not restyle the human.
export const SPARKI_STYLE_PROMPT = [
  "Edit this photograph into the 'Sparki Lab' look: a dark, premium, cinematic",
  "performance-lab atmosphere.",
  "Keep it a REALISTIC PHOTOGRAPH of the SAME real person.",
  "Do NOT change, smooth, beautify, stylise, or distort the face, body, identity,",
  "age, pose or proportions in any way.",
  "Do NOT turn it into a cartoon, illustration, avatar, painting or 3D render.",
  "Keep the person sharp and clearly the central subject.",
  "Make the background subtly darker and calmer, reduce background clutter and",
  "busyness so the subject stands out, add gentle atmospheric depth, deep",
  "blue-black tones, a soft cool cyan/teal glow and rim light around the subject,",
  "and a subtle vignette.",
  "Photorealistic, natural skin, high quality. Output only the edited image.",
].join(" ");

export type PhotoBytes = { base64: string; mediaType: string };

// Read a stored object back as base64 + its content type.
export async function readPhotoBase64(objectPath: string): Promise<PhotoBytes> {
  const file = await svc.getObjectEntityFile(objectPath);
  const [metadata] = await file.getMetadata();
  const [buffer] = await file.download();
  return {
    base64: buffer.toString("base64"),
    mediaType: (metadata.contentType as string) || "image/jpeg",
  };
}

// Make the caller the private owner of an already-uploaded object. The client
// uploaded the original via a presigned URL (which cannot set an ACL yet because
// the bytes did not exist), so we lock ownership here once they do.
//
// Guard against ownership takeover: a freshly presigned upload has no ACL yet
// (owner is unset), so the legitimate flow proceeds. But if the object is
// ALREADY owned by a different user, we refuse — a caller may only claim an
// unowned object or one they already own. This blocks reassigning the ACL of
// someone else's object via a guessed/known path.
export async function claimOwnership(
  clerkId: string,
  objectPath: string,
): Promise<string> {
  const file = await svc.getObjectEntityFile(objectPath);
  const existing = await getObjectAclPolicy(file);
  if (existing?.owner && existing.owner !== clerkId) {
    throw new PhotoOwnershipError("Deze foto hoort bij een andere gebruiker");
  }
  return svc.trySetObjectEntityAclPolicy(objectPath, {
    owner: clerkId,
    visibility: "private",
  });
}

// Upload the styled bytes as a new private object owned by the caller.
export async function uploadStyledPhoto(
  clerkId: string,
  photo: PhotoBytes,
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
    throw new Error(`Opslaan van Sparki-versie mislukt (status ${put.status})`);
  }
  return svc.trySetObjectEntityAclPolicy(uploadUrl, {
    owner: clerkId,
    visibility: "private",
  });
}

export type StylizeResult = {
  styledPath: string;
  styledDataUrl: string;
  mediaType: string;
};

// Read the original, relight it into the Sparki look, and store the result.
// Throws on failure so the route can record an honest "failed" state and keep
// the original usable.
export async function stylizePhoto(
  clerkId: string,
  originalPath: string,
): Promise<StylizeResult> {
  const original = await readPhotoBase64(originalPath);
  const edited = await editImage(
    { base64: original.base64, mimeType: original.mediaType },
    SPARKI_STYLE_PROMPT,
  );
  const styledPath = await uploadStyledPhoto(clerkId, {
    base64: edited.b64_json,
    mediaType: edited.mimeType,
  });
  return {
    styledPath,
    styledDataUrl: `data:${edited.mimeType};base64,${edited.b64_json}`,
    mediaType: edited.mimeType,
  };
}
