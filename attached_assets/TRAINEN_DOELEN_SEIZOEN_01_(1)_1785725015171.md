# TRAINEN_DOELEN_SEIZOEN_01 — bouwpakket

**Datum:** 03-08-2026 · **Basis:** commit `6689ea04`
**Uitvoeringsregel:** `CONTINUOUS_BUILD_GOVERNANCE_01` — goedkeuring van dit pakket is volledige uitvoeringsvrijgave voor de hele straat: inventarisatie, code, migraties, tests, herstel, commits, pushes en productiepublicatie. Mirror loopt parallel en blokkeert niet. Rapporteren is geen wachtmoment.
**Mobiele UX:** conform `MOBILE_UX_STANDARD_01` (v1.4).

---

## 1. Productdoel

De pagina Trainen wordt één plek waar doel, seizoen en de training van vandaag bij elkaar staan, en waar het doel het schema daadwerkelijk bouwt. Het model werkt voor de recreant, de terugkomer, de jeugdrenner en de wedstrijdrenner — doordat er twee onafhankelijke assen zijn in plaats van één.

**As 1 — doelvorm: wat wil je.**

- **Ritme** — geen einddatum, geen piek. Weekdoel plus dagelijkse voorstellen.
- **Programma** — één einddatum, één piek. Doorlopende opbouw base → build → peak → taper.
- **Seizoen** — meerdere vormblokken, meerdere pieken, met bewuste dips ertussen.

**As 2 — meetniveau: wat komt er binnen.**

- **Pro** — vermogen én hartslag. Volledig model.
- **Hartslag** — zones en belasting op hartslag. Zelfde raamwerk, grover.
- **Tijd en gevoel** — duur, afstand, RPE. Geen zones.
- **Aanwezigheid** — alleen dat er iets gedaan is. Wandelen, e-bike, jonge jeugd.

De motor degradeert per meetniveau. Het is **één systeem met minder ingangen**, nadrukkelijk geen tweede systeem naast het eerste.

---

## 2. Bindende besluiten

| # | Besluit |
|---|---|
| TD-01 | Het doel bouwt het schema. Niet: bijsturen binnen een bestaand schema, niet: doel als losse context |
| TD-02 | Eén hoofddoel tegelijk. Alle andere doelen zijn expliciet nevendoel of archief |
| TD-03 | Een hoofddoel **moet** een datum hebben. Zonder datum kan iets alleen nevendoel of archief zijn |
| TD-04 | Doelen wonen op de pagina Trainen. Instellen en uitvoeren op één plek |
| TD-05 | Maximaal twee nevendoelen. Een nevendoel bepaalt de **kleur** van een sessie, nooit de zwaarte of het moment |
| TD-06 | Sparki **genereert** de vormblokken uit hoofddoel, tussendoelen en wedstrijdkalender, en ze zijn altijd versleepbaar. Nooit een lege pagina. Eén gedrag voor alle doelgroepen: de Pro-renner tekent alles over, de recreant accepteert wat er staat |
| TD-07 | Een dip = minder volume én minder intensiteit, daarna weer terugbouwen. Eén vaste definitie |
| TD-08 | Twee pieken dicht op elkaar worden gewoon gebouwd. Sparki weigert niet en waarschuwt niet, maar houdt de vorm in de dip op onderhoud in plaats van terug te bouwen naar base |
| TD-09 | Elke wedstrijd krijgt twee gescheiden gewichten: belang voor de ploeg en rol in het eigen plan. Sparki overschrijft het ploeglabel nooit |
| TD-10 | Promotie gaat alleen omhoog. Sparki degradeert nooit uit zichzelf |
| TD-11 | Automatische promotie verandert alleen het **label**; de schemawijziging komt pas na bevestiging van de sporter |
| TD-12 | Loopt een programma of seizoen af zonder actie, dan verlengt Sparki op 80% belasting |
| TD-13 | Wandelen en e-bike krijgen uitsluitend doelvorm Ritme |
| TD-14 | De trainer mag zowel het doel als de doelvorm voorstellen. Het besluit blijft bij de sporter |
| TD-15 | Onder de 14: geen enkel getal, ook geen aantallen. Alleen wélke dagen er gefietst is. De ouder ziet exact hetzelfde beeld |
| TD-16 | Geen streaks, geen gemiste dagen, geen gewicht of calorieën in de ritme-proxy's |
| TD-17 | Sparki meldt per rit wat er miste voor de bewaking, in plaats van stil te degraderen |

