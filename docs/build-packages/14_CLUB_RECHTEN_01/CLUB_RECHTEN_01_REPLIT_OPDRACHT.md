# CLUB_RECHTEN_01 — DEFINITIEVE CLUBROLLEN EN RECHTEN

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Uitvoerder:** Replit · **Type:** breed domeinpakket · **Startcommit:** actuele `main`, bevestig de SHA
**Status:** voorbereid werk. Start pas zodra deze opdracht expliciet gegeven is (K2=A — de opdracht ís de vrijgave).
**Verhouding tot andere pakketten:** `CLUB_ONBOARDING_01` bouwt de instroom, `CLUB_LEDEN_01` het lidmaatschapsbeheer, `TRAINER_CLUB_01` maakt de bestaande omgeving lekvrij. Dit pakket legt het **rolmodel zelf** vast. Alle andere pakketten steunen erop; het gaat daarom vóór.

## Doel
Elf vastgestelde rollen, met server-side rechten op club- én teamniveau, meerdere rollen per persoon, tijdelijke rollen met einddatum, en een auditspoor bij elke rolwijziging — zonder datalek tussen teams.

## Scope
Clubeigenaar · clubbeheerder · hoofdtrainer · trainer · assistent-trainer · ploegleider · mechanieker · ouder/verzorger · vrijwilliger · alleen-lezen · sporter. Plus: meerdere rollen per persoon, club- en teamniveau gescheiden, tijdelijke rollen, eigendomsoverdracht, auditlog, blokkeren van directe API-omzeiling.

## Buiten scope
Uitnodigen en lidmaatschapsbeheer (`CLUB_LEDEN_01`) · jeugd- en oudertoestemming (`JEUGD_OUDER_01`) · sporter-trainerkoppeling buiten clubverband (`TRAINER_KOPPELING_01`) · clubprijsmodel · nieuwe schermen buiten rolbeheer.

## Bestaande bouwstenen — hergebruiken
| Bestaand | Vindplaats | Draagt al |
|---|---|---|
| `clubRoles` — elf waarden | `lib/db/src/schema/club.ts` r30–42 | `owner`, `admin`, `hoofdtrainer`, `trainer`, `assistent`, `teammanager`, `mechanieker`, `member`, `parent`, `vrijwilliger`, `alleen_lezen` |
| Clubtoestemmingen | `schema/club.ts` r477 — `club_consents` | toestemming per relatie, nooit automatisch |
| Rechtenresolver | `lib/entitlements.ts` — `resolveFeatureAccess` L407 | rollen, vlaggen en kill-switches |
| Rolweergave | `today-roles`, `today-matrix` | wat welke rol ziet |
| Isolatietests | `cross-account-isolation`, `links-end-isolation`, `links-unlink-isolation`, `coach-parent-*`, `wp-r1-parent-rights` | bestaand bewijs van scheiding |
| Auditlog | `schema/admin-ops-log.ts` — `admin_ops_log` | onveranderlijk, rijen worden nooit verwijderd |
| Clubtests | `club`, `club-organisation` | vertrekpunt |

**Additief op `clubRoles`.** Geen tweede rolmodel, geen tweede rechtencontrole.

## Eén punt vóór de bouw: ploegleider tegenover teammanager
De vastgestelde lijst bevat **ploegleider** en bevat **geen** `teammanager`. De code kent `teammanager` en geen ploegleider.

Uitgangspunt voor deze opdracht: **`teammanager` wordt hernoemd naar `ploegleider`** — dezelfde rol, andere naam, met een migratie die bestaande rijen meeneemt. Blijkt uit de bestaande rechten dat `teammanager` en ploegleider inhoudelijk verschillen, dan is dat een **bevinding die je meldt vóór je begint**, geen keuze die je zelf maakt.

## Productregels
1. Elf rollen, exact de vastgestelde lijst. Geen twaalfde rol erbij verzinnen.
2. **Eén persoon kan meerdere rollen hebben**, tegelijk, op verschillende niveaus. Rechten zijn de **vereniging** van zijn rollen — nooit de doorsnede.
3. **Club- en teamniveau zijn gescheiden.** Een trainerrol bij team 1 geeft niets bij team 2. Clubbrede rollen gelden clubbreed en worden expliciet als zodanig vastgelegd.
4. **Tijdelijke rollen** hebben een einddatum. Na die datum vervalt het recht automatisch, zonder handmatige actie, en dat verval staat in het auditlog.
5. Er is altijd precies één clubeigenaar. Overdracht is één handeling die de oude eigenaar tot clubbeheerder maakt; de club is nooit zonder eigenaar.
6. Rechten worden **uitsluitend server-side** bepaald. De interface verbergt hoogstens; de server weigert.
7. Elke rolwijziging — toekennen, wijzigen, intrekken, verlopen, overdragen — komt in `admin_ops_log` met wie, wanneer, oude en nieuwe waarde, en reden.
8. Veiligheids- en gezondheidsinformatie valt nooit onder een rolbeperking die iemand in gevaar brengt.

