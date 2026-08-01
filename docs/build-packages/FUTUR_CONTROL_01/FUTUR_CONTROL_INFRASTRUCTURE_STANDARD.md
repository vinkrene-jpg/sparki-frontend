# FUTUR_CONTROL_INFRASTRUCTURE_STANDARD

**Regelcodes:** `INF-01..` · **Status:** `OPEN` · **Datum:** 1 augustus 2026
Generiek register en bewakingsmodel voor eigen apparatuur: NAS, mini-server, netwerk.

---

## 1. Waarom eigen infrastructuur in Control hoort

Een back-up op een apparaat dat niemand bewaakt is een aanname, geen zekerheid. Zodra eigen hardware een rol speelt in herstel, hoort haar toestand op dezelfde plek te staan als de rest: op *Vandaag als beheerder*, met dezelfde statuswoorden en dezelfde eerlijkheid over wat niet gemeten wordt.

| Code | Regel |
|---|---|
| INF-01 | Eigen apparatuur wordt bewaakt volgens hetzelfde model als producten en diensten: bron · tijdstip · betrouwbaarheid · status · waarom. |
| INF-02 | Ontbrekende metingen tonen `Onbekend`. Geen enkele hardwarewaarde wordt geschat of handmatig ingevuld als ware zij gemeten. |
| INF-03 | Een apparaat dat geen sensor heeft, toont dat veld permanent als `Onbekend` — het veld verdwijnt niet. |
| INF-04 | De NAS mag **nooit** een tweede productiedatabase of schaduwproductie worden. Zij is archief-, back-up- en herstelopslag. |
| INF-05 | Statusgegevens gaan **uitgaand** naar Control. Control opent geen inkomende beheerpoort naar het lokale netwerk. |
| INF-05a | Control is in de basisversie **volledig lezend** richting alle infrastructuur. Het stuurt geen commando, wijzigt geen configuratie, start niets, stopt niets en herstelt niets — ook niet met beschermende bedoeling. Wat het wel doet is meten, tonen, alarmeren en voorstellen. |
| INF-06 | Infrastructuur verschijnt in Product Health, Dependency Registry, *Vandaag als beheerder*, incidenten, continuïteit, Capability Matrix en de mobiele beheeromgeving. |

## 2. Infrastructuurregister — velden per knooppunt

**Identiteit** — infrastructuur-ID · naam · type (NAS, mini-server, netwerkapparaat) · locatie · eigenaar · hardware · besturingssysteem · IP-adres of hostname · netwerkzone.

**Gebruik** — gebruikte diensten · gekoppelde producten.

**Opslag** — opslagcapaciteit · vrije ruimte · schijfgezondheid · RAID-status.

**Omgeving** — temperatuur · luchtvochtigheid indien meetbaar · UPS-status · stroomstatus · netwerkstatus.

**Bescherming** — laatste back-up · laatste snapshot · **laatste geslaagde hersteltest** · softwareversies · beveiligingsupdates · certificaten · open poorten.

**Toestand** — laatste herstart · status · laatste meting · verantwoordelijke herstelactie.

**INF-07:** *verantwoordelijke herstelactie* benoemt wat er moet gebeuren én wie dat kan. Bij fysieke handelingen staat er expliciet dat geen agent en geen automatisering dit kan uitvoeren.
**INF-08:** *open poorten* is een bewaakt veld: een poort die verschijnt zonder registratie is een beveiligingssignaal.
**INF-09:** *laatste geslaagde hersteltest* is het belangrijkste veld van het hele register. Staat het op `Onbekend`, dan is de back-upstatus ook `Onbekend`.

## 3. Statusbepaling

| Situatie | Status |
|---|---|
| Alle metingen binnen norm en binnen houdbaarheid | `Gezond` |
| Waarde loopt richting een drempel, of redundantie is aangetast maar intact | `Aandacht nodig` |
| Redundantie weg, back-up buiten de vastgelegde grens, of hersteltest mislukt | `Kritiek` |
| Functie degradeert maar gegevens zijn veilig | `Verstoord` |
| Geen sensor, geen meting, verouderde meting, apparaat onbereikbaar | `Onbekend` |

**INF-10:** een onbereikbare NAS levert `Onbekend` voor **alle** velden. Er wordt geen laatste bekende waarde als actueel getoond; wel mag zij worden getoond met haar leeftijd.

## 4. Functieverdeling — waar hoort wat

**INF-11:** per functie wordt vooraf vastgelegd of zij op de NAS, op de mini-server of in de cloud hoort, met reden, beveiligingsrisico, afhankelijkheid en minimale hardware-eis. Onderstaande tabel is het **voorstel**; F0 bevestigt of corrigeert het.

