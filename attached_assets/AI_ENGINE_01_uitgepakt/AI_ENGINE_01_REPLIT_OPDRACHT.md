# BOUWOPDRACHT — TECHNISCHE AI-ENGINE

**Code:** `AI_ENGINE_01`  
**Uitvoerder:** Replit  
**Type:** breed domeinpakket  
**Startcommit:** vóór start bevestigen en in eindrapport opnemen  
**Vrijgavevoorwaarde:** volledige opdracht integraal uitvoeren  
**Grondslag:** `AI_GOVERNANCE_01`, `DATA_TRUST_01`, bestaande deterministische Sparki-engines en nieuwste besluiten van René

---

## 1. Doel

Bouw één centrale, veilige en controleerbare AI-engine die alle bestaande AI-functies van Sparki aanstuurt zonder dat ieder scherm of domein zijn eigen losse prompt-, model-, geheugen- of toolarchitectuur gebruikt.

Na afloop:

- kiest de engine per verzoek de juiste domeinrol;
- gebruikt zij alleen toegestane, actuele en herleidbare context;
- scheidt deterministische berekeningen van AI-uitleg;
- dwingt pakket-, rol-, privacy- en jeugdregels server-side af;
- gebruikt tools alleen via een expliciete bevoegdheidslaag;
- logt beslissingen, bronnen, kosten en fouten;
- ondersteunt failover zonder stilzwijgende kwaliteitsverlaging;
- voorkomt prompt-injection en datalekken;
- geeft eerlijke antwoorden wanneer informatie ontbreekt;
- werkt hetzelfde voor vrije chat, coachteksten, documenten, routes, training, wedstrijd, voeding, materiaal, club en support.

Dit pakket bouwt de technische motor. Het verandert geen productbeleid uit `AI_GOVERNANCE_01`.

---

## 2. Bron van waarheid

Gebruik:

1. `AI_GOVERNANCE_01` voor bevoegdheden, grenzen en escalatie;
2. `DATA_TRUST_01` voor bronherkomst en databetrouwbaarheid;
3. bestaande deterministische engines voor berekeningen;
4. bestaande entitlements en rolrechten;
5. bestaande Anthropic/Gemini-integraties;
6. bestaande document-, foto-, route-, trainings- en supportservices.

Bouw geen tweede chatbot, tweede geheugenlaag, tweede toolrouter of parallel promptframework wanneer al een bruikbare basis bestaat.

---

## 3. Architectuur

Bouw één centrale AI-orchestrator met minimaal deze lagen:

1. **Request Intake**
   - gebruiker;
   - rol;
   - pakket;
   - leeftijdsstatus;
   - gekoppelde trainer/club/ouder;
   - kanaal;
   - taal;
   - domein;
   - doel van verzoek.

2. **Policy Resolver**
   - leest `AI_GOVERNANCE_01`;
   - bepaalt toegestaan domein;
   - bepaalt adviesniveau;
   - bepaalt escalatie;
   - bepaalt verboden onderwerpen;
   - bepaalt benodigde toestemming.

3. **Context Builder**
   - haalt alleen noodzakelijke context op;
   - controleert bron, eigenaar, actualiteit en kwaliteit;
   - verwijdert context zonder recht;
   - markeert ontbrekende of onbetrouwbare data.

4. **Domain Router**
   - vrije chat;
   - training;
   - route;
   - wedstrijd;
   - voeding;
   - mechanieker;
   - club;
   - trainer;
   - ouder/jeugd;
   - document;
   - support;
   - abonnement.

5. **Tool Gateway**
   - read-only tools;
   - voorsteltools;
   - schrijftools;
   - gevoelige tools;
   - expliciete toestemming;
   - audit en idempotentie.

6. **Model Gateway**
   - modelkeuze;
   - provider;
   - timeout;
   - retry;
   - failover;
   - kostenlimiet;
   - outputvalidatie.

7. **Response Validator**
   - feitelijkheid;
   - bronvermelding;
   - pakketgrens;
   - medische grens;
   - jeugdregel;
   - privacy;
   - toon;
   - verboden merknaamgebruik in gewone UI-zinnen.

8. **Memory Manager**
   - expliciet onthouden;
   - tijdelijk gesprek;
   - langdurige voorkeur;
   - intrekken;
   - verwijderen;
   - bron en geldigheid.

9. **Observability**
   - correlatie-ID;
   - promptversie;
   - model;
   - tokens;
   - kosten;
   - latency;
   - toolcalls;
   - policybeslissing;
   - foutstatus.

