# CLUB_COMMUNICATIE_01 — REPLIT-BOUWOPDRACHT

**Onderwerp:** CLUB- EN TEAMCOMMUNICATIE  
**Uitvoerder:** Replit Agent  
**Type:** breed domeinpakket  
**Startcommit:** actuele `main`; SHA bevestigen in het eindrapport  
**Vrijgave:** René  
**Grondslag:** actuele repository, besluitregister, afbouwmatrix en `SPARKI_SJABLOON_DOMEINPAKKET`

## 1. Doel

Maak veilige, rolgestuurde communicatie tussen club, team, trainer, sporter, ouder, ploegleider en mechanieker volledig werkend via in-app, push en e-mail.

Na oplevering is aantoonbaar waar:

1. individueel bericht
2. team- en clubbericht
3. rolgerichte mededeling
4. thread en reactie
5. bijlage delen
6. push/e-mailvoorkeuren
7. lees- en afleverstatus
8. noodbericht
9. blokkeren, melden en modereren
10. communicatie met minderjarigen en ouderinzage

## 2. Definition of Done

Deze opdracht is pas volledig uitgevoerd wanneer:

1. de hele gebruikersketen uit §1 op desktop, PWA en native mobiel werkt;
2. frontend, backend, database, rechten, communicatie, foutpaden en lege toestanden zijn afgerond;
3. bestaande architectuur is hergebruikt en geen tweede domeinsysteem is ontstaan;
4. alle nieuwe en relevante bestaande tests groen zijn;
5. migratie op een verse database én een representatieve kopie met bestaande data is bewezen;
6. directe API-aanroepen dezelfde rechten afdwingen als de UI;
7. alle gevraagde bewijsstukken en eindcommit zijn opgeleverd;
8. geen zichtbare flow “bijna klaar”, placeholder of mockgedreven is.

## 3. Buiten scope

- openbaar sociaal netwerk
- marketingcampagnes en nieuwsbrieven
- nieuwe chatprovider als bestaande services volstaan
- videovergaderen
- algemene CRM-functionaliteit

Bouw niets vooruit uit opvolgende domeinpakketten. Ontbrekende uitbreidingspunten mogen als contract of referentie worden vastgelegd, maar niet als halfwerkende functie.

## 4. Eerst vaststellen en hergebruiken

Controleer vóór bouwen de bestaande implementatie van:

- club- en teamrechten
- jeugd/oudertoestemming
- documentenservice
- notificatie- en e-mailservice
- auditlog
- dataretentie en privacy

Lever in het eindrapport per bouwsteen: **hergebruikt**, **gericht uitgebreid**, **niet aanwezig**, of **conflict gevonden**. Een conflict is alleen een stopconditie wanneer veilig hergebruik onmogelijk is.

## 5. Product- en gebruikersregels

1. Iedere handeling heeft één aantoonbare eigenaar, actor, tijdstip en bron.
2. Eén gebruiker kan meerdere rollen hebben; de effectieve rechten zijn de veilige unie binnen de juiste club/team-/accountcontext, nooit globale verruiming.
3. Historie blijft behouden bij wijziging, beëindiging of intrekking; niets wordt stilzwijgend gewist.
4. Persoons-, jeugd-, gezondheids-, locatie-, betaal- en communicatiegegevens worden alleen getoond wanneer rol én toestemming dat toelaten.
5. Statusovergangen zijn expliciet, server-side gevalideerd, idempotent en auditbaar.
6. Een mislukte externe provideractie mag geen succesvolle interne status tonen.
7. Lege toestanden zijn eerlijk; ontbrekende data wordt niet aangevuld met voorbeeldinhoud.
8. De gebruiker krijgt korte, concrete Nederlandse uitleg bij blokkade, fout of vervolgstap.
9. Gelijktijdige acties mogen geen dubbele records, dubbele betaling, dubbele uitnodiging of tegenstrijdige status veroorzaken.
10. Verwijderen is waar mogelijk herstelbaar of historisch traceerbaar; permanente verwijdering volgt alleen expliciete privacy- of bewaarbeleidsregels.

## 6. Rollen en rechten

Neem minimaal deze rollen mee:

- clubeigenaar
- clubbeheerder
- hoofdtrainer
- trainer
- assistent
- ploegleider
- mechanieker
- ouder/verzorger
- sporter/jeugdsporter
- moderator/support

