# FUTUR_CONTROL_CONTINUITY_STANDARD

**Regelcodes:** `FCC-01..` · **Status:** `OPEN` · **Datum:** 1 augustus 2026
Continuïteit van de aangesloten producten **en** van Futur Control zelf.

---

## 1. Uitgangspunt

Een beheersysteem dat zelf niet beheersbaar is, verplaatst het probleem alleen. Futur Control wordt daarom met dezelfde strengheid bewaakt als de producten die het bewaakt.

| Code | Regel |
|---|---|
| FCC-01 | Control heeft een eigen back-up, een eigen herstelprocedure en een eigen uitvalscenario. |
| FCC-02 | Een back-up is pas `Gezond` wanneer **aantoonbaar bekend is dat hij herstelbaar is**. Bestaan is niet genoeg. |
| FCC-03 | Uitval van Control blokkeert geen enkel product. Producten kennen geen runtime-afhankelijkheid van Control. |
| FCC-04 | Uitval van een product schakelt Control niet uit; de gegevens over dat product worden `Onbekend`. |
| FCC-05 | Nooddocumentatie bevat nooit secrets, alleen vindplaats en bevoegdheid. |
| FCC-06 | Alles wat in een noodsituatie gebeurt, wordt gelogd — juist dan. |

## 2. Continuïteit van Control zelf

**Back-up en herstel** — dagelijkse back-up van de Control-database en configuratie naar de NAS; periodieke hersteltest in een aparte omgeving; datum van de laatste **geslaagde** hersteltest is een zichtbaar veld. Nooit teruggezet naar productie zonder expliciete goedkeuring.

**Break-glass** — één noodtoegangspad conform `FUTUR_CONTROL_SECURITY_MODEL.md` §6: fysiek gescheiden bewaard, eenmalig, meldt en logt onmiddellijk, geeft géén vrijgave- of deployrecht, verplichte sleutelrotatie na gebruik.

**Read-only noodweergave** — een minimale, apart gehoste weergave die blijft werken als de volledige Control-omgeving uitvalt. Toont: laatste bekende productstatussen met tijdstempel, contactpersonen, noodhandleiding, en de vindplaats (niet de inhoud) van herstelmiddelen. Geen handelingen, geen persoonsgegevens.

**Overdraagbaarheid** — geen persoonsafhankelijke configuratie; alle handelingen die alleen René kan doen zijn benoemd als **rol**, niet als persoon, zodat overdracht een sleutelwissel is en geen herbouw.

**Export van noodinformatie** — periodiek gegenereerd document met producten, omgevingen, contactpersonen, leveranciers, herstelvolgorde en vindplaats van sleutels. Conform `REPORT_DESIGN_STANDARD_01`, zonder secrets, zonder persoonsgegevens van gebruikers, versleuteld bewaard op de NAS én buiten huis.

## 3. Noodmodus per product

Handelingen: betalingen pauzeren · nieuwe abonnementen blokkeren · onderhoudsbericht tonen · support automatisch beantwoorden · veilige read-onlymodus · verantwoordelijke contactpersoon activeren.

**FCC-07:** activering vraagt sterke bevestiging, een verplichte reden en een volledig auditspoor; zolang de modus actief is staat er een permanente, niet weg te klikken markering in het product.
**FCC-08:** noodmodus is **per product**. Er bestaat ook een noodmodus voor Control zelf; die zet Control in read-only en stopt alle agents, maar raakt de producten niet.
**FCC-09:** er is **geen** automatische activering op grond van inactiviteit zolang `FC-B07` openstaat.
**FCC-09a — splitsing, vastgelegd:** het **activeren** van een noodmodus is een externe muterende handeling. De bouw is daarom gesplitst:
- **`F11A` — continuïteitsobservatie en noodvoorbereiding** (basisversie): status · scenario's · noodhandleidingen · contactpersonen · eigen Control-read-onlymodus · agents binnen Control stoppen · **voorstellen** voor productmaatregelen.
- **`F11B` — externe noodhandelingen**: betalingen pauzeren · abonnementen blokkeren · onderhoudsbericht activeren · product read-only zetten. **`F11B` is `DEFERRED`** en valt buiten de basisversie tot de volledige mutatiepoort `MIRROR_PROVEN` is.

Tot die tijd bereidt Control de noodmodus voor, toont wat er moet gebeuren en registreert het besluit — maar voert een mens de handelingen uit, in het product zelf.

## 4. Scenario's

Elk scenario legt vast: **detectie · ernst · getroffen producten · veilige degradatie · melding · herstelstappen · benodigde persoon · audit · bewijs dat herstel gelukt is.**

### 4.1 Product uitgevallen
Detectie: functionele controles falen, gebruikersimpact bekend. Degradatie: Control blijft draaien, productvelden op `Onbekend` en `Verstoord` waar gemeten. Herstel: incident, agentanalyse, voorstel, goedkeuring, uitvoering via de normale keten.

### 4.2 Externe kritieke dienst uitgevallen
Detectie: functionele controle faalt terwijl het product zelf antwoordt. Degradatie: getroffen functie zichtbaar gedegradeerd of geblokkeerd, nooit stil vervangen. Melding: impactketen toont functies en gebruikersgroepen. Herstel: fallback indien aanwezig, anders wachten met zichtbare toestand.

### 4.3 Control uitgevallen
Detectie: extern uptimesignaal en het uitblijven van verwachte metingen. Degradatie: read-only noodweergave. Producten draaien ongestoord door. Herstel: opnieuw uitrollen vanaf repository + herstel van de Control-database uit back-up.

