# SPARKI — BESLUITEN EN BOUWVERDELING CLUB, TEAM EN ROLLEN

**Datum:** 1 augustus 2026  
**Status:** bindend  
**Beslisser:** René Vink  
**Voorrang:** dit document vervangt conflicterende oudere teksten over Club, Team, rollen, medische begeleiding en onboarding.

## 1. De vijftien bindende besluitpunten

1. `teammanager` blijft een zelfstandige administratieve teamrol.
2. `ploegleider` wordt als nieuwe, zelfstandige server-side rolwaarde toegevoegd.
3. `teammanager` en `ploegleider` worden niet samengevoegd en niet hernoemd.
4. Bestaande `teammanager`-toekenningen blijven intact.
5. `medic` wordt vervangen door `medical_staff`.
6. `medical_staff` krijgt een apart functietype, zoals arts, fysiotherapeut, diëtist, sportpsycholoog, inspanningsfysioloog of overig.
7. Hoofdstuk J wordt aangepast: diëtist is geen losse rolwaarde meer, maar een functietype binnen `medical_staff`.
8. `CLUB_RECHTEN_01` beheert het centrale rollen- en rechtenmodel.
9. `PLOEGLEIDER_01`, `TEAM_MECHANIEKER_01` en medische/teamflows gebruiken dit centrale model en bouwen geen eigen rechtenlaag.
10. Organogram-kaarten mogen alleen rollen tonen die server-side bestaan.
11. Organogram-kaarten worden uitsluitend gebruikt bij het aanmaken van de conceptstructuur.
12. Na activering wordt geen nieuw sjabloon over bestaande roltoekenningen gelegd.
13. Bestaande personen en rollen mogen nooit verdwijnen door een latere structuurwijziging.
14. Organogram-kaarten tonen rolplekken, geen voorbeeldpersonen.
15. `TEAM_ONBOARDING_01` wordt als apart bouwpakket toegevoegd voor teamstructuur, staf, uitnodigingen en organogram-kaarten.

## 2. Aanvullende bindende besluiten

### 2.1 Member / Sporter

- De technische rolwaarde `member` blijft bestaan.
- De gebruikersgerichte naam is **Sporter**.
- Er wordt geen tweede technische rolwaarde `sporter` toegevoegd.
- Bestaande `member`-toekenningen worden niet gemigreerd.
- UI en organogrammen tonen “Sporter”; database, API en rechtenlaag gebruiken `member`.

### 2.2 Medical staff

- `medical_staff` is één centrale rol.
- Het functietype is uitsluitend beschrijvend profielmetadata.
- Het functietype verleent geen zelfstandige rechten.
- Toegang volgt uit de rol `medical_staff`, team-/sporterrelatie, expliciete toestemming en minimale noodzakelijke toegang.
- Er wordt geen rechtenmatrix per medisch functietype gebouwd.

### 2.3 Teamprijs

Sparki Team is vastgesteld op:

- €149 per maand;
- €1.490 per jaar;
- 14 dagen proef, binnen de bestaande centrale abonnementsarchitectuur.

### 2.4 Medisch dossier na einde teamrelatie

- Teamtoegang stopt direct.
- De sporter behoudt het eigen dossier.
- Professionele notities blijven alleen voor de bevoegde opsteller beschikbaar binnen de toepasselijke wettelijke bewaartermijn.
- Het dossier blijft niet als actief teamdossier beschikbaar.

## 3. Definitief organisatiemodel

### 3.1 Club

Een Club is een opleidings-, leden- en trainingsorganisatie.

Kernrollen:

- eigenaar;
- clubbeheerder;
- hoofdtrainer;
- trainer;
- assistent-trainer;
- vrijwilliger;
- ouder/verzorger;
- member, zichtbaar als Sporter;
- alleen-lezen.

### 3.2 Team

Een Team is een zelfstandige wedstrijd- en prestatieorganisatie.

