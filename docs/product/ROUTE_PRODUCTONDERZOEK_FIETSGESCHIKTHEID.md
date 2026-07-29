# Productonderzoek — Routes die écht geschikt zijn voor je gekozen fiets

Datum: 2026-07-29 · Taak #419 · Volgens SPARKI_PRODUCT_PROOF_DOCTRINE §9

## 1. De productbelofte (huidig, impliciet)

> "Sparki genereert een route die geschikt is voor jouw gekozen fiets (racefiets /
> gravel / MTB), doel en omstandigheden."

## 2. De huidige Sparki-aanpak

- **Routering:** OpenRouteService (ORS), publieke API. Fietstype stuurt het
  ORS-profiel (`racefiets → cycling-road`, `mtb → cycling-mountain`,
  `gravel → cycling-regular`) via `lib/routing/profile-selection.ts`. Lussen via
  `round_trip` (max 100 km) of waypoint-constructie daarboven.
- **Hoogte:** ORS-DEM (`elevation: true`), klimdetectie in `gpx-parse.ts`
  (`detectClimbs`), klimdetails via een tweede ORS-endpoint + Overpass.
- **Verrijking (best-effort, ná generatie):** routeopmerkingen uit Overpass/OSM
  (bicycle=no, onverhard, kasseien, …) binnen 30–60 m van de lijn; "Bergklassement"
  is in de UI een expliciete placeholder ("wordt nog uitgewerkt").

### Waarom het misgaat (praktijktest René)
1. **Routering en verrijking spreken elkaar tegen.** ORS respecteert OSM-toegangs-
   tags binnen zijn profiel, maar de opmerkingen-laag kijkt 30–60 m NAAST de lijn
   en markeert ook onzekere indicaties (access=private zonder fietstag). Een
   racefietsroute krijgt zo tientallen "hier mag je niet fietsen"-meldingen die
   deels over parallelle/nabije wegen gaan — ruw, ongefilterd, en in tegenspraak
   met de belofte.
2. **ORS kan binnen een profiel niet op wegdek sturen.** `cycling-road` weegt
   verhard zwaarder, maar er is geen harde "vermijd onverhard/vermijd
   fietsverbod"-parameter. Fouten of gaten in OSM komen ongefilterd in de route.
3. **Hoogte-inconsistenties.** Route-profiel en klim-detail komen uit dezelfde
   ORS-DEM, maar geüploade GPX behoudt zijn eigen hoogtebron; klimdetectie op
   ruis in vlakke gebieden + de Bergklassement-placeholder wekken de indruk van
   een "bergklassement op een vlakke route".

## 3. Best beschikbare marktbenadering

| Product | Aanpak | Relevant verschil |
|---|---|---|
| **Komoot** | Eigen routering op OSM per sportprofiel, met wegdek-/waytype-bewustzijn én eerlijke "off-grid / mogelijk niet berijdbaar"-segmentmarkering | Belooft geen perfectie; toont ongeschikte segmenten expliciet ín de route |
| **Strava Routes** | Eigen router + populariteits-heatmap (waar rijden racefietsers écht) | Populariteitsdata compenseert OSM-fouten; niet beschikbaar als open bron |
| **GraphHopper Cloud** | Custom bike-profielen (surface, road_class, access hard uitsluitbaar) | Betaald abonnement + sleutel; wél echte sturing op wegdek/legaliteit |
| **Valhalla / BRouter (self-host)** | Volledig stuurbare kostenfunctie op OSM | Zware infra (EU-graaf, GB's RAM/disk) — past niet in het huidige deployment (8 GiB-imagelimiet); publieke BRouter-server is non-commercial |

Conclusie markt: niemand belooft "gegarandeerd geschikt". De besten (Komoot)
routeren beter dan ORS **en** zijn eerlijk over restonzekerheid in de route zelf.

## 4. Benodigde databronnen / algoritmen / architectuur per optie

### Optie A — Belofte versmallen (eerlijk maken op de huidige motor)
- Bronnen: ongewijzigd (ORS + Overpass/OSM + ORS-DEM).
- Algoritmen: (1) verrijking verzoenen met de belofte — opmerkingen strikt op de
  routelijn matchen, onzekere indicaties bundelen i.p.v. tientallen losse
  meldingen; (2) klimweergave alleen bij echte klims; placeholder-Bergklassement
  van het routescherm; (3) één hoogtebron per scherm, bron benoemd.
- Belofte wordt: "Sparki plant je route via OpenStreetMap-routering afgestemd op
  je fietstype, en controleert hem daarna eerlijk: wat we op de route zien
  (verboden, wegdek, klims) melden we gebundeld — met bron en onzekerheid."
- Kosten: alleen bouwtijd; geen nieuwe afhankelijkheden.

### Optie B — Investeren in een sterkere bron
- Meest realistisch: **GraphHopper Cloud** (custom model: `bicycle=no` hard
  uitsluiten, onverhard zwaar bestraffen voor racefiets). Self-host Valhalla/
  BRouter valt af binnen de huidige deploy-limieten.
- Vereist: betaald abonnement (≈ €50+/mnd instap), API-sleutel, herbouw van de
  loop-generator + kwaliteitspoorten op een nieuwe provider, hernieuwde
  ORS-specifieke workarounds (100 km-limiet, dagquota) vervallen deels.
- Ook mét GraphHopper blijft OSM de bron: fouten in OSM blijven mogelijk; de
  verrijkings-eerlijkheid uit optie A blijft nodig.

## 5. Gaps
- Belofte ("geschikt voor je fiets") > motor (ORS kan niet hard sturen op
  wegdek/legaliteit binnen een profiel).
- Verrijking wordt gepresenteerd als oordeel over de route, maar is best-effort
  omgevingsdata met eigen foutmarge — zonder verzoening met de routelijn.
- Twee hoogte-gerelateerde weergaven kunnen elkaar tegenspreken; placeholder-UI
  ("Bergklassement") staat op een productscherm.

## 6. Voorgestelde oplossing
**Nu optie A** (versmallen + verzoenen + eerlijk presenteren), omdat ook optie B
de verzoening van A nodig heeft en A zonder nieuwe kosten/afhankelijkheden een
bewijsbare belofte oplevert. **Optie B als aparte vervolg-investering** zodra
René een betaald routeringsabonnement wil aangaan — dan is A het fundament
waar B bovenop komt, geen weggegooid werk.

Beslissing ligt bij René (doctrine §9: pas na goedkeuring bouwen).
