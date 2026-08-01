# FUTUR_CONTROL_HEALTHCHECK_STANDARD

**Regelcodes:** `HCK-01..` · **Status:** `OPEN` · **Datum:** 1 augustus 2026
Functionele controles, degradatie en fail-closed-gedrag.

---

## 1. Grondbeginsel

**HCK-01:** een dienst is niet gezond omdat een homepage of een API-endpoint antwoordt. Gezondheid betekent: de functie die het product werkelijk gebruikt, is aantoonbaar uitgevoerd, met een aannemelijke uitkomst, binnen een aanvaardbare tijd.

| Code | Regel |
|---|---|
| HCK-02 | Elke kritieke en belangrijke afhankelijkheid heeft minstens één **functionele synthetische controle**. |
| HCK-03 | Een functionele controle raakt nooit echte gebruikersdata en creëert geen echte transacties, e-mails of activiteiten. |
| HCK-04 | Een functionele controle draait tegen de **test- of sandboxzijde** waar die bestaat, en gebruikt uitsluitend daarvoor bestemde testobjecten. |
| HCK-05 | Faalt een controle, dan wordt vastgelegd **welke stap** faalde — niet alleen dat het faalde. |
| HCK-06 | Een controle die niet kon draaien levert `Onbekend`, niet `Verstoord` en zeker niet `Gezond`. |
| HCK-07 | Frequentie is per controle vastgelegd en zichtbaar. Een controle die zeldzamer draait dan haar houdbaarheid levert structureel `Onbekend`. |
| HCK-08 | Een geslaagde controle is pas geldig binnen haar houdbaarheid. Daarbuiten vervalt zij naar `Onbekend`. |

## 2. Vorm van een controle

Elke controle legt vast: naam · doel · geraakte productfunctie · omgeving · stappen · verwachte uitkomst · aanvaardbare tijd · foutpad · frequentie · houdbaarheid · wat de uitkomst betekent voor de status · wie gewaarschuwd wordt.

## 3. Controles per integratie

### 3.1 Stripe
- testwebhook wordt ontvangen;
- handtekening is geldig;
- gebeurtenis wordt verwerkt;
- de juiste organisatie of gebruiker is bijgewerkt;
- retry en idempotentie werken (dezelfde gebeurtenis tweemaal geeft één effect);
- test en live zijn strikt gescheiden — een testgebeurtenis raakt nooit live-objecten.

**HCK-09:** de scheidingscontrole test/live is een **afzonderlijke** controle met een eigen directe afkeurgrond. Vermenging is geen degradatie maar een storing van de hoogste ernst.

### 3.2 GraphHopper (routeberekening)
- routeaanvraag slaagt;
- het bedoelde routeprofiel is gebruikt;
- de route bevat geldige geometrie;
- afstand en hoogte zijn aannemelijk (binnen vooraf vastgelegde grenzen voor de testroute);
- het foutpad levert een begrijpelijke melding;
- quota en responstijd worden bewaakt.

**HCK-10:** "aannemelijk" is een vaste, vooraf vastgelegde grens per testroute — geen oordeel achteraf en geen schatting.

### 3.3 OpenStreetMap en kaartlaag
- zoekopdracht levert resultaat;
- kaarttegels laden binnen de aanvaardbare tijd;
- bronvermelding is aanwezig in de weergave;
- kaartdata is niet onverwacht verouderd;
- uitval blokkeert niet stil de hele routeflow — de gebruiker ziet wat er niet werkt.

### 3.4 Garmin, Strava en Whoop
- authenticatie is geldig;
- tokenvernieuwing werkt vóór het token verloopt;
- laatste synchronisatie is bekend en niet ouder dan de vastgelegde grens;
- webhook of polling werkt (stilte wordt gedetecteerd);
- duplicaten worden voorkomen;
- ontbrekende data wordt **niet** vervangen door voorbeelddata.

**HCK-11:** het laatste punt is een harde regel, geen controle-eis: een synchronisatiebron die faalt levert een lege of gemarkeerde toestand. Nooit ingevulde voorbeeldactiviteiten.

### 3.5 GitHub en Replit
- repository is bereikbaar;
- branch en SHA zijn bekend;
- build- en teststatus zijn bekend;
- de deployment-versie is vergelijkbaar met de repository;
- geen vals livebewijs: als de draaiende versie niet aantoonbaar overeenkomt met een bekende SHA, is de status `Onbekend`.

**HCK-12:** "vals livebewijs" betekent hier: beweren dat productie op een bepaalde commit draait zonder dat dit uit de draaiende omgeving zelf blijkt. Dat is een directe afkeurgrond.

### 3.6 E-mail en notificaties
- aflevering is getest naar een daarvoor bestemd testadres;
- bounces en fouten zijn zichtbaar;
- een notificatie opent de juiste actie;
- geen gevoelige informatie in een onbeveiligde melding.

### 3.7 Database
- verbinding, latency en foutmarge;
- migratietoestand komt overeen met de draaiende versie;
- back-up bestaat én is aantoonbaar herstelbaar (zie `FUTUR_CONTROL_NAS_CONNECTOR_STANDARD.md`).

### 3.8 Authenticatievoorziening
- aanmelden met een testidentiteit slaagt;
- sessievernieuwing werkt;
- uitval leidt niet tot verruiming van rechten, maar tot geweigerde toegang (fail-closed).