Maak een server-side rechtenmatrix met per actie: bekijken, aanmaken, wijzigen, verwijderen/intrekken, exporteren/delen, gevoelige data zien en auditgegevens zien. Test zowel toegestane als verboden combinaties.

## 7. Datamodel en migratie

Gebruik bestaande tabellen waar mogelijk. Wanneer huidige structuren onvoldoende zijn, voeg alleen additieve velden/tabellen toe rond:

- conversation
- conversation_member
- message
- message_delivery
- message_attachment
- notification_preference
- communication_block
- communication_report
- moderation_action
- emergency_broadcast

Migratieregels:

1. bestaande echte data blijft behouden;
2. geen eigenaar, rol, pakket of toestemming raden;
3. onbekende of conflicterende rijen gaan naar een rapport/quarantaine, niet naar een verzonnen geldige status;
4. unieke sleutels en databaseconstraints borgen idempotentie en tenantisolatie;
5. migratie is herhaalbaar en veilig na gedeeltelijke fout;
6. test op lege database en kopie met bestaande data;
7. rapporteer rij-aantallen, conflicten, defaults en rollbackgedrag;
8. rollback maakt bestaande records niet onzichtbaar of onbereikbaar.

## 8. Backend en API

Bouw of herstel uitsluitend de benodigde endpoints voor de flows uit §1.

Eisen:

- auth, tenantcontext, rol, pakket en toestemming op elk endpoint;
- requestvalidatie en begrijpelijke foutcodes;
- idempotency keys of database-uniciteit op herhaalbare mutaties;
- transacties bij gekoppelde statuswijzigingen;
- paginering en begrensde queries voor lijsten;
- geen N+1-querygedrag in hoofdschermen;
- auditlog met actor, doel, oude/nieuwe status, reden en correlatie-ID;
- directe API-aanroep kan geen verborgen UI-functie omzeilen;
- providerfout en interne fout worden onderscheiden;
- exports en bijlagen gebruiken dezelfde rechten als brondata.

## 9. Frontend en visuele kwaliteit

- witte, rustige en heldere Sparki-richting;
- één primaire actie per scherm of stap;
- geen technisch beheerformulier als gebruikersflow;
- desktop gebruikt overzichtelijke twee-koloms of tabel/detail-layout waar passend;
- mobiel gebruikt stappen, kaarten en vaste veilige actiezone; geen horizontaal knippen;
- duidelijke statuschips met gewone Nederlandse namen;
- contextuele uitleg achter compact informatie-icoon;
- skeleton alleen tijdens laden, niet als permanente placeholder;
- onderscheid tussen leeg, fout, geen recht, actie vereist en verwerking bezig;
- toetsenbord, schermlezerlabels, focus, tikdoelen en schaalbare tekst;
- geen merknaam als handelend onderwerp in gewone UI-zinnen.

## 10. Communicatie en notificaties

Gebruik bestaande communicatiebouwstenen. Iedere relevante mutatie definieert:

- wie bericht krijgt;
- kanaal (in-app, push, e-mail) en gebruikersvoorkeur;
- welke gegevens minimaal nodig zijn;
- afleverstatus en retrygedrag;
- voorkomen van dubbele verzending;
- intrekken of corrigeren waar relevant;
- auditlog zonder onnodige gevoelige inhoud.

## 11. Fout- en lege toestanden

Onderscheid minimaal:

- nog geen data;
- onvoldoende rechten;
- toestemming ontbreekt;
- validatiefout;
- conflict of duplicaat;
- provider tijdelijk niet bereikbaar;
- verwerking bezig;
- gedeeltelijk mislukt;
- technische fout;
- verouderde of ingetrokken status.

Elke toestand heeft een concrete vervolgstap. Geen kale foutcode en geen voorbeelddata.

## 12. Privacy, data-trust en veiligheid

- eigenaarschap en tenantisolatie server-side;
- dataminimalisatie per rol en scherm;
- gevoelige vrije tekst niet onnodig loggen;
- exports en e-mails bevatten alleen toegestane velden;
- geen data gebruiken voor AI zonder geldige bron en toestemming;
- destructieve bulkacties eerst dry-run en expliciete bevestiging;
- testaccounts herkenbaar en uitsluitend in testomgeving;
- auditlog is niet wijzigbaar via gewone gebruikersendpoints.

## 13. Verplichte automatische tests

