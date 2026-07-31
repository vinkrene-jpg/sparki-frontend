# Replit-bouwopdrachten — pakketstructuur Gratis / Go / Compleet

**Datum:** 31 juli 2026
**Basis:** `SPARKI-BESLUIT-2026-001` (K-1, Besluit René 31-07-2026)
**Repository-stand bij het schrijven:** HEAD `69ac985`. Alle bestands- en regelverwijzingen hieronder zijn op die commit zelf gecontroleerd.

Twee opdrachten. Opdracht 1 kan direct weg. Opdracht 2 wacht op één bevestiging van René (zie bovenaan die opdracht).

---

## Wat er vandaag werkelijk staat

Kort, zodat de opdracht niet op aannames rust:

- `artifacts/api-server/src/lib/entitlements.ts` regel 284–289: `GO_FEATURE_KEYS` bevat vier sleutels — `autonomous_training`, `race_intel`, `ai_observations`, `performance_lab`.
- Regel 307: `GO_INHERITING_VARIANTS = ["sparki_go", "sparki_pro"]`. Beide varianten krijgen via `ensureVariantGrants` **dezelfde** vier rechten. Dat is de reden dat Compleet vandaag technisch gelijk is aan Go.
- Regel 277–283, commentaarblok: staat er nu als *"Productbesluit (René): deze vier onderdelen zijn Sparki Go-only. Alles wat hier NIET staat blijft gratis (routeplanner, navigatie, materiaalcoach, kennisbank, …)."* Dat is het oude, inmiddels ingetrokken besluit en moet mee gewijzigd worden.
- `artifacts/api-server/src/routes/routes.ts`: geen enkele route-endpoint heeft een commerciële poort. Alleen `requireAuth`.
- `requireCommercialFeature(...)` wordt vandaag toegepast in onder andere `routes/ai.ts` (r46, r220, r291, r665), `routes/insights.ts` (r21, r37) en `routes/races.ts` (r153, r362, r485).
- `artifacts/api-server/src/tests/entitlements.ts` regel 457 en 464 leggen de **oude** indeling vast als test: Go móét de vier sleutels hebben, en `route_planner` mág geen variantrecht zijn. Deze testregels zijn geen defect — ze zijn het oude besluit in code. Ze worden bewust omgezet, niet "gerepareerd".

---

# OPDRACHT 1 — Rechten van Go en Compleet uit elkaar halen

**Doel:** Sparki Compleet krijgt eigen rechten die Sparki Go niet heeft. Go en Compleet zijn daarna technisch niet langer identiek.

**Gedragsimpact voor bestaande gebruikers: geen.** Alle echte accounts staan in `legacy_unrestricted`, en `hasCommercialFeature` geeft daar altijd `true`. Deze opdracht verandert de structuur, niet wat iemand vandaag ziet.

## Te bouwen resultaat

1. In `artifacts/api-server/src/lib/entitlements.ts`:
   - Voeg `COMPLEET_FEATURE_KEYS` toe met de vier bestaande sleutels: `autonomous_training`, `race_intel`, `ai_observations`, `performance_lab`.
   - Laat `GO_FEATURE_KEYS` bestaan als eigen, voorlopig lege verzameling voor de Go-onderdelen. Die wordt in opdracht 2 gevuld.
   - Vervang `GO_INHERITING_VARIANTS` door een expliciete toewijzing per variant: `sparki_go` krijgt de Go-sleutels; `sparki_pro` (klantlabel: Sparki Compleet) krijgt de Go-sleutels **plus** de Compleet-sleutels. Compleet blijft daarmee aantoonbaar een superset van Go.
   - `sparki_basic` en `sparki_performance` blijven zonder rechten (fail-closed), ongewijzigd.
   - Werk het commentaarblok op regel 277–283 bij naar het geldende besluit, met bronvermelding: `Besluit René 31-07-2026 (SPARKI-BESLUIT-2026-001)`.

2. Pas `ensureVariantGrants` aan zodat hij per variant de juiste sleutelverzameling wegschrijft in `variant_feature_grants`.

3. Migratie: verwijder de bestaande rijen in `variant_feature_grants` die de vier sleutels aan `sparki_go` toekennen. Laat de rijen voor `sparki_pro` staan. Log hoeveel rijen zijn verwijderd.

