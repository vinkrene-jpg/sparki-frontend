// Sparki World — Media Engine (cache-first beeld).
//
// The single facade that turns a *semantic description* of a wanted image into a
// stored, reusable object. Its whole reason to exist is AGGRESSIVE REUSE: a
// deterministic `promptKey` is derived from the description, and an image is
// generated ONLY when no row already matches that key. Two requests with the
// same key resolve to the same stored object — we never pay to generate the same
// picture twice.
//
//   • Avatars are unique per athlete  → the key includes the athlete slug.
//   • Scenes are shared across the world → the key has NO athlete identity, so a
//     "rainy gravel forest climb" is generated once and reused by everyone.
//
// All Sparki World media is system-owned and stored PUBLIC (any signed-in user
// can read it through the existing object-serve route), which is correct for a
// shared feed and keeps it walled off from private, user-owned objects.
//
// Honesty contract: when generation fails we persist an honest "failed" row with
// a reason and return it with `objectPath === null`. Callers must treat a null
// path as "no image" (skip / text-only) and NEVER substitute a placeholder that
// poses as a real generated photo.

import { eq, inArray, sql } from "drizzle-orm";
import {
  db,
  virtualMediaTable,
  type VirtualMedia,
  type VirtualMediaKind,
} from "@workspace/db";
import { generateImage } from "@workspace/integrations-gemini-ai/image";
import { generateVideo } from "@workspace/integrations-gemini-ai/video";
import { ObjectStorageService } from "../../lib/objectStorage";

const svc = new ObjectStorageService();

// System owner for every Sparki World asset (not a real user).
const SYSTEM_OWNER = "sparki-world";

export type MediaPurpose =
  | "avatar"
  | "scene"
  | "equipment"
  | "podium"
  | "highlight";

// A semantic description of a wanted image. Only defined, non-empty fields take
// part in the cache key, so callers can pass a sparse, meaningful subset.
export type MediaAttributes = Record<
  string,
  string | number | boolean | null | undefined
>;

export type ResolveMediaInput = {
  purpose: MediaPurpose;
  attributes: MediaAttributes;
  aspectRatio?: string;
  // Override the auto-built prompt (rarely needed; the key still drives reuse).
  prompt?: string;
  kind?: VirtualMediaKind; // defaults to "image" (video = phase 2)
};

// Injectable dependencies — real generation/upload by default, stubbable in
// tests so cache behaviour can be proven without calling the image model.
export type MediaDeps = {
  generate?: (prompt: string) => Promise<{ b64_json: string; mimeType: string }>;
  upload?: (bytes: { base64: string; mimeType: string }) => Promise<string>;
};

// ── prompt key ───────────────────────────────────────────────────────────────
function normValue(v: unknown): string {
  return String(v).trim().toLowerCase().replace(/\s+/g, "-");
}

// Deterministic, human-readable cache key. Same description → same key,
// regardless of attribute insertion order.
export function buildPromptKey(
  purpose: MediaPurpose,
  attributes: MediaAttributes,
): string {
  const parts = Object.entries(attributes)
    .filter(
      ([, v]) => v !== undefined && v !== null && String(v).trim() !== "",
    )
    .map(([k, v]) => `${k}=${normValue(v)}`)
    .sort();
  return [purpose, ...parts].join("|");
}

// ── prompt text ──────────────────────────────────────────────────────────────
// Builds a tasteful, realistic, cinematic photographic prompt from the semantic
// attributes. Always realistic photography (never cartoon/illustration) and
// always a FICTIONAL person — the transparency that this is simulated lives in
// the UI labelling, not in the pixels.
const SPARKI_LOOK = [
  "Cinematic, premium sports photography.",
  "Deep blue-black tones, soft cool cyan/teal rim light, gentle atmospheric haze,",
  "subtle vignette, natural realistic colours, high dynamic range.",
  "Photorealistic, sharp, high quality. Output only the image.",
].join(" ");

function disciplineScene(discipline?: string): string {
  switch ((discipline || "").toLowerCase()) {
    case "weg":
      return "road cycling on open tarmac roads";
    case "gravel":
      return "gravel cycling on a forest gravel path";
    case "mtb":
      return "mountain biking on a technical trail";
    case "baan":
      return "track cycling in a velodrome";
    case "triatlon":
      return "triathlon training";
    default:
      return "cycling";
  }
}

