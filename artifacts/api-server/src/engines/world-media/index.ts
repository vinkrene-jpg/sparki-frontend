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
import { generateImage, editImage } from "@workspace/integrations-gemini-ai/image";
import { generateVideo } from "@workspace/integrations-gemini-ai/video";
import { ObjectStorageService } from "../../lib/objectStorage";

const svc = new ObjectStorageService();

// System owner for every Sparki World asset (not a real user).
const SYSTEM_OWNER = "sparki-world";

export type MediaPurpose =
  | "avatar"
  | "scene"
  | "post"
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
// Bump to force a fresh look across the whole cast (changes every cache key, so
// "ready" rows are no longer reused and new imagery is generated).
const STYLE_VERSION = "v2";

// Authentic, social-media look — deliberately NOT an over-polished cinematic
// studio/stock photo (the previous uniform teal wash made every image look the
// same). Reads like a real photo shot on a modern phone.
const WORLD_LOOK = [
  "Authentic candid social-media photo, looks shot on a modern smartphone.",
  "Natural lighting, true real-world colours for the location, believable and lightly imperfect.",
  "Sharp and high quality but NOT an over-polished studio or stock photo.",
  "Photorealistic. Output only the image.",
].join(" ");

// Honesty line shared by every still: the person is invented and so is every
// sponsor/brand — we never depict a real recognisable individual or a real-world
// company logo. The transparency that this is simulated lives in the UI label.
const HONESTY_LINE =
  "This is a made-up, fictional person — do not depict any real, recognisable individual. " +
  "Any sponsor names or bike branding are invented, fictional wordmarks only — no real-world brand logos.";

