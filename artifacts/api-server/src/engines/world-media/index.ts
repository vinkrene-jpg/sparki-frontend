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
// Feed photos get their own version so a fresh, rawer look can be regenerated
// WITHOUT touching the already-approved avatar faces (avatars keep STYLE_VERSION).
const POST_STYLE_VERSION = "v17";

// Authentic-but-beautifully-shot look, modelled on the most successful cycling &
// lifestyle creators on Instagram: real and candid, yet high craft. NOT a stiff
// studio/stock/catalogue photo and NOT the old uniform teal magazine wash.
const WORLD_LOOK = [
  "Authentic but beautifully shot, like a top Instagram influencer's feed — high quality with great natural light and strong composition, yet candid and real, NOT a stiff studio, stock or catalogue photo.",
  "True real-world colours with a subtle, cohesive film-like grade; natural unretouched skin; believable and lived-in.",
  "Photorealistic. Output only the image.",
].join(" ");

// Extra craft layer for FEED posts only (not profile avatars): the look of the
// most successful cycling/lifestyle influencers — strong composition + beautiful
// light + a cohesive grade, while staying candid and emotional (the grit stays).
const POST_LOOK =
  "Compose and light it like the most successful cycling & lifestyle influencers on Instagram: " +
  "intentional composition (rule of thirds, real depth and leading lines), beautiful natural directional light " +
  "(often golden hour or gently backlit with warm rim light), shallow depth of field on close shots with soft background bokeh, " +
  "and a subtle cinematic colour grade that feels cohesive across a feed. " +
  "Keep it candid, warm and emotional — a real, unposed, in-the-moment phone snapshot bursting with life and feeling, " +
  "with the slight natural imperfection of a genuine real photo; absolutely never clinical, sterile, posed, stiff or stocky. " +
  "It must feel like a friend casually grabbed the shot on a phone in the moment — never like a photographer hired for a " +
  "brochure, catalogue or magazine. Modern sport-content energy: golden hour, rain, mist, backlight, a spontaneous crop, " +
  "a slightly imperfect frame — something you could post straight to Instagram right now. " +
  "Channel the energy of a young rider's OWN phone: a self-shot, story-style moment with the casual, scroll-stopping, " +
  "magnetic look of a popular young creator's feed — the kind of photo you want to keep looking at — fresh, current and " +
  "youthful, never stiff, dated, corporate or middle-aged in feel.";

// Visible effort for active cycling moments — sweat, grime, windblown hair. This
// is the PHYSICAL state that makes a ride photo feel real, not stock. It must NOT
// dictate the expression: the emotion clause (context-aware, varied) owns the
// face, so a feed never shows the same forced smile twice.
const EFFORT_RIDE =
  "A real, lived-in riding moment with genuine effort: skin lightly glistening with sweat from the exertion, a soft " +
  "sheen on the face, neck and arms, faintly flushed cheeks and windblown hair, in a natural, athletic posture. " +
  "Do NOT default the face to a broad smile — the expression is whatever the emotion below describes.";
const EFFORT_FINISH =
  "Sweat-glistened and a little dirt-streaked from racing, hair a mess from the effort — the raw, real physical state " +
  "right after a hard race. The exact expression is whatever the emotion below describes, not a default grin.";
// Professional on-bike position. Without this, riders (especially the men) sit
// upright and awkward — the dead giveaway of a fake, amateur photo.
const POSTURE =
  "Whenever the rider is on the bike they hold a polished, professional racing position: a long, flat, level back, " +
  "relaxed dropped shoulders, softly bent elbows, hands correctly on the brake hoods or down in the drops, hips quiet " +
  "and stable, core engaged — the efficient, well-drilled, powerful look of an experienced pro. Never sitting bolt " +
  "upright, slumped, hunched, stiff, perched too high or awkward.";
