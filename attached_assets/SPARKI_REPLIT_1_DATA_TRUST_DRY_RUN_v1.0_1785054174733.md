# Controle op nep-, demo- en foutieve gebruikersdata
Technische code: DT_01A

## Doel in gewone taal
Controleer applicatiebreed of Sparki persoonlijke gegevens, trainingen, planning, belasting,
herstel, routes, wedstrijden, sociale gegevens of AI-adviezen toont die niet aantoonbaar uit
echte gebruikersdata komen.

Dit is uitsluitend een audit en dry-run. Verwijder of wijzig nog niets.

## Waarom dit nu gebeurt
Sparki mag bij ontbrekende data nooit voorbeelddata, mockdata of terugvaldata tonen alsof deze
van de gebruiker is. Een lege toestand is beter dan geloofwaardige maar onjuiste persoonlijke data.

## Harde scope
Onderzoek minimaal:
- Vandaag;
- trainingskalender en plannen;
- training koppelen/toevoegen;
- Lab, CTL, ATL, TSB, TSS en herstel;
- doelen en wedstrijden;
- routes en ritten;
- materiaal en fietsen;
- vrienden, feed en sociale gegevens;
- coach-, ouder- en clubomgeving;
- adminfuncties;
- API-fallbacks en foutafhandeling;
- seed-, fixture-, demo- en ontwikkeldata;
- hardcoded persoonsgegevens en sportwaarden.

## Verplicht onderscheid
Classificeer ieder gevonden item als:
- VERIFIED_REAL_USER_DATA
- VERIFIED_SYSTEM_REFERENCE_DATA
- MOCK
- SEED
- DEMO
- FALLBACK
- HARDCODED_PERSONAL_DATA
- STALE_OR_INVALID_PERSONAL_METRIC
- UNKNOWN_REQUIRES_REVIEW

## Toegestaan
- Repository en database-schema lezen.
- Bestaande tests uitvoeren.
- Alleen-lezen queries en veilige dry-runs uitvoeren.
- Herkomst van velden en API-responses volgen.
- Auditdocumenten en bewijsbestanden toevoegen.
- Voorstellen doen voor eerlijke lege toestanden.

## Absoluut verboden
- Geen productiegegevens verwijderen of wijzigen.
- Geen seed, mock of fallback automatisch opschonen.
- Geen database- of schemamigratie.
- Geen UI wijzigen.
- Geen engines herschrijven.
- Geen nieuwe voorbeelddata toevoegen.
- Geen algemene refactor.
- Geen deployment.
- Geen `apply`-actie uitvoeren.

## Verplichte auditvraag per persoonsgegeven
Leg vast:
1. welke UI of API het toont;
2. het exacte veld;
3. de bron;
4. hoe gebruikersidentiteit en eigenaarschap worden bewezen;
5. wat bij ontbrekende data gebeurt;
6. wat bij API-fout gebeurt;
7. of fallbackdata als persoonlijk kan worden gelezen;
8. voorgestelde veilige correctie;
9. risico en prioriteit.

## Verplichte oplevering
Maak:
- `docs/SPARKI_DATA_TRUST_AUDIT.md`
- `docs/SPARKI_MOCK_DATA_INVENTORY.csv`
- `docs/SPARKI_DATA_TRUST_DRY_RUN.json`
- `docs/SPARKI_DATA_TRUST_EVIDENCE.json`

De CSV bevat minimaal:
`id,module,screen_or_endpoint,data_type,classification,source_file_or_table,user_binding,
missing_data_behavior,error_behavior,risk,proposed_action,apply_allowed`

## Dry-run
De dry-run moet rapporteren:
- aantallen per classificatie;
- aantallen per module;
- welke records of codepaden later in quarantaine zouden gaan;
- welke items nooit automatisch verwijderd mogen worden;
- welke items eerst menselijke bevestiging vereisen;
- verwachte gevolgen voor de UI na opschoning.

Geen dry-run mag daadwerkelijk gegevens muteren.

## Stopregel
Stop en rapporteer wanneer:
- echte gebruikersdata niet betrouwbaar van mockdata kan worden onderscheiden;
- een actie data zou wijzigen;
- repository en database niet overeenkomen;
- gebruikersidentiteit of eigenaarschap niet bewijsbaar is.

## Eindrapport
Geef:
1. tien belangrijkste bevindingen;
2. directe geloofwaardigheidsrisico's;
3. modules met eerlijke lege toestanden;
4. modules met onveilige fallback;
5. lijst items die later veilig gequarantaineerd kunnen worden;
6. lijst items die nooit automatisch verwijderd mogen worden;
7. kleinste veilige vervolgstap.

## Acceptatie
Deze opdracht is pas afgerond wanneer:
- geen productiecode of data is gewijzigd;
- alle vier bewijsbestanden bestaan;
- iedere bevinding een concrete bron heeft;
- onbekende zaken expliciet `UNKNOWN_REQUIRES_REVIEW` blijven;
- Replit niet zelfstandig een opschoning of herstelopdracht start.
