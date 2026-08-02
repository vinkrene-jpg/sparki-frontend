---
name: Routegeneratie Vlaanderen (Herentals) — motor/poort-mismatch + gedeelde gebiedsvraag
description: Waarom "zoeken blijft draaien" ontstond en welke drie structurele fixes het oplosten
---

## Les 1 — motor en poort moeten dezelfde wegdekeisen hebben
De harde afkeurpoort eist voor de gewone fiets 0% onverhard, maar het GraphHopper
custom model voor `cycling-regular` strafte alleen zand/gras. In gebieden met veel
gravel (Kempen/Vlaanderen) bouwde de motor dan uitsluitend kandidaten die de poort
daarna afkeurde → generatie maalt tot het 5-minutenbudget en eindigt eerlijk leeg
(504/422). **Regel:** elk profiel met een harde poortgrens krijgt dezélfde sturing
in `customModelFor` (racefiets-regels: onverhard ×0.05, MISSING ×0.4, steps ×0.05).

## Les 2 — gedeelde Overpass-gebiedsvraag per generatie
Per-kandidaat-bboxes geven per kandidaat een eigen cache-sleutel → elke veiligheids-
controle een eigen trage netwerkronde (~10 s serieel). De generatie kent het zoek-
terrein vooraf (start + halve doelafstand + marge): geef die bbox als `queryBbox`
door aan `routeObstaclesOf` zodat álle kandidaten dezelfde gebiedsvraag delen
(1 netwerkronde, daarna cache-treffers). Filtering op afstand tot de routelijn
blijft per route — superset-bbox is veilig, nooit fail-open.

## Les 3 — dode mirror = meteen door, lange cooldown
Overpass-mirrors wisselen per minuut van gezondheid (mail.ru/kumi vielen samen weg).
Netwerkfout/timeout ⇒ direct naar de volgende mirror (geen same-mirror-herkansing;
429/503/504 blijven wél herkansbaar), cooldown 10 min i.p.v. 90 s.

## Les 4 — trap-matching op segmentprojectie
`highway=steps` telde binnen 30 m naast de route mee (kerk-/tunneltrappen ernaast).
Steps krijgen nu NEAR_STEPS_M=10 + dezelfde punt-tot-segment-projectietoets als
poorten.

## Overig
- Mobiel `POLL_DEADLINE_MS` moet boven het serverbudget (5 min) liggen (nu 5,5 min),
  anders geeft de app op vlak vóór de server zijn eerlijke einduitslag geeft.
- Gebiedsradius: lus van lengte L reikt hooguit L/2 van de start, maar round_trip
  overschiet het doel — reken met ~130% van de doelafstand; dekt de bbox een
  kandidaat niet, dan valt de meting eerlijk terug op de eigen route-bbox (traag,
  nooit fail-open).
- Diagnose-scripts voor api-server-lib's: tijdelijk als entry in build.mjs-lijst
  opnemen (tsx bestaat niet; --packages=external breekt op @workspace/db dir-import).
