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

**Uitzondering voor de club-context:** een clubtrainer is binnen Sparki nadrukkelijk **geen individuele trainer** — hij is regisseur van de clubtraining, niet van de renner. Op het individuele niveau dat de clubtrainer niet afdekt, neemt de AI-trainer die rol wél over: hij begeleidt de renner individueel rond en aanvullend op de clubtrainingen (bijvoorbeeld op andere trainingsmomenten dan de vaste clubtraining). Bij zzp- en teamtrainer blijft de AI-trainer terughoudend, omdat daar al een mens het individuele niveau intensief afdekt.

### AI-assistentie bij sessie-logistiek (materiaal, weer, drinken, wedstrijd)

**Vaste routes in de bibliotheek:** de trainer gebruikt de bestaande routing-engine om routes te maken en op te slaan in een club-/teamroutebibliotheek, herbruikbaar voor toekomstige sessies — geen nieuw systeem, hergebruik van de bestaande routegenerator en route-bibliotheekcomponenten.

Dit is een aparte, beperktere AI-functie dan de individuele-coaching-AI-rol hierboven — sessie-logistiek (materiaal in orde, wat te doen bij een weersverwachting, drinken meenemen, tips bij een aankomende wedstrijd) blijft namelijk onderdeel van wat de trainer als "regisseur van de training" al doet, in alle drie de `access_contexts`.

**AI stelt uitsluitend een concept op** (gebaseerd op de `veiligheidsvoorwaarden`/`materiaal`-velden van het trainingselement plus actuele weersgegevens) — **de trainer beoordeelt en verstuurt dit altijd zelf.** AI verstuurt nooit automatisch, ook niet voor routinematige berichten.

### Minderjarigen

De bestaande CYD-regels (progressieve geboortedatumverificatie, verplichte ouder-kind-koppeling voor autoriteit, locatietoestemming stuurt altijd zichtbaarheid, toestemming vervalt bij 18, volledige 16-17-jarige-toegangslog) gelden **uniform over alle drie de toegangscontexten** — dus evengoed bij een zzp- of teamtrainer als bij een clubtrainer. Dit is geen nieuwe regel maar een expliciete bevestiging dat de bestaande bescherming niet alleen voor de clubcontext geldt.

**Uitzondering, bewust strenger dan de progressieve leeftijdsopbouw elders in CYD:** goedkeuring om gezondheids-/hersteldata te delen met een team- of zzp-trainer komt bij een minderjarige renner **altijd van de ouder/verzorger**, ongeacht de leeftijd van het kind — dus ook bij 16- of 17-jarigen die voor andere CYD-permissies (zoals locatiedeling) al meer eigen zeggenschap hebben. Dit is een bewust, apart vastgelegd onderscheid, geen inconsistentie: gezondheidsdata krijgt hier een striktere regel dan de rest van het progressieve model.

**Ouder-zichtbaarheid (Spond-patroon):** een ouder van een minderjarige renner heeft volledig zicht op de communicatie tussen trainer en kind, ongeacht `access_context` van de trainer.

## Trainingsinhoud-model (KNWU-gefundeerd, niet blanco beginnen)

Dit is een tweede, even belangrijk deel van het productmodel — de functionele wereld van de trainer zelf. Ook dit is al door René vastgesteld, niet ter discussie. **Belangrijke productkeuze:** de KNWU beschikt over protocollen (o.a. veilig sporten) en over trainingsplannen/opleidingsinhoud. Deze externe vakinhoud moet als bron worden onderzocht en waar juridisch en technisch mogelijk verwerkt worden — de bibliotheek wordt niet blanco opgebouwd.

### 1. Trainingselement

Herkomst kan zijn: KNWU-protocol/trainingsplan, andere erkende externe vakbron, Sparki-standaardbibliotheek, clubbibliotheek, of een persoonlijk element van een trainer. Elk element bevat minimaal: naam, doel, doelgroep/leeftijdscategorie, ervaringsniveau, discipline, duur, intensiteit, materiaal, veiligheidsvoorwaarden, contra-indicaties, bron en bronversie, aanpasbare en niet-aanpasbare onderdelen.

**Hard:** een veiligheidsregel uit een protocol mag nooit stilzwijgend door een trainer worden verwijderd.

### 2. Trainingssessie

