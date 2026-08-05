# ANALYSE_UITBREIDING_EN_ZANDBAK_01

**Werkdocument — Sparki**
Datum: 5 augustus 2026
Gemeten op: `e15645a` (eigen kloon van de repo, statische meting)
Leest samen met: `MEETNIVEAU_EN_UITLEG_01`, `AI_COACH_KOPPELING_EN_GEHEUGEN_01`

---

## 0. Waarom dit document er is

De analysemodule staat er beter voor dan gedacht. Dit document sluit de resterende
gaten uit de kaartcatalogus, voegt twee nieuwe onderdelen toe waar Sparki zich mee
onderscheidt (een analyse op verzoek en een analyse over meerdere grafieken
tegelijk), en repareert een gat dat pas zichtbaar werd door te testen: **er is geen
zandbak — elk scherm is zo leeg als de eigen data van de gebruiker.**

---

## 1. Meetresultaat — wat er al staat

| Onderdeel | Vindplaats | Stand |
|---|---|---|
| Analysepagina met 18 kaarten | `pages/core-analyse.tsx` (2.558 r.) | gebouwd |
| Ruwe streams per sessie (uit FIT/TCX/GPX) | ingest → `trainingSessionsTable` | **M1 beantwoord: ja** |
| Powercurve met vensters 5s/10s/20s/60s/5min/20min, dit blok tegen vorig blok van 42 dagen | `routes/athlete.ts` `/power-bests` + `powerBests` per sessie | gebouwd, ontbrekende vensters worden weggelaten, nooit geschat |
| Streamanalyses: vermogenszones, hartslagzones, hartslagdrift, vermogensverval, pacing, intervalherkenning, vergelijking met het geplande blok | `artifacts/sparki/src/lib/stream-analysis.ts` (443 r.) | gebouwd, staat aan de clientkant |
| Uitleglaag | `lib/uitleg-content.ts` (~45 sleutels), 20 UitlegDots op de analysepagina, `vormGrafiekUitleg()` met waarschuwing bij weinig actieve dagen | gebouwd |
| Twee gescheiden poorten | `lib/poorten.ts` + server-side `sensor_data_required` naast `requireCommercialFeature` | **M4 beantwoord: ja, gebouwd** |
| Meetniveau als waarneming | `observeSporen` (laatste 10 activiteiten, ≥6 met vermogen) | gebouwd |
| Belastingsformules | `ctl + (tss − ctl)/42`, `atl + (tss − atl)/7` | standaard, correct |
| Koppelingen | Strava (live), Garmin en Wahoo (OAuth per gebruiker) | **M3 deels: geen Whoop, Oura of Polar** — velden voor rusthartslag en HRV bestaan wel |

---

## 2. Ontbrekende kaarten uit de catalogus

Drie kaarten uit `MEETNIVEAU_EN_UITLEG_01` §6.1a bestaan nog niet. Ze vallen onder
dezelfde uitlegplicht: zonder de twee zinnen gaan ze niet live.

| Kaart | Spoor | Wat er te zien is | Wat je ermee doet |
|---|---|---|---|
| **Ontkoppeling (HR:Power)** | V+H | of je hartslag in de tweede helft van de rit wegloopt bij hetzelfde vermogen | de directste maat voor duuruithoudingsvermogen; hij verbetert zichtbaar in een goede winter |
| **Efficiëntie** | V+H | hoeveel vermogen je levert per hartslag | over maanden vergelijken; stijgt hij, dan wordt dezelfde snelheid je goedkoper |
| **Opbouwsnelheid** | V of H | hoe snel je fitheid per week stijgt | te snelle opbouw is de meest voorkomende oorzaak van blessures en overbelasting; hier zie je het aankomen |
| **Eisprofiel wedstrijd** | V | wat de koers waar je voor traint van je vraagt, tegen je huidige curve | zien welk stuk van je curve nog tekortschiet voor jóuw doel |

**Bouwtoelichting:**

- Ontkoppeling en efficiëntie: de losse ingrediënten liggen er al (`hrDrift`,
  `powerFade`, gemiddelden per rit). Wat ontbreekt is de *verhouding* tussen
  hartslag en vermogen per helft van de rit. Alleen berekenen op ritten die
  daarvoor geschikt zijn — gebruik de bestaande `assessComparability`; bij een
  ongeschikte rit geen getal tonen maar de reden.
- Opbouwsnelheid: de weekstijging van CTL uit de bestaande belastingsreeks. **Geen
  tweede berekening.**
- Eisprofiel: sluit aan op het al vastgelegde keuzeblok wedstrijdsoort/parcours.
  Bouw dit als laatste van de vier.

---

## 3. Analyse op verzoek — de "analyseer nu"-knop

De gebruiker moet zelf om een analyse kunnen vragen in plaats van te wachten tot
Sparki iets zegt.

