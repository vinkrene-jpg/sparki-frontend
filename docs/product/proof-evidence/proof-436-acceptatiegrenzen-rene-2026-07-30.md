# Product Proof #436 — Routebelofte tegen René's acceptatiegrenzen (PO-01, 30-07-2026)

**Datum:** 2026-07-30 · **Taak:** #436 · **Getoetst tegen:** de bindende acceptatiegrenzen in
`docs/productonderzoek/PO-01-ROUTES-FIETSGESCHIKTHEID.md` (doctrine art. 10):

1. Racefiets: **0% aantoonbaar onverhard** — elke gemeten meter is afkeur.
2. **Fietsverbod = route afkeuren** — nooit aanbieden.
3. **Onbekend wegdek is een risico** — actief mijden én eerlijk tonen.
4. Toetsing met de gebruikersbril, op echte schermen en echte routes.

## Hoe gemeten

- Acceptatieharnas `test:route-suitability` aangescherpt naar exact deze grenzen
  (0 onverhard racefiets, 0 zekere verboden op élk profiel, onbekend aandeel per route vastgelegd)
  en uitgebreid naar **6 startpunten** (stad: Utrecht, Eindhoven · platteland: Baambrugge-polder,
  Dalfsen-Salland · Twente: Hengelo · heuvels: Maastricht) × **racefiets én gravel** — 12 routes,
  elk dubbel gemeten: GraphHopper surface-details (de motor zelf) én onafhankelijke
  Overpass/OSM-opmerkingenlaag (dezelfde laag als op het routescherm).
- Generatiepoort verder aangescherpt (`loop-quality.ts`): wanneer ná de basisronde géén enkele
  racefietskandidaat volledig verhard is, vraagt Sparki extra échte kandidaten aan (tot het
  plafond van 10) tot er één schoon is.
- Gebruikersbril: routes via het échte app-pad (`POST /api/routes/generate` → opslaan) en
  beoordeeld op het échte routescherm (screenshots in `screens/route-436-*.jpg`).
- Bewijsbestanden: `route-suitability-2026-07-30T*.json` (racefiets- en gravel-deelrun van vandaag).

## Resultaten racefiets (grens: nul)

| Startpunt | GH verhard (van gemeten) | Onbekend (GH) | Onafh. onverhard-vakken | Zeker verboden |
|---|---|---|---|---|
| Hengelo (Twente) | 100,0% | 14% | 0 | 0 |
| Utrecht (stad) | 99,8% | 17% | 0 | 0 |
| Eindhoven (stad) | 100,0% | 24% | 0 | 0 |
| Baambrugge (polder) | 100,0% | 32% | 0 | 0 |
| Dalfsen (Salland) | 99,9% | 17% | **5** (compacted/fine_gravel/sand) | 0 |
| Maastricht (heuvels) | 97,8% | 7% | **2** (compacted/gravel) | 0 |

**4 van 6 startpunten halen de nulgrens; Dalfsen en Maastricht niet.** In een eerdere run
vandaag bevatte een Dalfsen-variant bovendien 1 zéker verboden wegvak — het verbod wordt dus
niet deterministisch uitgesloten, alleen sterk ontmoedigd.

## Resultaten gravel

Alle 6 startpunten: **0 zekere fietsverboden** (grens 2 gehaald). Onverhard aandeel eerlijk
gemeten (86–100% verhard); onverhard is op gravel toegestaan.

## Gebruikersbril ("wat zou René zeggen?") — echte schermen

- **Maastricht racefiets (route "Proof #436 — racefiets Maastricht", screenshot
  `screens/route-436-maastricht.jpg`):** het scherm is eerlijk — 21,5% onbekend, 0,3 km
  onverhard, 0,2 km compact gravel, kasseien, en het label **"GEDEELTELIJK GESCHIKT"** met
  waarom. René: *"Eerlijk getoond, maar deze route had ik dus nooit aangeboden mogen krijgen —
  0,3 km onverhard is 0,3 km te veel."* → per grens 1 een terechte afkeur die de app nu
  wél toont maar niet tegenhoudt.
