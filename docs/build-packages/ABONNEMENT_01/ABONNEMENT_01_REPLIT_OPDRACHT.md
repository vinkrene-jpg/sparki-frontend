# ABONNEMENT_01 — DE VOLLEDIGE ABONNEMENTSFLOW

**Uitvoerder:** Replit
**Type:** breed domeinpakket
**Startcommit:** actuele `main`; bevestig de SHA in je eindrapport
**Status:** voorbereid werk. **Start pas na expliciete vrijgave door René.**
**Botst niet met:** `ROUTE_PAKKET_02a`/`02b` — die raken de tellinglogica, dit pakket raakt billing en entitlements. Wél overlap op `resolveEntitlements`: zie afhankelijkheden.

## Doel

De volledige abonnementsflow voor Gratis, Go en Compleet is betrouwbaar en begrijpelijk, van proefperiode tot opzegging, inclusief alles wat er misgaat onderweg.

## Scope

Proefperiode · aanmelden · upgraden · downgraden · pauzeren · hervatten · opzeggen · verlopen betaalpoging · `incomplete` · mislukte betaling · `paused` · `cancelled` · terugbetaling · rechtenherstel · Stripe-webhooks · server-side entitlements · gebruikersmeldingen · accountstatus op web en mobiel.

## Buiten scope

Livegang van Stripe (apart besluit van René) · prijswijzigingen · nieuwe abonnementsvormen · coach-, club- en teamabonnementen · btw en facturatie · de routegebruikstelling uit `02a`/`02b`.

---

## 0. Bestaande bouwstenen — hergebruiken, niet opnieuw bouwen

| Bestaand | Vindplaats | Draagt al |
|---|---|---|
| `billing_subscriptions` | `lib/db/src/schema/billing.ts` L39–78 | klant, abonnement, status, prijs-ID, periode-einde, grace |
| `stripe_webhook_events` | idem L87–98 | eventId als primaire sleutel + payload-digest |
| `billing_test_accounts` | idem L120–132 | allowlist voor testmodus |
| `tier_feature_grants` | idem L102–113 | rechten per tier |
| `user_entitlements` + proefperiodes | `lib/entitlements.ts` L49–81 | persoonlijke rechten en trials |
| Checkout · Portal · Trial | `routes/billing.ts` L105–137 · L140–171 · L73–102 | de drie ingangen |
| Webhook-endpoint met rawBody | `routes/webhooks.ts` L140–178 | ontvangst |
| Handtekeningcontrole | `lib/billing/stripe-gateway.ts` L320–327 | `STRIPE_WEBHOOK_SECRET` |
| Statusvertaling | `lib/billing/webhook-processor.ts` L44–65 | `active` · `grace` · `canceled` · `expired` · `blocked` |
| Idempotentie | webhook-processor L324–332 | transactie + `onConflictDoNothing` |
| Live-sleutelblokkade | stripe-gateway L81 | alleen `sk_test_` / `rk_test_` |
| Proefduur Go 7 / Compleet 14 dagen | stripe-gateway L10–21 (`TIER_PRICING`) | — |
| Rechtenresolver | `lib/entitlements.ts` L107 · L347 · L407 | `resolveEntitlements`, `requireCommercialFeature`, `resolveFeatureAccess` |
| Tests | `test:entitlements`, `test:stripe-billing` | vertrekpunt, niet vervangen |

**Er komt geen tweede billinglaag.** Elke uitbreiding is additief op deze structuur.

---

## 1. Exacte herstelpunten

### 1.1 Twee Stripe-statussen worden vandaag genegeerd

`incomplete` en `paused` worden niet afgehandeld. `past_due` en `unpaid` op het abonnementsobject zelf worden niet direct verwerkt — grace ontstaat pas via `invoice.payment_failed`.

Bouw:
- `incomplete` → geen rechten, met een begrijpelijke melding dat de betaling nog niet rond is;
- `paused` → rechten bevroren, gegevens behouden, hervatten mogelijk;
- `past_due` en `unpaid` op het abonnementsobject → dezelfde graceroute als `invoice.payment_failed`, of expliciet gelogd-als-genegeerd met motivatie.

Onbekende toekomstige statussen: **fail-closed** — geen rechten, en loggen.

### 1.2 `degraded` neemt vandaag geen rechten weg

Bij een leesfout op `user_entitlements` wordt `degraded = true` gezet (`entitlements.ts` L140–150), maar `hasCommercialFeature` negeert dat (L333–339). Een storing kan dus geen rechten toevoegen, maar neemt bestaande variantrechten ook niet weg.

