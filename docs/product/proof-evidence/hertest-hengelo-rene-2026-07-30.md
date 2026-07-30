# Praktijk-hertest René — racefietsroute rond Hengelo (Ov), 30-07-2026

Onderdeel van taak #424 (Product Proof-doctrine: praktijktest ná technische proof).

## René's bevindingen (verse route, regio Hengelo)

1. **Diverse wegvakken niet geschikt voor de gekozen racefiets.**
2. **Schermtekst noemt "OpenStreetMap" i.p.v. GraphHopper** — verwarring over welke motor de route berekent.
3. **Hoogteprofiel oogt alsof er dikke beklimmingen komen die er niet zijn.**
4. **16,2% van de route heeft onbekende ondergrond.**

## Way-voor-way natrekken + wortelanalyse

Harnas-run 30-07-2026 (mét Hengelo als nieuw startpunt) reproduceerde de klasse
van fouten en legde twee échte motor-/meetgaten bloot:

- **Motorregel miste `compacted` en `fine_gravel`** (halfverhard — juist in
  Twente veelvoorkomend). De racefiets-wegdekstraf bestrafte alleen
  gravel/dirt/…; halfverhard telde als neutraal → routes konden er vrij
  overheen. Dit verklaart René's "niet geschikte wegvakken" direct.
- **Onbekend wegdek telde neutraal** ("bij twijfel maakt niet uit"). Voor een
  racefiets is dat een gok; Komoot-principe is "bij twijfel vermijden".
- **Valse onverhard-meldingen door voetpaden**: way-voor-way-verificatie van de
  Zwolle-lus toonde dat 3 van de 3 gravelmeldingen `highway=footway` waren —
  voetpaden náást de rijbaan waar een fietsroute nooit legaal overheen gaat
  (way/6508819 fine_gravel footway, way/162012373 compacted footway,
  way/680547212 pebblestone footway; de routebron zelf mat 100% verhard).

## Doorgevoerde fixes

1. GraphHopper racefiets-custom-model: `COMPACTED` + `FINE_GRAVEL` toegevoegd
   aan de zware wegdekstraf (`graphhopper.ts`).
2. "Bij twijfel vermijden": nieuwe regel `surface == MISSING → ×0.4` voor het
   racefietsprofiel; mild zodat ongetagde woonstraten (meestal asfalt) routes
   niet onnodig oprekken.
3. Kandidaat-selectie weegt nu ook het **onbekende** wegdek-aandeel mee
   (`surfaceKnownFraction`, gewicht 1.0 — lichter dan aantoonbaar onverhard
   6.0, anders wint gemeten-gravel van waarschijnlijk-asfalt). Vroege stop
   eist ≥90% gemeten wegdek.
4. Opmerkingenlaag: voetpaden (`footway`/`pedestrian` zonder
   `bicycle=yes|designated`) geven geen wegdek-melding meer (`route-remarks.ts`).
5. Schermtekst verduidelijkt: OpenStreetMap-melding gaat over de extra
   controlelaag (verkeerslichten/bos), niet over de routemotor.

## Hermeting (live, 30-07-2026, 6 startpunten incl. Hengelo)

`route-suitability-2026-07-30T06-33-32-464Z.json` — **PASS**:

| Stad | Verhard (bron) | Zeker-verboden | Onverhard/ruw |
|---|---|---|---|
| Hengelo (Ov) | 100% | 0 | 0 |
| Arnhem | 100% | 0 | 0 |
| Utrecht | 97% | 0 | 0 |
| Eindhoven | 100% | 0 | 0 |
| Zwolle | 100% | 1 (N331-rijbaan; fietspad ligt ernaast) | 0 |
| Maastricht | 96% | 0 | 0 |

Vóór de fixes op dezelfde dag: 3 onverhard/ruw-vakken + 91% verhard (Utrecht) → FAIL.

## Openstaand / eerlijk restrisico

- **Hoogteprofiel**: hoogte komt uit de SRTM-hoogtedata van de routebron; die
  ruist in vlak/glooiend NL omhoog (Hengelo-lus meet 400 hm op 48 km — te
  hoog voor Twente). Klimprofiel gebruikt sinds taak #423 wél dezelfde bron
  als de route (geen tegenspraak meer), maar de absolute hm-waarde blijft
  overschat → aparte vervolgtaak (afvlakking/drempeling, eerlijk gelabeld).
- **Onbekende ondergrond**: motor vermijdt hem nu, maar het gat écht dichten
  kan voor NL met de BGT (verhardingssoort, open data via PDOK) → vervolgtaak.
- **Proces**: "PRODUCT PROVEN" mag pas ná de praktijktest van René worden
  uitgeroepen; het automatische harnas geeft hoogstens "technisch gereed".
