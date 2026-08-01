# ABONNEE_ADMIN_01 — HERSTELPROTOCOL

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


## Wat Replit doet bij een Mirror-afkeuring

1. **Alleen de benoemde blokkade herstellen**, op een nieuwe commit vanaf de afgekeurde commit. Geen refactor, geen opruiming, geen scope-uitbreiding.
2. Oorzaak niet met zekerheid vast te stellen: **melden, niet gokken.**
3. Vereist de fix een juridisch of productbesluit — een bewaartermijn, een bevoegdheid, een refundregel — dan **stoppen en voorleggen aan René**.
4. **Nooit herstellen door een flow te verbergen.** Een verwijderknop weghalen omdat de dry-run niet klopt is geen fix.
5. **Nooit herstellen op productiedata.** Geen enkele correctie wordt uitgevoerd op echte accounts vóórdat de hertest van het afgekeurde scenario groen is (technische voorwaarde, geen menselijke wachtpoort).
6. In het herstelrapport: blokkade, oorzaak, wijziging, en waarom die de oorzaak wegneemt — niet het symptoom.

## Wat opnieuw getest wordt

| Wel | Niet |
|---|---|
| het afgekeurde scenario | de volledige toetsen van `01`, `02a` en `ABONNEMENT_01` |
| alle scenario's die dezelfde code raken | scenario's in ongewijzigde bestanden |
| `test:entitlements`, `test:stripe-billing`, `test:account`, `test:support-helpdesk`, `test:privacy-security`, typecheck | een volledige regressie over alle testsuites |
| de eigen tests van dit pakket, volledig | handmatig hertesten wat een test al afdekt |

## Uitzonderingslijst — hier blijft een fout niet lokaal

- de **lidnummeruitgifte** en haar unieke sleutel;
- de **statusmachine** en haar vertaaltabel naar rechten;
- de **verwijder- en anonimiseerlaag**;
- `admin_ops_log` en de **bevoegdhedencontrole**.

Raakt de fix een van deze vier, dan vervalt de inperking hierboven en wordt het hele pakket hertoetst, inclusief de kernscenario's van `ABONNEMENT_01`.

> Deze lijst geldt uitsluitend voor dit pakket. Overnemen naar een ander domein is een fout.

## Extra regel voor destructieve onderdelen

Raakt een blokkade een verwijder-, anonimiseer- of retentiejob, dan geldt bovendien:

- de job gaat terug naar **dry-run** en blijft daar tot de hertest van het afgekeurde scenario en de migratie-/rollbackvalidatie groen zijn;
- er wordt geen enkele echte uitvoering gedaan tussen afkeuring en groene hertest;
- de dry-runuitvoer vóór en ná de fix worden naast elkaar geleverd.

## Grens aan het heen en weer

Na **twee** herstelronden op dezelfde blokkade stopt het en gaat het naar René. Dan is er geen bouwfout maar een onduidelijke opdracht of een ontbrekend besluit.

## Wat een afkeuring nooit betekent

Geen herbouw van het pakket, geen terugdraaien van `ABONNEMENT_01`, en geen stilzetten van pakketten zonder technische afhankelijkheid.