function sceneSetting(scene?: string): string {
  switch ((scene || "").toLowerCase()) {
    case "climb":
      return "a long mountain climb with switchbacks";
    case "timetrial":
      return "a flat time-trial effort in an aero position";
    case "podium":
      return "a race podium celebration";
    case "coffee_stop":
      return "a relaxed coffee stop after a ride";
    case "gym":
      return "a strength session in a gym";
    case "indoor_trainer":
      return "an indoor smart-trainer session in a dark room";
    case "gravel_forest":
      return "a winding gravel path through a forest";
    case "recovery":
      return "an easy recovery spin on quiet roads";
    case "altitude_camp":
      return "a high-altitude training camp in the mountains";
    default:
      return "";
  }
}

function weatherClause(weather?: string): string {
  switch ((weather || "").toLowerCase()) {
    case "sun":
      return "bright sunny weather";
    case "rain":
      return "wet rainy weather, glistening road";
    case "overcast":
      return "soft overcast light";
    case "snow":
      return "cold snowy conditions";
    case "fog":
      return "low morning fog";
    default:
      return "";
  }
}

function timeClause(timeOfDay?: string): string {
  switch ((timeOfDay || "").toLowerCase()) {
    case "dawn":
      return "at dawn";
    case "golden_hour":
      return "in golden-hour light";
    case "night":
      return "at night under artificial light";
    default:
      return "";
  }
}

function genderNoun(gender?: string): string {
  switch ((gender || "").toLowerCase()) {
    case "v":
      return "female";
    case "m":
      return "male";
    default:
      return "";
  }
}

export function buildPrompt(
  purpose: MediaPurpose,
  attrs: MediaAttributes,
): string {
  const a = attrs as Record<string, unknown>;
  if (purpose === "avatar") {
    const gender = genderNoun(a.gender as string);
    const age = typeof a.age === "number" ? `${a.age}-year-old` : "";
    const subject = [age, gender, "amateur cyclist"]
      .filter(Boolean)
      .join(" ");
    return [
      `A realistic portrait headshot of a fictional ${subject}.`,
      "Natural face, candid and approachable, athletic build.",
      "Plain dark background.",
      SPARKI_LOOK,
    ]
      .filter(Boolean)
      .join(" ");
  }

  // scene / equipment / podium
  const setting =
    sceneSetting(a.scene as string) || disciplineScene(a.discipline as string);
  const weather = weatherClause(a.weather as string);
  const time = timeClause(a.timeOfDay as string);
  const subject =
    purpose === "equipment"
      ? "a detail shot of cycling equipment (bike, wheels or gear)"
      : `a fictional cyclist during ${setting}`;
  return [
    `${subject}${time ? " " + time : ""}${weather ? ", " + weather : ""}.`,
    "No recognisable real people or logos.",
    SPARKI_LOOK,
  ]
    .filter(Boolean)
    .join(" ");
}

// ── video prompt text ────────────────────────────────────────────────────────
// A short, loop-friendly cinematic highlight clip of a FICTIONAL cyclist. Same
// honesty rules as the still prompts: realistic live-action look, no real people
// or brands; the "this is simulated" transparency lives in the UI labelling.
const SPARKI_CLIP_LOOK = [
  "Cinematic, premium sports cinematography, smooth steady motion.",
  "Deep blue-black tones, cool cyan/teal rim light, gentle atmospheric haze,",
  "shallow depth of field, natural realistic colours.",
  "Photorealistic live-action footage, seamless and loop-friendly.",
  "No text, captions or logos.",
].join(" ");

export function buildVideoPrompt(
  purpose: MediaPurpose,
  attrs: MediaAttributes,
): string {
  const a = attrs as Record<string, unknown>;
  const setting =
    sceneSetting(a.scene as string) || disciplineScene(a.discipline as string);
  const weather = weatherClause(a.weather as string);
  const time = timeClause(a.timeOfDay as string);
  return [
    `A short cinematic highlight clip of a fictional cyclist during ${setting}${time ? " " + time : ""}${weather ? ", " + weather : ""}.`,
    "Dynamic yet smooth camera movement, the rider in powerful flowing motion.",
    "No recognisable real people or brands.",
    SPARKI_CLIP_LOOK,
  ]
    .filter(Boolean)
    .join(" ");
}

