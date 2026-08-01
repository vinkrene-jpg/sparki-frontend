# TEAM_ONBOARDING_01 — TEAMORGANISATIE VAN REGISTRATIE TOT ACTIEF

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Uitvoerder:** Replit · **Type:** breed domeinpakket · **Startcommit:** actuele `main`, bevestig de SHA
**Status:** voorbereid werk. Start pas na expliciete vrijgave door René **én** na `CLUB_RECHTEN_01` Mirror-goedgekeurd.
**Bindend brondocument:** `docs/SPARKI_BESLUITEN_EN_BOUWVERDELING_CLUB_TEAM_ROLLEN_2026-08-01.md` (commit `944f8c11`) plus de aanvullende besluiten van 1 augustus over organisatietypen, rolgestuurde start en pakketgrens.

## Doel

Een teammanager kan zelfstandig een teamorganisatie opzetten: profiel, seizoen, selecties, vaste seizoensbezetting, stafbasis, roltoekenningen en uitnodigingen — en die activeren, met een onderbreking ertussen zonder iets kwijt te raken.

## Scope

Zelfstandige `TEAM_ORGANISATION` **of** wedstrijdteam binnen een Club · organisatieprofiel · seizoen · teams en selecties · vaste seizoensrenners · vaste stafbasis · roltoekenningen via het centrale model · uitnodigingen · beschikbaarheidsvoorkeuren · organogram-kaarten · een eerste programma of evenement kunnen toevoegen · activering en hervatten · rolgestuurde startschermen · desktop en mobiel.

## Buiten scope — hoort bij `PLOEGLEIDER_01`

Wedstrijdbezetting per evenement · geselecteerde renners per wedstrijd · toegewezen staf per wedstrijd · voertuigen · materiaal · dagschema · operationele taken · bevestigingen en vervanging · terugkoppeling · rode vlaggen · conflictsignalering · organisatiebreed weekendoverzicht.

Verder buiten scope: het rollen- en rechtenmodel zelf (`CLUB_RECHTEN_01`) · clubonboarding (`CLUB_ONBOARDING_01`) · abonnement en betaling (`TEAM_ABONNEMENT_01`) · jeugd- en oudertoestemming (`JEUGD_OUDER_01`).

**Kort:** onboarding maakt de organisatie gereed, ploegleider maakt de wedstrijd uitvoerbaar.

## 0. Bestaande bouwstenen — hergebruiken

| Bestaand | Vindplaats | Draagt al |
|---|---|---|
| Organisatiecontainer | `lib/db/src/schema/club.ts` — `clubs` r60, `club_members` r96, `club_teams` r126, `club_groups` r154, `club_seasons` r178, `club_team_members` r205, `club_group_members` r227 | organisatie, teams, groepen, seizoenen, lidmaatschappen |
| Rolmodel | `clubRoles` + `CLUB_RECHTEN_01` | de enige bron van rollen en rechten |
| Toestemmingen | `club_consents` r477 | toestemming per relatie |
| Uitnodigingen | `routes/invitations.ts` | uitnodigingsmechanisme |
| Clubonboarding | `CLUB_ONBOARDING_01` (commit `66a9931`) — conceptstatus, hervatbare onboarding, activatiepoort | **hergebruik dit patroon, bouw geen tweede onboardingmachine** |
| Team-abonnement | `TEAM_ABONNEMENT_01` — tier TEAM, eigenaar-only checkout met organisatie-metadata | betaling; dit pakket definieert geen rolwaarden |
| Auditlog | `admin_ops_log` | roltoekenning en activatie vastleggen |
| Tests | `test:club`, `test:club-organisation`, `test:cross-account-isolation` | vertrekpunt |

**Geen tweede organisatie-entiteit, geen tweede onboardingflow, geen tweede rechtenlaag.**

## 1. Organisatiemodel

1. Er komt **geen** nieuwe hoofdorganisatie. De bestaande `clubs`-container krijgt een **organisatietype**: `CLUB` of `TEAM`.
2. Een `TEAM`-organisatie staat productmatig los van een club en gebruikt exact dezelfde rechtenarchitectuur.
3. `club_teams` draagt selecties en subteams binnen **beide** typen — bijvoorbeeld elite, U23, junioren, dames of development.
4. Een wedstrijdteam binnen een club is een `club_teams`-rij binnen een `CLUB`-organisatie; een zelfstandige ploeg is een eigen organisatie met type `TEAM`.
5. **Trainingsgroepen zijn geen wedstrijdteams.** `club_groups` blijft voor trainingsgroepen, `club_teams` voor wedstrijdteams. Een sporter kan tegelijk in een trainingsgroep én in één of meer wedstrijdteams zitten.
6. De bestaande Team-checkout met organisatie-metadata blijft geldig en betekent niet dat een Team productmatig een Club is.

