# GELOOFWAARDIGHEID_01 — Sparki groter laten voelen dan een landingspagina

**Type:** bouwopdracht voor Replit
**Gemeten op:** main `d76bb577`, 2 augustus 2026
**Aanleiding:** René: "Sparki voelt klein." Een marketingsite alleen lost dat niet op.

---

## Waarom

Een landingspagina overtuigt iemand die al kijkt. Wat een product *groot* laat voelen zit ergens anders: in de sporen die het achterlaat buiten zijn eigen schermen. Op je fietscomputer, in een zoekresultaat, in een documentatiepagina, op een statuspagina.

Vier van de zeven punten hieronder zijn **zichtbaar maken wat er al is**, geen nieuwbouw. Dat is de goedkoopste geloofwaardigheid die er is.

---

## 1. Op het apparaat staan — Garmin Connect IQ

`GEL-01` — Dit is verreweg het grootste effect en tegelijk het meeste werk. Het staat daarom eerst genoemd en **als laatste in de uitvoering**.

Connect IQ is de winkel waar apps op Garmin-horloges en Edge-fietscomputers terechtkomen. Komoot heeft er in 2023 de Connect IQ App of the Year mee gewonnen: je plant op je telefoon en start de route op je Garmin, met hoogteprofiel, wegdek en kaarten op het toestel zelf.

`GEL-02` — Wat de Sparki-app op een Garmin minimaal doet: je opgeslagen routes tonen · een route starten en navigeren · het hoogteprofiel en het wegdek laten zien · en bij Compleet de training van vandaag met de intervalbegeleiding.

`GEL-03` — **Voorwaarde:** de routeketen moet aantoonbaar stabiel zijn voordat hieraan begonnen wordt. Een app op iemands fietscomputer die faalt, is schadelijker dan geen app.

`GEL-04` — Levert eerst een haalbaarheidsrapport: welke toestellen, welke functies passen binnen de beperkingen van het platform, wat de indieningsprocedure vraagt, en een schatting. Pas daarna bouwen.

---

## 2. De koppelingen zichtbaar maken

`GEL-05` — **Gemeten:** Sparki heeft zes koppelingen met echt werk erin — Strava, Garmin, Wahoo, Oura, intervals.icu en Polar — plus aanzetten voor Zwift, Suunto, Coros en Whoop. Dat ziet vandaag niemand.

`GEL-06` — Zet het aantal en de logo's op de openbare site en in het instapscherm. De uitwerking staat in `KOPPELINGEN_01`; dit punt zorgt alleen dat het naar buiten komt.

---

## 3. De kennisbank openbaar

`GEL-07` — **Gemeten:** er is een volwaardige kennislaag met versiebeheer en gebruiksregistratie (`managed_knowledge_items`, `managed_knowledge_versions`, `knowledge_usage_events`), en er zijn ruim 290 items opgebouwd. Alleen zichtbaar na inloggen.

`GEL-08` — Publiceer een **selectie** openbaar, met eigen adres per artikel, een titel en een beschrijving voor zoekmachines, en de bron en de datum van bijwerken erbij. Geen dump van alles: de kennisartikelen binnen de app blijven bij Compleet horen.

`GEL-09` — Dit is tegelijk het goedkoopste kanaal om gevonden te worden. Een bibliotheek van honderden artikelen voelt als een instituut; drie blogposts voelen als een hobby.

`GEL-10` — De regels uit `KENNIS_01` blijven gelden: bron en datum van bijwerken bij elk artikel, jeugdinhoud gemarkeerd, geen jeugdvoedingsinhoud.

---

## 4. Zichtbaar leven — een "wat is er nieuw"-pagina

`GEL-11` — Er wordt sinds deze week **dagelijks gepubliceerd**. Dat is het sterkste bewijs dat het product leeft, en het is nu alleen in de commitgeschiedenis te zien.

`GEL-12` — Bouw een openbare pagina met per publicatie een paar regels in gewone taal: wat is er nieuw, wat is er verbeterd, wat is er opgelost. **Niet automatisch uit commitberichten** — die zijn voor ontwikkelaars geschreven en lezen als ruis.

`GEL-13` — Eén regel per item, geen technische termen, geen bestandsnamen. "Je ziet nu welke versie je gebruikt" in plaats van "version.json toegevoegd".

---

## 5. Een openbare API met documentatie

`GEL-14` — **Gemeten:** er ligt al een volledige specificatie in `lib/api-spec/openapi.yaml`.

`GEL-15` — Publiceer die als leesbare documentatiepagina. Een product met een API is een platform; een product zonder is een app.

`GEL-16` — Nog geen sleutels uitgeven en geen toegang openstellen — alleen tonen dat het bestaat en hoe het eruitziet. Toegang verlenen is een later besluit met eigen gevolgen voor rechten en privacy.

---

## 6. Een statuspagina

`GEL-17` — Publiek zichtbaar: werkt Sparki nu, en waren er recent storingen. Voor een club die jeugdgegevens toevertrouwt is dat geen detail — het zegt dat er iemand achter zit die dit beheert.

`GEL-18` — Minimaal: de toestand van de app, de server en de koppelingen, plus de laatste storingen met een korte uitleg. Eerlijk: een verzwegen storing kost meer vertrouwen dan een gemelde.

---

## 7. Diepte tonen in plaats van beloven

`GEL-19` — Echte schermen per rol op de openbare site: de wedstrijddag, het gedeelde plan waarin vier rollen tegelijk werken, de ouderomgeving, het clubbeheer.

`GEL-20` — Dit is het enige punt dat niets kost en dat geen enkele concurrent kan namaken. Geen van de vergeleken aanbieders heeft een club-, jeugd- of wedstrijdlaag; die screenshots bestaan bij hen niet.

`GEL-21` — Gebruik echte gegevens uit een fixture, nooit verzonnen namen of getallen in een screenshot.

---

## Wat er al is en alleen zichtbaar hoeft

Privacyverklaring, gebruiksvoorwaarden en support bestaan als pagina's. De API-specificatie ligt er. De kennisbank staat vol. De koppelingen werken. **Vier van de zeven punten zijn presentatie, geen bouw.**

---

## Volgorde

1. Diepte tonen (punt 7) — kost niets, gaat mee met de marketingsite
2. Koppelingen zichtbaar (punt 2)
3. Wat is er nieuw (punt 4)
4. Kennisbank openbaar (punt 3)
5. API-documentatie (punt 5)
6. Statuspagina (punt 6)
7. Garmin Connect IQ (punt 1) — pas nadat de routeketen bewezen is

---

## Directe herstelgronden

`GEL-22` — Een screenshot met verzonnen namen of getallen.
`GEL-23` — Een "wat is er nieuw"-pagina die commitberichten toont.
`GEL-24` — Openbare kennisartikelen zonder bron of datum van bijwerken.
`GEL-25` — Een statuspagina die een storing verzwijgt of altijd groen toont.
`GEL-26` — API-toegang openstellen zonder apart besluit.
`GEL-27` — Een Garmin-app gebouwd op een routeketen die nog niet bewezen is.

---

## Wat René moet leveren

De domeinnaam, want punt 3 tot en met 6 hebben openbare adressen nodig. En voor punt 1 een Garmin-ontwikkelaarsaccount.

---

## Acceptatie

Iemand die Sparki niet kent zoekt op een trainingsonderwerp, komt op een kennisartikel met bron en datum, ziet daar wat Sparki is, en vindt binnen twee klikken echte schermen van de wedstrijddag en een pagina die laat zien dat er vorige week nog iets is verbeterd. Nergens staat iets dat niet klopt.
