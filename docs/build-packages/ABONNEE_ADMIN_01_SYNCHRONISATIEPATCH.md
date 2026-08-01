# ABONNEE_ADMIN_01 — SYNCHRONISATIEPATCH

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


Uit te voeren **zodra Mirror dit pakket heeft goedgekeurd**. Niet eerder.

## Afbouwmatrix

- nieuwe regels in domein **1 Pakketten en commercie**: `Sparki-lidnummer` · `Abonneeregister` · `Levenscyclusstatussen` · `Bewaarmatrix en anonimisering` · `Privacyverzoeken en accountverwijdering` · `Uitzonderingsprotocollen` — elk met `voortgang = MIRROR_PROVEN` en `mirror_status = MIRROR_PROVEN (ABONNEE_ADMIN_01, commit <eind-SHA>)`;
- bestaande regel `Abonnementsstop, pauze, terugbetaling` → afhankelijkheid bijwerken naar `ABONNEMENT_01 + ABONNEE_ADMIN_01`;
- bestaande regel `Data-export en accountverwijdering` (domein 12) → `voortgang = MIRROR_PROVEN`;
- termijnen die als besluitpunt zijn gemarkeerd komen **niet** op MIRROR_PROVEN.

## Dagkaart

**Afgerond** aanvullen met:

> - `ABONNEE_ADMIN_01` door Mirror goedgekeurd op commit `<eind-SHA>`. Elke gebruiker heeft een permanent Sparki-lidnummer; levenscyclus, bewaartermijnen, privacyverzoeken en uitzonderingsprotocollen zijn server-side vastgelegd en auditplichtig.

**Open beslissingen** aanvullen met de termijnen die als besluitpunt zijn gemarkeerd.

## Releasestatus

Onder **Bewezen**:

> ### ABONNEE_ADMIN_01 — abonneeadministratie en AVG
> - Commit `<eind-SHA>`, door Mirror onafhankelijk goedgekeurd.
> - Permanent, uniek, niet-herbruikbaar lidnummer; geen authenticatiemiddel.
> - Eén leidende pakketstatus per account; conflicten tussen Clerk, Stripe en Sparki zichtbaar in plaats van stilzwijgend opgelost.
> - Opzeggen, pauzeren, downgraden, deactiveren en verwijderen zijn gescheiden flows.
> - Verwijdering uitsluitend via dry-run en bevestiging; anonimisering aantoonbaar onomkeerbaar.
> - Alle gevoelige acties bevoegdheidsgebonden en vastgelegd in `admin_ops_log`.

Onder **Releaseblokkades die blijven gelden** aanvullen:

> - Geen betaalde publieke release met bewaartermijnen die nog als besluitpunt openstaan.

## Roadmap

- nieuw blok **Abonneeadministratie en AVG** op prioriteit A, status afgerond en Mirror-bewezen;
- bij *Niet in deze keten* toevoegen: definitieve juridische bewaartermijnen — wacht op besluit.

## Besluitregister

> ## SPARKI-BESLUIT-2026-010 — Sparki-lidnummer
> **Status:** besloten
> - Elke gebruiker krijgt één permanent, uniek en niet-herbruikbaar lidnummer in het formaat `SPK-JJJJ-NNNNNN`.
> - Het nummer verandert nooit en wordt na verwijdering niet hergebruikt.
> - Het is uitsluitend een referentie en nooit een authenticatiemiddel.

> ## SPARKI-BESLUIT-2026-011 — Gescheiden lifecycleflows
> **Status:** besloten
> - Abonnement opzeggen, pauzeren, hervatten, account deactiveren en account verwijderen zijn vijf afzonderlijke flows.
> - Een betaalincident verwijdert nooit sport-, route-, training- of gezondheidsdata.
> - Bij downgrade blijven alle routes zichtbaar; boven de gratis limiet alleen-lezen tot de gebruiker drie actieve routes kiest.

Besluit 2026-008 (24 maanden herleidbaar, daarna onomkeerbaar anonimiseren) blijft ongewijzigd van kracht en wordt in dit pakket uitgevoerd.

## Functiematrix

Nieuwe rijen: lidnummer · abonneeregister · levenscyclusstatussen · bewaarmatrix · privacyverzoeken · uitzonderingsprotocollen. Alle zes in het domein commercie/platform, met bewijsstatus uit het Mirror-rapport.
