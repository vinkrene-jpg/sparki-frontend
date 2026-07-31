# BOUWOPDRACHT — SPARKI TRAINER ABONNEMENT

**Code:** `SPARKI_TRAINER_ABONNEMENT_01`  
**Uitvoerder:** Replit  
**Type:** breed domeinpakket  
**Prijsbesluit:** €99 per maand of €990 per jaar  
**Startcommit:** vóór start bevestigen en in eindrapport opnemen  
**Vrijgavevoorwaarde:** opdracht volledig uitvoeren; Mirror toetst pas na oplevering  
**Grondslag:** nieuwste productbesluit René over Sparki Trainer

---

## 1. Doel

Bouw één volledig, betrouwbaar en commercieel bruikbaar abonnement voor zelfstandige trainers en trainers die meerdere sporters begeleiden.

Na afloop kan een trainer:

- een Trainer-abonnement starten;
- kiezen tussen maand- en jaarbetaling;
- proefperiode gebruiken wanneer die in de bestaande abonnementsarchitectuur is geactiveerd;
- sporters uitnodigen en koppelen;
- rechten per sporter beheren;
- trainingen, plannen, feedback en communicatie gebruiken binnen de bestaande traineromgeving;
- zijn abonnement wijzigen, pauzeren, hervatten of opzeggen;
- facturen, betaalstatus en abonnementsstatus terugzien;
- zonder toegang tot onderdelen die niet bij Sparki Trainer horen.

Alle pakketbeslissingen worden server-side afgedwongen. De UI volgt, maar is nooit leidend.

---

## 2. Productdefinitie

### 2.1 Productnaam

**Sparki Trainer**

De naam wordt uitsluitend gebruikt waar product- of pakketcontext nodig is, zoals:

- prijskaart;
- checkout;
- abonnementsoverzicht;
- factuur;
- e-mailbevestiging;
- beheeromgeving;
- juridische/contractuele communicatie.

De gewone UI blijft de eerder vastgelegde merknaamregel volgen: geen zinnen waarin de merknaam als handelend onderwerp wordt gebruikt.

### 2.2 Prijs

| Termijn | Prijs | Facturatie |
|---|---:|---|
| Maandelijks | €99 per maand | iedere maand |
| Jaarlijks | €990 per jaar | vooraf per jaar |

Regels:

1. Jaarlijks betekent 12 maanden toegang.
2. Jaarprijs is exact €990.
3. Geen verborgen setupkosten.
4. Geen vooraf aangevinkte upsell.
5. Btw-weergave volgt de bestaande Stripe- en facturatie-inrichting.
6. Valuta is euro.
7. Prijswijzigingen zijn versieerbaar en raken bestaande contracten niet stilzwijgend.
8. Kortingscodes mogen alleen via de bestaande Stripe-coupon/promotion-infrastructuur worden toegepast.
9. Een eventuele proefperiode gebruikt de bestaande proefperiode-infrastructuur; bouw geen tweede trial-systeem.

### 2.3 Doelgroep

- zelfstandige trainer;
- coach;
- trainer in loondienst met eigen sporters;
- trainer die zowel individuele sporters als kleine groepen begeleidt.

### 2.4 Niet inbegrepen

Niet automatisch inbegrepen:

- volledig clubbeheer;
- clubfacturatie;
- teammanager- of ploegleideromgeving;
- trainer-marktplaats;
- verkoop en uitbetaling van trainingsplannen;
- mechaniekerfuncties;
- onbeperkte clubleden;
- enterprise- of white-labelmogelijkheden.

Die functies vereisen een eigen pakket, add-on of apart productbesluit.

---

## 3. Rechten en entitlements

### 3.1 Nieuwe variant

Voeg een centrale variant toe:

`trainer`

Gebruik een technische sleutel die past binnen de bestaande variantarchitectuur. Hergebruik de huidige entitlement-engine en de superset-/pakketstructuur. Bouw geen tweede rechtensysteem.

