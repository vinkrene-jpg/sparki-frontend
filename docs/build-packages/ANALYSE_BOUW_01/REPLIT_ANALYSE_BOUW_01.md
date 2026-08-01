# REPLIT-OPDRACHT — ANALYSE

Technische code: `ANALYSE_BOUW_01`
Datum: 1 augustus 2026

Bindend ernaast: `SPARKI_ANALYSE_RICHTING_01` (het waarom) en `AI_INTELLIGENCE_ENGINE_01` (adviesdossier, confidence-model). Bij tegenspraak gaat deze opdracht vóór.

**Analyse zit in Compleet en in het Trainer-abonnement. Niet in Go.**

---

## 0. Wat er al staat

Niet opnieuw bouwen:

- `core-analyse.tsx` — 2059 regels, vijf subtabbladen: Overzicht, Belasting, Progressie, Doelen, Sessies
- `analyse-dashboard.ts` (493 regels), `core-analyse.ts`, `session-analysis.ts`
- `coach-analysis-card.tsx` (606 regels), `document-analysis-panel.tsx`
- ruim 1300 regels tests
- het belastingsmodel: TSS, CTL, ATL en TSB zitten er uitgebreid in
- eFTP: automatisch schatten van het drempelvermogen uit maximale inspanningen

Meld in één rapport wat je hiervan hergebruikt, en begin dan te bouwen. **Geen aparte inventarisatiefase.**

---

## 1. Historische import uit Strava en Garmin

Dit is fase één, want zonder geschiedenis zijn er geen verbanden te leggen.

**Volledige historie ophalen, gefaseerd.** Eerst het laatste jaar zodat de gebruiker meteen iets ziet; de rest komt op de achtergrond binnen. Toon de voortgang, laat niemand naar een balkje kijken.

Uit die historie afleiden en opslaan:
- trainingsleeftijd: sinds wanneer traint deze sporter gestructureerd
- seizoenspatronen: zakt hij elke winter in, en hoeveel
- hersteltijd na zware blokken
- ontwikkeling van het vermogen over jaren

**Dit is dezelfde koppeling als voor de routebibliotheek** (`MOBILE_ROUTE_NAV_AFBOUW_01` hoofdstuk 2). Bouw hem één keer, gebruik hem twee keer. Als hij al bestaat: uitbreiden, niet dupliceren.

---

## 2. Vermogenscurve met seizoensvergelijking

Ontbreekt volledig — één treffer op "vermogenscurve" in de codebase.

Het beste vermogen over elke duur, van vijf seconden tot enkele uren, met **vergelijking tussen seizoenen**. Dit is de eerste weergave die de historische import echt gebruikt: niet één getal, maar hoe iemand zich over jaren heeft ontwikkeld.

---

## 3. Uitleg bij elke bestaande weergave

Weinig werk, direct merkbaar.

Bij elke grafiek een regel die zegt **wat er staat** en **wat het betekent voor het doel** van deze sporter. Niet een algemene definitie van CTL, maar: wat betekent deze lijn voor jou, nu, met jouw doel over zes weken.

De vijf bestaande subtabbladen blijven. Wat verandert is dat elke weergave een uitleg krijgt in plaats van alleen een lijn.

---

## 4. Contextvragen bij het instappen

Vijf tot acht vragen mag — meer als het nodig is. Wie voor Compleet kiest verwacht dat.

Alleen vragen wat de import **niet** oplevert:
- sinds wanneer train je gestructureerd (als de historie te kort is)
- hoe herstel je normaal na een zwaar blok
- last van kou of hitte
- gemiddelde slaap
- werk- en gezinsdruk in grote lijnen

**Voorwaarde:** wie zeven vragen beantwoordt, moet daarna meteen iets terugzien dat raak is. Bouw de eerste analyseweergave zo dat de antwoorden er zichtbaar in verwerkt zijn.

---

## 5. Verbanden leggen

Het eigenlijke onderscheid, en het zwaarste stuk. Een enkele waarde zegt weinig; betekenis ontstaat in samenhang.

Minimaal te leggen verbanden:

