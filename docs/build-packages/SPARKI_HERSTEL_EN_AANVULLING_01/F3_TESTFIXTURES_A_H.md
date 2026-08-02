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

In omgevingen zonder `tsx` draai je hetzelfde script via de bestaande
build-shell:

```
bash scripts/governor/create-role-test-fixtures.sh
bash scripts/governor/remove-role-test-fixtures.sh
```

Wisselen tussen standen gebeurt **zonder inloggegevens** via de bestaande
dev-previewwissel (`x-dev-clerk-id`, alleen met `NODE_ENV!=production` én
`DEV_AUTH_BYPASS=true` — fail-closed). ClerkId = `governor-fixture-<sleutel>`.

## De acht standen (HA-11)

| Stand | Sleutel | Inhoud |
|---|---|---|
| A | `stand-a-gratis` | vers Gratis-account: subscription zonder enig recht — GEEN `legacy_unrestricted`, lege `product_variant`, lege `commercial_tier`, geen trial. Daardoor is `isGratisBeperkt` (`lib/route-limits.ts`) op dit account WAAR en zijn de gratis limieten (8/maand, 3 bewaard, 30 dagen — F5) toetsbaar. Nooit gekoppeld, geen activiteit. `resetVerseStanden()` maakt A/B/C bij **elke** create-run aantoonbaar leeg (óók routes en het routegebruik-register). |
| B | `stand-b-go` | vers Go-account: `commercial_tier = GO` (authoritatief in de resolver/labels) plus een Sparki-beheerde `tier:GO`-trial (bron "test") voor de feature-projectie. `product_variant` blijft leeg. Idem leeg qua koppelingen/activiteit. |
| C | `stand-c-compleet` | vers Compleet-account: `commercial_tier = COMPLETE` plus `tier:COMPLETE`-trial. `product_variant` leeg. Idem leeg. |

Sleutel-mapping naar de A–H-tabel (HA-11): `stand-a-gratis` → A, `stand-b-go`
→ B, `stand-c-compleet` → C. Deze sleutels zijn ondubbelzinnig accountstanden
en botsen niet met eventuele oudere generieke "standen A–E" elders.

De **seed-preview-persona's** `seed_persona_gratis/go/pro`
(`src/scripts/seed-preview-athletes.ts`) blijven een aparte dev-preview-set met
een eigen namespace (`seed_persona_*`); ze zijn géén derde variant naast deze
fixtures. Gecontroleerd: `seed_persona_gratis` is `subscription`,
`product_variant = null`, `commercial_tier = FREE` ⇒ `isGratisBeperkt = true`
(geen `legacy_unrestricted`) — dat klopt en is niet gewijzigd.
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

## Bewijs (dev, poort 8080)

**Verse stand aantoonbaar leeg** (na `create`): `routes`, `route_usage_registrations`,
`training_sessions`, `connector_connections`, `club_members`, `coach_athlete_links`
en `parent_athlete_links` voor A/B/C = **0** rijen.

**Entitlements per laag** (`GET /api/entitlements`, header `x-dev-clerk-id`):
- A `governor-fixture-stand-a-gratis` → `entitlement_mode: subscription`,
  `product_label: "Gratis"`, `active_entitlements: []`, `commercial_features: {}`.
- B `governor-fixture-stand-b-go` → `product_label: "Sparki Go"`, actieve
  `tier:GO`-trial. (Vergt de nieuwe api-build; `commercial_tier = GO` in
  `user_profiles`.)
- C `governor-fixture-stand-c-compleet` → `product_label: "Sparki Compleet"`,
  actieve `tier:COMPLETE`-trial (`commercial_tier = COMPLETE`).

**Echt geraakt gratis-limiet-bewijs (F5, bewaarlimiet) op stand A**, via
`POST /api/routes` (GPX-tak, roept `checkOpslag` aan):

```
Save 1 → HTTP 201   (1/3 bewaard)
Save 2 → HTTP 201   (2/3 bewaard)
Save 3 → HTTP 201   (3/3 bewaard)
Save 4 → HTTP 409   {"code":"bewaarlimiet","limiet":3,"upgrade":true,
                      "error":"Je hebt al 3 routes bewaard — het maximum in de
                      gratis versie. Vervang een bestaande bewaarde route, of
                      upgrade naar Sparki Go voor onbeperkt bewaren."}
```

Daarna `create` opnieuw ⇒ `routes` voor A weer `0` (reset bewezen; geen
toetsresten in de gedeelde database).

**Fail-closed**: dezelfde `create` met `NODE_ENV=production` ⇒
`GEWEIGERD: rol-testfixtures zijn alleen voor development/test/staging.`
