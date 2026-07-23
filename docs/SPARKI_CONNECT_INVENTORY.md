# Sparki Connect — inventarisatie (Opdracht 1/4)

Datum: 23 juli 2026. Doel: vastleggen wat er al bestaat rond koppelingen,
zodat Sparki Connect uitsluitend hergebruikt, verbindt en gericht aanvult —
niets opnieuw bouwt.

## 1. Bestaande onderdelen (vóór deze opdracht)

### Datamodel
- `lib/db/src/schema/connectors.ts` — `connector_connections` (per gebruiker ×
  platform: status `pending|connected|error|revoked|disconnected`, tokens
  server-side, `connectedAt`, `lastSyncAt`, `importedDataTypes`, `errorStatus`,
  `permissionRevoked`), `connector_consents` (per-datatype toestemming),
  `sync_runs` (elke echte sync-run met status/teller/foutmelding),
  `connector_activities` (ruwe activiteiten met dedupe-sleutel).
- Consent is fail-closed en per datatype; handmatig ingevoerde velden zijn
  heilig (`manualFields`).

### Server
- `artifacts/api-server/src/lib/connectors/registry.ts` — registry met 17
  platforms (Strava, Garmin, Wahoo, Polar, Suunto, Coros, Zwift, …), per
  platform `authType`, `provides`, `available` + Nederlandse
  `unavailableReason`. Runtime-beschikbaarheid via `effectiveAvailability`
  (registry × aanwezige sleutels).
- `artifacts/api-server/src/routes/connectors.ts` — GET-lijst (registry ×
  eigen rijen), authorize/callback (Strava OAuth per gebruiker), sync,
  disconnect, revoke, consents.
- `artifacts/api-server/src/engines/data-hub/` — één syncpad (`runSync`):
  fetch → normaliseer → valideer → dedupe/merge → consent → persist →
  `sync_runs`-log. Bestandsimport (FIT/GPX/TCX) is een echte Data
  Hub-bron (`provider: "file"`), geen apart silo.
- Device-sync (Garmin/Wahoo): route-push (`pushRouteToDevice`) en
  webhook-ontvangst zijn voorbereid, fail-closed zonder officiële
  fabrikantssleutels — nooit "actief" zonder die sleutels.

### Frontend
- `artifacts/sparki/src/lib/connectors.ts` — API-types + fetch/mutaties.
- `components/sparki/connections-section.tsx` — beheerpaneel (koppelen,
  sync, verbreken, toestemmingen); gebruikt in onboarding (connect-stap in
  `onboarding-v2.tsx`) én profielinstellingen. Zelfde databron: GET
  `/api/connectors`.
- `components/sparki/activity-import-panel.tsx` — bestaande FIT/GPX/TCX-
  importflow (op /train).

## 2. Wat ontbrak
- Eén centraal, server-side statusmodel (de UI leidde nuances zelf af).
- Velden `lastSyncAttemptAt`, `lastErrorCategory`, `disconnectedAt`.
- Eerlijke capabilitystatus per platform.
- Een beheerpagina "Sparki Connect" bereikbaar via Meer > Instellingen.

## 3. Wat deze opdracht toevoegde (hergebruik, geen parallel systeem)
- Schema-uitbreiding (uitsluitend additief): `last_sync_attempt_at`,
  `last_error_category`, `disconnected_at` op `connector_connections`.
- `artifacts/api-server/src/lib/connectors/connect-status.ts`:
  - `deriveConnectState(row, {syncRunning})` → 8 statussen:
    `not_connected`, `connecting`, `connected`, `sync_in_progress`,
    `action_required`, `temporarily_unavailable`, `permission_revoked`,
    `disconnected` + velden `lastSuccessfulSyncAt`, `lastSyncAttemptAt`,
    `lastErrorCategory`, `permissionState`, `tokenAvailable` (nooit het
    token zelf), `disconnectedAt`.
  - `categorizeConnectError` → `auth|permission|temporary|unknown`.
  - `deriveCapabilities(def, effectiveAvailable)` → per platform
    `activity_import|health_data|workout_export|route_export|webhook_sync|
    file_import` × `available|prepared_not_active|awaiting_official_access|
    unsupported`. Garmin/Wahoo zonder officiële sleutels nooit `available`.
  - `FILE_IMPORT_CAPABILITIES` — de ingebouwde bestandsimport is de enige
    bron met `file_import: available` (die werkt vandaag echt).
- Data Hub schrijft nu `lastSyncAttemptAt` bij elke poging en
  `lastErrorCategory` bij falen (leeg bij succes); disconnect zet
  `disconnectedAt`. Geen tweede syncpad.
- GET `/api/connectors` geeft per platform een `connect`- en
  `capabilities`-blok terug (één bouwer `toConnectorItem`), plus een
  `fileImport`-blok. Onboarding en instellingen lezen dus dezelfde bron.
- Frontend: pagina `/connect` ("Sparki Connect", Meer > Instellingen) die
  bestaande `ConnectionsSection` + `ActivityImportPanel` hergebruikt; geen
  nieuwe tab, geen nieuwe datastroom, geen tokens zichtbaar.

## 4. Bewust NIET gedaan
- Geen Strava-synchronisatie gebouwd of gewijzigd (Opdracht 2).
- Geen mockdata, geen fictieve statussen, geen parallel statusregister.
- Garmin/Wahoo blijven fail-closed tot officiële sleutels aanwezig zijn.

## 5. Test
- `pnpm --filter @workspace/api-server run test:connect-status` — 17
  scenario's: alle 8 statussen, foutcategorieën, tokenveiligheid,
  capability-eerlijkheid (incl. Garmin), bestandsimport en de echte route
  (respons zonder tokens, `disconnectedAt` na verbreken).
