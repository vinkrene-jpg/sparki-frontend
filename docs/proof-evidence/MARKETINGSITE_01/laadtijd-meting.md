# MARKETINGSITE_01 — gemeten laadtijd (MKT-17)

**Gemeten:** 3 augustus 2026, productiebuild (`pnpm --filter @workspace/site run build`,
incl. prerender), geserveerd als statische site, Chromium met CDP-netwerkthrottling,
mobiele viewport 390×844. Script: `laadtijd-meetscript.mjs` (in deze map).

## 4G — gemiddelde telefoonverbinding (9 Mbps, 60 ms RTT)

| Pagina | FCP | DOMContentLoaded | Volledige load |
|---|---|---|---|
| / | 632 ms | 733 ms | 831 ms |
| /sporters | 440 ms | 827 ms | 1277 ms |
| /renner | 452 ms | 824 ms | 1086 ms |
| /prijzen/sporters | 376 ms | 578 ms | 579 ms |

**Oordeel:** eerste zichtbare inhoud (FCP) op elke gemeten pagina ruim onder één
seconde; de pagina is dan al leesbaar (prerendered HTML). De volledige `load`
boven 1 s op /sporters en /renner komt van lazy geladen productbeelden onder de
vouw — die blokkeren het lezen niet.

## Ondergrens: langzaam 4G / snel 3G (1,6 Mbps, 150 ms RTT)

| Pagina | FCP | Volledige load |
|---|---|---|
| / | 1444 ms | 3204 ms |
| /sporters | 1996 ms | 6714 ms |
| /renner | 1932 ms | 5664 ms |
| /prijzen/sporters | 1424 ms | 2715 ms |

**Eerlijk benoemd:** op deze tragere ondergrens ligt FCP boven één seconde
(1,4–2,0 s). De één-seconde-eis is gehaald op de "gemiddelde
telefoonverbinding" (4G); op slecht bereik is de site door prerendering wel
direct leesbaar zodra de HTML binnen is, maar niet binnen één seconde.

## Overige eisen in deze meting
- Prerendered HTML per route: leesbaar zonder JavaScript, eigen `<title>` +
  `meta description` (MKT-18) — zie buildlog (16 routes prerendered).
- Fonts self-hosted (@fontsource/inter); geen extern font-verkeer.
- Geen 4xx/5xx-responses tijdens de metingen.
