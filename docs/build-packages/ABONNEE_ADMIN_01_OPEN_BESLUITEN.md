# ABONNEE_ADMIN_01 — WERKELIJK OPEN BESLUITEN

## 0. Uitvoeringsregel (geldig vanaf 1 augustus 2026)

> Zodra René een volledige bouwopdracht aan Replit geeft, is de volledige daarin beschreven bouw-, test-, herstel-, migratie-, deployment-, productie- en rollbackstraat vrijgegeven. Replit voert alle fasen zelfstandig achter elkaar uit.
>
> Replit rapporteert per fase, maar wacht niet op antwoord. Rapporteren is geen wachtmoment.
>
> Mirror toetst parallel en vormt geen algemene wachtpoort. Mirror geeft geen menselijke bouwvrijgave, blokkeert geen onafhankelijke fasen en vraagt geen nieuwe toestemming voor reeds goedgekeurde scope. Ontbrekend bewijs is een herstelpunt, geen bouwstop.
>
> Productiepublicatie is een automatische poort met technische voorwaarden, geen menselijke goedkeuring: build groen · typecheck groen · verplichte tests groen · migraties gevalideerd · rollback beschikbaar · geen actieve harde stop.
>
> Alleen een aantoonbaar kritisch technisch, data-, privacy-, consent- of veiligheidsprobleem mag het direct afhankelijke onderdeel tijdelijk stoppen. Onafhankelijke bouw loopt door.
>
> Fasevolgorde binnen dit document is een technische afhankelijkheid, geen vrijgavepoort. "Eerst X, dan Y" betekent: Y heeft het resultaat van X nodig — niet: Y wacht op toestemming.
>
> Deze regel geldt binnen een gegeven opdracht. Een volgende opdracht in een reeks start niet vanzelf.
>
> (Bron: `SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01`, besluit René 01-08-2026, geregistreerd als `GOV-B1`.)


Alleen wat een onderdeel daadwerkelijk stilzet of wat Replit niet zelf mag invullen. Alle overige onderdelen gaan door.

## Juridisch — Replit mag deze niet zelf bepalen

| # | Besluit | Blokkeert | Toelichting |
|---|---|---|---|
| J-1 | Bewaartermijn profiel- en accountdata na verwijdering | de bewaarmatrix voor die categorie | configureerbaar bouwen, waarde door René of zijn adviseur |
| J-2 | Bewaartermijn betalings- en factuuradministratie | idem | wettelijke termijn; niet zelf invullen |
| J-3 | Bewaartermijn auditlogs en fraudedossiers | idem | botst mogelijk met "niet langer dan nodig" |
| J-4 | Bewaartermijn communicatie en supporttickets | idem | — |
| J-5 | Bewaartermijn gezondheids- en hersteldata | idem | zwaarste categorie; vraagt aparte afweging |
| J-6 | Back-uprotatie en uitfaseringstermijn voor verwijderde accounts | de back-upuitfaseringsjob | hangt af van het hostingbeleid, dat nog niet is vastgelegd |

Vastgesteld en dus **niet** open: routegebruiks- en fair-usedata, 24 maanden herleidbaar, daarna onomkeerbaar geanonimiseerd (`SPARKI-BESLUIT-2026-008`).

## Product — René beslist

| # | Besluit | Blokkeert | Voorstel |
|---|---|---|---|
| P-1 | Is pauzeren commercieel toegestaan, en tegen welke voorwaarden | de pauzeerflow | niet bouwen zonder besluit; hervatten volgt automatisch |
| P-2 | Refundbeleid: behoudt de gebruiker rechten tot de einddatum na een refund, of vervallen ze direct | statusdefinitie `REFUNDED` | — |
| P-3 | Downgradegedrag voor andere pakketgebonden gegevens dan routes | die categorieën | routes zijn besloten; voor de rest bestaat nog geen regel |
| P-4 | Wie is bevoegd voor `DECEASED`, privacy hold en refunds bij afwezigheid van de oprichter | uitzonderingsprotocollen | hangt aan het continuïteitskader |
| P-5 | Mag een minderjarige zelf betalen | jeugd- en oudertoestemmingsprotocol | staat al langer open |

## Technisch — melden, geen besluit van René nodig

| # | Punt | Gevolg |
|---|---|---|
| T-1 | Ondersteunt de bestaande gateway gedeeltelijke refund | zo niet: melden en niet bouwen |
| T-2 | Kunnen bestaande accounts allemaal een uniek lidnummer krijgen zonder conflict | conflicten in quarantaine, niet corrigeren |
| T-3 | Is anonimisering aantoonbaar onomkeerbaar bij de huidige tabelstructuur | zo niet: stopconditie |

## Advies

J-1 tot en met J-5 zijn samen één gesprek met een jurist of de accountant, niet vijf losse vragen. Zolang die termijnen openstaan kan het pakket volledig worden gebouwd — de matrix is configureerbaar — maar kan er **geen betaalde publieke release** plaatsvinden, omdat de bewaartermijnen dan onbepaald zijn. Dat is de enige plek waar deze besluiten echt gaan knellen.
