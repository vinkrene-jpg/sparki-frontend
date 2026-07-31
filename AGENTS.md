# Sparki — Vaste afbouw- en vrijgaveregels

Deze regels gelden voor **alle huidige en volgende Sparki-opdrachten**. Ze hebben voorrang op ruim geformuleerde instructies in losse taken of chats.

De bindende governance staat in:

- `docs/governance/SPARKI_ONTWIKKELSTRAAT.md`
- `docs/governance/SPARKI_MASTER_PLAN_FLOW_PATCH_2026-07-31.md`
- `docs/templates/SPARKI_DAGKAART_TEMPLATE.md`

## 1. Afbouwen, niet opnieuw bouwen

1. Afbouwen betekent: bestaande functionaliteit behouden, herstellen, verbinden en gericht aanvullen.
2. Inventariseer vóór iedere wijziging de bestaande pagina's, componenten, API's, engines, datamodellen, migraties, rollen, privacyregels, tests en gebruikersflows.
3. Hergebruik bestaande code als primaire route. Bouw geen parallel systeem, tweede databasebron, dubbele engine, nieuwe route of vervangend scherm voor iets dat al bestaat.
4. Een bestaande implementatie mag alleen worden vervangen wanneer herstel aantoonbaar technisch onverantwoord is, compatibiliteit en data behouden blijven, regressietests vóór en na bestaan en de reden in de commitdocumentatie staat.
5. Geen brede refactor, hernoeming, frameworkwissel of architectuurwijziging wanneer dit niet strikt nodig is.
6. Databasewijzigingen zijn uitbreidend en migratieveilig. Geen bestaande data, relaties of historie verwijderen.
7. Behoud bestaand uiterlijk en gedrag waar dat correct werkt. Pas alleen aan wat defect, dubbel, onvolledig of noodzakelijk ontbrekend is.
8. Nieuwe functionaliteit sluit aan op bestaande gebruikers, rollen, privacy, Data Hub, Journey, Coach en navigatie.
9. Alle bestaande relevante tests blijven groen. Voeg regressietests toe voor ieder gewijzigd bestaand onderdeel.
10. Bij twijfel: behoud de bestaande implementatie en voeg de minimaal noodzakelijke uitbreiding toe. Neem geen productbesluit namens René.

## 2. Vaste ontwikkelstraat

De verplichte volgorde is:

1. René geeft een opdracht of reeks vrij voor bouw.
2. ChatGPT of Claude levert een compleet bouwpakket.
3. Replit voert de volledige bouwopdracht uit.
4. Replit commit en pusht alle code, tests en documentatie naar GitHub.
5. Replit levert een vaste eind-SHA met bewijs.
6. Mirror toetst uitsluitend die gecommitte en gepushte SHA.
7. Mirror levert `GOEDGEKEURD`, `AFGEKEURD MET CONCRETE BLOKKADE` of `NIET BEWIJSBAAR`.
8. René beslist over goedkeuring, herstel, aanvulling of afwijzing.
9. Alleen René kan de status `RENE_APPROVED` geven.
10. Productie-vrijgave vereist daarna de status `RELEASED`.

## 3. Replit-regels

Replit:

- voert een vrijgegeven bouwopdracht integraal uit;
- verkleint of splitst de opdracht niet zelfstandig;
- bouwt frontend, backend, database, rechten, communicatie, foutafhandeling, mobiel, desktop en tests wanneer de opdracht dat vraagt;
- neemt geen eigen productbesluiten;
- meldt alleen echte architectuur-, data-, privacy- of productblokkades;
- laat geen lokale-only documenten of code achter;
- commit en pusht iedere oplevering naar GitHub;
- levert start-SHA, eind-SHA, gewijzigde bestanden, migraties, tests, exitcodes en bewijs;
- noemt een opdracht na eigen tests `BUILD_DELIVERED`, nooit `RENE_APPROVED` of `RELEASED`.

## 4. Mirror-regels

Mirror:

- toetst alleen een vaste, gecommitte en gepushte SHA;
- wijzigt geen code;
- start geen bouwopdracht;
- geeft geen product- of releasevrijgave;
- rapporteert per scenario verwacht, werkelijk, bewijs en PASS/FAIL/NIET BEWIJSBAAR;
- benoemt een blokkade concreet en beperkt;
- toetst ook het omgekeerde risico: wat niet mocht veranderen of lekken.

`MIRROR_PROVEN` is een technische toetsstatus en is **niet** hetzelfde als menselijke productvrijgave.

## 5. René is de enige vrijgever

Een opdracht is niet definitief afgerond omdat:

- Replit zegt dat hij klaar is;
- tests groen zijn;
- Claude of ChatGPT positief oordeelt;
- Mirror goedkeurt.

Een opdracht is pas productmatig afgerond wanneer René expliciet goedkeurt. Daarna wordt de status `RENE_APPROVED` vastgelegd.

## 6. Statussen

Gebruik uitsluitend:

- `DRAFT`
- `READY_FOR_RENE`
- `RENE_RELEASED_FOR_BUILD`
- `IN_BUILD`
- `BUILD_DELIVERED`
- `IN_MIRROR_REVIEW`
- `MIRROR_FAILED`
- `MIRROR_NOT_PROVABLE`
- `MIRROR_PROVEN`
- `RENE_APPROVED`
- `RELEASED`
- `SUPERSEDED`
- `ARCHIVED`

## 7. Automatisch doorgaan

Replit mag alleen automatisch naar de volgende opdracht wanneer René de reeks vooraf expliciet heeft vrijgegeven, de voorgangers op de vereiste status staan en geen nieuw productbesluit nodig is.

Bij twijfel stopt Replit en legt één concrete vraag voor. Het verzint geen besluit.
