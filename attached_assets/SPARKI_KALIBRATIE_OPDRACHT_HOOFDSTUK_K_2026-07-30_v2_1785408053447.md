# Sparki kalibratie — opdracht: hoofdstuk K (Ondersteuning, kennis en communicatie)

**Datum:** 30 juli 2026 (v2 — correcties verwerkt: geneste meetniveau per regel, ontwerp- vs uitgevoerd bewijs, uitgewerkte brondekking)
**Scope van deze opdracht:** uitsluitend de modules AI-helpdesk, contextuele uitleg, Kennis & Intel, meldingen, e-mail. Geen andere modules of hoofdstukken zijn onderdeel van deze opdracht.

## Context (kort)

Sparki's modulestatus noemt vrijwel alles "Volledig", maar dat is een technische implementatiestatus — geen bewijs dat de productbelofte in de praktijk klopt. Eerder is aangetoond dat een harde grens onterecht als "goed" kan doorkomen wanneer die als gemiddelde/aggregaat over een geheel wordt getoetst in plaats van per individueel geval. Deze opdracht moet dat risico voor dit hoofdstuk structureel afdekken.

## Wat je moet opleveren

Eén sectie in `docs/PRODUCT_PROMISES/SPARKI_PROMISE_CALIBRATION.yaml`, met daarin per onderwerp binnen dit hoofdstuk de structuur hieronder ingevuld.

## Verplichte structuur per onderwerp

```yaml
id: SUPPORT_<ONDERWERP>_001
module: Ondersteuning, kennis en communicatie
subject: ""
status: needs_calibration

current_state:
  technical_status: implemented
  source_snapshot: <datum van de code die je hebt gelezen>
  evidence_status: ""
  practice_status: ""
  known_limitations: []

proposed_promise:
  text: ""              # gewone taal, geen technische implementatieomschrijving
  proposed_by: replit
  rationale: ""
  rene_approved: false

external_intelligence:
  research_required: true
  candidate_sources:
    - name: ""
      coverage: ""              # welk deel van dit onderwerp dekt deze bron, en welk deel expliciet NIET (bv. alleen NL, alleen bepaald wegtype, alleen bepaalde leeftijdsgroep)
      actuality: ""             # versie/datum van de bron, en hoe vaak deze wijzigt
      license_status: ""        # gebruiksrecht, commerciële toepasbaarheid, eventuele beperkingen op hergebruik
      limitations: []           # bekende hiaten, onnauwkeurigheden, niet-gedekte regio's/gevallen
      applicability: ""         # waarvoor deze bron concreet wordt ingezet bij dit specifieke onderwerp — niet alleen genoemd, maar gekoppeld aan een gebruik
  sources_in_use: []            # subset van candidate_sources die daadwerkelijk wordt gebruikt, met reden
  privacy_status: unknown
  missing_information: []       # wat er ontbreekt ondanks alle candidate_sources — expliciet benoemen, niet verzwijgen

replit_definition:
  objective_quality_standard: ""
  recommended_default: ""
  technical_limits: []
  assumptions: []
  unknowns: []
  evidence_method: []

rene_calibration:
  questions: []          # ALLEEN productkeuzes, geen technische huiswerkvragen
  completed: false

acceptance_contract:
  hard_reject_rules:
    - rule: ""                          # de afkeurregel zelf, in gewone taal
      measurement_level: ""             # VERPLICHT, per regel apart: per_segment | per_dag | per_sessie | per_meting | aggregaat_over_geheel
      aggregate_justification: ""       # VERPLICHT INVULLEN als measurement_level = aggregaat_over_geheel, anders leeg: waarom een individuele uitschieter hier geen probleem vormt
      counterexamples:
        - case: ""                      # concreet geval dat DEZE regel moet weigeren
          proof_stage: designed         # designed | executed — zie toelichting hieronder
          proof_method: ""              # hoe dit is/wordt getoetst (redenering nu, geautomatiseerde test later)
          proof_result: not_yet_tested  # not_yet_tested | rejected_as_expected | failed_to_reject
  tolerances: []
  unknown_data_policy: ""
  approved: false

validation:
  automated_tests: []
  independent_checks: []
  practice_test_required: true
  practice_testers: []
  result: not_tested
  expectation_gap: []

product_proof:
  score: null
  status: not_proven
  evidence_refs: []

next_action:
  type: research_or_build_or_retest
  description: ""
  approved_for_execution: false
```

