# Sparki kalibratie — opdracht: recreatieve fietser en e-bike (nieuw onderwerp)

**Datum:** 30 juli 2026
**Scope van deze opdracht:** uitsluitend het onderwerp "recreatieve fietser / e-bike" zoals hieronder vastgesteld. Geen andere modules of hoofdstukken.

## Belangrijke stopregel

Zolang taak #505 (lusgeneratie fail-closed, routeketen) niet is opgelost en herbewezen, mag dit onderwerp **alleen als afgebakend kalibratieonderzoek** worden uitgewerkt — **geen brede productbouw**. Deze opdracht levert onderzoek, datamodel en acceptatiecontract op, geen UI en geen productcode.

## Context (kort)

Sparki behandelde de recreatieve fietser tot nu toe niet als volwaardige gebruiker: de onboarding drukt een geschatte FTP op, de coaching blijft in trainingstaal (zones, intervallen, wedstrijden) praten ook als iemand "conditie/plezier" als doel koos, de routeplanner kent alleen racefiets/gravel/MTB, en Strava's e-bike-ritten worden na binnenhalen op één hoop gegooid met gewone vermogensritten.

## Het productmodel (al vastgesteld door René — niet ter discussie, wel te onderzoeken op haalbaarheid)

### Kernprincipes

1. **De recreatieve fietser is een volwaardige Sparki-gebruiker** — geen afgezwakte sporter, geen tijdelijke uitzondering.
2. **E-bike is geen apart gebruikerstype.** Elektrische ondersteuning is een eigenschap van de fiets, de activiteit, en eventueel de routekeuze — geen eigen silo door de hele app.

### Ontwerpregel: gebruikerstype en fietstype blijven gescheiden assen

Dit zijn vier onafhankelijke dimensies, nooit met elkaar verward:

- **gebruiker**: recreatief, serieus/prestatiegericht, etc.;
- **fiets**: stadsfiets, toerfiets, gravelbike, racefiets, MTB, e-bike-variant van elk;
- **ondersteuning**: geen, licht, normaal, sterk;
- **activiteit**: recreatieve rit, woon-werk, toertocht, training, wedstrijd, etc.

Een e-bike-toerfiets-recreatieve-woon-werk-rit is dus een combinatie van vier losse keuzes, geen apart "e-bike-gebruikersprofiel".

### Eerste bruikbare productstap (dit onderzoeken/kalibreren, niet meer)

- recreatieve fietser als onboardingkeuze;
- stads-/toerfiets als zichtbaar fiets- en routeprofiel;
- elektrische ondersteuning als fietseigenschap (geen/licht/normaal/sterk);
- e-bike-ritten apart herkenbaar bewaren — `EBikeRide` wordt **nooit stilzwijgend samengevoegd** met een gewone vermogensrit (dit is een hard_reject_rule, zie hieronder);
- geen verplichte FTP-, wedstrijd- of prestatietaal voor deze gebruiker;
- veilige, comfortabele routes met voorkeuren als natuur, water, autoluw en stad vermijden;
- begrijpelijke begeleiding zonder de gebruiker richting wedstrijdtraining te duwen.

### Expliciet NIET in deze eerste stap

- uitgebreide accuberekening;
- batterijverbruik per helling;
- volledige recreatieve coachengine;
- speed-pedelecregels;
- grote herbouw van alle trainingsschermen.

### Voorlopige productbelofte

> "Sparki helpt de recreatieve fietser een veilige, comfortabele en passende rit te plannen en begrijpen, zonder verplichte sport- of wedstrijdtaal. Bij een e-bike houdt Sparki rekening met elektrische ondersteuning zonder de rit als gewone prestatie- of vermogensrit te behandelen."

## Wat je moet opleveren

Eén sectie in `docs/PRODUCT_PROMISES/SPARKI_PROMISE_CALIBRATION.yaml`, met de structuur hieronder ingevuld voor elk relevant onderwerp binnen deze scope (onboarding, routeprofiel, coachtaal, dataopslag e-bike-ritten).

## Verplichte structuur per onderwerp

