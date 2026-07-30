---
name: GraphHopper hoofdmotor voor fietsgeschiktheid
description: Waarom/hoe GH de route-motor is (racingbike/mtb, surface-details), guardrails en de route-suitability acceptatiepoort.
---
- GraphHopper (betaald abonnement) is de hoofdmotor: alleen die stuurt bij wegkeuze op wegdek + fietslegaliteit (racingbike/mtb, round_trip, `details:["surface"]` → pavedFraction). ORS kan dat niet en blijft alleen fallback.
- Activatie is EXPLICIET via `ROUTING_PROVIDER=graphhopper` (shared env). Auto-omschakelen op alleen-een-sleutel is bewust vermeden: een gratis/gedowngraded sleutel kent geen racingbike/round_trip en zou álle routegeneratie breken; die abonnementsfouten worden in dutchGhError eerlijk vertaald.
- Harde grendel `bikeSuitabilityConfigError()` (lib/routing/index.ts): cycling-road/mountain-generatie weigert met 503 wanneer GH geconfigureerd maar niet actief is (config-drift) — nooit stil ORS. Boot logt actieve routebron + luide warn.
- Selectie: `generateVariedLoop` weegt (1-pavedFraction)*6.0 voor cycling-road; early-exit eist pavedFraction null of ≥0.98. Onbekend wegdek telt nooit mee (≥60% van afstand gemeten, anders null).
- Acceptatiepoort `test:route-suitability` (live, kost quota; niet in merge-validatie): 5 steden à 50 km, faalt bij <3 meetbaar, <95% verhard, >1 zeker-verboden of >2 onverhard; 3 Overpass-pogingen per stad; schrijft tijdgestempeld bewijs naar docs/product/proof-evidence/.
**Why:** de routebelofte was groter dan de ORS-motor; Product Proof (docs/product/ROUTE_PRODUCT_PROOF_FIETSGESCHIKTHEID.md) eiste bronsturing + reproduceerbaar bewijs (onafhankelijk 9,3).
**How to apply:** routewijzigingen draaien de acceptatiepoort; nieuwe route-features nooit op ORS-aannames (100 km round-trip-cap e.d. gelden niet voor GH) en nooit stil terugvallen op een motor die de belofte niet dekt.

## Hertest-lessen (30-07-2026, Hengelo)
- De GH-custom-model-wegdekstraf moet OOK `COMPACTED` en `FINE_GRAVEL` bevatten (halfverhard = misser op racefiets; veelvoorkomend in Twente). Alleen gravel/dirt/… was niet genoeg.
- "Bij twijfel vermijden": `surface == MISSING → multiply_by 0.4` op racingbike; mild houden, want ongetagde NL-woonstraten zijn meestal asfalt.
- Kandidaat-selectie: `surfaceKnownFraction` (aandeel gemeten wegdek) weegt mee met gewicht 1.0 — LICHTER dan surfaceMiss 6.0, anders wint gemeten-gravel van waarschijnlijk-asfalt. Vroege stop eist known ≥0.9.
- Opmerkingenlaag-valstrik: `highway=footway`/`pedestrian` zonder bicycle=yes matchte als "onverhard op je route" (voetpad naast rijbaan) — way-voor-way geverifieerd vals; nu uitgesloten in classify.
- GH-hoogte (SRTM) overschat hm in glooiend NL (~400 hm op 48 km Twente) — profiel-bron is consistent sinds #423, maar absolute waarde blijft overschat (open).
- Procesles: "PRODUCT PROVEN" nooit vóór de praktijktest van de rijder; harnas = alleen "technisch gereed". Harnas bevat nu Hengelo als eerste stad.

## Acceptatiegrenzen-proof (30-07-2026, taak #436 — score 7,5, NIET gereed)
- Grenzen René (PO-01, bindend): racefiets 0% aantoonbaar onverhard, verbod = afkeur, onbekend actief mijden + eerlijk tonen. Harnas toetst nu exact deze grenzen, 6 startpunten × racefiets/gravel, met SUIT_PROFILE/SUIT_STARTS-deelruns (shellcalls hebben 5-min-limiet; workflowlimiet zit vol).
- `generateVariedLoop` heeft een racefiets-verlengingsronde: zolang géén kandidaat volledig verhard is, extra echte kandidaten tot plafond 10. Hielp Utrecht/Baambrugge naar 0; Dalfsen/Maastricht blijven falen — daar bestaat binnen 10 seeds geen schone lus.
- Kernoorzaken (art. 5): (1) geen harde afkeurpoort ná generatie (best-of-slechte wordt getoond, alleen eerlijk gelabeld) — bouwen is een open productkeuze (kost latency/"geen route"); (2) GH-graaf ↔ actuele OSM spreken elkaar aantoonbaar tegen (GH 99,9% verhard waar Overpass sand/compacted op de lijn meet; scherm mat 60,7% onbekend waar GH 14% zei).
- Gebruikersbril-check MOET via het echte app-pad (`POST /api/routes/generate`, veld heet `targetDistanceKm`, niet `distanceKm` — fout veld = stille default 40 km) + het echte routescherm; het harnas alleen is niet representatief.


