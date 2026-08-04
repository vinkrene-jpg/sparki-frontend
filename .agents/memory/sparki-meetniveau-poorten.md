---
name: Meetniveau-waarneming + twee poorten
description: Observed measurement level (sporen) vs. chosen setting, and the pakket/data gate separation rules.
---

## Waarneming naast instelling
- Er bestaan TWEE meetniveau-systemen die je niet mag verwarren: het door de sporter GEKOZEN niveau per rit (F2-instelling) en de WAARGENOMEN sporen (MEETNIVEAU_EN_UITLEG_01 §3: laatste 10 activiteiten, drempel ≥6; herstel-WAARNEMING = rusthartslag/HRV op ≥3 van 7 dagen, los van de ritsporen — alleen het interne NIVEAU HERSTEL_R vereist óók beide ritsporen). De waarneming is levend en nooit een instelling; state-transitie serialiseren (rijlock) of gelijktijdige refreshes claimen dezelfde episode dubbel.
- Interne niveaucodes verlaten de server nooit (B4): de API geeft alleen booleans + één §7-profielregel.
- Wegval = precies één melding per episode; terug-groeien is stil MAAR moet de open melding wel resolven, anders blokkeert de open resolutionKey de melding van een látere episode. Dedupe-sleutel moet episode-specifiek zijn (tijdstip), niet per dag.

## Twee poorten (§4)
- Poort-copy heeft één bron (sparki lib/poorten): pakketmelding nooit sensortaal, datamelding nooit "upgraden"/pakketnamen; pakket gaat vóór data, onbekend antwoord = open (UI fail-open, server blijft de echte poort). Elk sensor-spoor krijgt zijn eigen datapoort op de kaarten die erop leunen.
- **Why:** bouwdocument-foutgeval — "upgraden" tonen bij een sensorprobleem is verboden; scheiding moet toetsbaar in één bron zitten.

## Valkuilen
- Component-poorten met early return: de pakketpoort-return moet ná álle hooks staan (Rules of Hooks — rechten-antwoord dat binnenkomt verandert anders de hook-volgorde).
- brand-copy-lint vlagt ook meerregelige JSX-commentaarvervolgen én server-side engine-copy; de voorgeschreven §7-vorm "Sparki ziet van jou …" staat zin-exact in de allowlist met reden.

## SPOOR_H staat NAAST SPOOR_V (reviewles)
- Eén vermogen-gate over de hele Belasting-tab is fout: een renner met alleen een hartslagband krijgt dan onterecht een sensor-blokkade. Gates per kaart(groep): ritsensorpoort (vermogen ÓF hartslag) vervangt de hele analyse alleen als BEIDE ontbreken; puur vermogensgebonden kaarten (doelscenario/Wattage-lab) houden een eigen vermogenspoort.
- HR-basis: elke afgeleide (belastingsreeks, zones, betrouwbaarheid, projectie) kiest per venster precies één reeks — vermogen zodra aanwezig, anders hartslag — en benoemt die basis expliciet; reeksen nooit mengen of optellen. Alle consumers van dezelfde sessies moeten dezelfde basisregel delen, anders spreken kaarten elkaar zichtbaar tegen.
- Ook ALLE vermogensconsumers meenemen (powercurve, records, simulaties): sensormelding vervangt de kaart, en de server weigert vermogens-only endpoints op de wáárneming (niet op oude historie) — de UI is nooit de enige grens.
- **Why:** §3.1 zet vermogens- en hartslagspoor als gelijkwaardige sporen; "geen vermogen" is geen "geen data".
