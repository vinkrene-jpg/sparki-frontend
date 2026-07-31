# RELEASE_01 — TOTALE REGRESSIE EN RELEASE

**Uitvoerder:** Replit · **Type:** afwijkend pakket — **er wordt hier niets nieuws gebouwd**
**Startcommit:** de release-kandidaat; bevestig de SHA
**Status:** start pas wanneer alle voorgaande domeinpakketten `MIRROR_PROVEN` zijn.

## Waarom dit pakket anders is

Elk ander pakket bouwt een gebruikersflow. Dit pakket bouwt er geen enkele. Het maakt de app **volledig en reproduceerbaar toetsbaar**, zodat Mirror in één doorloop kan vaststellen of elk zichtbaar onderdeel een geslaagde echte gebruikersflow heeft.

Het zwaartepunt ligt daarom niet hier maar in `RELEASE_01_MIRROR_TOETS.md`. Replit levert het gereedschap; Mirror levert het oordeel; René geeft vrij.

**Wordt tijdens deze opdracht een defect gevonden, dan wordt het niet hier gerepareerd.** Het gaat terug naar het domeinpakket waar het thuishoort. Zie het herstelprotocol.

## Doel

E�n reproduceerbare releasestraat waarmee elke persona, elk pakket en elk foutpad in vaste volgorde kan worden doorlopen, met bewijs dat achteraf te controleren is.

## Buiten scope

Nieuwe functionaliteit · herstel van gevonden defecten · uitbreiding van bestaande domeinen · prestatieoptimalisatie · Stripe-livegang (apart besluit van René).

## Bestaande bouwstenen — hergebruiken
| Bestaand | Vindplaats | Draagt al |
|---|---|---|
| Releasestraat | `scripts/release-check.mjs` | typecheck, migraties, tests, webbuild, serverbuild, mobielcontrole, healthcheck |
| Acceptatie-uitvoer | `docs/RELEASE_ACCEPTANCE.md` | eerlijke acceptatie-uitvoer per fase |
| Store-controle | `scripts/store-release-check.mjs`, `test:store-release` | mobiele eindcontrole |
| Rolfixtures | `scripts/governor/create-role-test-fixtures.sh` | idempotente testidentiteiten met prefix `governor-fixture-` |
| Health | `routes/health.ts`, `src/jobs/health-check.ts` | `/api/healthz`, `/api/health/version` |
| Back-up en herstel | `src/tests/backup-restore.ts` | herstel mét relatiebehoud |
| PR-poorten | `.github/workflows/pr-checks.yml` | validators, typecheck, admin-smoke |
| Auditlog | `schema/admin-ops-log.ts` | bewijs van beheeracties |

Geen tweede releasestraat, geen tweede testidentiteitenmechanisme.

## Te bouwen

**1. Personaset.** Eén idempotent script dat alle benodigde testidentiteiten aanmaakt en herstelt: nieuwe en bestaande gebruiker · Gratis, Go en Compleet · jeugdsporter met ouder · clubeigenaar, clubbeheerder, hoofdtrainer, trainer, assistent, ploegleider, mechanieker, vrijwilliger, alleen-lezen · zelfstandige trainer · wandelaar · e-bikegebruiker · beheerder mét en zonder bevoegdheid. Allemaal met een herkenbaar prefix, allemaal verwijderbaar, geen enkele op `legacy_unrestricted`.

**2. Storingsschakelaars.** Een gedocumenteerde manier om storingen te forceren zonder productiepaden te raken: providerfout bij Strava en Garmin, Stripe-storing, trage of ontbrekende webhook, AI-provider niet bereikbaar, kaart- of routebron niet bereikbaar, databaseleesfout. Elk apart aan en uit.

**3. Doorloopscript.** Uitbreiding van `release-check.mjs` met een fase die per persona de kernflow aflegt en per stap vastlegt: HTTP-status, tijd, en of het scherm een echte, lege of fouttoestand toonde. Geen oordeel — alleen registratie.

