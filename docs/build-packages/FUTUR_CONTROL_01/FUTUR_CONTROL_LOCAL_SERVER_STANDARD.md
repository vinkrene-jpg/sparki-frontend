# FUTUR_CONTROL_LOCAL_SERVER_STANDARD

**Regelcodes:** `LSV-01..` · **Status:** `OPEN` — de mini-server bestaat nog niet · **Datum:** 1 augustus 2026

---

## 1. Positie

**LSV-01:** de mini-server is een **afzonderlijk beheerd knooppunt**, geen verlengstuk van de NAS. Opslag en rekenkracht worden gescheiden zodat een fout in een draaiende dienst niet direct de back-ups raakt.
**LSV-02:** de mini-server is **niet** kritiek voor de werking van enig product. Valt hij weg, dan leveren de functies die alleen daar draaien `Onbekend`; de producten en Control werken door.
**LSV-03:** het register en de aansluitstructuur worden nu ontworpen; er wordt **niet aangenomen** dat de functies direct worden gebouwd. Het record blijft leeg tot het apparaat bestaat.

## 2. Mogelijke functies, met oordeel

Per functie: geschikt voor NAS · mini-server · cloud · reden · beveiligingsrisico · afhankelijkheid · minimale hardware-eis. De volledige tabel staat in `FUTUR_CONTROL_INFRASTRUCTURE_STANDARD.md` §4. Samengevat voor de mini-server:

| Functie | Oordeel | Beveiligingsrisico | Afhankelijkheid | Minimale hardware-eis |
|---|---|---|---|---|
| Monitoringcollector | Geschikt, eerste prioriteit | Laag; alleen leesrechten, uitgaand verkeer | Netwerk, NAS voor buffering | Bescheiden: laag verbruik, continu aan |
| Back-upverificatie / hersteltest | Geschikt, hoge waarde | Middel; raakt herstelde gegevens, dus afgeschermde zone | NAS, voldoende schijf | Schijf ≥ omvang grootste dataset, geheugen voor een draaiende database |
| Logverzameling en -verwerking | Geschikt | Middel; logs kunnen persoonsgegevens bevatten | NAS voor opslag | Rekenkracht afhankelijk van volume |
| Lokale agentruntime | Geschikt, ná de collector | Hoog; agents lezen veel — daarom strikt lezend en met noodstop | Control, netwerk | Afhankelijk van agenttype |
| Lokale buildrunner | Geschikt, optioneel | Hoog; vereist secrets op eigen hardware | GitHub/Replit | Duidelijk zwaarder: CPU en schijf |
| Test- en acceptatieomgeving | Geschikt | Middel; mag nooit naar productie wijzen | NAS, netwerk | Afhankelijk van het product |
| Lokale statuspagina | Geschikt | Laag | Collector | Verwaarloosbaar |
| Uptimecontrole | Beperkt geschikt | Laag | — | Verwaarloosbaar — maar extern blijft leidend |
| Beveiligde noodtoegang | Beperkt geschikt | Hoog; alleen met sterke authenticatie en uitgaande verbinding | Netwerk | Verwaarloosbaar |
| Lokale AI-diensten | Later te beoordelen | Middel tot hoog; modelbeheer en updates | Zware hardware | Aanzienlijk: geheugen en versnelling |
| Control-kern | **Ongeschikt** | — | — | Moet bereikbaar blijven bij stroom- of internetuitval |
| Productiedatabase | **Ongeschikt** | — | — | Verboden (`INF-04`) |

**LSV-04:** een uptimecontrole vanuit het eigen netwerk merkt een eigen internetstoring niet op. Externe uptimecontrole blijft leidend; de lokale is aanvullend bewijs, geen vervanging.

## 3. Bouwvolgorde als de mini-server er komt

1. Registratie in het infrastructuurregister, alle metingen `Onbekend`.
2. Monitoringcollector met uitsluitend leesrechten en uitgaand verkeer.
3. Back-upverificatie in een afgeschermde zone.
4. Logverwerking.
5. Lokale statuspagina.
6. Lokale agentruntime — pas nadat de agentgovernance in Control bewezen is (`F8 MIRROR_PROVEN`).
7. Overige functies, elk met eigen besluit.

**LSV-05:** stap 6 komt nooit vóór stap 2. Een agent zonder werkende meting is een agent zonder waarneming.

## 4. Beveiliging

**LSV-06:** eigen netwerkzone, gescheiden van gastapparatuur en van de NAS-beheerinterface.
**LSV-07:** geen inkomende poort vanaf internet zonder geregistreerde noodzaak en periodieke herbeoordeling.
**LSV-08:** secrets uitsluitend in een lokale secretvoorziening, nooit in scripts, images of documentatie. Een lokale buildrunner met secrets vraagt een eigen risicobesluit.
**LSV-09:** softwareversies, beveiligingsupdates en open poorten zijn bewaakte velden. Een nieuwe open poort is een beveiligingssignaal.
**LSV-10:** tijd wordt gesynchroniseerd; lokale logs zonder betrouwbare tijd zijn als bewijs waardeloos.

## 5. Lokale agents

**LSV-11:** een lokale agent mag uitsluitend: systeemstatus lezen · logs verzamelen · back-ups controleren · tests draaien · herstelvoorstellen maken · bestanden vergelijken · rapporteren.
**LSV-12:** een lokale agent mag **niet** zelfstandig: bestanden verwijderen · NAS-volumes wijzigen · RAID herstellen · poorten openen · firewallregels wijzigen · updates installeren · productiegegevens terugzetten · servers herstarten · secrets wijzigen.
**LSV-13:** de lokale agent valt onder de productoverstijgende noodstop en meldt zijn activiteit aan Control zoals elke andere agent, inclusief bronvermelding en auditspoor.
**LSV-13a:** in de basisversie is de lokale agent **volledig lezend** op het apparaat waarop hij draait. Herstelvoorstellen zijn documenten, geen scripts die klaarstaan om te draaien. Een uitvoerbaar herstelpad ontstaat pas na de mutatiepoort en een eigen vrijgave.

## 6. Uitval

**LSV-14:** bij uitval van de mini-server leveren zijn functies `Onbekend`. Statusgegevens die hij verzamelde worden niet vervangen door de laatst bekende waarde als actueel.
**LSV-15:** de collector buffert lokaal bij internetuitval en levert later versleuteld aan, met de oorspronkelijke meettijdstippen — niet met het tijdstip van aanlevering.
**LSV-16:** herstart en herstel zijn menselijke handelingen. Er is geen automatische herstart vanuit Control.

## 7. Directe afkeurgronden

- De mini-server draait de Control-kern of een productiedatabase.
- Een lokale agent voert een van de negen verboden handelingen uit.
- Inkomende beheerpoort zonder geregistreerde noodzaak.
- Secrets in scripts, images of documentatie.
- Gebufferde metingen worden aangeleverd met het tijdstip van aanlevering in plaats van meting.
- Functies van een uitgevallen mini-server tonen oude waarden als actueel.
- Agentruntime actief vóór de agentgovernance in Control is bewezen.
