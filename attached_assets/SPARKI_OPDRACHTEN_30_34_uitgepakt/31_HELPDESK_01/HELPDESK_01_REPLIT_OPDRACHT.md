# BOUWOPDRACHT — AI-HELPDESK EN SUPPORT

**Code:** `HELPDESK_01`  
**Uitvoerder:** Replit  
**Type:** breed domeinpakket  
**Startcommit:** vóór start bevestigen  
**Vrijgave:** opdracht integraal uitvoeren; Mirror staat los van de bouw  

## Doel

Bouw één complete helpdesk waarin gebruikers vragen, storingen, abonnementen, betalingen, privacy- en gebruiksproblemen kunnen melden, automatisch gekoppeld aan hun account en lidnummer, met veilige AI-triage, menselijke escalatie, audittrail en eerlijke statussen.

## Scope

- supportformulier en vrije supportchat;
- ticketregistratie en categorieën;
- koppeling aan lidnummer en accountcontext;
- AI-triage en samenvatting;
- kennisbank en oplossingsvoorstellen;
- escalatie naar mens/beheerder;
- statussen, prioriteiten en SLA-indicatie;
- bijlagen en screenshots;
- abonnement-, betaling-, privacy- en technische vragen;
- club-, trainer-, ouder-, jeugd- en materiaalvragen;
- notificaties en e-mail;
- auditlog, privacy en bewaartermijnen;
- desktop en mobiel;

## Buiten scope

- autonome refunds;
- autonome accountverwijdering;
- juridische of medische eindbeslissingen;
- algemene marketingchat;
- nieuw CRM;

## Eerst doen: actuele codebasis vaststellen

1. Noteer start-SHA.
2. Zoek bestaande services, routes, tabellen, schermen en tests die dit domein raken.
3. Hergebruik wat werkt.
4. Meld afwijkingen tussen deze opdracht en de actuele code vóór je een parallel pad bouwt.
5. Bouw daarna de volledige gebruikersflow af; geen inventarisatierapport als vervanging van code.

## Datamodel en migratie

Gebruik bestaande structuren en voeg alleen ontbrekende velden of tabellen toe. Verwachte domeinobjecten omvatten minimaal:

- `support_tickets`
- `ticket_messages`
- `ticket_attachments`
- `ticket_links`
- `ticket_audit`
- `knowledge_articles`
- `escalations`
- `support_permissions`

Eisen:
- migratie op verse database én kopie met bestaande data;
- rij-aantallen voor en na;
- idempotent;
- geen verlies van echte data;
- onzekere data in quarantaine, niet willekeurig corrigeren;
- rollback of terugwaarts veilige migratie aantonen.

## Frontend en UX

- wit, rustig en helder;
- begeleide stappen waar een lang formulier onnodig zwaar is;
- geen technische beheerinterface voor gewone gebruikers;
- eerlijke lege, fout-, sync- en verouderde toestanden;
- natuurlijke Nederlandse taal;
- gewone UI-zinnen gebruiken de merknaam niet als handelend onderwerp;
- desktop en mobiel worden afzonderlijk ontworpen, niet alleen verkleind;
- toegankelijke labels, focus, contrast en tikoppervlakken.

## Backend en API

- centrale service-laag;
- idempotente writes;
- ownership- en rolcontrole op elke write en gevoelige read;
- auditlog voor gevoelige acties;
- consistente foutcodes;
- directe API-aanroepen mogen de UI-beperkingen niet omzeilen;
- geen ongevalideerde vrije tekst in logs of e-mails.

## Rechten en privacy

- least privilege;
- expliciete eigenaar en scope per record;
- toestemming is herroepbaar;
- beëindiging van relatie trekt afhankelijke toegang direct in;
- geen datalek tussen accounts, teams, clubs of rollen;
- adminrechten fijnmazig;
- privacyverzoeken en bewaartermijnen volgen centrale governance.

## Fout- en lege toestanden

