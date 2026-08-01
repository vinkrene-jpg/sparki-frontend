# CLUB_PLANNING_01 — AFHANKELIJKHEDENCHECK

## 1. Wat dit pakket nodig heeft

| Nodig | Waarom | Gevolg wanneer afwezig |
|---|---|---|
| club/teamrechten | Onderdeel van de complete flow | Hergebruik of gerichte uitbreiding onmogelijk; eerst als blokkade melden |
| persoonlijke kalender en notificaties | Onderdeel van de complete flow | Hergebruik of gerichte uitbreiding onmogelijk; eerst als blokkade melden |
| jeugd/oudertoestemming | Onderdeel van de complete flow | Hergebruik of gerichte uitbreiding onmogelijk; eerst als blokkade melden |
| wedstrijd- en trainingsreferenties | Onderdeel van de complete flow | Hergebruik of gerichte uitbreiding onmogelijk; eerst als blokkade melden |
| auditlog | Onderdeel van de complete flow | Hergebruik of gerichte uitbreiding onmogelijk; eerst als blokkade melden |
| tijdzone-infrastructuur | Onderdeel van de complete flow | Hergebruik of gerichte uitbreiding onmogelijk; eerst als blokkade melden |


## 2. Wat verplicht bewezen of stabiel moet zijn

1. Authenticatie en stabiele gebruikersidentiteit.
2. Tenant-, club-, team- of accountcontext kan server-side betrouwbaar worden bepaald.
3. Bestaande rollen/permissions zijn beschikbaar en niet `legacy_unrestricted` voor testpersona's.
4. Auditlog kan gevoelige mutaties vastleggen.
5. Data-trustregel: geen mock/fallback als echte data.
6. De gedeelde services uit §1 hebben een bestaand contract of aantoonbaar uitbreidbaar pad.

Niet ieder onderdeel hoeft al Mirror-Proven te zijn, maar afwijkingen die de kernflow onveilig maken blokkeren de start.

## 3. Restpunten die niet mogen blokkeren

| Restpunt | Waarom geen blokkade |
|---|---|
| Niet-kritische visuele polish | Kan binnen de opdracht worden afgerond zonder architectuurkeuze |
| Lege testdata | Maak geldige testfixtures/persona's; geen productblokkade |
| Configureerbare operationele limiet ontbreekt | Veilig instelbaar maken zonder productclaim |
| Een later domeinpakket is nog niet gebouwd | Gebruik expliciete koppeling/lege toestand; bouw het latere domein niet vooruit |
| Een provider is tijdelijk onbereikbaar | Test met officiële sandbox of bestaande adapter en bewijs foutpad |

**Regel:** een restpunt is pas een blokkade wanneer het een verplicht punt uit §2 raakt.

## 4. Startcontrole

Replit levert vóór bouwen:

- actuele start-SHA;
- gevonden tabellen/services/endpoints;
- conflicterende actieve migraties;
- welke gedeelde contracten worden geraakt;
- bevestiging dat geen parallel systeem nodig is.
