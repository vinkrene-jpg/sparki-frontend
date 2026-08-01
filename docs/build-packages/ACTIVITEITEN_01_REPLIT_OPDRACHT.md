# ACTIVITEITEN_01 — DE VOLLEDIGE LEVENSCYCLUS VAN ACTIVITEITEN

## 0. Uitvoeringsregel (geldig vanaf 1 augustus 2026)

> Zodra René een volledige bouwopdracht aan Replit geeft, is de volledige daarin beschreven bouw-, test-, herstel-, migratie-, deployment-, productie- en rollbackstraat vrijgegeven. Replit voert alle fasen zelfstandig achter elkaar uit.
>
> Replit rapporteert per fase, maar wacht niet op antwoord. Rapporteren is geen wachtmoment.
>
> Mirror toetst parallel en vormt geen algemene wachtpoort. Mirror geeft geen menselijke bouwvrijgave, blokkeert geen onafhankelijke fasen en vraagt geen nieuwe toestemming voor reeds goedgekeurde scope. Ontbrekend bewijs is een herstelpunt, geen bouwstop.
>
> Productiepublicatie is een automatische poort met technische voorwaarden, geen menselijke goedkeuring: build groen · typecheck groen · verplichte tests groen · migraties gevalideerd · rollback beschikbaar · geen actieve harde stop.
>
> Alleen een aantoonbaar kritisch technisch, data-, privacy-, consent- of veiligheidsprobleem mag het direct afhankelijke onderdeel tijdelijk stoppen. Onafhankelijke bouw loopt door.
>
> Fasevolgorde binnen dit document is een technische afhankelijkheid, geen vrijgavepoort. "Eerst X, dan Y" betekent: Y heeft het resultaat van X nodig — niet: Y wacht op toestemming.
>
> Deze regel geldt binnen een gegeven opdracht. Een volgende opdracht in een reeks start niet vanzelf.
>
> (Bron: `SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01`, besluit René 01-08-2026, geregistreerd als `GOV-B1`.)


**Uitvoerder:** Replit
**Type:** breed domeinpakket
**Startcommit:** actuele `main`; bevestig de SHA in je eindrapport
**Status:** voorbereid werk. **Wordt actief zodra René deze opdracht als bouwopdracht geeft — de opdracht zelf is de vrijgave (zie §0); daarna loopt de volledige straat zelfstandig door.**

## Doel

Een activiteit is betrouwbaar van binnenkomst tot verwijdering: hij komt binnen bij de juiste gebruiker, met de juiste bron, in de juiste tijdzone, één keer, en met een eerlijke toestand wanneer er iets misgaat.

## Scope

Synchroniseren · import · handmatig toevoegen · bewerken · verwijderen · foto's · notities · routekoppeling · wedstrijd · training · e-bike · indoor · export · delen · analyses · AI-observaties · materiaalgebruik · herstel · kalender · duplicaten · conflicten.

## Buiten scope

Nieuwe providers · nieuwe analysemodellen · trainingsplanning en periodisering · de routegebruikstelling uit `02a`/`02b` · **wandelen activeren** (zie hieronder).

---

## 0. Bestaande onderdelen — hergebruiken, niet opnieuw bouwen

| Bestaand | Vindplaats | Draagt al |
|---|---|---|
| `training_sessions` met volledige herkomst | `schema/athlete-training.ts` | `source`, `sources`, `fieldSources`, `manualFields`, `mergeLog`, `externalRef`, **`dedupeKey`**, `routeId` |
| `activity_imports` | `schema/activity-imports.ts` | binnengekomen bestanden |
| `connector_activities`, `sync_runs` | `schema/connectors.ts`, `data-hub.ts` | ruwe provideractiviteiten en synchronisatieruns |
| Sportlijst van de hub | `engines/data-hub/sports.ts` | `HUB_SPORTS` met aliassen; "Walk"/"Hike"/"Walking" → `hiking` = "Wandelen" |
| Bestandsverwerking | `lib/activity-file-ingest.ts`, `fit-parse.ts`, `tcx-parse.ts` | GPX, FIT, TCX |
| Providers | `lib/connectors/providers/strava.ts`, `device-sync.ts` | Strava, Garmin en apparaten |
| Streams | `test:stream-extraction` | vermogen, hartslag, cadans, hoogte |
| Herkomstuitleg | `routes/data-origin.ts` | `/explain/session/:id` |
| Tests | `connect-import`, `connect-status`, `connect-sync`, `connection-health`, `connector-cleanup`, `strava-sync`, `provider-sync`, `data-hub`, `activity-file-ingest`, `fit-parse`, `sessions-contract`, `session-detail-track`, `session-elevation-profile`, `ingest-elevation-fit-tcx` | vertrekpunt |

**`dedupeKey` bestaat al.** Duplicaatafhandeling is dus geen nieuw systeem maar het sluitend maken van wat er is.

---