Een sessie combineert elementen en bevat: warming-up, kern, herstel/rust, cooling-down, doel, totale duur, belasting, benodigde begeleiding, materiaal, locatie en eventueel route, veiligheidscontrole, alternatieven bij weer/ondergrond/groepsniveau. Een trainer kan een bestaand plan gebruiken, kopiëren en aanpassen — maar Sparki bewaart altijd: oorspronkelijke bron, versie, aangebrachte wijzigingen, wie de wijziging deed, en welke veiligheidsvoorwaarden nog gelden (audit-trail, geen overschrijving).

### 3. Categorisering (eerst onderzoeken, niet zelf verzinnen)

Minimaal te onderzoeken: leeftijd, ervaring, fietsdiscipline, trainingsdoel, groepsgrootte, individuele of groepstraining, recreatief of prestatiegericht, indoor/outdoor, veiligheid en risico, benodigde materialen, belastbaarheid. Begin niet met eigen categorieën voordat de bestaande KNWU-indelingen en andere erkende bronnen zijn onderzocht.

### 4. Veilig sporten — protocollen worden uitvoerbare regels, geen PDF-tekst

Voorbeelden van wat uitvoerbaar moet worden: verplichte controle vóór plannen, waarschuwing of blokkade bij ongeschikte leeftijd/ervaring, minimale begeleidersbezetting, materiaal- en locatievoorwaarden, weers-/omgevingsgrenzen, nood-/incidentinformatie, aangepaste variant wanneer de standaardtraining niet veilig uitvoerbaar is.

**Onderscheid vier ernstniveaus, niet drie:** `hard_blockage` (blokkeert plannen volledig) | `waarschuwing` | `aanbeveling` | `informatie voor de trainer`. Dit is een apart veld `guidance_severity` op het trainingselement/protocol-niveau — te onderscheiden van het bestaande `rule_type` op `acceptance_contract.hard_reject_rules` (dat blijft `hard_blockage | soft_tolerance | unverifiable` voor acceptatiebeslissingen). Alleen een `guidance_severity: hard_blockage` wordt ook een `hard_reject_rule` met `rule_type: hard_blockage`; `waarschuwing`/`aanbeveling`/`informatie` zijn adviserende UI-lagen, geen acceptatieregels. Bevestig dit onderscheid expliciet in het datamodel, verzin geen alternatieve indeling.

### 5. Doelen en voortgang

Leg per sessie vast: welk trainingsdoel ieder element ondersteunt, wat vooraf verwacht wordt, wat werkelijk is uitgevoerd, aanwezigheid, eventuele aanpassing tijdens de training, waargenomen voortgang. **Nooit** een medische of prestatieclaim zonder bewijs.

### 6. Aanwezigheid

Ondersteun minimaal: aanwezig, afwezig, afgemeld, gedeeltelijk meegedaan, aangepast programma gevolgd. Reden is alleen zichtbaar binnen passende privacyrechten (zelfde consent-scoping als de rest van dit hoofdstuk).

### Onderzoek eerst (verplicht vóór productuitwerking van dit deel)

Onderzoek: welke KNWU-protocollen en trainingsplannen werkelijk beschikbaar zijn; actuele versies; doelgroep en categorisering; licentie- en gebruiksrechten; of inhoud mag worden overgenomen, gekoppeld, of alleen naar verwezen; welke delen machineleesbaar gemaakt kunnen worden; welke veiligheidsregels als harde acceptatieregels moeten gelden. **Verzin geen KNWU-inhoud en claim niet dat iets geïmplementeerd mag worden voordat bron, actualiteit en licentie zijn bevestigd.**

Voor dit deel lever je specifiek op: inventarisatie van bestaande Sparki-code, externe-bronnenonderzoek, voorgesteld datamodel, productbelofte, acceptatiecontract, open productvragen aan René — **geen productcode**.

## Trainer toevoegen vanuit de clubomgeving (concrete flow)

**Wie mag dit:** hoofdtrainer of beheerder — niet elke trainer zelf.

**Uitnodiging:** één uitnodigingslink/token (geen apart systeem per kanaal), te versturen via e-mail, WhatsApp, of copy-paste, naar keuze van de uitnodigende hoofdtrainer/beheerder.