4. Pas de bestaande tests aan, met een commentaarregel waarom:
   - `artifacts/api-server/src/tests/entitlements.ts` r457: Go mag de vier sleutels **niet** meer hebben; Compleet wél.
   - `artifacts/api-server/src/tests/governor-role-foundation.ts` r159–164: controleer of de telling nog klopt met de nieuwe verdeling.

5. Voeg één nieuwe test toe die aantoont dat Compleet elke Go-sleutel bezit (superset-invariant), zodat een toekomstige wijziging die dat breekt hard faalt.

## Grenzen

- Geen wijziging aan de UI.
- Geen wijziging aan `hasCommercialFeature` of `requireCommercialFeature` zelf.
- Geen nieuwe sleutels toevoegen — dat is opdracht 2.
- Geen Stripe-wijziging.
- Geen enkele bestaande controle verlagen of uitschakelen.

## Acceptatiecriteria

- `test:entitlements` groen (was 19/19; melden wat het nu is en waarom het aantal veranderde).
- Billingtests groen (was 14/14).
- Typecheck groen.
- Bewijs met een testaccount per variant: een Go-account heeft geen recht op `autonomous_training`, een Compleet-account wel, een `legacy_unrestricted`-account is onveranderd.
- Aantal verwijderde migratierijen gerapporteerd.

## Op te leveren

Gewijzigde bestanden, commit-SHA, per test het commando en de exitcode. Eén regel per test: groen of rood. Geen verslag.

---

# OPDRACHT 2 — Go-poort op route- en navigatiefuncties

**Nog niet uitvoeren.** Deze opdracht vraagt eerst één bevestiging van René, omdat besluit K-1 wel zegt dat Gratis "een bruikbare basis" houdt maar niet waar die grens ligt.

## Voorstel voor de grens (ter bevestiging of correctie)

**Blijft gratis**
- Een gereden rit terugzien
- Een route volgen die iemand met je deelt
- Opgeslagen routes bekijken
- Klimmen

**Wordt Sparki Go**
- Zelf een route plannen of laten genereren
- Routes opslaan in de eigen routebibliotheek
- GPX- en TCX-uitvoer
- Gesproken navigatie
- Routehervatting en veilige herplanning
- Ritanalyse met uitleg

Zodra René deze twee lijsten bevestigt of aanpast, is de opdracht compleet en kan hij weg.

## Te bouwen resultaat na bevestiging

1. Vul `GO_FEATURE_KEYS` met de sleutels die uit de bevestigde lijst volgen.
2. Plaats `requireCommercialFeature(...)` op de bijbehorende endpoints in `artifacts/api-server/src/routes/routes.ts`. De endpoints staan er al; ze hebben vandaag alleen `requireAuth`.
3. Laat de gratis basis expliciet ongepoort. Noem in de oplevering per endpoint of hij gepoort is of bewust niet, zodat er geen stilzwijgende gaten ontstaan.
4. Zet de testassertie in `tests/entitlements.ts` r464 om: `route_planner` wordt nu juist wél een variantrecht. Met commentaarregel en verwijzing naar het besluit.
5. Frontend: een Gratis-gebruiker die een Go-functie opent krijgt een rustige, contextuele verwijzing — geen slotjes of grijze kaarten. Server-side rechten blijven leidend; de frontend is nooit de poort.

## Grens die bewaakt moet blijven

Veiligheids- en gezondheidskritieke informatie valt nooit onder een commerciële poort. Dat geldt onverkort voor de blokkadeverificatie op routes: een route met een harde blokkade mag ook aan een Gratis-gebruiker nooit worden geleverd, en die controle mag door deze wijziging op geen enkele manier worden geraakt.

## Acceptatiecriteria

- Alle bestaande routetests groen, inclusief de blokkade-regressiepoort.
- Bewijs per endpoint: Gratis geweigerd, Go toegelaten, Compleet toegelaten, legacy onveranderd.
- Klikbewijs op één vaste SHA, per rol en per variant, mobiel en desktop.

---

## Volgorde en waarom

Opdracht 1 kan vandaag weg en heeft geen gebruikersimpact. Opdracht 2 verandert wél wat mensen kunnen, en hoort daarom pas na de bevestigde grens.

Beide opdrachten samen sluiten besluit **C-1** uit het releasedossier en heffen kritieke releaseblokkade **A7** op.
