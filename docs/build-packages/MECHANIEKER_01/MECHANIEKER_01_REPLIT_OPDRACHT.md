# MECHANIEKER_01 — MATERIAAL EN GARAGE PRODUCTIEGESCHIKT

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Uitvoerder:** Replit
**Type:** breed domeinpakket
**Startcommit:** actuele `main`; bevestig de SHA in je eindrapport
**Status:** voorbereid werk. **Start pas zodra deze opdracht expliciet gegeven is (K2=A — de opdracht ís de vrijgave).**

## Doel

De materiaal- en garageomgeving is productiegeschikt: kilometers kloppen, onderhoud is herleidbaar, waarschuwingen zijn onderbouwd, en de mechanieker binnen een ploeg ziet en wijzigt precies wat hij mag.

## Scope

Fietsen · onderdelen · wielsets · banden · kettingen · cassettes · remmen · onderhoud · onderhoudsplanning · slijtage · kilometerregistratie · onderhoudshistorie · foto's · bikefit-koppeling · fiets-scan · ploegmechanieker · meerdere fietsen · waarschuwingen · reserveonderdelen.

## Buiten scope

Geavanceerde slijtagevoorspelling (vastgesteld: Compleet, aparte opdracht) · een onderdelenwinkel of voorraadbestelling · nieuwe sensorintegraties · de routeketen.

---

## 0. Bestaande onderdelen — hergebruiken, niet opnieuw bouwen

| Bestaand | Vindplaats | Draagt al |
|---|---|---|
| Garage | `routes/garage.ts`, `schema/garage.ts` | fietsen en onderdelen |
| Sensoren bij materiaal | `test:garage-sensors` | koppeling sensor–fiets |
| Materiaalcoach en waarschuwingen | `routes/material.ts`, `test:material`, `test:material-nudge` | onderhoudssignalen |
| Mechaniekerrol | `schema/club.ts` r36 — `mechanieker` | mag materiaalvelden bijwerken, verder alleen-lezen |
| Mechaniekertests | `test:mechanieker` | vertrekpunt |
| Fiets-scan | `routes/bike-scan.ts` | beeldherkenning van materiaal |
| Activiteit → fiets | `schema/athlete-training.ts` (`bikeId`, zachte verwijzing) | welke fiets bij welke rit |
| Herkomstvelden | `training_sessions`, `computation_traces` | onderbouwing van afgeleide waarden |

**Er komt geen tweede materiaalmodel.** Alles is additief op `garage` en de bestaande koppeling activiteit → fiets.

---

## 1. Twee dingen die vooraf vastliggen

### 1.1 BikeFit bestaat niet

De scope noemt een bikefit-koppeling. In de repository komt "bikefit" uitsluitend voor als trefwoord in `engines/context-memory/detect.ts` en `lib/world/population.ts`. **Er is geen BikeFit-functie.**

Bouw hem hier **niet**. Een bikefit-koppeling zonder BikeFit is een koppeling naar niets. Meld dit als restpunt; het hoort in een eigen opdracht met een eigen productbesluit. Dat blokkeert de rest van dit pakket niet.

### 1.2 De materiaaltest faalt op een toestemmingsfixture

`test:material` faalt vandaag op een ontbrekende of onduidelijke toestemmingsfixture. Dat is een bekende bevinding. Herstel de fixture **of** meld precies waarom de test niet betrouwbaar te maken is. Een groene suite met een uitgezette test is geen oplevering.

## 2. Herstelpunten

### 2.1 Kilometerberekening — het zwaartepunt

Kilometers per fiets en per onderdeel worden uitsluitend afgeleid uit **aantoonbare echte activiteiten**. Geen standaardwaarde, geen schatting, geen "gemiddeld gebruik".

- een activiteit telt bij precies één fiets;
- een activiteit zonder gekoppelde fiets telt bij géén fiets en is als zodanig zichtbaar;
- handmatig gecorrigeerde standen blijven staan en worden niet overschreven door een latere synchronisatie;
- een verwijderde activiteit haalt zijn kilometers weg bij de fiets en het onderdeel;
- elke afgeleide stand krijgt een `computation_traces`-onderbouwing; ontbreekt die, dan wordt de stand niet getoond.

