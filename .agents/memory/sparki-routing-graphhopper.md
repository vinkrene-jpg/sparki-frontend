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
