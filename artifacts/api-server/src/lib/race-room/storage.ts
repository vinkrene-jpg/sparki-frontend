import { ObjectStorageService } from "../objectStorage";

// Object-storage helpers for Wedstrijd-room. Media items are real uploads (via the
// shared presign flow in routes/storage.ts); here we read those bytes back to
// disk for ffmpeg, and upload the rendered compilation as a new private object
// owned by the athlete.

const svc = new ObjectStorageService();

export async function downloadObjectToBuffer(
  objectPath: string,
): Promise<{ buffer: Buffer; contentType: string }> {
  const file = await svc.getObjectEntityFile(objectPath);
  const [metadata] = await file.getMetadata();
  const [buffer] = await file.download();
  return {
    buffer,
    contentType: (metadata.contentType as string) || "application/octet-stream",
  };
}

// Upload a rendered compilation and return its normalized object path. The
// athlete (clerkId) is the private owner via the object ACL.
export async function uploadRenderedVideo(
  clerkId: string,
  buffer: Buffer,
  contentType = "video/mp4",
): Promise<string> {
  const uploadUrl = await svc.getObjectEntityUploadURL();
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: buffer,
    signal: AbortSignal.timeout(120_000),
  });
  if (!put.ok) {
    throw new Error(`Upload van de compilatie mislukt (status ${put.status})`);
  }
  return svc.trySetObjectEntityAclPolicy(uploadUrl, {
    owner: clerkId,
    visibility: "private",
  });
}
