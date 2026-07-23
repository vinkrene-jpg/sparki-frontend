# Verplichte juridische acceptatie (OPDRACHT 0A)

Server-side afgedwongen acceptatie van drie verplichte documenten vóór gebruik
van persoonlijke functies: **gebruiksvoorwaarden** (`terms`),
**privacyverklaring** (`privacy`) en **gezondheids- en trainingsdisclaimer**
(`gezondheid`).

## Architectuur

- **Documenten (SSOT):** tabel `legal_documents` (bestond al) — één rij per
  `kind`+`version`, hoogste `published_at` per kind is de actieve versie.
  Teksten en het register van verplichte soorten staan in
  `artifacts/api-server/src/lib/legal-texts.ts` (`REQUIRED_LEGAL_KINDS`).
  Een nieuwe verplichte versie = nieuwe rij publiceren; niets wordt verwijderd.
- **Acceptatiebewijs:** nieuwe append-only tabel `legal_acceptances`
  (`lib/db/src/schema/legal-acceptances.ts`): `clerk_id`, `kind`, `version`,
  `accepted_at`, `source` (web/mobiel/pwa/onbekend), `revoked_at`.
  Ontbrekend bewijs of `revoked_at` gezet = **niet geaccepteerd** (fail-closed).
  Rijen worden nooit verwijderd; intrekken zet alleen `revoked_at`.
- **Status-engine:** `artifacts/api-server/src/lib/consent.ts` —
  `getConsentStatus(clerkId)` vergelijkt per document het nieuwste
  niet-ingetrokken akkoord met de actieve versie. Versies zijn 30 s gecachet
  (`invalidateConsentVersionCache()` voor tests/publicaties).
- **Gate:** `artifacts/api-server/src/middlewares/consentGate.ts`, gemount in
  `routes/index.ts` direct na de health-router, vóór alle functionele routers.
  Blokkeert álles behalve de allowlist met `403 { code: "consent_required",
  missing: [...] }`. Faalt de statuscontrole zelf, dan `503` (fail-closed).

## Allowlist (bereikbaar zonder akkoord)

`/api` + `/api/healthz` (liveness), `/api/auth/*` (in-/uitloggen, sync),
`/api/legal/*` (lezen, status, accepteren, intrekken), `/api/webhooks/*`
(machine-naar-machine), `/api/release/*` (versiecheck/foutmeldingen).

## Endpoints

- `GET /api/legal/status` — per document: `kind`, `title`, `requiredVersion`,
  `accepted`, `acceptedVersion`, `acceptedAt` + `complete`. Web, mobiel en PWA
  gebruiken allemaal déze server-side status.
- `GET /api/legal/:kind` — publiek leesbaar document (nodig vóór akkoord).
- `POST /api/legal/:kind/accept` — schrijft bewijsrij (idempotent per versie);
  bron komt uit het `X-Sparki-Platform`-header. Voor privacy/terms blijven de
  oude `privacy_settings`-velden gevuld (compatibiliteit); de gate leest
  uitsluitend `legal_acceptances`. Audit-event `consent_change`.
- `POST /api/legal/:kind/revoke` — zet `revoked_at`; poort sluit direct weer.

## Frontend

- **Web:** `artifacts/sparki/src/components/consent-gate.tsx`, gemount ín
  `AccountGate` (`App.tsx`) zodat élke ingelogde route erdoor gaat. Geen
  vooraf aangevinkte vakjes; elk document volledig leesbaar vóór akkoord;
  knop pas actief als alles is aangevinkt.
- **Mobiel:** `artifacts/sparki-mobile/components/ConsentGate.tsx`, gemount in
  `app/(app)/_layout.tsx`. Zelfde endpoints en gedrag.
- De UI is alleen de voorkant: de echte blokkade zit server-side.

## Dev-preview-uitzondering (bewust en gedocumenteerd)

Voor **echte Clerk-sessies** geldt de gate **altijd** — ook in dev; er is geen
productie-uitzondering. Alleen voor de **dev-auth-bypass-gebruiker** (geen
echte sessie; bestaat uitsluitend met `DEV_AUTH_BYPASS=true` buiten productie)
wordt de gate afgedwongen wanneer het test-header `x-consent-enforce: 1`
meegaat. Zonder die uitzondering zouden de dev-preview en alle bestaande tests
direct doodlopen op het acceptatiescherm. In productie bestaat de bypass niet,
dus dit pad is daar dood.

## Migratie

- `lib/db/migrations/0001_legal_acceptances.sql` — tabel + index, idempotent
  (`CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS`), puur additief.
- `lib/db/migrations/0002_legal_acceptances_active_unique.sql` — partiële
  unieke index `(clerk_id, kind, version) WHERE revoked_at IS NULL`; samen met
  `INSERT … ON CONFLICT DO NOTHING` maakt dit accepteren race-veilig
  idempotent (nooit meer dan één actieve bewijsrij per gebruiker+document+versie).

Beide toegepast op dev; voor productie dezelfde bestanden uitvoeren
(geen `drizzle push`).

## Tests

`pnpm --filter @workspace/api-server run test:consent-gate`
(`src/tests/consent-gate.ts`, vereist `DEV_AUTH_BYPASS=true` + `DATABASE_URL`):

1. blokkade zonder akkoord (403 `consent_required`, 3 ontbrekende documenten);
2. allowlist blijft bereikbaar zonder akkoord;
3. status toont drie niet-geaccepteerde documenten;
4. na acceptatie van alle documenten is de toegang open;
5. bewijsrijen bevatten versie + bron en zijn niet ingetrokken;
6. gelijktijdige (parallelle) accepts leveren precies één actieve bewijsrij;
7. akkoord van gebruiker A geldt niet voor gebruiker B;
8. nieuwe documentversie blokkeert opnieuw; heraccepteren opent weer;
9. intrekken sluit de poort; bewijsrij blijft bestaan met `revoked_at`;
10. dev-preview zonder enforce-header blijft werken.