### 2.2 Onderdelen en wielsets

Een onderdeel hangt aan een fiets of aan een wielset; een wielset kan wisselen tussen fietsen. Bij wisselen verhuizen de kilometers mee met het onderdeel, niet met de fiets. Een vervangen ketting of cassette begint op nul, met de oude als historie behouden.

### 2.3 Onderhoud, planning en historie

- een onderhoudsbeurt legt vast: wat, wanneer, door wie, en op welke stand;
- de historie blijft bij het onderdeel, ook na vervanging van de fiets;
- onderhoudsplanning werkt op kilometers, tijd of beide — en toont waarop hij zich baseert;
- een geplande beurt die is uitgevoerd verdwijnt uit de planning zonder de historie te raken.

### 2.4 Waarschuwingen

Een waarschuwing zegt **waarop hij is gebaseerd**: welk onderdeel, welke stand, welke drempel. Zonder onderbouwing geen waarschuwing. Geen waarschuwing op basis van een geschatte of ontbrekende stand.

### 2.5 Meerdere fietsen

Wisselen tussen fietsen is expliciet en zichtbaar. De actieve fiets is duidelijk. Een rit die aan de verkeerde fiets is toegekend, is achteraf corrigeerbaar — en die correctie verplaatst de kilometers.

### 2.6 Ploegmechanieker en rechten

De clubrol `mechanieker` mag materiaalvelden bijwerken en is verder alleen-lezen. Concreet:

- ziet het materiaal van de ploegleden waarvoor toestemming bestaat;
- mag onderhoud registreren en standen corrigeren;
- ziet **geen** sport-, gezondheids- of trainingsgegevens;
- kan geen leden beheren, niets verwijderen buiten materiaal, en geen rechten wijzigen.

Elke grens valt server-side. Een directe aanroep krijgt dezelfde weigering.

### 2.7 Foto's en fiets-scan

Foto's van materiaal volgen de bestaande rechten- en deelregels. De fiets-scan levert een voorstel, geen vaststelling: de gebruiker bevestigt voordat er iets in de garage verandert. Een mislukte scan geeft een eerlijke fout, geen ingevuld voorbeeld.

### 2.8 Lege toestanden en fouten

Lege garage, fiets zonder onderdelen, onderdeel zonder historie, ontbrekende kilometerbron: elk een eigen begrijpelijke toestand met een volgende stap. Nooit een nul die als gemeten stand leest.

## 3. Noodzakelijke aanvullingen

- reserveonderdelen zijn registreerbaar zonder aan een fiets te hangen, en koppelbaar bij montage;
- een overzicht per fiets van welke activiteiten hebben bijgedragen aan de huidige stand — dat is meteen de onderbouwing uit 2.1;
- een correctielog: wie heeft welke stand wanneer handmatig gewijzigd.

## Migraties

| Risico | Beheersing |
|---|---|
| Herberekening van standen wijzigt bestaande kilometerstanden | eerst dry-run met verschil per fiets; handmatige correcties blijven altijd staan |
| Wielsetlogica verplaatst kilometers van bestaande onderdelen | geldt vooruit; bestaande toewijzingen blijven, verschil melden |
| Strengere mechaniekerrechten nemen bestaande toegang af | dry-run per gebruiker vóór uitvoering |

## Regressietests