## Frontend
E�n rolbeheerscherm per club met per persoon zijn rollen, het niveau (club of team) en een eventuele einddatum. Toekennen en intrekken zijn zichtbaar bevestigde handelingen. Een aflopende tijdelijke rol is vooraf zichtbaar. Op mobiel hetzelfde beheer, verticaal; geen handeling die alleen op desktop kan.

## Backend
E�n centrale functie die voor een persoon, een club en optioneel een team de effectieve rechten teruggeeft. Alle controles lopen daarlangs. Bestaande rolcontroles worden op die functie aangesloten, niet gedupliceerd.

## Database
Additief: rolkoppeling met niveau (club of team), begin- en einddatum, en toekenner. Eén persoon kan meerdere rijen hebben. Bestaande rollen migreren naar rijen met niveau `club` of `team` zoals ze vandaag gelden, zonder rechtenwijziging. Uniciteit op persoon + club/team + rol, afgedwongen in de database.

## Rechten
Alleen eigenaar en clubbeheerder beheren rollen. Een hoofdtrainer mag trainers toewijzen binnen zijn team, niet daarbuiten. Niemand kent zichzelf een hogere rol toe. Elke controle geldt identiek bij directe API-aanroep.

## Privacy
Een rol geeft toegang tot precies de gegevenssoorten die erbij horen. Assistent-trainer ziet aanwezigheid, geen sportdata. Mechanieker ziet materiaal, geen gezondheids- of trainingsdata. Vrijwilliger en alleen-lezen beheren niets. Ouder/verzorger valt onder `JEUGD_OUDER_01` en wordt hier alleen als rol vastgelegd.

## Communicatie
Bericht bij toekenning en intrekking van een rol, en een vooraankondiging bij het aflopen van een tijdelijke rol. Geen bericht bij een technische migratie.

## Fout- en lege toestanden
Onderscheiden: geen rollen · rol verlopen · geen bevoegdheid om te beheren · rol bestaat al · laatste eigenaar kan niet worden ingetrokken · technische fout. Elk met een volgende stap.

## Migratie
Bestaande rolrijen behouden hun rechten exact. `teammanager` → `ploegleider` met behoud van rijen. Geen enkel lid wint of verliest een recht door de migratie — bewijs dat met een rechtenvergelijking vóór en ná per rol. Testen op verse database én op een kopie met bestaande data.

## Tests
1. Elf rollen bestaan, geen twaalfde. 2. Eén persoon met twee rollen krijgt de vereniging van beide rechten. 3. Trainerrol bij team 1 geeft niets bij team 2. 4. Clubbrede rol geldt clubbreed. 5. Tijdelijke rol vervalt automatisch op de einddatum. 6. Het verval staat in `admin_ops_log`. 7. Eigendomsoverdracht laat precies één eigenaar achter; de oude wordt clubbeheerder. 8. De laatste eigenaar kan niet worden ingetrokken. 9. Niemand kent zichzelf een hogere rol toe. 10. Hoofdtrainer wijst alleen binnen zijn team toe. 11. Assistent ziet aanwezigheid, geen sportdata. 12. Mechanieker ziet materiaal, geen gezondheids- of trainingsdata. 13. Vrijwilliger en alleen-lezen beheren niets. 14. Team 1 ziet niets van team 2. 15. Elke rolwijziging staat in het auditlog met oude en nieuwe waarde. 16. Directe API-aanroep krijgt dezelfde weigering als de interface. 17. Migratie wijzigt geen enkel bestaand recht — vergelijking vóór en ná per rol. 18. `teammanager` is na migratie `ploegleider` met behoud van rijen. 19. Zes lege- en fouttoestanden zijn onderscheiden. 20. Alle bestaande isolatietests groen. 21. Mobiel en desktop bieden hetzelfde rolbeheer. 22. Geen mock-, seed-, demo- of fallbackdata als echte rolgegevens.

## Acceptatiecriteria
1. Elf rollen, server-side afgedwongen, op club- en teamniveau gescheiden. 2. Meerdere rollen per persoon met vereniging van rechten. 3. Tijdelijke rollen vervallen automatisch en auditeerbaar. 4. Altijd precies één eigenaar. 5. Geen datalek tussen teams, in interface noch API. 6. Elke rolwijziging in `admin_ops_log`. 7. Migratie zonder rechtenwijziging. 8. Alle bestaande isolatietests groen; typecheck exit 0. 9. Geen tweede rolmodel of rechtencontrole.

## Bewijsformat
Per regel: commando, resultaat, exitcode. Verder: de rechtenmatrix per rol met zichtbaar en bewerkbaar · de vergelijking vóór en ná migratie per rol · een `admin_ops_log`-regel van toekennen, intrekken, verlopen en overdragen · per rol het API-antwoord naast het interfacegedrag voor twee gevallen · schermafbeeldingen van de zes toestanden op desktop en mobiel · start- en eindcommit · gewijzigde bestanden.

## Stopcondities
- `teammanager` en ploegleider blijken inhoudelijk te verschillen;
- de migratie wijzigt aantoonbaar een bestaand recht en dat is niet te voorkomen;
- meerdere rollen per persoon vereisen een wijziging in `resolveFeatureAccess` die andere domeinen raakt;
- tijdelijke rollen vereisen een taakplanner die er niet is;
- een bestaande isolatietest wordt onhoudbaar — dat is een bevinding.
