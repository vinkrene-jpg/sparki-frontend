# SPARKI_CONTROL_CONNECTOR_01 — Bouwpakket (5-delig)

**Technische code:** `SPARKI_CONTROL_CONNECTOR_01`
**Positie:** eerste productconnector op `FUTUR_CONTROL_01`
**Datum:** 1 augustus 2026 · **Status:** `OPEN` — **niet vrijgegeven**
**Bron:** `SPARKI_CONTROL_01_BOUWPAKKET v1.1` (zie `FUTUR_CONTROL_VERTAALTABEL.md`)
**Regelcodes:** `SCC-01..`

---

# DEEL 0 — KADER

## 0.1 Wat dit pakket wel en niet doet

**Wel:** Sparki aansluiten op de generieke Control-kern — inventarisatie, connectorcontract, velden, bronnen, functionele controles, Sparki-specifieke registratie en het bewijs daarvan.

**Niet:** de kern zelf bouwen. Audit, incidentmodel, kennisitems, agentbesturing, supportinbox, releaseketen, Product Health, Capability Matrix, *Vandaag als beheerder*, noodstop, noodmodus, rapportage en de mobiele omgeving zijn **generiek** en staan in `FUTUR_CONTROL_BUILD_ROADMAP.md`. Dit pakket voegt daar geen kopie aan toe.

| Code | Regel |
|---|---|
| SCC-01 | De connector is **lezend**. Geen enkel schrijfrecht op Sparki, ook niet voorbereid en ook niet als ongebruikte scope. De basisversie veroorzaakt **geen enkel waarneembaar effect** in Sparki. |
| SCC-02 | De connector brengt **geen eigen** incidentmodel, auditspoor, rechtenmodel of statusvocabulaire mee. |
| SCC-03 | Elk veld heeft een aantoonbare bron uit de Sparki-inventarisatie. Geen bron = `Onbekend`. |
| SCC-04 | Er wordt niets over Sparki aangenomen op grond van wat gebruikelijk is. Alles wordt geverifieerd. |
| SCC-05 | Sparki's eigen lopende bouwpakketten worden **niet** aangeraakt. De connector leest; hij verbetert niets. |
| SCC-06 | Sparki is en blijft het eerste, niet het enige product. Wat hier product-specifiek wordt opgelost, wordt gemeld als tekortkoming van het generieke contract. |

## 0.2 Uitgangssituatie

Sparki is in actieve ontwikkeling met een lopende reeks eigen bouwpakketten. Deze connector loopt **naast** die reeks en is er niet van afhankelijk. Concreet: `ROUTE_PAKKET_02b..02d`, taak #536 (wandelen), PR 507 en de openstaande product- en juridische besluiten mogen deze connector niet blokkeren, en deze connector mag hen niet vertragen.

---

# DEEL 1 — REPLIT-BOUWOPDRACHT PER FASE

## SCC-F0 — Sparki-inventarisatie · **geen code**

Onderdeel van `FUTUR_CONTROL_BUILD_ROADMAP.md` F0. Specifiek voor Sparki wordt vastgelegd, met vindplaats per regel:

1. **Health en versie** — bestaat er een health-endpoint; hoe is de draaiende productie-SHA vast te stellen vanuit de draaiende omgeving zelf (niet uit een document).
2. **API** — welke admin- of beheerendpoints bestaan, met methode, autorisatie en of ze lezend of schrijvend zijn.
3. **Database** — verbindingsgegevens op metaniveau, migratietoestand, hoe die uitleesbaar is.
4. **Achtergrondtaken** — welke jobs, cron of queues draaien; waar hun status staat; wat er bij falen gebeurt.
5. **Fouten** — waar applicatiefouten landen; bestaat er foutaggregatie; bestaat er crash reporting (bekend openstaand punt).
6. **Gebruikersimpact** — welke registratie maakt het mogelijk een **bovengrens** van getroffen gebruikers af te leiden, per functie.
7. **Synchronisatie** — welke externe koppelingen bestaan werkelijk (Strava, Garmin, andere), hoe de laatste succesvolle synchronisatie is vast te stellen.
8. **Betalingen** — Stripe-webhookverwerking, retries, idempotentie, en hoe test en live gescheiden zijn.
9. **Support** — welke ticket- of meldstructuur bestaat; wat is gebruikersgericht en wat beheerdersgericht.
10. **Tests en Mirror** — waar CI-uitkomsten staan; hoe `MIRROR_PROVEN`-oordelen per onderdeel vindbaar zijn.
11. **Release** — welke workflows bestaan (validators, typecheck, admin-smoke en verdere), waar de productie-SHA staat, of er een rollbackpad is.
12. **Back-up** — wat wordt geback-upt, hoe vaak, waarheen, en of herstel ooit werkelijk is getest.
13. **Beveiliging** — aanmeldpogingen, rechtenwijzigingen, sleutelbeheer.
14. **Datatrust** — wat het bestaande `DATA_TRUST_01`-werk oplevert als meetbaar signaal.
15. **Gebruiksmeting** — wat er feitelijk gemeten wordt; wat níet (functiegebruik is bekend afwezig).
16. **Degradatie** — waar `degraded:true` al bestaat en waar niet.
17. **Externe diensten** — de startlijst uit `FUTUR_CONTROL_DEPENDENCY_REGISTRY_STANDARD.md` §4 regel voor regel bevestigen of weerleggen, inclusief welke kaart- en routediensten werkelijk worden gebruikt en welke authenticatievoorziening.
18. **Rollen** — of `admin` een rolwaarde binnen `clubRoles` is of daarbuiten staat, en welke rechten die geeft.

