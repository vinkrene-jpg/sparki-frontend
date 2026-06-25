import type { CoreVisualState } from "@/components/sparki/core/sparki-core"
import type { SparkiState } from "@/hooks/use-sparki-state"

// Translate the honest SparkiState into the living Core's visual language. Pure
// and deterministic: the same state always renders the same Core. The engine
// already did all the judgement — this only maps numbers to a shape, never adds
// meaning of its own. It is part of the shared engine client (no Vandaag
// dependency): any surface that renders a Sparki Core reuses this mapping.

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

// Loadability (y) drives the colour: top/robuust reads as the Sparki cyan,
// bottom/kwetsbaar slides toward a warm red. y is 0 (good) → 1 (vulnerable),
// which matches CoreVisualState.y exactly.
function hueFromY(y: number): number {
  // 188 (cyan) at y=0 → 10 (red) at y=1, through green/amber in the middle.
  return 188 - clamp01(y) * 178
}

export function stateToCore(state: SparkiState): CoreVisualState {
  const x = clamp01(state.x)
  const y = clamp01(state.y)

  // The Core is the centred hero of Vandaag. It stays dead-centre on screen and
  // expresses the athlete's field position purely through colour, size, shape
  // (deformation/stretch) and a gentle lean toward that position — NOT by
  // travelling off-centre, which reads as a layout bug on a phone. The full
  // semantic x/y below still drive hue, size, stretch and lean direction at full
  // range; only the on-screen translation is pinned to the centre.
  const posX = 0.5
  const posY = 0.5

  // The influence axis: the direction the Core leans/stretches, pointing from the
  // calm centre toward the athlete's actual position in the field. Canvas y grows
  // downward, so this already reads as "down = vulnerable".
  const dx = x - 0.5
  const dy = y - 0.5
  const offCentre = Math.hypot(dx, dy)
  const direction =
    offCentre < 0.04 ? 90 : ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360

  // Movement → a slow drift. Never fast; uncertainty is shown as haze, not speed.
  const speed =
    state.movement.direction === "onbekend"
      ? 0.08
      : state.movement.direction === "stabiel"
        ? 0.16
        : 0.38

  return {
    x: posX,
    y: posY,
    // Robuust athletes read a touch larger; kwetsbaar a touch smaller.
    size: 0.58 + (1 - y) * 0.22,
    hue: hueFromY(y),
    distortion: clamp01(state.distortion),
    // Tension breathes the Core — calm when low, alert when a race/strain looms.
    pulse: clamp01(0.18 + state.tension * 0.6),
    // Opacity is its own dimension; low certainty hazes the edge (confidence),
    // it does not make the body vanish.
    opacity: clamp01(0.86 + state.confidence * 0.14),
    speed,
    direction,
    // Two strong, conflicting factors stretch the shape — same source as the
    // engine's distortion, kept subtle.
    stretch: clamp01(state.distortion * 0.7),
    // A second inner factor glows when the recovery axis is strongly off balance.
    secondary: clamp01(Math.abs(x - 0.5) * 1.3),
    confidence: clamp01(state.confidence),
  }
}
