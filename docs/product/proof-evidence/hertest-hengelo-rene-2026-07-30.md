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

## Vervolg (taak #429, 30-07-2026): hoogteprofiel toonde niet-bestaande bergen

Bevinding 3 (hoogteprofiel oogt als dikke beklimmingen) had twee wortels:

1. **hm-som telde SRTM-ruis mee.** De routebron levert per punt hoogte met
   1-2 m ruis; de naïeve som van positieve deltas telde dat in vlak NL op tot
   honderden valse hoogtemeters (Hengelo-lus: 400 hm op 48 km). Fix in
   `summarizeTrack` (gpx-parse.ts): eerst afvlakken over ±150 m wegafstand,
   dan sommeren met 3 m-ruisdrempel (hysterese) — sectorstandaard
   (Strava/Garmin/Komoot). Synthetische verificatie: vlakke 48 km-lus met
   realistische gecorreleerde SRTM-ruis → 18 hm (was ~honderden); echte 100 m
   klim + zelfde ruis → 108 hm (intact); harde alternerende ±3 m-ruis → 0 hm.
   Route, klimmen en profiel blijven uit één bron (les van #423);
   route-library en route-improvement geven de gedrempelde spoorwaarde nu ook
   voorrang op de rauwe provider-`ascend`.
2. **Y-as rekte automatisch op.** 15 m hoogteverschil vulde de volledige
   grafiekhoogte en oogde als een col. Fix in `elevation-profile.tsx`: vaste
   minimumschaal van 100 m — vlak oogt vlak, echt reliëf (>100 m verschil)
   schaalt zoals eerst. De kop labelt de hm-waarde nu expliciet als
   "± … hoogtemeters (geschat)"; de profiellijn zelf blijft de echte bronreeks.

AHN als bron is overwogen maar niet ingevoerd: dat zou een tweede hoogtebron
naast de routemotor zetten (strijdig met de één-bron-les van #423); de
drempeling lost de overschatting binnen de bestaande bron op.