Een Team hoeft productmatig niet binnen een Club te bestaan.

Technisch wordt geen tweede organisatie-entiteit gebouwd. De bestaande organisatiecontainer wordt hergebruikt:

- een zelfstandige Team-organisatie wordt opgeslagen in de bestaande `clubs`/organisatiearchitectuur met organisatietype `TEAM`;
- een Club-organisatie gebruikt organisatietype `CLUB`;
- `club_teams` wordt hergebruikt voor selecties, ploegen of subteams binnen zowel Club als Team;
- de bestaande Team-checkout met `club_id`-metadata blijft daarmee bruikbaar als organisatie-ID en betekent niet dat een Team productmatig een Club is.

Kernrollen Team:

- eigenaar;
- teammanager;
- ploegleider;
- trainer;
- mechanieker;
- soigneur;
- medical_staff;
- member, zichtbaar als Sporter;
- alleen-lezen, zichtbaar als Gast waar passend.

Een Team-organisatie kan meerdere selecties of subteams bevatten, bijvoorbeeld elite, U23, junioren, dames of development.

## 4. Organogram-onboarding

### Clubkaarten

1. Kleine club
2. Club met jeugdafdeling
3. Grote vereniging
4. Zelf samenstellen

### Teamkaarten

1. Compact wedstrijdteam
2. Prestatieploeg
3. Etappe-/koersorganisatie
4. Zelf samenstellen

Regels:

- kaarten tonen alleen server-side bestaande rollen;
- kaarten maken uitsluitend een conceptstructuur;
- kaarten leiden geen rechten af;
- na activering worden rollen, groepen en relaties afzonderlijk beheerd;
- een nieuw sjabloon kan niet destructief over een actieve organisatie worden gelegd;
- geen mockpersonen of voorbeeldnamen;
- echte namen verschijnen pas na geaccepteerde uitnodiging of geldige koppeling;
- onderbroken onboarding is hervatbaar.

## 5. Pakketeigenaarschap

### CLUB_RECHTEN_01

Eigenaar van:

- technische rolwaarden;
- scopes;
- server-side autorisatie;
- meerdere rollen per gebruiker;
- auditlog;
- roltoekenning en intrekking;
- eigendomsoverdracht;
- medische toestemming;
- migratie van `medic` naar `medical_staff`.

### CLUB_ONBOARDING_01

Bouwt alleen Club-onboarding en gebruikt het centrale rollenmodel.

Variant 1 is bindend. Variant 2 wordt `SUPERSEDED` en blijft alleen als historie bewaard.

### TEAM_ONBOARDING_01

Nieuw pakket voor:

- zelfstandige Team-organisatie aanmaken;
- organisatietype `TEAM` binnen de bestaande organisatiecontainer;
- selecties/subteams;
- stafstructuur;
- teamorganogram-kaarten;
- uitnodigingen;
- hervatten;
- activeren;
- mobiel en desktop.

### PLOEGLEIDER_01

Bouwt alleen de operationele ploegleiderflow en geen rechtenarchitectuur.

### TEAM_MECHANIEKER_01

Bouwt alleen materiaal- en mechaniekerflows en geen rechtenarchitectuur.

### TEAM_ABONNEMENT_01

Bouwt abonnement, Stripe, centrale facturatie en pakketstatus. Het definieert geen operationele rolwaarden.

## 6. Migratievolgorde

1. Tel bestaande toekenningen van `medic`, `teammanager`, `member` en `alleen_lezen`.
2. Bij nul `medic`-toekenningen: schema- en codewijziging zonder persoonsdatamigratie.
3. Bij bestaande `medic`-toekenningen: gecontroleerde migratie naar `medical_staff`, met rijaantallen, audit en rollbackbewijs.
4. `teammanager` blijft ongewijzigd.
5. `member` blijft ongewijzigd.
6. `ploegleider` wordt als nieuwe lege rolwaarde toegevoegd.

