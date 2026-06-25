---
name: Sparki Core visual-language prototype
description: The "Core" living-shape design contract proven in a frontend-only playground before any backend/engine/data model.
---

# Sparki Core — visual language (frontend-only prototype)

The Core represents the athlete's **actuele prestatiecapaciteit** — NOT an
emotion, health, or score indicator. An experienced rider must grasp it in
<0.5s — condition *and* remaining reserve.

## Reading priority (strict, drives every design call)
1. **Positie** — "Waar zit mijn Core?" (most important signal)
2. **Kleur** — "Welke kleur heeft mijn Core?"
3. **Vorm** — "Hoe vervormt mijn Core?"
4. **Beweging** — least important; only conveys life, never status.
Playground sliders are grouped/ordered to mirror this exact hierarchy.

## Force-field motion (non-negotiable)
The Core must feel like it moves **through a force field**, not like it is
animated. Positive and negative factors pull it; the final position emerges from
all forces together, and it **glides slowly to a new balance position** — never
schokkerig, never springend, never instant A→B. The goal feeling is "ik zie mijn
toestand verschuiven", not "ik zie een status veranderen".
**How:** the renderer keeps a displayed state `cur` that eases toward the live
target every frame via frame-rate-independent exponential approach
(`a + (b-a)*(1-exp(-dt/tau))`); positie has the largest tau (slowest settle),
movement-only channels the smallest. Hue/direction ease along the shortest
angular path. NEVER bind the canvas directly to the raw target state.
A pure-frontend, slider-driven playground proves the language BEFORE any
CoreState / data model / engine exists. Reachable in-app (floating "Core" button
+ Inzicht card + `/core`).

**Why:** the user pivoted away from building the real Core engine first — the
visual grammar must be validated as a communication language before architecture.

## Override: on-screen position is pinned to centre (product decision)
In the live Vandaag Core (`lib/state-to-core.ts`) `posX`/`posY` are hard-set to
`0.5` — the Core never translates off-centre. The semantic x/y still drive hue,
size, stretch and **lean direction**, so field position is conveyed by
colour/size/shape/lean, not by moving the body.
**Why:** the director read an off-centre orb as a layout bug on a phone and
stated the carriers of state are vorm/grootte/kleur (not position). This
supersedes the original "Positie = signal #1" hierarchy for the rendered card.
**How to apply:** do NOT reintroduce a position offset in `stateToCore`; if a
future surface wants positional encoding, gate it per-surface, never globally.

## The design contract (how the shape must read)
- **Calm, never jerky ("niet grillig / niet schokkerig").** No high-frequency
  unrest, no opacity flicker. Only slow, low-harmonic deformation + gentle drift.
- **Uncertainty = soft/hazy, NOT restless.** Low certainty widens the halo,
  blurs the edge and fades the rim — it never adds jitter.
- **Position lives on a good↔bad cross.** Top-centre = goed/veel reserve,
  bottom-centre = zwaar/weinig reserve; left/right are nuances. The axes stand
  for the most important analyses; unseen background data still bends direction,
  shape and colour.
- **Colour = the negative↔positive data balance** (a combination of negatives,
  or one dominant negative, flips it — and vice versa).
- **Stretch ("uittrekken") = two strong influences** pull the shape into a
  teardrop/oval along one axis. Implemented as rotate(-dir)→anisotropic
  scale→rotate(dir); keep sx>0, sy>0 so the path never collapses/inverts.

## Implementation notes
- Renderer: Canvas 2D + self-rolled sum-of-sines, single RAF, live state via a
  `useRef` (do NOT restart the loop per slider), ResizeObserver + DPR cleanup.
- Vertical slider is inverted at the UI boundary (`value={1-y}`, `set("y",1-v)`)
  so "hoger = beter" matches the renderer convention (y=0 top, y=1 bottom).
- No data-model/types package was added — `CoreVisualState` stays a local
  interface (component props only), per the explicit no-backend constraint.
