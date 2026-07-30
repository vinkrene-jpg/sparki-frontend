# Poort 5b — Basale sanity-check (verplicht vóór elke praktijktest-oplevering)

Status: bindend onderdeel van de werkwijze (Product Proof Doctrine v1.1, §11).
Bron: uitvoeringsplan v2 (SPARKI_PROMISE_CALIBRATION_EXECUTION_PLAN 2026-07-30 v2, Poort 5b).
Vastgelegd: 2026-07-30 (taak #488).

## Waarom deze poort bestaat

Op 30-07-2026 vond René zelf drie soorten basale fouten die vóór oplevering gevonden
hadden moeten worden: een gravel-voorkeurschakelaar die niets deed, een functie die in de
gekozen context geen zin had, en laadtekst die als eindresultaat bleef staan. Poort 6
(praktijkbewijs) is bedoeld om inhoudelijke, kalibratiegevoelige zaken te vinden — niet om
basale bedieningsfouten op te vangen. Daarom staat er vóór elke praktijktest-oplevering
een eigen, lichte zelfcontrole van Replit: Poort 5b.

## Wat de poort inhoudt

Los van en aanvullend op Poort 5 (technisch bewijs) doorloopt Replit vóór elke oplevering
aan René/Dylan een eigen controle die geen externe bronnen, meetniveaus of
René-goedkeuring vergt — dit is basishygiëne, geen kalibratievraag. Drie verplichte
categorieën:

1. **Geen dode bediening.** Iedere zichtbare knop, schakelaar of link in het opgeleverde
   gebied doet daadwerkelijk iets. Een control die niets doet bij interactie is een
   blokkerende fout, geen "nice to have".
2. **Geen contextueel onzinnige functies.** Iedere getoonde optie past logisch bij de
   gekozen context (bijv. fietstype, route-type, rol). Een functie die voor de gekozen
   context per definitie geen zin kan hebben, hoort niet getoond te worden.
3. **Geen placeholder- of laadtekst als eindresultaat.** Tekst als "wordt bepaald uit de
   kaartgegevens…" mag alleen tijdelijk tijdens het laden zichtbaar zijn, nooit als
   permanente eindstaat.

De controle wordt door Replit zelf **uitgevoerd** (echte schermen/echte interactie, niet
alleen code lezen) en **gerapporteerd**: welke gevallen zijn gecontroleerd en wat het
resultaat was. Een oplevering zonder geregistreerd Poort 5b-rapport is geen oplevering.

## Rapportageformat (verplicht, registreerbaar)

Elk rapport is een YAML-bestand in `docs/PRODUCT_PROMISES/sanity-checks/` met de naam
`SANITY_5B_<JJJJ-MM-DD>_<korte-slug>.yaml`. Het format staat in
`sanity-checks/TEMPLATE.yaml` en wordt automatisch gevalideerd door
`node scripts/check-sanity-reports.mjs` (draait mee met de root-typecheckloze
controlelaag; handmatig altijd uitvoerbaar).

Verplichte velden per rapport:

- `delivery`: wat wordt opgeleverd (module/onderdeel + korte omschrijving).
- `date`: datum van de check (JJJJ-MM-DD).
- `checked_by`: wie de check uitvoerde (agent-oplevering: "replit").
- `surfaces`: welke schermen/flows daadwerkelijk zijn doorlopen.
- `checks`: per categorie (`dead_controls`, `context_nonsense`, `placeholder_as_result`)
  minimaal één concreet gecontroleerd geval met `case` (wat gecontroleerd) en `result`
  (`pass` of `fail` + toelichting). "N.v.t." mag alleen met expliciete reden
  (`not_applicable: <reden>`), nooit stilzwijgend leeg.
- `verdict`: `deliverable` alleen als alle checks `pass` zijn; anders `blocked` met de
  blokkerende gevallen. Een `fail` in welke categorie dan ook blokkeert de oplevering.

## Werkafspraak: testerfout in een gekalibreerde module

Bindend, als vast onderdeel van elke fix:

Wanneer een tester (René, Dylan of een andere praktijktester) een fout vindt in een
module die in `SPARKI_PROMISE_CALIBRATION.yaml` is opgenomen, dan bevat de fix altijd:

1. **Een afkeurregel** in `SPARKI_PROMISE_CALIBRATION.yaml` bij de betreffende module
   (onder `hard_reject_rules` of, voor bedieningsfouten, onder een
   `sanity_reject_rules`-blok in dezelfde stijl) die precies dit foutgeval voortaan
   weigert — inclusief tegenvoorbeeld.
2. **Een uitgevoerde test** die aantoont dat het tegenvoorbeeld daadwerkelijk wordt
   geweigerd/verholpen — uitgevoerd bewijs, geen future-tense voornemen. De testrun
   wordt genoemd in de YAML-regel (`proof_method` + verwijzing naar het bewijsbestand
   of de testnaam).

Een fix zonder deze twee onderdelen is niet af. Dit voorkomt dat dezelfde klasse fout
twee keer door een tester gevonden moet worden.

## Relatie tot de andere poorten

- Poort 5 (technisch bewijs) blijft onverkort gelden; Poort 5b vervangt niets.
- Poort 5b staat vóór elke praktijktest-oplevering, dus vóór Poort 6.
- Een module kan technisch groen zijn (Poort 5) en toch bij Poort 5b blokkeren.