## 2. Eigenaarschap en beheer

7. **Eigenaarschap is een relatie met de organisatie, geen operationele rol.** Technisch: `owner`. Gebruikersnaam: "Teameigenaar" bij type `TEAM`, "Clubeigenaar" bij type `CLUB`. **Voeg geen rolwaarde `teameigenaar` toe.**
8. Bij aanmaak krijgt de eigenaar standaard de beheerrol: `teammanager` bij `TEAM`, `clubbeheerder` bij `CLUB`. Die rol kan later aan anderen worden toegekend.
9. Eigendomsoverdracht is een aparte, beveiligde handeling en laat de organisatie nooit zonder eigenaar.
10. Een organisatie heeft altijd precies één eigenaar.

## 3. Onboarding en organogram

11. De onboarding volgt het bestaande patroon uit `CLUB_ONBOARDING_01`: **conceptstatus tot activering**, elke ingevulde stap server-side bewaard, hervatbaar zonder verlies.
12. In concept vertrekt **geen** uitnodiging en zijn leden niet zichtbaar voor anderen.
13. De onboarding begint met een organogram-kaart: compact wedstrijdteam · prestatieploeg · etappe-/koersorganisatie · zelf samenstellen.
14. Kaarten tonen **uitsluitend rollen die server-side bestaan**. Bestaat een rol niet, dan staat hij niet op de kaart.
15. Een kaart maakt uitsluitend een **conceptstructuur** aan en leidt nooit rechten af.
16. Na activering wordt **geen nieuw sjabloon over de organisatie gelegd**. Rollen, groepen en relaties worden daarna afzonderlijk beheerd. Een structuurwijziging mag nooit een bestaande persoon zijn rol afnemen.
17. Kaarten tonen **rolplekken, geen personen**. Geen voorbeeldnamen. Een echte naam verschijnt pas na een geaccepteerde uitnodiging of een geldige koppeling.
18. Activering vereist minimaal: naam, organisatietype, één eigenaar, één seizoen en één selectie.
19. De onboarding levert naast rollen een bruikbare conceptstructuur op: seizoen, selecties, rolplekken, uitnodigingen en — optioneel — een eerste programma of evenement.

## 4. Seizoen en bezetting

20. Een seizoen heeft een begin- en einddatum. Seizoensgrenzen zijn **configureerbaar**; er is geen formeel besluit over een standaardperiode.
21. De **seizoensbezetting** legt vast wie het hele seizoen bij de organisatie hoort: vaste renners en vaste staf (teammanager, ploegleiders, mechaniekers, soigneurs, medical_staff, trainers).
22. Beschikbaarheidsvoorkeuren horen bij de seizoensbezetting: wanneer is iemand in beginsel wel of niet inzetbaar.
23. **Wedstrijdbezetting wordt hier niet gebouwd.** Dit pakket levert de seizoensbezetting waarop `PLOEGLEIDER_01` zijn per-evenement-selectie baseert. Bouw geen voertuigen, materiaal, dagschema, taken of conflictsignalering vooruit.

## 5. Rollen en uitnodigingen

24. Alle rollen en rechten komen uit `CLUB_RECHTEN_01`. Dit pakket **kent toe**, het definieert niet.
25. Teamrollen: `owner` (Teameigenaar) · `teammanager` · `ploegleider` · `trainer` · `mechanieker` · `soigneur` · `medical_staff` · `member` (Sporter) · `alleen_lezen` (Gast).
26. Eén persoon kan meerdere rollen hebben; rechten zijn de vereniging daarvan.
27. Elke uitnodiging vermeldt: **organisatie, rol, team of selectie, periode en verwachte werkzaamheden**.
28. De rolbeschrijving komt uit één centrale definitie en wordt hergebruikt in de uitnodiging, de rolintroductie bij de eerste login en de voorbeeldmodus. Geen drie losse teksten.
29. Een uitnodiging voor een minderjarige volgt de bestaande oudertoestemmingsregels uit `JEUGD_OUDER_01`.

## 6. Rolgestuurde start en lege toestanden

