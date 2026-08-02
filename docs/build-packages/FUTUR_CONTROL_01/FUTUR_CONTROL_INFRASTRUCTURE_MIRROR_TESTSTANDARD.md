# FUTUR_CONTROL_INFRASTRUCTURE_MIRROR_TESTSTANDARD

> **Vast contextblok (02-08-2026 — geldt voor elke Mirror-toets)**
> Lees vóór het toetsen eerst `docs/besluiten/BESLUITEN_VOOR_REPLIT_2026-08-02.md` en
> `docs/besluiten/BOUWSTRAAT_2026-08-02.md`. Daarin staat wat als productbesluit vastligt
> en waar het te toetsen onderdeel in de bouwvolgorde zit.
>
> **Deze stukken zijn context, geen bewijs.** Ze vertellen wat de bedoeling en de prioriteit
> is — ze zeggen niets over wat er werkelijk gebouwd is. Wat Mirror toetst, stelt Mirror
> zelf vast op een vaste SHA. Wijkt de werkelijkheid af van een besluit, dan is dat een
> **bevinding**, geen aanleiding om het besluit aan te passen.
>
> Komt Mirror iets tegen dat buiten de opdracht valt maar wél een besluit raakt, dan meldt
> Mirror dat apart onder **"Signalen buiten scope"** — Mirror lost het niet zelf op.


**Regelcodes:** `IMT-01..` · **Status:** `OPEN` · **Datum:** 1 augustus 2026
Onafhankelijke toetsing van infrastructuurbewaking (NAS, mini-server, hybride verkeer). Aanvullend op `FUTUR_CONTROL_MIRROR_TESTSTANDARD.md`.

---

## 1. Toetsprincipes

**IMT-01:** infrastructuur wordt getoetst door **toestanden na te bootsen**, niet door registers te lezen. Een gevuld veld bewijst niets over gedrag bij uitval.
**IMT-02:** toetsen die de werkelijke back-ups of productiegegevens in gevaar brengen worden **niet** uitgevoerd; zij worden gerapporteerd als *niet toetsbaar zonder testopstelling*, met de reden.
**IMT-03:** waar mogelijk toetst Mirror op een aparte testopstelling of met een gesimuleerde collector die dezelfde velden levert.
**IMT-04:** een sensor die niet bestaat, mag geen enkele status beïnvloeden behalve `Onbekend`.

## 2. Toetsdimensies

| Code | Dimensie | Wat Mirror doet |
|---|---|---|
| IMT-05 | Eerlijkheid over metingen | Zoekt naar geschatte, afgeleide of handmatig ingevulde hardwarewaarden |
| IMT-06 | Ontbrekende sensor | Verwijdert een sensorveld en controleert dat het `Onbekend` toont en niet verdwijnt |
| IMT-07 | Onbereikbaar apparaat | Zet de collector uit en controleert dat alle velden `Onbekend` worden met leeftijd, en dat geen oude waarde als actueel verschijnt |
| IMT-08 | Back-upregel | Controleert dat `Gezond` alleen ontstaat bij een geslaagde hersteltest binnen de vastgelegde periode |
| IMT-09 | Mislukte hersteltest | Laat een hersteltest falen en controleert dat de status `Kritiek` wordt, niet `Aandacht nodig` |
| IMT-10 | Kopie is geen herstel | Controleert dat een geslaagde kopieerhandeling niet als hersteltest wordt geteld |
| IMT-11 | RAID en redundantie | Simuleert een defecte schijf en controleert oplopende ernst zodra redundantie wegvalt |
| IMT-12 | Ransomwaresignaal | Bootst een massawijziging na en controleert: detectie · status `Kritiek` · onmiddellijk alarm · getroffen infrastructuur en producten getoond · voorgestelde actie zichtbaar · menselijke procedure geopend · agents binnen Control gestopt · volledig auditspoor. Controleert tevens dat Control **geen** commando naar de NAS stuurt |
| IMT-13 | Native bescherming | Controleert dat een door de NAS zelf uitgevoerde bescherming uitsluitend wordt geregistreerd en geobserveerd, en dat Control haar niet kan aanzetten, uitzetten of afbreken |
| IMT-14 | Collectorrechten | Laat de collector elk van de negen verboden handelingen proberen en controleert weigering plus auditregel |
| IMT-15 | Verkeersrichting | Zoekt naar een inkomende beheerpoort of een permanente tunnel vanaf Control naar het lokale netwerk |
| IMT-16 | Statusinhoud | Inspecteert het verkeer op persoonsgegevens, bestandsinhoud of productiegegevens |
| IMT-17 | Buffering | Verbreekt het internet, laat metingen doorlopen en controleert dat zij later met hun **oorspronkelijke** tijdstip aankomen en zichtbaar als achteraf aangeleverd |
| IMT-18 | Bufferverlies | Laat de buffer vollopen en controleert dat verlies zichtbaar wordt gemeld met omvang en periode |
| IMT-19 | Fail-safe noodstop | Maakt Control onbereikbaar en controleert dat de lokale agentruntime na de stiltetijd vanzelf stilvalt |
| IMT-20 | Tijdbetrouwbaarheid | Verschuift de lokale tijd en controleert dat drift als beveiligingssignaal verschijnt |
| IMT-21 | Secrets | Doorzoekt images, scripts, configuratie, nooddocumentatie en de noodexport |
| IMT-22 | Geen productiedienst op de NAS | Controleert dat de NAS geen draaiende productiedienst of tweede productiedatabase bevat |
| IMT-23 | Koude opslag | Controleert dat geen product tijdens normale werking van de NAS leest |
| IMT-24 | Onveranderlijk bewijs | Probeert een releasebewijs of Mirror-bewijsset te wijzigen of te verwijderen |
| IMT-25 | Zichtbaarheid | Controleert dat infrastructuur voorkomt in Product Health, *Vandaag als beheerder*, incidenten, continuïteit, Capability Matrix en mobiel |
| IMT-26 | Mobiele grens | Controleert dat mobiel infrastructuur alleen toont en geen herstelhandeling aanbiedt |
| IMT-27 | Scenariodekking | Controleert dat elk scenario uit `FUTUR_CONTROL_CONTINUITY_STANDARD.md` §4 detectie, ernst, degradatie, herstelstappen, benodigde persoon en bewijsvereiste heeft |
| IMT-28 | Menselijke handeling benoemd | Controleert dat bij fysieke herstelacties expliciet staat dat geen agent of automatisering dit kan uitvoeren |

