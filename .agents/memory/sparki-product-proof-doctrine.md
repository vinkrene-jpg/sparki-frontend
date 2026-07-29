---
name: Sparki Product Proof Doctrine
description: Governing development doctrine (v1.0, by René, jul 2026) — promise-driven building replaces feature-driven building.
---

Bron: `docs/SPARKI_PRODUCT_PROOF_DOCTRINE.md` (door René aangeleverd, 29 jul 2026). Dit VERVANGT featuregedreven ontwikkeling.

Kernregels:
- Elke module begint met één productbelofte (gebruikerswaarde, geen techniek).
- "Gereed" = de oorspronkelijke belofte is objectief bewezen met score ≥9,0 op betrouwbaarheid, volledigheid, begrijpelijkheid, relevantie, consistentie, praktische bruikbaarheid. Build/tests-groen/feature-aanwezig is NIET voldoende.
- Bij afkeur: oorzaak benoemen (belofte/architectuur/databron/implementatie/integratie/validatie/waarde), niet alleen dát het onvoldoende is.
- Geen nieuwe functionaliteit op een module waarvan de kernbelofte <9 scoort.
- Product Proof is onafhankelijk: objectief bewijs + onafhankelijke AI-validatie (architect/testing subagent, nooit alleen zelfbeoordeling) + praktijktest + eindbeoordeling → status PRODUCT PROVEN.

**Why:** René's vertrouwen brak op modules die technisch groen waren maar hun kernbelofte niet waarmaakten (racefietsroute met verboden wegen, afvaldoel dat nergens terugkeert). Context: eerlijke stand per module besproken 29 jul 2026 — Vandaag grotendeels ja; Routes nee (belofte groter dan ORS/Overpass-motor → productbeslissing versmallen of investeren); Analyse/Voeding/Wedstrijd/Coach half; Profiel-doorvoering nee (doelen worden opgeslagen maar door engines inconsistent geconsumeerd).

**How to apply:** Bij elk nieuw werk aan een module: eerst de kernbelofte benoemen, na afloop bewijs leveren dat de gebruiker de belofte ervaart (praktijktest + onafhankelijke validatie), score geven. Nooit uitbreiden op een module onder de 9.