### 3.2 Trainerrechten

Minimaal:

- trainerdashboard;
- sporters uitnodigen;
- koppeling sporter-trainer beheren;
- trainingsplannen maken;
- trainingen plannen;
- trainingbouwer gebruiken;
- feedback geven;
- voortgang bekijken;
- toegestane sportdata bekijken;
- communicatie met gekoppelde sporters;
- basisrapportages;
- trainerprofiel en bedrijfsgegevens;
- facturen en abonnementsstatus bekijken;
- sporters archiveren of ontkoppelen volgens bestaande privacyregels.

### 3.3 Rechten per sporter

Per gekoppelde sporter configureerbaar:

- trainingsplan bekijken;
- trainingsplan aanpassen;
- kalender bekijken;
- activiteiten bekijken;
- analyse bekijken;
- herstelgegevens bekijken;
- voeding bekijken;
- wedstrijdgegevens bekijken;
- materiaal bekijken;
- communicatie;
- documenten delen.

Standaard: minimale noodzakelijke toegang. Geen toegang zonder koppeling én toestemming.

### 3.4 Grenzen

Een Trainer-abonnement geeft nooit automatisch:

- adminrechten;
- toegang tot niet-gekoppelde sporters;
- clubbrede data;
- medische dossiers;
- ouder- of jeugddata zonder toestemming;
- betaalgegevens van sporters;
- locatiedata zonder expliciete toestemming;
- recht op refunds of accountverwijdering voor sporters.

### 3.5 Directe API-bewaking

Alle trainerfuncties worden server-side beschermd. Een gemanipuleerde client, directe API-call of gewijzigd pakketveld in de frontend mag geen extra rechten opleveren.

---

## 4. Account en onboarding

### 4.1 Instap

Een nieuwe trainer kan:

1. account aanmaken;
2. e-mail verifiëren;
3. Trainer kiezen;
4. maand of jaar kiezen;
5. checkout afronden;
6. bedrijfs- en trainerprofiel invullen;
7. eerste sporter uitnodigen;
8. dashboard openen.

### 4.2 Trainerprofiel

Minimaal:

- naam;
- profielfoto;
- bedrijfsnaam optioneel;
- KvK-nummer optioneel;
- btw-nummer optioneel;
- factuuradres;
- land;
- specialisaties;
- doelgroep;
- sportdisciplines;
- korte introductie;
- beschikbaarheid;
- contactvoorkeuren.

Gevoelige of commerciële velden alleen opslaan waar nodig.

### 4.3 Hervatten

Onboarding is hervatbaar. Een onderbroken checkout of profielstap mag niet leiden tot een half actief rechtenset zonder duidelijke status.

### 4.4 Bestaand account

Een bestaande Gratis-, Go- of Compleet-gebruiker kan Trainer activeren zonder nieuw account. Persoonlijke sporterdata blijven bestaan en worden niet overschreven.

---

## 5. Sporters koppelen

Volledige flow:

- trainer nodigt sporter uit;
- sporter accepteert of weigert;
- bestaande gebruiker koppelen;
- nieuwe gebruiker registreren;
- rechten vooraf tonen;
- toestemming vastleggen;
- koppeling activeren;
- trainer en sporter ontvangen bevestiging;
- koppeling pauzeren;
- koppeling beëindigen;
- trainerwissel;
- historie behouden;
- toegang direct intrekken na beëindiging.

Geen dubbele actieve koppeling voor dezelfde relatie tenzij de bestaande architectuur dit expliciet ondersteunt.

---

## 6. Abonnements- en betaalflow

Ondersteun minimaal:

- `trialing`;
- `active`;
- `incomplete`;
- `incomplete_expired`;
- `past_due`;
- `unpaid`;
- `paused`;
- `cancel_at_period_end`;
- `cancelled`;
- `refunded`;
- `chargeback`.

### 6.1 Maand naar jaar