## 4. Statusbepaling

| Uitkomst | Status |
|---|---|
| Alle stappen geslaagd, binnen tijd, binnen houdbaarheid | `Gezond` |
| Geslaagd maar traag, of één niet-kritieke stap gefaald | `Aandacht nodig` |
| Kritieke stap gefaald, functie werkt gedegradeerd | `Verstoord` |
| Kritieke stap gefaald, functie onbruikbaar of gegevensrisico | `Kritiek` |
| Niet gedraaid, verouderd, bron onbereikbaar, controle ontbreekt | `Onbekend` |

**HCK-13:** er is **geen** samengesteld totaalcijfer, op geen enkel niveau — niet per dienst, niet per product, niet over producten heen. Statussen staan naast elkaar.

## 5. Product Health

De zestien indicatoren uit het Sparki-pakket blijven ongewijzigd van kracht en worden nu **per product** getoond: open incidenten · open bugs · crashpercentage · synchronisaties · API-gezondheid · databasegezondheid · responstijd · achtergrondtaken · uptime · betalingsgezondheid · supportdruk · Mirror-score · testdekking · deploymentstatus · beveiligingsstatus · datatruststatus.

**HCK-14:** per indicator vijf verplichte velden: bron · laatste meting · trend · status · waarom.
**HCK-15:** vier metingen hebben op dit moment **geen bron** en tonen `Onbekend` tot er een echte meetbron bestaat: **crashpercentage · testdekking · supportdruk · actief functiegebruik**.
**HCK-16:** geen schattingen, geen benaderingen, geen voorlopige getallen, geen tijdelijke handmatig ingevoerde waarden — ook niet "indicatief", ook niet grijs, ook niet met een sterretje.
**HCK-17:** infrastructuur (NAS, mini-server) verschijnt als eigen kolom in Product Health, niet verstopt onder een product.

## 6. Degraded en fail-closed per domein

**HCK-18 — algemeen:** een onleesbare bron voegt geen rechten en geen zekerheid toe; leesbare bronnen blijven geldig; de uitkomst draagt `degraded:true`; beheer en support zien welke bron ontbreekt; na herstel volgt automatisch een nieuwe controle.

| Domein | Bij een onleesbare bron |
|---|---|
| **Rechten** | Geen verruiming. Bestaande, leesbare rechten blijven geldig; ontbrekende bewijzen geven geen extra recht. Een betalende gebruiker wordt **nooit** stil teruggezet naar Gratis — de toestand blijft staan met `degraded:true`. |
| **Betalingen** | Geen automatische intrekking, geen automatische toekenning. Onzekere betalingstoestand blokkeert wel nieuwe onomkeerbare handelingen (terugbetaling, opzegging) tot de bron terug is. |
| **Kaarten en routes** | De functie degradeert zichtbaar: wat niet berekend kan worden wordt gemeld, niet benaderd. Geen stille terugval op een ander profiel of een verouderde cache zonder melding. |
| **Synchronisaties** | Geen gaten opvullen. Ontbrekende periodes worden als ontbrekend getoond; geen geïnterpoleerde of voorbeeldactiviteiten. |
| **Support** | De medewerker ziet welke gegevens ontbreken vóór hij antwoordt. Een antwoord op onvolledige gegevens is toegestaan, maar de onvolledigheid staat in de zaak. |
| **Releases** | Ontbrekend test- of Mirror-bewijs blokkeert vrijgave. Geen doorgang op aanname. |
| **Gezondheidsscores** | `Onbekend` in plaats van een lagere of hogere score. Een score met ontbrekende invoer wordt niet berekend. |
| **Externe diensten** | Status `Onbekend`; de statuspagina van de leverancier vervangt de eigen controle niet. |
| **Infrastructuur** | Een NAS die niet antwoordt betekent `Onbekend` voor back-upstatus — niet "laatste back-up geslaagd". |

**HCK-19:** `degraded:true` is zichtbaar voor beheer én support, en verschijnt op *Vandaag als beheerder*. Degradatie die alleen in een logbestand staat, bestaat voor de beheerder niet.
**HCK-19a:** Control **onderneemt bij degradatie geen actie naar buiten**. Het meldt, toont de impactketen en stelt eventueel een handeling voor; uitvoeren doet een mens, in het betreffende product of apparaat. Ook de controles zelf zijn lezend: een functionele controle mag niets aanzetten, uitzetten, herstarten of herstellen.
**HCK-20:** herstelcontrole gebeurt automatisch en de terugkeer naar normaal wordt gelogd, zodat achteraf zichtbaar is hoe lang gedegradeerd is gedraaid.

## 7. Directe afkeurgronden

- `Gezond` op grond van een ping, een homepage of een leveranciersstatuspagina.
- Een controle die echte gebruikersdata raakt of een echte transactie, e-mail of activiteit veroorzaakt.
- Vermenging van test- en liveobjecten bij betalingen.
- Ontbrekende data vervangen door voorbeelddata.
- Een samengesteld totaalcijfer op enig niveau.
- Een indicator zonder bron, of een schatting in plaats van `Onbekend`.
- Fail-open: een onleesbare bron die tot ruimere rechten of tot doorgang leidt.
- Een betalende gebruiker die door degradatie stil terugvalt naar Gratis.
- Livebewijs zonder aantoonbare koppeling tussen draaiende omgeving en bekende SHA.