Leg vast en bouw wat er hoort te gebeuren: bij `degraded` blijven bestaande rechten staan óf vallen ze dicht. Kies één gedrag, documenteer het, en dek het af met een test. **Dit is geen productbesluit maar een veiligheidskeuze; motiveer hem en meld hem.**

### 1.3 Downgrade van routes

Vastgesteld besluit: **alle routes blijven zichtbaar en alleen-lezen totdat de gebruiker drie actieve routes kiest.** Niets wordt stilzwijgend verwijderd.

Bouw de keuzeflow: bij downgrade ziet de gebruiker al zijn routes, kiest er drie als actief, en de rest blijft alleen-lezen en herstelbaar. Geen automatische selectie, geen verval zonder keuze.

> Dit raakt `ROUTE_PAKKET_02c`. Bouw hier **alleen de keuzeflow en de alleen-lezen toestand**; de opslaglimiet, de vervaltermijn en de opruimtaak horen in `02c`. Stem de tabelnamen af met wat `02c` oplevert — of, wanneer dit pakket eerder loopt, lever de structuur zo dat `02c` erop kan bouwen en meld dat expliciet.

### 1.4 Geen `legacy_unrestricted` voor echte gebruikers

Stel vast welke echte accounts vandaag op `legacy_unrestricted` staan. Lever een migratieplan met per account: huidige modus, voorgestelde modus, en de gevolgen voor zijn rechten. **Voer niets uit zonder dry-run en zonder akkoord van René** — dit kan mensen rechten afnemen die ze vandaag hebben.

### 1.5 Webhooks die niet netjes aankomen

- dubbele gebeurtenis: geen tweede effect;
- vertraagde gebeurtenis, out of order: de eindtoestand klopt;
- mislukte verwerking: rollback, en de gebeurtenis blijft herleverbaar;
- gebeurtenis voor een onbekende gebruiker: loggen en niets raden.

De idempotentie bestaat al; **bewijs** hem opnieuw voor de nieuwe statussen.

### 1.6 Terugbetaling en rechtenherstel

Volledige terugbetaling → `blocked`. Gedeeltelijke terugbetaling → gedefinieerd gedrag, geen stilzwijgend behoud. Herstel na een blokkade geeft de rechten terug zonder handmatig ingrijpen in de database.

### 1.7 Proefperiode-einde

Bij afloop vervalt de begeleiding, **niet de data**. Geen enkele persoonlijke waarde die de gebruiker zelf heeft ingevoerd of gesynchroniseerd verdwijnt. Vóór afloop een rustige melding.

### 1.8 Meldingen

Bij elke overgang een eerlijke, begrijpelijke melding: wat is er gebeurd, wat kun je nu wel en niet, en wat kun je doen.

**Geen misleidende urgentie, geen aftelklok, geen vooraf aangevinkte aankoop.** Geen tekst die suggereert dat gegevens verloren gaan wanneer dat niet zo is.

### 1.9 Admininzicht

Per gebruiker: huidige pakketstatus, bron van die status, laatste ontvangen webhook met tijdstip en resultaat, en openstaande of mislukte gebeurtenissen. Geen betaalgegevens die daar niet horen.

### 1.10 API en UI geven dezelfde rechten

Elke betaalde functie is server-side gepoort. Een directe aanroep buiten de interface om krijgt exact dezelfde weigering. Bewijs dat per gepoorte functie, niet steekproefsgewijs.

---

## Migratierisico's

| Risico | Beheersing |
|---|---|
| Migratie van `legacy_unrestricted` neemt echte gebruikers rechten af | dry-run, per account gevolgen tonen, akkoord van René vóór uitvoering |
| Nieuwe statusafhandeling verandert bestaande rechten met terugwerkende kracht | statusvertaling alleen vooruit toepassen; bestaande rijen niet herrekenen |
| `degraded`-keuze sluit rechten dicht bij een storing | bewuste keuze, gemotiveerd, met test |
| Downgradeflow raakt `02c`-structuren | alleen keuzeflow en alleen-lezen bouwen; tabelafstemming melden |

## Tests

