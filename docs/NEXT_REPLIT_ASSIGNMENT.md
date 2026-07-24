# NEXT REPLIT ASSIGNMENT — Entitlement-fundament (productvarianten zonder betalingen)

Eén kleine, complete, direct uitvoerbare opdracht. Volgt op `docs/SPARKI_NEXT_BUILD_SEQUENCE.md` stap 3. Stap 1 (publicatie flags-fix) is een publicatieactie zonder code en daarom niet als bouwopdracht opgenomen; deze opdracht is de eerstvolgende bóuwstap.

## Doel en gebruikersresultaat
Sparki krijgt één centrale plek waar per gebruiker vastligt welke productvariant (sparki_go / sparki_basic / sparki_performance / sparki_pro) actief is, en één centrale functie die bepaalt of een gebruiker recht heeft op een feature. Gebruikersresultaat: nog geen zichtbare verandering (bewust) — maar de admin kan per gebruiker de variant zien en zetten, en het systeem kan vanaf nu rechten per variant afdwingen zodra het Master Plan de inhoud per variant vastlegt.

## Huidige situatie
- Er bestaat GEEN abonnement-/variantmechanisme; alleen een ongebruikte `premium`-flag in `lib/feature-flags/src/index.ts`.
- Er bestaat WEL een volwassen rechtenfundament: feature-flags met resolutievolgorde override > rol > releasegroep > globaal + rollout (`lib/db/src/schema/feature-flags.ts`, `artifacts/api-server/src/lib/flags.ts`), releasegroepen op `user_profiles`, kill-switches, admin-flagbeheer.

## Bestaande onderdelen die behouden moeten blijven
- Het volledige feature-flag-systeem en zijn resolutievolgorde (uitbreiden, niet vervangen).
- `user_profiles`-schema en alle bestaande kolommen/data.
- Admin-schermen; alleen aanvullen.
- Alle bestaande tests blijven groen.

## Exacte scope
1. **Datamodel (uitbreidend, migratieveilig):** kolom `product_variant` op `user_profiles`, enum `["sparki_go","sparki_basic","sparki_performance","sparki_pro"]`, default `"sparki_go"`, NOT NULL via default (geen bestaande data geraakt). Tabel `variant_feature_grants` (variant, feature_key, enabled, PK (variant, feature_key)) — leeg opgeleverd; inhoud komt uit het Master Plan (NIET zelf invullen).
2. **Resolutielaag:** één functie `resolveEntitlements(user)` in api-server die het BESTAANDE `resolveFlags` hergebruikt en variant-grants als extra bron toevoegt in de bestaande precedentie (override blijft sterkste). Geen parallel systeem, geen tweede waarheid.
3. **API:** `GET /api/entitlements` (eigen variant + effectieve rechten); admin: `GET/PUT` variant per gebruiker binnen bestaand adminrouter-patroon (String(params), geen zod — bestaande conventies).
4. **Admin-UI:** variantveld tonen + zetten op de bestaande admin-gebruikersweergave (geen nieuw scherm).
5. **Frontend:** alleen het bestaande FeatureFlagContext laten meelezen van `/api/entitlements` is NIET nodig in deze stap; frontend blijft ongewijzigd behalve adminweergave.

## Buiten scope
- Betaalprovider, prijzen, aankopen, proefperioden, upgrades/downgrades-flows.
- Feature-inhoud per variant (wacht op Master Plan) — `variant_feature_grants` blijft leeg.
- Elke UI-wijziging voor eindgebruikers.
- Multisport.

## Betrokken bestanden en componenten
- `lib/db/src/schema/users.ts` (kolom), nieuw `lib/db/src/schema/entitlements.ts` (grants-tabel), daarna `pnpm --filter @workspace/db run push` + `run build`.
- `artifacts/api-server/src/lib/flags.ts` (hergebruik) + nieuw `artifacts/api-server/src/lib/entitlements.ts`.
- `artifacts/api-server/src/routes/` — entitlements-route + admin-uitbreiding.
- Admin-gebruikerspagina in `artifacts/sparki/src/pages/` (bestaand adminscherm).

## Datamodel- en API-wijzigingen
Uitsluitend uitbreidend (afbouwregel 6): één kolom met default, één nieuwe tabel, twee endpoints erbij. Geen bestaande endpoints gewijzigd.

## Rechten en privacy
- Variant zetten: alleen admin (`isAdmin()`); eigen variant lezen: alleen ingelogde eigenaar.
- Variantwijziging naar `security_audit_log` (bestaand append-only patroon).
- Fail-closed: onbekende variant of ontbrekende grant ⇒ geen recht.

## Fout- en lege toestanden
- Lege `variant_feature_grants` ⇒ gedrag exact als nu (flags-only) — expliciet getest.
- `/api/entitlements` zonder profiel ⇒ 403 volgens bestaand patroon, nooit een leeg-alles-aan antwoord.

## Tests
- Nieuw `test:entitlements` (api-server): default-variant, precedentie (override wint van variant-grant), fail-closed bij lege grants, admin-only zetten, auditlogrij.
- Bestaand groen blijven: `test:cross-account-isolation`, flags-gerelateerde tests, volledige typecheck (`pnpm run typecheck`) incl. `lib/db` build.

## Acceptatiecriteria
1. Kolom + tabel bestaan; bestaande rijen ongewijzigd met default `sparki_go`.
2. `GET /api/entitlements` geeft variant + effectieve rechten voor de eigen gebruiker.
3. Admin kan variant per gebruiker zien en zetten; wijziging staat in het auditlog.
4. Gedrag voor alle bestaande gebruikers is aantoonbaar identiek aan vóór de wijziging (lege grants).
5. `test:entitlements` groen; bestaande suite groen; app compileert en start.

## Regressiecontrole
`pnpm run typecheck`, api-server esbuild, bestaande rechten-/isolatietests, en één handmatige flow: inloggen → /you → routeplanner zichtbaar (flags ongebroken).

## Bewijs van oplevering
Testuitvoer (nieuw + bestaand), screenshot adminweergave met variantveld, curl-voorbeeld van `GET /api/entitlements`, DB-bewijs dat bestaande rijen ongewijzigd zijn (count + defaultwaarde).