// ── deterministic pickers (stable per athlete, so a face/team stays consistent) ─
function hashStr(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function pickBy<T>(arr: readonly T[], seed: string): T {
  return arr[hashStr(seed) % arr.length]!;
}

// ── per-athlete appearance (makes every face DISTINCT & recognisable) ──────────
const SKIN = ["light", "fair", "lightly tanned", "olive", "tanned", "brown", "dark brown"];
const HAIR_COLOR = ["dark brown", "black", "blonde", "light brown", "auburn", "ginger", "ash brown"];
const HAIR_M = ["short cropped hair", "a buzz cut", "messy short hair", "short curly hair", "a man bun", "slicked-back hair"];
const HAIR_V = ["a high ponytail", "long straight hair", "shoulder-length wavy hair", "a short bob", "braided hair", "hair tied back in a bun"];
const FACIAL_HAIR = ["clean-shaven", "clean-shaven", "light stubble", "a short trimmed beard", "a moustache"];
const FACE_FEATURE = ["a sharp jawline", "a friendly round face", "light freckles", "strong cheekbones", "kind expressive eyes", "angular features", "a warm easy smile"];

function buildName(gender?: string): string {
  return (gender || "").toLowerCase() === "v" ? "female" : "male";
}

// A compact, deterministic description of one athlete's looks. Climbers read
// lean, sprinters muscular; everything else is slug-seeded so each athlete is a
// distinct, repeatable person.
function appearanceFor(a: {
  slug: string;
  gender?: string;
  age?: number;
  archetype?: string;
}): string {
  const slug = a.slug || "x";
  const sex = buildName(a.gender);
  const arch = (a.archetype || "").toLowerCase();
  const build = /klimmer|ultra|marathon|cross-country|duur/.test(arch)
    ? "a lean, wiry cyclist's build"
    : /sprinter|baansprinter|achtervolger/.test(arch)
      ? "a powerful, muscular sprinter's build"
      : "a fit, athletic build";
  const hair =
    sex === "female" ? pickBy(HAIR_V, `${slug}:hair`) : pickBy(HAIR_M, `${slug}:hair`);
  const facial =
    sex === "male" ? `, ${pickBy(FACIAL_HAIR, `${slug}:beard`)}` : "";
  return [
    `${pickBy(SKIN, `${slug}:skin`)} skin`,
    `${pickBy(HAIR_COLOR, `${slug}:haircol`)} ${hair}${facial}`,
    pickBy(FACE_FEATURE, `${slug}:face`),
    build,
  ].join(", ");
}

// ── per-team fictional kit + bike brand (one consistent make per team) ─────────
const BIKE_BRANDS = ["Velora", "Aeronaut", "Strade", "Northwind", "Apex", "Solstice", "Ridgeline", "Falcone", "Borealis", "Kestrel-V"];
const KIT_SPONSORS = ["NOVA Energy", "Helder", "Polderbank", "Tidal", "Volt", "Meridiaan", "Kanttek", "Berglicht", "Hexa", "Zephyr"];
const KIT_COLORS = ["teal and black", "red and white", "navy and orange", "black and neon yellow", "white and royal blue", "forest green and grey", "deep purple and white", "crimson and charcoal"];

function teamKitFor(team?: string | null): {
  bikeBrand: string;
  sponsor: string;
  colors: string;
} {
  if (team && team.trim()) {
    const t = team.trim();
    return {
      bikeBrand: pickBy(BIKE_BRANDS, `${t}:bike`),
      sponsor: pickBy(KIT_SPONSORS, `${t}:kit`),
      colors: pickBy(KIT_COLORS, `${t}:col`),
    };
  }
  return { bikeBrand: "", sponsor: "", colors: "" };
}

// Pro-style kit clause. Team riders wear matching team kit with a fictional
// sponsor wordmark; unaffiliated riders wear plausible casual club kit.
function kitClause(team?: string | null, slug?: string): string {
  const k = teamKitFor(team);
  if (k.sponsor) {
    return `wearing pro team cycling kit in ${k.colors} with the fictional sponsor wordmark "${k.sponsor}" across the chest`;
  }
  return `wearing a neat casual club cycling kit in ${pickBy(KIT_COLORS, `${slug || "x"}:col`)}`;
}
function bikeClause(team?: string | null): string {
  const k = teamKitFor(team);
  return k.bikeBrand
    ? `riding a high-end road bike with the fictional brand "${k.bikeBrand}" on the frame`
    : "riding a quality road bike";
}

// ── varied real-world locations across Europe AND the USA ──────────────────────
const LOC_ROAD = [
  "the Dolomites in Italy", "Mallorca's coastal mountain roads in Spain",
  "the Stelvio Pass switchbacks in the Alps", "the cobbled farm roads of Flanders, Belgium",
  "Mont Ventoux in Provence, France", "the Black Forest in Germany",
  "the green Yorkshire Dales in England", "the rolling countryside around Girona, Spain",
  "the Dutch coastal dunes by the North Sea", "the forested Ardennes in Belgium",
  "the Pacific Coast Highway in California, USA", "the Colorado Rockies near Boulder, USA",
  "the desert highways near Moab, Utah, USA", "an autumn back road in Vermont, USA",
  "the Blue Ridge Parkway in North Carolina, USA", "the Marin Headlands near San Francisco, USA",
];
const LOC_GRAVEL = [
  "a dusty gravel road through Tuscany, Italy", "a forest gravel track in the Veluwe, Netherlands",
  "a vineyard gravel path in Burgundy, France", "the gravel backroads of Girona, Spain",
  "the red gravel of Moab, Utah, USA", "a Vermont dirt road in autumn, USA",
  "the gravel ranch roads of Kansas, USA", "a Black Forest gravel trail in Germany",
];
const LOC_MTB = [
  "a flowy mountain-bike trail in the Alps", "a rocky singletrack in the Dolomites, Italy",
  "a pine-forest trail in the Ardennes, Belgium", "a desert slickrock trail in Moab, Utah, USA",
  "a redwood forest trail in California, USA", "an alpine trail in the Colorado Rockies, USA",
];
function locationFor(discipline?: string, seed?: string): string {
  const d = (discipline || "").toLowerCase();
  const pool = d === "gravel" ? LOC_GRAVEL : d === "mtb" ? LOC_MTB : LOC_ROAD;
  return pickBy(pool, `${seed || "x"}:loc`);
}

// ── influencer framing (selfies, group rides, with a mate) ─────────────────────
const FRAMING_RIDE = [
  "a candid arm's-length selfie, smiling at the camera mid-ride",
  "a POV handlebar selfie taken while riding",
  "a group-ride photo with several teammates riding alongside",
  "riding side by side with a training mate, both clearly in frame",
  "a candid action shot a friend snapped from the roadside",
  "a relaxed selfie at a viewpoint with the bike leaning nearby",
];
function framingFor(seed?: string): string {
  return pickBy(FRAMING_RIDE, `${seed || "x"}:frame`);
}

// ── lifestyle / home-situation scenes (variety beyond cycling) ─────────────────
// Recognisable everyday moments — the same athlete you saw riding now shows up at
// home, at school, at the bakery… so the cast feels like real people to follow.
const LIFESTYLE: Record<string, string> = {
  new_tv: "at home on the sofa, grinning next to a large brand-new flat-screen TV, in casual home clothes",
  new_trainer: "in a home 'pain cave', proudly showing a brand-new indoor smart trainer with a bike mounted on it",
  school: "walking onto a school/university campus with a backpack and books, in casual student clothes",
  grandparents: "having coffee and cake with grandparents in a cosy living room",
  bakery: "at a local bakery counter, holding a fresh pastry and a coffee, smiling",
  cooking: "cooking a healthy meal in a bright home kitchen",
  garage: "wrenching on a bike in a home garage, tools and parts around",
  cafe: "relaxing on an outdoor café terrace with friends after a ride",
  groceries: "back from groceries, unpacking healthy food on a kitchen counter",
  recovery_home: "foam-rolling and stretching on the living-room floor in comfy clothes",
};
function lifestyleClause(kind?: string): string {
  const k = (kind || "").toLowerCase();
  return LIFESTYLE[k] || "relaxing at home in casual clothes";
}

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
    const slug = (a.slug as string) || "x";
    const look = appearanceFor({
      slug,
      gender: a.gender as string,
      age: a.age as number,
      archetype: a.archetype as string,
    });
    const subject = [age, gender, "cyclist"].filter(Boolean).join(" ");
    return [
      `An authentic social-media profile photo of a fictional ${subject}.`,
      `${capitalise(look)}.`,
      "Head-and-shoulders, looking at the camera with a natural, approachable expression,",
      "like a friendly selfie a real cycling influencer would use as their profile picture.",
      `${capitalise(kitClause(a.team as string, slug))}.`,
      `Outdoors at ${locationFor(a.discipline as string, slug)}, natural daylight.`,
      HONESTY_LINE,
      WORLD_LOOK,
    ]
      .filter(Boolean)
      .join(" ");
  }

  // legacy scene / equipment / podium (still used by video + non-athlete stills)
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
    WORLD_LOOK,
  ]
    .filter(Boolean)
    .join(" ");
}

