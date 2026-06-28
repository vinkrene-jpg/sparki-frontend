---
name: ImageMagick SVG glow rasterization
description: Why glow/blur in app icons must be gradient-based when the only rasterizer is ImageMagick
---

# ImageMagick rasterizes SVG glow/blur poorly

The Replit container has only `magick`/`convert` (ImageMagick) for SVG→PNG — no
`sharp`, `rsvg-convert`, or `inkscape`. ImageMagick's built-in MSVG/MVG renderer
**ignores or badly rasterizes SVG filters** (`<filter>`, `feGaussianBlur`,
`feDropShadow`), so any glow built with those filters disappears or looks blocky
in the generated PNGs.

**Rule:** build glows/halos with layered `radialGradient` fills (e.g. an outer
soft halo circle + an inner core), never with `feGaussianBlur`/`<filter>`. Render
with `magick -background none -density 600 icon.svg -resize NxN out.png`.

**Why:** the radioactive-green bolt icon glow had to be redone as gradients after
filter-based blur produced no visible glow in the rasterized PNGs.

**How to apply:** when generating app icons / favicons / any SVG→PNG asset that
needs a soft glow or shadow on this platform, design it with gradients. Always
regenerate ALL PNG derivatives (icon-192/512, apple-icon, light/dark 32x32) from
the SVG — installed PWA/home-screen icons come from the manifest PNGs, not the
SVG, and are additionally OS-cached (may need reinstall to refresh on device).
