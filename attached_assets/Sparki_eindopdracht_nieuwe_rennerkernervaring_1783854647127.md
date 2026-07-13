# Sparki — Eindopdracht nieuwe rennerkernervaring

Voer deze opdracht als één gesloten implementatietraject uit.

Stop niet na iedere interne fase voor beoordeling.
Vraag niet tussentijds om nieuwe opdrachten.
Voer intern wel tests en controles uit, maar ga daarna zelfstandig door.
Lever pas aan het einde één compleet en traceerbaar eindrapport op.

Onderbreek alleen bij:
- een veiligheids- of privacyrisico;
- ontbrekende toegang of secrets waardoor voortgang onmogelijk is;
- een destructieve datamigratie waarvoor expliciete toestemming nodig is.

Gebruik als leidende bronnen:
- `docs/product/FEATURE_INVENTORY.md` en `.csv`
- `docs/product/CURRENT_INFORMATION_ARCHITECTURE.md`
- `docs/product/RIDER_CORE_JOURNEY.md`
- `docs/product/DYLAN_VALUE_GAPS.md`
- `docs/product/FEATURE_CONSOLIDATION_MATRIX.md`
- `docs/product/AUDIT_UNCERTAINTIES.md`
- `SPARKI-STRATEGIE.md`
- het goedgekeurde ontwerp “de nieuwe kernervaring voor de renner”

## 0. Bestaand werk veilig overnemen

Inspecteer eerst de huidige working tree en de wijzigingen uit de vorige gedeeltelijke opdracht.

- Behoud correcte wijzigingen.
- Integreer gedeeltelijk werk.
- Dupliceer geen componenten.
- Herstel geen correct werk alleen om opnieuw te beginnen.
- Maak vóór verdere wijzigingen een checkpoint.

Zet de volledige nieuwe ervaring achter één tester-featureflag:

`rider_core_experience_v1`

De huidige productie-ervaring blijft als directe rollback beschikbaar.

## 1. Momentgestuurd Vandaag

Vervang de verzameling gelijkwaardige homekaarten door één centrale momenttoestand.

Ondersteun minimaal:

- `SAFETY`: veiligheids- of gezondheidssignaal;
- `ACTIVITY_PROCESSING`: nieuwe activiteit binnen, analyse bezig;
- `POST_RIDE`: analyse gereed;
- `PLAN_CHANGE`: openstaand schemagevolg;
- `RACE_PRE`: wedstrijddag vóór ontvangst van de wedstrijdactiviteit;
- `PRE_TRAINING`: training gepland en nog niet uitgevoerd;
- `RECOVERY`: rust- of hersteldag;
- `BALANCE`: geen urgent of nieuw moment.

Prioriteit:

1. Veiligheid/gezondheid.
2. Nieuwe activiteit: verwerken of analyse gereed.
3. Schemaprobleem of aanpassingsvoorstel.
4. Wedstrijdvoorbereiding zolang nog geen nieuwe raceactiviteit is ontvangen.
5. Training van vandaag.
6. Herstel.
7. Balans.

Belangrijk:
Een verse wedstrijdactiviteit moet na de race het `RACE_PRE`-blok verdringen.

Vandaag toont bovenaan:

- precies één primaire boodschap;
- precies één primaire actie;
- een altijd zichtbare synchronisatieregel.

Onder het momentblok:

- check-in als compacte chip, nooit als eerste blok;
- maximaal één niet-urgente nudge;
- maximaal één ontwikkelteaser;
- weer alleen bij training of wedstrijd;
- leskaart alleen bij herstel of balans.

## 2. Synchronisatie altijd zichtbaar

De synchronisatieregel mag nooit verdwijnen doordat er geen verse rit is.

Toon minimaal:

- laatste ontvangen activiteit;
- bron;
- datum en tijd;
- status: wachtend, verwerken, gereed, mislukt of geen nieuwe activiteit;
- herstelactie bij een verbroken koppeling.

Voorbeelden:

- “Laatste rit ontvangen: vandaag 17:42 via Strava.”
- “Nog geen nieuwe activiteit ontvangen. Laatste synchronisatie: 11:18.”
- “Je activiteit is binnen. De analyse wordt opgebouwd.”
- “Synchronisatie mislukt. Controleer je Strava-koppeling.”