**Acceptatie:** trainer klikt de link — bestaand account krijgt de extra `access_context: club` voor déze club; geen account → nieuw account aanmaken. **Wordt direct actief na acceptatie**, geen aparte goedkeuringsstap door hoofdtrainer/beheerder nodig.

**VOG-koppeling aan het clubabonnement (belangrijk, bepaalt de volgorde):** bij het afsluiten van het clubabonnement wordt de VOG-verplichting expliciet aan de beheerder voorgelegd en moet hij deze accepteren. Ná die acceptatie geldt: een trainer wordt direct actief als account, maar kan pas daadwerkelijk **aan renners gekoppeld worden** zodra zijn `vog_status: registered` is — dit geldt voor alle renners, niet alleen minderjarigen, en is dus strenger dan de eerdere aanname (die alleen minderjarigen als drempel had). Dit is geen verrassing achteraf: de beheerder heeft dit al bij abonnementsafsluiting geaccepteerd.

**Onboardingvragen aan de trainer (voorstel, geen vaststaand feit — Replit onderzoekt haalbaarheid, René beslist definitief):**
- naam en contactgegevens;
- relevante KNWU-trainersopleiding/niveau, indien aanwezig;
- VOG-status (aanwezig, of traject starten via de eerder beschreven procedure);
- discipline(s);
- of hij al elders in Sparki als trainer actief is (relevant voor multi-context-scoping).

## KNWU-trainerdiploma (club-configureerbaar, geen Sparki-brede eis)

Geen harde, Sparki-brede eis. In plaats daarvan: de club bepaalt zelf (via clubinstellingen, vergelijkbaar met een AV-besluit) of een bepaald KNWU-trainersniveau vereist is voor bepaalde categorieën/disciplines — Sparki toont het diploma-/niveauveld altijd informatief, en biedt de club de mogelijkheid om er zelf een minimumeis aan te koppelen, maar schrijft dat nooit zelf voor.

## Documenten & beleid (club schrijft zelf, Sparki toont alleen)

Anders dan de trainingselementen-bibliotheek (die wél met KNWU-content geseed wordt): een sectie in de clubomgeving voor gedragscode renners, gedragscode ouders/verzorgers, vertrouwenscontactpersoon (naam+contact, zichtbaar voor iedereen), en clubmeldingen/nieuws — maar hier schrijft de **club zelf** de inhoud. Sparki biedt geen KNWU/NOC*NSF-sjablonen aan bij deze documenten, alleen een plek om ze op te slaan en te tonen. Geen content-generatie of voorinvulling door Sparki voor dit onderdeel.

## Renner toevoegen aan een club (concrete flow)

**Wie mag uitnodigen:** hoofdtrainer, trainer (voor eigen groep), of beheerder — bredere toegang dan bij trainer-uitnodigingen, want een renner uitnodigen geeft geen extra bevoegdheden.

**Hoe:** hetzelfde uitnodigingslink-mechanisme als bij de trainer (één systeem, hergebruik).

**Acceptatie:** bestaand account → clublidmaatschap wordt gekoppeld; geen account → renner doorloopt de bestaande Sparki-onboarding (niveau, doelen, etc. — niet opnieuw bouwen).

**Minderjarig:** de geboortedatum ligt altijd al vast in de ledenadministratie (en een trainer is vaak al aan een specifieke leeftijdsgroep gekoppeld) — het systeem weet dus altijd vooraf of een uit te nodigen renner minderjarig is, dit is geen los te onderzoeken randgeval. Bij een minderjarige renner gaat de uitnodiging niet naar het kind, maar direct naar de **ouder/verzorger** (uitgenodigd door dezelfde hoofdtrainer/trainer/beheerder als bij een gewone renner) — de ouder accepteert, maakt het profiel van het kind aan, en koppelt zichzelf meteen als ouder. Dit triggert de bestaande CYD-ouder-koppelingsflow als onderdeel van deze aanmaakstap, niet als losse vervolgstap achteraf.

**Abonnement:** het minimale Go-abonnement wordt **direct bij het accepteren van de uitnodiging** afgedwongen — de renner moet meteen kiezen/upgraden, niet pas later wanneer hij de clubtrainer-functionaliteit daadwerkelijk wil gebruiken.

**Gedragscode:** alleen zichtbaar bij toetreding, geen actieve acceptatiestap — geen extra wrijving in de onboarding.

## Referentiekader: bestaande vergelijkbare apps (Spond, Cyql)

