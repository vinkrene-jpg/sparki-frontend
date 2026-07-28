---
name: Sparki cinematic scene system
description: The premium dark, per-screen cinematic background system for Sparki, plus its motion/accessibility constraints.
---

# Cinematic Scene System (Sparki)

The app background is a reusable system: `CinematicScene` (component) +
`SCENES` config, rendered once by the shared `ScreenShell`, which maps
`section` → scene name. Every screen shares the SAME structure (image →
gradient → haze → beams → ambient → bloom → vignette → scan); only the
per-screen atmosphere differs (home calm, train energetic, feed lighter, lab
luminous/futuristic, you warmer/calmer). Nav, cards and components stay
identical across screens.

## Hard rules (user-driven)
- Premium cycling-performance-center feel, NOT a flat dark app and NOT a
  generic card dashboard. Keep cyan/neon accents. No white surfaces, no
  pastels, no avatars, no hard black blocks.
- Subject (cyclist) must be clearly recognizable: ~0.5–0.6 image opacity,
  achieved by reducing the dark overlay (softened blue-black gradient) + haze,
  NOT by raising brightness alone.
- Background is `fixed` so it sits behind the WHOLE page (not just the top).
- OLED-safe: base color lifted off pure #000 (blue-black ~#05070e).
- Text over background uses soft faded dark scrims (radial, no boxes) +
  text-shadow. Cards are frosted glass ~82% (`bg-[#070d16]/[0.82]
  backdrop-blur-md`) with subtle light borders so the bg shows through.

## Live motion — must stay near-imperceptible
- Transform/opacity ONLY (compositor/GPU). Slow loops 20–36s; parallax capped
  at ≤5px via a throttled passive scroll listener.
- Motion is gated by `useCinematicMotion()`: OFF when
  `prefers-reduced-motion` OR low-end device (`hardwareConcurrency`/
  `deviceMemory` <= 2). CSS `@media (prefers-reduced-motion)` also hard-kills
  the `.scene-*` animations as a belt-and-suspenders.
- **Why:** user explicitly wants atmosphere you barely notice + battery/perf
  safety on mobile. "If the movement is clearly noticeable, it's too strong."

## How to apply
- New per-screen atmosphere = add/edit an entry in `SCENES` (no structural
  change). Beam intensity lives on the beam WRAPPER opacity (the inner layer
  animates 0→peak), so scene-specific intensity survives the animation.
- Verify mobile at ~402px; keep the fixed BottomNav legible (bottom vignette).

## ScreenShell injects home chrome — standalone pages need `bare`
ScreenShell auto-injects coaching surfaces around `{children}`: HomeProfilePrompt,
CoachInputNeeds, CoachAnalysisCard, CoachDecisionCard (all when section maps to
home / is in COACH_CARD_SECTIONS) AND `<FollowUpPrompt />` for EVERY section except
"samen"/state-surface. A standalone full-screen moment (e.g. head-tester welcome)
that passes `section="Home"` gets its own content buried beneath the day-coaching
stack — looks like the route "didn't match" when it actually did.
**Fix:** pass `bare` (suppresses all injected surfaces) + a neutral section whose
label is meaningful (unknown keys fall back to section.toUpperCase()).

## Achtergrond is een verplichte keuze (jul 2026)
- ScreenShell `bg` en CinematicScene `image` zijn nu VERPLICHT `string | null` — geen default meer. `null` = bewuste rustige effen scène (geen `<img>`, scène-lagen blijven).
- **Why:** de oude default "/concept-lab.png" zette stilzwijgend dezelfde foto op tientallen schermen; elke aanroeper moet nu bewust een atmosphere-asset of `null` kiezen.
- **How to apply:** nieuw scherm met ScreenShell → kies asset uit lib/atmosphere-library (paginaVoorkeur helpt) of expliciet `bg={null}`; nooit een default terugzetten.