| Functie | NAS | Mini-server | Cloud | Reden en risico |
|---|---|---|---|---|
| Back-upopslag | **Ja** | Nee | Aanvullend, buitenshuis | Opslag hoort bij het opslagapparaat; één kopie buitenshuis is noodzakelijk tegen brand en ransomware. Minimale eis: redundante schijven. |
| Snapshots | **Ja** | Nee | Nee | Hoort bij het bestandssysteem; vergrendelbare snapshots zijn de beste ransomwarebescherming. |
| Documentarchief, logarchief, media | **Ja** | Nee | Nee | Grote, koude data. Risico: te ruime toegang; alleen leesrechten per doel. |
| Back-upverificatie (hersteltest) | Deels | **Ja** | Nee | Herstellen op hetzelfde apparaat bewijst weinig; een aparte machine bewijst het wel. Minimale eis: voldoende schijf en geheugen voor een herstelde database. |
| Monitoringcollector | Nee | **Ja** | Fallback | Moet blijven meten als het internet wegvalt; buffert lokaal. |
| Lokale agentruntime | Nee | **Ja** | Nee | Scheidt lokale agents van opslag; een fout in een agent raakt dan niet direct de back-ups. |
| Buildrunner | Nee | **Ja** | **Ja** | Kan beide; lokaal is goedkoper, cloud is beschikbaarder. Risico lokaal: secrets op eigen hardware. |
| Test- en acceptatieomgeving | Nee | **Ja** | **Ja** | Nooit op de NAS: dat maakt van opslag een draaiende omgeving (INF-04). |
| Logverzameling | Opslag | **Ja** (verwerking) | Nee | Verwerken kost rekenkracht; bewaren kost opslag. |
| Uptimecontrole | Nee | Deels | **Ja** | Een controle vanuit het eigen netwerk merkt een eigen internetstoring niet; extern is leidend. |
| Lokale statuspagina | Nee | **Ja** | Nee | Nuttig juist als het internet weg is. |
| Beveiligde noodtoegang | Nee | **Ja**, beperkt | Nee | Alleen met sterke authenticatie en uitgaande verbinding. |
| Lokale AI-diensten | Nee | **Ja**, later | **Ja** | Alleen zinvol bij voldoende hardware; anders trager en duurder dan cloud. Risico: modelbeheer en updates. |
| Control-kern zelf | **Nee** | **Nee** | **Ja** | Moet bereikbaar blijven als het huis geen stroom of internet heeft. |
| Productiedatabase van een product | **Nooit** | **Nooit** | Ja | INF-04. |

**INF-12:** niet aannemen dat al deze functies gebouwd worden. De mini-server bestaat nog niet; het register staat klaar en blijft leeg tot hij er is.

## 5. Netwerk

**INF-13:** netwerkzone per apparaat vastgelegd; beheerapparatuur staat niet in dezelfde zone als gastapparaten.
**INF-14:** geen poortdoorschakeling naar NAS of mini-server zonder aantoonbare noodzaak, vastgelegde reden en periodieke herbeoordeling.
**INF-15:** certificaten en tijdsynchronisatie zijn bewaakte velden; onbetrouwbare tijd maakt lokale logs als bewijs waardeloos.

## 6. Koppeling met Sparki

Voor Sparki wordt via de NAS bewaard: databaseback-ups · document- en rapportarchief · releasebewijzen · Mirror-bewijssets · logs · exportbestanden · media- en Academy-assets · herstelhandleidingen · een versleutelde noodkopie van essentiële configuratie **zonder secrets in leesbare vorm**.

**INF-16:** deze opslag is **koud**. Geen enkel product leest tijdens normale werking van de NAS; er ontstaat geen runtime-afhankelijkheid.
**INF-17:** Mirror-bewijssets en releasebewijzen worden onveranderlijk bewaard (snapshot of write-once), zodat achteraf niet te betwisten is wat er bewezen is.

## 7. Directe afkeurgronden

- Een hardwarewaarde is geschat of handmatig ingevuld als gemeten waarde.
- Back-upstatus is `Gezond` zonder aantoonbare herstelbaarheid.
- Een ontbrekende sensor leidt tot een verborgen veld in plaats van `Onbekend`.
- De NAS draait een productiedienst of bevat een tweede productiedatabase.
- Er is een inkomende open beheerpoort zonder geregistreerde noodzaak.
- Een onbereikbaar apparaat toont een oude waarde als actueel.
- Infrastructuur ontbreekt in Product Health, *Vandaag als beheerder* of de continuïteitsweergave.
