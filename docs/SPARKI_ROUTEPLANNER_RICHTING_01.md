# SPARKI ROUTEPLANNER — BOUWRICHTING

Technische code: `ROUTEPLANNER_RICHTING_01`
Datum: 1 augustus 2026
Status: productrichting, vastgesteld door René. Nog geen bouwopdracht — dit is wat een bouwopdracht moet realiseren.

---

## 1. Waarom dit document er is

Het huidige routepaneel (`route-panel.tsx`, 5248 regels) is een formulier met een kaart ernaast. De bediening bestaat vrijwel volledig uit invulvelden: afstand, hoogtemeters, ondergrond, drempels, rotondes, spoorwegovergangen, verkeerslichten, wind, temperatuur.

Daarmee concurreert Sparki met Komoot op **routeberekening** — precies het punt waarop Sparki niet hoeft te winnen. En diezelfde filters veroorzaken de tientallen kaartaanvragen per route die de generatie traag en breekbaar maken.

**Waar Sparki wél wint:** Komoot weet niet welke training je vandaag doet. Sparki wel.

---

## 2. De drie ingangen

Wie de planner opent, ziet drie manieren om te beginnen. Geen formulier.

**2.1 Het voorstel van vandaag.** Staat er een training in het schema, dan doet Sparki een routevoorstel dat daarbij past. Het is een voorstel — je kunt het overslaan, het wordt niet opgelegd.

**2.2 De bibliotheek.** Kiezen uit routes die er al zijn. Dit is de hoofdingang.

**2.3 Filteren.** Voor wie iets nieuws wil. Zie hoofdstuk 5.

Zelf een route tekenen vanaf niets is **geen ingang**. Aanpassen van een gekozen route is dat wel — zie hoofdstuk 6.

---

## 2a. Het schermmodel

De opzet volgt de lijn van Komoot — dat frame is niet waar Sparki zich onderscheidt, dus het wordt overgenomen van iemand die er honderd gebruikersinterviews in heeft gestopt. De Sparki-eigen onderdelen komen eromheen.

**Staand, kaart op circa 80% van het scherm.** De kaart is het scherm; al het andere is een randje.

| Onderdeel | Plaats |
|---|---|
| zoekveld startpunt of plaats | bovenop de kaart |
| driepuntsmenu (rondrit maken, richting omdraaien, opnieuw) | bovenop de kaart, rechts |
| filters als bolletjes | bovenop de kaart, horizontaal schuifbaar |
| kaartbediening (lagen, mijn locatie) | rechtsonder op de kaart |
| sleep-open blad met routes en beeld | onderaan, drie hoogtes |
| vast menu van vijf | onderrand, met Club op de positie van Analyse voor wie een clubrol heeft |

**Het eerste filterbolletje is het trainingstype.** Bij Komoot staat daar de sport. Dat is in één woord het verschil tussen de twee apps.

**Het sleepblad kent drie hoogtes:** laag (één regel, tijdens het rijden) · half (één route met alles om te beslissen) · vol (de lijst met routes die in beeld zijn, met beeld erbij).

**Bij het starten van een route wisselt de weergave op dezelfde kaart.** De navigatielaag komt over de planningslaag heen: planningsbediening verdwijnt, navigatiebediening komt ervoor in de plaats. Geen apart navigatiescherm.

### Beeldgebruik

Er staan 65 Midjourney-sfeerfoto's in `public/atmosphere/`, benoemd naar sfeer (polder in het blauwe uur, populieren in ochtendlicht, klinkerweg onder onweerslucht, samen fietsen op een terras).

**Wel gebruiken:** bij het voorstel van vandaag · in lege toestanden (nog geen routes, Strava niet gekoppeld) · als kopje boven een groep in de bibliotheek.

**Nooit gebruiken als beeld bij een specifieke route.** Dan leest iemand het als "zo ziet die rit eruit", en dat klopt niet.

