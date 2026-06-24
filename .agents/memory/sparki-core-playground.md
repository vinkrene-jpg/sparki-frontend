---
name: Sparki Core visual-language prototype
description: The "Core" living-shape design contract proven in a frontend-only playground before any backend/engine/data model.
---

# Sparki Core — visual language (frontend-only prototype)

The Core is a single living shape that encodes an athlete's live physical state
so an experienced rider grasps it in <0.5s — condition *and* remaining reserve.
A pure-frontend, slider-driven playground proves the language BEFORE any
CoreState / data model / engine exists. Reachable in-app (floating "Core" button
+ Inzicht card + `/core`).

**Why:** the user pivoted away from building the real Core engine first — the
visual grammar must be validated as a communication language before architecture.

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
