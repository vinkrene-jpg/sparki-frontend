# FUTUR_CONTROL_ARCHITECTURE

**Regelcodes:** `FCA-01..` · **Status:** `OPEN` · **Datum:** 1 augustus 2026
Leest samen met `FUTUR_CONTROL_SECURITY_MODEL.md` en `FUTUR_CONTROL_HYBRID_ARCHITECTURE.md`.

---

## 1. Fysieke en technische plaatsing

| Code | Uitgangspunt |
|---|---|
| FCA-01 | Futur Control krijgt een **aparte deployment** met een eigen beveiligde beheer-URL, los van elk aangesloten product. |
| FCA-02 | Control blijft bereikbaar wanneer een aangesloten product uitvalt. Een productstoring degradeert hooguit de gegevens **over** dat product. |
| FCA-03 | Control gebruikt **geen kopie van een productiedatabase**. Het leest via connectors, admin-API's en waar nodig een expliciet ingerichte read-only bron. |
| FCA-04 | Control heeft een **eigen database** voor uitsluitend beheerobjecten: registers, incidenten, kennisitems, agenttaken, goedkeuringen, audit, metingen. |
| FCA-05 | Test-, acceptatie- en productieomgeving van Control zijn **strikt gescheiden**, met eigen secrets en eigen connectordoelen. Een testomgeving van Control wijst nooit naar een productieproduct met schrijfrecht. |
| FCA-06 | Storing in een product schakelt Control **niet automatisch** uit; storing in Control blokkeert een product **niet**. Producten kennen geen harde runtime-afhankelijkheid van Control. |
| FCA-07 | Alle productverkeer loopt **uitgaand vanaf Control** of via uitgaande verbindingen vanaf een lokale collector. Geen inkomende open beheerpoort zonder aantoonbare noodzaak. |

**Gevolg voor eerdere keuze:** hiermee is de openstaande keuze *waar draait Control* (`CTL-B2` uit v1.1) beantwoord met optie **B — aparte deployment**. Zie de vertaaltabel.

## 2. Lagen

```
   Beheerder (René) — desktop en telefoon
        │
   ┌────┴─────────────────────────────────────────────┐
   │  PRESENTATIELAAG                                 │
   │  Vandaag als beheerder · Product Health ·        │
   │  Capability Matrix · incidenten · support ·      │
   │  releases · continuïteit · audit                 │
   ├──────────────────────────────────────────────────┤
   │  CONTROL-KERN (productonafhankelijk)             │
   │  identiteit · rechten · goedkeuringsketen ·      │
   │  incidentmodel · kennisitems · agentbesturing ·  │
   │  noodstop · noodmodus · rapportage · notificatie │
   ├──────────────────────────────────────────────────┤
   │  REGISTERLAAG                                    │
   │  productregister · dependencyregister ·          │
   │  infrastructuurregister · connectorregister      │
   ├──────────────────────────────────────────────────┤
   │  AUDITLAAG (append-only, onder alles)            │
   ├──────────────────────────────────────────────────┤
   │  CONNECTORLAAG — één contract per bron           │
   │  productconnector · dienstconnector ·            │
   │  infrastructuurconnector                         │
   └───┬──────────────┬───────────────┬───────────────┘
       │              │               │
    Sparki       externe diensten   NAS / mini-server
   (FPS Connect, Forge: later)      (lokaal netwerk)
```

**FCA-08:** de presentatielaag praat nooit rechtstreeks met een product. Alles loopt via de kern en de connectorlaag, zodat elk getal in beeld een geregistreerde bron heeft.

## 3. De productonafhankelijke kern

Deze onderdelen worden **één keer** gebouwd en nooit per product gekopieerd:

sterke beheerdersauthenticatie · auditlog · incidentmodel · probleem- en kennisitems · agentbesturing · goedkeuringsketen · supportinbox · releasebeheer · continuïteitsbeheer · noodstop · noodmodus · Product Health · Capability Matrix · Vandaag als beheerder · rapportage · notificaties · rechten en scopes · mobiele beheeromgeving.

**FCA-09:** een product mag deze onderdelen **configureren** (welke velden het levert, welke statussen het kent), maar niet **dupliceren**. Een connector die een eigen incidentmodel of een eigen auditspoor meebrengt wordt afgekeurd.

## 4. Registers

### 4.1 Productregister

Per product minimaal: product-ID · naam · eigenaar · omgeving(en) · productie-URL · repository · actuele productie-SHA · deploymentplatform · database · authenticatievoorziening · gekoppelde externe diensten · verantwoordelijke connectors · status · laatste meting · incidenten · releases · support · back-ups · continuïteitsplan · Capability Matrix · Product Health · contactpersonen · noodhandleiding.

**FCA-10:** elk veld heeft een herkomst: `uit connector` · `handmatig vastgelegd door René` · `Onbekend`. Handmatig vastgelegde velden tonen datum en auteur; een handmatig veld verdringt nooit een connectorwaarde.

**Sparki** wordt volledig voorbereid — zie `SPARKI_CONTROL_CONNECTOR_01_BOUWPAKKET.md`. **FPS Connect en Forge** krijgen alleen de lege aansluitstructuur.

### 4.2 Dependencyregister

Externe diensten en hun risico's. Zie `FUTUR_CONTROL_DEPENDENCY_REGISTRY_STANDARD.md`.

### 4.3 Infrastructuurregister

Eigen apparatuur: NAS, mini-server, netwerk. Zie `FUTUR_CONTROL_INFRASTRUCTURE_STANDARD.md`.

### 4.4 Connectorregister

