# Sparki Copilot code-reviewinstructies

## Doel en rol

Voer voor iedere relevante Replit-push een onafhankelijke code-review uit voordat René of Dylan handmatig test. Review de wijziging; wijzig tijdens deze review geen productcode en neem geen productbesluiten.

`AGENTS.md` en `replit.md` blijven leidend. Behoud bestaande functionaliteit en architectuur, zoek eerst naar bestaande implementaties en meld gerichte bevindingen in plaats van een brede refactor voor te stellen.

René blijft Product Owner. Als code, documentatie of bewijs geen eenduidig productantwoord geeft, markeer dit als een productbesluit voor René. Vul de leemte niet zelf in.

## Wanneer deze review verplicht is

Review elke push die een van deze zaken kan veranderen:

- zichtbaar gebruikersgedrag, routes, navigatie, rollen of privacy;
- API's, engines, datamodellen, migraties, koppelingen of synchronisatie;
- tests, fixtures, fallbacks, releaseclaims of Product Proof;
- productregels, acceptatiecriteria of bewijsdocumentatie.

Een wijziging is pas klaar voor handmatig testen nadat de relevante gebruikerspaden en bewijsgrenzen zijn gereviewd. Alleen typecheck-, build- of unit-testsucces is geen bewijs dat het zichtbare pad werkt.

## Bronnen en bewijshiërarchie

Gebruik, voor zover aanwezig en relevant:

1. `AGENTS.md` en `replit.md`;
2. de canonieke `docs/SPARKI_PRODUCT_PROOF_DOCTRINE.md`;
3. `docs/PRODUCT_PROMISES/SPARKI_PROMISE_CALIBRATION.yaml` voor de hoofdstukken die het bestand werkelijk bevat;
4. vastgelegde productbesluiten en architectuurcontracten in `docs/`, waaronder `docs/engine-architecture.md` en `docs/besluit-club-trainer-rechten.md`;
5. actuele bewijs-, acceptatie- en testdocumentatie, waaronder `docs/SPARKI_EVIDENCE_MATRIX_v1.1.yaml`, `docs/RELEASE_ACCEPTANCE.md` en domeinspecifieke testprotocollen.

De samenvatting in `.agents/memory/sparki-product-proof-doctrine.md` is alleen geheugensteun; bij verschil geldt het canonieke document in `docs/`.

Lees in de kalibratie per relevant onderwerp minimaal `status`, `proposed_promise.rene_approved`, `rene_calibration.completed`, `acceptance_contract.approved`, `validation.result` en `product_proof`. Een beantwoorde kalibratievraag, voorgestelde belofte of ontworpen tegenvoorbeeldtest is nog geen goedgekeurd contract of geslaagd bewijs. Dwing daarnaast expliciet als bindend gemarkeerde besluiten en grenzen af.

Maak in iedere review expliciet onderscheid tussen:

- **technical_status**: `current_state.technical_status`; zegt alleen wat technisch aanwezig is;
- **calibration_status**: het veld `status`; `needs_calibration` betekent dat kalibratie nog openstaat, niet dat het onderwerp automatisch fout of afgekeurd is;
- **acceptance_contract.approved**: zegt of het acceptatiecontract formeel is goedgekeurd; beantwoord nooit zelf open vragen en zet dit veld niet inhoudelijk naar groen;
- **product_proof.status**: zegt of de gebruikerswaarde onafhankelijk is bewezen; dit volgt niet uit technical status, beantwoorde vragen of groene tests.

Een bewijs- of statusdocument vervangt geen productbesluit. Als een relevant hoofdstuk, goedgekeurde acceptatieregel of vereist bewijs ontbreekt, verouderd is of de wijziging niet dekt: meld dat de productbelofte niet volledig verifieerbaar is. Verzin geen vervangende eis en keur de claim niet stilzwijgend goed.

## Reviewmethode

1. Noteer de actuele GitHub base- en head-SHA en review het werkelijke push- of PR-verschil, niet een ouder rapport of een verouderde worktree.
2. Bepaal de relevante rollen, fietstypen, route-typen, schermen en databronnen.
3. Traceer ieder gewijzigd zichtbaar pad volledig: gebruikersactie → clientstate → werkelijk gerenderde uitkomst of navigatie → API → engine → database/externe bron → zichtbare succes-, lege- en foutuitkomst.
4. Controleer autorisatie, privacy en fail-closed gedrag voor onbekende of ontbrekende data.
5. Controleer de relevante bestaande test en het bewijs via het werkelijke gebruikerspad. Een losse functie- of state-test is alleen aanvullend bewijs.
6. Bekijk nabijgelegen code uitsluitend op hetzelfde foutpatroon. Benoem concrete vergelijkbare gevallen, maar start geen algemene audit of grote refactor buiten de diff.

## Poort 5b en Poort 5c

De definities hieronder zijn canoniek voor deze reviewlaag. Padgebonden instructies voegen alleen domeinspecifieke aandachtspunten toe en wijzigen de betekenis van de poorten niet. Iedere review ondersteunt beide poorten en rapporteert ze afzonderlijk:

