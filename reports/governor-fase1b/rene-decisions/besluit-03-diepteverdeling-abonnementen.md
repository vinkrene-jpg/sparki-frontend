# Besliskaart 03 — Welke diepte krijgt elk abonnement (Gratis · Go · Compleet)?

**Gebruikersreis:** Abonnementen (09), raakt 02/03/05/07.
**Status:** RENE_DECISION_REQUIRED — de regel ligt vast, de concrete verdeling is een prioriteits-/praktijkoordeel. **Geen prijsbesluit** — dat blijft een latere beslispoort.

## Huidige situatie
Vaste regel: abonnement bepaalt **diepte**, doel bepaalt prioriteit, taalniveau bepaalt terminologie; alle tiers delen één Analyse-architectuur en dezelfde engines (dat laatste klopt in de code). Afwijking: de code verdeelt niet op diepte maar op **feature-aan/uit** — 4 GO-sleutels (autonoom trainen, wedstrijd-intelligentie, observaties, performance lab) en een leeg COMPLETE-tier. Club/Team ontbreken als abonnement (vaststaand productgat, reviewset 07).

## Waarom dit ertoe doet
Zonder diepteverdeling kan COMPLETE niet bestaan, kan Club/Team niet gemodelleerd worden en blijft elke upgrade-nudge willekeurig. Dit blokkeert de commerciële livegang meer dan de Stripe-sleutels.

## Screenshots
- `artifacts/product-governor/fase1/7e2f1983/screenshots/vandaag/390x844/boven.jpg` (gratis ervaring + nudges)
- `artifacts/product-governor/fase1/7e2f1983/screenshots/analyse/390x844/boven.jpg` (gedeelde analyse-architectuur)

## Master Plan / eerdere besluiten
- Master Plan legt coaching-diepte bij COMPLETE; de code gate't die onder GO — gerapporteerd conflict.
- Vast: veiligheid/data-export/privacy/opzeggen altijd gratis (SPARKI-STRATEGIE.md).

## Advies van de Governor
Laat ChatGPT eerst een concreet dieptevoorstel per functie uitwerken (zelfde functie, oplopende diepte per tier); René kiest daarna alleen tussen uitgewerkte varianten. Kaart nu beslissen kan ook, maar met minder onderbouwing.

## Keuzerichtingen (max 3)
**A. Master Plan-lijn** — Go = zelfstandig trainen (basis-diepte), Compleet = volledige coaching-diepte; de 4 GO-sleutels worden diepte-treden.
Gevolg: herverdeling van bestaande gates; bestaande Go-testers zien functies verschuiven (legacy-carve-out bestaat al).
**B. Huidige code-lijn formaliseren** — Go houdt de 4 features; Compleet wordt "Go + toekomstige verdieping".
Gevolg: geen herbouw nu, maar Compleet blijft voorlopig leeg en het Master Plan moet worden aangepast.
**C. Diepte-model per functie (aanbevolen als eindbeeld)** — elke kernfunctie bestaat in elk tier, met oplopende diepte (bijv. analyse: basis → trends → voorspelling).
Gevolg: meeste bouwwerk, maar zuiverste uitvoering van de vaste regel; ChatGPT-voorstel nodig.

## Na de keuze automatisch uitvoerbaar
- Entitlements-configuratie + tests aanpassen aan de gekozen verdeling; upgrade-nudge-teksten volgen automatisch.
- Club/Team-modellering start daarna op het gekozen fundament (reviewset 07).
