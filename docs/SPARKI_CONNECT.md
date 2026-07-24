# Sparki Connect — centrale synchronisatielaag

Eén robuuste laag voor alle platformkoppelingen (Strava, bestandsimport,
voorbereid: Garmin/Wahoo). De Data Hub is de enige bron van waarheid: elke
import — handmatig, webhook, inhaalsync, gepland of onboarding — loopt door
hetzelfde pad (`runSync` → adapter → `ingestBatch`). Er bestaat géén tweede
syncsysteem.

## Architectuur

```
trigger (manual | scheduled | webhook | backfill | onboarding)
   └─ runSync(clerkId, provider, trigger, { activityIds?, afterEpochSec? })
        ├─ kill switches (imports_sync, external_providers)
        ├─ busy-wacht: advisory lock + verse "running" sync_run → HubError(busy)
        ├─ adapter.fetchAndNormalize (met withTransientRetry: 2 herkansingen,
        │    alléén bij tijdelijke fouten: netwerk / 5xx / 429)
        ├─ ingestBatch: valideren → dedupe/merge → consent → opslaan
        ├─ connector_connections bijwerken (status, lastSyncAt, foutcategorie)
        └─ sync_runs-logregel (status success | partial | failed, counts, fout)
```

Bestanden:
- `artifacts/api-server/src/engines/data-hub/index.ts` — `runSync`, busy-wacht,
  transient-retry, kill switches, logboek.
- `engines/data-hub/ingest.ts` — validatie, dedupe/merge, consent, opslag.
- `engines/data-hub/dedupe.ts` — dedupe-sleutel, merge-regels, conflictlogboek.
- `engines/data-hub/strava-sync.ts` — webhook-verwerking + per-gebruiker
  inhaalbeslissing (`shouldCatchUp`, `computeCatchUpAfterEpochSec`).
- `engines/data-hub/scheduled-sync.ts` — geplande inhaalsync voor álle
  gebruikers (`runScheduledConnectorSync`).
- `src/jobs/connector-sync.ts` — CLI voor de Scheduled Deployment (`job:sync`).
- `src/lib/connectors/connect-status.ts` — statusmodel (`deriveConnectState`).

## Sync-planner

Webhooks zijn het primaire kanaal (Strava stuurt per activiteit een event; de
webhook-route start een gerichte `runSync` met `activityIds`). Daarbovenop:

1. **Per-gebruiker inhaalsync** (`maybeScheduleStravaCatchUp`): bij app-gebruik
   wordt gecontroleerd of de laatste sync verouderd of mislukt is; zo ja, dan
   draait een incrementele sync (`afterEpochSec` = laatste sync − overlap).
2. **Geplande inhaalsync** (`job:sync`, aanbevolen dagelijks 05:00
   Europe/Amsterdam, cron `0 5 * * *`): loopt sequentieel over ALLE echt
   gekoppelde, synchroniseerbare platforms en past dezelfde
   `shouldCatchUp`-regels toe. Eén fout stopt de rest nooit; `busy` telt niet
   als fout. Veiligheidsklep: `SYNC_JOB_MAX_CONNECTIONS`.

Incrementeel is de norm: nooit een volledige her-import buiten een expliciete
backfill. Dedupe maakt herhaald draaien onschadelijk.

## Conflictregels bij dubbele activiteiten

Dedupe-sleutel = sport + 5-minuten-startbucket (+ buurbuckets +
plausibiliteitscheck op duur/afstand). Bij een match wordt samengevoegd, nooit
gedupliceerd:

- **Eerste bron wint**: bestaande waarden blijven staan; een latere bron vult
  alleen ontbrekende velden aan.
- **Eigen velden verversen**: de bron die een veld eerder leverde mag het
  bijwerken (`fieldSources` houdt per veld de herkomst bij).
- **Handmatig is heilig**: door de sporter gecorrigeerde velden
  (`manualFields`) worden nooit overschreven — ook niet als de sporter ze
  bewust leeg maakte.

Elke samenvoeging schrijft een regel in het interne conflictlogboek
(`training_sessions.merge_log`, additief jsonb, max 20 regels): welke bron
erbij kwam, alle bronnen daarna, welke velden verschilden (behouden vs
aangeboden waarde + winnende bron) en de reden in gewone taal. Alleen intern
(beheer/ondersteuning); de sporter ziet nooit een duplicaat.

## Statusmodel per koppeling

`deriveConnectState` vertaalt de verbindingsrij naar één eerlijke status; de
frontend (`connections-section.tsx`) toont die in gewone taal:

