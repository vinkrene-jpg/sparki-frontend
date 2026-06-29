// Sparki World — post validation v1 (pure).
//
// A post is only ever published when it passes here. Validation guards four
// things before anything reaches a real user's feed:
//   1. Voice/brand: no user-facing "AI", no narrator framing, plain caption.
//   2. Caption sanity: present, not absurdly long, no leftover template tokens.
//   3. Event ↔ post consistency: the post kind fits the event type.
//   4. Sport content: the deterministic numbers stay physically plausible for
//      THIS athlete (e.g. training power within a sane band of their FTP, a race
//      placing not larger than the field).
//
// Rejected posts carry a plain-Dutch reason and are never shown — honest by
// construction, never silently dropped.

import type { GeneratedAthlete } from "./population";
import type { SimEvent, SimPost, PostKind } from "./simulation";

export type ValidationResult = {
  status: "approved" | "rejected";
  notes: string | null;
};

// Which post kinds are sensible for which event type.
const ALLOWED_KINDS: Record<string, PostKind[]> = {
  training: ["photo", "training_log"],
  rest: ["photo", "observation", "story"],
  recovery: ["photo", "observation", "story"],
  race: ["photo", "training_log"],
  equipment: ["review", "photo"],
  training_camp: ["photo", "story"],
  nutrition: ["photo", "nutrition"],
  motivation: ["humor", "observation"],
  injury: ["observation", "story"],
  illness: ["observation", "story"],
};

// User-facing forbidden patterns: the word "AI" and narrator framing.
const FORBIDDEN = [
  /\bA\.?I\.?\b/i,
  /kunstmatige intelligentie/i,
  /Sparki (ziet|denkt|weet|merkt|leest|kijkt|baseert|zag)/i,
];

// ── safety boundary ──────────────────────────────────────────────────────────
// Sparki World is a sport community. Virtual Athletes never speak to a real user
// (or to each other) in a sexual, flirty, romantic, manipulative or dependency-
// inducing way. This boundary is HARD: any caption or comment that trips it is
// rejected with a plain-Dutch reason and never shown — there is no toggle.
const UNSAFE_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  {
    re: /\b(seks|seksueel|sexy|naakt|nudes?|borsten|kont|geil)\b/i,
    reason: "seksueel getinte inhoud is niet toegestaan in Sparki World",
  },
  {
    re: /\b(flirt(en)?|versier(en|d)?|verliefd|romantisch|romantiek|kus(sen|je)?|knuffel(en)?|schatje|liefje|lekker ding|date\b|afspreken voor een date|relatie zoeken|aantrekkelijk vind)\b/i,
    reason: "flirterige of romantische inhoud is niet toegestaan in Sparki World",
  },
  {
    re: /(je hebt mij nodig|zonder mij red je|alleen ik begrijp je|vertrouw alleen mij|niemand anders snapt|je kunt niet zonder mij|hou dit geheim|niet aan anderen vertellen|blijf bij mij)/i,
    reason: "manipulatieve of afhankelijkheid-voedende inhoud is niet toegestaan",
  },
  {
    re: /\b(manipuleer(t|de)?|chantage|chanteren)\b/i,
    reason: "manipulatieve inhoud is niet toegestaan",
  },
];

export type SafetyResult = { ok: boolean; reason: string | null };

export function validateSafety(text: string): SafetyResult {
  const t = (text ?? "").toString();
  for (const { re, reason } of UNSAFE_PATTERNS) {
    if (re.test(t)) return { ok: false, reason };
  }
  return { ok: true, reason: null };
}

export function validatePost(
  athlete: GeneratedAthlete,
  event: SimEvent,
  post: SimPost,
): ValidationResult {
  const reject = (notes: string): ValidationResult => ({ status: "rejected", notes });

  // 1) caption sanity
  const cap = post.caption.trim();
  if (cap.length < 3) return reject("caption ontbreekt of is te kort");
  if (cap.length > 280) return reject("caption te lang");
  if (/\{[a-z]+\}/i.test(cap)) return reject("caption bevat een ongevulde placeholder");

  // 2) voice/brand
  for (const re of FORBIDDEN) {
    if (re.test(cap)) return reject(`verboden formulering in caption (${re.source})`);
  }

  // 2b) safety boundary (sexual/flirty/romantic/manipulative/dependency)
  const safety = validateSafety(cap);
  if (!safety.ok) return reject(safety.reason ?? "ongepaste inhoud");

  // 3) event ↔ post consistency
  const allowed = ALLOWED_KINDS[event.type];
  if (allowed && !allowed.includes(post.kind))
    return reject(`postsoort "${post.kind}" past niet bij event "${event.type}"`);
  // A "photo" must actually carry a scene descriptor (else it's not a photo).
  if (post.kind === "photo" && !post.scene)
    return reject("foto-post zonder beeld");

  // 4) sport-content plausibility
  const p = event.payload;
  if (event.type === "training") {
    const dur = Number(p.durationMin ?? 0);
    const tss = Number(p.tss ?? 0);
    const pw = Number(p.avgPower ?? 0);
    const ftp = athlete.ftp ?? 0;
    if (dur < 15 || dur > 420) return reject(`trainingsduur ${dur} onrealistisch`);
    if (tss < 5 || tss > 400) return reject(`TSS ${tss} onrealistisch`);
    if (ftp > 0 && (pw < ftp * 0.35 || pw > ftp * 1.35))
      return reject(`gemiddeld vermogen ${pw}W past niet bij FTP ${ftp}`);
  }
  if (event.type === "race") {
    const placing = Number(p.placing ?? 0);
    const field = Number(p.fieldSize ?? 0);
    const dur = Number(p.durationMin ?? 0);
    if (field <= 0 || placing < 1 || placing > field)
      return reject(`uitslag ${placing}/${field} onmogelijk`);
    if (dur < 20 || dur > 360) return reject(`wedstrijdduur ${dur} onrealistisch`);
  }

  return { status: "approved", notes: null };
}