1. Kilometers per fiets volgen uitsluitend uit echte activiteiten.
2. Activiteit zonder fiets telt bij geen enkele fiets en is zichtbaar als zodanig.
3. Handmatige correctie overleeft een latere synchronisatie.
4. Verwijderde activiteit haalt zijn kilometers weg bij fiets en onderdeel.
5. Elke getoonde stand heeft een `computation_traces`-onderbouwing.
6. Wielset wisselen verhuist de kilometers met het onderdeel.
7. Vervangen ketting begint op nul; de oude historie blijft.
8. Onderhoudsbeurt legt wat, wanneer, door wie en op welke stand vast.
9. Uitgevoerde geplande beurt verdwijnt uit de planning, historie blijft.
10. Waarschuwing toont onderdeel, stand en drempel.
11. Geen waarschuwing op een ontbrekende of geschatte stand.
12. Rit corrigeren naar een andere fiets verplaatst de kilometers.
13. Mechanieker ziet materiaal van toegestane leden en geen sport- of gezondheidsdata.
14. Mechanieker kan geen leden of rechten beheren, ook niet via directe aanroep.
15. Fiets-scan levert een voorstel dat bevestigd moet worden.
16. Mislukte scan geeft een fout, geen ingevuld voorbeeld.
17. Lege garage, fiets zonder onderdelen en onderdeel zonder historie tonen drie verschillende toestanden.
18. `test:material` is groen met een geldige toestemmingsfixture, of het onvermogen is gemotiveerd gemeld.
19. Mobiel en desktop tonen dezelfde standen.

## Acceptatiecriteria

1. Geen enkele kilometerstand zonder aantoonbare bron.
2. Handmatige correcties blijven staan.
3. Wielset- en onderdeelwissels verplaatsen kilometers correct.
4. Waarschuwingen zijn onderbouwd en tonen hun grondslag.
5. Mechaniekerrechten houden in interface én API.
6. Foto's en scans lekken niets en vullen niets in zonder bevestiging.
7. Elke lege toestand is onderscheiden en zegt wat de volgende stap is.
8. BikeFit is niet gebouwd en als restpunt gemeld.
9. `test:material`, `test:garage`, `test:garage-sensors`, `test:mechanieker`, `test:material-nudge` groen.
10. Typecheck exit 0. Geen wijziging buiten materiaal, garage en hun weergave.

## Bewijsformat

Per regel: commando, resultaat, exitcode. Verder: per fiets de lijst bijdragende activiteiten naast de getoonde stand · de dry-run van de herberekening met verschil per fiets · het correctielog van één handmatige wijziging · de onderbouwing achter één waarschuwing · het API-antwoord naast het interfacegedrag voor de mechaniekerrol · schermafbeeldingen van de lege toestanden op mobiel en desktop · start- en eindcommit · gewijzigde bestanden.

## Stopcondities

- kilometers zijn niet betrouwbaar aan één fiets toe te wijzen zonder een productbesluit;
- herberekening zou bestaande handmatige correcties overschrijven;
- de toestemmingsfixture van `test:material` is niet betrouwbaar te maken;
- wielsetlogica vereist een wijziging in het activiteitenmodel;
- een bestaande test wordt onhoudbaar.

## Afhankelijkheden

| Nodig | Bron | Blokkerend? |
|---|---|---|
| Koppeling activiteit → fiets (`bikeId`) | bestaand | ja |
| `computation_traces` en herkomstregels | `DATA_TRUST_01` | **ja — voer dat pakket eerst uit** |
| Betrouwbare activiteitenlevenscyclus | `ACTIVITEITEN_01` | **ja voor 2.1** — kilometers volgen uit activiteiten |
| Clubrolmodel en toestemmingen | `TRAINER_CLUB_01` | sterk aanbevolen vóóraf |
| BikeFit | bestaat niet | nee — buiten scope |

## Herstelprotocol

Alleen de benoemde blokkade herstellen, op een nieuwe commit vanaf de afgekeurde commit. Geen refactor, geen scope-uitbreiding. Oorzaak onbekend: melden, niet gokken.

Hertesten: het afgekeurde scenario, alles wat dezelfde code raakt, plus de garage- en materiaaltests en typecheck.

**Uitzonderingslijst — hier blijft een fout niet lokaal:** de kilometerafleiding · de koppeling activiteit → fiets → onderdeel · de mechaniekerrechten · `computation_traces` voor materiaalwaarden. Raakt de fix een van deze vier, dan wordt het hele pakket hertoetst.

Na twee herstelronden op dezelfde blokkade: naar René.

## Documentatie

`docs/SPARKI_MATERIAAL_EN_ONDERHOUD.md` — kilometerafleiding, wielsetregels, waarschuwingsgrondslag en mechaniekerrechten.
