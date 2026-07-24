# Sparki Connect — Garmin (eerlijke functiestatus)

Status: opdracht 3A. Garmin is in Sparki **voorbereid maar niet actief**: er is
geen officiële Garmin API-toegang (geen fabrikantssleutels), dus Sparki belooft
nergens Garmin-functionaliteit die niet bestaat.

## Statusmodel per functie

De server beoordeelt per platform vijf functies (`deriveCapabilities` in
`artifacts/api-server/src/lib/connectors/connect-status.ts`). Mogelijke
statussen:

| Status | Betekenis |
| --- | --- |
| `available` | Werkt vandaag echt (code + configuratie aanwezig). |
| `awaiting_official_access` | Code ligt klaar; wacht op officiële toegang/goedkeuring van de fabrikant. |
| `prepared_not_active` | Voorbereid (bv. registratie/consent), maar de echte implementatie bestaat nog niet. |
| `unsupported` | Bestaat niet voor dit platform. |

## Garmin vandaag

| Functie | Status | Waarom |
| --- | --- | --- |
| `activity_import` | `awaiting_official_access` | `fetchGarminActivities` (device-sync) bestaat, maar werkt pas met officiële sleutels (`isDeviceProviderConfigured("garmin")` is fail-closed). |
| `health_data` | `prepared_not_active` | Garmin belooft in de registry hersteldata, maar er bestaat **geen enkele** gezondheidsdata-fetcher — dus nooit "wacht alleen op goedkeuring". Centrale gate: `HEALTH_INGEST_PROVIDERS` (vandaag leeg). |
| `workout_export` | `unsupported` | Er is geen push-implementatie voor trainingen. |
| `route_export` | `awaiting_official_access` | `pushRouteToDevice` bestaat; werkt pas met sleutels. |
| `webhook_sync` | `awaiting_official_access` | Webhook-ontvangst is voorbereid, fail-closed op secrets. |

Zodra ooit een echte gezondheidsdata-fetcher bestaat en getest is, wordt het
platform aan `HEALTH_INGEST_PROVIDERS` toegevoegd — pas dán kan `health_data`
`available`/`awaiting_official_access` worden.

## Wat de gebruiker ziet

- **Alleen gewoon Nederlands**, nooit interne codes of tokens:
  - `available` → "Gekoppeld zodra je verbindt"
  - `awaiting_official_access` → "Deze functie wacht nog op goedkeuring"
  - `prepared_not_active` → "Nog niet beschikbaar"
  - `unsupported` → wordt niet getoond
- Web: `connections-section.tsx` toont voor niet-beschikbare apparaatplatforms
  (Garmin/Wahoo) de functielijst (`CapabilityList`) met deze zinnen, plus de
  badge "Binnenkort" en de bestaande `unavailableReason`.
- `GET /api/connectors` levert per platform het `capabilities`-blok; de
  respons bevat nooit `accessToken`/`refreshToken` (test-gedekt).

## Tests

- `pnpm --filter @workspace/api-server run test:connect-status` — 17 checks
  (statusafleiding, capability-eerlijkheid, tokenveiligheid, echte route).
- `pnpm --filter @workspace/api-server run test:connect-import` — bevat de
  check dat géén platform `health_data: available` claimt en dat Garmin
  eerlijk `prepared_not_active` rapporteert.