---

## 4. Domeinrouter

Gebruik een expliciete technische domeinclassificatie. Minimaal:

- `GENERAL_CHAT`
- `TRAINING`
- `ROUTES`
- `RACE`
- `NUTRITION`
- `MECHANIC`
- `CLUB`
- `TRAINER`
- `PARENT_YOUTH`
- `DOCUMENT`
- `SUPPORT`
- `SUBSCRIPTION`
- `PRIVACY`
- `SAFETY`
- `UNKNOWN`

Regels:

1. Onbekend domein wordt niet automatisch naar algemene coaching gestuurd.
2. Meervoudige verzoeken mogen in meerdere subrequests worden opgesplitst.
3. Elk subrequest krijgt eigen rechten- en contextcontrole.
4. Domeinkeuze wordt gelogd.
5. Een domein mag geen data opvragen uit een ander domein zonder expliciete noodzaak.
6. Directe API-calls mogen domeinclassificatie niet overslaan.

---

## 5. Deterministisch versus generatief

Harde scheiding:

### Deterministisch

Blijft verantwoordelijk voor:

- CTL/ATL/TSB of Sparki-equivalenten;
- trainingsbelasting;
- FTP/zones;
- routeberekening;
- blokkadecontrole;
- pakketlimieten;
- abonnementsstatus;
- materiaalkilometers;
- leeftijd en rechten;
- datums, perioden en tellingen;
- privacy- en rolbeslissingen.

### Generatief

Mag uitsluitend:

- samenvatten;
- uitleggen;
- herformuleren;
- contextueel toelichten;
- vragen stellen;
- opties presenteren;
- documenten interpreteren binnen toegestane scope;
- advies verwoorden op basis van deterministische uitkomsten.

Een LLM mag nooit een deterministische waarde vervangen, aanpassen of verzinnen.

---

## 6. Context en data-trust

Iedere contextwaarde bevat minimaal:

- bron;
- eigenaar;
- timestamp;
- actualiteit;
- betrouwbaarheid;
- toestemming;
- domein;
- gevoeligheidsniveau.

Contextcategorieën:

- `VERIFIED_USER_DATA`
- `VERIFIED_PROVIDER_DATA`
- `DETERMINISTIC_RESULT`
- `USER_STATEMENT`
- `DOCUMENT_EXTRACT`
- `PUBLIC_KNOWLEDGE`
- `UNKNOWN`
- `TEST_ONLY`

Regels:

1. `UNKNOWN` en `TEST_ONLY` mogen niet als persoonlijk feit worden gebruikt.
2. Verouderde data wordt als verouderd benoemd.
3. Ontbrekende data leidt tot eerlijke beperking.
4. AI mag geen gaten invullen met aannames.
5. Context wordt per verzoek geminimaliseerd.
6. Jeugd- en gezondheidsdata krijgen extra filtering.
7. Geen cross-account-context.
8. Geen prompt bevat secrets of volledige betaalgegevens.

---

## 7. Modelgateway

Ondersteun bestaande providers via één interface.

Minimaal:

- Anthropic;
- Gemini;
- toekomstige provider via adapter, niet via domeincode.

Per use-case configureerbaar:

- primair model;
- fallbackmodel;
- maximale tokens;
- timeout;
- temperatuur;
- JSON-schema;
- kostenplafond;
- retrybeleid;
- privacyclassificatie.

Failoverregels:

1. Geen failover naar model met lagere privacygarantie zonder expliciete configuratie.
2. Geen stilzwijgende inhoudelijke verslechtering.
3. Bij timeout maximaal veilige retry.
4. Bij providerstoring eerlijke fout of beperkte fallback.
5. Kostenplafond overschrijden blokkeert nieuwe generatieve calls zonder kernfuncties te breken.
6. Deterministische functies blijven werken zonder AI-provider.

---

## 8. Promptbeheer

Bouw centrale promptregistratie met:

- prompt-ID;
- domein;
- versie;
- taal;
- pakket;
- rol;
- leeftijdsstatus;
- changelog;
- actieve versie;
- tests;
- rollback.

Regels:

1. Geen prompts verspreid over willekeurige UI-componenten.
2. Promptwijziging is versieerbaar.
3. Promptversie wordt per antwoord gelogd.
4. Productregels staan niet alleen in prompttekst, maar ook in code/policy.
5. Prompt mag geen geheime systeemuitleg tonen.
6. Prompt-injection uit gebruiker, documenten of websites wordt als onbetrouwbare instructie behandeld.
7. Documentinhoud kan nooit systeemregels overschrijven.

