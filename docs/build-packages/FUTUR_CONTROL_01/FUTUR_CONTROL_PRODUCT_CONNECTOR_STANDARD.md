# FUTUR_CONTROL_PRODUCT_CONNECTOR_STANDARD

**Regelcodes:** `PCS-01..` · **Status:** `OPEN` · **Datum:** 1 augustus 2026
Eén standaardcontract waarmee elk product op Futur Control wordt aangesloten.

---

## 1. Contractbeginselen

| Code | Regel |
|---|---|
| PCS-01 | Er is **één** connectorcontract. Een product past zich aan het contract aan, niet omgekeerd. |
| PCS-02 | De connector is **lezend**. Schrijfrechten bestaan in de basisversie niet, worden niet voorbereid als verborgen mogelijkheid en worden ook niet als lege of ongebruikte scope aangemaakt. |
| PCS-03 | De connector levert **velden**, geen schermen. Presentatie is altijd van Control. |
| PCS-04 | Een connector brengt **geen eigen** incidentmodel, auditspoor, rechtenmodel of statusvocabulaire mee. |
| PCS-05 | Een niet-geleverd veld is `Onbekend`. Een connector die een veld weglaat is niet "gezond met minder velden". |
| PCS-06 | De connector voert **geen berekeningen** uit die Control ook kan doen. Hij levert waarnemingen; Control bepaalt status. |
| PCS-07 | Elk contract heeft een **versie**. Control weigert een connector met een onbekende contractversie in plaats van te raden. |
| PCS-08 | Een connector mag nooit meer productdata leveren dan zijn contract beschrijft. Meer leveren is een bevinding, geen extra service. |

## 2. Verplichte velden

De achttien velden die een productconnector minimaal kan leveren:

| # | Veld | Wat het beschrijft |
|---|---|---|
| 1 | healthstatus | Werkt het product als geheel |
| 2 | versie en commit-SHA | Wat draait er feitelijk op productie |
| 3 | API-status | Bereikbaarheid en foutgedrag van de eigen API |
| 4 | database-status | Verbinding, latency, foutmeldingen, migratietoestand |
| 5 | achtergrondtaken | Draaiende, wachtende en gefaalde taken |
| 6 | foutmeldingen | Recente applicatiefouten, geaggregeerd |
| 7 | gebruikersimpact | Welke gebruikersgroepen geraakt worden en hoeveel (bovengrens uit registratie) |
| 8 | synchronisatiestatus | Externe datasynchronisaties, laatste succes, achterstand |
| 9 | betalingen | Webhookverwerking, mislukte betalingen, test/live-scheiding |
| 10 | supportcontext | Open zaken, wachttijd, categorie |
| 11 | testresultaten | Uitkomst van geautomatiseerde tests op een vaste SHA |
| 12 | Mirror-oordelen | Welke onderdelen `MIRROR_PROVEN` zijn en op welke SHA |
| 13 | releasestatus | Kandidaten en hun plaats in de vrijgaveketen |
| 14 | back-upstatus | Laatste back-up, omvang, en of herstelbaarheid aantoonbaar is |
| 15 | beveiligingssignalen | Aanmeldpogingen, rechtenwijzigingen, sleutelstatus |
| 16 | datatruststatus | Betrouwbaarheid van de gegevens waarop het product beslissingen neemt |
| 17 | gebruiksmeting | Alleen indien werkelijk aanwezig; anders `Onbekend` |
| 18 | degradatiestatus | Welke bronnen op dit moment onleesbaar zijn (`degraded:true`) |

## 3. Metagegevens per veld

**PCS-09:** elk geleverd veld draagt zeven metagegevens mee. Ontbreekt er één, dan is de waarde `Onbekend`.

| Metagegeven | Betekenis | Voorbeeldwaarden |
|---|---|---|
| Bron | Concreet systeem, endpoint of query | `admin-API /health`, `CI-run`, `handmatig door René` |
| Actualiteit | Tijdstip van de meting zelf + houdbaarheid | meting 06:12, houdbaar 15 min |
| Betrouwbaarheid | Hoe hard de waarneming is | `gemeten` · `afgeleid` · `gerapporteerd` · `onbekend` |
| Lees- of schrijfrecht | Wat de connector met dit veld mag | nu altijd `lezen` |
| Fallback | Wat wordt geprobeerd als de primaire bron faalt | tweede endpoint, cache met leeftijd, geen |
| Gedrag bij ontbreken | Wat Control toont | altijd `Onbekend` met reden |
| Reikwijdte | Welk deel van het product het veld dekt | hele product, één module, één omgeving |

