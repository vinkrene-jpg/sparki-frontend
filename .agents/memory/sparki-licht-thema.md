---
name: Sparki licht thema (LICHT_THEMA_01)
description: App-breed één licht thema; overruled het oude donkere cinematic-besluit; uitzonderingen en valkuilen
---
Besluit René 03-08-2026: hele app (web + mobiel) heeft ÉÉN licht thema — geen donker/licht-schakelaar (LT-15), geen `[color-scheme:dark]` op gewone schermen. Dit OVERRULED het eerdere donkere cinematic-bg-besluit (glass/OLED); dat topic is historisch.

**Regels:**
- Niets hardcodeert eigen kleuren; alles via tokens in `artifacts/sparki/src/index.css`. Vertaalgids: `docs/lt-vertaalgids.md`.
- Bewust donkere uitzonderingen (gedocumenteerd): route-navigator.tsx (volledige kaart-HUD op donkere CARTO-tegels, --color-map-*), world-reel.tsx foto-scrims, camera-viewfinder (bike-scan-capture). Witte klassen daar zijn correct — nooit een globale text-white→donker-override plaatsen (die brak de kaart-HUD).
- Diepte = schaduw-tokens (--shadow-card/float), geen gloed. Grafieken: assen/raster doorschijnend donker (chart-kleuren.ts); raster bewust ~1.85:1 (gedocumenteerd besluit), as-labels ≥4.5.
- Contrast wordt GEMETEN: script-aanpak + rapport `docs/proof-evidence/LICHT_THEMA_01/contrast-meting.md`. accent-cyan = oklch(0.50 0.13 205) (tekstveilig én vlak); warning/tempo L=0.55.
- Mobiel: constants/colors.ts spiegelt exact de web-tokens; colors.light===colors.dark; StatusBar dark-tekst behalve kaart-HUD.
- Valkuilen gezien: on-accent-tekst alleen op echt accent/donker vlak; lichte tinttinten (text-cyan-100 e.d.) nooit als tekst op licht.