| Gegeven | Wegen tegen |
|---|---|
| TSS van een rit | trainingsleeftijd · belasting van de weken ervoor · slaap · stress |
| herstelwaarden | hoe snel deze sporter normaal herstelt · zwaarte van het laatste blok |
| vermogen | seizoen · temperatuur · positie in het trainingsblok · eigen historie |
| een dip | of deze sporter elke winter inzakt · ziekte · werkdruk |

**Het confidence-model uit `AI_INTELLIGENCE_ENGINE_01` bepaalt hoe stellig Sparki mag zijn.** Acht factoren, vier gebruikersniveaus, **nooit een percentage tonen**. Het eerste seizoen is die zekerheid laag — dat is geen fout, maar het moet eerlijk zichtbaar zijn.

---

## 6. Subjectief gevoel

**Alleen na zware ritten uitvragen**, niet na elke rit. Kort: één vraag, één tik.

---

## 7. Automatische intervaldetectie

Sparki herkent zelf de blokken in een rit, zonder dat iemand ze markeert.

Sluit aan op de intervalroutes uit `SPARKI_ROUTEPLANNER_RICHTING_01`: er wordt een intervaltraining voorgeschreven, de route ondersteunt hem met rechte stukken, en de analyse herkent achteraf of hij ook zo is gereden.

---

## 8. Trainersweergave

Een **groepsoverzicht met signalen**: wie aandacht nodig heeft, in één beeld over de hele groep. Bij vijfentwintig sporters is een-voor-een langsgaan geen optie.

**Harde regel:** het overzicht toont alleen wat de sporter deelt. Staat delen uit, dan is dat vak zichtbaar **"niet gedeeld"** — nooit leeg alsof er niks aan de hand is.

De teksten verschillen per lezer:
- **de renner** wil weten of hij morgen hard mag, of hij vooruitgaat, en waarom het vandaag zwaar voelde
- **de trainer** wil weten bij wie hij moet ingrijpen en waarom

---

## 9. Bindende regels die al vastliggen

- bij te weinig gegevens **wél** advies, met voorbehoud — niet zwijgen
- dat voorbehoud staat achter een doorklik, **behalve bij gezondheid en herstel**: daar direct zichtbaar bij het advies
- **bij minderjarigen zwijgt Sparki wél** als er te weinig gegevens zijn voor een gezondheids- of hersteladvies
- gezondheidssignalen zijn **observatie met doorverwijzing**, nooit een vaststelling van een aandoening. Dit is een harde Mirror-toets
- elk advies moet kunnen tonen waarop het gebaseerd is
- geen jeugdvoedingsinhoud; een directe eetvraag van een jeugdlid krijgt antwoord **zonder getallen**
- de trainer ziet uitsluitend wat de sporter deelt (één schakelaar, standaard uit). Uitzondering: een overtrainingssignaal gaat bij een minderjarige altijd naar de ouder, ook als delen uitstaat

---

## 10. Wat je niet doet

- geen tweede AI-architectuur, geen losse chatbot, geen directe modelaanroep buiten de gateway
- analyse niet openstellen voor Go
- geen percentages tonen als zekerheid
- de bestaande vijf subtabbladen niet vervangen door een nieuwe indeling

---

## 11. Volgorde

1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.

Hoofdstuk 1 eerst omdat alles erop leunt. Hoofdstuk 3 is klein en meteen zichtbaar. Hoofdstuk 5 is het zwaarst en heeft de rest nodig.

---

## 12. Bewijs

Op productie, vanuit het account van René, op één vaste SHA:

1. Strava koppelen en zien dat de historie binnenkomt — eerst het laatste jaar, daarna de rest
2. de vermogenscurve tonen met minstens twee seizoenen naast elkaar
3. bij elke weergave staat een uitleg die verwijst naar een doel of een training
4. contextvragen beantwoorden en zien dat de antwoorden terugkomen in de analyse
5. een zware rit met een subjectieve vraag erna
6. als trainer het groepsoverzicht openen, met minstens één sporter die niet deelt — die staat als "niet gedeeld"

Schermafdrukken met de SHA erbij. Geen testrapport.