- wijziging via bestaande Stripe-flow;
- duidelijke ingangsdatum;
- proratie alleen volgens bestaande facturatie-inrichting;
- vooraf transparante prijs;
- rechten blijven ononderbroken.

### 6.2 Jaar naar maand

- standaard per einde lopende jaartermijn;
- geen stilzwijgende tussentijdse teruggave;
- einddatum zichtbaar.

### 6.3 Opzeggen

- online opzegbaar;
- einddatum zichtbaar;
- toegang blijft tot einde betaalde periode, tenzij refundbeleid anders bepaalt;
- daarna downgrade naar de vooraf vastgelegde trainerloze accountvariant;
- sporters blijven eigenaar van hun data;
- koppelingen worden niet stilzwijgend gewist;
- trainer kan vóór einde periode exporteren.

### 6.4 Pauzeren

Alleen gebruiken wanneer de bestaande commerciële abonnementsarchitectuur pauzeren ondersteunt. Anders de bestaande cancel-at-period-end-flow gebruiken. Bouw geen half pauzesysteem.

### 6.5 Mislukte betaling

- waarschuwing;
- grace-periode via bestaande instellingen;
- geen sportdata verwijderen;
- bij herstel rechten herstellen;
- bij definitieve afloop trainerrechten intrekken volgens statusmachine;
- gekoppelde sporters informeren wanneer hun begeleiding stopt.

### 6.6 Refund en chargeback

- auditplichtig;
- rechten volgens bestaande centrale lifecycle;
- geen automatische verwijdering van trainings- of sportdata;
- duidelijke status in admin.

---

## 7. Limieten en fair use

Omdat nog geen aparte limiet is vastgesteld voor aantal sporters:

1. bouw een configureerbare `trainer_max_active_athletes`;
2. standaardwaarde voor productie: **25 actieve sporters**;
3. gearchiveerde sporters tellen niet mee;
4. bij bereiken limiet:
   - bestaande sporters blijven bruikbaar;
   - nieuwe uitnodiging wordt geblokkeerd;
   - duidelijke melding;
   - geen automatische upgrade zonder toestemming;
5. admin kan de limiet per account verhogen met auditlog;
6. limietwijzigingen zijn versieerbaar.

Deze waarde is een operationele productwaarde binnen dit pakket, geen open eindje.

Fair use meet:

- aantal actieve sporters;
- uitnodigingen;
- berichten;
- exports;
- rapportgeneraties;
- AI-gebruik per trainer.

Fair use blokkeert niet zonder apart productbesluit, behalve de vaste sporterslimiet.

---

## 8. Trainerdashboard

Toon minimaal:

- actieve sporters;
- open uitnodigingen;
- geplande trainingen;
- recente feedback;
- gemiste trainingen;
- aandachtspunten;
- berichten;
- documenten;
- abonnement en facturatie;
- limietgebruik.

Geen voorbeeldsporters of demoresultaten in echte accounts.

Lege toestand:

- uitleg;
- eerste sporter uitnodigen;
- trainerprofiel afronden;
- geen kunstmatig gevulde grafieken.

---

## 9. Communicatie

Ondersteun:

- trainer naar sporter;
- sporter naar trainer;
- bericht bij planwijziging;
- feedback op training;
- uitnodiging;
- ontkoppeling;
- betalings-/abonnementsmelding aan trainer;
- melding aan sporter wanneer trainerrechten eindigen.

Gebruik bestaande communicatie- en notificatieservices. Geen parallel chatsysteem.

Voor minderjarigen gelden de bestaande jeugd- en ouderregels.

---

## 10. Data-eigenaarschap en privacy

1. De sporter blijft eigenaar van zijn persoonsgegevens en sportdata.
2. De trainer krijgt afgeleide toegang via koppeling en toestemming.
3. Na ontkoppeling vervalt toegang onmiddellijk.
4. Trainer mag eigen notities behouden volgens bewaartermijnen, maar geen volledige sporterdata kopiëren buiten de toegestane export.
5. Export wordt gelogd.
6. Toestemming is herroepbaar.
7. Geen toegang tot andere klanten van een traineraccount.
8. Geen datalek tussen traineraccounts.
9. Alle gevoelige acties in auditlog.
10. Accountverwijdering of einde abonnement verwijdert niet automatisch data van sporters.