## 1. Twee dingen die vooraf vastliggen

### 1.1 Wandelen wordt in dit pakket niet geactiveerd

`HUB_SPORTS` kent `hiking` met het label "Wandelen", en de aliassen van Strava mappen er al op. Dat betekent dat een gewandelde activiteit vandaag al **ingelezen** kan worden. De hub scheidt bewust wat ingelezen mag worden van wat in de app actief is.

Deze opdracht raakt die scheiding niet. Wandelen wordt geactiveerd in taak **#536**, ná de routeketen. Bouw hier **geen** wandelschermen, geen wandel-vlaggen en geen wandelspecifieke weergave.

Wél binnen scope: zorgen dat een binnenkomende wandelactiviteit **correct wordt opgeslagen met sport `hiking`** en niet stilzwijgend als fietsrit belandt.

### 1.2 De stilzwijgende fietsaanname is een defect

`lib/activity-file-ingest.ts` zet vandaag voor een kale GPX `sport: "cycling"` als standaard. Dat is een verzonnen persoonlijke waarde en botst met de hoofdregel van `DATA_TRUST_01`.

Herstel: bij een bestand zonder sport wordt **niet** geraden. Vraag het de gebruiker, of markeer de activiteit als onbekende sport en behandel onbekend fail-closed — niet meetellen in sportafhankelijke afgeleiden.

## 2. Herstelpunten

### 2.1 Duplicaten en conflicten

- dezelfde activiteit uit twee bronnen levert één activiteit op, met beide bronnen in `sources`;
- een handmatig toegevoegde activiteit die later ook binnenkomt via een provider wordt samengevoegd, niet verdubbeld — met `mergeLog` als spoor;
- bij tegenstrijdige waarden uit twee bronnen wordt **niet willekeurig gekozen**: leg de voorrangsregel vast, pas hem consistent toe, en maak zichtbaar welke bron won via `fieldSources`;
- handmatig gecorrigeerde velden (`manualFields`) worden nooit overschreven door een latere synchronisatie.

### 2.2 Tijdzones

Een activiteit hoort in de dag waarop hij plaatsvond voor die gebruiker. Kalender, dagoverzicht en maandtotalen volgen `Europe/Amsterdam`, ook wanneer de server op UTC draait en de provider in UTC levert. Een rit om 23.30 uur valt niet op de volgende dag.

### 2.3 Foutpaden

Onderscheid — zoals in `DATA_TRUST_01` — tussen: geen koppeling · synchronisatie bezig · providerfout · rechtenprobleem · technische fout · bestand onleesbaar · niet-ondersteund formaat. Elk met een eigen, begrijpelijke tekst. **Geen enkele fout leidt tot voorbeeldactiviteiten.**

### 2.4 Bewerken en verwijderen

- bewerken raakt `manualFields` en laat de oorspronkelijke bron intact;
- verwijderen is expliciet, met bevestiging, en verwijdert geen bronrij bij de provider;
- een verwijderde activiteit verdwijnt uit analyses, totalen en kalender — geen wees-gegevens in trends.

### 2.5 Koppelingen aan route, wedstrijd en materiaal

- `routeId` is een zachte verwijzing; een verwijderde route mag geen kapotte activiteit opleveren;
- materiaalgebruik wordt aan de juiste fiets gekoppeld en telt door in de kilometerregistratie (zie `MECHANIEKER_01`);
- een activiteit die aan een wedstrijd hangt volgt de rechten van die wedstrijd.

### 2.6 Foto's en notities

Foto's bij een activiteit volgen de bestaande rechten- en deelregels. Een notitie is privé tenzij expliciet gedeeld. Geen foto zichtbaar voor iemand zonder recht.

### 2.7 Analyses en AI

Analyses en AI-observaties worden alleen berekend op aantoonbare echte invoer. Ontbreekt vermogen, hartslag of hoogte: dat veld blijft leeg en er komt geen afgeleide waarde. AI weigert met uitleg — hergebruik `ai_observations.missingData`.

### 2.8 Rechten

Een activiteit is van de sporter. Trainer, ouder en club zien hem uitsluitend binnen hun toestemming. Delen en exporteren volgen dezelfde grens, ook bij directe aanroep.

## 3. Noodzakelijke aanvullingen

- een zichtbare synchronisatiestatus per koppeling: laatste geslaagde run, laatste fout, en wat de gebruiker kan doen;
- een overzicht van geweigerde of mislukte imports met de reden, zodat een gebruiker weet waarom een rit ontbreekt;
- indoor en e-bike worden herkend en als zodanig getoond, zonder dat ze afgeleiden vervuilen die daar niet op slaan.

## Migraties

| Risico | Beheersing |
|---|---|
| Duplicaatsleutel botst met bestaande dubbele rijen | eerst tellen en melden, dan pas afdwingen; samenvoegen in overleg |
| Tijdzonecorrectie verschuift historische activiteiten | correctie alleen op weergave, niet op opgeslagen tijdstippen; verschuiving zichtbaar melden |
| Sport-onbekend markeren raakt bestaande imports | geldt vooruit; bestaande rijen behouden hun huidige sport en worden gemeld |

