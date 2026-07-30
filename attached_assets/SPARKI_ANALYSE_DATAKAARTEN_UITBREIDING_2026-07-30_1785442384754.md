# Sparki kalibratie — addendum: Analyse-Lab-pagina voor wedstrijdrenners (hoofdstuk B+C)

**Datum:** 30 juli 2026
**Scope:** een uit te bouwen **Lab-pagina** (bouwt voort op de bestaande "Wattage-lab"-kaart) binnen hoofdstuk B+C: de zes verplichte datakaarten, optioneel W'/FRC-onderzoek, de wat-als-scenariolaag, en aanvullende geavanceerde grafieken uit vergelijkbare apps. De hoofdpagina Analyse blijft glanceable/TrainingPeaks-helder (eerder vastgelegd); dit addendum gaat over de diepere Lab-laag ernaast. Geen andere modules of hoofdstukken.
**Aanleiding:** vergelijking met TrainingPeaks/WKO5/intervals.icu liet zien dat Sparki's Analyse-pagina (CTL/ATL/TSB, wekelijks volume, een los FTP/W-per-kg-cijfer) een aantal datakaarten mist die wedstrijdrenners actief gebruiken.

## Context (kort)

Dit addendum voegt zes verplichte datakaarten toe, plus één optionele (lagere prioriteit). Voor elke kaart geldt dezelfde discipline als de rest van vandaag: onderzoek eerst, dan datamodel, dan acceptatiecontract — geen productcode in deze opdracht.

## De zes verplichte datakaarten

### 1. Power Duration Curve (PDC)

**Wat:** beste vermogen per duur (bijv. 5s, 15s, 30s, 1min, 5min, 10min, 20min, 60min, 90min), berekend over een instelbaar venster (bijv. laatste 90 dagen, of all-time), als lijngrafiek met duur op een logaritmische x-as.

**Waarom dit de belangrijkste ontbrekende kaart is:** dit is de grafiek waar wedstrijdrenners het meest naar kijken — toont sprint-, anaeroob-, drempel- en duurvermogen in één oogopslag, in plaats van één los FTP-getal.

**Benodigde data:** vermogensdata (watt) per seconde uit ritten — al aanwezig gezien het bestaande W/kg-cijfer.

### 2. Piekvermogens / persoonlijke records per duur

**Wat:** een tabel/overzicht met de beste ooit behaalde waarden op vaste duren (5s/1min/5min/20min/60min), elk met de datum waarop behaald.

**Relatie tot kaart 1:** dit zijn de pieken van dezelfde PDC, apart uitgelicht als "records" — vergelijkbaar met hoe Strava/TrainingPeaks dit tonen.

### 3. TSS en IF per sessie

**Wat:** Training Stress Score en Intensity Factor per individuele training, niet alleen het geaggregeerde CTL/ATL/TSB-beeld. Toont hoe zwaar/intensief een specifieke sessie was ten opzichte van de drempel.

### 4. Ramp rate / overbelastingswaarschuwing

**Wat:** hoe snel de belasting (CTL) week-op-week stijgt, met een zichtbare veiligheidsgrens. **Let op overlap:** dit raakt direct de eerder verwachte hard_reject_rule bij hoofdstuk B+C over maximale week-op-week-toename in trainingsbelasting — dit addendum levert daar de concrete visuele/datakant van, het acceptatiecontract voor de harde grens zelf hoort al bij de B+C-kalibratie.

### 5. HR:Power-decoupling / efficiency factor

**Wat:** een trendlijn die laat zien of de aerobe conditie verbetert — kan de renner hetzelfde vermogen leveren bij een lagere hartslag na verloop van tijd. Berekend over langere, stabiele duurritten.

**Benodigde data:** zowel vermogen als hartslagdata voor dezelfde rit.

### 6. Individuele vermogenszones op basis van de eigen curve

**Wat:** in plaats van generieke zones als percentage van één FTP-getal, zones afgeleid van de eigen Power Duration Curve (Coggan-achtig: sprint/anaeroob/VO2max/drempel/tempo/duur, elk gebaseerd op de eigen data in plaats van een vaste FTP-percentage-tabel).

