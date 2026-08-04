# WEDSTRIJDDOEL — basis eerst, onderdelen daarna

Werkdocument v2, 04-08-2026. Vervangt de opzet van `WEDSTRIJDDOELEN_15_EISPROFIELEN.md`; de vijftien uitgewerkte profielen daarin blijven geldig als bijlage.

Besluit van René dat deze herschrijving stuurt: **eerst een basis bouwen — wielrennen als geheel — en daarna pas onderdelen uitbouwen.**

---

## Waarom deze volgorde ook technisch klopt

Drie dingen die pas zichtbaar werden toen de basis vooropging.

**De basis is bouwbaar met wat er nu ligt.** Sparki berekent bij het inlezen van FIT/TCX al beste vermogens per vast venster (`power_bests`). Daarmee is een basisprofiel volledig invulbaar. Geen enkel onderdeel van de basis wacht op nieuwe opslag.

**De uitbouw wacht wél.** Volhoudbaarheid — wat er van je vermogen overblijft na uren rijden — is op dit moment niet berekenbaar: de ruwe vermogensstream wordt na het berekenen van de bests weggegooid en cumulatieve arbeid per rit wordt niet bewaard. Taakvoorstel #557 lost dat op vanaf het moment dat het draait. Dat is precies een uitbouwas, geen basis-as.

**De categorieproblemen zitten allemaal in de uitbouw.** De basis rekent in absolute watts en werkt daarmee ongewijzigd voor U17, U19, mannen en vrouwen. Pas bij de klim- en terreindoelen komt w/kg in beeld, en pas daar botst het met het besluit dat w/kg onder 18 niet als doel mag gelden. Basis eerst betekent dus ook: het jeugdprobleem hoeft niet in ronde één opgelost.

---

## Laag 0 — het basisprofiel wielrennen

Wat elke wedstrijdrenner nodig heeft, ongeacht welke koers hij rijdt. Vier waarden.

| Waarde | Wat het is | Waar het vandaan komt |
|---|---|---|
| **Drempelvermogen** | Wat je lang kunt volhouden | Bestaande FTP/eFTP |
| **Aeroob maximum** | 3 tot 8 minuten vol | Beste vermogen 5 min uit `power_bests` |
| **Anaerobe capaciteit** | Wat je boven drempel kunt wegzetten | Beste vermogen 1 min |
| **Piekvermogen** | 5 tot 15 seconden | Beste vermogen 5 sec |

Dit is de klassieke vier-durationsindeling (Allen & Coggan): 5 sec, 1 min, 5 min en drempel, staand voor neuromusculair vermogen, anaerobe capaciteit, VO2max en drempel. Bewezen, breed gebruikt, en volledig af te leiden uit wat Sparki al opslaat.

**Wat het basisdoel doet:**

De renner stelt geen los getal in. Hij ziet zijn vier waarden en Sparki bewaakt ze **alle vier tegelijk**. Gaat één omhoog terwijl een ander wegzakt, dan is dat zichtbaar en wordt het benoemd. Dat is de kern van je oorspronkelijke vraag: een renner die aan zijn FTP werkt mag zijn sprint niet kwijtraken, en dat is al op basisniveau te bewaken — zonder één koerssoort te kiezen.

**Wat de basis nog niet doet:** wegen. Alle vier de waarden tellen even zwaar. Welke voor jóuw koers het zwaarst weegt, is de uitbouw.

**Meetniveau:** vraagt `pro`. Op `hartslag` kan een sterk vereenvoudigde versie (duur en herhaling), op `tijd_gevoel` en `aanwezigheid` niet. Zo hoort het ook — dit is de wedstrijdrenner, die zit op vermogen.

**Categorieën:** identiek voor U17, U19, mannen en vrouwen. Alles in absolute watts. Normwaarden per niveau worden pas in de uitbouw relevant.

---

## Laag 1 — uitbouw: welke koers rijd je

Zodra de basis draait, kiest de renner zijn koerssoort. Dat doet twee dingen: het **weegt** de vier basiswaarden, en het voegt een vijfde toe.

**De vijfde waarde: volhoudbaarheid.** Wat er van je vermogen overblijft na 1000 tot 2500 kJ arbeid. Dit onderscheidt klassiekers van tijdritten en blijkt bij junioren zelfs niveau te onderscheiden. **Geblokkeerd tot #557 draait.**

