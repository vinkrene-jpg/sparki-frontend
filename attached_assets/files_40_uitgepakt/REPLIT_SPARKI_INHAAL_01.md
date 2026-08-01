# REPLIT-OPDRACHT — INHAALSLAG BOUWPAKKETTEN

Technische code: `SPARKI_INHAAL_01`
Datum: 1 augustus 2026

Aanleiding: uit de afstemming van vanavond blijkt dat een deel van het ontwerpwerk je nooit heeft bereikt, en dat `SPARKI_BUILD_02`, `03` en `04` als alleen-document op main staan. Deze opdracht haalt dat in.

---

## 0. Wat je wel en niet krijgt

**Wél nodig om te bouwen:**
1. `SPARKI_BUILD_01` t/m `04` — staan al in `docs/build-packages/`
2. `SPARKI_BESLUITEN_PATCH_2026-08-01.md` — de besluiten van 1 augustus, **bindend en gaat vóór de pakketten bij tegenspraak**
3. `SPARKI_DOCUMENT_LIBRARY_01` — 41 sjablonen, wordt door René aangeleverd, hoort in `docs/document-library/`

**Niet nodig:** de vijf volledigheidsonderzoeken die je niet hebt ontvangen (club/team, wedstrijddag, ouder/jeugd, zelfstandige trainer, werkobjecten). Dat is analyse; alle conclusies en besluiten daaruit staan in de patch. Vraag er niet om.

---

## 1. Eerst afmaken: pakket 01

F1 t/m F4 staan op main, F5 loopt. Maak de reeks af, met deze correcties uit de patch:

**Restpunt BB-08.** Er is een `rol-start`-pagina, maar `engines/today/roles.ts` regel 110 geeft nog `available[0] ?? "atleet"` en kent alleen atleet, trainer, ouder, clubbeheer en hoofdtrainer. Ploegleider, teammanager, mechanieker, soigneur, medical_staff, assistent, vrijwilliger, alleen_lezen en nutrition_specialist landen bij inloggen dus nog steeds op de atleetweergave. De schermen bestaan, de routering ernaartoe niet. **Dat is de laatste stap van BB-08.**

**Uit de patch, hoofdstuk B:**
- toestemming mag worden gezet door de gekoppelde ouder óf door de club namens een geregistreerde ouder
- gelaagde leeftijdsgrenzen 16 en 18, fail-closed bij onbekende leeftijd
- een minderjarige mag gezondheid en herstel niet voor de ouder afschermen
- bij 18 stopt de ouderkoppeling automatisch, met bericht een week vooraf
- **BB-11 wijzigt:** de VOG-eis geldt alleen bij jeugd en structurele rollen. Bij onboarden vinkt clubbeheer aan, met afgiftedatum. Verlopen na drie jaar = waarschuwing, geen blokkade. Eendaagse helper = gast, geen VOG
- **BB-14 wordt strenger:** geen jeugdvoedingsinhoud. Een directe vraag van een jeugdlid krijgt antwoord zonder getallen
- teammanager staat boven ploegleider en mag overrulen (alleen bij wedstrijden)
- Club vervangt de positie Analyse in de vijf hoofditems voor wie een clubrol heeft
- rolwisselaar: context permanent zichtbaar, zoekveld vanaf meer dan vijf contexten

---

## 2. Daarna: pakket 02 — werkobjecten

Dit is de fundering onder 03 en 04, dus hij gaat eerst.

Bouw de gedeelde werkobjectlaag volgens `SPARKI_BUILD_02`, met de levenscyclus uit **patch hoofdstuk C**:

- verplichte status: concept · gedeeld · afgerond
- versie met zichtbaar wie wat invulde, met datum en tijd
- opmerkingen op onderdeelniveau, **door iedereen** inclusief renners, alleen zichtbaar binnen het eigen onderdeel
- taken, verplicht afvinkbaar door de houder
- kopiëren en sjablonen
- de wijzigingsgeschiedenis is alleen voor de ploegleider
- gelijktijdig bewerken van hetzelfde deel geeft een waarschuwing
- **offline valt buiten deze ronde** — komt bij een tweede update, en is dan alleen-lezen