### 4.4 NAS uitgevallen
Getroffen: back-ups, archief, logopslag. Degradatie: back-upstatus `Onbekend`, niet `Gezond`. Melding: kritiek zodra de laatste geslaagde back-up buiten de vastgelegde grens valt. Zie `FUTUR_CONTROL_NAS_CONNECTOR_STANDARD.md`.

### 4.5 Eén schijf defect / RAID gedegradeerd
Detectie: SMART, RAID-status. Ernst: `Aandacht nodig` bij één defecte schijf met redundantie; `Kritiek` zodra redundantie weg is. Herstelstap: schijf vervangen — **mensenwerk**, geen agenthandeling. Bewijs: RAID hersteld én een geslaagde hersteltest daarna.

### 4.6 UPS op batterij
Detectie: UPS-status. Degradatie: geplande veilige afsluiting bij een vastgelegde resterende looptijd. Melding: direct, ook 's nachts. Bewijs: nette afsluiting en geslaagde herstart.

### 4.7 Te hoge temperatuur of luchtvochtigheid
Detectie: sensormeting indien aanwezig; anders `Onbekend` — nooit aangenomen dat het goed zit. Ernst: oplopend per drempel. Herstelstap: fysiek ingrijpen.

### 4.8 Internetverbinding uitgevallen
Degradatie: lokale back-ups en controles gaan door; statusgegevens worden lokaal gebufferd en later versleuteld aangeleverd. Control toont `Onbekend` met leeftijd, niet de laatst bekende waarde als actueel. Zie `FUTUR_CONTROL_HYBRID_ARCHITECTURE.md`.

### 4.9 Mini-server uitgevallen
Getroffen: monitoringcollector, lokale agentruntime, buildrunner, back-upverificatie. Degradatie: de functies die alleen daar draaien leveren `Onbekend`; cloudbeheer blijft werken.

### 4.10 Cloud én lokaal tegelijk onbereikbaar
Ernst: hoogste. Degradatie: alleen de buitenshuis bewaarde noodexport resteert. Herstelvolgorde staat vast: netwerk → NAS → Control → producten. Deze volgorde is vooraf vastgelegd omdat hij niet ter plekke bedacht moet worden.

### 4.11 Back-up aanwezig maar hersteltest mislukt
**FCC-10:** dit is `Kritiek`, geen `Aandacht nodig`. Een niet-herstelbare back-up is geen back-up. Status wordt niet `Gezond` tot een hersteltest slaagt.

### 4.12 Ransomware- of massawijzigingsverdenking
Detectie: ongebruikelijk aantal wijzigingen of verwijderingen, mislukte logins, wijzigingen in snapshotgedrag. Ernst: `Kritiek`. Control **detecteert, alarmeert onmiddellijk, toont de getroffen infrastructuur en producten, stelt voor om replicatie te pauzeren en snapshots te beschermen, opent de menselijke procedure en legt alles vast in het auditspoor**. Agents worden binnen Control gestopt. Het feitelijke pauzeren en vergrendelen doet een mens; Control stuurt geen commando. Herstel uitsluitend na menselijke beoordeling.
**FCC-11:** Futur Control voert hier **geen handeling** uit. Bij verdenking geldt: **detecteren · status `Kritiek` · onmiddellijk alarmeren · getroffen infrastructuur en producten tonen · voorgestelde actie "replicatie pauzeren / snapshots beschermen" · menselijke procedure openen · volledig auditspoor.** Het pauzeren en vergrendelen gebeurt door een mens, buiten Control. Agents worden binnen Control gestopt — dat is een interne handeling en wel toegestaan.
**FCC-11a:** een automatische bescherming die de **NAS zelf** uitvoert (eigen ransomwaredetectie, onveranderlijke snapshots) mag bestaan en wordt uitsluitend als **externe NAS-configuratie geregistreerd en geobserveerd**. Control geeft daarvoor geen commando en zet die bescherming niet aan of uit.

### 4.13 René langdurig afwezig
Detectie: geen aanmelding binnen een vastgelegde periode. Gedrag: **nog niet vastgelegd** — dit is `FC-B07`. Tot dat besluit gebeurt er niets automatisch; Control toont wel zichtbaar hoe lang er geen menselijke beoordeling is geweest en welke goedkeuringen wachten.

## 5. Herstelvolgorde

**FCC-12:** vaste volgorde bij gelijktijdige uitval: **netwerk → NAS → Control → productieproducten → lokale hulpdiensten**. Reden: zonder netwerk is niets bereikbaar; zonder NAS is er geen herstelbron; zonder Control is er geen zicht op wat er daarna gebeurt.
**FCC-13:** elke herstelstap eindigt met bewijs: wat is hersteld, op welk moment, door wie, en welke controle bevestigt het.

## 6. Wat Control bewaakt maar niet kan herstellen

**FCC-14:** expliciet benoemd, zodat niemand op automatisch herstel rekent: fysieke hardware · stroom · internetverbinding van de leverancier · storingen bij externe diensten · juridische en contractuele zaken · alles wat een menselijke handeling ter plaatse vereist. Voor elk daarvan staat in de noodhandleiding wie wat moet doen.

## 7. Directe afkeurgronden

- Een back-up geldt als `Gezond` zonder aantoonbare herstelbaarheid.
- Nooddocumentatie bevat een secret.
- De read-only noodweergave staat in dezelfde omgeving als Control zelf.
- Break-glass geeft vrijgave- of deployrecht.
- Noodmodus is te activeren zonder sterke bevestiging, of de markering is weg te klikken.
- Een noodhandeling wordt niet gelogd.
- Automatische activering op grond van afwezigheid terwijl `FC-B07` openstaat.
- Een scenario zonder benoemde herstelstappen of zonder bewijsvereiste.