**Oplevering:** `SPARKI_CONNECTOR_INVENTARISATIE.md` — per veld uit het connectorcontract: bron · actualiteit · betrouwbaarheid · fallback · gedrag bij ontbreken · reikwijdte · **haalbaar niveau** (N1/N2/N3).
**Bewijs:** diff bevat uitsluitend documenten; elke bevestiging heeft een vindplaats; elke ontkenning vermeldt waar is gezocht.

---

## SCC-F1 — Read-only koppeling, niveau N1

**Voorwaarde:** `FUTUR_CONTROL` F3 `MIRROR_PROVEN` (registers bestaan, wat F1A/B/C veronderstelt) + SCC-F0 `MIRROR_PROVEN`.

**Bouwen:** connectoridentiteit met eigen sleutel **per omgeving** · velden healthstatus, versie en commit-SHA, API-status, database-status, degradatiestatus · zeven metagegevens per veld · contractversie · tijdslimiet en backoff · registratie in het connectorregister.

**Niet bouwen:** geen schrijfpad, geen extra velden, geen schermen (die zijn generiek), geen wijziging in Sparki zelf behalve — indien onvermijdelijk — een **lezend** health- of versie-endpoint, dat dan als aparte, minimale wijziging met eigen bewijs wordt geleverd.

**Bewijs:** de connector schrijft aantoonbaar niets · een sleutel werkt in precies één omgeving · een niet-geleverd veld toont `Onbekend` · een gecachte waarde toont haar leeftijd · een poging tot data buiten het contract wordt geweigerd en gelogd · de productie-SHA is afgeleid uit de **draaiende omgeving**, niet uit een document.

---

## SCC-F2 — Uitbreiding naar niveau N2

**Voorwaarde:** SCC-F1 `MIRROR_PROVEN`.

**Bouwen:** achtergrondtaken · foutmeldingen · gebruikersimpact · synchronisatiestatus · datatruststatus · beveiligingssignalen.

**Regel SCC-07:** gebruikersimpact is een **bovengrens uit registratie**, nooit een schatting. Is die niet af te leiden, dan `Onbekend` — geen percentage, geen aanname.
**Regel SCC-08:** ontbrekende synchronisatieperiodes worden als ontbrekend getoond. Geen interpolatie, geen voorbeeldactiviteiten.

**Bewijs:** elke waarde herleid tot bron · impact herleidbaar tot registratie · ontbrekende periodes zichtbaar als gat.

---

## SCC-F3 — Functionele controles voor Sparki

**Voorwaarde:** SCC-F2 `MIRROR_PROVEN` + `FUTUR_CONTROL` F5b vrijgegeven.

