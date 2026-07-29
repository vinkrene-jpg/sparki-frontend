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