30. Iedere rol landt op een **eigen startscherm** met handelingsperspectief. Geen enkele rol landt op een generiek of leeg dashboard.
31. Elke lege toestand vermeldt: **wat ontbreekt · waarom · wie het kan oplossen · één concrete vervolgstap**.
32. Onderscheid tussen: nog niet ingericht · niet toegewezen · geen toestemming · werkelijk geen open acties. Die vier zien er verschillend uit.
33. Taken en aandachtspunten worden **afgeleid uit werkelijk ontbrekende inrichting, planning, toestemming of uitvoering** — nooit uit een verzonnen lijst.
34. De eerste login bevat: rolintroductie, werkgebied en **één echte eerste actie**.
35. Beheerders krijgen een **read-only** "weergave als rol" om vooraf te zien wat een rol ziet. Read-only betekent: kijken, niet handelen namens iemand, niets wijzigen, niets versturen.

## 7. Voorbeeldmodus

36. Een voorbeeldmodus is toegestaan, maar draait op een **eigen organisatie die als voorbeeld is gemarkeerd**, is nooit te mengen met een echte organisatie, en de markering staat permanent in beeld.
37. In de voorbeeldmodus toont een element bij mouse-over een uitleg van wat het onderdeel doet; op mobiel gebeurt dat via een vraagteken-icoontje dat aantikbaar is en te sluiten, zonder de onderliggende knop te activeren.
38. In een **echte** omgeving verschijnen geen fictieve personen en geen persoonlijke voorbeeldgegevens.

## 8. Rechten, privacy, communicatie

39. Alleen de eigenaar en de teammanager voeren onboarding uit en activeren. Elke controle server-side; een directe API-aanroep krijgt dezelfde weigering.
40. Gezondheids- en ontwikkelingsgegevens zijn uitsluitend zichtbaar na expliciete toestemming van de sporter, volgens minimale noodzakelijke toegang. Het functietype van `medical_staff` verleent **geen** extra rechten.
41. Roltoekenning, intrekking, activering en eigendomsoverdracht gaan naar `admin_ops_log`.
42. Bevestiging bij aanmaken, bij activeren en bij een geaccepteerde uitnodiging. Rustig van toon, geen aansporing.

## 9. Database en migratie

43. Additief. Nodig: organisatietype op de bestaande container, seizoensbezetting met rol en periode, beschikbaarheidsvoorkeur, en de onboardingstatus (concept/actief) zoals `CLUB_ONBOARDING_01` die al kent.
44. **Bestaande organisaties krijgen type `CLUB`** en behouden alles. Geen enkel bestaand lid wisselt van rol.
45. Migratie testen op een verse database én op een kopie met bestaande data, met rij-aantallen vóór en ná.

## Tests

1. Teamorganisatie aanmaken levert precies één eigenaar met gebruikersnaam "Teameigenaar". 2. De eigenaar krijgt bij aanmaak automatisch `teammanager`. 3. Geen rolwaarde `teameigenaar` bestaat. 4. Organisatietype `TEAM` en `CLUB` bestaan naast elkaar op dezelfde container. 5. Bestaande organisaties zijn na migratie type `CLUB` met ongewijzigde rollen. 6. Een selectie is een `club_teams`-rij; een trainingsgroep een `club_groups`-rij; een sporter kan in beide zitten. 7. Onboarding halverwege verlaten en hervatten: niets kwijt. 8. In concept vertrekt geen uitnodiging en zijn leden niet zichtbaar. 9. Activering geweigerd bij ontbrekende naam, type, eigenaar, seizoen of selectie — met een lijst van wat mist. 10. Organogram-kaart toont geen rol die server-side niet bestaat. 11. Kaart maakt uitsluitend een conceptstructuur; er worden geen rechten uit afgeleid. 12. Na activering kan geen sjabloon opnieuw worden toegepast. 13. Een structuurwijziging neemt geen bestaande persoon zijn rol af. 14. Kaarten tonen geen voorbeeldnamen; een naam verschijnt pas na een geaccepteerde uitnodiging. 15. Seizoensbezetting legt vaste renners en vaste staf vast, met beschikbaarheidsvoorkeur. 16. Er bestaat **geen** wedstrijdbezetting, voertuig, materiaal, dagschema of conflictsignalering in dit pakket. 17. Uitnodiging vermeldt organisatie, rol, team, periode en verwachte werkzaamheden. 18. De rolbeschrijving komt uit één centrale definitie en is identiek in uitnodiging, rolintroductie en voorbeeldmodus. 19. Elke rol landt op een eigen startscherm met een eerste actie. 20. Vier lege toestanden zijn onderscheiden en noemen alle vier wat ontbreekt, waarom, wie en de vervolgstap. 21. Taken zijn afgeleid uit echte ontbrekende inrichting, niet uit een vaste lijst. 22. "Weergave als rol" is read-only: geen wijziging, geen verzending mogelijk — ook niet via directe aanroep. 23. Voorbeeldmodus is gemarkeerd, gescheiden, en de markering blijft zichtbaar. 24. Voorbeeldmodus toont uitleg bij mouse-over; op mobiel via een vraagteken dat de onderliggende knop niet activeert. 25. In een echte omgeving verschijnt geen fictief persoon. 26. Niet-bevoegde gebruiker kan niet activeren of rollen toekennen, ook niet via directe aanroep. 27. Roltoekenning, activering en eigendomsoverdracht staan in `admin_ops_log`. 28. Eigendomsoverdracht laat de organisatie nooit zonder eigenaar. 29. Mobiel doorloopt dezelfde stappen als desktop. 30. Geen mock-, seed-, demo- of fallbackdata als echte organisatiegegevens.

