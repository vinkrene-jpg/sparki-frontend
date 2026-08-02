# Testfixtures — accountstanden A t/m H (Mirror-toetsset)

Stand: 2 augustus 2026. Antwoord op de Mirror-aanvraag "acht accountstanden A–H".

## 1. Het testcontext-mechanisme (bestond al)

- **Waar:** DEV-preview van de webapp. Onderin/bovenin staat permanent de banner
  `TESTCONTEXT · DEV PREVIEW @ <sha> · <naam> · rol <rol>`
  (`artifacts/sparki/src/components/sparki/dev-preview.tsx`).
- **Wisselen:** via de switcher in het DevPanel (haalt de lijst op uit
  `GET /api/dev/preview-athletes`). De keuze wordt in `localStorage`
  (`sparki_dev_athlete_id`) gezet; elke API-call stuurt dan de header
  `x-dev-clerk-id` mee.
- **DEV-only, fail-closed:** de server accepteert die header uitsluitend als
  `NODE_ENV !== "production"` ÉN `REPLIT_DEPLOYMENT` niet gezet ÉN
  `DEV_AUTH_BYPASS === "true"` (`artifacts/api-server/src/lib/auth.ts`).
  In productie bestaat het pad dus niet — een normaal account kan een
  fixture nooit bereiken.
- **Fixtures aanmaken/verwijderen:** `bash scripts/governor/create-role-test-fixtures.sh`
  / `remove-…`. Het script weigert hard in productie, is idempotent en wist bij
  verwijderen uitsluitend rijen met prefix `governor-fixture-` + e-maildomein
  `@governor-fixtures.invalid` + releasegroep `test`.
- **Geen fictieve echte personen:** alle namen beginnen met `TESTFIXTURE`.

## 2. De acht standen A t/m H

| Stand | Fixture (clerkId-prefix `governor-fixture-`) | Inhoud |
|---|---|---|
| A | `stand-a-gratis` | Gratis, vers: subscription-modus zonder enig recht (fail-closed), geen club, geen links, geen activiteit |
| B | `stand-b-go` | Go, vers (tier:GO-trial, bron "test"), verder identiek leeg |
| C | `stand-c-compleet` | Compleet, vers (tier:COMPLETE-trial), verder identiek leeg |
| D | `stand-d-provider` | Werkende Strava-koppeling (`connector_connections` status `connected`, importedDataTypes `activities`) met twee via de echte providertabellen geïmporteerde ritten (`connector_activities` → `training_sessions`, source `strava`, titels beginnen met TESTFIXTURE) |
| E | `stand-e-provider-fout` | Falende providerkoppeling: `connector_connections` status `error`, errorStatus `token_expired (TESTFIXTURE — bewust falende koppeling)`, geen import |
| F | `trainer-1` (gekoppeld: `athlete-adult`; niet gekoppeld: `outsider` en `trainer-2` als scope-loze trainer) | Trainer met één gekoppelde en één niet-gekoppelde sporter — bestond al als controlegeval |
| G | `parent` ↔ `athlete-jeugd` (+ `athlete-jeugd-b`; `parent-solo` = één-kind-variant) | Ouder met gekoppeld jeugdlid — bestond al |
| H | TESTFIXTURE Governor Club met Team A (wedstrijd) en Team B (jeugd) | Club met twee teams — bestond al |

Aanvullend (zelfde klus, eerder gemeld ontbrekend):

| Rol | Fixture |
|---|---|
| Voedingsdeskundige | `voedingsdeskundige` — echte server-side rol `nutrition_specialist` |
| Medische staf | `medical-staff` — clubrol `medical_staff` in de fixture-club |

Alle standen staan in de preview-switcher onder de groep "Rollen (testfixtures)".

## 3. Waarom dit de toetsregel "geen testdata lekt" niet overtreedt

- Fixtures bestaan alleen in de dev-database; het create-script weigert bij
  `NODE_ENV=production` of `REPLIT_DEPLOYMENT` (fail-closed exit 1).
- Bereikbaar uitsluitend via de dev-header, die in productie dood is.
- Alle rijen dragen de fixture-handtekening (prefix + invalid-domein +
  releasegroep `test`) en zijn met één commando restloos te verwijderen.
- De verwijderroutine eist alle drie kenmerken tegelijk — een naamsbotsing met
  echte data kan dus nooit iets wissen.

## 4. Toetsdocument ROUTE_PAKKET_02a

Er bestaat GEEN `MIRROR_TOETS`-document voor 02a in de repo (wel voor 02b:
`docs/build-packages/ROUTE_PAKKET_02b/MIRROR_TOETS_ROUTE_PAKKET_02b.md`).
`DATA_TRUST_01_MIRROR_TOETS.md` hoort bij DATA_TRUST_01, niet bij 02a.
Zolang Claude geen eigen 02a-toetsdocument heeft opgesteld, geldt voor 02a het
bewijsmateriaal in `sanity-checks/` van dat pakket als toetsbasis.
