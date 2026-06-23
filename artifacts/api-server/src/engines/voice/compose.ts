// The composer: turns (event + trust + tone + memory + sport) into one Sparki line.
//
// Hard rules enforced here, in order:
//  1. Empathy before humor. Setback events are forced to `supportive`; humor is
//     impossible. A fall leads with a wellbeing check ("Alles oké?").
//  2. No fabricated suspense. Open-loop events return null without real evidence;
//     a memory_followup returns null without a memory to refer to.
//  3. Trust gates personality. Humor (dry/cynical) only unlocks as the athlete
//     interacts more. A requested-but-locked tone falls back to a safe one.
//  4. Determinism. Same input + seed → same line (testable, no surprises).

import type {
  TrustTier,
  VoiceInput,
  VoiceLine,
  VoiceTone,
} from "./types";
import { EVENTS, SPORT_NOUN } from "./phrases";

// Which styles are available at each trust tier. New athletes get the calm,
// safe voices; banter and cynicism are earned through interaction.
const TIER_TONES: Record<TrustTier, VoiceTone[]> = {
  nieuw: ["observer", "supportive"],
  kennismaking: ["observer", "supportive", "curious"],
  vertrouwd: ["observer", "supportive", "curious", "dry_humor"],
  maat: ["observer", "supportive", "curious", "dry_humor", "cynical"],
};

/** Pure: is a style allowed to speak at this trust tier? */
export function isToneUnlocked(tone: VoiceTone, tier: TrustTier): boolean {
  return TIER_TONES[tier].includes(tone);
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function fillSlots(
  template: string,
  opts: { sport?: string; memory?: string },
): string {
  let out = template;
  out = out.replace("{sport}", opts.sport ?? "");
  out = out.replace("{memory}", opts.memory ?? "");
  // Clean up the gaps left by empty slots: collapse double spaces, fix " ." / " ?"
  // / " ," and trim. Keeps lines tidy whether or not a slot was filled.
  out = out
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  return out;
}

/**
 * Compose one Sparki line. Returns null when Sparki has nothing honest to say:
 *  - an open-loop/pattern event without real evidence, or
 *  - a memory follow-up without a memory to refer to.
 *
 * `forceTone` is an internal escape hatch used by the showcase to render what a
 * (possibly locked) style would sound like; normal callers never set it.
 */
export function composeVoice(
  input: VoiceInput,
  forceTone = false,
): VoiceLine | null {
  const cfg = EVENTS[input.event];

  // Rule 2: refuse to fabricate.
  if (cfg.openLoop && input.evidence !== true) return null;
  if (cfg.needsMemory && !input.memory) return null;

  // Rule 1: empathy before humor. Setbacks force the supportive voice.
  let tone: VoiceTone;
  let empathyFirst = false;
  if (cfg.empathy) {
    tone = "supportive";
    empathyFirst = true;
  } else {
    tone = resolveTone(input, cfg.defaultTone, forceTone);
  }

  const variants = cfg.lines[tone] ?? cfg.lines[cfg.defaultTone] ?? [];
  if (variants.length === 0) return null;

  const seed =
    input.seed ??
    hashSeed(`${input.event}|${tone}|${input.sport ?? ""}|${input.memory?.topic ?? ""}`);
  const variant = variants[seed % variants.length]!;

  const sportNoun = input.sport ? SPORT_NOUN[input.sport] ?? "" : "";
  let text = fillSlots(variant, {
    sport: sportNoun,
    memory: input.memory?.topic,
  });

  // Wellbeing check leads, always — humor (if any) only comes much later.
  if (cfg.safetyCheck) {
    text = `${cfg.safetyCheck} ${text}`;
    empathyFirst = true;
  }

  return {
    text,
    tone,
    empathyFirst,
    openLoop: Boolean(cfg.openLoop),
  };
}

function resolveTone(
  input: VoiceInput,
  defaultTone: VoiceTone,
  forceTone: boolean,
): VoiceTone {
  const cfg = EVENTS[input.event];
  const hasLines = (t: VoiceTone) => (cfg.lines[t]?.length ?? 0) > 0;

  // Showcase mode: honor the requested tone verbatim (used to demonstrate locked
  // styles). It must still have authored lines for this event.
  if (forceTone && input.tone && hasLines(input.tone)) return input.tone;

  // Requested tone, but only if it is unlocked at this tier and has lines.
  if (
    input.tone &&
    isToneUnlocked(input.tone, input.trust) &&
    hasLines(input.tone)
  ) {
    return input.tone;
  }

  // Fall back to the event default if it is unlocked + available.
  if (isToneUnlocked(defaultTone, input.trust) && hasLines(defaultTone)) {
    return defaultTone;
  }

  // Otherwise the first unlocked tone (tier order) that has lines for this event.
  for (const t of TIER_TONES[input.trust]) {
    if (hasLines(t)) return t;
  }

  // Last resort: supportive always exists for safety.
  return "supportive";
}
