# CLUB_PLANNING_01 — ONAFHANKELIJKE MIRROR-TOETS

**Toetser:** Mirror  
**Voorwaarde:** Replit heeft de volledige opdracht op een vaste eindcommit opgeleverd  
**Identiteiten:** echte DEV-testpersona's; nooit `legacy_unrestricted`

## 1. Eerst vastleggen

Noteer vóór testen:

- eindcommit-SHA;
- actieve featureflags;
- pakket en rollen van iedere persona;
- club/team/accountcontext;
- gebruikte provider-sandboxen;
- desktopviewport en echte native mobiele testmethode.

## 2. Toetsdoel

Bewijs niet alleen dat de flow werkt, maar dat zij **uitsluitend** werkt voor de juiste gebruiker, rol, pakketstatus en toestemming. De toets zoekt actief naar te brede rechten, dubbele verwerking, verborgen datalekken, misleidende lege toestanden en regressies.

## 3. Kernscenario's

1. seizoen met herhaling plannen
2. één event wijzigen versus hele reeks
3. wachtlijst met gelijktijdige vrijgave
4. jeugddeelname met ouderbevestiging
5. tijdzone rond zomer/wintertijd
6. directe API-aanroep naar ander team
7. kalenderexport intrekken
8. annulering en notificaties

## 4. Omgekeerde risico's

Toets minimaal:

1. een onbevoegde rol voert dezelfde directe API-call uit;
2. een account uit een andere club/teamcontext gebruikt een bestaand ID;
3. dezelfde mutatie wordt gelijktijdig of herhaald ingestuurd;
4. providerresponse komt vertraagd, dubbel of niet;
5. een record wordt ingetrokken/verwijderd terwijl een ander scherm het open heeft;
6. een leeg account toont geen voorbeelddata;
7. mobiel en desktop tonen dezelfde status en rechten;
8. auditlog bevat actor en reden maar geen onnodige gevoelige inhoud.

## 5. Regressie

Controleer de gedeelde lagen:

- club/teamrechten
- persoonlijke kalender en notificaties
- jeugd/oudertoestemming
- wedstrijd- en trainingsreferenties
- auditlog
- tijdzone-infrastructuur

Eerder Mirror-bewezen gedrag mag niet zijn verruimd, geblokkeerd of stilzwijgend vervangen.

## 6. Data-trust

- controleer bron, eigenaar en tijdstip van getoonde gegevens;
- test lege, verouderde, fout- en synchronisatietoestand;
- zoek naar mock-, demo-, seed- en fallbackinhoud;
- controleer dat exports, mails en PDF's dezelfde actuele data tonen als de UI.

## 7. Apparaten

- desktop;
- PWA op echte smalle viewport;
- native mobiele app/Expo of simulator;
- meld eerlijk wanneer een apparaat niet werkelijk visueel getest kon worden.

## 8. Afkeuringsgronden

Afkeuren bij minimaal één van deze punten:

- volledige kernflow niet af te ronden;
- directe API-omzeiling mogelijk;
- datalek tussen accounts, teams, clubs of rollen;
- dubbele status/betaling/bericht/uitgifte door retry;
- mock- of fallbackdata als echt;
- destructieve migratie of onveilige rollback;
- mobiel of desktop mist essentiële handeling;
- audittrail ontbreekt voor gevoelige mutatie;
- eerder Mirror-bewezen functie is gebroken.

## 9. Rapportvorm

Per scenario:

| Persona/rol | Platform | Actie | Verwacht | Werkelijk | Bewijs | PASS/FAIL |
|---|---|---|---|---|---|---|

Vermeld apart wat niet toetsbaar was en waarom.

## 10. Eindoordeel

Geef exact één oordeel:

- **GOEDGEKEURD**
- **AFGEKEURD — concrete blokkade(s)**
- **NIET BEWIJSBAAR — ontbrekende toegang of bewijs**

Mirror wijzigt geen code en versoepelt geen acceptatiecriteria.