---

## 3. Hergebruik — niet opnieuw bouwen

| Bestaat al | Waar |
|---|---|
| Periodisering base/build/peak/taper met taper-volumeverlaging en herstelweken | `lib/training-plan.ts` |
| Wedstrijdprioriteit A/B/C, standaard B | `races` schema; engine faseert al op de eerstvolgende A |
| Doelen met status, prioriteit, **`parentGoalId`**, `kind`, `theme` en schuifbalkstand | `lib/db/src/schema/goals.ts` |
| 18-grens voor gewichtsdoelen inclusief filter op modeluitvoer | `lib/goal-translate.ts` |
| Deterministische aanpassingsregels met voltooiing, RPE en onderbouwing | `lib/adjust-rules.ts` |
| Belastingscore en intensiteitsfactor uit vermogen en FTP | `lib/derived-load.ts` |
| CTL-trend over 28 dagen met uitleg | `lib/goals.ts` |
| Hartslagdata: `avg_hr`, `max_hr`, `resting_hr`, volledige hartslagstreams | `athlete-training.ts`, `athlete-metrics.ts`, `activity-streams.ts` |

Er wordt geen tweede doelenmodel, geen tweede plangenerator en geen tweede belastingmaat gebouwd.

---

## 4. Fasering

### F0 — Inventarisatie, geen code
Breng in kaart: alle plaatsen waar het doelenwerkblad wordt aangeroepen, alle schrijfpaden naar `athlete_goals`, alle lezers van `derivePhase`, alle plaatsen waar een belastingscore wordt verwacht, en alle plaatsen waar de voedingslaag trainingsdata leest. Lever een lijst met bestand en regelnummer.

**Verplicht onderdeel van F0: per fase een verklaring vooraf** — wat denk je te hergebruiken (met bestandsnaam) en wat denk je nieuw te bouwen. Die verklaring gaat vóór de eerste regel code. Staat er iets bij "nieuw bouwen" dat al bestaat, dan is dat zichtbaar vóór de bouw in plaats van erna.

### F1 — Zonekolom (blokkeerpunt, eerst)
De zone van een training wordt nergens vastgelegd; `plan_days` heeft alleen een menselijk label als tekst. Zonder dit is niets per zone te berekenen.

- Voeg `zone` toe aan `planned_workouts` en aan de uitvoeringskant, als **gestructureerde waarde** (endurance · tempo · sweetspot · threshold · vo2 · anaeroob · sprint · herstel).
- De generator schrijft de zone die hij zelf al kent (`dayKindFor`) weg in plaats van hem alleen in tekst te zetten.
- Bestaande rijen krijgen `null`. Nooit achteraf een zone raden.

### F2 — Meetniveau
- `measurement_level` per sporter (`pro` · `hartslag` · `tijd_gevoel` · `aanwezigheid`), zelf te kiezen, met uitleg wat elk niveau oplevert.
- Per uitgevoerde sessie vastleggen **welke signalen er feitelijk binnenkwamen**: vermogen ja/nee, hartslag ja/nee, duur ja/nee.
- Per rit een eerlijke, korte melding wat er miste en wat dat betekende — TD-17. Nooit stil degraderen.
- De keuze Pro is een voorwaarde, geen status: kiest iemand Pro en rijdt hij zonder meter, dan valt die rit terug op het feitelijke niveau en wordt dat gezegd.

### F3 — Belasting op hartslag
- Bereken een belastingmaat uit hartslag voor sessies zonder vermogen, met hartslagzones uit rust- en maximale hartslag.
- Deze maat is **apart herkenbaar** van de vermogensbelasting: nooit door elkaar optellen alsof ze hetzelfde zijn, altijd zichtbaar welke bron eronder ligt.
- Ontbreken ook hartslag en duur, dan blijft de sessie zonder belasting — dat blijft eerlijk leeg, precies zoals nu.