## 7. Verplichte bouwvolgorde

1. Deze besluiten synchroniseren in Hoofdstuk J, besluitregister en relevante bouwpakketten.
2. Documentatiesynchronisatie committen en pushen.
3. Daarna de technische baseline-SHA vastzetten.
4. Bestaande roltoekenningen tellen.
5. `CLUB_RECHTEN_01` bouwen en migreren.
6. Mirror-toets op vaste SHA.
7. René geeft vrij.
8. `CLUB_ONBOARDING_01` bouwen.
9. `TEAM_ONBOARDING_01` bouwen.
10. `PLOEGLEIDER_01` bouwen.
11. `TEAM_MECHANIEKER_01` bouwen.
12. Medische teamflow bouwen.
13. Team-abonnement aansluiten en opnieuw toetsen.
14. Volledige end-to-end toets.
15. Praktijktest René/Dylan waar relevant.
16. René geeft definitieve vrijgave.

De documentatiesynchronisatie gebeurt dus vóór de technische meetbaseline. Daarna blijft de baseline stabiel tijdens de eerste statusopname. Latere documentcommits worden apart gemarkeerd en wijzigen de technische status niet.

## 8. Documentatie-opdracht versus code-eigenschappen

Een documentatie-opdracht controleert uitsluitend:

- geen oude medische rol **in actieve documentatie**;
- geen dubbele rollen **in actieve documentatie**;
- geen dubbele rechtenarchitectuur **in actieve documentatie en bouwpakketten**;
- geen actieve oude onboardingvariant;
- geen overlappende pakketverantwoordelijkheden.

De code-eigenschappen worden pas na bouw door Replit en Mirror bewezen. Een documentatie-opdracht mag daarvoor geen groen claimen en mag geen productcode wijzigen.

## 9. Verdeling van verantwoordelijkheden

### René

- enige productbeslisser;
- enige product- en releasevrijgever.

### Claude

- synchroniseert Hoofdstuk J, besluitregister en bouwpakketten;
- maakt `TEAM_ONBOARDING_01` volledig als bouwpakket;
- markeert conflicterende documentatie `SUPERSEDED`;
- wijzigt geen productcode.

### Replit

- levert na de documentatiesynchronisatie een schone technische baseline;
- telt bestaande roltoekenningen;
- bouwt volgens de verplichte volgorde;
- commit en pusht iedere oplevering;
- neemt geen productbesluiten.

### Mirror

- toetst uitsluitend vaste gepushte SHA's;
- toetst migraties, rolcombinaties, API-omzeiling, datalekken, mobiel en desktop;
- wijzigt geen code;
- geeft geen productvrijgave.

### ChatGPT

- bewaakt samenhang, pakketgrenzen, statusmatrix en vervolgopdrachten;
- consolideert Claude-, Replit- en Mirror-resultaten;
- neemt geen productbesluit namens René.

## 10. Huidige status

- Club: ROOD
- Teams: ROOD
- Rollen en rechten: ROOD
- Ploegleider: ROOD
- Medische begeleiding: ROOD
- Team-abonnement: ROOD totdat rolmodel, meerdere teams en mobiel/PWA zijn hersteld en bewezen
- Mechanieker: GEEL
- Organogram-onboarding: ROOD

## 11. Definition of Done

Dit geheel is pas afgerond wanneer:

- documenten onderling consistent zijn;
- centrale rolwaarden technisch kloppen;
- migratie veilig is uitgevoerd;
- server-side rechten zijn bewezen;
- Club- en Team-onboarding volledig werken;
- organogrammen geen tweede rechtenmodel vormen;
- ploegleider, mechanieker, soigneur en medische begeleiding hun eigen flows hebben;
- mobiel en desktop werken;
- Mirror heeft goedgekeurd;
- René expliciet `RENE_APPROVED` heeft gegeven.