## Bron-pavedFraction vs onafhankelijke nameting (30-07-2026, volledige proof-rerun)
Volledige suitability-run (7 starts × racefiets/gravel/gewone fiets) na custom-model-fix + harde poort: alles PASS behalve Maastricht × racefiets, waar de **routebron zelf** 0,8% onverhard rapporteert terwijl de Overpass-nameting 0 vakken vindt. Les: de harde afkeurpoort kijkt alleen naar de nameting (obstaclesOf); de bron-grens (pavedFraction<0.9995) in het harnas kan dus falen zonder dat de motor weigert. Wie de 0%-belofte sluitend wil maken moet óf de bron-pavedFraction in de poort meenemen, óf verklaren waarom bron en nameting verschillen (bijv. GH-surface vs OSM-remarks-classificatie).
## Gravel-profiel (taak #445)
- bikeType "gravel" heeft een EIGEN RoutingProfile `cycling-gravel` (GH "bike" + mild gravel-model; ORS mapt intern op cycling-regular). De harde 0%-onverhard-poort (hardRejectIfNeeded + +1000-straf in loop-quality) geldt alleen voor cycling-road en cycling-regular — nooit key'en op gedeeld provider-profiel maar op RoutingProfile per fietstype.
- N-wegen vermijden (keuze in route-maken): VOORKEUR-regel `road_class == PRIMARY || SECONDARY` ×0.15 in het custom model (alle fietsprofielen, ook MTB) — nooit een harde poort. `details:["surface","road_class"]` levert busyRoadFraction (aandeel primary/secondary); >10% ⇒ eerlijk "niet gelukt" in het avoidReport, nooit stil. Vrijliggende fietspaden zijn eigen OSM-ways met eigen road_class en worden dus nooit meebestraft. Live geverifieerd: rule + road_class-details geaccepteerd, busy-share 0.5%→0.0%.

## Gravel-onverhardvoorkeur stuurt de motor zelf
De gravel/MTB-onverhard-schuif alleen als NAKEUZE tussen kandidaten werkt niet: als de motor louter asfaltlussen bouwt valt er niets te kiezen (Twente-meting: ~3% onverhard bij 30% wens). Fix: `unpavedTargetShare` (0..1) op LoopRequest, en voor `cycling-gravel` een custom-model-voorkeursstraf op verhard wegdek (ASPHALT/CONCRETE/PAVED/PAVING_STONES), factor `max(0.3, 1-1.2*share)` — 0.76 was te mild (91% verhard bleef), 1.2-schaal gaf ~23% onverhard bij 40% wens. Nooit harde 0; racefiets krijgt deze regel NOOIT (harde 0%-grens blijft). Let op: ALLE route()-aanroepen doorgeven, ook longLoopViaWaypoints (>150 km) — die werd eerst gemist.

## Blokkadepoort geldt voor ÁLLE fietsprofielen (30-07-2026, MTB-regressie)
Een MTB-lus met fietsverbod/privéterrein/afgesloten poorten werd "KLAAR": (1) de obstakelpoort in loop-quality draaide alleen voor cycling-road/regular; (2) `blockedGates` ontbrak in hasForbidden van hardRejectIfNeeded; (3) `access=no/private` zonder fietsuitzondering was `uncertain` en telde dus nooit als forbidden. Fix: poort voor alle `cycling-*`-profielen (guard: niet-fietsprofielen nooit door de fietspoort — trap is geen blokkade voor wandelaar); alleen de onverhard-grens blijft road/regular; access=no/private is nu hard tenzij bicycle=yes/designated/permissive (parallelle-fietspad-correctie blijft de enige downgrade). Les: fietsuitzondering breed nemen — alleen `bicycle=yes` checken maakt designated/permissive vals-afgekeurd. Regressie: test:loop-quality-gate scenario's 6-10 + kalibratieregel hoofdstuk D.

## Onverhard-opmerkingen zijn geen waarschuwing op gravel/MTB
Routeopmerkingen kennen geen fietstype; presentatielaag filtert kind "onverhard" uit de kaart-waarschuwingsmarkers voor gravel/MTB (lijst + wegdekverdeling blijven volledig) — anders staat een gewenste gravelroute vol uitroeptekens.