## Acceptatiecriteria

1. Een teamorganisatie komt van niets tot actief zonder handmatig databasewerk. 2. Geen tweede organisatie-entiteit, onboardingflow of rechtenlaag. 3. Geen rolwaarde `teameigenaar`; eigenaarschap is een relatie. 4. Onboarding hervatbaar zonder verlies; activering server-side afgedwongen. 5. Organogram maakt concept, geen rechten, en overschrijft na activering niets. 6. Seizoensbezetting aanwezig, wedstrijdbezetting aantoonbaar afwezig. 7. Elke rol heeft een startscherm met handelingsperspectief; vier lege toestanden onderscheiden. 8. "Weergave als rol" is read-only, server-side afgedwongen. 9. Bestaande organisaties ongewijzigd na migratie. 10. Alle tests groen, typecheck exit 0.

## Bewijsformat

Per regel: commando, resultaat, exitcode. Verder: de activatievoorwaarden met de weigertekst · een organogram-kaart naast de lijst server-side rollen, om te tonen dat er geen rol op staat die niet bestaat · de vier lege toestanden per rol op desktop en mobiel · een read-only-poging vanuit "weergave als rol" via directe aanroep · de centrale rolbeschrijving met de drie plekken waar hij verschijnt · migratieuitvoer op verse database én kopie met rij-aantallen · een `admin_ops_log`-regel van activering en roltoekenning · start- en eindcommit · gewijzigde bestanden.

## Stopcondities

- organisatietype is niet additief toe te voegen zonder bestaande clubs te raken;
- een organogram-kaart vereist een rol die `CLUB_RECHTEN_01` nog niet heeft opgeleverd;
- seizoensbezetting vereist een structuur die `PLOEGLEIDER_01` zou moeten bouwen;
- "weergave als rol" is niet read-only te maken zonder impersonatie;
- een bestaande clubtest wordt onhoudbaar — dat is een bevinding.

## Werkregels

Blijf binnen scope; niets vooruitbouwen uit `PLOEGLEIDER_01`. Hergebruik de organisatiecontainer, het rolmodel en het onboardingpatroon. Alle beslissingen server-side, fail-closed. Geen mock-, seed-, demo- of fallbackdata als echte gegevens. Nederlandse namen in de interface, technische sleutel klein erachter. Bij twijfel over een endpoint of een productkeuze: melden en stoppen.

## Documentatie

`docs/SPARKI_TEAM_ORGANISATIE.md` — organisatietypen, eigenaarschap, seizoensbezetting, organogramregels en de grens met `PLOEGLEIDER_01`.

## Addendum (René, 1 augustus 2026) — aanvullende acceptatiecriteria

11. **Parallelle teams:** één organisatie kan meerdere teams/selecties gelijktijdig
    beheren, waarbij ieder team een eigen seizoensbezetting, stafbasis en
    uitnodigingen heeft.
12. **Rolgestuurde startschermen, getoetst per rol:** de onboarding-oplevering
    controleert wat teammanager, ploegleider, trainer, mechanieker, soigneur,
    medical_staff, sporter én gast zien. Iedere eerste login leidt naar een
    rolgestuurd dashboard met minimaal één begrijpelijke eerste actie of een
    eerlijke lege toestand.
