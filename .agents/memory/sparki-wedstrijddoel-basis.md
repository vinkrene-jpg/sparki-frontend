---
name: Wedstrijddoel basis (Laag 0) + volhoudbaarheidsas
description: Basisprofiel wielrennen (4 wattwaarden, leeslaag) en de gemeten Strava-limieten/volgorde voor de historie-import.
---

- Laag 0 = leeslaag, geen nieuwe opslag: `src/lib/basisprofiel.ts` + GET /api/wedstrijddoel/basisprofiel. Vier waarden (FTP/eFTP, beste 300/60/5 s uit `training_sessions.power_bests`), venster 90d vs 90d ervoor, scheefgroei benoemd, meetniveau-poort (hartslag→vereenvoudigd; geen niveau maar wél power_bests = data-als-bewijs pro).
- **Why:** doc WEDSTRIJDDOEL_BASIS v2: alle vier gelijk bewaakt, absolute watts, geen weging (weging = Laag 1, geblokkeerd tot volhoudbaarheidsdata bestaat).
- Volhoudbaarheid (#557, gemerged): `training_sessions.power_durability` jsonb — totale kJ + bests per arbeidsniveau 0/1000/1500/2000/2500 kJ, alleen bij file-ingest met per-sample power; geen backfill.
- Strava-limiet ECHT gemeten (04-08-2026, headers uit live respons): totaal 400/15min + 4000/dag; lezen 200/15min + 2000/dag. Per APP gedeeld. Refresh-token roteerde NIET bij refresh (prod-koppeling bleef intact); prod-tokens stonden legacy-plaintext; SPARKI_TOKEN_KEY bestaat alleen ín de deployment.
- Strava-koppeling haalt GEEN streams op (alleen average/weighted_average_watts); volhoudbaarheid over Strava-historie vergt Streams-API-call per activiteit óf de bestandsroute (Strava-archiefexport → FIT-ingest; upload-route mist nog .gz-ondersteuning en bulk — nodig vóór die route werkbaar is).
- **How to apply:** gefaseerde historie-import NIET starten vóór stream-ophaal of werkende bestandsroute; vormen-zichtbaarheid overal via `lib/training/form-visibility.ts` (formVisibleTo); individuele plan-slots lezen eist hasDirectCoachLink, niet hasCoachAccess.