- **Hengelo racefiets (route "Proof #436 — racefiets Hengelo 50 km", screenshot
  `screens/route-436-hengelo.jpg`):** de motor meldt 100% verhard van gemeten wegdek, maar het
  scherm zelf meet **60,7% onbekend** en toont **"ONVOLDOENDE GEGEVENS"** bij alle fietstypen.
  René: *"De ene laag zegt asfalt, de andere zegt 'weet ik niet' over 29 km — welke geloof ik?"*
  → twee onafhankelijke metingen spreken elkaar zichtbaar tegen; eerlijk, maar niet overtuigend.
- **Positief:** wegtypen/ondergrond-splits, hoogteprofiel en geschiktheidslabels staan met
  bronvermelding en "waarom" op één scherm; niets wordt mooier voorgesteld dan gemeten.

## Eindscore tegen de acceptatiegrenzen: **7,5 — NIET GEREED**

| Grens | Oordeel |
|---|---|
| 1. Racefiets 0% onverhard | **Niet gehaald** (2/6 startpunten met aantoonbaar onverhard) |
| 2. Verbod = afkeur | Vandaag 0 verboden op 12 routes, maar niet deterministisch afgedwongen (eerdere run: 1) |
| 3. Onbekend mijden + eerlijk tonen | Eerlijk getoond ✓; actief gemeden deels (7–32% bij motor, tot 60,7% op scherm) |
| 4. Gebruikersbril op echte schermen | Uitgevoerd; schermen eerlijk, maar tonen precies de bovenstaande gaten |

## Oorzaakanalyse (doctrine art. 5)

1. **Ontbrekende functionaliteit — geen harde afkeurpoort ná generatie.** De best-of-N-selectie
   kiest de beste échte kandidaat, ook als alle kandidaten de grens schenden (Maastricht: binnen
   10 echte kandidaten bestond geen volledig verharde 50 km-heuvellus). PO-01 §5.2 beschrijft de
   oplossing al: route pas tonen als de onafhankelijke verificatie schoon is, anders hergenereren
   of eerlijk "geen geschikte route gevonden". Nog niet gebouwd; botst met de snelheidsbelofte
   (p95 ≤ 3 s) zolang Overpass er blokkend voor moet draaien → productkeuze voor René.
2. **Databron-tegenspraak.** GraphHopper's graaf en actuele OSM (Overpass) verschillen: Dalfsen
   meet GH 99,9% verhard terwijl OSM op de lijn compacted/sand-vakken kent; Hengelo meet GH 14%
   onbekend waar het scherm 60,7% onbekend meet. De motor kan niet mijden wat zijn eigen kaart
   niet kent (oorzaakcategorie: verkeerde/verouderde databron). Structurele verkleining loopt via
   de BGT-overheidswegenkaart (taak #428) — nog niet in deze meting beschikbaar.
3. **Onvoldoende validatie op determinisme.** Het verbod (grens 2) wordt door het GH-fietsprofiel
   vrijwel altijd vermeden, maar nergens hard gegarandeerd; één run vandaag bevatte een verboden
   wegvak dat een volgende seed niet had.

## Wat de renner vandaag ziet (eerlijk gedocumenteerd, taak-eis)

Zolang de nulgrens niet gegarandeerd is: het routescherm toont per route de gemeten
wegtypen-splits, elk onverhard/verboden vak als opmerking op de kaart, het geschiktheidslabel
("geschikt"/"gedeeltelijk geschikt"/"onvoldoende gegevens") mét waarom, en bronvermelding.
Er wordt niets verzwegen — maar de route wordt nog niet tegengehouden.

## Gebruiksmoment met René (doctrine art. 10.5) — klaargezet

In de dev-omgeving staan onder **Rijden → Bewaard** twee routes klaar:
`Proof #436 — racefiets Hengelo 50 km` (beste geval) en `Proof #436 — racefiets Maastricht`
(afkeurgeval). Voorstel testmoment: genereer samen een racefietslus vanuit je eigen startpunt,
open het routescherm en beoordeel wegdek-splits + geschiktheidslabel tegen de grenzen; daarna
besluit over de harde afkeurpoort (zie open keuzes).
