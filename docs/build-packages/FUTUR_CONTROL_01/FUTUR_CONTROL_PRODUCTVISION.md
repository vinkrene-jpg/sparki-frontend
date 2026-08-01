# FUTUR_CONTROL_PRODUCTVISION

**Werknaam:** Futur Control · **Technische code:** `FUTUR_CONTROL_01`
**Eerste productconnector:** `SPARKI_CONTROL_CONNECTOR_01`
**Datum:** 1 augustus 2026 · **Status:** `OPEN` — geen fase vrijgegeven
**Regelcodes:** `FCV-01..`
**Bron:** `SPARKI_CONTROL_01_BOUWPAKKET v1.1` (volledig behouden, zie vertaaltabel)

---

## 1. Doel in één zin

Eén beveiligde beheeromgeving waarmee René als enige menselijke eindverantwoordelijke meerdere softwareproducten en de eigen infrastructuur bewaakt, incidenten laat analyseren, support afhandelt, releases vrijgeeft en continuïteit borgt — vanaf telefoon en desktop, ondersteund door AI en agents.

## 2. Wat Futur Control is

| Code | Regel |
|---|---|
| FCV-01 | Futur Control is een **beheersysteem**, geen product voor eindgebruikers. Er zitten geen sporters, clubs of klanten in. |
| FCV-02 | Futur Control is **productonafhankelijk**. Elk product wordt aangesloten via een connector die aan één standaardcontract voldoet. |
| FCV-03 | Futur Control is **de enige beheerlaag**. Er bestaat geen tweede beheerarchitectuur ernaast. |
| FCV-04 | Futur Control is **overdraagbaar en verkoopbaar**: geen persoonsafhankelijke configuratie, geen secrets in documentatie, test- en liveconfiguratie strikt gescheiden. |
| FCV-05 | Futur Control beheert ook **zichzelf** en de **eigen infrastructuur** (NAS, mini-server). Wat Control bewaakt maar zelf niet kan herstellen, staat als zodanig vermeld. |

## 3. Wat Futur Control niet is

- Geen tweede productiedatabase, geen schaduwproductie, geen datawarehouse.
- Geen roadmap-, planning- of projectmanagementtool. Volwassenheid tonen ≠ plannen.
- Geen autonome reparatiemachine. Agents analyseren en stellen voor; zij voeren niet uit.
- Geen vervanging van de productgerichte AI-helpdesk binnen een product.
- Geen analytics- of gebruikersonderzoeksplatform.

## 4. Aangesloten producten

| Product | Rol in Futur Control | Uitwerkingsniveau nu |
|---|---|---|
| **Sparki** | Eerste volledig uitgewerkte productconnector | Volledig — `SPARKI_CONTROL_CONNECTOR_01` |
| **FPS Connect** | Toekomstige connector | Alleen generieke aansluitstructuur; geen gegevens ingevuld |
| **Forge** | Toekomstige connector — **beheerd product**, nooit een tweede beheerlaag (`FC-B08 = C`) | Alleen aansluitstructuur; N0/leeg productrecord |
| **Toekomstige apps, websites en diensten** | Via hetzelfde connectorcontract | Alleen aansluitstructuur |
| **Eigen infrastructuur (NAS, mini-server)** | Via het infrastructuurregister en de infrastructuurconnector | Structuur volledig, metingen leeg tot F-INF |

**Regel FCV-06:** voor FPS Connect, Forge en toekomstige software worden **geen gegevens verzonnen**. Waar niets bekend is, staat `Onbekend` of `Nog niet aangesloten`.

## 5. Grondbeginselen

| Code | Beginsel |
|---|---|
| FCV-07 | **René is de enige definitieve vrijgever.** Geen agent, geen automatisering en geen tweede persoon geeft `RENE_APPROVED` af. |
| FCV-08 | **Geen vals groen.** Een ontbrekende, verouderde of onbetrouwbare meting toont `Onbekend`. Nooit `Gezond`, nooit leeg zonder uitleg. |
| FCV-09 | **Geen schattingen.** Geen benaderingen, voorlopige getallen, indicatieve waarden of tijdelijke handmatige invoer. Een getal betekent: er is een meting. |
| FCV-10 | **Ping is geen gezondheid.** Een dienst geldt pas als gezond na een functionele controle die de werkelijk gebruikte functie raakt. |
| FCV-11 | **Fail-closed, nooit fail-open.** Een onleesbare bron voegt nooit rechten of zekerheid toe. Leesbare bronnen blijven geldig. |
| FCV-12 | **Append-only audit.** Iedere handeling van mens of agent is achteraf aantoonbaar; niets wordt stil gewijzigd. |
| FCV-13 | **Isolatie in twee richtingen.** Uitval van een product mag Control niet uitschakelen; uitval van Control mag een product niet blokkeren. |
| FCV-14 | **Mobiel is geen verkleinde desktop.** Twee ontwerpen, één informatiemodel. |
| FCV-15 | **Kleine fasen.** Eén fase tegelijk vrijgegeven, elk met eigen bewijs en Mirror-toets. |
| FCV-16 | **Geen mockdata.** Geen fictieve incidenten, voorbeeldproducten of demogebruikers in een scherm dat als echt wordt gepresenteerd. |
| FCV-17 | **Observeren vóór ingrijpen — harde fasegrens.** De eerste productieve versie van Futur Control is **read-only** richting aangesloten softwareproducten, NAS, mini-server, cloudinfrastructuur en externe diensten. Toegestaan: lezen, meten, registreren, incidenten en kennisitems binnen Control opslaan, analyseren, voorstellen voorbereiden, waarschuwingen sturen, agents stoppen binnen Control. Externe muterende functies worden pas in een **afzonderlijke toekomstige bouwreeks** gebouwd of vrijgegeven, na `MIRROR_PROVEN` op de volledige keten en daarna expliciete vrijgave door René. Zie `FUTUR_CONTROL_MUTATION_GATE.md` — dat document gaat boven elk ander document in dit pakket. |
| FCV-18 | **Intern mag, extern niet.** Control houdt zijn eigen administratie bij (incidentstatus, notities, kennisitemversies, supportconcepten, goedkeuringen, blokkades). Wat verboden is, is **enig effect veroorzaken in een aangesloten product, op infrastructuur of bij een externe dienst.** |