**Bouwen** — uitsluitend voor diensten die in SCC-F0 zijn **bevestigd**:
- **Stripe:** testwebhook ontvangen · handtekening geldig · gebeurtenis verwerkt · juiste organisatie of gebruiker bijgewerkt · retry en idempotentie · test/live strikt gescheiden (aparte controle met eigen afkeurgrond).
- **Routeberekening:** aanvraag slaagt · bedoeld profiel gebruikt · geldige geometrie · afstand en hoogte binnen vooraf vastgelegde grenzen voor de testroute · begrijpelijk foutpad · quota en responstijd.
- **Kaartlaag:** zoekopdracht werkt · tegels laden · bronvermelding aanwezig · data niet onverwacht verouderd · uitval blokkeert de routeflow niet stil.
- **Activiteitensynchronisatie:** authenticatie geldig · tokenvernieuwing werkt vóór verloop · laatste synchronisatie bekend · webhook of polling werkt, stilte gedetecteerd · duplicaten voorkomen · ontbrekende data **niet** vervangen door voorbeelddata.
- **GitHub en Replit:** repository bereikbaar · branch en SHA bekend · build- en teststatus bekend · deploymentversie vergelijkbaar met repository · geen vals livebewijs.
- **E-mail en notificaties:** aflevering getest naar een testadres · bounces zichtbaar · notificatie opent de juiste actie · geen gevoelige informatie in een onbeveiligde melding.
- **Authenticatievoorziening:** aanmelden met testidentiteit · sessievernieuwing · uitval leidt tot geweigerde toegang, niet tot ruimere rechten.

**Regel SCC-09:** geen enkele controle raakt echte gebruikersdata of veroorzaakt een echte transactie, e-mail of activiteit.
**Regel SCC-10:** voor een dienst die in SCC-F0 niet is bevestigd wordt **geen** controle gebouwd. Zij blijft `Onbekend`.

**Bewijs:** per controle vastgelegde stappen, verwachte uitkomst, tijd, frequentie en houdbaarheid · een gefaalde controle vermeldt welke stap faalde · een niet-gedraaide controle levert `Onbekend`.

---

## SCC-F4 — Impactketen voor Sparki

**Voorwaarde:** SCC-F3 `MIRROR_PROVEN` + `FUTUR_CONTROL` F6b `MIRROR_PROVEN`.

**Bouwen:** de ketens dienst → connector → **Sparki-functie** → gebruikersgroep, voor minimaal: routeberekening · kaartweergave · navigatie · GPX-export · activiteitensynchronisatie · betalingen en abonnementsrechten · aanmelden · e-mail en meldingen · rapporten en exports.

**Gebruikersgroepen:** de rollen zoals zij server-side bestaan. Een rol die niet server-side bestaat komt niet in de keten.

**Voorbeeld (vorm, niet als vaststaand feit):** routedienst verstoord → Sparki-routeconnector → *route maken* en *route herberekenen* → sporters en gasten → incident met passende fout- of fallbackstatus.

**Bewijs:** elke schakel klikbaar · getroffen aantallen herleidbaar of `Onbekend` · voor elke functie is vastgelegd of veilige degradatie mogelijk is.

---

## SCC-F5 — Registratie en overdracht

**Voorwaarde:** SCC-F4 `MIRROR_PROVEN`.

**Bouwen:** volledige vulling van het Sparki-productrecord (`FCA-10`) · alle bevestigde diensten in het dependencyregister met risicoklasse · connectorregistratie met contractversie en **bewezen** niveau · Sparki-domeinen in de Capability Matrix, met `Nog niet aanwezig` waar van toepassing · Sparki-NAS-koppeling conform `FUTUR_CONTROL_NAS_CONNECTOR_STANDARD.md` §5.

**Bewijs:** geen handmatig veld dat als connectorwaarde wordt gepresenteerd · geclaimd niveau gelijk aan bewezen niveau · overdraagbare connectorhandleiding zonder secrets.

---

# DEEL 2 — MIRROR-TOETSOPDRACHT

Naast de algemene toetsen `FCM-10..27`:

| Fase | Scenario's | Directe afkeurgronden |
|---|---|---|
| SCC-F0 | Vijf bevestigde regels zelf natrekken in de code; drie ontkende regels zelf zoeken | Diff bevat code · vindplaats ontbreekt · bevestigd onderdeel bestaat niet · haalbaar niveau geclaimd zonder onderbouwing |
| SCC-F1 | Elk veld naar zijn bron; connector afknijpen; schrijfpoging; sleutel in tweede omgeving; contractversie verwijderen; SHA vergelijken met draaiende omgeving | Schrijfactie mogelijk · veld zonder bron · oude waarde als actueel · onbekende contractversie geaccepteerd · SHA uit een document in plaats van uit de omgeving |
| SCC-F2 | Impactgetal herleiden; synchronisatiegat maken | Schatting in plaats van `Onbekend` · gat opgevuld · voorbeelddata |
| SCC-F3 | Elke controle laten falen op één stap; test/live-scheiding forceren; controle laten verlopen | Vals groen · echte gebruikersdata geraakt · test- en liveobject vermengd · verlopen controle blijft `Gezond` · controle gebouwd voor een onbevestigde dienst |
| SCC-F4 | Keten volgen tot gebruikersgroep; rol gebruiken die server-side niet bestaat | Keten als vrije tekst · geschat gebruikersaantal · niet-bestaande rol in de keten |
| SCC-F5 | Geclaimd niveau natellen; handmatige velden zoeken; handleiding doorzoeken op secrets | Niveau hoger dan bewezen · handmatig veld als meting · secret in documentatie |

