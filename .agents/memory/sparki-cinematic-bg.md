---
name: Sparki cinematic background treatment
description: The premium dark visual direction for the Sparki app background and cards, and the constraints behind it.
---

# Cinematic background (Sparki)

All app screens (Home/Train/Feed/Lab/You) share `ScreenShell`, so the background
treatment is defined once there and propagates. The intended look is a **premium
cycling performance lab**, not a flat dark app.

## The rules
- Background is a `fixed` layer so the cyclist photo stays visible behind the ENTIRE
  page (subtle parallax) and doesn't stretch/distort on long scrolls.
- Cyclist must be clearly recognizable: image ~0.55–0.56 opacity, NOT achieved by
  raising brightness alone — paired with a softened **blue-black** gradient overlay
  (reduced hard black) + drifting atmospheric haze for depth.
- Base color is `#05070e` (soft blue-black), deliberately lifted off pure `#000` so it
  doesn't crush on OLED.
- Text over the background uses soft dark **scrims** (radial/linear, faded edges) and
  text-shadow — never solid boxes or white surfaces.
- Cards are frosted glass: `bg-[#070d16]/[0.82] backdrop-blur-md` with subtle light
  borders (`border-white/[0.08]`), so ~18% of the background shows through.

**Why:** user explicitly rejected the flat-black look and asked for a cinematic,
atmospheric, premium performance-center feel with the rider visible page-wide. Keep
cyan/neon accents. No pastels, no avatars, no generic card-dashboard styling.

**How to apply:** change the treatment in `ScreenShell` (background) to affect all
pages at once. Match new cards to the glass recipe above. Mobile-first (`max-w-md`);
verify at ~402px width and keep the fixed `BottomNav` legible.