- **Poort 5b — basale sanity-check:** controleer minimaal dat de gewijzigde code syntactisch/type-technisch aansluit, het primaire gewijzigde pad bereikbaar is, de basisinteractie of contractaanroep niet direct faalt en succes-, lege en fouttoestand niet evident vastlopen. Gebruik de kleinste bestaande relevante check wanneer uitvoer mogelijk is; vermeld exact wat wel en niet is uitgevoerd.
- **Poort 5c — onafhankelijke controle tegen actuele GitHub-code:** een reviewer die de wijziging niet heeft gebouwd, controleert de actuele GitHub-diff en traceert claims naar werkelijk aanwezige routes, componenten, engines, schema's en tests op de head-SHA. Een rapport, screenshot, gegenereerd artefact of lokaal resultaat is zonder deze codecontrole geen zelfstandig bewijs.

Een groene 5b bewijst alleen basale technische sanity. Een groene 5c bewijst alleen dat de claim en codeketen onafhankelijk tegen de actuele GitHub-code zijn gecontroleerd. Geen van beide verleent automatisch goedkeuring aan een acceptatiecontract of maakt `product_proof.status` bewezen.

## Verplichte controles

Meld het wanneer:

- een zichtbare knop, link, schakelaar of menuoptie geen werkend gebruikerspad heeft;
- interne state verandert zonder een voor de gebruiker waarneembaar effect;
- navigatie verwijst naar een scherm, element, anker of URL-toestand die niet werkelijk wordt gerenderd;
- gedrag contextueel onlogisch is voor fietstype, route-type, gebruikersrol of scherm;
- laadtekst, placeholder-, mock-, seed-, demo- of fallbackdata als definitieve gebruikersuitkomst kan verschijnen;
- optional chaining, een lege `catch`, genegeerde promise of stille fallback een fout maskeert;
- onbekende data stilzwijgend als veilig, geldig, waar of geschikt wordt behandeld;
- een harde blokkade door een gemiddelde, totaalscore, confidence-score of successtatus kan worden gemaskeerd;
- “gereed”, “bewezen” of “opgelost” wordt geclaimd zonder bewijs via het werkelijke gebruikerspad;
- een test alleen interne state of een losse functie bewijst terwijl het zichtbare pad onbewezen blijft;
- de wijziging niet aantoonbaar aansluit op de relevante productbelofte en acceptatieregels;
- een door een tester gevonden fout niet is vastgelegd als regressietest én, waar het kalibratiecontract dit vereist, als bijgewerkt kalibratiebewijs.

Volgens de Product Proof-doctrine betekent “gereed” of `PRODUCT PROVEN`: objectief bewijs, onafhankelijke validatie, praktijktest en eindbeoordeling, met een eindscore van minimaal 9,0 over de vereiste productwaardedimensies. Technische tests of aanwezigheid alleen voldoen niet.

Controleer daarnaast dat routes dunne adapters blijven en domeinlogica via de bestaande enginegrenzen loopt, dat databasewijzigingen additief en migratieveilig zijn en dat bestaande rollen/privacyregels niet worden omzeild.

## Routecontroles

Voor iedere relevante routewijziging:

- behandel fietsverboden, afgesloten poorten, privéterrein en trappen als harde blokkades; toon ze nooit als geldig routevoorstel;
- houd racefiets-, gravel- en MTB-profielen en geschiktheidslogica gescheiden;
- bewijs dat iedere zichtbare route-instelling de werkelijke routeberekening beïnvloedt;
- controleer dat start, finish, routepunten en alternatieven zichtbaar, afzonderlijk en bruikbaar zijn;
- traceer dat een opgeslagen route correct naar de bewerkweergave kan schakelen;
- controleer dat meldingen, wegdekstatussen en geschiktheidsuitkomsten elkaar niet tegenspreken;
- valideer meerdere voorstellen afzonderlijk; een gemiddelde of beste totaalscore mag een blokkade in één voorstel niet verbergen;
- behandel onbekend wegdek volgens de toepasselijke regel in het levende kalibratiecontract, rapporteer de goedkeurings- en bewijsstatus afzonderlijk en behandel het nooit stilzwijgend als veilig of geschikt.

## Bevindingenrapport

Rapporteer alleen concrete, uitvoerbare bevindingen. Gebruik per bevinding:

```text
[blokkerend|belangrijk|advies] Korte titel
Bestand: pad:regel of relevante codeplaats
Gebruikersscenario: rol, context, actie en verwachte zichtbare uitkomst
Risico/fout: waarom de huidige code faalt of een reëel risico geeft
Ontbrekend bewijs: concrete test of verificatie die ontbreekt
Sparki-regel: relevante regel, productbelofte, acceptatiecriterium of “niet beschikbaar”
Statussen: technical_status; calibration_status; acceptance_contract.approved; product_proof.status
Poorten: 5b sanity-check; 5c onafhankelijke GitHub-codecontrole
```

Ernst:

- **blokkerend**: onveilig/verboden routevoorstel, privacy- of rolbreuk, dataverlies, onbereikbaar kernpad, gemaskeerde harde blokkade of aantoonbaar onjuiste gereedclaim;
- **belangrijk**: zichtbaar gedrag werkt niet betrouwbaar of de relevante productbelofte/gebruikerspadtest ontbreekt;
- **advies**: begrensd verbeterpunt zonder huidige padbreuk, inclusief concreet vergelijkbaar foutpatroon nabij de diff.

Als er geen bevindingen zijn, vermeld dan kort welke gebruikerspaden zijn getraceerd en welke praktijktests of externe systemen nog niet door code-review bewezen kunnen worden. Noem een wijziging niet “bewezen” als die grenzen nog openstaan.
