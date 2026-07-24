# Integraties & externe koppelingen — Sparki (24 juli 2026)

| Integratie | Status | Details |
|---|---|---|
| **Clerk** (Replit-managed) | Actief | Cookie-based auth web, `publishableKeyFromHost`, FAPI-proxy prod-only, JIT-provisioning |
| **PostgreSQL** (Replit/Neon) | Actief | Drizzle ORM, 162 tabellen |
| **Anthropic** | Actief | Alle modelaanroepen via centrale gateway `aiMessage()`; metadata-only logging |
| **Gemini** (Replit AI-integratie) | Actief (beperkt) | Alleen Photo Lab (relight); geïsoleerde flow |
| **Strava** | Actief | Per-gebruiker OAuth (tokens in `connector_connections`), import/backfill, webhook, rit-upload (handmatige activiteit), geplande inhaalsync; secrets aanwezig |
| **Garmin / Wahoo** | Voorbereid | Providers + webhooks compleet, fail-closed secrets; `configured:false` tot fabrikantsleutels |
| **Fitbit** | Placeholder | Registry-vermelding, geen provider-code, niet aangeboden in UI |
| **openrouteservice (ORS)** | Actief | Routegeneratie op echte wegen; rejoin/loop-kwaliteitsbewaking; nooit rechte lijnen |
| **Overpass (OSM)** | Actief | POI's, wegtypen/ondergrond, route-opmerkingen, klimmen; mirror-keuze; storing eerlijk |
| **Open-Meteo** | Actief | Weer op thuislocatie voor dagelijkse oppervlakken |
| **Mapbox** | Actief | Kaarttegels (token aanwezig) |
| **Resend** (Replit-integratie) | Beperkt actief | Sandbox zonder geverifieerd domein → alleen accounteigenaar; jobs slaan eerlijk over |
| **Web Push (VAPID)** | Actief | Eigen sleutels; host-allowlist SSRF-guard op subscribe én send |
| **Object storage (Replit App Storage)** | Actief | Foto's (voeding, materiaal, fietsscan, journey); ACL pas ná bytes; owner-checked serve |
| **Fietssport / We-Tri / KNWU** | Actief / beperkt | Kalenderimport: eerste twee volledig (regex-parsers, SSRF-allowlist); KNWU eerlijk-beperkt |
| **arXiv / literatuurbronnen** | Actief | Kennisscan-job met word-boundary relevantie-guard |

Kill switches: `imports_sync`, `external_providers`, `club_features` + gateway-killswitch — allemaal fail-safe.