## 6. Waarom generiek en niet per product

Sparki is niet het laatste product. Bij drie of meer producten leidt beheer-per-product tot drie incidentmodellen, drie auditsporen, drie noodstoppen en drie mobiele omgevingen — en tot de situatie dat René niet meer weet waar hij moet kijken als er iets misgaat. De kern wordt daarom één keer gebouwd; per product komt er alleen een connector bij.

Wat dit kost: de eerste connector (Sparki) is duurder dan een Sparki-eigen beheerpaneel zou zijn geweest. Dat is de prijs van de tweede en derde connector die daarna vrijwel gratis zijn.

## 7. Rolverdeling

- **René** — beslist, keurt goed, is enige vrijgever, is de enige met break-glass-toegang.
- **Replit** — bouwt uitsluitend de vrijgegeven fase, levert bewijs, wijzigt niets buiten scope.
- **Mirror** — toetst onafhankelijk op een vaste gepushte SHA.
- **ChatGPT** — bewaakt samenhang, documentstructuur en nummering; controleert dit pakket op volledigheid, overlap, veiligheid, fasering en open eindjes vóór er iets wordt gebouwd.
- **Claude** — levert documentatie en onafhankelijke controle; schrijft geen productiecode en neemt geen productbesluiten.
- **Agents** — analist en voorstelmaker. Zie `FUTUR_CONTROL_AGENT_GOVERNANCE.md`.

## 8. Statuswoorden

**Meetstatus:** `Gezond` · `Aandacht nodig` · `Verstoord` · `Kritiek` · `Onbekend`
**Bouwstatus:** `PROVEN_READY` · `BUILT_UNPROVEN` · `PARTIAL` · `OPEN` · `DEFERRED` · `INGETROKKEN`
**Vrijgaveketen:** `BUILT → TESTED → MIRROR_PROVEN → RENE_APPROVED → DEPLOYED → LIVE_VERIFIED`

## 9. Wat succes betekent

Futur Control is geslaagd wanneer René op zijn telefoon binnen dertig seconden kan zien of er iets aan de hand is, bij welk product, welke gebruikers het raakt en wat de eerstvolgende handeling is — en wanneer het antwoord "ik weet het niet" nooit wordt gepresenteerd als "alles is in orde".

## 10. Verwijzingen

`FUTUR_CONTROL_MUTATION_GATE.md` (leidend) · `FUTUR_CONTROL_ARCHITECTURE.md` · `FUTUR_CONTROL_SECURITY_MODEL.md` · `FUTUR_CONTROL_PRODUCT_CONNECTOR_STANDARD.md` · `FUTUR_CONTROL_DEPENDENCY_REGISTRY_STANDARD.md` · `FUTUR_CONTROL_HEALTHCHECK_STANDARD.md` · `FUTUR_CONTROL_AGENT_GOVERNANCE.md` · `FUTUR_CONTROL_MOBILE_DESKTOP_UX.md` · `FUTUR_CONTROL_CONTINUITY_STANDARD.md` · `FUTUR_CONTROL_BUILD_ROADMAP.md` · `FUTUR_CONTROL_MIRROR_TESTSTANDARD.md` · `FUTUR_CONTROL_INFRASTRUCTURE_STANDARD.md` · `FUTUR_CONTROL_NAS_CONNECTOR_STANDARD.md` · `FUTUR_CONTROL_LOCAL_SERVER_STANDARD.md` · `FUTUR_CONTROL_HYBRID_ARCHITECTURE.md` · `FUTUR_CONTROL_INFRASTRUCTURE_MIRROR_TESTSTANDARD.md` · `SPARKI_CONTROL_CONNECTOR_01_BOUWPAKKET.md` · `FUTUR_CONTROL_VERTAALTABEL.md` · `FUTUR_CONTROL_OPEN_BESLUITEN.md`

**Mobiele UX conform `MOBILE_UX_STANDARD_01` (v1.4).** **Rapportage conform `REPORT_DESIGN_STANDARD_01`.**
