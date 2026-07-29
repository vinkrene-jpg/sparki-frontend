---
name: Meer-menu chapters SSOT
description: Hoe /meer (CoreMeerPage) zijn items krijgt en waarom een ontbrekend chapter stil verdwijnt
---
Regel: `ATHLETE_MEER_CHAPTERS` in `lib/chapters.ts` is de bron; `core-meer.ts` bouwt er groepen uit via een `byHref`-map met `byHref.get("/x")!` + `.filter(Boolean)`.
**Why:** een href die uit chapters.ts verdwijnt wordt door filter(Boolean) STIL uit de Core Meer-weergave gedropt (zo raakte /samen onbereikbaar — WP-A05). `test:navigation` bewaakt het verplichte contract (/you,/lichaam,/mechanieker,/samen,/kennis).
**How to apply:** bij menu-opschoning altijd `test:navigation` + `test:core-meer` draaien; nooit aannemen dat een chapter "elders" nog bereikbaar is.