Sparki wil **geen ledenadministratie-app** worden (dat blijft het terrein van AllUnited/Sportlink/Spond/Cyql, per de bestaande "sync waar kan, bouw waar onderscheidend"-strategie). Spond en Cyql bieden al goed: planning van (terugkerende) trainingen/ritten, zelf-aanmelden/afmelden met RSVP, groepscommunicatie, en bij Cyql een GPX-bibliotheek. Bouw de basis van planning/aanwezigheid/communicatie eenvoudig en degelijk, vergelijkbaar met wat deze apps al bieden — geen eigen concurrerend feature-uitbouw daar. De echte diepgang en het onderscheid van Sparki zitten in het trainingsinhoud-model hierboven (KNWU-gefundeerde bibliotheek, doelen/voortgang, veiligheidsregels) en de routing-kwaliteit — geen van beide referentie-apps heeft een coaching-laag of vergelijkbare route-blokkadedetectie.

Nuttig hergebruikbaar patroon van Spond: ouders beheren het account van hun minderjarige kind met **volledig zicht op de communicatie tussen coach en kind** — overweeg dit patroon voor de CYD-ouderrechten in plaats van iets nieuws te verzinnen.

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

training_content_model:
  trainingselement:
    origin: knwu_protocol | erkende_externe_bron | sparki_standaard | clubbibliotheek | persoonlijk
    naam: ""
    doel: ""
    doelgroep_leeftijdscategorie: ""              # actuele KNWU-indeling, niet zelfverzonnen
    ervaringsniveau: ""
    discipline: ""
    duur: ""
    intensiteit: ""
    materiaal: []
    veiligheidsvoorwaarden: []
    contra_indicaties: []
    bron: ""
    bronversie: ""
    aanpasbare_onderdelen: []
    niet_aanpasbare_onderdelen: []                # veiligheidsregels: nooit stilzwijgend verwijderbaar
  trainingssessie:
    opbouw: [warming_up, kern, herstel_rust, cooling_down]
    doel: ""
    totale_duur: ""
    belasting: ""
    benodigde_begeleiding: ""
    materiaal: []
    locatie_en_route: ""
    veiligheidscontrole: ""
    alternatieven: []                             # bij weer/ondergrond/groepsniveau
    audit_trail:
      oorspronkelijke_bron: ""
      versie: ""
      wijzigingen: []
      gewijzigd_door: ""
      nog_geldende_veiligheidsvoorwaarden: []
  categorisering_assen: [leeftijd, ervaring, discipline, trainingsdoel, groepsgrootte, individueel_of_groep, recreatief_of_prestatie, indoor_outdoor, veiligheid_risico, materiaal, belastbaarheid]
  veilig_sporten_regel:
    guidance_severity: ""                         # hard_blockage | waarschuwing | aanbeveling | informatie — apart van acceptance_contract.rule_type
    only_hard_blockage_becomes_hard_reject_rule: true
  doelen_en_voortgang:
    element_ondersteunt_doel: ""
    vooraf_verwacht: ""
    werkelijk_uitgevoerd: ""
    aanpassing_tijdens_training: ""
    waargenomen_voortgang: ""
    medische_of_prestatieclaim_zonder_bewijs: never
  aanwezigheid:
    status: aanwezig | afwezig | afgemeld | gedeeltelijk_meegedaan | aangepast_programma
    reden_zichtbaarheid: per_consent_scope         # zelfde scoping als rest van dit hoofdstuk

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

### Trainingselementen-bibliotheek (niet blanco beginnen)

De bibliotheek met herbruikbare trainingselementen wordt geseed met KNWU's bestaande trainingsdoelen, jaarplannen en leeftijds-/categorie-indeling (zie "Verplichte externe bron: KNWU" hieronder) — een clubtrainer begint niet met een lege bibliotheek die hij zelf van nul moet vullen.

## Verplichte harde regels die in dit hoofdstuk minimaal moeten terugkomen

Elk van de volgende moet als een eigen `hard_reject_rule` met `rule_type: hard_blockage` worden opgenomen — deze zijn niet onderhandelbaar en geen productkeuze meer:

1. Een clubtrainer mag nooit privégezondheids-, hersteldata of individuele persoonlijke doelen van een renner zien zonder diens aparte, expliciete toestemming — ongeacht hoe goed de club het "over het algemeen" geregeld heeft.
2. Rechten van een trainer die meerdere `access_contexts` combineert, mogen nooit tussen contexten lekken — de rechten die gelden voor zijn zzp-renners mogen nooit toegepast worden op zijn clubrenners, en omgekeerd.
3. Bij een minderjarige renner gelden de bestaande CYD-regels (ouder-koppeling, toestemming, toegangslog) onverkort, ongeacht of de trainer via club, team of zelfstandig toegang heeft.
4. Een externe coach krijgt nooit alsnog impliciet een account of rol toegekend — data van een extern plan blijft altijd `IMPORTED` met het herkomstlabel, nooit gepromoveerd tot een trainer-relatie.
5. **(KNWU veilig sporten)** Een trainer zonder geregistreerde, geldige VOG (verklaring omtrent gedrag) kan nooit aan renners gekoppeld worden — voor alle renners, in alle drie de toegangscontexten (club, team, zelfstandig), ongeacht wie de koppeling probeert te maken. De trainer-account zelf mag wel direct actief worden na acceptatie van de uitnodiging; alleen de koppeling aan renners wacht op `vog_status: registered`. Bij club accepteert de beheerder deze eis expliciet bij het afsluiten van het clubabonnement.
6. **(KNWU veilig sporten)** Elke club en elk team moet een zichtbaar meldpad naar een vertrouwenscontactpersoon hebben; een club/team-omgeving zonder dit meldpad mag niet als volledig ingericht gelden.
7. Een veiligheidsvoorwaarde uit een KNWU-protocol (of andere erkende bron) op een trainingselement mag nooit stilzwijgend door een trainer worden verwijderd of aangepast — dit geldt voor de `niet_aanpasbare_onderdelen` van elk element.
8. Bij een minderjarige renner komt goedkeuring om gezondheids-/hersteldata te delen met een team- of zzp-trainer altijd van de ouder/verzorger, ongeacht de leeftijd van het kind — dit wijkt bewust af van de progressieve leeftijdsopbouw die voor andere CYD-permissies (zoals locatiedeling) geldt.

## Verplichte externe bron: KNWU

Naast de gebruikelijke bronvereisten (coverage/actuality/license_status/limitations/applicability per bron) geldt voor dit hoofdstuk specifiek:

- **KNWU-veiligsportenbeleid** (gedragscode, VOG-regeling, vertrouwenscontactpersoon, Centrum Veilige Sport Nederland) is verplicht te onderzoeken en te verwerken in de hard_reject_rules 5 en 6 hierboven — niet zelf een lichtere versie verzinnen.
- **KNWU-leeftijdscategorieën en jaarplannen** (recent gewijzigd: U6–U13 jeugdstructuur vanaf 2026, U15/U17/17+, Nieuwelingen, Junioren/U19, Beloften, Elite, Masters H3–H6) zijn de basis voor de trainingselementen-bibliotheek — deze wordt **niet blanco** opgebouwd. Elk trainingselement in de bibliotheek moet een leeftijd-/categorie-/ervaringsniveau-tag krijgen die aansluit bij de actuele KNWU-indeling, niet bij een zelfverzonnen indeling. Let op: de KNWU-structuur is recent gewijzigd (2025-2026) — gebruik de actuele indeling, niet een verouderde versie.

## VOG-aanvraagondersteuning (concreet, met officiële links)

Sparki verwerkt de VOG-screening zelf niet — dit is en blijft een overheidsproces via Justis met DigiD/eHerkenning. Sparki ondersteunt wél door op het juiste moment naar de juiste officiële bronnen door te verwijzen, en door bij te houden of een trainer een VOG geregistreerd heeft (zie hard_reject_rule 5 hierboven).

**De echte procedure, in 5 stappen (te tonen aan een clubbeheerder/hoofdtrainer die nog geen VOG-traject heeft lopen):**

1. Club meldt zich aan bij de Regeling Gratis VOG: https://www.gratisvog.nl — vereist al een preventief beleid (gedragscode, aannamebeleid, vertrouwenscontactpersoon).
2. Bij goedkeuring vraagt de club eHerkenning aan (organisatie-equivalent van DigiD).
3. Club zet via Justis de VOG-aanvraag klaar voor de specifieke trainer: https://www.justis.nl/producten/vog
4. Trainer rondt de aanvraag zelf af met eigen DigiD.
5. Trainer overhandigt de ontvangen VOG aan de club; club controleert en registreert.