## Optioneel, lagere prioriteit (niet in deze ronde bouwen, wel alvast onderzoeken)

### 7. Anaerobe werkcapaciteit (W'/FRC)

Geavanceerd model dat aangeeft hoeveel "anaerobe reserve" een renner nog heeft tijdens een inspanning — geliefd bij data-analisten, maar technisch zwaar. Alleen onderzoeken (haalbaarheid, benodigde data), niet bouwen in deze ronde.

## 8. Aanvullende geavanceerde grafieken uit vergelijkbare apps (Lab-pagina)

Bij nader onderzoek (WKO5, intervals.icu) blijken er meer geavanceerde, door racers gewaardeerde weergaves te bestaan dan de zes hoofdkaarten hierboven. Deze horen thuis op de Lab-pagina, niet op de glanceable hoofdpagina Analyse:

- **Quadrant Analysis** — spreidingsdiagram van kracht (effectieve pedaalkracht) versus trapfrequentie per rit/interval; laat zien of een renner te eenzijdig op één cadans traint.
- **Interval-/rondeanalyse-tabel** — per interval binnen een rit: gemiddeld/genormaliseerd vermogen, cadans, hartslag, efficiëntie, in één overzicht.
- **Tijd-in-zone-grafieken** — voor vermogen, hartslag, én cadans (niet alleen vermogen).
- **W'/FRC-balans tíjdens een rit** — real-time anaerobe-reserve-verloop binnen één rit; dit is iets anders dan het seizoenslange W'/FRC-capaciteitsmodel uit punt 7 hierboven.
- **Variability Index (NP/gemiddeld vermogen)** per rit — laat zien hoe grillig een rit was.
- **Instelbare, gestapelde ritgrafieken** — zelf datareeksen kiezen en over elkaar leggen.

## Wat-als-scenariolaag (nieuw, apart onderdeel — pilot-aanpak)

**Wat dit is:** geen losse datakaart, maar een **gevisualiseerde verwachte-effect-laag**. De renner (of trainer) kiest een variabele (bijv. crank-lengte, bandenmaat, koolhydraatinname per uur, VO2max-trainingsfrequentie, lichaamssamenstelling versus doelinspanning) en krijgt een **grafiek met een verwacht effect als bandbreedte** terug — nooit een los "mooi" getal, altijd met bronvermelding en een expliciet label of het gevestigde consensus-wetenschap is of nog omstreden onderzoek.

**Waarom dit apart en niet als losse zevende kaart:** dit vergt voor elk onderwerp (crank-lengte, bandenmaat, spiermassa vs. lange duurinspanning, koolhydraatinname, etc.) een eigen onderzoeksronde naar gepubliceerde sportwetenschap — dit is het meest risicovolle onderdeel van dit hele addendum qua epistemische zorgvuldigheid: **nooit plausibel klinkende wetenschap verzinnen**, alleen echt gepubliceerd onderzoek citeren, met vertrouwensniveau en bandbreedte, zoals ook bij de doelen-haalbaarheids-engine van 29 juli al werd geëist.

**Pilot-aanpak, net als bij Routes:** begin met **koolhydraatinname per uur tijdens inspanning** als eerste, volledig uitgewerkte pilot (goed onderzocht, duidelijk voorbeeld van verschuivende wetenschap versus traditionele coaching-vuistregels) — pas na een geslaagde pilot uitbreiden naar andere onderwerpen (crank-lengte, bandenmaat, lichaamssamenstelling, VO2max-trainingsfrequentie, enzovoort).

**Verplichte structuur per onderwerp binnen deze laag:**

```yaml
id: SCENARIO_<ONDERWERP>_001
module: Training, coaching en analyse (B+C) — wat-als-scenariolaag
onderwerp: ""                          # bv. koolhydraatinname_per_uur

external_intelligence:
  research_required: true
  candidate_sources:
    - name: ""                          # gepubliceerd sportwetenschappelijk onderzoek, geen blogs
      coverage: ""
      actuality: ""
      consensus_status: gevestigd | omstreden | in_ontwikkeling
      effect_range: ""                  # bandbreedte, nooit één getal
      confidence: ""
  missing_information: []

visualisatie:
  type: interactieve_grafiek            # slider/keuze + verwacht-effect-bandbreedte, geen los cijfer
  toont_bandbreedte: true
  toont_bron_en_consensus_status: true

acceptance_contract:
  hard_reject_rules:
    - rule: "nooit een effect tonen zonder brongebaseerde bandbreedte en consensus-label"
      rule_type: hard_blockage
  approved: false

rene_calibration:
  questions: []
  completed: false
```