// Modern road cyclists always ride WITH a helmet, plus sport sunglasses. Glasses
// are biased toward 'pushed up on the helmet' so the eyes/expression we worked so
// hard on stay visible; only a minority are worn over the eyes (clear/light lenses
// so the gaze still reads). Applied to ON-BIKE scenes only — not lifestyle.
const GLASSES = [
  "sport cycling sunglasses pushed up and perched on the front of the helmet, eyes and expression clearly visible",
  "sport cycling sunglasses flipped up onto the helmet, eyes clearly visible",
  "sport cycling sunglasses resting up on top of the helmet, not over the eyes",
  "modern sport cycling sunglasses worn over the eyes, with lightly tinted lenses through which the eyes still read",
];
function helmetFor(seed?: string): string {
  return (
    "CRITICAL, NON-NEGOTIABLE: while on the bike the rider is ALWAYS wearing a modern, correctly-fitted " +
    "cycling helmet suited to the discipline, straps fastened under the chin — absolutely never bare-headed, " +
    `never just hair. Plus ${pickBy(GLASSES, `${seed || "x"}:glasses`)}.`
  );
}
// The single thing that makes an influencer photo work: warmth and connection.
// Even with little to 'say', a good-looking rider who beams pride and joy and locks
// eyes with the viewer carries the shot. Applied to EVERY post.
const CONNECTION =
  "The image must convey ONE single, clear, strong, instantly readable emotion — authentic and unmistakable, never " +
  "blank, flat, clinical, cold, posed or 'pleasant by default'. That one feeling carries the whole photo and gives the " +
  "rider a magnetic, likeable, alive presence that makes you want to follow them. CRUCIAL: the emotion must genuinely " +
  "VARY from post to post — do NOT fall back on the same broad happy smile and the same straight-to-camera eye contact " +
  "every time; the expression, the eyes and where they look should all follow the specific feeling described next. The " +
  "exact emotion to portray in THIS photo:";
// Deterministic, VARIED emotion per post — but the feeling MUST fit the moment.
// A single global pool was the bug: "gritty suffering on a climb" landed on a
// bakery selfie, "awe at the view" on a bike-detail shot. So the pool is now
// chosen by the scene: a ride can show effort/awe, a finish shows raw release,
// a quiet lifestyle moment stays everyday-warm. Each entry still dictates the
// whole expression AND the gaze (eye contact only when the feeling calls for it).