Per connector: welke velden hij levert, contractversie, laatste succesvolle uitvoering, betrouwbaarheid, lees- of schrijfrecht, conformiteitsniveau. Een connector die een veld belooft maar niet levert, verschijnt hier als afwijking — niet als `Gezond`.

## 5. Datamodel — kernobjecten

| Object | Kern van het record | Relaties |
|---|---|---|
| Product | ID, naam, eigenaar, omgevingen | connectors, diensten, infrastructuur, incidenten |
| Connector | ID, type, contractversie, doelproduct, rechten | metingen, velden |
| Meting | veld, waarde óf `Onbekend`, bron, tijdstip, betrouwbaarheid | connector, product |
| Dienst | dienst-ID, leverancier, gekoppelde producten | impactketen |
| Infrastructuurknoop | ID, type, locatie | metingen, back-ups |
| Incident | ernst, toestand, oorzaak, herstel- en rollbackplan | product, dienst, functie, gebruikersgroep, agenttaak |
| Kennisitem | oorzaak, oplossing, preventie, versie | incident, bouwpakket, Mirror-toets |
| Agenttaak | opdracht, bevindingen, voorstel, conceptdiff, bronnen | incident, goedkeuring |
| Goedkeuring | onderwerp, besluit, reden, tijdstip, identiteit | audit |
| Auditregel | actor, handeling, onderwerp, reden, resultaat | alles |
| Releasekandidaat | product, SHA, ketenstatus, blokkades, rollbackpad | audit |

**FCA-11:** elk object dat op een scherm verschijnt is via minstens één relatie terug te voeren op een product óf op de Control-omgeving zelf. Zwevende records bestaan niet.

## 6. Meetmodel

**FCA-12:** iedere meetwaarde draagt vijf velden mee: **bron · tijdstip van de meting · betrouwbaarheid · status · waarom**. Ontbreekt één daarvan, dan is de status `Onbekend`.

**FCA-13:** actualiteit is per veld gedefinieerd (bijvoorbeeld: back-upstatus verouderd na 26 uur). Een meting ouder dan haar houdbaarheid wordt `Onbekend`, niet stilzwijgend hergebruikt.

**FCA-14:** metingen worden bewaard als tijdreeks zodat trend (`beter · gelijk · slechter · onbekend`) berekenbaar is zonder schatting. De bewaartermijn van meetgegevens is configureerbaar en wordt niet in dit document vastgesteld.

## 7. Impactketen

```
externe dienst / infrastructuur
   → productconnector
      → productfunctie
         → gebruikersgroep
            → incident
               → herstelactie
```

**FCA-15:** de keten is **gegevens**, geen tekst. Elke schakel is een record met een relatie, zodat Control kan tonen: welke functies geraakt zijn · hoeveel gebruikers mogelijk geraakt zijn · of er een fallback bestaat · of de functie veilig gedegradeerd kan werken · wie geïnformeerd moet worden · welke herstelhandeling mogelijk is.

**FCA-16:** "hoeveel gebruikers mogelijk geraakt" is een **bovengrens uit registratie**, geen schatting. Is die niet af te leiden, dan staat er `Onbekend` — geen percentage, geen aanname.

## 8. Degraded en fail-closed

**FCA-17:** een onleesbare bron voegt **geen rechten en geen zekerheid** toe. Leesbare bronnen blijven geldig. De uitkomst draagt `degraded:true`, wordt zichtbaar gelogd, en beheer én support zien **welke** bron ontbrak. Na herstel volgt automatisch een nieuwe controle. Uitwerking per domein in `FUTUR_CONTROL_HEALTHCHECK_STANDARD.md` §6.

## 9. Rapportage en notificaties

**FCA-18:** alle uitdraaien uit Control volgen `REPORT_DESIGN_STANDARD_01` — één generator, één templatebibliotheek, geen tweede PDF-engine.
**FCA-19:** een notificatie bevat nooit gevoelige inhoud; zij verwijst naar het scherm waar de handeling plaatsvindt, en opent bij aantikken exact die handeling.

## 9a. Muterende functies

**FCA-20:** de architectuur kent in de basisversie **geen muterend pad** richting producten, infrastructuur of externe diensten. Niet uitgeschakeld, niet achter een vlag, niet ongebruikt aanwezig — **afwezig**. Externe muterende functies worden pas gebouwd in een afzonderlijke toekomstige bouwreeks, na `MIRROR_PROVEN` op de volledige keten en expliciete vrijgave door René. Zie `FUTUR_CONTROL_MUTATION_GATE.md`.

**FCA-21:** Control schrijft uitsluitend in zijn **eigen** database: incidentstatus, notities, kennisitemversies, supportconcepten, goedkeuringen, blokkades, metingen, auditregels. Elke uitgaande verbinding naar een product, dienst of apparaat is in de basisversie **lezend**. De scheidslijn is waarneembaar effect buiten Control.

**FCA-22:** Forge is een **beheerd product** met een leeg productrecord op N0. Forge kan later via een apart connector- of uitvoeringspakket een dienst aan Control leveren, maar is **nooit een tweede beheerlaag**, en de Control-kern kent **geen afhankelijkheid** van Forge (`FC-B08 = C`).

## 10. Wat expliciet niet in de architectuur zit

- Geen kopie of replica van productiedata in Control.
- Geen schrijfpad naar productdata anders dan via een expliciet toegekend, geaudit schrijfrecht per connector (nu: geen enkel schrijfrecht).
- Geen agentruntime met productierechten.
- Geen automatische deploy, migratie of rollback.
- Geen tweede rechtenarchitectuur binnen een connector.