## Cross-hoofdstuk koppeling (geen dubbele opslag)

**Materiaal (hoofdstuk G):** wat-als-scenario's over bandenmaat, crank-lengte, e.d. moeten de bestaande materiaal-/garagegegevens uit hoofdstuk G **uitlezen** als uitgangspunt (huidige bandenmaat van de renner), niet een eigen, aparte materiaalregistratie opbouwen.

**Lichaamsprofiel-uitbreiding en slimme-weegschaal-koppeling (hoofdstuk H):** het lichamelijk profiel wordt uitgebreid met beenlengte, spiermassa en vetmassa (verschillende hefboomwerking bij korte vs. lange benen, ander effect van spier- vs. vetmassa bij lange duurinspanningen). Veel digitale weegschalen (bijv. Withings, Garmin Index, Renpho) kunnen dit al automatisch aanleveren via koppeling. Dit volgt het bestaande herkomstprincipe van 29 juli: via een gekoppelde weegschaal binnengekomen data is `MEASURED`, handmatig ingevoerde data is `SELF_REPORTED` en telt nooit als hard feit voor afgeleide berekeningen. De daadwerkelijke koppeling met weegschaal-aanbieders hoort bij hoofdstuk H, niet bij dit addendum — dit addendum specificeert alleen welke lichaamsprofielvelden nodig zijn voor de wat-als-scenario's.

## Wat je moet opleveren

Voor elke van de zes verplichte kaarten (plus onderzoek naar kaart 7), dezelfde structuur als bij eerdere hoofdstukken vandaag:

```yaml
id: ANALYSE_DATAKAART_<NAAM>_001
module: Training, coaching en analyse (B+C) — addendum datakaarten
subject: ""
status: needs_calibration

current_state:
  technical_status: not_yet_present
  source_snapshot: <datum van de code die je hebt gelezen>
  known_limitations: []

proposed_promise:
  text: ""
  proposed_by: replit
  rationale: ""
  rene_approved: false

external_intelligence:
  research_required: true
  candidate_sources:
    - name: ""            # bv. Coggan power profiling, WKO5-methodiek, intervals.icu-documentatie
      coverage: ""
      actuality: ""
      license_status: ""
      limitations: []
      applicability: ""
  missing_information: []

replit_definition:
  objective_quality_standard: ""
  recommended_default: ""
  technical_limits: []      # met name: welke historische data is al beschikbaar om dit met terugwerkende kracht te berekenen
  assumptions: []
  unknowns: []

rene_calibration:
  questions: []
  completed: false

acceptance_contract:
  hard_reject_rules: []     # met name relevant bij kaart 4 (ramp rate) — koppel aan bestaande belasting-hard-rule indien van toepassing
  tolerances: []
  unknown_data_policy: ""
  approved: false

validation:
  automated_tests: []
  practice_test_required: true
  result: not_tested

product_proof:
  score: null
  status: not_proven

next_action:
  type: research_or_build_or_retest
  description: ""
  approved_for_execution: false
```

## Dagelijkse contentpipeline (KnowledgeIsWatt en vergelijkbare bronnen)

**Doel:** dagelijks nieuwe, geverifieerde artikelen van erkende sportwetenschap-bronnen automatisch beschikbaar krijgen — om zelf mee te werken aan de wat-als-scenariolaag, en/of om aan trainers voor te stellen.

**Waarschuwing, eerst te onderzoeken (auteursrecht/licentie):** KnowledgeIsWatt is een betaald Substack-abonnement (100+ artikelen achter een betaalmuur). Automatisch content binnenhalen en tonen zonder toestemming/licentie kan een auteursrechtprobleem zijn. Replit onderzoekt eerst: bestaat er een gratis RSS-feed voor (een deel van) de content, is er een partnership-/licentiemogelijkheid, of moet Sparki zelf een betaald abonnement nemen om dit legitiem te mogen gebruiken. **Niet bouwen vóórdat dit is opgehelderd.**