// On-bike riding moments: effort, flow, the view, the joy of being out there.
const EMOTION_RIDE = [
  "radiant, infectious joy of being out on the bike — caught mid-laugh, eyes crinkled, looking right at the lens",
  "fierce determination and focus, deep in the effort — jaw set, eyes hard on the road ahead, not smiling, completely in the zone",
  "open-mouthed awe and wonder at the view — eyes wide and gazing off at the landscape (NOT at the camera), genuinely moved by where they are",
  "gritty suffering deep in a hard effort — a pained grimace, teeth gritted, brow furrowed, digging deep, eyes down on the road",
  "serene, peaceful flow — relaxed and at ease in the rhythm of the ride, a gentle barely-there smile, calm eyes on the road",
  "playful, cheeky fun mid-ride — a mischievous grin glancing at the lens, clearly enjoying themselves",
  "bright, surprised delight at the moment — eyes lit up, eyebrows raised, an unguarded happy 'wow'",
];
// Right after a race finish: raw release, pride, spent-but-elated emotion.
const EMOTION_FINISH = [
  "spent but elated right after a brutal effort — breathing hard, flushed, a raw exhausted grin, eyes shining and a little glassy",
  "overwhelming pride and joy of finishing — arms thrown up, face lit with raw emotion, maybe close to happy tears",
  "fierce triumphant release — a roar of celebration, eyes blazing, pure adrenaline",
  "exhausted relief and quiet satisfaction — hands on knees or head, a worn-out half-smile, completely emptied out",
];
// Off-bike, beside the bike at rest: quiet pride, calm, friendly.
const EMOTION_BIKE_DETAIL = [
  "quiet pride and satisfaction looking over the bike — a soft, content smile, calm steady eyes",
  "warm, easy, understated friendliness — a relaxed genuine everyday smile, like quietly greeting a friend",
  "calm, understated confidence — an easy half-smile, comfortable and at home with the gear",
];
// Everyday life away from racing: warm, human, low-key — never effort or awe.
const EMOTION_LIFESTYLE = [
  "warm, easy, understated friendliness — a relaxed genuine everyday smile, like quietly greeting a friend, calm eyes",
  "radiant, infectious joy — caught mid-laugh, head tipped back a little, eyes crinkled, pure delight, looking right at the lens",
  "playful, cheeky fun — a mischievous grin, clearly messing around, eyes sparkling at the lens",
  "quiet, calm contentment — a soft, content half-smile and steady, peaceful eyes, simply at ease",
  "bright, surprised excitement — eyes lit up, eyebrows raised, an unguarded happy 'wow'",
  "cool, understated confidence — an easy, relaxed half-smile, comfortable in the moment",
];
// A few lifestyle contexts read wrong with a random feeling — pin the obvious
// ones so a physio session isn't "wow excitement" and a new-gear unboxing isn't
// "calm contentment". Anything not listed falls back to the everyday pool.
const LIFESTYLE_EMOTION: Record<string, readonly string[]> = {
  new_tv: ["bright, surprised excitement — eyes lit up, eyebrows raised, an unguarded happy 'wow'"],
  new_trainer: ["bright, surprised excitement — eyes lit up, eyebrows raised, an unguarded happy 'wow'"],
  new_shoes: ["bright, surprised excitement — eyes lit up, eyebrows raised, an unguarded happy 'wow'"],
  new_bike: ["bright, surprised excitement — eyes lit up, eyebrows raised, an unguarded happy 'wow'"],
  fysio: ["calm, slightly tired acceptance — a soft patient half-smile, relaxed and at ease being looked after"],
  recovery: ["calm, slightly tired contentment — relaxed, eyes soft, simply resting"],
  massage: ["calm, slightly tired contentment — relaxed, eyes soft, simply resting"],
  study: ["quiet, focused calm — a soft half-smile, settled and concentrated"],
  school: ["quiet, focused calm — a soft half-smile, settled and concentrated"],
};
function emotionFor(seed?: string, sceneType?: string, lifestyle?: string): string {
  const key = `${seed || "x"}:emotion`;
  if (sceneType === "race_finish") return pickBy(EMOTION_FINISH, key);
  if (sceneType === "bike_detail") return pickBy(EMOTION_BIKE_DETAIL, key);
  if (sceneType === "lifestyle") {
    const pinned = lifestyle ? LIFESTYLE_EMOTION[lifestyle] : undefined;
    return pinned ? pickBy(pinned, key) : pickBy(EMOTION_LIFESTYLE, key);
  }
  // training_ride / mountain_road / generic ride
  return pickBy(EMOTION_RIDE, key);
}

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
// Gender-dimorphic, athletic build — clearly feminine vs clearly masculine
// physiques. Women read youthful and softly feminine (slim waist, gentle curves,
// toned not bulky); men read distinctly muscular (broad shoulders, defined arms
// and legs, visible muscle tone). Pulled out so feed photos can reinforce the
// figure EVEN when editing from an avatar reference (the reference drives the
// face; this keeps the body from defaulting to a stiff, sexless silhouette).
function figureFor(a: { gender?: string; archetype?: string; age?: number }): string {
  const sex = buildName(a.gender);
  const arch = (a.archetype || "").toLowerCase();
  const lean = /klimmer|ultra|marathon|cross-country|duur/.test(arch);
  const power = /sprinter|baansprinter|achtervolger/.test(arch);
  // Youth (and unknown age, fail-safe) stay strictly wholesome: a fit junior
  // athlete's build, NEVER an adult's heavily-muscled or alluring physique.
  const youth = typeof a.age !== "number" || a.age < 18;
  if (youth) {
    return sex === "female"
      ? "a lean, fit junior athlete's figure — naturally slim and sporty, healthy and age-appropriate, not muscular and not curvy"
      : "a lean, fit junior athlete's build — naturally slim and sporty, healthy and age-appropriate, not heavily muscled";
  }
  // Adults: genuinely athletic, defined bodies — the look of a real elite cyclist
  // who trains ~15h/week. Defined, not exaggerated; never a bodybuilder.
  return sex === "female"
    ? lean
      ? "a genuinely athletic, very fit female cyclist's figure — lean, defined climber's legs and powerful thighs, a slim waist, athletic shoulders and subtle, real muscle definition; healthy, toned and confident, never skinny-flat and never bulky or masculine"
      : power
        ? "a strong, athletic female sprinter's figure — powerful, muscular thighs and calves, a slim waist, athletic shoulders and clear but feminine muscle definition; healthy, toned and confident, never bulky or masculine"
        : "a genuinely athletic, very fit female cyclist's figure — strong, toned legs and powerful thighs, a slim waist, athletic shoulders and subtle, real muscle definition; healthy, toned and confident, never skinny-flat and never bulky or masculine"
    : lean
      ? "a convincing, lean elite-endurance male physique — broad shoulders, a defined chest and arms, a narrow waist and powerful, clearly muscled climber's legs; visible but natural muscle definition, the body of someone who trains ~15 hours a week, never skinny or wooden and never a bulky bodybuilder"
      : power
        ? "a powerful, athletic male sprinter's physique — broad shoulders, a strong defined chest and arms, a narrow waist and explosively muscular thighs and calves; visible but natural muscle, never a bulky bodybuilder"
        : "a strong, athletic male cyclist's physique — broad shoulders, a defined chest and arms, a narrow waist and powerful, clearly muscled legs; visible but natural muscle definition, the body of someone who trains ~15 hours a week, never a bulky bodybuilder";
}