**4. Prestatie- en kostenmeting.** Per kernflow de responstijd van de zwaarste endpoints, en het aantal externe aanroepen per flow (kaart, routebron, AI, provider). Meten en rapporteren, **niet optimaliseren**.

**5. Beveiligingsdoorloop.** Een reproduceerbare set directe API-aanroepen die per rol en per pakket probeert te bereiken wat niet mag. Uitkomst per aanroep: geweigerd of niet.

**6. Herstelproef.** Back-up terugzetten op een lege omgeving en de kernflow opnieuw doorlopen, met rijaantallen en relatiecontrole vóór en ná.

**7. Productiechecklist.** Eén uitvoerbare lijst met de stand per punt: migratiedrift, health, buildartefacten, secrets gescheiden, geen testidentiteit in productie, geen mock- of seeddata bereikbaar, back-up aanwezig, monitoring actief.

## Rechten, privacy, data-trust
De personaset bevat echte persoonsgegevensvelden en blijft daarom **buiten productie**. Geen enkele testidentiteit is bereikbaar in een productieomgeving; dat is punt 7 van de checklist en een acceptatiecriterium. De doorloop legt geen inhoudelijke persoonsgegevens vast, alleen statussen, tijden en toestandssoorten.

## Fout- en lege toestanden
Het doorloopscript registreert per stap welk van de zeven toestandssoorten is getoond — geen data, onvoldoende data, verouderd, synchronisatie bezig, providerfout, rechtenprobleem, technische fout. Kan het dat niet vaststellen, dan noteert het `onbepaald`; dat is zelf een bevinding.

## Migratie
Geen datamigratie. Wel: de personaset moet volledig verwijderbaar zijn zonder resten, en dat wordt aangetoond.

## Tests
1. Personaset draait idempotent; tweemaal draaien levert geen dubbele identiteiten. 2. Personaset is volledig verwijderbaar zonder resten. 3. Geen persona op `legacy_unrestricted`. 4. Elke storingsschakelaar werkt apart aan en uit. 5. Doorloopscript legt per stap status, tijd en toestandssoort vast. 6. `onbepaald` verschijnt niet bij een correct werkend scherm. 7. Beveiligingsdoorloop meldt per aanroep geweigerd of niet. 8. Herstelproef levert gelijke rijaantallen en kloppende relaties. 9. Productiechecklist geeft per punt een echte stand, geen aanname. 10. Geen testidentiteit bereikbaar in een productieomgeving. 11. De hele straat is tweemaal achter elkaar uitvoerbaar met hetzelfde resultaat.

## Acceptatiecriteria
1. Elke persona is met één commando te maken en te verwijderen. 2. Elke storing is reproduceerbaar te forceren. 3. De doorloop levert een machineleesbaar rapport per persona en per stap. 4. Prestatie en externe aanroepen zijn gemeten, niet geoptimaliseerd. 5. De beveiligingsdoorloop is volledig en herhaalbaar. 6. Herstelproef geslaagd met bewijs. 7. Productiechecklist volledig ingevuld met echte standen. 8. Geen enkele functionele wijziging aan de applicatie. 9. Typecheck exit 0, bestaande suites groen.

## Bewijsformat
Per regel: commando, resultaat, exitcode. Verder: het doorlooprapport per persona · de meting van responstijd en externe aanroepen per kernflow · de uitkomst van de beveiligingsdoorloop · rijaantallen en relatiecontrole van de herstelproef · de ingevulde productiechecklist · start- en eindcommit · gewijzigde bestanden (uitsluitend scripts en testgereedschap).

## Stopcondities
- een storing is niet te forceren zonder productiepaden te raken;
- een persona is niet te maken zonder handmatig databasewerk;
- de personaset is niet volledig verwijderbaar;
- een functionele wijziging blijkt nodig om de doorloop te laten werken — dan is dat een defect voor het betreffende domeinpakket, niet voor dit pakket.