---

## 9. Toolgateway

Classificeer tools:

### A. Read-only

- profiel lezen;
- activiteiten lezen;
- route lezen;
- planning lezen;
- materiaal lezen;
- abonnementstatus lezen.

### B. Voorstel

- training voorstellen;
- route voorstellen;
- planwijziging voorstellen;
- onderhoud voorstellen;
- supportantwoord voorbereiden.

### C. Schrijven met bevestiging

- training inplannen;
- plan aanpassen;
- route opslaan;
- bericht versturen;
- voorkeur onthouden.

### D. Gevoelig

- account verwijderen;
- refund;
- privacy hold;
- rol wijzigen;
- abonnement wijzigen;
- jeugdtoestemming;
- gezondheidsdata delen.

Regels:

1. AI mag gevoelige tools nooit zelfstandig uitvoeren.
2. Schrijfactie toont vooraf wat verandert.
3. Bevestiging is actie- en tijdgebonden.
4. Toolcalls zijn idempotent.
5. Toolresultaten worden gevalideerd.
6. Foutieve toolcall leidt niet tot verzonnen succesmelding.
7. Iedere toolcall krijgt auditlog en correlatie-ID.
8. Pakketrechten en rolrechten worden server-side opnieuw gecontroleerd.

---

## 10. Vrije chat

Vrije chat gebruikt dezelfde engine als domeinfuncties.

Ondersteun:

- gewone productvragen;
- training;
- routes;
- wedstrijden;
- materiaal;
- voeding;
- club;
- trainer;
- ouder/jeugd;
- abonnement;
- privacy;
- support.

Regels:

1. De chat herkent wanneer een vraag buiten Sparki valt.
2. Geen onbeperkte algemene chatbot als dit niet bij het product past.
3. Geen medisch oordeel.
4. Geen dopingbegeleiding.
5. Geen extreme gewichts- of eetadviezen.
6. Geen juridische of financiële zekerheid.
7. Bij acute veiligheidssignalen volgt de governance-escalatie.
8. Chat gebruikt geen data zonder toestemming.
9. Chat kan uitleggen welke data is gebruikt.
10. Chat kan vergeten of opgeslagen voorkeuren beheren.

---

## 11. Geheugen

Geheugenniveaus:

- sessiegeheugen;
- tijdelijke context;
- expliciete voorkeur;
- langdurig profielgegeven;
- verboden geheugen.

Nooit langdurig onthouden zonder passende grondslag:

- acute medische uitspraken;
- crisissituaties;
- gevoelige vrije tekst;
- betaalkaartgegevens;
- wachtwoorden;
- secrets;
- ongeverifieerde beschuldigingen.

Gebruiker kan:

- zien wat wordt onthouden;
- corrigeren;
- verwijderen;
- geheugen uitschakelen;
- exporteren.

Iedere herinnering bevat:

- bron;
- datum;
- categorie;
- reden;
- geldigheid;
- eigenaar.

---

## 12. Jeugd en kwetsbare gebruikers

1. Leeftijdsstatus wordt server-side bepaald.
2. Minderjarige krijgt aangepaste toon en beperkingen.
3. Ouder- en trainerrechten worden afzonderlijk gecontroleerd.
4. Geen gevoelige data delen zonder toestemming.
5. Geen volwassen coachingdoelen automatisch toepassen.
6. Gewichtsadvies is extra begrensd.
7. AI mag geen ouder, trainer of arts vervangen.
8. Escalatie volgt `AI_GOVERNANCE_01`.
9. Overgang naar volwassen account wijzigt rechten gecontroleerd.
10. Geen verborgen tracking van jeugdchat.

---

## 13. Veiligheid en escalatie

Bouw een centrale veiligheidsclassifier vóór en na modeloutput.

Categorieën minimaal:

- medisch;
- psychische crisis;
- zelfbeschadiging;
- geweld;
- doping;
- eetstoornis/ongezond afvallen;
- misbruik;
- fraude;
- accountbeveiliging;
- privacy;
- jeugdveiligheid.

Uitkomsten:

- normaal beantwoorden;
- begrensd antwoord;
- doorvragen;
- weigeren;
- verwijzen;
- noodinformatie tonen;
- toolgebruik blokkeren;
- menselijke escalatie.

Geen lokale veiligheidslogica per scherm.

---

## 14. Outputvalidatie

Iedere output wordt gevalideerd op:

- geldige structuur;
- verboden claims;
- bronconsistentie;
- genoemde waarden bestaan in context;
- geen cross-user data;
- geen niet-toegestane pakketfunctie;
- geen medische diagnose;
- geen verborgen toolactie;
- correcte taal;
- geen merknaam als handelend onderwerp in gewone UI-zinnen.

Bij validatiefout:

- één veilige herstelpoging;
- daarna eerlijke fout;
- geen ongevalideerde output tonen.

---

## 15. Pakketgrenzen

De engine ontvangt server-side:

- Gratis;
- Go;
- Compleet;
- Trainer;
- toekomstige clubvariant.

Regels:

1. AI mag pakketgrens niet zelf interpreteren.
2. Niet-toegestane tool of context wordt niet meegegeven.
3. Betaalmuurmelding is eerlijk.
4. Geen inhoud uit premiumanalyse lekken via chat.
5. Een samenvatting mag geen verborgen premiumdata reproduceren.
6. Trial en grace-period volgen centrale entitlements.

---

## 16. Kosten- en prestatiebeheer

Meet:

- tokens;
- kosten;
- latency;
- foutpercentage;
- retries;
- toolcalls;
- cachehit;
- domein;
- pakket;
- model.

Bouw:

- dagelijkse en maandelijkse budgetten;
- waarschuwingen;
- per-domeinlimieten;
- veilige cache;
- deduplicatie van identieke verzoeken;
- streaming waar bruikbaar;
- timeouts;
- circuit breaker;
- fallback.

Cache mag geen persoonlijke output tussen gebruikers delen.

---

## 17. Observability en audit

Per request:

- correlatie-ID;
- user-ID of gepseudonimiseerde sleutel;
- rol;
- pakket;
- domein;
- policyuitkomst;
- contextbronnen;
- toolcalls;
- promptversie;
- model;
- tokens;
- kosten;
- latency;
- validatie;
- foutstatus.

Logs bevatten geen onnodige vrije chatinhoud. Gevoelige inhoud wordt geredigeerd.

Admin ziet:

- volume;
- kosten;
- fouten;
- providerstatus;
- policyblokkades;
- toolfouten;
- promptversies;
- regressies.

---

## 18. AI-evaluaties

Bouw een evaluatiestraat met vaste scenario’s voor:

- training;
- route;
- wedstrijd;
- voeding;
- materiaal;
- club;
- jeugd;
- support;
- abonnement;
- privacy;
- crisis;
- doping;
- ontbrekende data;
- prompt-injection;
- pakketomzeiling.

Per scenario:

- input;
- context;
- verwachte policy;
- toegestane tools;
- verboden tools;
- noodzakelijke feiten;
- verboden claims;
- score;
- PASS/FAIL.

Geen evaluatie uitsluitend op stijl.

---

## 19. Beheer

Adminfuncties:

- providerstatus;
- modelconfiguratie;
- promptversies;
- featureflags;
- kostenplafonds;
- domeinen;
- toolrechten;
- evaluatieresultaten;
- foutlogs;
- circuit breaker;
- rollback.

Fijnmazige adminrechten. Geen prompt- of modelwijziging zonder audit.

---

## 20. Database en migratie

Hergebruik bestaande tabellen waar mogelijk.

Voeg alleen ontbrekende structuren toe voor:

- promptversies;
- AI-requests;
- policybeslissingen;
- toolcalls;
- geheugenitems;
- kostenmetingen;
- evaluaties;
- providerstatus;
- redaction/auditmetadata.

Eisen:

- additieve migratie;
- geen bestaande chatgeschiedenis verliezen;
- geen gevoelige content onnodig kopiëren;
- verse database en bestaande-datakopie;
- rollbackveilig;
- retentie configureerbaar;
- testdata geïsoleerd.

---

## 21. UI/UX

- één consistente chat- en uitlegervaring;
- duidelijke bron- en datagebruiktoelichting;
- zichtbaar wanneer informatie ontbreekt;
- bevestiging voor schrijfacties;
- gespreksonderwerpen logisch gescheiden;
- mobiel en desktop;
- geen technische modelnamen voor gewone gebruiker;
- geen merknaam als handelend onderwerp;
- geen overdreven antropomorfisme;
- geen schijnzekerheid.

---

## 22. Tests

Minimaal:

1. domeinrouter kiest juiste domein;
2. onbekend domein faalt veilig;
3. pakketgrens server-side;
4. rolgrens server-side;
5. jeugdregel toegepast;
6. trainerprioriteit toegepast;
7. ontbrekende data wordt niet verzonnen;
8. verouderde data wordt benoemd;
9. deterministische waarde blijft ongewijzigd;
10. prompt-injection uit chat wordt genegeerd;
11. prompt-injection uit document wordt genegeerd;
12. read-only tool werkt;
13. schrijftool vraagt bevestiging;
14. gevoelige tool wordt geblokkeerd;
15. dubbele toolcall is idempotent;
16. toolfout geeft geen vals succes;
17. provider-timeout geeft veilige fallback;
18. providerstoring breekt deterministische functies niet;
19. kostenplafond werkt;
20. cache lekt niet tussen gebruikers;
21. geheugen is zichtbaar en verwijderbaar;
22. verboden geheugen wordt niet opgeslagen;
23. privacycontext wordt geminimaliseerd;
24. cross-account-context faalt;
25. premiumdata lekt niet via chat;
26. medische diagnose wordt geblokkeerd;
27. dopingadvies wordt geweigerd;
28. ongezond gewichtsadvies wordt begrensd;
29. crisissignaal volgt escalatie;
30. outputvalidator blokkeert verzonnen waarde;
31. outputvalidator blokkeert rol-/pakketlek;
32. promptversie wordt gelogd;
33. toolcall wordt gelogd;
34. kosten worden gelogd;
35. vrije chat en domeinfunctie gebruiken dezelfde policy;
36. desktop werkt;
37. mobiel werkt;
38. geen mock-/seeddata als echte context;
39. merknaamregel;
40. bestaande AI-functies blijven werken.

---

## 23. Mirror-scenario’s

Mirror toetst minimaal:

- vrije chat zonder data;
- training met echte data;
- training met ontbrekende data;
- routevraag;
- wedstrijdvraag;
- voedingsvraag;
- mechaniekervraag;
- clubvraag;
- jeugdaccount;
- gekoppelde trainer;
- abonnementvraag;
- privacyvraag;
- prompt-injection;
- document met kwaadaardige instructie;
- medische vraag;
- crisisvraag;
- dopingvraag;
- ongezond gewichtsdoel;
- schrijftool met bevestiging;
- gevoelige tool;
- providerstoring;
- kostenplafond;
- geheugen opslaan/verwijderen;
- cross-account-aanval;
- premiumomzeiling;
- desktop en mobiel.

---

## 24. Bewijsformat

Lever:

- start-SHA;
- eind-SHA;
- gewijzigde bestanden;
- architectuurdiagram;
- API-contracten;
- promptregister;
- policyregister;
- toolregister;
- migraties;
- tests met commando/resultaat/exitcode;
- evaluatierapport;
- kostenmetingen;
- screenshots desktop/mobiel;
- directe API-bewijzen;
- bekende restpunten;
- bevestiging dat geen tweede AI-systeem is gebouwd.

---

## 25. Stopcondities

Stop alleen wanneer:

- bestaande AI-integraties niet veilig herbruikbaar zijn;
- governancebeleid technisch niet afdwingbaar blijkt zonder fundamentele architectuurwijziging;
- migratie gevoelige data kan verliezen of lekken;
- providercontract of privacygrondslag ontbreekt;
- centrale entitlements of rolrechten onbetrouwbaar zijn.

Geen stopconditie:

- lege testdata;
- geen echte productiegesprekken;
- tijdelijk ontbrekende provider, mits fallback testbaar;
- ontbrekende demo-inhoud;
- een niet-kritisch domeinrestpunt.

---

## 26. Definition of Done

Pas klaar wanneer:

- alle bestaande AI-functies via één centrale engine lopen;
- governance technisch wordt afgedwongen;
- deterministische en generatieve logica gescheiden zijn;
- context aantoonbaar betrouwbaar en minimaal is;
- tools veilig en auditbaar zijn;
- vrije chat alle afgesproken grenzen respecteert;
- geheugen beheerbaar is;
- providerfailover en kostenbeheer werken;
- desktop en mobiel bruikbaar zijn;
- alle tests en evaluaties groen zijn;
- geen open bouwdeel uit deze opdracht resteert.

---

## 27. Verboden

- geen tweede losse chatbot;
- geen prompts in willekeurige componenten;
- geen pakket- of rolbeslissing door LLM;
- geen deterministische berekening door LLM;
- geen gevoelige tool zonder bevestiging/bevoegdheid;
- geen cross-user cache;
- geen prompt-injection volgen;
- geen ongevalideerde output tonen;
- geen geheime systeemprompt uitlekken;
- geen governance wijzigen binnen deze opdracht.