## Regressietests

1. Dezelfde activiteit uit twee bronnen levert één activiteit met twee bronnen.
2. Handmatige activiteit plus latere providerimport wordt samengevoegd, niet verdubbeld.
3. Handmatig gecorrigeerd veld overleeft een latere synchronisatie.
4. Tegenstrijdige waarden volgen de vastgelegde voorrangsregel, zichtbaar in `fieldSources`.
5. Rit om 23.30 uur valt in de juiste dag volgens `Europe/Amsterdam`.
6. GPX zonder sport wordt niet als fietsrit aangenomen.
7. Binnenkomende wandelactiviteit krijgt sport `hiking` en geen fietssport.
8. Ontbrekende koppeling toont geen activiteiten en geen voorbeelddata.
9. Providerfout, technische fout en onleesbaar bestand geven drie verschillende toestanden.
10. Verwijderde activiteit verdwijnt uit analyses, totalen en kalender.
11. Verwijderde route breekt de gekoppelde activiteit niet.
12. Analyse zonder brondata levert geen afgeleide waarde.
13. AI weigert een observatie bij ontbrekende invoer, met uitleg.
14. Trainer, ouder en club zien alleen toegestane activiteiten, ook via directe aanroep.
15. Foto bij een activiteit is niet zichtbaar voor een niet-rechthebbende.
16. Indoor en e-bike vervuilen geen afgeleiden die daar niet op slaan.
17. Export en delen volgen dezelfde rechten als de weergave.
18. Mobiel en desktop tonen dezelfde activiteiten en totalen.

## Acceptatiecriteria

1. Geen dubbele activiteiten; samenvoegen is herleidbaar via `mergeLog`.
2. Geen geraden sport, geen geraden waarde.
3. Tijdzone klopt in kalender, dagoverzicht en totalen.
4. Elke foutsoort heeft een eigen begrijpelijke toestand; nergens voorbeelddata.
5. Bewerken en verwijderen laten geen wees-gegevens achter.
6. Rechten houden in interface én API.
7. Analyses en AI rekenen alleen op echte invoer.
8. Alle bestaande activiteiten- en connectortests groen, uitgebreid met de nieuwe gevallen.
9. Typecheck exit 0. Geen wijziging buiten activiteiten, import en hun weergave.

## Bewijsformat

Per regel: commando, resultaat, exitcode. Verder: de voorrangsregel bij tegenstrijdige bronnen · het aantal bestaande duplicaten vóór afdwinging · de tijdzonecontrole met een rit rond middernacht · een `/explain/session/:id`-uitvoer naast de schermweergave · schermafbeeldingen van elke fouttoestand op mobiel en desktop · start- en eindcommit · gewijzigde bestanden.

## Stopcondities

- bestaande duplicaten kunnen niet worden samengevoegd zonder gegevensverlies;
- de voorrangsregel bij tegenstrijdige bronnen vereist een productbesluit;
- tijdzonecorrectie zou opgeslagen tijdstippen moeten wijzigen;
- een provider levert onvoldoende gegevens om herkomst vast te stellen;
- een bestaande test wordt onhoudbaar.

## Afhankelijkheden

| Nodig | Bron | Blokkerend? |
|---|---|---|
| Herkomstvelden en `dedupeKey` | bestaand | ja |
| Herkomst- en lege-toestandsregels | `DATA_TRUST_01` | **ja — voer dat pakket eerst uit** |
| Rolrechten op activiteiten | `TRAINER_CLUB_01` | sterk aanbevolen vóóraf |
| Kilometerregistratie per fiets | `MECHANIEKER_01` | nee — afstemmen, niet afwachten |
| Wandelen activeren | taak #536 | nee — hier expliciet buiten scope |

## Herstelprotocol

Alleen de benoemde blokkade herstellen, op een nieuwe commit vanaf de afgekeurde commit. Geen refactor, geen scope-uitbreiding. Oorzaak onbekend: melden, niet gokken.

Hertesten: het afgekeurde scenario, alles wat dezelfde code raakt, plus de connector- en sessietests en typecheck.

**Uitzonderingslijst — hier blijft een fout niet lokaal:** de ingestlaag (`activity-file-ingest`, `fit-parse`, `tcx-parse`) · `dedupeKey` en de samenvoeglogica · de tijdzone-afleiding · de herkomstvelden op `training_sessions`. Raakt de fix een van deze vier, dan wordt het hele pakket hertoetst.

Na twee herstelronden op dezelfde blokkade: naar René.

## Documentatie

`docs/SPARKI_ACTIVITEITEN_LEVENSCYCLUS.md` — bronvoorrang, duplicaatregels, tijdzone en fouttoestanden.