**PCS-10:** `afgeleid` en `gerapporteerd` zijn toegestane betrouwbaarheden, maar ze worden **zichtbaar** getoond. Een afgeleide waarde wordt nooit als gemeten gepresenteerd.

## 4. Conformiteitsniveaus

| Niveau | Eis | Gevolg |
|---|---|---|
| **N0 — geregistreerd** | Product staat in het productregister, geen connector | Alle velden `Onbekend`; product zichtbaar, niet bewaakt |
| **N1 — basis** | Velden 1, 2, 3, 4, 18 met volledige metagegevens | Verschijnt in Product Health en *Vandaag als beheerder* |
| **N2 — bewaakt** | N1 + velden 5, 6, 7, 8, 14, 15 + functionele healthchecks | Impactketen bruikbaar; incidenten koppelbaar |
| **N3 — volledig** | Alle achttien velden, alle metagegevens, alle functionele controles | Capability Matrix volledig invulbaar |

**PCS-11:** het niveau van een connector staat zichtbaar bij het product. Niveau wordt **niet** afgerond naar boven; één ontbrekend verplicht veld verlaagt het niveau.
**PCS-12:** Sparki streeft naar N3, maar start op het niveau dat de F0-inventarisatie feitelijk aantoont. Er wordt geen niveau geclaimd dat niet is bewezen.

## 5. Gedrag bij storing

**PCS-13:** een connector die niet antwoordt levert `Onbekend`, geen laatst bekende waarde als ware die actueel. Een gecachte waarde mag getoond worden **met** haar leeftijd en met status `Onbekend` zodra de houdbaarheid is verstreken.
**PCS-14:** een connector die tijdelijk faalt maakt uit zichzelf **geen** incident aan. Incidentvorming is een beslissing van de kern op basis van drempels die per veld zijn vastgelegd.
**PCS-15:** een connector heeft een eigen tijdslimiet en beïnvloedt nooit de laadtijd van een scherm. Eén trage bron blokkeert nooit het hele beeld.
**PCS-16:** herhaald falen leidt tot terugschakelen in frequentie (backoff), niet tot stilzwijgend stoppen. Een gestopte connector is zichtbaar gestopt.

## 6. Registratie en levenscyclus

Een connector wordt aangesloten in vijf stappen, elk met bewijs:
1. **Inventarisatie** — welke bronnen bestaan er werkelijk in het product (F0).
2. **Contractvulling** — welke velden het product kan leveren, met bron per veld.
3. **Read-only koppeling** — eigen identiteit, eigen sleutel, alleen de contractvelden.
4. **Verificatie** — elke geleverde waarde teruggevoerd tot zijn bron; elk niet-geleverd veld aantoonbaar `Onbekend`.
5. **Registratie** — connector in het connectorregister met contractversie en conformiteitsniveau.

**PCS-17:** een contractwijziging is een versiesprong met eigen Mirror-toets. Velden worden nooit stil van betekenis veranderd.
**PCS-18:** het uitzetten van een connector is een geauditeerde handeling met reden; het product blijft zichtbaar met alle velden op `Onbekend`.

## 7. Toepassing per product

| Product | Nu | Wat wel wordt vastgelegd |
|---|---|---|
| **Sparki** | Volledige uitwerking | Zie `SPARKI_CONTROL_CONNECTOR_01_BOUWPAKKET.md` |
| **FPS Connect** | Alleen aansluitstructuur | Leeg productrecord, N0, geen verzonnen gegevens |
| **Forge** | Alleen aansluitstructuur | Leeg productrecord, N0 — **positie open**, zie `FC-B08` |
| **Toekomstig** | Alleen aansluitstructuur | Hetzelfde contract, geen uitzonderingen |

## 8. Directe afkeurgronden

- Een veld toont `Gezond` terwijl zijn bron ontbreekt, verouderd of onbereikbaar is.
- Een schatting, benadering of handmatig ingevulde waarde staat in een veld dat als gemeten wordt gepresenteerd.
- De connector schrijft naar het product.
- De connector levert data buiten zijn contract.
- De connector brengt een eigen incidentmodel, auditspoor of rechtenmodel mee.
- Een connectorsleutel werkt in meer dan één omgeving.
- Een gecachte waarde wordt getoond zonder leeftijd.
- Contractversie ontbreekt of Control accepteert een onbekende versie.
