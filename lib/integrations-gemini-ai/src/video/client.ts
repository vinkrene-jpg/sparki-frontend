import { ai } from "../client";

export type GenerateVideoOptions = {
  // Veo only supports landscape or portrait — never square.
  aspectRatio?: "16:9" | "9:16";
  durationSeconds?: number;
  negativePrompt?: string;
};

// Generate a short video clip from a text prompt via Veo (Gemini AI
// Integrations proxy). Returns the raw bytes base64-encoded together with their
// mime type, mirroring `generateImage` so callers can treat both uniformly.
//
// Generation is asynchronous on the model side: we kick off the operation and
// poll until it is done (bounded by a hard deadline so a stuck job fails
// honestly instead of hanging forever). If the proxy/model cannot produce a
// video the call throws — the caller is expected to record that honestly and
// fall back gracefully, never substituting a fake clip.
export async function generateVideo(
  prompt: string,
  opts: GenerateVideoOptions = {},
): Promise<{ b64_json: string; mimeType: string }> {
  const model = process.env.GEMINI_VIDEO_MODEL || "veo-3.0-fast-generate-001";

  let operation = await ai.models.generateVideos({
    model,
    prompt,
    config: {
      aspectRatio: opts.aspectRatio ?? "16:9",
      numberOfVideos: 1,
      ...(opts.durationSeconds
        ? { durationSeconds: opts.durationSeconds }
        : {}),
      ...(opts.negativePrompt ? { negativePrompt: opts.negativePrompt } : {}),
    },
  });

  // Poll until done, with a hard ceiling so a stuck operation fails honestly.
  const deadlineMs = Date.now() + 5 * 60 * 1000;
  while (!operation.done) {
    if (Date.now() > deadlineMs) {
      throw new Error("Videogeneratie duurde te lang");
    }
    await new Promise((resolve) => setTimeout(resolve, 8000));
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const generated = operation.response?.generatedVideos?.[0];
  const video = generated?.video;
  if (!video) {
    throw new Error("Geen video in de respons");
  }

  // Prefer inline bytes; otherwise download the returned file URI (the proxy
  // returns a signed/keyed URI that needs the API key appended).
  const inline = (video as { videoBytes?: string | Uint8Array }).videoBytes;
  if (inline) {
    return {
      b64_json:
        typeof inline === "string"
          ? inline
          : Buffer.from(inline).toString("base64"),
      mimeType: video.mimeType || "video/mp4",
    };
  }

  const uri = (video as { uri?: string }).uri;
  if (uri) {
    const sep = uri.includes("?") ? "&" : "?";
    const res = await fetch(
      `${uri}${sep}key=${process.env.AI_INTEGRATIONS_GEMINI_API_KEY}`,
      { signal: AbortSignal.timeout(60_000) },
    );
    if (!res.ok) {
      throw new Error(`Video ophalen mislukt (status ${res.status})`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      b64_json: buf.toString("base64"),
      mimeType: video.mimeType || "video/mp4",
    };
  }

  throw new Error("Video bevatte geen data");
}
