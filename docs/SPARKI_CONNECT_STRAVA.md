# Sparki Connect — Strava-koppeling & automatische synchronisatie

Dit document beschrijft hoe de Strava-koppeling end-to-end werkt: verbinden,
webhook-eerst synchroniseren, de inhaalsync-vangnetregel, samenvoegregels en de
statussen die de gebruiker ziet.

## Overzicht

Strava is een **webhook-eerst** koppeling:

1. **Verbinden** — per-gebruiker OAuth (`/api/connectors/strava/authorize` →
   Strava → `/api/connectors/strava/callback`). Tokens worden versleuteld
   opgeslagen in `connector_connections` (nooit in de API-respons).
2. **Eerste import** — direct na de callback draait een begrensde sync
   (max. 2 pagina's van 100 activiteiten, nieuwste eerst) via de centrale
   Data Hub-pipeline (`runSync` → `ingestBatch`): validatie, cross-source
   dedupe, consent en herkomst per veld.
3. **Webhooks** — Strava meldt nieuwe/gewijzigde activiteiten. Sparki haalt
   dan **precies die ene activiteit** op (`GET /activities/:id`) — geen
   volledige lijstopvraag, geen profielsync per webhook.
4. **Inhaalsync (vangnet)** — bij het openen van de Data Hub controleert
   Sparki of de koppeling "vers" is; zo niet, start op de achtergrond een
   begrensde inhaalsync.

## Actualiteitsgrens (gedocumenteerde afspraak)

`STALE_SYNC_HOURS = 24` (in `engines/data-hub/strava-sync.ts`).

De pure beslisregel `shouldCatchUp(connection, lastRunStatus, now)` geeft een
eerlijk Nederlands besluit terug:

| reden | betekenis | inhaalsync? |
|---|---|---|
| `geen_koppeling` | geen rij voor deze gebruiker | nee |
| `niet_verbonden` | status ≠ connected | nee |
| `geen_token` | verbonden maar geen bruikbaar token | nee |
| `nooit_gesynct` | nog nooit succesvol gesynct | ja |
| `verouderd` | laatste succes > 24 uur geleden | ja |
| `vorige_sync_mislukt` | laatste run faalde (ook al < 24u) | ja |
| `actueel` | laatste succes ≤ 24 uur geleden | nee |

De grens is inclusief: exact 24 uur oud is nog actueel; ouder dan 24 uur niet.

## Hervatbare, begrensde inhaalsync

`computeCatchUpAfterEpochSec(lastSyncAt, now)`:

- **Met** laatste syncmoment: `lastSyncAt − 48 uur` (bewuste overlap; de
  centrale dedupe maakt dubbele aanlevering onschadelijk).
- **Zonder** syncmoment: `now − 30 dagen` — nooit de volledige historie in
  één keer.
- Nooit negatief.

De inhaalsync draait met `afterEpochSec` en maximaal 5 pagina's per run
(rate-limit-vriendelijk). Oudere historie wordt bij volgende runs opgepakt —
hervatbaar omdat iedere run het venster opnieuw vanaf het laatste succes
berekent. Per gebruiker draait maximaal één inhaalsync tegelijk: een lokale
in-flight-set plus een **atomaire busy-gate in `runSync`** (transactie met
`pg_advisory_xact_lock` per gebruiker+koppeling). Die databaselock geldt ook
over meerdere serverinstanties heen — precies één sync kan starten, de rest
krijgt eerlijk `busy`.

## Webhook-verwerking

- Registratie: `ensureStravaWebhookSubscription()` (best-effort na de OAuth-
  callback) — vereist het secret **`STRAVA_WEBHOOK_VERIFY_TOKEN`**; zonder dat
  token wordt er eerlijk **niets** geregistreerd (fail-closed) en dekt de
  inhaalsync het gat.
- Events worden idempotent vastgelegd (`webhook_events`, uniek op
  provider+eventId) en verwerkt met trigger `webhook`.
- `aspect_type = delete` wordt eerlijk **overgeslagen**: Sparki verwijdert
  nooit lokale trainingsdata op basis van een extern signaal.
- Een 404 op de gerichte ophaling (verwijderd/privé) levert eerlijk niets op.
- Loopt er al een sync (`busy`), dan wordt het event overgeslagen — de
  lopende sync of de volgende inhaalsync pakt het op.

## Samenvoegregels (dedupe & verversen)

- Dedupe-sleutel: sport + startmoment-bucket, plus buursleutel-match.
- **Eerste bron wint** tussen bronnen: een veld dat al door een andere bron is
  gevuld, wordt nooit overschreven.
- **Zelfde bron mag verversen**: velden die eerder door Strava zijn geleverd
  (herkomst in `fieldSources`) mogen door een Strava-update wijzigen (bijv.
  hernoemde rit).
- **Handmatige correcties zijn heilig** (`manualFields`) — die overleven elke
  sync en webhook.

## Statussen in de app (Data Hub)

Zes gebruikersstatussen uit het centrale `deriveConnectState`:
`niet gekoppeld`, `bezig met koppelen`, `gekoppeld`, `synchroniseert`,
`actie nodig` / `toestemming ingetrokken`, `tijdelijk niet beschikbaar`.
De rij toont daarnaast de laatste succesvolle sync en één duidelijke
herstelactie: **Koppel**, **Opnieuw verbinden** of **Probeer nu**.

## Ontkoppelen

`POST /api/connectors/strava/disconnect` wist tokens en zet
`disconnectedAt`, maar **behoudt alle geïmporteerde activiteiten** — de
sporter blijft eigenaar van zijn data. Webhooks voor dit externe account
lossen daarna niet meer op (eerlijk overgeslagen).

## Vereiste omgeving

| variabele | doel |
|---|---|
| `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET` | OAuth (aanwezig) |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | webhook-registratie; zonder: geen webhooks (fail-closed), inhaalsync dekt het gat |

## Tests

`pnpm --filter @workspace/api-server run test:strava-sync` — 29 scenario's
(beslisregel-grenzen, inhaalvenster, merge-/manual-/cross-source-regels,
gerichte webhook create/update/delete, idempotentie, 404/429, busy,
token-lekkage, ontkoppelen behoudt data). Vereist `DATABASE_URL` +
`DEV_AUTH_BYPASS=true`; draai api-servertests sequentieel (gedeelde dist/).