// ── upload ───────────────────────────────────────────────────────────────────
// Upload generated bytes as a PUBLIC, system-owned object and return its
// normalized object path (e.g. "/objects/uploads/<uuid>").
async function uploadPublic(bytes: {
  base64: string;
  mimeType: string;
}): Promise<string> {
  const uploadUrl = await svc.getObjectEntityUploadURL();
  const buffer = Buffer.from(bytes.base64, "base64");
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": bytes.mimeType },
    body: buffer,
    signal: AbortSignal.timeout(30_000),
  });
  if (!put.ok) {
    throw new Error(`Opslaan van beeld mislukt (status ${put.status})`);
  }
  return svc.trySetObjectEntityAclPolicy(uploadUrl, {
    owner: SYSTEM_OWNER,
    visibility: "public",
  });
}

// ── resolve (cache-first) ────────────────────────────────────────────────────
// Returns the stored media row for the given description, generating a new image
// only on a cache miss. A previously "failed" row is retried (honesty: we keep
// trying rather than permanently serving a dead asset), but a "ready" row is
// returned untouched — guaranteeing no re-generation.
export async function resolveMedia(
  input: ResolveMediaInput,
  deps: MediaDeps = {},
): Promise<VirtualMedia> {
  const kind = input.kind ?? "image";
  const isVideo = kind === "video";
  const aspectRatio = input.aspectRatio ?? (isVideo ? "16:9" : "1:1");
  // Video clips go through Veo; images through the image model. Both return the
  // same { b64_json, mimeType } shape so upload/persist stays uniform.
  const generate =
    deps.generate ??
    (isVideo
      ? (p: string) =>
          generateVideo(p, {
            aspectRatio: aspectRatio === "9:16" ? "9:16" : "16:9",
            durationSeconds: 6,
          })
      : generateImage);
  const upload = deps.upload ?? uploadPublic;
  const promptKey = buildPromptKey(input.purpose, input.attributes);

  const [existing] = await db
    .select()
    .from(virtualMediaTable)
    .where(eq(virtualMediaTable.promptKey, promptKey))
    .limit(1);

  if (existing && existing.status === "ready" && existing.objectPath) {
    await db
      .update(virtualMediaTable)
      .set({ reuseCount: sql`${virtualMediaTable.reuseCount} + 1` })
      .where(eq(virtualMediaTable.id, existing.id));
    return { ...existing, reuseCount: existing.reuseCount + 1 };
  }

  const prompt =
    input.prompt ??
    (isVideo
      ? buildVideoPrompt(input.purpose, input.attributes)
      : buildPrompt(input.purpose, input.attributes));

  try {
    const img = await generate(prompt);
    const objectPath = await upload({
      base64: img.b64_json,
      mimeType: img.mimeType,
    });
    const [row] = await db
      .insert(virtualMediaTable)
      .values({
        kind,
        purpose: input.purpose,
        promptKey,
        prompt,
        objectPath,
        aspectRatio,
        status: "ready",
        failureReason: null,
        attributes: input.attributes as Record<string, unknown>,
        reuseCount: 0,
      })
      .onConflictDoUpdate({
        target: virtualMediaTable.promptKey,
        set: {
          objectPath,
          status: "ready",
          failureReason: null,
          prompt,
        },
      })
      .returning();
    return row;
  } catch (err) {
    const reason = err instanceof Error ? err.message : "onbekende fout";
    const [row] = await db
      .insert(virtualMediaTable)
      .values({
        kind,
        purpose: input.purpose,
        promptKey,
        prompt,
        objectPath: null,
        aspectRatio,
        status: "failed",
        failureReason: reason,
        attributes: input.attributes as Record<string, unknown>,
        reuseCount: 0,
      })
      .onConflictDoUpdate({
        target: virtualMediaTable.promptKey,
        set: { status: "failed", failureReason: reason },
      })
      .returning();
    return row;
  }
}

// Per-athlete unique avatar. The slug is part of the key so each athlete keeps
// their own face, while shared appearance attributes stay readable for audits.
export async function getOrCreateAvatar(
  athlete: {
    slug: string;
    gender?: string | null;
    age?: number | null;
  },
  deps: MediaDeps = {},
): Promise<VirtualMedia> {
  return resolveMedia(
    {
      purpose: "avatar",
      attributes: {
        slug: athlete.slug,
        gender: athlete.gender ?? undefined,
        age: athlete.age ?? undefined,
      },
    },
    deps,
  );
}

