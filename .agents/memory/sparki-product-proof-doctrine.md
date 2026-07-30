---
name: Sparki Product Proof Doctrine
description: Governing development doctrine (v1.4, by René, 30 jul 2026) — promise-driven building replaces feature-driven building.
---

Bron: `docs/SPARKI_PRODUCT_PROOF_DOCTRINE.md` (v1.4, 30 jul 2026; v1.1 in docs/archive/). Dit VERVANGT featuregedreven ontwikkeling.

Aanscherpingen v1.4 t.o.v. v1.1:
- §4 Hard falen wordt nooit gemiddeld: één verboden segment/ongeautoriseerde lezing/contextlek keurt de individuele uitkomst af.
- §5 Onbekend ≠ akkoord: veiligheids-/autorisatiekritisch kent drie uitkomsten (geldig/ongeldig/niet-verifieerbaar); alleen aantoonbaar geldig mag vrij. `unverifiable` is geen zachte waarschuwing.
- §6 Bewijsontwerp vóór implementatie; `designed/not_yet_tested` is eerlijk maar geen bewijs.
- §8 Bewijsobject = de VERTICALE gebruikersketen: correcte detector + latere fail-open stap = belofte faalt.
- §12 Poort 5c: onafhankelijke code-/ketenreview op exacte SHA's die óók benoemt wat NIET is uitgevoerd.
- §13 Poort 6a: iedere testerfout wordt permanent contractkennis (regel+tegenvoorbeeld+meetniveau+regressietest+bewijs+commit).
- §14: bij fundamenteel falende kernbelofte alleen afgebakend onderzoek/kalibratie, geen productbouw.

Kernregels:
- Elke module begint met één productbelofte (gebruikerswaarde, geen techniek).
- "Gereed" = de oorspronkelijke belofte is objectief bewezen met score ≥9,0 op betrouwbaarheid, volledigheid, begrijpelijkheid, relevantie, consistentie, praktische bruikbaarheid. Build/tests-groen/feature-aanwezig is NIET voldoende.
- Bij afkeur: oorzaak benoemen (belofte/architectuur/databron/implementatie/integratie/validatie/waarde), niet alleen dát het onvoldoende is.
- Geen nieuwe functionaliteit op een module waarvan de kernbelofte <9 scoort.
- GEEN BOUW ZONDER PRODUCTONDERZOEK (art. 9): vóór bouwen/aanpassen eerst onderzoeken hoe productieproducten dezelfde belofte waarmaken (belofte, huidige aanpak, beste marktbenadering, databronnen, algoritmen, architectuur, gaps, voorstel); implementatie pas ná goedkeuring van het onderzoek. Sparki wordt NOOIT versmald naar de beperkingen van de huidige implementatie zonder eerst te bewijzen dat een betere oplossing redelijkerwijs niet haalbaar is.
- Product Proof is onafhankelijk: objectief bewijs + onafhankelijke AI-validatie (architect/testing subagent, nooit alleen zelfbeoordeling) + praktijktest + eindbeoordeling → status PRODUCT PROVEN.

**Why:** René's vertrouwen brak op modules die technisch groen waren maar hun kernbelofte niet waarmaakten (racefietsroute met verboden wegen, afvaldoel dat nergens terugkeert). Context: eerlijke stand per module besproken 29 jul 2026 — Vandaag grotendeels ja; Routes nee (belofte groter dan ORS/Overpass-motor → productbeslissing versmallen of investeren); Analyse/Voeding/Wedstrijd/Coach half; Profiel-doorvoering nee (doelen worden opgeslagen maar door engines inconsistent geconsumeerd).

**How to apply:** Bij elk nieuw werk aan een module: eerst de kernbelofte benoemen, na afloop bewijs leveren dat de gebruiker de belofte ervaart (praktijktest + onafhankelijke validatie), score geven. Nooit uitbreiden op een module onder de 9.

## Wereldmarkt-lat (30-07-2026, René — bindend)

- Sparki concurreert per hoofdstuk met de wereldtop: routeplanner vs. Komoot (wielrenners gebruiken Komoot puur voor route→GPX→Garmin), Analyses vs. Garmin/Strava/TrainingPeaks. "Beter dan niets" of "acceptabel compromis" is nooit de norm.
- **Why:** niemand stapt over van Komoot naar Sparki voor een route mét onverharde/onbekende stukken; een zwakker analyses-hoofdstuk jaagt gebruikers terug naar Strava/TP. Elk onderdeel moet excellent (≥9/10) zijn t.o.v. de beste marktspeler op dat onderdeel — dit geldt app-breed.
- **How to apply:** bij elk nieuw of aan te passen onderdeel eerst de beste concurrent op dat onderdeel als benchmark nemen; kwaliteit/kwantiteit onder dat niveau niet accepteren of als "gereed" bestempelen.