**Voor een concrete route:** een uitsnede van de kaart met de routelijn erop, of het hoogteprofiel. Voor een wielrenner zegt dat profiel meer dan een foto — hij ziet in één oogopslag of het vlak is.

---

## 3. De bibliotheek vult zichzelf

De bibliotheek mag bij eerste opening niet leeg zijn. Vier bronnen tegelijk:

| Bron | Opmerking |
|---|---|
| Eigen eerdere ritten | uit Sparki zelf |
| Import van Strava en Garmin | **de belangrijkste.** Wie koppelt krijgt vaak honderden ritten mee — dat lost het koudestartprobleem in één handeling op |
| Routes van andere Sparki-gebruikers | |
| Door Sparki samengesteld | |

De Strava-koppeling is daarmee geen bijzaak maar een dragend onderdeel van de routeplanner.

**Routes van andere gebruikers zijn openbaar voor iedereen** — niet alleen voor vrienden, en niet per route in te stellen.

**Begin en eind van een openbare route worden afgekapt**, zodat het huisadres van de maker niet zichtbaar is. Dat geldt voor iedereen, niet alleen voor jeugd — één regel is eenvoudiger dan een leeftijdscontrole.

**Wie geen Strava koppelt en zelf nog niets heeft gereden**, ziet routes uit de buurt van anderen plus door Sparki samengestelde routes. Er wordt **niet** meteen om koppelen gevraagd: eerst zien waar het over gaat, dan pas wat koppelen oplevert.

---

## 4. De training stuurt de route

Dit is het onderscheid met elke andere routeplanner. Voor gebruikers met Compleet past de gegenereerde route zich aan het trainingstype aan:

| Training | Wat de route moet doen |
|---|---|
| **Interval** | na de warming-up zoveel mogelijk rechte stukken, dan wel weinig bochten |
| **Duurtraining** | mag een recreatieve route zijn, met leuke bezienswaardigheden onderweg |
| **Herstel** | zeker geen heuvels |

**Vaste regel, ongeacht training: geen woonwijken.** Dat is geen filter maar een eigenschap van elke Sparki-route — het geldt dus **ook bij een vrije rit zonder trainingstype**. De gebruiker hoeft er niets voor in te stellen.

---

## 5. Wat filteren wordt — en wat informatie wordt

Het hoofdfilter is niet afstand of ondergrond, maar **wat voor training doe je**. Daar volgt de rest uit. Dat is één keuze die de gebruiker toch al heeft gemaakt, in plaats van vijftien velden.

**Blijft filter** — bepaalt welke route je krijgt:
- trainingstype (of "vrije rit")
- afstand of duur
- startpunt
- ondergrond en fietstype

**Wordt informatie bij de route** — nu nog filter, straks tonen in plaats van vooraf vragen:
- aantal verkeerslichten
- spoorwegovergangen
- rotondes
- drempels
- wind onderweg, temperatuur, kans op neerslag

Je vinkt niet vooraf "geen rotondes" aan. Je ziet bij een route: *veertien verkeerslichten, twee spoorwegovergangen, tegenwind op de terugweg* — en kiest zelf.

**Dit is ook de technische winst.** Elke filtereis die vooraf moet worden afgedwongen kost kaartaanvragen. Achteraf tonen wat er is, kost er één.

---

## 6. Een gekozen route aanpassen

Vier handelingen, op de kaart:

1. **punt verslepen**
2. **waypoint toevoegen**
3. **inkorten of verlengen**
4. **een klim toevoegen**

Die laatste is Sparki-eigen. Je kiest uit **klimmen in de buurt van de route** — niet zoeken op naam, en Sparki stelt ze niet zelf voor. De Klimmenverkenner levert de gegevens; die bestaat al.

Aanpassen wordt daarmee ook trainingsgericht: bij een duurtraining twee klimmetjes erbij, bij herstel juist niet.