---

## 11. Admin

Adminweergave minimaal:

- traineraccount;
- lidnummer;
- pakketstatus;
- maand/jaar;
- Stripe customer/subscription;
- actieve sporters;
- limiet;
- laatste webhook;
- betaalstatus;
- trial;
- opzegdatum;
- gekoppelde supporttickets;
- auditlog;
- foutstatussen.

Fijnmazige adminrechten. Niet iedere admin mag refunds, privacydata of pakketwijzigingen uitvoeren.

---

## 12. Database en migratie

Herbruik bestaande:

- users;
- entitlements;
- billing/subscriptiontabellen;
- trainer-athlete-koppelingen;
- invitations;
- auditlogs;
- Stripe webhookevents;
- notificationtabellen.

Voeg alleen ontbrekende velden/tabellen toe.

Migratie-eisen:

- verse database;
- kopie met bestaande gebruikers;
- bestaande Gratis/Go/Compleet-accounts behouden;
- geen pakketwijziging zonder aanleiding;
- unieke koppeling voor Stripe-subscription;
- idempotente migratie;
- rij-aantallen voor/na;
- geen persoonsgegevens verliezen.

---

## 13. UI/UX

### 13.1 Algemeen

- wit, rustig, helder;
- niet technisch;
- geen overvolle beheertabellen als hoofdscherm;
- stappen waar dat eenvoudiger is;
- mobiel en desktop;
- toegankelijke focus, labels, contrast en tikoppervlakken;
- geen merknaam als handelend onderwerp in gewone UI-zinnen.

### 13.2 Prijskaart

Toon:

- €99 per maand;
- €990 per jaar;
- “2 maanden voordeel” bij jaarbetaling;
- inbegrepen functies;
- limiet 25 actieve sporters;
- duidelijke niet-inbegrepen functies;
- geen misleidende urgentie.

### 13.3 Mobiel

- native/mobile-first navigatie;
- geen desktopformulier dat alleen krimpt;
- sporterlijst, berichten, trainingen en feedback snel bereikbaar;
- checkout mag veilige browserflow gebruiken wanneer Stripe dit vereist.

---

## 14. Fout- en lege toestanden

Onderscheid minimaal:

- geen sporters;
- uitnodiging in behandeling;
- uitnodiging verlopen;
- betaling mislukt;
- webhook vertraagd;
- abonnement gepauzeerd;
- rechten verlopen;
- sporter heeft toestemming ingetrokken;
- limiet bereikt;
- providerfout;
- technische fout.

Geen voorbeelddata als fallback.

---

## 15. Tests

Minimaal:

1. nieuw traineraccount start maandabonnement;
2. nieuw traineraccount start jaarabonnement;
3. prijs is exact 99/990;
4. jaar toont 2 maanden voordeel;
5. maand- en jaarprice-ID zijn correct gescheiden;
6. trainerrechten server-side actief;
7. Gratis/Go/Compleet krijgen niet automatisch trainerrechten;
8. bestaande gebruiker activeert Trainer zonder dataverlies;
9. trainer nodigt sporter uit;
10. sporter accepteert;
11. sporter weigert;
12. uitnodiging verloopt;
13. dubbele uitnodiging is idempotent;
14. toestemming bepaalt datatoegang;
15. ontkoppeling trekt toegang direct in;
16. directe API-call zonder recht faalt;
17. trainer ziet geen niet-gekoppelde sporter;
18. limiet van 25 actieve sporters wordt afgedwongen;
19. bestaande 25 blijven bruikbaar;
20. gearchiveerde sporter telt niet;
21. maand naar jaar werkt;
22. jaar naar maand gaat per einde termijn;
23. cancel-at-period-end behoudt rechten tot einddatum;
24. mislukte betaling geeft juiste status;
25. herstel betaling herstelt rechten;
26. chargeback verwijdert geen sportdata;
27. refund wordt gelogd;
28. dubbele webhook is idempotent;
29. vertraagde webhook geeft geen onjuiste dubbele rechten;
30. admin ziet juiste status;
31. niet-bevoegde admin kan geen refund;
32. sporterdata lekt niet tussen trainers;
33. trainerdashboard toont lege toestand zonder mockdata;
34. desktopflow werkt;
35. mobiele flow werkt;
36. merknaamregel wordt gerespecteerd;
37. bestaande Gratis/Go/Compleet-entitlements blijven groen;
38. bestaande trainer-koppelingstests blijven groen;
39. factuur- en e-mailtemplates gebruiken juiste prijs;
40. opzegging verwijdert geen account of sporterdata.

