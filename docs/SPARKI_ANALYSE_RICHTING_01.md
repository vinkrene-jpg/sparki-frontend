# SPARKI ANALYSE — BOUWRICHTING

Technische code: `ANALYSE_RICHTING_01`
Datum: 1 augustus 2026
Status: productrichting, vastgesteld door René. Nog geen bouwopdracht.

Leest samen met `AI_INTELLIGENCE_ENGINE_01` (adviesdossier, confidence-model) en `SPARKI_BESLUITEN_PATCH_2026-08-01` hoofdstuk G.

---

## 1. Waar Sparki zich onderscheidt

Er bestaan al uitstekende analyseplatformen. Intervals.icu geeft gratis weg wat TrainingPeaks voor circa twintig dollar per maand verkoopt: het fitnessdiagram, de vermogenscurve, automatische intervaldetectie, eigen grafieken en zelfs eigen berekeningen op ruwe FIT-data. Meer dan 160.000 sporters gebruiken het.

**Op diepte alleen valt daar niet tegenop te concurreren.** Op interpretatie wel.

Die platformen tonen de grafiek en laten het lezen aan de gebruiker. Hun eigen zwakte is precies dat: de interface vraagt een flinke leercurve. Wie niet weet wat CTL, ATL en TSB betekenen, kijkt naar mooie lijnen zonder te weten wat hij ermee moet — en dat is verreweg de meeste clubrenners.

**Sparki voert de analyse uit en geeft richting.** Aan zowel trainer als renner: wat betekent dit voor de trainingen en de doelen.

---

## 2. De kern: verbanden, geen losse waarden

Een enkele waarde zegt weinig. Betekenis ontstaat in samenhang.

Een TSS van 300 betekent iets anders voor iemand met tien jaar zware trainingen in de benen dan voor iemand in zijn tweede seizoen — en weer iets anders na drie nachten slecht slapen.

Verbanden die Sparki minimaal moet leggen:

| Gegeven | Alleen zegt het | In samenhang met |
|---|---|---|
| **TSS van een rit** | weinig | trainingsleeftijd · belasting van de weken ervoor · slaap · stress |
| **Herstelwaarden** | weinig | hoe snel deze sporter normaal herstelt · zwaarte van het laatste blok |
| **Vermogen** | weinig | seizoen · temperatuur · positie in het trainingsblok · vergeleken met eigen historie |
| **Een dip** | weinig | of deze sporter elke winter inzakt · ziekte · werkdruk · reisdagen |

Persoonsgebonden context die dit mogelijk maakt:
- hoeveel jaren zware training achter de rug, of juist niet
- herstelprofiel: snel of langzaam na een zwaar blok
- gevoeligheid voor kou en warmte
- slaap- en stresspatroon
- werk- en gezinsbelasting in grote lijnen

---

## 3. Waar die context vandaan komt

**3.1 Historische import — de grootste sprong.**
Wie al jaren traint en Strava of Garmin koppelt, levert in één handeling: trainingsleeftijd, seizoenspatronen, hersteltijd na zware blokken, en de ontwikkeling over jaren. Sparki is daarmee bij de eerste inlog niet blind.

Dit is dezelfde hefboom als bij de routebibliotheek, en dus dezelfde koppeling. Bouw hem één keer goed.

**3.2 Bij het instappen uitvragen.**
Kort en alleen wat de import niet oplevert: sinds wanneer train je gestructureerd · hoe herstel je normaal · last van kou of hitte · gemiddelde slaap · werk- en gezinsdruk in grote lijnen.

**3.3 Door gebruik leren.**
Slaap, stress en subjectief gevoel beginnen pas te lopen zodra iemand Sparki gebruikt. Dat is de laag die na een seizoen het meeste waard wordt.

---

## 4. Eerlijk over wat je nog niet weet

Het eerste seizoen kent Sparki iemand nog nauwelijks. Dat is geen tekortkoming, maar het moet zichtbaar zijn.

Het confidence-model uit `AI_INTELLIGENCE_ENGINE_01` is hiervoor gebouwd: acht factoren bepalen hoe stellig Sparki mag zijn. Vier gebruikersniveaus, **nooit een percentage naar de gebruiker**.

