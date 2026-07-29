---
name: Route-omgeving achtergrond-warm-up
description: Pre-warming van Overpass-omgeving + wegobjecten-corridor zodat de rustige-wegen-vergelijking bij /generate binnen het 2s-budget op volledige data draait.
---

# Route-omgeving warm-up

- `lib/route-insight.ts` heeft naast de per-geometrie ENV_CACHE een **warm-gebied-cache**: `warmRouteEnvironmentArea(center)` haalt alle omgevings-elementen voor ~20×20 km op; `getRouteEnvironment` rekent een route die binnen zo'n vers gebied valt lokaal uit (geen netwerk). **Eerlijkheid:** raakt de gebiedsquery de elementenlimiet (mogelijk afgekapt), dan wordt het gebied NIET opgeslagen — het directe meetpad blijft dan gelden.
- `lib/road-objects/overpass.ts` SYNCED-cache kent nu **omvatting**: een corridor-bbox die volledig binnen een eerder (vers) gesynct groter gebied valt slaat de netwerkstap over. Zo is `getRoadObjectsAlongRoute` na warm-up puur DB.
- `lib/route-env-warmup.ts`: in-process scheduler (patroon = reminder-scheduler; prod default aan, dev opt-in `ROUTE_ENV_WARMUP=true`, interval 4u < 6u TTL) warmt woonlocaties van recentst actieve atleten + recent gegenereerde startgebieden (in-memory, 24u). `/generate` roept `recordGeneratedArea` aan; de directe fire-and-forget-warm is gegate op dezelfde enabled-check zodat tests/dev geen ongevraagd Overpass-verkeer maken.
- Meetbaarheid: `candidate-environment.ts` logt per kandidaat `[ENV-COVERAGE] ... full=k/n` (aandeel vergelijkingen met volledige env+road-data).

**Why:** interactief pad heeft 2s-budget; koude Overpass haalt dat niet, waardoor de vaste rustige-wegen-eis op minder signalen draaide.
**How to apply:** nieuwe generatiepaden: registreer startgebied via `recordGeneratedArea` en houd warm-work altijd fire-and-forget; wijzig je de Overpass-classificatie, doe dat in `classifyEnvironment` (gedeeld door beide paden).