1. trainer kan eigen team berichten maar geen ander team
2. clubbeheerder kan clubbrede mededeling sturen
3. mechanieker kan alleen materiaalrelevante doelgroep bereiken
4. minderjarige ontvangt geen verboden direct bericht
5. ouderinzage volgt toestemming en clubbeleid
6. bijlage respecteert documentrechten
7. push en e-mail bevatten geen onnodige gevoelige data
8. dubbele providerretry verzendt niet dubbel
9. leesstatus hoort alleen bij juiste ontvanger
10. meldingsvoorkeuren worden gerespecteerd
11. blokkeren voorkomt nieuw direct contact
12. moderatieactie heeft reden en auditlog
13. cross-club API-aanroep faalt
14. noodbericht vereist extra bevestiging
15. providerfout toont eerlijke status
16. geen voorbeeldgesprekken als echte data

Voeg daarnaast toe:

- typecheck en build;
- regressie op gedeelde lagen uit §4;
- gelijktijdigheids-/retrytest voor de belangrijkste mutatie;
- tenantisolatietest;
- mobile/web contractpariteit;
- foutpad zonder fallbackdata.

## 14. Acceptatiecriteria

1. Iedere bevoegde rol kan de juiste doelgroep bereiken zonder dat berichten, bijlagen of gevoelige gegevens tussen teams, clubs of huishoudens lekken.
2. Alle productregels en rollen zijn server-side afgedwongen.
3. Er is geen datalek tussen accounts, clubs, teams of rollen.
4. Bestaande Mirror-bewezen functies in gedeelde lagen werken ongewijzigd.
5. Geen mock-, seed-, demo- of fallbackdata wordt als echte data getoond.
6. Desktop, PWA en native mobiel hebben een volledige bruikbare flow.
7. Alle tests, typechecks en builds eindigen met exitcode 0.
8. Migratie en rollback zijn aantoonbaar veilig.

## 15. Bewijsformat

Geen verhalend verslag als vervanging van bewijs. Lever per regel: **commando — resultaat — exitcode**.

Daarnaast:

- start-SHA en eind-SHA;
- lijst gewijzigde bestanden met reden;
- hergebruikte services/tabellen;
- migratie vóór/na met rijaantallen;
- API-contracten;
- rechtenmatrix;
- desktop- en mobiele screenshots/video;
- directe toegestane en verboden API-aanroepen;
- auditlogvoorbeeld;
- providerfout- en retrybewijs;
- bekende beperkingen die buiten scope vallen.

## 16. Stopcondities

Stop alleen wanneer:

1. veilige tenant-/eigenaarschapsbepaling ontbreekt;
2. een migratie bestaande echte data kan verliezen;
3. de noodzakelijke provider of betaalbasis geheel ontbreekt en niet binnen bestaande architectuur kan worden hergebruikt;
4. uitvoering een nieuw productbesluit vereist dat toegang, geld, jeugd, privacy of veiligheid wezenlijk verandert;
5. alleen een grote architectuurherschrijving de flow mogelijk maakt.

Geen stopconditie:

- een ontbrekende operationele limiet die veilig configureerbaar kan worden gemaakt;
- een leeg testaccount;
- een provider die in tests met officiële sandbox/fake-adapter kan worden getest;
- een niet-kritische visuele verfijning nadat de volledige flow al werkt.


## Werkregels

1. Gebruik de actuele `main` als bron van waarheid en leg start-SHA vast vóór wijziging.
2. Inventariseer alleen de relevante bestaande tabellen, services, endpoints en schermen; hergebruik die en bouw geen parallel systeem.
3. Alle rechten, statussen, prijzen en mutaties worden server-side afgedwongen. UI-verbergen is nooit de beveiliging.
4. Fail-closed bij onbekende rechten, pakketstatus, eigenaarschap of toestemming.
5. Geen mock-, seed-, demo-, fallback- of hardcoded persoonlijke data als echte gebruikersdata.
6. Geen app-brede refactor en geen wijziging buiten dit domein zonder aantoonbare technische noodzaak.
7. Bestaande tests worden niet verzwakt, verwijderd of aangepast om een fout te laten verdwijnen. Een noodzakelijke testvervanging wordt eerst als blokkade gemeld.
8. Gewone UI-zinnen gebruiken de merknaam niet als handelend onderwerp. Pakketnamen en formele/juridische context zijn uitgezonderd.
9. Desktop, PWA en native mobiel krijgen dezelfde productregels en rechten, met een apparaatgeschikte interface.
10. Meld eerlijk wat niet live of mobiel kon worden bewezen.
