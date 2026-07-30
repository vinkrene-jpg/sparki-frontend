# Sparki kalibratie — opdracht: hoofdstuk J (Club, coachorganisatie en ploegomgeving)

**Datum:** 30 juli 2026
**Scope van deze opdracht:** uitsluitend de modules Club, teams, selecties, berichten, beheer, ploegleider/mechaniekerflows, en de trainer-rol in al zijn toegangsvormen. Geen andere modules of hoofdstukken zijn onderdeel van deze opdracht.

## Context (kort)

Dit hoofdstuk was tot vandaag productmatig volledig onbepaald. Het onderliggende model is inmiddels door René uitgedacht en hieronder al vastgelegd — deze opdracht vraagt Replit niet om het model te bedenken, maar om het te **onderzoeken op technische haalbaarheid, te vertalen naar het kalibratiecontract, en te toetsen tegen bestaande code**, exact zoals bij hoofdstuk D.

## Het productmodel (al vastgesteld door René — niet ter discussie, wel te onderzoeken op haalbaarheid)

### Eén trainer-rol, drie toegangsvormen

Er is precies **één rol**: `trainer`. Rechten verschillen per `access_context`, niet per apart roltype:

- **`independent`** (zzp/zelfstandig, eigen "Sparki-trainer"-abonnement): de meeste rechten. Volledig trainingsplan opstellen/aanpassen, dagelijkse/wekelijkse belasting sturen, evalueren, doelen/beschikbaarheid/herstel meenemen, uitgebreide communicatie, gezondheids- en hersteldata zien binnen toestemming, meerdere eigen renners, eigen dashboard. Dit is de "regisseur van de renner".
- **`club`**: de minste rechten. Alleen renners binnen toegewezen clubgroepen, geen volledige toegang tot privégegevens, vooral groepsprogramma's plannen, algemene voortgang zien, geen toegang buiten de eigen club/groepen, rechten ingesteld door de clubbeheerder én toestemming van de renner. Dit is de "regisseur van de training", niet van de renner specifiek.
- **`team`**: zit ertussenin. Intensieve begeleiding van toegewezen renners, toegang beperkt tot het specifieke team/seizoen, meer individuele rechten dan een clubtrainer, geen toegang buiten het teamverband.