| Status | Betekenis / copy |
| --- | --- |
| `not_connected` | Niet gekoppeld |
| `connected` | Gekoppeld — "Laatst gesynct …" |
| `sync_in_progress` | "Gegevens worden nu opgehaald…" |
| `temporarily_unavailable` | Tijdelijke fout — "Sparki probeert het vanzelf opnieuw" |
| `action_required` | Blijvende fout — "Er is een actie nodig — verbind opnieuw"; bij `consentExpired`: "Toestemming verlopen — verbind opnieuw om te blijven synchroniseren" |
| `permission_revoked` | "Toegang ingetrokken — verbind opnieuw om verder te gaan" |
| `disconnected` | Zelf verbroken |

`consentExpired` = toegangstoken over datum zonder vernieuwingstoken (met
vernieuwingstoken ververst de adapter stil en is er niets aan de hand).
Foutcategorieën (`auth`/`permission`/`temporary`/`unknown`) bepalen tijdelijk
vs. actie-nodig.

## Gebruikersacties (één backend-pad)

Alle acties lopen via de connectors-API (`routes/connectors.ts`):
- **Nu synchroniseren** — `POST /api/connectors/:id/sync` → `runSync`.
- **Historie ophalen (backfill)** — `POST /api/connectors/:id/backfill`.
- **Koppeling verwijderen** — `POST /api/connectors/:id/disconnect` (tokens
  gewist, data blijft; status `disconnected`).
- **Opnieuw koppelen** — `GET /api/connectors/:id/authorize` → OAuth-flow →
  callback herstelt de verbinding.
- **Toestemming per datatype** — consents (default-grant; ingetrokken types
  worden bij ingest overgeslagen, nooit met terugwerkende kracht gewist).

## Sync-logboek

Elke poging = één rij in `sync_runs`: trigger, status
(`running`/`success`/`partial`/`failed`), tijden, fout, en `counts`:
`received` (aangeleverd vóór dedupe), `activities` (nieuw), `merged`
(samengevoegd/bijgewerkt), `skipped`, `errors` (+ voorbeelden), plus
`importedDataTypes` na consent. Deels mislukte runs zijn eerlijk `partial`,
nooit een stille success. Inzien: `GET /api/connectors/:id/runs` en het
admin-overzicht Geplande taken (`connector_sync`-kaart, eerlijk grijs zonder
gekoppelde platforms).

## Performance

- Incrementele syncs met `afterEpochSec` (overlap tegen randverlies).
- Busy-wacht: nooit twee gelijktijdige syncs per gebruiker+platform
  (advisory lock, atomair) — herhaalverzoeken stapelen niet.
- Geplande job draait sequentieel (rate-limit-vriendelijk) met begrenzer.
- Dedupe maakt dubbel werk idempotent; webhooks halen alleen het genoemde
  activiteit-id op.

## Foutafhandeling

- Tijdelijke fouten (netwerk, 5xx, 429): automatisch 2 herkansingen met
  backoff; daarna eerlijk `failed`.
- Permanente fouten (auth, 4xx): direct zichtbaar falen; verbindingsstatus
  krijgt de foutcategorie; één actieve melding per koppeling
  (`resolutionKey sync:<provider>`, lost vanzelf op bij de eerstvolgende
  geslaagde sync).
- Kill switches (`imports_sync`, `external_providers`) stoppen alleen NIEUWE
  verwerking; bestaande data blijft onaangetast.

## Security

- Tokens staan uitsluitend server-side in `connector_connections`; de API
  geeft alleen `tokenAvailable`/`consentExpired` terug, nooit het token.
- OAuth per gebruiker (geen account-brede connectors); state-parameter en
  redirect-URI-controle in de authorize/callback-flow.
- Webhook-verificatie fail-closed (zonder geconfigureerd secret geen
  verwerking).
- Alle koppelingsroutes zijn eigenaar-gebonden (clerkId uit de sessie, nooit
  uit de request-body).

## Beheer & tests

- Scheduled Deployment: `pnpm --filter @workspace/api-server run job:sync`
  (dagelijks 05:00 Europe/Amsterdam). Env: `SYNC_JOB_MAX_CONNECTIONS`
  (optioneel).
- Tests: `test:connect-sync` (geplande sync-beslissingen, eerlijke faalroute),
  `test:scheduled-tasks` + `test:scheduled-tasks-route` (admin-overzicht incl.
  `connector_sync`), `test:connect-status`, `test:connect-import`,
  `test:strava-sync`, `test:data-hub`, `test:provider-sync`.
