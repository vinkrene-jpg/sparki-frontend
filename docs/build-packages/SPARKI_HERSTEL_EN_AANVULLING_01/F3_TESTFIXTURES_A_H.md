# F3 — Testfixtures A t/m H (HA-10…HA-15)

Eén gedocumenteerde set accountstanden voor Mirror-toetsen. De set draait op
het bestaande fixture-mechanisme (`src/scripts/governor-role-fixtures.ts`,
Beslisblok 02) — er is bewust géén tweede mechanisme gebouwd.

## Bediening

```
pnpm --filter @workspace/api-server exec tsx src/scripts/governor-role-fixtures.ts create
pnpm --filter @workspace/api-server exec tsx src/scripts/governor-role-fixtures.ts verify
pnpm --filter @workspace/api-server exec tsx src/scripts/governor-role-fixtures.ts remove
```

Wisselen tussen standen gebeurt **zonder inloggegevens** via de bestaande
dev-previewwissel (`x-dev-clerk-id`, alleen met `NODE_ENV!=production` én
`DEV_AUTH_BYPASS=true` — fail-closed). ClerkId = `governor-fixture-<sleutel>`.

## De acht standen (HA-11)

| Stand | Sleutel | Inhoud |
|---|---|---|
| A | `stand-a-gratis` | vers Gratis-account: subscription zonder enig recht, nooit gekoppeld, geen activiteit. `resetVerseStanden()` maakt A/B/C bij **elke** create-run aantoonbaar leeg. |
| B | `stand-b-go` | vers Go-account (tier:GO-trial, bron "test"), idem leeg. |
| C | `stand-c-compleet` | vers Compleet-account (tier:COMPLETE-trial), idem leeg. |
| D | `stand-d-provider` | echte geïmporteerde providerdata: Strava-connectie `connected` + twee activiteiten door de echte tabellen (`connector_connections` → `connector_activities` → `training_sessions`, source "strava"). |
| E | `stand-e-provider-fout` | falende providerkoppeling: Strava-connectie status `error`, `token_expired`, niets geïmporteerd. |
| F | `trainer-1` + `trainer-2` | trainer met één gekoppelde sporter (trainer-1 → volwassen sporter + Team A) en één bewust niet-gekoppelde trainer (trainer-2: clublid zónder toewijzing of coach-link). |
| G | `parent` (+ `parent-solo`) | ouder met gekoppeld jeugdlid (bevestigde link met jeugdsporter, u16-consent); `parent-solo` is het één-kind-scenario. |
| H | `clubbeheerder` | club "TESTFIXTURE Governor Club" met **twee** teams (Team A selectie wedstrijd, Team B selectie jeugd) en clubabonnement. |

HA-12: `voedingsdeskundige` (accountrol `nutrition_specialist`) en
`medical-staff` (clubrol `medical_staff`) zitten in dezelfde set.

## Harde eisen (HA-13)

- Uitsluitend dev/preview: `assertNotProduction()` weigert bij
  `NODE_ENV=production` of `REPLIT_DEPLOYMENT` (fail-closed, ook programmatic).
- Nooit bereikbaar vanuit een normaal account: de standen bestaan alleen als
  synthetische accounts; wisselen kan uitsluitend via de dev-bypass.
- Geen fictieve personen als echte persoon: alle namen dragen het voorvoegsel
  "TESTFIXTURE", e-mail eindigt op `@governor-fixtures.invalid`,
  releasegroep "test". De schil toont in elke niet-productieomgeving de
  permanente markering Testomgeving (F2/HA-07).
- Idempotent en volledig verwijderbaar (`remove` wist alleen rijen met de
  strikte fixture-handtekening: prefix ÉN e-maildomein ÉN releasegroep).

## Testresidu (HA-14)

Op 02-08-2026 verwijderd uit de gedeelde ontwikkeldatabase: routes 379–390
(`MirrorToets save1/save2`, `Bulk-mirror-0..9`), na controle dat geen enkele
FK-tabel (races, route_shares, route_proposals, volgauto_plans, …) ernaar
verwees. `DELETE 12`, restcontrole `0`. Toetsresten horen voortaan in
fixtures met vaste, herkenbare sleutels die bij elke create-run gereset worden
— nooit als losse rijen in de gedeelde database.