---

# DEEL 3 — AFHANKELIJKHEDEN

| Fase | Verplicht `MIRROR_PROVEN` | Mag **niet** blokkeren |
|---|---|---|
| SCC-F0 | — | alle lopende Sparki-bouwpakketten · openstaande product- en juridische besluiten |
| SCC-F1 | FC F3 · SCC-F0 | ontbrekende monitoring en crash reporting · ontbrekende gebruiksmeting |
| SCC-F2 | SCC-F1 | `ROUTE_PAKKET_02b..02d` · taak #536 · PR 507 |
| SCC-F3 | SCC-F2 · FC F5b | diensten die in F0 `Onbekend` bleven · quota-onduidelijkheid |
| SCC-F4 | SCC-F3 · FC F6b | rollen die nog niet server-side bestaan · openstaande pakketgrenzen |
| SCC-F5 | SCC-F4 | merkbesluit · bewaartermijnen · besluitnummering |

**Harde koppeling naar buiten:** geen. Deze connector wijzigt geen Sparki-functionaliteit en heeft daarom geen productbesluit nodig — met één uitzondering: als in SCC-F1 blijkt dat Sparki geen uitleesbare productie-SHA of health-status heeft, is een **minimale lezende toevoeging** in Sparki nodig. Die toevoeging wordt gebouwd en vrijgegeven **binnen de Sparki-keten**, niet vanuit Control: Control voert daarbij niets uit en schrijft niets. Het is een aparte, apart vrij te geven Sparki-wijziging met eigen bewijs, en valt daarmee niet onder de mutatiepoort.

---

# DEEL 4 — HERSTELPROTOCOL

Het generieke protocol uit `FUTUR_CONTROL_BUILD_ROADMAP.md` Deel 4 geldt onverkort. Aanvullend:

**SCC-11:** een fout in de connector wordt **in de connector** opgelost. Er wordt niet in Sparki gerepareerd om een connectorbevinding te laten verdwijnen, behalve wanneer Mirror aantoont dat de oorzaak in Sparki ligt — en dan gaat die reparatie als eigen Sparki-taak door de normale Sparki-keten.
**SCC-12:** blijkt een veld structureel niet leverbaar, dan wordt het niveau **verlaagd**, niet het veld geschrapt. Het veld blijft zichtbaar op `Onbekend`.
**SCC-13:** blijkt het generieke contract voor Sparki niet te volstaan, dan is dat een bevinding op het **contract**, niet een reden voor een Sparki-uitzondering. Uitzonderingen zijn het begin van een tweede architectuur.
**SCC-14:** een productiestoring in Sparki gaat altijd voor op connectorwerk; de pauze staat in de dagkaart.

---

# DEEL 5 — SYNCHRONISATIEPATCH

| Document | Wat erin komt |
|---|---|
| **Afbouwmatrix** | `SPARKI_CONTROL_CONNECTOR_01` als eigen regel met fasen SCC-F0..F5, gescheiden van `FUTUR_CONTROL_01` |
| **Dagkaart** | Regel per vrijgave, oplevering en Mirror-oordeel, met SHA |
| **Releasestatus** | Niet blokkerend voor de besloten pilot; wel voor de betaalde publieke release |
| **Roadmap** | Connectorreeks naast de lopende Sparki-domeinpakketten; expliciete notitie dat deze reeks Sparki-functionaliteit niet wijzigt |
| **Besluitregister** | Alleen indien een minimale lezende toevoeging in Sparki nodig blijkt; dan als eigen besluit |
| **Capability Matrix** | Sparki-domeinen worden gevoed zodra SCC-F5 leeft |
| **`SPARKI_CONTROL_01_BOUWPAKKET v1.1`** | Blijft bestaan als bronpakket, met verwijzing naar de vertaaltabel; **niet intrekken zonder expliciet besluit** (`FC-B01`) |