## 3. Directe afkeurgronden

1. Back-upstatus `Gezond` zonder geslaagde hersteltest.
2. Mislukte hersteltest die niet `Kritiek` is.
3. Een kopieerhandeling geteld als hersteltest.
4. Geschatte of handmatig ingevulde hardwarewaarde gepresenteerd als meting.
5. Onbereikbaar apparaat toont een oude waarde als actueel.
6. Ontbrekende sensor leidt tot een verborgen veld of tot `Gezond`.
7. De collector kan verwijderen, herstellen, herstarten, poorten openen, firewallregels wijzigen, updates installeren, volumes wijzigen, gegevens terugzetten of secrets wijzigen.
8. Inkomende beheerpoort of permanente tunnel zonder geregistreerde noodzaak.
9. Statusverkeer bevat persoonsgegevens, bestandsinhoud of productiegegevens.
10. Gebufferde metingen krijgen het aanlevertijdstip, of verlies wordt niet gemeld.
11. De lokale agentruntime blijft draaien terwijl Control onbereikbaar is en de stiltetijd is verstreken.
12. Ransomwaresignaal gedetecteerd zonder kritieke melding, zonder getoonde getroffen infrastructuur en producten, zonder voorgestelde actie of zonder geopende menselijke procedure.
13. Futur Control stuurt enig commando naar de NAS of een ander apparaat, ook met beschermende bedoeling — of kan een native bescherming aan- of uitzetten.
14. Secrets in image, script, configuratie, nooddocumentatie of noodexport.
15. De NAS draait een productiedienst of bevat een tweede productiedatabase.
16. Een releasebewijs of Mirror-bewijsset kan worden gewijzigd of verwijderd.
17. Mobiel biedt een infrastructuurherstelhandeling aan.

## 4. Afkeurgronden na weging

een apparaat zonder verantwoordelijke herstelactie · een scenario zonder benoemde benodigde persoon · ontbrekende registratie van open poorten · een back-uptaak zonder vastgelegde frequentie · een hersteltest zonder vastgelegde periodiciteit (zie `FC-B09`) · een infrastructuurincident zonder impactketen naar de betrokken producten · een sensormeting zonder houdbaarheid.

## 5. De poort

**IMT-29:** dezelfde drie uitkomsten als bij de algemene teststandaard: `MIRROR_PROVEN` · `PARTIAL` met genummerde restpunten · `AFGEKEURD`. Infrastructuur die niet is getoetst geldt als `Onbekend`, niet als in orde.