---

## 16. Mirror-scenario’s

Mirror toetst minimaal:

- nieuw account → maand;
- nieuw account → jaar;
- bestaande sporter → Trainer activeren;
- trainerprofiel;
- eerste sporter uitnodigen;
- accepteren/weigeren/verlopen;
- rechten per sporter;
- limiet 25;
- maand/jaar wisselen;
- mislukte betaling;
- herstel;
- opzeggen;
- sporter ontkoppelen;
- directe API-omzeiling;
- desktop;
- mobiel;
- data-trust;
- geen clubrechten;
- geen toegang tot andere trainers;
- geen mockdata;
- juiste prijs en factuur.

---

## 17. Bewijsformat

Per regel:

- commando;
- resultaat;
- exitcode.

Daarnaast:

- start-SHA;
- eind-SHA;
- gewijzigde bestanden;
- migraties;
- Stripe price/product-ID’s;
- API-contracten;
- screenshots desktop;
- screenshots mobiel;
- directe API-bewijzen;
- testresultaten;
- bekende restpunten;
- bevestiging dat geen club-, marktplaats- of uitbetalingsfunctionaliteit is vooruitgebouwd.

---

## 18. Stopcondities

Stop alleen wanneer:

- Stripe-status niet betrouwbaar server-side beschikbaar is;
- bestaande trainer-koppeling niet veilig herbruikbaar is;
- migratie echte gebruikersdata kan verliezen;
- trainerrechten alleen via grote architectuurherschrijving kunnen worden toegevoegd;
- juridische verkoopstructuur ontbreekt voor productiecheckout.

Geen stopconditie:

- lege testdatabase;
- nog geen echte betalende trainer;
- ontbrekende demo-inhoud;
- mobiele simulator tijdelijk niet beschikbaar zolang code- en geautomatiseerd bewijs wordt geleverd en dit eerlijk wordt gemeld.

---

## 19. Definition of Done

Pas klaar wanneer:

- €99/maand en €990/jaar correct werken;
- checkout, facturatie, webhooks en rechten end-to-end werken;
- trainer sporters veilig kan koppelen en begeleiden;
- 25 actieve sporters correct wordt afgedwongen;
- maand/jaarwijziging, opzegging en wanbetaling werken;
- alle privacy- en toegangsregels server-side zijn afgedwongen;
- desktop en mobiel bruikbaar zijn;
- geen mock-, seed-, demo- of fallbackdata als echte data;
- alle tests groen zijn;
- volledig bewijs is geleverd;
- geen parallel abonnements- of rechtensysteem is gebouwd.

---

## 20. Verboden

- geen nieuw losstaand billing-systeem;
- geen tweede trainer-koppelmodel;
- geen automatische clubrechten;
- geen verborgen kosten;
- geen onbeperkte sporters zonder configureerbare grens;
- geen UI-only rechten;
- geen echte data verwijderen;
- geen marktplaats of uitbetaling vooruitbouwen;
- geen aanpassing van bestaande Gratis/Go/Compleet-prijzen.
