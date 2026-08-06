---
name: MapLibre vectorkaart (KAART_VECTOR_01)
description: MapLibre GL + OSMF Shortbread-tegels in sparki-web — versieval, stijlbestand, dev-preview-route-val
---

# MapLibre vectorkaart

- **maplibre-gl v6.1.0 (aug 2026) laadt een stijl met een vector-source via
  `url:` (Shortbread-tilejson van vector.openstreetmap.org) STIL nooit af**:
  geen error-event, `isStyleLoaded()` blijft false, nul tegelverzoeken.
  **Fix:** pin op de stabiele v5-lijn (`maplibre-gl@^5`). Reproduceerbaar in
  een kale standalone-pagina, dus geen app-probleem.
- Stijl-SSOT: `artifacts/sparki/public/kaart/sparki-stijl.json` — VersaTiles
  "colorful" (Shortbread-schema) programmatisch omgekleurd naar Sparki-kleuren;
  bron = OSMF `https://vector.openstreetmap.org/shortbread_v1/tilejson.json`,
  glyphs/sprites van tiles.versatiles.org. Laden via
  `${import.meta.env.BASE_URL}kaart/sparki-stijl.json`.
- **DEV Preview-schil heeft een EIGEN route-lijst** (startsWith-keten in
  `components/sparki/dev-preview.tsx`): een nieuwe pagina alleen in App.tsx
  routen ⇒ in acceptatiemodus valt de URL stil terug op home (en de
  App.tsx-router wordt daar zelfs uit de bundel geschud). Elke nieuwe route
  dus in BEIDE registreren; let op prefix-volgorde (vóór kortere prefixes).
- WebGL2 ontbreekt in de standaard screenshot-browser (zwart vlak +
  GPUInitializationError); bewijs kaartweergave via eigen chromium met
  `--use-angle=swiftshader --enable-unsafe-swiftshader`.
- Tailwind-klasse `fixed inset-0` bleek op de proefpagina niet toegepast
  (computed position relative, hoogte 0 → 300px-canvas); inline style
  `{position:"fixed",inset:0}` is daar de betrouwbare vorm.