Bindende regels die al vastliggen:
- bij te weinig gegevens **wél** advies, met voorbehoud — niet zwijgen
- dat voorbehoud staat achter een doorklik, **behalve bij gezondheid en herstel**: daar direct zichtbaar
- **bij minderjarigen zwijgt Sparki wél** als er te weinig gegevens zijn voor een gezondheids- of hersteladvies
- Sparki blijft bij trainingsbelasting en herstel; gezondheidssignalen zijn **observatie met doorverwijzing**, nooit een vaststelling
- elk advies moet kunnen tonen waarop het gebaseerd is

---

## 5. Twee grafieken die ontbreken

De code bevat het belastingsmodel al uitgebreid — TSS, CTL, ATL en TSB komen honderden keren voor — en ook eFTP, het automatisch schatten van het drempelvermogen uit de zwaarste inspanningen. Dat is het model waar TrainingPeaks zijn abonnement op verkoopt, en het staat er.

Wat ontbreekt:

**5.1 De vermogenscurve.** Eén treffer in de hele codebase. Dit is het paradepaardje van intervals.icu: je beste vermogen over elke duur, met **seizoensvergelijking**. Niet één getal, maar hoe iemand zich over jaren heeft ontwikkeld — en precies waar de historische import zijn waarde bewijst.

**5.2 Automatische intervaldetectie.** Sparki herkent zelf de blokken in een rit, zonder dat iemand ze hoeft te markeren. Sluit direct aan op de intervalroutes uit `SPARKI_ROUTEPLANNER_RICHTING_01`: je schrijft een intervaltraining voor, de route ondersteunt hem, en de analyse herkent achteraf of hij ook zo gereden is.

---

## 6. Twee lezers, twee teksten

Dezelfde analyse, andere vraag:

**De renner** wil weten of hij morgen hard mag, of hij vooruitgaat, en waarom het vandaag zwaar voelde.

**De trainer** wil weten bij welke sporter hij moet ingrijpen, en waarom. Voor hem is het overzicht over zijn hele groep belangrijker dan de diepte per rit.

Bepalend blijft: **de trainer ziet uitsluitend wat de sporter deelt** (één schakelaar, standaard uit). Uitzondering: een overtrainingssignaal gaat bij een minderjarige altijd naar de ouder, ook als delen uitstaat.

---

## 7. Wat dit betekent voor het scherm

Niet vijf tabbladen met grafieken waar je zelf iets van moet vinden. Per grafiek een regel die zegt wat er staat en wat het betekent voor het doel.

De bestaande indeling — Overzicht, Belasting, Progressie, Doelen, Sessies — blijft bruikbaar. Wat verandert is dat elke weergave een uitleg krijgt in plaats van alleen een lijn.

**Analyse zit in Compleet en in het Trainer-abonnement, niet in Go.**

---

## 8. Volgorde van bouwen

1. **Historische import uit Strava en Garmin** — zonder geschiedenis geen verbanden. Dezelfde koppeling als voor de routebibliotheek
2. **Vermogenscurve met seizoensvergelijking** — grootste zichtbare winst, en de eerste die de historie echt gebruikt
3. **Uitleg bij elke bestaande weergave** — wat staat hier, wat betekent het voor je doel
4. **Contextvragen bij het instappen** — kort, alleen wat de import niet oplevert
5. **Verbanden leggen** — het eigenlijke onderscheid, en het zwaarste stuk
6. **Automatische intervaldetectie**
7. **Trainersweergave** — overzicht over de groep, wie aandacht nodig heeft

---

## 9. Beantwoord op 1 augustus 2026

1. **Contextvragen bij het instappen: ruim mag.** Vijf tot acht of meer. Wie voor Compleet kiest snapt dat er vragen nodig zijn, en commercieel is het juist belangrijk om meteen een goede indruk te maken met de juiste data. Keerzijde: wie zeven vragen beantwoordt verwacht daarna ook iets terug — het eerste beeld moet raak zijn
2. **De import haalt de volledige historie op, maar gefaseerd.** Eerst het laatste jaar zodat er meteen iets te zien is, de rest op de achtergrond erbij
3. **De trainer krijgt een groepsoverzicht met signalen** — wie aandacht nodig heeft, in één beeld. Let op: het overzicht kan alleen tonen wat gedeeld is; een sporter die delen uit heeft staan moet zichtbaar zijn als "niet gedeeld", niet als "niks aan de hand"
4. **Subjectief gevoel wordt alleen na zware ritten uitgevraagd** — niet na elke rit