**Harde eis: dezelfde selectie over dezelfde periode geeft hetzelfde antwoord.**
Wordt het bij elke druk een ander verhaal, dan is het een gokautomaat en is het
vertrouwen weg. De knop bepaalt *wat* er geanalyseerd wordt, niet hoe creatief het
antwoord is.

Bouwregels:

- de deterministische engines leveren de uitkomsten; het model formuleert alleen —
  dus via de bestaande gateway, met een eigen doel in het doelenregister
- het resultaat wordt bewaard met de selectie en de periode erbij, zodat het
  terugleesbaar is en niet elke keer opnieuw hoeft
- elk resultaat maakt een adviesdossier aan (zie `AI_COACH_KOPPELING_EN_GEHEUGEN_01`
  R3)
- een zichtbare grens op het aantal analyses per dag, zodat dit geen kostenpost
  wordt

---

## 4. Analyse over meerdere grafieken

De onderscheidende functie: de gebruiker vinkt **twee tot vijf** kaarten aan en
vraagt wat ze samen betekenen. Niet twaalf losse panelen waar hij zelf een conclusie
uit moet trekken — dat is precies wat TrainingPeaks en intervals.icu wél doen.

Voorbeeld van de gewenste uitkomst (powercurve + opbouwsnelheid + rusthartslag):

> Je vermogen op vijf minuten stijgt, maar je opbouwsnelheid ligt al drie weken hoog
> en je rusthartslag volgt mee. Dit gaat de goede kant op, maar je zit tegen de
> grens aan.

**Beveiliging tegen schijnverbanden — verplicht:**

- maximaal 5 kaarten tegelijk
- er wordt alleen een verband benoemd als beide reeksen genoeg punten in dezelfde
  periode hebben; anders wordt dat gezegd in plaats van weggelaten
- een verband is een waarneming, geen oorzaak: de formulering blijft
  "gaat samen op met", nooit "komt door"
- bij zwak bewijs zegt Sparki dat expliciet — dit volgt het al vastgelegde besluit
  om te adviseren mét voorbehoud in plaats van te zwijgen

---

## 5. Zandbakken

**Bevinding: er is geen enkele.** Geen seed-script, geen demo-sporter, geen
voorbeelddata gevonden. Met twee echte accounts betekent dat: elk scherm is zo leeg
als de eigen data van de gebruiker, en niemand kan iets beoordelen zonder eerst een
half jaar te fietsen.

Drie soorten, in deze volgorde:

### 5.1 Voorbeeldsporter (eerst)

Eén volledig gevulde sporter met een jaar aan realistische data: ritten met streams,
FTP-historie, dagmetingen, doelen, wedstrijden. Bedoeld om de module te kunnen
beoordelen en om een nieuwe gebruiker te laten zien wat hij krijgt.

- gegenereerd door een script, herhaalbaar, met een vaste startwaarde zodat de data
  elke keer identiek is
- duidelijk gemarkeerd als voorbeeld, nooit te verwarren met eigen data
- niet te koppelen aan een echte gebruiker

### 5.2 Wat-als (daarna)

Een trainingsblok doorrekenen zonder het te rijden: wat doet dit met mijn vorm over
drie weken? Gebruikt dezelfde belastingsberekening, geen tweede model.
Uitkomsten zijn **altijd** gemarkeerd als berekening, niet als voorspelling.

### 5.3 Demo-omgeving voor clubs en trainers (laatst)

Een trainersomgeving met een groep voorbeeldsporters, zodat een club kan kijken
voordat hij betaalt. Leunt op 5.1.

---

## 6. Kloppen de uitkomsten — ijking

De formules zijn correct geïmplementeerd; dat is uit de code vast te stellen. Of de
uitkomsten in de app kloppen, is dat niet. Daarvoor één test:

1. neem één FIT-bestand van een echte rit
2. laad hem in Sparki en in intervals.icu (gratis)
3. leg naast elkaar: TSS, IF, genormaliseerd vermogen, CTL, ATL, TSB, en de
   zoneverdeling
4. rapporteer elke afwijking groter dan 2%, met de vermoedelijke oorzaak

**Twee openstaande meetvragen horen hierbij** (uit `MEETNIVEAU_EN_UITLEG_01` §1):

- **M6** — wordt CTL dagelijks herrekend of alleen bij een nieuwe activiteit? De
  vormgrafiek toont CTL als trapjes terwijl ATL vloeiend loopt. Lever de
  CTL-dagwaarden met 2 decimalen over 24-06 t/m 31-07.
- **M7** — wordt TSB berekend op de waarden van vandaag of van gisteren? Reken één
  dag met de hand na tegen de opgeslagen waarde.

---

## 7. Wat de gebruiker ervaart

### 7.1 Gemeten stand

Beter dan verwacht: de analysepagina heeft vijf tabbladen (Overzicht · Belasting ·
Progressie · Doelen · Sessies), een periodekiezer, een vergelijking met de vorige
periode over de vormgrafiek heen, 17 zichtbare uitlegregels onder de grafieken en
vijf eerlijke lege toestanden. Het is dus geen eindeloze scroll met kale panelen.

