---
name: Sparki provider compliance (kaarten/nav/weer)
description: Rechten-, attributie- en schaalregister van externe kaart/nav/weer-providers; wat commercieel NIET mag zonder contract.
---

Register + matrix + accountchecklist + attributiespec + bewijs staan in `docs/SPARKI_PROVIDER_*` (RN_01A2, 26-07-2026). Kernlessen:

- **CARTO basemaps** (standaard webkaart) vereist officieel een **Enterprise-licentie voor commercieel gebruik** — gratis CDN-gebruik is non-commercial-only. OSM-standaardtegels/CyclOSM staan commerciële schaal evenmin toe; Esri World Imagery gratis alleen niet-inkomstengenererend.
- **Open-Meteo free API is uitsluitend niet-commercieel** (10k/dag, CC BY 4.0-attributie verplicht); apps met abonnementen = commercieel ⇒ betaald abonnement nodig vóór lancering. Extra: de webnavigator roept api.open-meteo.com ook **rechtstreeks client-side** aan (route-navigator wind).
- **Mapbox eist twee attributies** (logo op de kaart + tekstlinks © Mapbox © OpenStreetMap + Improve this map); de mobiele app heeft er **nul** — bouwspec ligt klaar in `docs/SPARKI_ATTRIBUTION_IMPLEMENTATION_SPEC.md`, bewust nog niet gebouwd.
- **ORS officiële restricties**: round-trip en alternatieve routes max **100 km** — raakt de lusgenerator direct; dag-/minuutquota staan alleen in het ORS-dashboard (accounttier onbekend uit repo).
- **Privacy**: Overpass-mirrorvolgorde stuurt route-bboxes eerst naar maps.mail.ru (VK/RU); volgauto gebruikt uitsluitend die server — open beslissing René.

**Why:** juridische claims moeten op officiële providerbronnen steunen (URL's + ophaaldatum in `docs/SPARKI_PROVIDER_EVIDENCE.json`); "gratis endpoint werkt" ≠ "commercieel toegestaan".
**How to apply:** bij elke nieuwe kaart-/data-provider of bij commerciële lancering eerst dit register bijwerken; nooit een gratis publieke tegel-/databron als vanzelfsprekend commercieel bruikbaar behandelen.