## Drie verplichte verduidelijkingen

### 1. Meetniveau en tegenvoorbeelden horen bij de regel, niet los ernaast

Eén onderwerp kan meerdere `hard_reject_rules` hebben, en niet elke regel hoeft hetzelfde meetniveau te krijgen. Daarom staat `measurement_level`, `aggregate_justification` en `counterexamples` genest **onder elke individuele regel**, niet als aparte lijst op onderwerpniveau. Vul dit per regel apart in — nooit één meetniveau voor het hele onderwerp aannemen.

### 2. Ontwerp-bewijs nu, uitgevoerd bewijs later — nooit als "bewezen" markeren zonder onderscheid

In deze opdracht mag je **geen productcode wijzigen**. Dat betekent dat je op dit moment geen geautomatiseerde test kunt draaien om aan te tonen dat een tegenvoorbeeld wordt afgewezen. Daarom:

- `proof_stage: designed` betekent: je hebt met een concrete, natrekbare redenering (rekenvoorbeeld, logica-doorloop, verwijzing naar de exacte voorgestelde drempel/formule) aangetoond dat de regel zoals voorgesteld dit tegenvoorbeeld zou moeten weigeren — zonder dat de code al bestaat of is uitgevoerd.
- `proof_stage: executed` mag pas worden gebruikt zodra de regel daadwerkelijk is gebouwd en een geautomatiseerde of praktijktest is gedraaid (dit gebeurt in een latere bouwfase, niet in deze opdracht).
- `proof_result: not_yet_tested` is de enige toegestane waarde zolang `proof_stage: designed` is. Zet nooit `rejected_as_expected` zonder dat de test ook echt is uitgevoerd — dat zou precies het probleem herhalen dat dit hele systeem moet voorkomen.

### 3. Externe bronnen moeten uitgewerkt zijn, niet alleen genoemd

Een bron in `candidate_sources` telt alleen als volwaardig als `coverage`, `actuality`, `license_status`, `limitations` én `applicability` zijn ingevuld. Een kale naam zonder deze vijf velden ingevuld is onvoldoende en moet worden aangevuld of expliciet als `missing_information` worden gemarkeerd — niet stilzwijgend als "onderzocht" worden gepresenteerd.

## Wat je zelf moet bepalen (Replit)

- bronkwaliteit, versie en actualiteit van kennis;
- wanneer de helpdesk antwoordt, een ticket maakt of escaleert;
- bescherming tegen verzonnen antwoorden (hallucinatie-detectie/escalatieregels);
- welke meldingen werkelijk relevant en leverbaar zijn;
- continuïteit bij afwezigheid van René.

## Wat je NIET zelf mag bepalen (dit leg je aan René voor, als productkeuze, niet als technische vraag)

- toon en lengte;
- wanneer Sparki mag onderbreken;
- gewenste escalatie naar mens of noodprocedure;
- hoeveel meldingen acceptabel zijn.

## Wat je NIET mag doen in deze opdracht

- geen UI wijzigen;
- geen productcode wijzigen;
- geen andere modules of hoofdstukken behandelen dan hierboven genoemd;
- geen onbekende data stilzwijgend als acceptabel behandelen;
- geen `proof_stage: executed` of `proof_result: rejected_as_expected` invullen zonder dat er daadwerkelijk een test is gedraaid;
- geen bron in `candidate_sources` opvoeren zonder coverage, actuality, license_status, limitations en applicability.

## Resultaat en stop

Lever alleen het ingevulde YAML-deel voor dit hoofdstuk op. Stop daarna expliciet en wacht op review/goedkeuring van René (en eventueel Dylan) voordat een volgend hoofdstuk of enige andere module wordt opgepakt.