**Verificatiestap (verplicht, geen kale samenvatting doorzetten):** voordat een artikel als "geverifieerd" geldt, wordt de onderliggende gepubliceerde studie waar het artikel naar verwijst gecontroleerd — nooit alleen de secundaire samenvatting overnemen zonder de bron te checken op actualiteit en consensus-status (zelfde regel als bij de wat-als-scenariolaag hierboven).

**Voorstellen aan trainers, niet automatisch verwerken:** zelfde patroon als bij de sessie-logistiek-AI van hoofdstuk J — een nieuw, geverifieerd artikel wordt als **voorstel** getoond aan René en/of trainers ("dit is mogelijk relevant voor jouw groep/programma"), nooit automatisch verwerkt in een trainingsplan of wat-als-scenario zonder menselijke beoordeling.

## Erkende, doorlopende sportwetenschap-bronnen (voor de wat-als-scenariolaag)

Naast eenmalig onderzoek per onderwerp: dit zijn bronnen die **continu** nieuwe, relevante wielerwetenschap publiceren en structureel gevolgd moeten worden, niet alleen eenmalig geraadpleegd:

- **KnowledgeIsWatt** (Dr. Gabriele Gallo, PhD Exercise & Sport Sciences) — wekelijkse reviews van gepubliceerd onderzoek, 100+ artikelen, onderwerpen: training, fysiologie, voeding, herstel, aerodynamica.
- **Fast Talk Labs** — kennisplatform/podcast, eveneens wetenschappelijk onderbouwd.

Replit onderzoekt bij elk wat-als-onderwerp of deze bronnen (en de onderliggende gepubliceerde studies waar ze naar verwijzen) relevant materiaal bevatten — nooit de secundaire samenvatting citeren zonder de onderliggende publicatie te checken op actualiteit en consensus-status.

## Wat je zelf moet bepalen (Replit)

- welke historische vermogensdata al beschikbaar is om de Power Duration Curve en piekvermogens met terugwerkende kracht te berekenen (of dit alleen vanaf nu opgebouwd kan worden);
- technische haalbaarheid van HR:Power-decoupling gegeven de beschikbare hartslag-/vermogensdata-kwaliteit;
- welke methodiek (Coggan, WKO5-achtig, of eigen variant) het beste past bij de bestaande architectuur voor individuele vermogenszones;
- onzekerheden en resterende technische risico's, met name rond kaart 7 (W'/FRC).

## Wat je NIET zelf mag bepalen (René beslist)

- welk tijdvenster standaard voor de Power Duration Curve wordt getoond (90 dagen, seizoen, all-time, of instelbaar);
- de exacte veiligheidsgrens voor ramp rate (koppelen aan de bestaande B+C-hard-rule-discussie, niet zelf een nieuw getal verzinnen);
- of individuele vermogenszones de bestaande generieke FTP-percentage-zones vervangen of ernaast komen te staan;
- bevestiging dat koolhydraatinname per uur het juiste eerste pilot-onderwerp is voor de wat-als-scenariolaag, of een ander onderwerp de voorkeur heeft;
- of de bestaande "Wattage-lab"-kaart letterlijk uitgroeit tot deze Lab-pagina, of dat het een nieuwe, apart benaderbare pagina wordt die vanuit die kaart wordt geopend;
- of Sparki zelf een betaald KnowledgeIsWatt-abonnement/partnership afsluit om de contentpipeline legitiem te maken, indien geen gratis RSS-optie bestaat.

## Wat je NIET mag doen in deze opdracht

- geen productcode of UI bouwen — dit is een onderzoeks- en datamodel-opdracht, net als de andere hoofdstukken vandaag;
- geen kaart 7 (W'/FRC) al implementeren, alleen onderzoeken;
- geen ander werk aan andere modules/hoofdstukken meenemen.

## Resultaat en stop

Lever het ingevulde YAML-deel voor alle zes verplichte kaarten plus het onderzoeksresultaat voor kaart 7 op. Stop daarna en wacht op review/goedkeuring van René.