De 41 sjablonen uit `SPARKI_DOCUMENT_LIBRARY_01` zijn **weergaven van deze laag**, geen 41 aparte datamodellen.

---

## 3. Daarna: pakket 03 — wedstrijd en team

Met deze correcties uit **patch hoofdstuk D**:

- **BB-42 vervalt.** De bezetting komt in de uitgebreide `club_race_selections`, niet in een aparte `race_assignments`
- **BB-47 vervalt.** Meerdaagse wedstrijden en etappekoersen komen nu mee: begin- en einddatum met etappes
- `club_race_events` wordt gekoppeld aan `races` — één wedstrijd voor iedereen
- `club_race_events` krijgt het ontbrekende `routeId`; parcours koppelen is optioneel
- conflicten: alleen persoonsdubbeling in v1, altijd waarschuwen, nooit blokkeren
- noodinformatie: ploegleider, teammanager en medical_staff. **Niet** mechanieker of soigneur. Altijd zichtbaar, inzage gelogd voor alle drie, sporter ziet wie keek en wanneer
- dagschema per persoon, verplichte vertrektijd en verzamelpunt, verschuift mee na bevestiging door de ploegleider
- vervoer per voertuig, materiaal door de mechanieker met eigen sjabloon en afvinken bij inladen
- gasten via e-mail of link, link vervalt na de wedstrijd, intrekbaar, zien het hele plan
- wedstrijddagmodus is app-only, voor ploegleider én teammanager

---

## 4. Daarna: pakket 04 — trainer en facturatie

Met **patch hoofdstuk E**. De vijf besluiten die dit pakket blokkeerden zijn allemaal genomen:

- prijzen: €99/€990 tot 25 sporters · €179/€1.790 tot 50 · daarboven €9,90 per sporter, direct ingaand
- klantbetaling komt op de rekening van de trainer zelf
- Sparki beheert de factuurnummering, met instelbaar beginnummer
- standaard 21% btw, kleineondernemersregeling overschrijft die
- na opzegging blijven facturen downloadbaar
- digitaal ondertekenen van de begeleidingsovereenkomst
- een sporter mag aan meerdere trainers gekoppeld zijn; beiden tellen hem mee in hun limiet

**Buiten scope in deze ronde:** de clubafname van Compleet voor leden (patch hoofdstuk E, laatste blok). Dat vraagt een scheiding tussen betaler en gebruiker die nergens bestaat, en komt als aparte opdracht — net als `ABONNEE_ADMIN_01`.

---

## 5. Volgorde en vrijgave

`SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01` geldt: deze opdracht is de volledige uitvoeringsvrijgave voor alles hierboven. Rapporteren per fase, niet wachten.

Volgorde: **01 afmaken → 02 → 03 → 04**. Binnen 03 en 04 mag alles wat niet op de werkobjectlaag leunt parallel doorlopen.

`ROUTE_OVERPASS_STABILITEIT_01` (routeplanner) en `MOBILE_ROUTE_WALKING_01` (#536) lopen hier los van en hoeven niet te wachten.

---

## 6. Wat je niet doet

- de vijf volledigheidsonderzoeken opvragen of erop wachten
- `ABONNEE_ADMIN_01` bouwen of #536 als afgerond markeren
- `FUTUR_CONTROL_01` aanraken
- 41 aparte documentmodellen bouwen in plaats van één werkobjectlaag
- de fail-closed routecontrole versoepelen

---

## 7. Als eerste terugmelden

Voordat je begint, één regel: **is `SPARKI_DOCUMENT_LIBRARY_01` binnengekomen en staat hij in `docs/document-library/`?** Zonder die sjablonen kun je pakket 02 wel bouwen, maar niet vullen.