```yaml
id: RECREATIEF_EBIKE_<ONDERWERP>_001
module: Recreatieve fietser en e-bike (nieuw onderwerp)
subject: ""
status: needs_calibration

current_state:
  technical_status: implemented_partial   # bv. stadsfiets-profiel bestaat al deels in garage, e-bike-herkenning bij Strava-import bestaat al
  source_snapshot: <datum van de code die je hebt gelezen>
  known_limitations: []

proposed_promise:
  text: ""
  proposed_by: replit
  rationale: ""
  rene_approved: false

gebruiker_fiets_model:
  gebruiker: [recreatief, serieus]
  fiets: [stadsfiets, toerfiets, gravelbike, racefiets, mtb]
  ondersteuning: [geen, licht, normaal, sterk]
  activiteit: [recreatieve_rit, woon_werk, toertocht, training, wedstrijd]
  assen_onafhankelijk: true               # nooit combineren tot één vast "e-bike-gebruikersprofiel"

external_intelligence:
  research_required: true
  candidate_sources:
    - name: ""            # bv. bestaande garage/materiaal-code, Strava EBikeRide-documentatie
      coverage: ""
      actuality: ""
      license_status: ""
      limitations: []
      applicability: ""
  missing_information: []

replit_definition:
  objective_quality_standard: ""
  recommended_default: ""
  technical_limits: []
  assumptions: []
  unknowns: []

rene_calibration:
  questions: []
  completed: false

acceptance_contract:
  hard_reject_rules:
    - rule: "EBikeRide wordt nooit stilzwijgend samengevoegd met een gewone vermogensrit"
      rule_type: hard_blockage
      measurement_level: per_rit
      counterexamples:
        - case: "een geïmporteerde EBikeRide die zonder label meetelt in de gewone belasting-/vermogensberekening"
          proof_stage: designed
          proof_method: ""
          proof_result: not_yet_tested
    - rule: "geen verplichte FTP-schatting of wedstrijdtaal opgedrongen aan een gebruiker die 'conditie/plezier' als doel koos"
      rule_type: hard_blockage
      measurement_level: per_gebruiker
      counterexamples:
        - case: "onboarding die alsnog een geschatte FTP toont aan een recreatieve gebruiker zonder dat te vragen"
          proof_stage: designed
          proof_method: ""
          proof_result: not_yet_tested
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
  type: research_only
  description: ""
  approved_for_execution: false
```

## Wat je zelf moet bepalen (Replit)

- technische haalbaarheid van "ondersteuning" als losse fietseigenschap binnen de bestaande garage-/materiaalcode uit hoofdstuk G;
- hoe `EBikeRide` bij Strava-import al herkend wordt, en wat er nu technisch mis gaat waardoor het alsnog wordt samengevoegd;
- welke bestaande routeprofiel-code (toer-/stadsfietsprofiel) al aanwezig is en hergebruikt kan worden voor het nieuwe routeprofiel;
- objectief meetbare afbakening tussen "recreatief" en "serieus" gebruikerstype waar dat nog onduidelijk is;
- onzekerheden en resterende technische risico's.

## Wat je NIET zelf mag bepalen (René beslist)

- de exacte formulering van de coachtaal voor recreatieve gebruikers (welke woorden wel/niet, hoeveel motiverende toon);
- welke routevoorkeuren (natuur/water/autoluw/stad-vermijden) als standaardopties worden aangeboden;
- of "ondersteuning: sterk" een aparte veiligheidswaarschuwing nodig heeft (bijv. snelheid), ook al valt speed-pedelec-regelgeving buiten deze eerste stap;
- definitieve acceptatiegrenzen en volledige productbelofte — dit is nog niet formeel goedgekeurd, alleen de richting.

## Wat je NIET mag doen in deze opdracht

- geen UI wijzigen;
- geen productcode wijzigen — dit is onderzoek + datamodel, geen bouwopdracht;
- geen accuberekening, batterijverbruik-per-helling, speed-pedelecregels, of volledige recreatieve coachengine uitwerken — expliciet buiten scope voor deze stap;
- geen andere modules of hoofdstukken behandelen;
- geen brede productbouw starten zolang taak #505 niet is opgelost en herbewezen.

## Resultaat en stop

Lever alleen het ingevulde YAML-onderzoeksdeel op. Stop daarna expliciet en wacht op René's beoordeling van de definitieve belofte en acceptatiegrenzen, en op de afronding van taak #505, voordat enige bouw wordt overwogen.