**Aanvullende officiële links om in de UI/help-tekst te verwerken:**
- Achtergrond van de regeling: https://www.justis.nl/justis/over-onze-producten/gratis-vogs-voor-sportverenigingen-via-nocnsf
- Hulp bij een afgewezen aanvraag of vragen: NOC*NSF, VOG@nocnsf.nl
- KNWU-specifieke veilig-sporten-informatie en vertrouwenscontactpersoon: https://www.knwu.nl/veiligsporten

**Wat dit voor het datamodel betekent:** toon de VOG-status, blokkade en passende officiële vervolgstappen proactief zodra iemand een trainer zonder `vog_status: registered` aan een renner probeert te koppelen, ongeacht leeftijd of `access_context`. De clubprocedure via Gratis VOG/Justis wordt alleen getoond wanneer de opdrachtgever een club is; voor team- en zelfstandige context onderzoekt Replit de toepasselijke officiële aanvraag- en registratieprocedure — neem niet aan dat de clubprocedure daar ook geldt.

## Wat je zelf moet bepalen (Replit)

- technische haalbaarheid van het per-trainer-athlete-context rechtenmodel binnen de bestaande architectuur (hergebruik bestaande rollen-/rechtensystemen waar mogelijk, met name de al bestaande clubtrainer/hoofdtrainer/mechanieker/clubbeheerder/ploegleider-rolinfrastructuur uit eerdere sessies);
- welke bestaande databronnen/API's relevant zijn voor het herkomstlabel-systeem (IMPORTED-uitbreiding);
- objectief meetbare afbakening tussen "club"- en "team"-rechtenprofiel waar dat nog technisch onduidelijk is;
- benodigde automatische tests voor het nooit-lekken-tussen-contexten-principe;
- onzekerheden en resterende technische risico's;
- technisch en juridisch verantwoord VOG-registratiemodel: wie registreert en controleert, welke metadata wordt bewaard, wie de status mag wijzigen, hoe verlopen/hercontrole werkt, en welke gegevens juist niet in Sparki opgeslagen mogen worden.

## Wat je NIET zelf mag bepalen (dit leg je aan René voor, als productkeuze)

- exacte inhoud van "algemene voortgang" die een clubtrainer wel mag zien (waar precies de grens ligt tussen groepsniveau en individueel niveau);
- welke concrete velden onder "gezondheids- en hersteldata" vallen die alleen met aparte toestemming zichtbaar zijn;
- of een teamtrainer specifieke individuele trainingsdata mag aanpassen zonder tussenkomst van de ploegleider;
- gewenst gedrag van de AI-trainer bij een `IMPORTED` extern plan dat een veiligheidsrisico lijkt te bevatten;
- welke concrete KNWU-protocollen/trainingsplannen daadwerkelijk overgenomen mogen worden (licentie/gebruiksrecht) — dit rapporteer je als onderzoeksresultaat, jij beslist niet zelf dat iets "wel mag";
- exacte grens tussen `waarschuwing`, `aanbeveling` en `informatie` binnen `guidance_severity` voor concrete veiligheidsgevallen die niet evident `hard_blockage` zijn;
- de definitieve geldigheidsduur, hercontrolefrequentie en vereiste screeningsprofielen voor VOG; rapporteer officiële kaders en leg productkeuzes aan René voor.

## Wat je NIET mag doen in deze opdracht

- geen UI wijzigen;
- geen productcode wijzigen;
- geen andere modules of hoofdstukken behandelen dan hierboven genoemd;
- geen eigen rolmodel verzinnen dat afwijkt van wat hierboven is vastgelegd — dit model is door René bepaald, niet ter discussie;
- geen `rule_type: hard_blockage` verzwakken tot `soft_tolerance`, met name niet voor de acht verplichte regels hierboven;
- geen `proof_stage: executed` of `proof_result: rejected_as_expected` invullen zonder dat er daadwerkelijk een test is gedraaid.

## Resultaat en stop

Lever alleen het ingevulde YAML-deel voor dit hoofdstuk op. Stop daarna expliciet en wacht op review/goedkeuring van René (en eventueel Dylan) voordat een volgend hoofdstuk of enige andere module wordt opgepakt.