---

## 7. Onderweg — de fietscomputer

Welke gegevens je ziet hangt af van wat je doet:

| Profiel | Toont |
|---|---|
| **Wandelen** | afstand gelopen · afstand te gaan · totaal · snelheid |
| **Gewone fietser** | idem, plus accustand en bereik bij een e-bike |
| **Wielrenner, mtb, gravel** | idem, plus alles wat via ANT+ en Bluetooth binnenkomt |

Bij een e-bike blijft de bestaande regel gelden: **bereik toont "onbekend" zolang er geen bron is.** Nooit een geschat getal.

---

## 8. Vrienden op de kaart

Het tweede onderscheid: zien waar je vrienden fietsen, live én achteraf.

**Harde regels:**
- alleen **wederzijds geaccepteerde** vrienden
- **standaard uit**, en aan te zetten **per vriend afzonderlijk** — je kunt dus zichtbaar zijn voor één vriend en voor niemand anders
- **jeugdleden komen hier niet in voor.** De functie bestaat voor hen niet
- **alleen tijdens een rit.** Daarna stopt het vanzelf — geen nalooptijd, geen schakelaar die aan blijft staan
- **grofmazig, geen precieze positie.** Een vriend ziet globaal in welke hoek je rijdt, niet zo gedetailleerd dat hij naar je toe kan rijden. Dus een gebied, geen punt. Grof genoeg dat de route er ook niet uit af te leiden is door een tijdje te kijken hoe het gebied verschuift

De overweging achter de per-vriend-instelling: live zichtbaar zijn ligt voor mannen en vrouwen verschillend, en niemand hoort ergens in te belanden door één vinkje dat hij ooit aanzette.

---

## 9. Bezienswaardigheden

Koffieplekjes, eetadresjes en leuke plekken onderweg komen **uit een bestaande kaartbron**, niet van gebruikers. Reden: geen lege kaart bij de start, en geen moderatie later.

Praktisch komt dat uit dezelfde kaartgegevens die de routeketen al gebruikt — cafés, restaurants en bakkers staan daarin met hun soort. De selectie van wat een fietser of wandelaar zoekt is redactiewerk van Sparki, geen gebruikersinvoer.

---

## 10. Wat níét verandert

- de fail-closed blokkadecontrole uit taak #505
- de bibliotheekpoorten
- de generatiemotor zelf, behalve waar hoofdstuk 5 aanvragen bespaart
- geen tweede kaartprovider

---

## 11. Volgorde van bouwen

Voorstel, van meeste opbrengst naar minste:

1. **De drie ingangen** — bibliotheek als hoofdscherm, voorstel van vandaag, filteren als derde. Dit alleen al haalt het formulier weg.
2. **Strava- en Garmin-import naar de bibliotheek** — zonder inhoud is een bibliotheek leeg.
3. **Filters terugbrengen, de rest tonen als informatie** — minste werk, directe winst in snelheid en betrouwbaarheid.
4. **De training stuurt de route** — het eigenlijke onderscheid, en het zwaarste stuk.
5. **Aanpassen op de kaart**, inclusief klim toevoegen.
6. **Fietscomputer onderweg** per profiel.
7. **Vrienden op de kaart** — apart traject, raakt privacy en jeugd, hoort niet in dezelfde ronde.
8. **Bezienswaardigheden** uit de kaartbron.

---

## 12. Nog te beslissen

De vier punten uit de eerste versie zijn beantwoord en verwerkt in de hoofdstukken hierboven. Wat resteert is technisch, niet productmatig:

1. hoe grof "grofmazig" precies is bij live zichtbaarheid — een gebied van welke omvang, en hoe vaak het ververst
2. welke kaartbron de bezienswaardigheden levert, en welke soorten daaruit worden getoond
3. hoe een geïmporteerde Strava-rit een bruikbare route wordt: automatisch omzetten, of pas bij gebruik
