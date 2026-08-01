# CLUB_ONBOARDING_01 — EEN CLUB VAN REGISTRATIE TOT ACTIEF

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Uitvoerder:** Replit · **Type:** breed domeinpakket · **Startcommit:** actuele `main`, bevestig de SHA
**Status:** voorbereid werk. Start pas zodra deze opdracht expliciet gegeven is (K2=A — de opdracht ís de vrijgave).
**Verhouding tot `TRAINER_CLUB_01`:** dat pakket maakt rechten en lekken sluitend in de bestaande omgeving. Dit pakket bouwt de **instroom**: hoe een club ontstaat en actief wordt. Geen overlap, geen tweede clubmodel.

## Doel
Een clubbestuurder kan zijn club zelfstandig registreren, inrichten en activeren — met teams, seizoenen, eerste beheerders en leden — en kan halverwege stoppen en later verdergaan zonder iets kwijt te raken.

## Scope
Club registreren · clubprofiel · logo en contactgegevens · eigenaar · teams en seizoenen · eerste beheerders en trainers · ledenimport · dubbele leden · onboarding hervatten · club activeren · lege toestanden · desktop en mobiel.

## Buiten scope
Clubprijsmodel en facturatie · de rolrechtenmatrix zelf (`CLUB_RECHTEN_01`) · uitnodigings- en lidmaatschapsbeheer ná activatie (`CLUB_LEDEN_01`) · jeugd- en oudertoestemming (`JEUGD_OUDER_01`) · trainerkoppelingen (`TRAINER_KOPPELING_01`).

## Bestaande bouwstenen — hergebruiken
| Bestaand | Vindplaats | Draagt al |
|---|---|---|
| Clubmodel en rollen | `lib/db/src/schema/club.ts` — `clubRoles` r30–42, clubstatus | elf rollen, clubstatus incl. "beperkt" |
| Clubtoestemmingen | `schema/club.ts` — `club_consents` r477 | toestemming per relatie |
| Clubroutes | `routes/club.ts` | bestaande clubfunctionaliteit |
| Uitnodigingen | `routes/invitations.ts` | uitnodigingsmechanisme |
| Beheerdersauditlog | `schema/admin-ops-log.ts` | onveranderlijk logboek |
| Opslag voor logo | `routes/storage.ts` | upload en ophalen |
| Tests | `test:club`, `test:club-organisation`, `test:cross-account-isolation` | vertrekpunt |

Geen tweede clubmodel, geen tweede uitnodigingsmechanisme.

## Productregels
1. Een club heeft altijd precies één eigenaar. Bij registratie is dat de aanmaker.
2. Een club is `concept` tot activatie en `actief` daarna. In concept zijn geen leden zichtbaar voor anderen en vertrekt geen uitnodiging.
3. Activatie vereist minimaal: naam, contactgegevens, één eigenaar en één team.
4. Onboarding is hervatbaar: elke stap wordt server-side bewaard zodra hij is ingevuld.
5. Een seizoen heeft een begin- en einddatum; teams horen bij een seizoen. Seizoensgrenzen zijn configureerbaar — er is nog geen formeel besluit over de standaardperiode.
6. Ledenimport voegt nooit stilzwijgend toe: elke import eindigt met een bevestigingsstap.
7. Een dubbel lid wordt herkend op geverifieerd e-mailadres, niet op naam.

## Frontend
Onboarding in stappen met zichtbare voortgang en een altijd bereikbare "later verder" — geen wizard die bij verlaten alles weggooit. Elke stap toont wat er nog ontbreekt voor activatie. Logo-upload met voortgang en een eerlijke fout bij te groot of verkeerd type. Op mobiel dezelfde stappen, verticaal; geen stap die alleen op desktop haalbaar is.

## Backend
Alle stappen server-side opgeslagen en gevalideerd. Activatie is één server-side handeling die de voorwaarden controleert en weigert met een lijst van wat ontbreekt. Import verwerkt in een transactie: alles of niets.