### F4 — Doellaag op Trainen
- Verplaats het doelenwerkblad naar de pagina Trainen. De regel die naar `/you` linkt vervalt.
- Eén hoofddoel, datum verplicht (TD-03).
- **Verplichte keuze bij een nieuw hoofddoel:** wat gebeurt er met het oude — behaald · niet meer relevant · wordt nevendoel · blijft hoofddoel en het nieuwe wordt nevendoel. Zonder antwoord wordt er niets opgeslagen.
- Doorvraagladder: bij een middeldoel vraagt Sparki omhoog ("waarvóór wil je dat?"), bij een uitkomstdoel omlaag ("wat moet daarvoor waar zijn?"). De ladder legt `parentGoalId` vast — dat veld bestaat al.
- Uit de ingevulde ladder volgt een voorstel voor de doelvorm, met uitleg waarom. De sporter bevestigt.

### F5 — Bevestigingsscherm "wat verandert er"
Vóórdat een plan op de kalender komt: de fasen met begindatums, het verschil met de huidige weken, en wat er van de sporter gevraagd wordt. Geldt voor elke wijziging van hoofddoel, doelvorm of seizoensindeling.

### F6 — Doel stuurt de fase (doelvorm Programma werkt)
- Ankerbron van `derivePhase` gaat van "eerstvolgende wedstrijd" naar "hoofddoel". De wedstrijdkalender wordt tweede signaal, niet eerste.
- Geen hoofddoel en geen wedstrijd → geen permanente base meer, maar het ritmegedrag van doelvorm Ritme.

### F7 — Seizoenslaag (doelvorm Seizoen)
De planhorizon is 21 dagen (`HORIZON_DAYS`). Die blijft. Er komt een **tweede resolutie** bovenop.

- Seizoenslaag: per week een doel (uren of belasting) over de hele seizoenslengte. De bestaande motor vult binnen 21 dagen de sessies in.
- Vormblokken worden gegenereerd uit hoofddoel, tussendoelen en wedstrijdkalender, en zijn versleepbaar: opbouw, vormperiode, dip. De sporter begint nooit op een lege tijdlijn.
- **Vijfde fase `onderhoud`** naast base/build/peak/taper: vorm vasthouden in plaats van terugbouwen. Dit is de fase die de dip tussen twee dichte pieken mogelijk maakt (TD-08).
- Binnen een vormperiode wordt niet per wedstrijd getaperd.

### F8 — Wedstrijdlabels en promotie
- Twee gescheiden velden per wedstrijd: ploegbelang en eigen rol.
- Promotie alleen omhoog, alleen het label, schemawijziging na bevestiging (TD-10, TD-11).
- Het ploeglabel wordt nooit door Sparki of door het persoonlijke plan overschreven.

### F9 — Uitslag en terugkoppeling
Na een hoofddoelwedstrijd vraagt Sparki om de uitslag en om een kort verslag. Blijft dat leeg, dan blijft het doel eerlijk **onbeoordeeld** — geen aanname dat het gehaald of gemist is.

### F10 — Doelvorm Ritme
- Weekdoel plus dagelijkse voorstellen, zonder fasen.
- Proxy's, maximaal twee te kiezen. Plezier: ritten samen · buiten in plaats van binnen · nieuwe routes of plekken · één tik "dit was leuk" na afloop. Fit blijven: weken waarin het ritme gehaald werd · actieve dagen per week · een vaste testrit die periodiek herhaald wordt.
- Onder de 14 (TD-15): geen enkel getal, alleen wélke dagen. Schuifbalk per thema is het doel. Voorstellen in woorden. Ouder ziet hetzelfde beeld.

### F11 — Verlenging na afloop
Loopt een programma of seizoen af zonder dat de sporter iets doet, dan verlengt Sparki met **verlaagd volume en de intensiteit op duurniveau** — geen kwaliteitsdagen, geen piek. Maximaal **vier weken**. Daarna een actieve melding om een nieuw hoofddoel te kiezen, en de verlenging stopt.