1. Proefperiode start, loopt af, en de data blijft.
2. Aanmelden op Go geeft precies de Go-rechten, niet meer.
3. Upgrade naar Compleet geeft de superset direct.
4. Downgrade naar Gratis: alle routes blijven zichtbaar en alleen-lezen tot er drie zijn gekozen.
5. Downgrade verwijdert niets.
6. `incomplete` geeft geen rechten.
7. `paused` bevriest rechten en behoudt gegevens.
8. Hervatten na `paused` herstelt de rechten.
9. Mislukte betaling geeft grace van 7 dagen, daarna verval.
10. `past_due` en `unpaid` leiden tot hetzelfde gedrag als `invoice.payment_failed`, of zijn expliciet genegeerd met log.
11. Opzegging behoudt toegang tot het einde van de betaalde periode.
12. Volledige terugbetaling → `blocked`.
13. Herstel na blokkade geeft rechten terug zonder databasehandwerk.
14. Dubbele webhook heeft geen tweede effect.
15. Out-of-order webhooks leiden tot de juiste eindtoestand.
16. Mislukte verwerking rolt terug en blijft herleverbaar.
17. Webhook voor onbekende gebruiker wordt gelogd, niet geraden.
18. Onbekende status → geen rechten.
19. `degraded` gedraagt zich zoals gekozen en gedocumenteerd.
20. Geen echt account staat na migratie nog op `legacy_unrestricted`.
21. Elke gepoorte functie weigert identiek via directe API-aanroep en via de interface.
22. Meldingen bevatten geen aftelklok, geen vooraf aangevinkte aankoop en geen onjuiste dataverliesclaim.
23. Admininzicht toont de juiste status en de laatste webhook.
24. Web en mobiel tonen dezelfde accountstatus.

## Acceptatiecriteria

1. Alle Stripe-statussen leiden tot een gedefinieerde pakketstatus; onbekende statussen vallen dicht.
2. Idempotentie en volgordevastheid bewezen voor de nieuwe statussen.
3. Downgrade laat alles zichtbaar en alleen-lezen tot de gebruiker kiest; er verdwijnt niets.
4. Geen betaalde functie bereikbaar via UI-manipulatie of directe aanroep.
5. Geen echt account op `legacy_unrestricted`, of een goedgekeurd migratieplan met dry-run.
6. Meldingen zijn eerlijk en zonder misleidende urgentie.
7. Proefperiode-einde raakt geen gebruikersdata.
8. Admininzicht klopt met de database.
9. `test:entitlements` en `test:stripe-billing` groen, uitgebreid met de nieuwe gevallen.
10. Typecheck exit 0. Geen wijziging buiten billing, entitlements en de bijbehorende meldingen.

## Bewijsformat

Per regel: commando, resultaat, exitcode. Verder: de statusvertaaltabel Stripe → Sparki · de `degraded`-keuze met motivatie · de dry-run van de `legacy_unrestricted`-migratie met gevolgen per account · per gepoorte functie het API-antwoord naast het interfacegedrag · de meldingsteksten bij elke overgang · schermafbeeldingen web en mobiel · start- en eindcommit · gewijzigde bestanden.

## Stopcondities

- de migratie van `legacy_unrestricted` zou echte gebruikers rechten afnemen zonder akkoord;
- de downgradeflow vereist tabellen die pas in `02c` ontstaan en er is geen additieve tussenvorm;
- een Stripe-status is niet betrouwbaar te vertalen zonder een productbesluit;
- een noodzakelijke wijziging vereist herschrijving van de entitlementresolver.

## Afhankelijkheden

| Nodig | Bron | Blokkerend? |
|---|---|---|
| `resolveEntitlements` en `requireCommercialFeature` ongewijzigd werkend | `ROUTE_PAKKET_01`, MIRROR_PROVEN | ja |
| Drie niet-legacy testidentiteiten | `ROUTE_PAKKET_01` | ja |
| Stripe-sandbox ingericht | bestaand | ja |
| Routegebruikstelling | `02a` | **nee** — dit pakket raakt de telling niet |
| Opslaglimiet en vervaltermijn | `02c` | **nee** — alleen de keuzeflow hier |

## Herstelprotocol

Bij afkeuring: alleen de benoemde blokkade herstellen, op een nieuwe commit vanaf de afgekeurde commit. Geen refactor, geen scope-uitbreiding. Oorzaak onbekend: melden, niet gokken. Vereist de fix een productbesluit: stoppen en voorleggen.

Hertesten: het afgekeurde scenario, alles wat dezelfde code raakt, plus `test:entitlements`, `test:stripe-billing` en typecheck. Geen volledige regressie.

**Uitzonderingslijst — hier blijft een fout niet lokaal:** `resolveEntitlements` · `requireCommercialFeature` · de webhook-processor en zijn idempotentiesleutel · de statusvertaaltabel. Raakt de fix een van deze vier, dan wordt het hele pakket hertoetst.

Na twee herstelronden op dezelfde blokkade: naar René.

## Documentatie

`docs/SPARKI_ABONNEMENTSFLOW.md` — statusvertaling, meldingen per overgang, en het `degraded`-gedrag.
