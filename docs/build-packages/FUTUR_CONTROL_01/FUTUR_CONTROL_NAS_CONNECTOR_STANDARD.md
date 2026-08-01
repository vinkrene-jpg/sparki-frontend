# FUTUR_CONTROL_NAS_CONNECTOR_STANDARD

**Regelcodes:** `NAS-01..` · **Status:** `OPEN` · **Datum:** 1 augustus 2026
Hoe de eigen NAS op Futur Control wordt aangesloten en wat er bewaakt wordt.

---

## 1. Contract

**NAS-01:** de NAS-connector volgt hetzelfde contractmodel als een productconnector: hij levert **velden met metagegevens**, is **lezend**, brengt geen eigen incidentmodel mee en heeft een contractversie.
**NAS-02:** de verbinding is **uitgaand**: een lokale collector stuurt versleuteld statusgegevens naar Control. Control benadert de NAS niet rechtstreeks van buitenaf.
**NAS-03:** de collector draait bij voorkeur op de mini-server. Bestaat die nog niet, dan draait hij op de NAS zelf met minimale rechten en uitsluitend leestoegang.
**NAS-04:** de collector heeft **geen** rechten om te verwijderen, volumes te wijzigen, RAID te herstellen, poorten te openen, firewallregels te wijzigen, updates te installeren, gegevens terug te zetten, te herstarten of secrets te wijzigen (`AGV-27`).

## 2. Bewaakte velden

**Opslag** — schijfstatus per schijf · SMART-waarschuwingen · RAID-status en degradatie · opslaggebruik en vrije ruimte · groeisnelheid van het gebruik.

**Bescherming** — snapshots (aantal, ouderdom, vergrendeling) · back-upresultaten per taak · integriteitscontrole (checksum-scrub) · replicatiestatus · **laatste geslaagde hersteltest**.

**Veiligheid** — mislukte logins · massawijzigings- of ransomwaresignalen · certificaten · softwareversies en beveiligingsupdates · open poorten.

**Omgeving** — netwerkbereikbaarheid · UPS-status · stroomstatus · temperatuur · luchtvochtigheid indien meetbaar.

**NAS-05:** per veld gelden dezelfde zeven metagegevens als bij een productconnector: bron · actualiteit · betrouwbaarheid · lees-/schrijfrecht · fallback · gedrag bij ontbreken · reikwijdte.

## 3. De back-upregel

**NAS-06:** een back-up is pas `Gezond` wanneer **aantoonbaar bekend is dat hij herstelbaar is**. Concreet, alle vier:
1. de back-uptaak is geslaagd binnen de vastgelegde frequentie;
2. de omvang wijkt niet onverklaarbaar af van de vorige;
3. een integriteitscontrole is geslaagd;
4. een **hersteltest** is binnen de vastgelegde periode geslaagd, met datum.

Ontbreekt punt 4, dan is de status hoogstens `Aandacht nodig`. Is een hersteltest **mislukt**, dan is de status `Kritiek` — niet `Aandacht nodig`.

**NAS-07:** de hersteltest herstelt naar een aparte omgeving, nooit naar productie, en eindigt met een controle die aantoont dat de herstelde gegevens bruikbaar zijn (bijvoorbeeld: de database start, een bekende telling klopt). Een geslaagde kopieerhandeling is geen hersteltest.
**NAS-08:** de frequentie van de hersteltest wordt vastgelegd per gegevenssoort. Wat die frequentie moet zijn, is een openstaand punt — zie `FC-B09`.

## 4. Ransomware- en massawijzigingsbescherming

**NAS-09:** bewaakte signalen: ongebruikelijk aantal wijzigingen of verwijderingen per tijdseenheid · plotselinge groei of krimp van een volume · gewijzigde bestandsextensies in grote aantallen · mislukte logins · uitschakelen of verwijderen van snapshots · replicatie die onverwacht veel wijzigingen doorvoert.
**NAS-10:** Futur Control voert bij verdenking **geen handeling** uit. Het regime is: **detecteren · status `Kritiek` · onmiddellijk alarmeren · getroffen infrastructuur en producten tonen · voorgestelde actie "replicatie pauzeren / snapshots beschermen" · menselijke procedure openen · volledig auditspoor.** Agents worden binnen Control gestopt; dat is een interne handeling.
**NAS-10a:** een automatische bescherming die de **NAS zelf** uitvoert — eigen ransomwaredetectie, onveranderlijke of vergrendelde snapshots, replicatiebeleid — mag bestaan en is gewenst, maar wordt in Control uitsluitend als **externe NAS-configuratie geregistreerd en geobserveerd**: bestaat zij · staat zij aan · wanneer sloeg zij voor het laatst aan. **Control geeft daarvoor geen commando** en zet haar niet aan, uit of af.
**NAS-11:** agents worden bij zo'n verdenking gestopt. Herstel gebeurt uitsluitend na menselijke beoordeling.
**NAS-12:** minstens één kopie is **onveranderlijk of buitenshuis**. Een back-up die vanaf hetzelfde besmette systeem te wissen is, beschermt niet tegen het scenario waarvoor hij bestaat.

## 5. Wat Sparki op de NAS bewaart

databaseback-ups · document- en rapportarchief · releasebewijzen · Mirror-bewijssets · logs · exportbestanden · media- en Academy-assets · herstelhandleidingen · versleutelde noodkopie van essentiële configuratie zonder leesbare secrets.

**NAS-13:** deze opslag is koud. Geen product leest hiervan tijdens normale werking (`INF-16`).
**NAS-14:** releasebewijzen en Mirror-bewijssets worden onveranderlijk bewaard, zodat achteraf niet te betwisten is wat er is bewezen.
**NAS-15:** exports met persoonsgegevens worden versleuteld bewaard, met een vastgelegde toegangsbeperking. Bewaartermijnen zijn juridisch nog onbepaald en worden configureerbaar gebouwd, niet aangenomen.

## 6. Zichtbaarheid in Control

- **Vandaag als beheerder** — kaart *Back-ups* toont laatste back-up, laatste geslaagde hersteltest en NAS-status; kaart *Nieuwe waarschuwingen* toont SMART, RAID, UPS en veiligheidssignalen.
- **Product Health** — NAS als eigen kolom naast de producten.
- **Incidenten** — NAS-storingen vormen incidenten met impactketen naar de producten waarvan de back-up eraan hangt.
- **Capability Matrix** — infrastructuur als eigen domein met dezelfde twaalf kolommen.
- **Mobiel** — status lezen en waarschuwing zien; geen enkele herstelhandeling.

## 7. Directe afkeurgronden

- Back-upstatus `Gezond` zonder geslaagde hersteltest.
- Een mislukte hersteltest die als `Aandacht nodig` wordt getoond in plaats van `Kritiek`.
- Een geslaagde kopieerhandeling gepresenteerd als hersteltest.
- Ontbrekende sensor leidt tot een verborgen veld in plaats van `Onbekend`.
- De collector heeft schrijf-, herstel- of beheerrechten.
- Een inkomende verbinding vanaf Control naar de NAS.
- Alle kopieën staan op hetzelfde systeem en zijn vanaf dat systeem te wissen.
- Ransomwaresignalen worden gedetecteerd zonder kritieke melding, zonder het tonen van getroffen infrastructuur en producten, of zonder geopende menselijke procedure.
- Futur Control stuurt een commando naar de NAS — ook een beschermend commando.
- Onbereikbare NAS toont een oude waarde als actueel.
