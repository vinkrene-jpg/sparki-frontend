// Shared insight-governance helper, derived from the voice engine's own rules.
//
// The curiosity open-loops and the honest ("Sparki, eerlijk?") observation are
// authored as fixed, verbatim lines (the brief fixes their exact wording), so
// they cannot flow through composeVoice's phrase library. But they MUST still
// obey the same personality rules composeVoice enforces:
//
//   - Rule 2 (no fabricated suspense): a line that points at a pattern only
//     fires when there is real evidence behind it.
//   - Rule 3 (trust gates personality): the more pointed / interpretive a line
//     is, the more trust it requires. A pointed line at low trust stays unspoken.
//
// This helper is the single policy gate both insight surfaces call, so tone
// governance lives in one place alongside the rest of the voice engine.

import { isToneUnlocked } from "./compose";
import type { TrustTier, VoiceTone } from "./types";

/**
 * Whether an externally-authored insight line is allowed to speak.
 * `evidence` enforces anti-fabrication; `tone` is gated against `trust` exactly
 * as composeVoice gates its own lines.
 */
export function insightLineAllowed(opts: {
  trust: TrustTier;
  tone: VoiceTone;
  evidence: boolean;
}): boolean {
  if (!opts.evidence) return false;
  return isToneUnlocked(opts.tone, opts.trust);
}