Onderscheid minimaal:
- geen data;
- onvoldoende data;
- verouderde data;
- synchronisatie bezig;
- rechtenprobleem;
- providerfout;
- validatiefout;
- technische fout.

## Automatische tests

1. ingelogde melding koppelt automatisch aan juiste lidnummer.
2. niet-ingelogde melding vereist veilige verificatie.
3. AI mag triëren maar geen refund of verwijdering uitvoeren.
4. ticket lekt niet tussen accounts.
5. trainer ziet alleen eigen tickets en toegestane sportercontext.
6. clubticket blijft binnen clubscope.
7. jeugdticket volgt ouder-/toestemmingsregels.
8. bijlagen worden gevalideerd en veilig opgeslagen.
9. statusovergangen zijn auditbaar.
10. e-mail en in-appstatus blijven synchroon.
11. privacyverzoek krijgt aparte beveiligde flow.
12. directe API-call kan geen ander ticket lezen.
13. lege en fouttoestanden zijn eerlijk.
14. desktop en mobiel werken gelijkwaardig.

Voeg aanvullend toe:
- regressie op gedeelde rechten- en datatrustlagen;
- directe API-omzeiltests;
- migratietests;
- desktop- en mobiele componenttests;
- geen mock- of seeddata in normale accounts.

## Acceptatiecriteria

1. De volledige primaire gebruikersflow werkt end-to-end.
2. Alle rechten worden server-side afgedwongen.
3. Bestaande gebruikersdata blijft behouden.
4. Geen eerder Mirror-bewezen flow wordt gebroken.
5. Desktop en mobiel zijn bruikbaar en functioneel gelijkwaardig.
6. Alle nieuwe en relevante bestaande tests zijn groen.
7. Bewijs bevat start-SHA, eind-SHA, gewijzigde bestanden, migraties, API-contracten, screenshots en exitcodes.
8. Er is geen parallel systeem gebouwd.

## Stopcondities

Stop alleen wanneer:
- echte productiegegevens aantoonbaar gevaar lopen;
- noodzakelijke rechten of eigenaarschap niet betrouwbaar te bepalen zijn;
- een grote architectuurherschrijving onvermijdelijk lijkt;
- een werkelijk ontbrekend productbesluit de flow onmogelijk maakt.

Geen stopconditie:
- lege testdatabase;
- nog geen echte gebruikers;
- ontbrekende demo-inhoud;
- tijdelijk ontbrekende mobiele simulator, mits dit eerlijk wordt gemeld en geautomatiseerd bewijs beschikbaar is.

## Bewijsformat

Per commando:
- commando;
- resultaat;
- exitcode.

Verder:
- start-SHA / eind-SHA;
- gewijzigde bestanden met reden;
- migratiebewijs;
- API-bewijs;
- desktop- en mobiele screenshots;
- testresultaten;
- bekende restpunten;
- bevestiging dat buiten-scopeonderdelen niet vooruit zijn gebouwd.

## Definition of Done

Pas klaar wanneer de volledige scope gebouwd, getest en aantoonbaar werkend is; geen half uitgevoerde opdracht en geen rapport als vervanging van code.

## Werkregels

1. Hergebruik de bestaande architectuur, services, tabellen, componenten en rechten.
2. Geen parallel systeem en geen complete herschrijving zonder aantoonbare noodzaak.
3. Server-side waarheid; de UI volgt.
4. Fail-closed bij onbekende rechten, ontbrekende toestemming of onbetrouwbare data.
5. Geen mock-, seed-, demo- of fallbackdata als echte gebruikersdata.
6. Geen zichtbare functie verbergen om een defect te ontwijken.
7. Geen productbesluiten verzinnen. Operationele waarden mogen configureerbaar worden gemaakt.
8. Bestaande tests worden niet verzwakt. Onhoudbare test = bevinding.
9. Desktop en mobiel moeten dezelfde product- en rechtenbesluiten volgen.
10. Iedere destructieve wijziging begint met dry-run, bewijs en herstelpad.