// Shared scene image — NO athlete identity in the key, so equivalent scenes are
// generated once and reused across the whole world.
export async function getOrCreateScene(
  descriptor: {
    discipline?: string | null;
    scene?: string | null;
    weather?: string | null;
    timeOfDay?: string | null;
  },
  deps: MediaDeps = {},
): Promise<VirtualMedia> {
  return resolveMedia(
    {
      purpose: "scene",
      aspectRatio: "4:5",
      attributes: {
        discipline: descriptor.discipline ?? undefined,
        scene: descriptor.scene ?? undefined,
        weather: descriptor.weather ?? undefined,
        timeOfDay: descriptor.timeOfDay ?? undefined,
      },
    },
    deps,
  );
}

// ── highlight clips ──────────────────────────────────────────────────────────
// A short looping highlight VIDEO that belongs to one athlete. The slug is part
// of the key (like the avatar) so each athlete keeps their own clip, while the
// scene is derived from their discipline/archetype so the action fits the rider.
type HighlightAthlete = {
  slug: string;
  discipline?: string | null;
  archetype?: string | null;
};

// Pick a fitting action scene for the rider from their archetype, falling back
// to a discipline-appropriate effort. Kept deterministic for stable cache keys.
function highlightScene(athlete: HighlightAthlete): string {
  switch ((athlete.archetype || "").toLowerCase()) {
    case "klimmer":
    case "klassementsrenner":
      return "climb";
    case "tijdrijder":
      return "timetrial";
    case "sprinter":
    case "puncheur":
      return "podium";
    default:
      break;
  }
  switch ((athlete.discipline || "").toLowerCase()) {
    case "mtb":
      return "gravel_forest";
    case "gravel":
      return "gravel_forest";
    case "baan":
      return "timetrial";
    default:
      return "climb";
  }
}

function highlightAttributes(athlete: HighlightAthlete): MediaAttributes {
  return {
    slug: athlete.slug,
    discipline: athlete.discipline ?? undefined,
    scene: highlightScene(athlete),
  };
}

// Deterministic cache key for an athlete's highlight clip. Exposed so read paths
// (e.g. the feed engine) can look up a clip WITHOUT generating one.
export function highlightKeyFor(athlete: HighlightAthlete): string {
  return buildPromptKey("highlight", highlightAttributes(athlete));
}

export async function getOrCreateHighlight(
  athlete: HighlightAthlete,
  deps: MediaDeps = {},
): Promise<VirtualMedia> {
  return resolveMedia(
    {
      purpose: "highlight",
      kind: "video",
      aspectRatio: "16:9",
      attributes: highlightAttributes(athlete),
    },
    deps,
  );
}

// Look up READY highlight clips for a set of athletes and return a slug → URL
// map. Only "ready" rows with a real object path are returned — absent, pending
// or failed clips are simply omitted, so callers fall back gracefully (never a
// fabricated placeholder).
export async function readyHighlightUrls(
  athletes: HighlightAthlete[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (athletes.length === 0) return out;

  const keyToSlug = new Map<string, string>();
  for (const a of athletes) keyToSlug.set(highlightKeyFor(a), a.slug);

  const rows = await db
    .select({
      promptKey: virtualMediaTable.promptKey,
      objectPath: virtualMediaTable.objectPath,
      status: virtualMediaTable.status,
    })
    .from(virtualMediaTable)
    .where(inArray(virtualMediaTable.promptKey, [...keyToSlug.keys()]));

  for (const r of rows) {
    if (r.status !== "ready" || !r.objectPath) continue;
    const slug = keyToSlug.get(r.promptKey);
    const url = mediaUrl(r.objectPath);
    if (slug && url) out.set(slug, url);
  }
  return out;
}

// Public URL the frontend uses to load a stored asset (objectPath like
// "/objects/uploads/x" → "/api/storage/objects/uploads/x"). Null-safe so callers
// can pass an absent path through untouched.
export function mediaUrl(objectPath: string | null): string | null {
  if (!objectPath) return null;
  return `/api/storage${objectPath}`;
}