## Database
Additief op `club.ts`. Nodig: clubstatus (concept/actief), seizoenen met periode, koppeling team↔seizoen, en een importbatch met resultaat per rij. Bestaande clubs krijgen bij migratie status `actief` en behouden alles.

## Rechten
Alleen de eigenaar en een clubbeheerder mogen onboarding uitvoeren en activeren. Elke controle server-side; een directe API-aanroep krijgt dezelfde weigering. Alle beheeracties in `admin_ops_log`.

## Privacy
Contactgegevens van de club zijn organisatiegegevens, geen persoonsgegevens van leden. Ledenimport bevat wel persoonsgegevens: het geïmporteerde bestand wordt na verwerking niet langer bewaard dan nodig — termijn configureerbaar en gemarkeerd als besluitpunt.

## Communicatie
Bevestiging bij aanmaken, bij activeren, en bij een afgeronde import met aantal geslaagde en mislukte rijen. Geen uitnodigingsmail vóór activatie.

## Fout- en lege toestanden
Onderscheiden: nog niets ingevuld · onvolledig voor activatie · importfout per rij · dubbel lid gevonden · te groot of verkeerd logobestand · technische fout. Elk met een volgende stap. Geen nul die als resultaat leest.

## Migratie
Bestaande clubs behouden alles en krijgen status `actief`. Geen bestaand lid verandert van rol. Migratie testen op verse database én op een kopie met bestaande data; rij-aantallen en uitzonderingen rapporteren.

## Tests
1. Club aanmaken levert precies één eigenaar. 2. Activatie geweigerd bij ontbrekende naam, contactgegevens, eigenaar of team, met een lijst van wat mist. 3. Onboarding halverwege verlaten en hervatten: niets kwijt. 4. In concept vertrekt geen uitnodiging en zijn leden niet zichtbaar. 5. Logo te groot of verkeerd type: geweigerd, eerlijke melding. 6. Import van 100 rijen met 3 fouten: 97 verwerkt na bevestiging, 3 gemeld per rij. 7. Import zonder bevestiging voegt niets toe. 8. Dubbel lid herkend op geverifieerd e-mailadres, niet op naam. 9. Team hoort bij een seizoen; seizoensgrenzen configureerbaar. 10. Niet-bevoegde gebruiker kan niet activeren, ook niet via directe aanroep. 11. Elke beheeractie staat in `admin_ops_log`. 12. Bestaande clubs blijven na migratie werken en behouden rollen. 13. Zes lege- en fouttoestanden zijn onderscheiden. 14. Mobiel doorloopt dezelfde stappen als desktop. 15. Geen mock-, seed-, demo- of fallbackdata zichtbaar als echte clubdata.

## Acceptatiecriteria
1. Een club komt van niets tot actief zonder handmatig databasewerk. 2. Onboarding is hervatbaar zonder verlies. 3. Activatie is server-side afgedwongen. 4. Import is transactioneel en bevestigd. 5. Duplicaten worden herkend op geverifieerd e-mailadres. 6. Bestaande clubs ongewijzigd. 7. Alle tests groen, typecheck exit 0. 8. Geen tweede clubmodel of uitnodigingsmechanisme.

## Bewijsformat
Per regel: commando, resultaat, exitcode. Verder: de activatievoorwaarden met de weigertekst · een importrapport met geslaagde en mislukte rijen · migratieuitvoer op verse database én kopie met rij-aantallen · schermafbeeldingen van alle zes de toestanden op desktop en mobiel · een `admin_ops_log`-regel van een activatie · start- en eindcommit · gewijzigde bestanden.

## Stopcondities
- een bestaande club kan niet betrouwbaar op `actief` worden gezet zonder gegevensconflict;
- ledenimport vereist een persoonsgegeven dat nog niet mag worden verwerkt;
- seizoensmodel vereist een wijziging in het bestaande teammodel;
- een bestaande clubtest wordt onhoudbaar.