De vier weken zijn een vastgelegd besluit, geen afgeleide waarde; leg ze als configureerbare waarde vast met 4 als ingevulde standaard. De melding volgt de bestaande notificatieregels.

### F12 — Voeding volgt het schema

Wat er al is: `routes/nutrition.ts` leest de geplande trainingen en de uitgevoerde sessies en rekent met de belastingscore, en er is seizoensgewichtsturing met de RED-S-poort. Wat ontbreekt: `lib/nutrition-rules.ts` (93 regels, expliciet eenvoudige vuistregels over één logregel) kent de **trainingsfase** niet. Bouw geen tweede voedingsmodel — maak de fase leesbaar voor de bestaande laag.

**F12a — De dagtraining zegt wat je binnen moet krijgen.**
Bij elke geplande training komt een concrete inname te staan, met aantallen en eenheden: koolhydraten per uur tijdens de rit, vocht per uur, en de aanbeveling vóór en na. De waarden volgen uit duur, intensiteit, zone en fase — niet uit een vast tabelletje. Bij ontbrekende ingrediënten blijft het veld eerlijk leeg met de reden erbij, net zoals de belastingscore dat al doet.

**F12b — Doorklik naar het gedetailleerde voedingsplan.**
Vanaf de dagtraining één tik naar het volledige plan: de dag, de week, en wat het vormblok betekent voor de komende weken. Herstelvoeding na een zware sessie, en het verschil tussen een opbouwblok, een piek en een dip wordt hier zichtbaar. Dit is de plek waar de fase daadwerkelijk doorwerkt.

**F12c — Maaltijdbouwer voor het hele huishouden.**
Eén maaltijd voor iedereen aan tafel. De sporter krijgt een afwijkende portie of een aanvulling; de niet-sportende medebewoners krijgen de gewone versie. Medebewoners zijn **geen gebruikers**: leg over hen niets vast behalve wat nodig is om een portie te berekenen — geen profiel, geen gezondheidsgegevens, geen leeftijd tenzij de sporter die zelf invult voor de portiegrootte. Voorkeuren en allergieën van medebewoners mogen wel, want die bepalen de maaltijd.

**Harde leeftijdsgrenzen in deze fase.** Koolhydraat- en vochtadvies tijdens en rond inspanning is gewone sportvoedingsrichtlijn en mag vanaf de bestaande voedingsgrens. Een **totaal dagelijks calorie- of gewichtsdoel is dat niet** en blijft uitgesloten tot 18, conform de bestaande RED-S-poort en de jeugdregels. Bij minderjarigen toont de maaltijdbouwer porties en samenstelling, nooit een caloriebudget.
### F13 — Eindbewijs

Bewijsbundel met de testmatrix per fase en de toets-SHA.

---

## 5. Tests per fase

| Fase | Bewijs |
|---|---|
| F1 | Een gegenereerde week levert per training een gestructureerde zone; bestaande rijen blijven `null` en worden nergens geraden |
| F2 | Sporter op Pro rijdt zonder meter → rit valt terug, melding zichtbaar, zoneniveaus onaangeroerd |
| F3 | Sessie met alleen hartslag krijgt een belasting; sessie zonder hartslag en zonder vermogen blijft leeg; de twee belastingbronnen zijn nooit opgeteld |
| F4 | Nieuw hoofddoel zonder antwoord op de oude-doelvraag wordt **niet** opgeslagen; hoofddoel zonder datum wordt geweigerd; ladder legt `parentGoalId` vast |
| F5 | Geen enkele planwijziging bereikt de kalender zonder dat het verschilscherm is getoond |
| F6 | Sporter met hoofddoel over 60 dagen en een wedstrijd over 10 dagen: de fase volgt het hoofddoel |
| F7 | Seizoen maart/juni/september: drie vormperioden, dip in april op `onderhoud`, geen terugval naar base; weekdoelen lopen door tot voorbij de 21-daagse horizon |
| F8 | Vervanger of Sparki kan een ploeglabel niet verlagen; promotie zonder bevestiging verandert het schema niet |
| F9 | Hoofddoelwedstrijd zonder ingevulde uitslag → doel blijft onbeoordeeld, nergens "gehaald" |
| F10 | Account onder de 14 toont nergens een aantal, een streak of een gemiste dag; ouderbeeld is identiek |
| F12 | Elke geplande training toont een concrete inname met eenheid, of een eerlijk leeg veld met reden. De doorklik toont het weekbeeld inclusief het vormblok. Een minderjarige krijgt porties en samenstelling, nergens een caloriebudget of gewichtsdoel. Van een medebewoner is geen profiel of gezondheidsgegeven opgeslagen |

