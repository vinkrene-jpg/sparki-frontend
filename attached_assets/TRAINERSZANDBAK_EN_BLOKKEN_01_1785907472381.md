# TRAINERSZANDBAK_EN_BLOKKEN_01

**Bouwplan — Sparki**
Datum: 5 augustus 2026
Gemeten op: `e15645a`

---

## 0. Plaats in het geheel

Dit document beschrijft twee nieuwe onderdelen: **trainingsblokken in de bibliotheek**
en een **zandbak voor trainers met een gesimuleerde sporter**. Alles wat vandaag
verder besproken is, staat in de andere vier documenten. Deze index is er zodat er
niets tussenuit valt:

| Onderwerp | Document | Status |
|---|---|---|
| Meetniveaus, twee poorten, uitlegplicht, kaartcatalogus, herstelblok, ochtendmelding | `MEETNIVEAU_EN_UITLEG_01` (v3) | in uitvoering (#570, #571, #572) |
| Vorm en diepe analyse naar de coach, adviesdossier, meetniveau in de context, geheugen (bevestiging, proactieve triggers, terugleesbaarheid, vergeten) | `AI_COACH_KOPPELING_EN_GEHEUGEN_01` | nieuw, nog niet gestart |
| Ontbrekende kaarten (ontkoppeling, efficiëntie, opbouwsnelheid, eisprofiel), analyse op verzoek, analyse over meerdere grafieken, zandbakken, ijking, gebruikerservaring | `ANALYSE_UITBREIDING_EN_ZANDBAK_01` | nieuw, nog niet gestart |
| Herhalende clubtrainingen, navigatie voor clubrollen, herindeling beheerscherm, testbevestiging ploegleider | `CLUB_AFRONDING_01` | nieuw, nog niet gestart |
| Trainingsblokken + trainerszandbak | **dit document** | nieuw |

**Twee onderwerpen zijn bewust niet apart gebouwd, maar staan wel vast:**

- de **trainersomgeving is dunner dan de sporterskant** (trainerscockpit ± 1.400
  regels tegenover 2.558 voor alleen de analysepagina van de sporter). Dat is geen
  losse opdracht maar een reden om trainerwerk voorrang te geven; het wordt gemeten
  na oplevering van dit document en `CLUB_AFRONDING_01`
- de **vergelijking met TrainingPeaks voor een beginnende trainer** wordt niet met
  code beslecht maar met een test: laat een beginnende trainer dezelfde
  trainingsweek opzetten in Sparki en in TrainingPeaks, klok beide, noteer waar hij
  vastloopt

---

## 1. Besluiten van 5 augustus 2026

| # | Besluit |
|---|---|
| T1 | Het heet een **blok** (of trainingsblok), **niet een segment** — "segment" betekent voor wielrenners een stuk weg (Strava) |
| T2 | Een blok is een periode van **enkele dagen tot ongeveer een maand** waarin voor een bepaalde fase getraind wordt |
| T3 | Een trainer mag **eigen blokken op de marktplaats aanbieden**, net als eigen trainingsvormen |
| T4 | De zandbak dient **twee doelen: leren én blokken uittesten** voordat ze op een echte groep gaan |
| T5 | De gesimuleerde sporter draait op **hetzelfde belastingsmodel** als de rest van Sparki — geen apart model |
| T6 | De zandbak is uitdrukkelijk een **berekening op een fictieve sporter**, nooit een voorspelling over een echt mens, en dat staat er permanent bij |

---

## 2. Trainingsblokken in de bibliotheek

### 2.1 Wat een blok is

Een sjabloon met **relatieve dagen**, geen kalenderperiode: dag 1 zwaar, dag 2
rustig, dag 4 opnieuw. Daardoor is hij overal in het seizoen neer te zetten.

Bouw dit op de **bestaande slotmechaniek** van de trainingsvormenbibliotheek
(`TRV` F3, plan-slots). **Geen tweede sjabloonmechanisme.**

### 2.2 Velden per blok

Naast wat een trainingsvorm al heeft:

- **fase** — basis · opbouw · omzetting · realisatie · herstel · taper
- **duur** in dagen (bereik: 3 tot 35)
- **dagsloten** met per dag een trainingsvorm of een categorie waaruit gekozen mag
  worden, plus rustdagen
- **ingangsvoorwaarde** — wat moet er waar zijn voordat je hieraan begint
  (bijvoorbeeld: minstens acht weken regelmatig getraind, geen open blessure)
- **uitkomstcontrole** — wat zou er verbeterd moeten zijn als hij goed liep, en
  welke kaart uit de analysemodule dat laat zien
- **onderbouwingslabel** — de drie bestaande labels (onderbouwd · beperkt
  onderbouwd · praktijkvorm zonder onderzoek) plus de bron
- **doelgroepgrens** — voor wie hij níét bedoeld is (zie §4.3)
- **eigenaar en zichtbaarheid** — privé voor eigen sporters of op de marktplaats (T3)

### 2.3 Gedrag

- een blok neerzetten materialiseert echte geplande trainingen, net als bij de
  reeksen (F5) — geen virtuele instanties
- de trainer of sporter mag elke dag daarna nog aanpassen; het blok is een
  startpunt, geen keurslijf
- ingangsvoorwaarde niet gehaald → het blok is bruikbaar, maar Sparki zegt één keer
  waarom het niet past. Geen blokkade
- na afloop toont Sparki de uitkomstcontrole: is gebeurd wat er zou gebeuren, ja,
  nee of niet meetbaar. "Niet meetbaar" is een eerlijke uitkomst

---

## 3. De tien startblokken

Deze worden geschreven op basis van gepubliceerd onderzoek, in eigen woorden en met
bronvermelding — zoals al besloten voor de kennisinhoud. Het overtikken van
bestaande commerciële schema's is uitgesloten.

Basis uit de literatuur (Replit hoeft dit niet op te zoeken; de teksten worden
aangeleverd):

- **blokperiodisering bij wielrenners**: één week hoogintensief gevolgd door drie
  weken laagintensief, drie keer herhaald over twaalf weken (Rønnestad)
- **klassiek blok van vier weken**: week 1 gemiddeld volume rustig met twee
  intervalsessies, week 2 en 3 hoog volume met drie intervalsessies, week 4 volume
  gehalveerd met één intervalsessie (Sylta)
- **drie bloktypen**: opbouw, omzetting, realisatie (Issurin)
- gangbaar bereik in de praktijk: blokken van één tot acht weken

De set van tien: basisperiode · twee opbouwblokken · drempelblok · scherpteblok ·
herstelweek · taper naar een doelwedstrijd · twee baanvarianten · één jeugdvariant.

---

## 4. De trainerszandbak

### 4.1 Wat het is

Een afgeschermde omgeving waarin een trainer een gesimuleerde sporter coacht: hij
zet trainingen of een blok neer en ziet wat het doet.

**Instelbare achtergrond bij het aanmaken:** leeftijd, trainingsverleden in jaren,
huidige fitheid, beschikbare uren per week, herstelsnelheid, belastbaarheid,
gevoeligheid voor ziekte. Die knoppen bepalen hoe de sporter reageert.

### 4.2 Hoe de sporter reageert

- **Zelfde belastingsmodel** als de rest van Sparki (`computeLoadSeries`), met de
  persoonlijke parameters uit 4.1 erbovenop. Geen tweede model, geen tweede formule
- **Deterministisch met een startwaarde**: dezelfde invoer geeft dezelfde uitkomst,
  zodat een trainer twee aanpakken eerlijk kan vergelijken
- **Hij praat terug.** Niet alleen een curve maar korte berichten: "dag drie voelde
  zwaar", "dinsdag kan ik niet", "ik ben verkouden". Daar leert een beginnende
  trainer meer van dan van een grafiek, want dat is het echte werk
- De gesimuleerde sporter gebruikt dezelfde ochtendvraag en dezelfde herstellaag als
  een echte sporter, zodat de trainer de signalen leert lezen die hij later in het
  echt ziet

### 4.3 Eerlijkheid — verplicht

- permanent zichtbaar: **fictieve sporter, berekening op een model**. Nooit
  gepresenteerd als voorspelling voor een echt mens
- de zandbakdata staat volledig apart en kan nooit vermengd raken met echte sporters
- bij een blok dat volgens de literatuur niet past bij een minder getrainde of jonge
  renner, toont de zandbak dat expliciet: **geconcentreerde blokken kunnen renners
  met weinig trainingsverleden en een lager fitheidsniveau overbelasten**, en het
  meeste onderzoek is gedaan bij getrainde tot goed getrainde renners

### 4.4 Verhouding tot de voorbeeldsporter

`ANALYSE_UITBREIDING_EN_ZANDBAK_01` §5.1 beschrijft een **stilstaande**
voorbeeldsporter met een jaar aan data. Dit is de **reagerende** versie, met
dezelfde generator. Bouw §5.1 eerst; de zandbak breidt hem uit met reactie op
coaching.

---

## 5. Acceptatietests

| # | Test | Verwacht |
|---|---|---|
| Z1 | Blok van 4 weken neerzetten in de agenda | echte geplande trainingen op de juiste relatieve dagen |
| Z2 | Dag 3 van een geplaatst blok wijzigen | alleen die dag verandert |
| Z3 | Blok neerzetten terwijl de ingangsvoorwaarde niet gehaald is | het mag, met precies één melding waarom het niet past |
| Z4 | Blok afgerond | uitkomstcontrole toont ja, nee of niet meetbaar, met de kaart erbij |
| Z5 | Eigen blok op de marktplaats zetten | zichtbaar voor anderen, met label en bron |
| Z6 | Zandbaksporter aanmaken met twee verschillende achtergronden | verschillend verloop bij dezelfde trainingen |
| Z7 | Dezelfde invoer twee keer | identieke uitkomst |
| Z8 | Zwaar blok bij een jonge, weinig getrainde zandbaksporter | de waarschuwing uit §4.3 verschijnt |
| Z9 | Zandbakomgeving openen | permanente markering "fictief", geen enkele koppeling met echte sportersdata |
| Z10 | Zandbaksporter reageert | minstens één tekstbericht per blok, niet alleen grafieken |

---

## 6. Volgorde en afhankelijkheden

1. **Voorbeeldsporter** (`ANALYSE_UITBREIDING_EN_ZANDBAK_01` §5.1) — blokkerend voor
   de zandbak
2. **§2 blokken in de bibliotheek** — het datamodel en het neerzetten
3. **§3 de tien startblokken** — teksten worden aangeleverd, niet door Replit
   geschreven
4. **§4 de zandbak**, in twee stappen: eerst reageren op belasting, daarna het
   terugpraten
5. **marktplaats voor blokken** (T3) — samen met de al openstaande
   marktplaatsvoorwaarden voor trainingsvormen

---

## 7. Wat er níét gebouwd wordt

- geen tweede sjabloon- of reeksmechanisme naast `TRV` F3 en F5
- geen tweede belastingsmodel voor de zandbak
- geen voorspelling over een echte sporter, hoe de uitkomst ook gepresenteerd wordt
- geen overgenomen commerciële trainingsschema's
- geen zandbakdata die met echte data kan vermengen

---

## 8. Openstaand bij René

- de tien startblokken worden aangeleverd ter toetsing aan zijn praktijkervaring —
  hij schrijft ze niet zelf
- of de zandbak ook voor **sporters zonder trainer** open gaat, of alleen voor
  trainers
- of de marktplaats voor blokken tegelijk opengaat met die voor trainingsvormen, of
  later