### 7.2 Wat er dan tóch misgaat

Vier dingen, alle vier bevestigd door de eerste eigen testronde:

1. **Het eerste scherm beantwoordt de verkeerde vraag.** Het toont grafieken, geen
   oordeel. De gebruiker komt binnen met "hoe sta ik ervoor" en krijgt materiaal
   waaruit hij dat zelf moet afleiden.
2. **Alle achttien kaarten wegen even zwaar.** Er is geen volgorde naar wat vandaag
   aandacht vraagt; de kaart die er echt toe doet staat naast een kaart die deze
   maand niets doet.
3. **Het gesprek loopt één kant op.** Een sporter die zich afvraagt hoe hij aan een
   waarde komt, kan het nergens vragen. Dat is precies waar §3 en §4 voor bedoeld
   zijn, maar het moet ook vanaf de kaart zelf bereikbaar zijn.
4. **Twee verhalen over dezelfde week.** De coach ziet de kaarten niet (zie
   `AI_COACH_KOPPELING_EN_GEHEUGEN_01` G1 en G2), dus zijn oordeel kan de grafiek
   tegenspreken. Voor de gebruiker is dat het snelste verlies van vertrouwen dat er
   is.

### 7.3 Wat erbij komt

- **Bovenaan Overzicht één regel met het oordeel**, uit hetzelfde belastingsmodel
  als de grafiek eronder. Geen getal, wel een uitspraak — "je bent uitgerust, maar
  je fitheid zakt al drie weken" — en daarnaast, klein, waar dat op gebaseerd is.
- **Maximaal drie punten die aandacht vragen**, met een verwijzing naar de kaart
  waar het vandaan komt. Zijn er geen, dan staat er dat er niets bijzonders is —
  niet een lege ruimte.
- **Op elke kaart een ingang "hier een analyse over vragen"**, die de analyse op
  verzoek uit §3 opent met die kaart al aangevinkt. Vandaar is §4 één tik verder:
  er kaarten bij kiezen.
- **De kaartvolgorde binnen Overzicht volgt wat vandaag afwijkt**, niet een vaste
  lijst. De overige kaarten blijven op hun eigen tabblad staan.

Wat níét verandert: de tabstructuur, de periodekiezer en de uitlegregels. Die
werken.

---

## 8. Acceptatietests

| # | Test | Verwacht |
|---|---|---|
| B1 | Rit met vermogen en hartslag, geschikt voor ontkoppeling | getal plus de twee uitlegzinnen |
| B2 | Rit die zich er niet voor leent (te veel stops, te kort) | geen getal, wel de reden |
| B3 | Twee keer dezelfde analyse op dezelfde selectie en periode | identieke uitkomst |
| B4 | Analyse over 5 kaarten waarvan er één nauwelijks data heeft | dat wordt benoemd, geen verband op die kaart |
| B5 | Voorbeeldsporter openen | alle 18 kaarten gevuld, zichtbaar gemarkeerd als voorbeeld |
| B6 | Voorbeeldsporter twee keer genereren | identieke data |
| B7 | Wat-als-blok doorrekenen | uitkomst gemarkeerd als berekening, echte reeks blijft ongewijzigd |
| B8 | FIT-ijking tegen intervals.icu | afwijkingen benoemd, of bevestigd dat ze binnen 2% blijven |
| B9 | Overzicht openen met een gevulde sporter | oordeelregel bovenaan, komt uit hetzelfde model als de grafiek eronder |
| B10 | Week zonder bijzonderheden | er staat dat er niets bijzonders is; geen lege ruimte, geen verzonnen aandachtspunt |
| B11 | Vanaf een kaart een analyse vragen | de analyse opent met die kaart al aangevinkt |

---

## 9. Volgorde

1. **§6 ijking + M6/M7** — eerst; zonder kloppende uitkomsten heeft uitbreiden geen zin
2. **§5.1 voorbeeldsporter** — daarna alles beoordeelbaar, ook voor Dylan
3. **§7.3 oordeelregel en aandachtspunten bovenaan Overzicht** — kleinste ingreep met het grootste verschil in beleving
3. **§2 ontkoppeling en efficiëntie**, dan opbouwsnelheid
4. **§3 analyse op verzoek**
5. **§4 analyse over meerdere grafieken**
6. **§2 eisprofiel wedstrijd**
7. **§5.2 wat-als**, daarna **§5.3 demo voor clubs**

---

## 10. Wat er níét gebouwd wordt

- geen tweede berekening van belasting, vorm, zones of powercurve
- geen kaart zonder de twee uitlegzinnen (uitlegplicht)
- geen oorzakelijke taal bij een gevonden verband
- geen voorbeelddata die met echte data vermengd kan raken
