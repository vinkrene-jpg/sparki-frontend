# Besliskaart 01 — Welke visuele eindrichting krijgt Sparki?

**Gebruikersreis:** Algemene structuur (01) + Analyse (03), raakt alle schermen.
**Status:** RENE_DECISION_REQUIRED — smaak- en merkoordeel, meerdere verdedigbare richtingen, eerdere besluiten geven geen eindsluitsel.

## Huidige situatie
Vrijwel de hele app staat op de donkere OLED-blauwzwarte fundering (designsysteem-tokens, cinematische achtergronden). Uitzondering: /analyse gebruikt op desktop een licht thema. Belangrijk: **de huidige donkere staat is géén goedgekeurde referentie** — het is een nulmeting. Er ligt bovendien een geparkeerde wens van Dylan/René (28-07): "lichte look app-breed, oppakken na de release."

## Waarom dit ertoe doet
Elke volgende visuele beslissing (herstel /analyse-desktop, nieuwe rol-werkruimtes, commerciële schermen, EU-landensites) hangt af van de eindrichting. Zonder besluit blijft elke fix een gok.

## Screenshots
- `artifacts/product-governor/fase1/7e2f1983/screenshots/analyse/1440x900/boven.jpg` (licht)
- `artifacts/product-governor/fase1/7e2f1983/screenshots/analyse/390x844/boven.jpg` (donker)
- `artifacts/product-governor/fase1/7e2f1983/screenshots/vandaag/390x844/boven.jpg` (donkere fundering)

## Master Plan / eerdere besluiten
- Master Plan bevat een dark-theme-regel; die staat op gespannen voet met de geparkeerde lichte-look-wens — juist daarom een René-besluit, geen automatische "alles donker"-fix.
- Vast besluit 2026-07-27: Vandaag-scherm donker met foto-sfeerkop (uitgevoerd, maar als richting niet formeel bevroren).

## Advies van de Governor
Kies de richting nu op hoofdlijn; detailinvulling kan per reviewset volgen. De inconsistentie op /analyse-desktop pas herstellen ná dit besluit.

## Keuzerichtingen (max 3)
**A. Donker als eindrichting** — huidige fundering bevriezen als referentiekader.
Gevolg: /analyse-desktop wordt donker getrokken (automatisch herstelbaar); lichte-look-wens vervalt of wordt accent.
**B. Licht als eindrichting (wens 28-07)** — app-breed lichte stijl na de release.
Gevolg: groot restyling-traject; donkere schermen worden allemaal afwijking; Master Plan-regel moet formeel herzien.
**C. Instelbaar (licht/donker-schakelaar)** — beide stijlen onderhouden.
Gevolg: dubbel ontwerp- en testwerk per scherm, maar geen gebruikersdiscussie; /analyse-desktop wordt eerste geharmoniseerde scherm.

## Na de keuze automatisch uitvoerbaar
- A: /analyse-desktop naar donker + tokencontrole app-breed.
- B/C: inventarisatie per scherm + gefaseerd restylingplan (bouwwerk, geen stille wijzigingen).