// Adult-only natural appeal: the easy, photogenic charisma of a genuinely fit,
// confident young rider — the kind of face people enjoy following. Deliberately
// understated, NOT a glamour/magazine register: the pull comes from health,
// fitness and an unforced, candid presence, never from posing or styling.
// Returns "" for youth (and unknown age), who stay strictly wholesome.
function allureFor(a: { age?: number }): string {
  if (typeof a.age !== "number" || a.age < 18) return "";
  return (
    "This is a naturally good-looking, photogenic young adult athlete with an easy, unforced confidence and a candid, " +
    "approachable presence — genuinely attractive in a real, everyday way, the way a fit young rider looks in their own " +
    "phone photos. Keep it natural and understated: never glossy, never sexualised, never revealing, and never posed or " +
    "styled like a glamour, fashion or magazine shoot."
  );
}

// ── per-athlete identity beyond the face: personality, a favourite accent colour
// and a recognisable on-camera habit — so each athlete feels like a real person
// with their own character, not just a different face. Slug-seeded = consistent.
const PERSONALITY = [
  "a warm, easy-going personality",
  "a playful, mischievous personality",
  "a calm, quietly determined personality",
  "an intense, driven, competitive personality",
  "a bubbly, enthusiastic personality",
  "a cool, understated, confident personality",
  "a friendly, down-to-earth personality",
  "a focused, meticulous personality",
];
const ACCENT_COLOR = [
  "electric blue", "hot pink", "neon yellow", "deep red", "teal",
  "burnt orange", "purple", "lime green", "sky blue", "coral",
];
const POSE_HABIT = [
  "leaning in close toward the camera",
  "a relaxed thumbs-up or peace sign",
  "glancing candidly just off to the side of the lens",
  "standing tall and proud, chin up",
  "glancing back over the shoulder at the lens",
  "being caught mid-movement, unposed",
  "a quick, easy grin",
  "a calm, understated stance",
];
function personaFor(slug: string): string {
  const s = slug || "x";
  return (
    `Their own consistent character shows through — ${pickBy(PERSONALITY, `${s}:pers`)}, ` +
    `a personal liking for ${pickBy(ACCENT_COLOR, `${s}:accent`)} accents on their kit, socks or gear, ` +
    `and a recognisable on-camera habit: ${pickBy(POSE_HABIT, `${s}:pose`)}.`
  );
}
function appearanceFor(a: {
  slug: string;
  gender?: string;
  age?: number;
  archetype?: string;
}): string {
  const slug = a.slug || "x";
  const sex = buildName(a.gender);
  const build = figureFor(a);
  // Youth (and unknown age, fail-safe) stay strictly wholesome at the FACE level
  // too: no adult-feminine framing, no "captivating/attractive" wrapper — only a
  // natural, age-appropriate young-teen face. Adults keep the influencer look.
  const youth = typeof a.age !== "number" || a.age < 18;
  const genderFace = youth
    ? "natural, age-appropriate facial features for a young teenager"
    : sex === "female"
      ? "soft, feminine facial features"
      : "masculine facial features with a defined jawline";
  const hair =
    sex === "female" ? pickBy(HAIR_V, `${slug}:hair`) : pickBy(HAIR_M, `${slug}:hair`);
  const facial =
    sex === "male" && !youth ? `, ${pickBy(FACIAL_HAIR, `${slug}:beard`)}` : "";
  const charisma = youth
    ? "a fresh, natural, wholesome young face that clearly looks their stated age"
    : "very good-looking and photogenic, with striking, expressive, captivating eyes";
  return [
    `${pickBy(SKIN, `${slug}:skin`)} skin`,
    `${pickBy(HAIR_COLOR, `${slug}:haircol`)} ${hair}${facial}`,
    genderFace,
    pickBy(FACE_FEATURE, `${slug}:face`),
    charisma,
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
    return `wearing a sleek, modern pro race cycling kit in ${k.colors} with bold, dynamic sponsor graphics and the fictional sponsor wordmark "${k.sponsor}" across the chest`;
  }
  return `wearing a sharp, modern club cycling kit in ${pickBy(KIT_COLORS, `${slug || "x"}:col`)} with bold graphic detailing`;
}
// Authentic, worn-in kit — the difference between a real ride photo and a clean
// catalogue shot: jersey zip pulled partway open, fabric a little dusty and
// road-grimed, sweat-darkened and slightly rumpled. NOT freshly pressed.
const KIT_WORN =
  "The kit looks authentically worn from real riding: the jersey zip pulled partway down at the chest, the fabric " +
  "a little dusty and dirt-flecked from the road, sweat-darkened around the collar and back and slightly rumpled — " +
  "lived-in and real, never freshly pressed or pristine.";
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
// Each entry is a FULL shot description — it sets BOTH who/how it was taken AND
// the camera position and how big the rider sits in the frame, so the feed gets
// genuine variety in angle and scale (not always a centred medium shot) and real
// selfies actually appear.
// Instagram-feed framing: this is a personal social feed, so it is OVERWHELMINGLY
// self-shot — real front-camera selfies (arm holding the phone) and the odd casual
// snap a riding mate took. Deliberately NOT polished cycling-magazine photography
// (no third-person panning action, drone/high angles, low-angle-from-the-tarmac or
// wide "rider tiny in the landscape" shots) — that reads like an ad and kills the
// feel of a real person's feed. Selfie variants dominate the pool on purpose.
const FRAMING_RIDE = [
  // natural front-camera selfies — the phone is held high and OFF to one side at an
  // angle (the way people actually take selfies), never dead-centre square-on
  "a natural mid-ride front-camera selfie with the phone held up high and off to one side so the angle is tilted and slightly looking-up into the lens, the outstretched arm and hand clearly in the foreground, the face at a relaxed three-quarter angle rather than square to the camera",
  "a candid arm's-length selfie shot from an angle off to the side, the rider's face half-turned toward the lens (not straight-on), the extended arm holding the phone visible at the edge, the road and scenery behind",
  "a casual selfie paused at a viewpoint, the phone held out to one side and tilted, the rider half-turned with the breathtaking scenery clearly spread out behind them so the view is shown off in the same shot",
  "a 'look where I am right now' selfie with the phone tilted so most of the frame is the stunning landscape behind, the rider's face off in a corner at an angle, glancing back toward the lens",
  "a sweaty post-effort selfie with the phone held a bit above the face looking up into the lens, off-centre and unposed, flushed right after a hard effort",
  "a fun two-person selfie: the rider and a training mate both lean in toward one phone held high at arm's length, faces at playful angles and not square to the camera, the extended arm in the foreground",
  // self-shot POV (still feels like the rider's own phone, not a photographer)
  "a POV handlebar shot the rider took of their own hands, stem and front wheel with the road ahead — clearly shot on their own phone",
  // the rare candid a mate grabbed — still amateur phone, never a magazine shot
  "a candid, slightly imperfect phone photo a riding mate quickly snapped of the rider mid-ride, casual and unposed like a real social-feed pic, never a polished professional magazine shot",
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
  fysio: "at a physiotherapy clinic, doing a guided recovery exercise on a treatment table",
  bike_wash: "washing a road bike with a hose and brush in the yard after a muddy ride",
  new_shoes: "unboxing a brand-new pair of cycling shoes at home, looking excited",
  library: "studying at a university library desk with a laptop, notes and a coffee",
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
    const isYouth = typeof a.age === "number" && a.age < 18;
    const youthAnchor = isYouth
      ? `This athlete is ${a.age} years old — clearly and unmistakably a young teenager of exactly that age, with a wholesome school-age appearance. Never make them look like an adult, and never give them an adult, mature or alluring look.`
      : "";
    const expression = isYouth
      ? "Head-and-shoulders, looking at the camera with a natural, friendly, age-appropriate smile, like a wholesome junior club portrait."
      : "Head-and-shoulders, looking at the camera with a warm, charismatic, expressive natural expression, like a friendly selfie a real cycling influencer would use as their profile picture.";
    return [
      `An authentic social-media profile photo of a fictional ${subject}.`,
      youthAnchor,
      `${capitalise(look)}.`,
      expression,
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
    "same identity, facial features and hair (if no reference is given, depict: " +
    `${look}).`;
  // Youth are clamped to a wholesome young-teen depiction. CRITICAL: the post is an
  // img2img edit and the body/age can drift adult, so we anchor the age explicitly
  // and STRIP all adult-feminine/masculine and alluring framing for minors.
  const isYouth = typeof attrs.age === "number" && attrs.age < 18;
  const youthAnchor = isYouth
    ? `CRITICAL: this athlete is a ${attrs.age}-year-old youth/junior — depict them unmistakably as a young teenager of exactly that age, with a fresh youthful child's face and a slight, undeveloped junior build, completely wholesome and age-appropriate. NEVER depict them as an adult, NEVER give them a mature, curvy or muscular adult physique, and NEVER any sexual, alluring or 'attractive adult' quality whatsoever.`
    : "";
  // Reinforce the gendered figure on EVERY post: img2img follows the avatar for
  // the face, but the body can drift to a stiff, sexless silhouette — so we state
  // it again here. The face stays from the reference; only the build is nudged.
  // Youth get a neutral, non-gendered junior build line (no adult-feminine framing).
  const figureLine = isYouth
    ? `Their build is simply that of a fit ${attrs.age}-year-old junior athlete: ${figureFor(attrs)}.`
    : buildName(attrs.gender) === "female"
      ? `Her body is unmistakably, softly feminine: ${figureFor(attrs)} — graceful and natural, never boxy, stocky or masculine.`
      : `His body is clearly masculine and athletic: ${figureFor(attrs)}.`;

  let scene: string;
  if (attrs.sceneType === "lifestyle") {
    scene = `The same athlete ${lifestyleClause(attrs.lifestyle)}.`;
  } else if (attrs.sceneType === "bike_detail") {
    scene =
      `A close, candid photo of the athlete's bike AT REST — ${bikeClause(attrs.team)} — ` +
      `leaning against a wall or fence at ${locationFor(attrs.discipline, seed)}, ` +
      `with the rider standing or crouching beside it, OFF the bike and clearly not riding.`;
  } else if (attrs.sceneType === "race_finish") {
    scene =
      `The athlete celebrating just after a race finish, ${kitClause(attrs.team, attrs.slug)}, ` +
      `arms up, other riders and a finish-line atmosphere behind, ${framingFor(seed)}. ${EFFORT_FINISH} ${POSTURE} ${KIT_WORN}`;
  } else {
    // training_ride / mountain_road / generic ride
    scene =
      `The athlete out riding, ${kitClause(attrs.team, attrs.slug)}, ${bikeClause(attrs.team)}, ` +
      `at ${locationFor(attrs.discipline, seed)} — ${framingFor(seed)}. ${EFFORT_RIDE} ${POSTURE} ${KIT_WORN}`;
  }

  const onBike =
    attrs.sceneType !== "lifestyle" && attrs.sceneType !== "bike_detail";

  return [
    identity,
    youthAnchor,
    onBike ? helmetFor(seed) : "",
    scene,
    figureLine,
    allureFor(attrs),
    personaFor(attrs.slug),
    [weather, time].filter(Boolean).join(", ") + (weather || time ? "." : ""),
    `${CONNECTION} ${emotionFor(seed, attrs.sceneType, attrs.lifestyle)}.`,
    POST_LOOK,
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
    styleVersion: POST_STYLE_VERSION,
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