---

## 6. Directe afkeurgronden

- Een zone die achteraf geraden is voor een bestaande training
- Belasting uit hartslag en uit vermogen bij elkaar opgeteld zonder zichtbare bron
- Een rit die stil degradeert zonder melding
- Een nieuw hoofddoel dat wordt opgeslagen zonder besluit over het oude doel
- Een hoofddoel zonder datum
- Een planwijziging die de kalender bereikt zonder verschilscherm
- Sparki die een ploeglabel verlaagt, of een belangrijke ploegwedstrijd als trainingswedstrijd markeert
- Automatische promotie die het schema wijzigt zonder bevestiging
- Een getal, aantal, streak of vergelijking op een account onder de 14
- Een tweede belastingmaat, tweede plangenerator of tweede doelenmodel naast de bestaande
- Een tweede voedingsmodel naast `nutrition-rules.ts` in plaats van de fase leesbaar maken
- Een caloriebudget of gewichtsdoel bij een minderjarige, in welke vorm dan ook
- Een medebewoner die als gebruiker, profiel of gezondheidsdossier in het systeem belandt
- Een innameadvies dat wordt ingevuld terwijl duur, intensiteit of zone ontbreken — dat veld hoort leeg te blijven met de reden erbij

---

## 7. Openstaande productbesluiten (categorie C)

Bouw deze configureerbaar met lege waarde; ze blokkeren de rest niet.

1. **Promotie en vermoeidheid.** Automatische promotie is "het plan wordt zwaarder omdat je er goed uitziet". Moet promotie geblokkeerd worden bij signalen van vermoeidheid, ziekte, blessure of lage opvolging?
2. **Wrijving bij wedstrijd toevoegen.** Bij dertig wedstrijden per seizoen is dertig keer een gesprek te veel. Voorstel: standaard opbouw zonder vraag, gesprek alleen bij de eerste wedstrijd van een blok of bij een hoofddoelwedstrijd.
3. **Wie stelt het schema vast als er een trainer gekoppeld is?** Het **doel** blijft van de sporter — dat is besloten op 01-08 en staat niet ter discussie ("de sporter is de baas"). Maar wie het **schema** vaststelt is nooit besloten, en dat kan wél bij de trainer liggen. Bouw de schemalaag daarom met een expliciete eigenaar in plaats van impliciet de sporter.
4. **Overgang tussen doelvormen** — jeugd die doorgroeit, wedstrijdrenner die terugvalt na blessure. Nog niet uitgewerkt.
5. **Band 14–18**: krijgt een vijftienjarige periodisering, of een lichtere vorm?
6. **Meerdere sporten** in één seizoen (hardlopen staat al in de sportconfiguratie).

---

## 8. Wat bewust NIET in dit pakket zit

De Bayesiaanse laag — zoneniveaus als overtuiging met onzekerheid, slip en guess per waarnemingsbron, verval per energiesysteem, het volledige Banister-model met gain-termen. Die richting is akkoord, maar hij hangt op F1 en F3: zonder zone per training en zonder belasting bij de niet-vermogensgroep valt er niets te schatten. Het wordt een apart pakket zodra deze fasen op main staan.

---

## 9. Rapportagevorm

Eén bericht per afgeronde fase met: gewijzigde bestanden, migratienummers, testuitkomsten, en welke categorie C-punten geraakt zijn. Geen wachtmomenten.
