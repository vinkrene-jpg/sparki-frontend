# FEATURE_MATRIX — Sparki (24 juli 2026)

Per feature: platform, rollen, feature-flag/kill switch en productiestatus.
Productiestatus-legenda: **Prod-klaar** (werkt in productie zonder extra stappen) · **Prod-klaar met voorwaarde** (werkt, maar externe sleutel/configuratie of native build nodig) · **Niet in productie**.

| Feature | Platform | Rollen | Flag / switch | Productiestatus |
|---|---|---|---|---|
| Onboarding (vragen → connect → gap-fill) | web | allen | — | Prod-klaar |
| Sportpaspoort | web | athlete | — | Prod-klaar |
| Vandaag (dagtype, Momentblok, State Card, dagadvies, weer) | web | athlete | — | Prod-klaar |
| Trainingen (plan/log/import GPX-FIT-TCX) | web | athlete, coach | — | Prod-klaar |
| Autonoom trainingsplan + adaptieve voorstellen | web | athlete | — | Prod-klaar |
| Sparki-coaching (observaties, chat, Core-voorspelling, voice) | web | athlete | `ai_observations`-flag (uit; observaties via engine actief), gateway-killswitch | Prod-klaar |
| Coach-cockpit | web | coach | `coach_portal` (flag uit — uitrol via releasegroepen) | Prod-klaar (flag-gestuurd) |
| Ouderomgeving | web | parent | `parent_portal` (flag uit — uitrol via releasegroepen) | Prod-klaar (flag-gestuurd) |
| Lab (belasting/vorm/FTP-ondergrens/mentaal/herstel) | web | athlete | — | Prod-klaar |
| Wedstrijden + Race Intelligence + gids-analyse | web | athlete, coach | — | Prod-klaar |
| Wedstrijdexport GPX/FIT | web | athlete | — | Prod-klaar |
| Kalenderimport (Fietssport, We-Tri, KNWU-beperkt) | web | athlete | — | Prod-klaar (KNWU eerlijk beperkt) |
| Routes & generator + verrijking (POI's, wegtypen, klimmen) | web | athlete | `route_planner` (aan), `climb_explorer` (aan) | Prod-klaar (Overpass/ORS-afhankelijk, storing eerlijk) |
| Voeding + seizoensdoel | web | athlete (jeugdveilig) | — | Prod-klaar |
| Mechanieker / garage / fietsscan / materiaalcoach | web | athlete | — | Prod-klaar |
| Sociaal (vrienden, feed, live locatie, rit delen) | web + mobiel | athlete | — | Prod-klaar |
| Club | web | clubrollen | kill switch `club_features` | Prod-klaar (switch-gestuurd) |
| Helpdesk & support | web + mobiel | allen | — | Prod-klaar |
| Meldingen in-app + web push | web | allen | — | Prod-klaar (VAPID-sleutels aanwezig) |
| Meldingen per e-mail | server | allen | — | Prod-klaar met voorwaarde: geverifieerd maildomein ontbreekt (sandbox-only, slaat eerlijk over) |
| Admin (health check, testers, flags, uitrol) | web | admin | `testing_tools` (uit) | Prod-klaar (`SPARKI_ADMIN_IDS` vereist) |
| Privacy & account (export, verwijderen, consents) | web | allen | — | Prod-klaar |
| Strava-sync (OAuth, webhook, backfill, geplande catch-up) | web + server | athlete | flag `strava` (uit — uitrol), kill switches `imports_sync`/`external_providers` | Prod-klaar (client-secrets aanwezig) |
| Garmin/Wahoo-sync | server | athlete | flag `garmin` (uit) | Prod-klaar met voorwaarde: fabrikantsleutels ontbreken (`configured:false`, eerlijk in UI) |
| Data Hub (ingest, dedupe/merge, conflictlogboek, sync-logboek) | server | athlete | — | Prod-klaar |
| Journey & wedstrijddossier | web | athlete | — | Prod-klaar |
| Kennisbank + intel-hub | web | athlete; beheer admin | `knowledge_base` (aan) | Prod-klaar |
| World (fictieve renners) + world-social | web | athlete | — | Prod-klaar (expliciet fictief) |
| Doelen + maandreview-job | web + job | athlete | — | Prod-klaar (Scheduled Deployment vereist) |
| Rit-verhaal | web | athlete | `rit_verhaal` (uit) | Prod-klaar (flag-gestuurd) |
| Mobiele ritregistratie (achtergrond, val-alarm, sprints, BLE) | mobiel | athlete | — | Prod-klaar met voorwaarde: native build (EAS); Expo Go beperkt en eerlijk gemeld |
| Mobiele navigatie (HUD, audio, off-route, volgauto, wedstrijdmodus) | mobiel | athlete | — | Prod-klaar met voorwaarde: native build |
| Store-distributie / releasegroepen / releasecandidate-straat | server + admin | admin | releasegroepen | Prod-klaar |
| Premium/abonnementen | — | — | flag `premium` (uit) | Niet in productie (niet gebouwd) |
| Komoot / Google / Fitbit | — | — | — | Niet in productie (niet gebouwd; Fitbit alleen registry-vermelding) |

## Feature flags (live DB, 24 juli 2026)

| Flag | Globaal aan | Rollout % |
|---|---|---|
| ai_observations | nee | 100 |
| climb_explorer | ja | 100 |
| coach_portal | nee | 100 |
| garmin | nee | 100 |
| knowledge_base | ja | 100 |
| parent_portal | nee | 100 |
| premium | nee | 100 |
| rit_verhaal | nee | 100 |
| route_planner | ja | 100 |
| strava | nee | 100 |
| testing_tools | nee | 100 |

Flags met "nee" zijn per releasegroep/tester of per-gebruiker overschrijfbaar (resolutie-precedentie in `lib/flags.ts`); kill switches staan los daarvan (fail-safe uit-knoppen).