**Belangrijk:** één persoon kan meerdere `access_context`-waarden tegelijk hebben (bijvoorbeeld tegelijk clubtrainer én zzp'er, of clubtrainer én teamtrainer). Rechten worden daarom nooit per trainer-account als geheel toegekend, maar per **combinatie van trainer + renner + toegangscontext**. Een trainer die ook zzp'er is, mag zijn volledige zzp-rechten nooit laten "lekken" naar zijn clubrenners, en andersom.

### Clubhiërarchie (drie lagen, met vrije stapeling)

1. **Beheerder** — een clubbestuurslid (penningmeester, voorzitter, hoofd trainingen, etc.); beheert het abonnement en de club-account.
2. **Hoofdtrainer** — plant en beheert de trainers binnen de club.
3. **Trainers** — één of meer, voeren de training uit.

Eén persoon kan meerdere lagen tegelijk bekleden (bijvoorbeeld hoofdtrainer die ook voorzitter is).

### Teamstructuur (plat, geen bestuurslaag)

Een team heeft **geen** drielaagse bestuursstructuur. Wel precies **één lichte beheerder** (kan iedereen binnen het team zijn, geen bestuursfunctie), naast een platte staf-groep zonder onderlinge hiërarchie: **trainer** (één of meer, elk gekoppeld aan verschillende renners binnen hetzelfde team), **ploegleider**, **mechanieker**, **diëtist**.

### Externe coach — geen rol, alleen een herkomstlabel

Een externe coach die niet zelf in Sparki komt, krijgt **geen account en geen rol**. De renner doet alles zelf: hij uploadt het trainingsplan dat hij van zijn externe coach heeft gekregen. Dit wordt in het databronmodel behandeld als `IMPORTED` (uit het bestaande 6-delige herkomstsysteem: MEASURED/IMPORTED/SELF_REPORTED/DERIVED/AI_INTERPRETED/UNKNOWN), met een extra label dat de herkomst "externe coach, niet via Sparki-trainer" markeert. Er is geen apart rechtenmodel voor de externe coach nodig — hij bestaat simpelweg niet als actor in het systeem.

### AI-trainer

Altijd aanwezig als achtergrondlaag. Terughoudend en adviserend zolang er een menselijke trainer (welke `access_context` dan ook) actief is — bemoeit zich niet met diens trainingskeuzes, behalve bij expliciete veiligheidskwesties, waar hij nadrukkelijker mag zijn. Extra behoedzaam bij een `IMPORTED` extern plan, aangezien de herkomst niet door Sparki zelf is opgesteld.

### Minderjarigen

De bestaande CYD-regels (progressieve geboortedatumverificatie, verplichte ouder-kind-koppeling voor autoriteit, locatietoestemming stuurt altijd zichtbaarheid, toestemming vervalt bij 18, volledige 16-17-jarige-toegangslog) gelden **uniform over alle drie de toegangscontexten** — dus evengoed bij een zzp- of teamtrainer als bij een clubtrainer. Dit is geen nieuwe regel maar een expliciete bevestiging dat de bestaande bescherming niet alleen voor de clubcontext geldt.

## Wat je moet opleveren

Eén sectie in `docs/PRODUCT_PROMISES/SPARKI_PROMISE_CALIBRATION.yaml`, met daarin per onderwerp binnen dit hoofdstuk de structuur hieronder ingevuld.

## Verplichte structuur per onderwerp

```yaml
id: CLUB_<ONDERWERP>_001
module: Club, coachorganisatie en ploegomgeving
subject: ""
status: needs_calibration

current_state:
  technical_status: implemented
  source_snapshot: <datum van de code die je hebt gelezen>
  evidence_status: ""
  practice_status: ""
  known_limitations: []

proposed_promise:
  text: ""
  proposed_by: replit
  rationale: ""
  rene_approved: false

role_model:
  role: trainer
  access_contexts: [independent, club, team]     # één persoon kan meerdere tegelijk hebben
  scoping: per_trainer_athlete_context           # rechten NOOIT per trainer-account als geheel
  club_hierarchy:
    - beheerder      # bestuurslid, beheert abonnement/account
    - hoofdtrainer   # plant en beheert trainers
    - trainers       # 1 of meer, voeren uit
  team_structure:
    beheerder: any_team_member                   # geen bestuursfunctie, geen hiërarchie
    staff_peers: [trainer, ploegleider, mechanieker, dietist]   # plat, 1+ trainers mogelijk
  externe_coach:
    is_role: false
    provenance_tag: IMPORTED                      # bestaand 6-delig herkomstsysteem
    origin_label: "externe coach, niet via Sparki-trainer"
  multi_role_stacking: true                       # één persoon kan meerdere lagen/contexten tegelijk

external_intelligence:
  research_required: true
  candidate_sources:
    - name: ""
      coverage: ""
      actuality: ""
      license_status: ""
      limitations: []
      applicability: ""
  sources_in_use: []
  privacy_status: unknown
  missing_information: []

replit_definition:
  objective_quality_standard: ""
  recommended_default: ""
  technical_limits: []
  assumptions: []
  unknowns: []
  evidence_method: []

rene_calibration:
  questions: []          # ALLEEN productkeuzes die nog niet door dit document zijn beantwoord
  completed: false

acceptance_contract:
  hard_reject_rules:
    - rule: ""
      rule_type: ""                     # hard_blockage | soft_tolerance | unverifiable
      measurement_level: ""             # per_trainer_athlete_context | per_actie | per_sessie | aggregaat_over_geheel
      aggregate_justification: ""
      counterexamples:
        - case: ""
          proof_stage: designed
          proof_method: ""
          proof_result: not_yet_tested
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

## Verplichte harde regels die in dit hoofdstuk minimaal moeten terugkomen

Elk van de volgende moet als een eigen `hard_reject_rule` met `rule_type: hard_blockage` worden opgenomen — deze zijn niet onderhandelbaar en geen productkeuze meer:

1. Een clubtrainer mag nooit privégezondheids-, hersteldata of individuele persoonlijke doelen van een renner zien zonder diens aparte, expliciete toestemming — ongeacht hoe goed de club het "over het algemeen" geregeld heeft.
2. Rechten van een trainer die meerdere `access_contexts` combineert, mogen nooit tussen contexten lekken — de rechten die gelden voor zijn zzp-renners mogen nooit toegepast worden op zijn clubrenners, en omgekeerd.
3. Bij een minderjarige renner gelden de bestaande CYD-regels (ouder-koppeling, toestemming, toegangslog) onverkort, ongeacht of de trainer via club, team of zelfstandig toegang heeft.
4. Een externe coach krijgt nooit alsnog impliciet een account of rol toegekend — data van een extern plan blijft altijd `IMPORTED` met het herkomstlabel, nooit gepromoveerd tot een trainer-relatie.

## Wat je zelf moet bepalen (Replit)

- technische haalbaarheid van het per-trainer-athlete-context rechtenmodel binnen de bestaande architectuur (hergebruik bestaande rollen-/rechtensystemen waar mogelijk, met name de al bestaande clubtrainer/hoofdtrainer/mechanieker/clubbeheerder/ploegleider-rolinfrastructuur uit eerdere sessies);
- welke bestaande databronnen/API's relevant zijn voor het herkomstlabel-systeem (IMPORTED-uitbreiding);
- objectief meetbare afbakening tussen "club"- en "team"-rechtenprofiel waar dat nog technisch onduidelijk is;
- benodigde automatische tests voor het nooit-lekken-tussen-contexten-principe;
- onzekerheden en resterende technische risico's.

## Wat je NIET zelf mag bepalen (dit leg je aan René voor, als productkeuze)

- exacte inhoud van "algemene voortgang" die een clubtrainer wel mag zien (waar precies de grens ligt tussen groepsniveau en individueel niveau);
- welke concrete velden onder "gezondheids- en hersteldata" vallen die alleen met aparte toestemming zichtbaar zijn;
- of een teamtrainer specifieke individuele trainingsdata mag aanpassen zonder tussenkomst van de ploegleider;
- gewenst gedrag van de AI-trainer bij een `IMPORTED` extern plan dat een veiligheidsrisico lijkt te bevatten.

## Wat je NIET mag doen in deze opdracht

- geen UI wijzigen;
- geen productcode wijzigen;
- geen andere modules of hoofdstukken behandelen dan hierboven genoemd;
- geen eigen rolmodel verzinnen dat afwijkt van wat hierboven is vastgelegd — dit model is door René bepaald, niet ter discussie;
- geen `rule_type: hard_blockage` verzwakken tot `soft_tolerance`, met name niet voor de vier verplichte regels hierboven;
- geen `proof_stage: executed` of `proof_result: rejected_as_expected` invullen zonder dat er daadwerkelijk een test is gedraaid.

## Resultaat en stop

Lever alleen het ingevulde YAML-deel voor dit hoofdstuk op. Stop daarna expliciet en wacht op review/goedkeuring van René (en eventueel Dylan) voordat een volgend hoofdstuk of enige andere module wordt opgepakt.