Geen eindeloze spinner en geen verzonnen synchronisatiestatus.

## 3. Eén volledig rit-verhaal

Breid de bestaande sessiedetailweergave uit tot één doorlopende coachingflow:

1. Wat je deed.
2. Wat het betekende.
3. Wat het verandert.
4. Wat bevestigd is.

### Hoofdstuk 1 — Wat je deed
- echte activiteitsdata;
- niveau-afhankelijke presentatie;
- geen verzonnen waarden.

### Hoofdstuk 2 — Wat het betekende
- voorspeld versus werkelijk, uitsluitend wanneer vóór de rit werkelijk een voorspelling is opgeslagen;
- historische vergelijking;
- bewijs en onzekerheid;
- bij onvoldoende data een eerlijke lege staat.

### Hoofdstuk 3 — Wat het verandert
Toon inline één van:

- aanpassing voorgesteld;
- geen aanpassing nodig;
- nog niet te bepalen.

Maak de oorzaak expliciet:

- “Op basis van deze rit verandert donderdag…”
- “Je schema blijft staan — deze rit paste bij het plan.”

Gebruik de bestaande feedback-adjust-machinerie. Geen nieuwe AI-engine.

### Hoofdstuk 4 — Bevestigd
Na acceptatie:

- exacte gewijzigde training;
- oude en nieuwe versie;
- bevestiging dat het schema is aangepast;
- directe link naar Trainen.

Voeg analysefeedback toe:

- nuttig;
- al bekend;
- niet relevant;
- onjuist.

“Onjuist” moet als kwaliteitsincident worden geregistreerd.

Chat vanuit het ritverhaal bevestigt zichtbaar:

“Deze vraag gaat over je rit van vandaag.”

## 4. Wedstrijddag Dylan — live scenario

Controleer of Dylan op 12 juli 2026 een wedstrijdrecord heeft.

Wanneer dat ontbreekt, voeg alleen voor zijn testeraccount toe:

- naam: `46e Wielerronde van Obdam`;
- type: criterium/race;
- datum: `12 juli 2026`;
- start: `15:30`;
- afstand: `90 km`;
- rondes: `56`;
- tijdzone: `Europe/Amsterdam`.

Verzin geen aanvullende wedstrijd- of activiteitsgegevens.

Maak geen demo-activiteit en plaats nooit een fictieve rit op zijn account.

De verwachte toestanden:

- vóór de wedstrijd: `RACE_PRE`;
- na ontvangst van de activiteit: `ACTIVITY_PROCESSING`;
- na analyse: `POST_RIDE`.

Gebruik het bestaande race-evaluatie-endpoint als dat inhoudelijk bruikbaar is en geef het een echte UI-ingang.

Log voor dit scenario:

- wat Dylan vóór de race kon zien;
- wanneer de activiteit werd ontvangen;
- verwerkingstijd;
- uiteindelijke analyse;
- eventuele ontbrekende data;
- welk schemagevolg werd getoond.

Controleer Dylans Strava-koppeling. Wanneer OAuth door Dylan zelf moet worden hersteld, toon één duidelijke herstelactie en gebruik echte FIT/GPX-import als fallback. Nooit demo-data gebruiken.

## 5. Eén ontwikkelbestemming

Maak `Jij` de centrale bestemming voor duurzame ontwikkeling.

Orden de pagina rond:

1. Wie ben je als renner?
2. Word je beter?
3. Wat is nu je grootste hefboom?

Integreer daar:

- Core-profiel;
- ontwikkelkompas;
- patronen;
- evolutie;
- relevante trendduiding;
- relevante inhoud uit `/lab`;
- mentale-veerkracht-kaart indien de data betrouwbaar is.

Voer uit:

- `/lab` redirect naar `/you`;
- home toont alleen een actuele teaser;
- `/train` houdt trainingsgrafieken, maar verwijst voor duiding naar Jij;
- instellingen, privacy en koppelingen blijven bereikbaar.

## 6. Adaptieve inhoudsdiepte

Ondersteun drie presentatieniveaus:

- Begrijpen;
- Duiden;
- Doorgronden.

Dylan krijgt `Doorgronden`:

- cijfers voorop;
- vergelijking met historische sessies;
- steekproefomvang waar relevant;
- expliciete onzekerheid;
- uitzonderingen en modelafwijkingen;
- geen generieke basisuitleg als eerste laag.

Leid een startniveau voorzichtig af uit profiel en historie, maar:

- bevestig het één keer;
- maak het handmatig instelbaar;
- schakel nooit stil terug;
- gebruik “al bekend” als signaal voor diepere toekomstige uitleg.

## 7. Navigatie en aandacht

Onderbalk:

- Vandaag;
- Activiteiten;
- Trainen;
- Jij;
- Ontdekken.

Voer daarnaast uit:

- Vandaag is de primaire bestemming voor de actuele training;
- Trainen opent op schema/weekcontext;
- Ontdekken bundelt nieuws, kennis, Intel en optionele Wereld-content;
- Samen en Wereld verdwijnen als permanente headerknoppen;
- routes `/samen` en `/wereld` blijven voor deep-links bestaan;
- wedstrijden krijgen een vindbare ingang onder Trainen;
- header behoudt chat, notificaties, feedback en rolbeheer.

Gebruik overal één consistente Nederlandse terminologie.

## 8. Technische en veiligheidseisen

- Geen nieuwe AI-engine.
- Hergebruik bestaande engines en endpoints.
- Geen achteraf geconstrueerde voorspellingen.
- Geen fictieve modelnauwkeurigheid.
- Geen destructieve migraties zonder toestemming.
- Geen wijziging aan privacygrenzen voor coach of ouder.
- Geen nieuwe billing, betaalmuur of engagementmechaniek.
- Geen demo-data in echte accounts, behalve het expliciet toegestane minimale wedstrijdrecord.
- Oude ervaring blijft via featureflag beschikbaar.
- Alle nieuwe toestanden krijgen laad-, lege-, fout- en herstelstaten.
- Mobiele weergave is leidend.

## 9. Tests — intern uitvoeren, niet tussentijds stoppen

Voeg minimaal tests toe voor:

- sync-regel zonder verse activiteit;
- activiteit ontvangen en analyse bezig;
- analyse gereed zonder schemagevolg;
- analyse gereed met aanpassingsvoorstel;
- analyse met onvoldoende sensordata;
- synchronisatiefout;
- wedstrijd vóór de start;
- wedstrijdactiviteit verdringt `RACE_PRE`;
- veiligheidsmelding verdringt alle andere momenten;
- check-in staat nooit boven het momentblok;
- maximaal één niet-urgente nudge;
- voorspeld-versus-werkelijk alleen met echte vooraf opgeslagen voorspelling;
- `/lab` redirect;
- adaptief kennisniveau;
- rollback via featureflag;
- coach-, ouder- en accountisolatie blijven intact.

Voer daarna alle bestaande relevante workflows uit.

Eindvoorwaarde:

- nul falende tests;
- geen workflow die blijft herstarten;
- geen resterende `validation running`;
- exacte lijst van geslaagde suites in het eindrapport.

Wanneer een test flaky is:
zoek de oorzaak en herstel deze. Blijf hem niet eindeloos opnieuw starten.

## 10. Eindoplevering — één rapport

Lever pas op wanneer het volledige pakket gereed is.

Het eindrapport bevat:

1. Samenvatting van wat is gebouwd.
2. Lijst van gewijzigde bestanden.
3. Mapping ontwerpbesluit → implementatie.
4. Screenshots van:
   - Vandaag vóór training;
   - Vandaag zonder verse rit maar met sync-status;
   - activiteit wordt verwerkt;
   - `POST_RIDE`;
   - volledig ritverhaal;
   - inline schemagevolg;
   - Jij/ontwikkeling;
   - Dylans wedstrijddag.
5. Testresultaten met exacte aantallen.
6. Resultaat van de Dylan-wedstrijddagtest.
7. Bekende beperkingen en resterende onzekerheden.
8. Bevestiging dat de featureflag de oude ervaring herstelt.
9. Eén checkpoint waarmee de volledige wijziging kan worden teruggedraaid.

Werk zelfstandig door alle onderdelen heen en stop pas na deze volledige eindoplevering.