De vijftien koerssoorten uit v1, gegroepeerd naar de duur van de beslissende inspanning:

| Beslissende inspanning | Koerssoorten | Weegt zwaarst |
|---|---|---|
| 5–20 sec | massasprint · criterium · baansprint/keirin | piekvermogen · hervulling |
| 30 sec – 2 min | kasseikoers · ploegentijdrit · veldrijden | hervulling · volhoudbaarheid |
| 3–10 min | heuvelklassieker · achtervolging · puntenkoers · MTB XCO | aeroob maximum |
| 15–60 min | bergrit · individuele tijdrit | drempelvermogen |
| hele koers | waaierkoers · etappekoers · lange eendaagse | volhoudbaarheid |

Volledige uitwerking per koerssoort — capaciteitsvolgorde, rekeneenheid, niet-vermogenseisen — staat in v1 en verandert niet.

**Wat deze laag nodig heeft dat er nog niet is:**

1. #557 (kJ per rit + gesplitste bests), anders geen volhoudbaarheid
2. Onderscheid tussen een **gekozen nevendoel** (kleurt de sessie) en een **profielondergrens** (mag volume afdwingen) — de huidige nevendoelregel kan het tweede niet
3. Besluit: eiswaarde absoluut per niveau, of alleen tegen de renner zelf
4. Besluit: één profiel per seizoen of één per vormblok

---

## Laag 2 — uitbouw: andere disciplines

Baan, veld en mountainbike hebben de basis en laag 1 nodig plus eigen belastingsafhandeling: krachtwerk en staande starts scoren in TSS vrijwel nul. De tweede belastingsas die dit opvangt staat sinds F2 in de database, dus deze laag is niet geblokkeerd — alleen niet aan de beurt.

---

## Laag 3 — uitbouw: jeugd

Pas hier komt het jeugdvraagstuk. Twee dingen die alleen bij U17 en U19 spelen:

- **De klim- en terreindoelen kunnen niet in w/kg.** Bergrit en XCO moeten voor onder-18 in absoluut vermogen en duur worden uitgedrukt, of niet worden aangeboden. Volgt uit het bestaande besluit en uit de waarschuwing in de literatuur tegen gewichtsstreven in de adolescentie.
- **Verzet kapt het sprintprofiel af bij U17.** Het maximum gaat per 1-3-2026 naar 7,68 m; bij junioren is de regel per 2025 vervallen. Een U17-sprintdoel moet dus op acceleratie en trapfrequentie sturen, niet op wattage in een zwaar verzet.
- **Groei vervuilt de meting.** Vermogenswinst bij een groeiende renner is deels ontwikkeling, niet training. Een niveaumodel dat dat niet scheidt, overschat de trainingsprikkel.

---

## Wat nog onbekend is

| Onbekend | Meting die het sluit |
|---|---|
| Of de Strava-koppeling bij historische activiteiten vermogen per seconde meelevert | Nakijken vóór de gefaseerde historie-import; zonder stream is de volgorde niet te redden |
| Welke kJ-grenzen #557 moet hanteren | Aansluiten op de in de literatuur gebruikte grenzen (1000 / 1500 / 2000 / 2500 kJ), anders zijn de waarden niet met normwaarden te vergelijken |
| Normwaarden voor junior vrouwen en voor U17 | Gericht literatuuronderzoek; bestaat het niet, dan geen norm tonen en alleen tegen de renner zelf meten |
| Officiële wedstrijdafstanden per categorie en geslacht | KNWU-wedstrijdreglement 2026 inlezen |
| Of de vijftien koerssoorten dekkend zijn | Vraag aan renners zelf — dit blijft een hypothese van Claude, geen inventarisatie |

---

## Volgorde die hieruit volgt

1. **Basisprofiel bouwen** — vier waarden, alle vier bewaakt, absolute watts, geen weging. Bouwbaar met wat er ligt.
2. **#557 uitvoeren vóór de historische import** — anders is de volhoudbaarheidsas voorgoed leeg over jaren aan ritten.
3. **Laag 1** — koerssoort als weging, plus volhoudbaarheid zodra #557 draait.
4. **Laag 2 en 3** — disciplines en jeugd.