function capitalise(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Dutch weather keys (the simulation speaks Dutch). Returns "" for keys that add
// nothing so the prompt stays clean.
function weatherClauseNl(weather?: string): string {
  switch ((weather || "").toLowerCase()) {
    case "zon":
      return "bright sunny weather";
    case "bewolkt":
      return "soft overcast light";
    case "regen":
      return "wet rainy weather with a glistening road";
    case "wind":
      return "blustery windy conditions";
    case "koud":
      return "cold crisp conditions";
    case "warm":
      return "warm hazy summer light";
    default:
      return "";
  }
}
function timeClauseNl(timeOfDay?: string): string {
  switch ((timeOfDay || "").toLowerCase()) {
    case "ochtend":
      return "in the morning light";
    case "middag":
      return "in midday light";
    case "avond":
      return "in evening golden-hour light";
    default:
      return "";
  }
}

// ── per-athlete feed-photo prompt (cycling + lifestyle) ────────────────────────
// Built so it works BOTH as an image-to-image edit from the athlete's avatar
// (keeps the same face) and as a plain text generation fallback (describes the
// person fully). The scene varies by type, location, framing, weather and time.
export function buildPostPrompt(attrs: {
  slug: string;
  gender?: string;
  age?: number;
  archetype?: string;
  discipline?: string;
  team?: string | null;
  sceneType: string;
  lifestyle?: string;
  weather?: string;
  timeOfDay?: string;
  seed?: string;
}): string {
  const seed = attrs.seed || attrs.slug;
  const look = appearanceFor(attrs);
  const weather = weatherClauseNl(attrs.weather);
  const time = timeClauseNl(attrs.timeOfDay);
  const identity =
    "Keep the EXACT same recognisable person and face as the reference photo — " +
    "same identity, hair and build (if no reference is given, depict: " +
    `${look}).`;

  let scene: string;
  if (attrs.sceneType === "lifestyle") {
    scene = `The same athlete ${lifestyleClause(attrs.lifestyle)}.`;
  } else if (attrs.sceneType === "bike_detail") {
    scene =
      `A close, candid photo of the athlete's bike — ${bikeClause(attrs.team)} — ` +
      `leaning at ${locationFor(attrs.discipline, seed)}, the rider partly in frame.`;
  } else if (attrs.sceneType === "race_finish") {
    scene =
      `The athlete celebrating just after a race finish, ${kitClause(attrs.team, attrs.slug)}, ` +
      `arms up, other riders and a finish-line atmosphere behind, ${framingFor(seed)}.`;
  } else {
    // training_ride / mountain_road / generic ride
    scene =
      `The athlete out riding, ${kitClause(attrs.team, attrs.slug)}, ${bikeClause(attrs.team)}, ` +
      `at ${locationFor(attrs.discipline, seed)} — ${framingFor(seed)}.`;
  }

  return [
    identity,
    scene,
    [weather, time].filter(Boolean).join(", ") + (weather || time ? "." : ""),
    HONESTY_LINE,
    WORLD_LOOK,
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
    archetype?: string | null;
    discipline?: string | null;
    team?: string | null;
  },
  deps: MediaDeps = {},
): Promise<VirtualMedia> {
  return resolveMedia(
    {
      purpose: "avatar",
      attributes: {
        styleVersion: STYLE_VERSION,
        slug: athlete.slug,
        gender: athlete.gender ?? undefined,
        age: athlete.age ?? undefined,
        archetype: athlete.archetype ?? undefined,
        discipline: athlete.discipline ?? undefined,
        team: athlete.team ?? undefined,
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

// Per-athlete feed photo. Unlike a shared scene, this carries the athlete's
// identity in the key and — crucially — is generated as an image-to-image EDIT
// from the athlete's canonical avatar, so the SAME recognisable face recurs
// across all of that athlete's posts (cycling AND lifestyle). Falls back to a
// fully-described text generation when no avatar exists yet (honest, no fake).
export async function getOrCreatePostPhoto(
  athlete: {
    slug: string;
    gender?: string | null;
    age?: number | null;
    archetype?: string | null;
    discipline?: string | null;
    team?: string | null;
    avatarObjectPath?: string | null;
  },
  descriptor: {
    sceneType: string;
    discipline?: string | null;
    weather?: string | null;
    timeOfDay?: string | null;
    lifestyle?: string | null;
    seed?: string | null;
  },
  deps: MediaDeps = {},
): Promise<VirtualMedia> {
  const discipline = descriptor.discipline ?? athlete.discipline ?? undefined;
  const seed = descriptor.seed ?? athlete.slug;

  // Derive concrete framing/location so they enter the cache key (variety, yet
  // stable per athlete-day) and stay in lock-step with the prompt text.
  const framing =
    descriptor.sceneType === "lifestyle"
      ? lifestyleClause(descriptor.lifestyle ?? undefined)
      : framingFor(seed);

  const attributes: MediaAttributes = {
    styleVersion: STYLE_VERSION,
    slug: athlete.slug,
    sceneType: descriptor.sceneType,
    lifestyle: descriptor.lifestyle ?? undefined,
    discipline,
    location: locationFor(discipline, seed),
    framing,
    weather: descriptor.weather ?? undefined,
    timeOfDay: descriptor.timeOfDay ?? undefined,
    team: athlete.team ?? undefined,
  };

  const prompt = buildPostPrompt({
    slug: athlete.slug,
    gender: athlete.gender ?? undefined,
    age: athlete.age ?? undefined,
    archetype: athlete.archetype ?? undefined,
    discipline,
    team: athlete.team ?? undefined,
    sceneType: descriptor.sceneType,
    lifestyle: descriptor.lifestyle ?? undefined,
    weather: descriptor.weather ?? undefined,
    timeOfDay: descriptor.timeOfDay ?? undefined,
    seed,
  });

  // Face consistency: edit FROM the canonical avatar. Bytes are fetched lazily,
  // inside the generate closure, so a cache hit never downloads anything.
  let generate = deps.generate;
  if (!generate && athlete.avatarObjectPath) {
    const ref = athlete.avatarObjectPath;
    generate = async (p: string) => {
      const bytes = await svc.getObjectBytes(ref);
      return editImage({ base64: bytes.base64, mimeType: bytes.mimeType }, p);
    };
  }

  return resolveMedia(
    { purpose: "post", aspectRatio: "4:5", attributes, prompt },
    { ...deps, generate },
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
