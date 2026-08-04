# MEETNIVEAU_EN_UITLEG_01

**Aanvullend bouwdocument — Sparki**
Datum: 4 augustus 2026
Status: bindende besluiten + verplichte meetopdracht vooraf
Leest samen met: `AI_INTELLIGENCE_ENGINE_01`, `ABONNEMENT_01`, `UX_AUDIT_MODULES_01`

---

## 0. Waarom dit document er is

De Analyse-module toont vandaag berekende modelwaarden (CTL, ATL, vorm/TSB) zonder dat de
gebruiker weet wat hij ermee moet. Vastgesteld op 4 augustus: een vormpaneel dat "positief —
goed uitgerust" meldt terwijl de fitheid van 13 naar 9 zakt bij één rit in 42 dagen, is
technisch correct en inhoudelijk misleidend.

Twee dingen worden hier vastgelegd:

1. **Wat Sparki van een gebruiker kán meten** hangt af van zijn apparatuur, niet van zijn
   abonnement. Dat moet in de code een eigen, gemeten grootheid worden.
2. **Elke grafiek krijgt uitleg.** Leidend productprincipe: *grafieken en data die de
   gebruiker niet snapt, helpen niet.* Meer grafieken dan intervals.icu of TrainingPeaks is
   uitdrukkelijk **niet** het doel; begrijpelijke grafieken wel.

---

## 1. Meetopdracht — verplicht vóórdat er gebouwd wordt

Onderstaande punten zijn nu **onbekend**. Er wordt niets aan dit document gebouwd voordat ze
beantwoord zijn, met verwijzing naar bestand en regel.

| # | Vraag | Waarom blokkerend |
|---|---|---|
| M1 | Slaat Sparki de ruwe activiteitenstroom per seconde op (vermogen, hartslag, cadans, positie), of alleen samenvattingen per rit? | Zonder ruwe stroom zijn powercurve, zoneverdeling en intervalherkenning onbouwbaar |
| M2 | Bestaat er in het datamodel een veld voor **dagelijkse rusthartslag** en voor **HRV**? Zo ja: welke eenheid, welke bron, nachtgemiddelde of losse meting? | Bepaalt of het herstelblok ontwerpwerk of importwerk is |
| M3 | Welke apparaatkoppelingen bestaan er vandaag werkelijk (Strava, Garmin, Polar, Whoop, Oura)? Welke daarvan levert rusthartslag/HRV? | Strava levert deze doorgaans niet; zonder koppeling is het herstelblok leeg |
| M4 | Bestaat er ergens een **datacontrole** — wordt er gekeken of een rit hartslag bevat vóórdat een kaart getoond wordt? | Bepaalt of de datapoort nieuw gebouwd moet worden |
| M5 | Volledige inventarisatie van de kaarten in de Analyse-module op `main`: welke bestaan, welke data gebruiken ze | Nodig om te bepalen wat er ontbreekt t.o.v. de standaardset in §6 |
| M6 | Wordt CTL dagelijks herrekend of alleen bij nieuwe activiteit? Lever CTL-dagwaarden met 2 decimalen over 24-06 t/m 31-07 | De grafiek toont CTL als trapjes en ATL vloeiend; onduidelijk of dat weergave of rekenfout is |
| M7 | Wordt vorm (TSB) berekend op de dag zelf of op de waarden van gisteren? | Eén dag handmatig narekenen tegen de opgeslagen waarde |

**Rapportage:** één document terug met per punt het antwoord, de vindplaats en — waar het
antwoord "nee" is — een inschatting van de bouwtijd.

---

## 2. Bindende besluiten van 4 augustus 2026

| # | Besluit |
|---|---|
| B1 | Het volledige meetniveau (vermogen + hartslag) **vereist zowel powermeter als hartslagband**. Hartslag is niet optioneel |
| B2 | Het herstelblok heeft **twee lagen**: een subjectieve ochtendvraag die voor iedereen binnen Compleet werkt, en een gemeten laag (rusthartslag, HRV) die een draagbare 24/7 vereist |
| B2b | Er komt **later een aparte prijs voor het herstelniveau**. De herstellaag wordt daarom vanaf nu technisch apart houdbaar gebouwd — eigen rechtensleutel, eigen aan/uit, los van de kaarten van de sporen. Tot die prijs bestaat blijft Compleet de enige poort |
| B2c | `SPOOR_H` (alleen hartslag, geen vermogen) krijgt een **eigen kaartenset** en valt niet terug op `BASIS` |
| B3 | Het **abonnement bepaalt óf** de diepe analyse beschikbaar is (Compleet en Trainer, niet Go — besluit 01-08 blijft staan). De **apparatuur bepaalt hoe diep** hij binnen dat pakket gaat |
| B4 | Meetniveaus krijgen **geen zichtbare naam in de gebruikersomgeving**. Codes zijn intern |
| B5 | Vermogen en hartslag zijn **twee sporen, geen rangorde**. Alleen de combinatie en het herstelniveau zijn cumulatief |
| B6 | Onder elke grafiek in Analyse staat **één zin** die zegt wat er te zien is en wat de gebruiker ermee doet |

---

## 3. Het meetmodel

### 3.1 De sporen (interne codes, nooit zichtbaar)

| Code | Voorwaarde | Wat het ontsluit |
|---|---|---|
| `BASIS` | activiteit zonder sensoren | duur, afstand, hoogtemeters |
| `SPOOR_V` | powermeter | belasting, vorm, powercurve, zoneverdeling op vermogen |
| `SPOOR_H` | hartslagband | zoneverdeling op hartslag, interne belasting |
| `SPOOR_VH` | powermeter **én** hartslagband | alles hierboven + HR:Power-ontkoppeling, efficiëntie |
| `HERSTEL_S` | geen sensor nodig | subjectieve ochtendvraag, gescoord tegen de eigen geschiedenis |
| `HERSTEL_R` | draagbare 24/7 | rusthartslag, HRV, eigen basislijn, gemeten ochtendsignaal |

`HERSTEL_S` staat los van de sporen: hij werkt ook voor een gebruiker op `BASIS`, mits het
abonnement de diepe analyse toestaat.

### 3.1a Kaartenset voor `SPOOR_H`

Deze gebruiker krijgt een eigen set en niet een uitgeklede vermogensset:

- zoneverdeling op hartslag, per rit en per week
- interne belasting per rit (hartslaggebaseerd), en fitheid/vermoeidheid daarop gebouwd
- hartslagverloop binnen de rit
- **niet:** powercurve, ontkoppeling, efficiëntie, TSS/IF op vermogen

Aandachtspunt voor de bouw: de belastingsberekening moet dus in twee smaken bestaan
(vermogensgebaseerd en hartslaggebaseerd). Beide voeden dezelfde fitheid/vermoeidheidsgrafiek,
maar de waarden zijn **niet onderling uitwisselbaar** — een gebruiker die van hartslag naar
vermogen overstapt, krijgt een breuk in zijn reeks. Meld dat op de grafiek in plaats van de
reeksen stilzwijgend aan elkaar te plakken.

`SPOOR_V` en `SPOOR_H` staan **naast** elkaar. Een gebruiker met alleen een hartslagband is
geen "lager" geval dan een gebruiker met alleen vermogen; hij krijgt andere kaarten.

### 3.2 Bepaling: meten, niet vragen

Het meetniveau is een **waarneming, geen instelling**. Er komt geen vraag "heb je een
powermeter?" bij het instappen, en de gebruiker kan zijn niveau niet zelf kiezen.

Regel (voorstel, mag Replit met onderbouwing bijstellen):

- kijk naar de **laatste 10 activiteiten**
- staat er in **6 of meer** een vermogensstroom → `SPOOR_V` actief
- staat er in **6 of meer** een hartslagstroom → `SPOOR_H` actief
- beide → `SPOOR_VH`
- rusthartslag of HRV aanwezig op **minstens 3 van de laatste 7 dagen** → `HERSTEL_R` actief

Het niveau is dus **levend**: het zakt en stijgt mee met wat er binnenkomt.

- Valt een spoor weg, dan **één** melding — niet bij elke rit.
- Komt het terug, dan groeit het niveau stil weer mee, zonder melding.

---

## 4. Twee gescheiden poorten — de belangrijkste eis in dit document

Er komen twee onafhankelijke controles. **Ze mogen nooit dezelfde melding tonen en nooit
door elkaar lopen.**

| | Pakketpoort | Datapoort |
|---|---|---|
| Vraag | Heeft deze gebruiker Compleet of Trainer? | Levert zijn apparatuur deze gegevens? |
| Toon bij "nee" | wat het pakket toevoegt + pad naar upgraden | welke sensor ontbreekt + wat hij daarmee zou krijgen |
| Verboden | het woord "upgraden" gebruiken als het probleem een sensor is | "koppel een band" tonen als het probleem het pakket is |

**Foutgeval dat voorkomen moet worden:** een gebruiker met volledige sensorset op Compleet
krijgt "upgraden" te zien terwijl er niets te upgraden valt. Beide poorten worden apart
getest (zie §8).

---

## 5. Het herstelblok

### 5.1 Plaats

Boven de bestaande vormgrafiek, niet ernaast. De gemeten reactie van het lichaam staat
bovenaan; de berekende belasting (CTL/ATL/TSB) blijft eronder voor wie het model wil zien.

### 5.2 Rekenregels

- **Nooit een absoluut getal als kernboodschap.** Zowel rusthartslag als HRV zijn tussen
  personen onvergelijkbaar. HRV (RMSSD) varieert tussen personen ruwweg tussen 10 en 300 ms;
  een waarde van 60 zegt zonder eigen basislijn niets.
- **Basislijn:** voortschrijdend gemiddelde over 7 dagen, opgebouwd uit minimaal 3 metingen
  per week. Minder metingen → geen uitspraak, en dat wordt gezegd.
- **De basislijn schuift mee met de seizoensfase.** Er komen geen vaste drempelwaarden in de
  code. Referentie uit de praktijk: dezelfde renner had in vorm een rustpols van 40-42 en in
  de winteropbouw 46-50 — 47 is dus in november normaal en in juni een alarm.
- **Dagelijkse schommeling van 10-20% is normaal** en leidt niet tot een melding.

### 5.3 Drie banden

| Band | Situatie | Boodschap |
|---|---|---|
| Binnen basislijn | normale spreiding | geen melding; de training van vandaag blijft staan |
| Verhoogd na belasting | enkele slagen boven basislijn, na zware training(en) | herstelvertraging; voorstel een actieve hersteldag |
| Aanhoudend afwijkend | meerdere dagen ver boven basislijn, vaak met onderdrukte HRV | **geen trainingsadvies maar een gezondheidssignaal** — dit gaat niet over training |

De derde band gedraagt zich anders dan de andere twee: geen aanpassing van het plan, maar
een aparte, terughoudend geformuleerde melding.

### 5.4 De subjectieve laag (`HERSTEL_S`) — werkt zonder enige sensor

Elke ochtend één vraag van drie tikken: hoe voel je je vandaag? Geen vragenlijst.

- De score wordt **nooit absoluut** geduid, maar tegen de eigen geschiedenis van de
  gebruiker: onder, rond of boven zijn eigen gemiddelde. Zelfde rekenwijze als §5.2.
- Minimaal 3 antwoorden per week, anders geen uitspraak.
- Onderbouwing: zelfgerapporteerde maten reageren aantoonbaar gevoelig en consistent op
  trainingsbelasting, mits omgerekend naar de eigen basislijn. Dit is dus geen zwakke
  vervanging van de gemeten laag maar een zelfstandig signaal.
- **Beperking die in de code moet zitten:** op de subjectieve laag alleen mag Sparki de
  gezondheidsband uit §5.3 **niet** afgeven. Slecht voelen zonder meetwaarde is geen
  gezondheidssignaal.

### 5.5 Waar de twee lagen samenkomen

Heeft een gebruiker beide, dan is niet elk signaal apart het interessantste maar juist het
**verschil** tussen de twee:

| Gevoel | Meting | Boodschap |
|---|---|---|
| goed | afwijkend | let op — dit is het signaal waar een renner overheen traint |
| slecht | normaal | meestal geen vermoeidheid; gewoon starten en na 20 minuten opnieuw beoordelen |
| slecht | afwijkend | duidelijk herstel nodig; pas de dag aan |
| goed | normaal | geen melding |

Dit onderscheid is wat noch Strava, noch TrainingPeaks, noch een horloge-app geeft, en is de
kern van de herstellaag. Bouw het als een expliciete regel, niet als bijproduct.

### 5.6 De vraag bij een afwijking

Bij een echte afwijking stelt Sparki **één** vraag: slecht geslapen, laat getraind, alcohol,
ziek voelen, drukke week? Het antwoord wordt bewaard en gebruikt om de uitleg de volgende
keer scherper te maken en de sporter zijn eigen patroon te laten zien.

Onderbouwing: HRV alleen is te weinig specifiek om te duiden; aanvullende informatie zoals
rusthartslag en zelfrapportage is nodig om er een uitspraak op te baseren.

### 5.5 Wat er uitdrukkelijk **niet** komt

- geen vergelijking met andere gebruikers, geen ranglijst, geen "normaalwaarde voor jouw
  leeftijd"
- geen vaste HRV- of rustpolsdrempels
- geen dagelijkse melding bij normale schommeling

---

## 6. De uitleglaag

Elke kaart in Analyse krijgt dezelfde opbouw:

1. **de grafiek** (mag overgenomen worden van wat gangbaar is: powercurve met vergelijking
   tussen periodes, zoneverdeling per rit en per week, herkende intervallen met tabel,
   ontkoppeling en efficiëntie, TSS/IF per rit)
2. **één zin** die zegt wat er te zien is, in de tweede persoon, zonder jargon
3. **één zin** die zegt wat de gebruiker ermee doet
4. optioneel een uitklap met de rekenwijze, voor wie het wil weten

Concreet voorbeeld voor de bestaande vormgrafiek (vervangt de huidige legenda-uitleg):

> Groen betekent uitgerust, rood dat je nog werk van de afgelopen dagen meedraagt. Rood
> hoort bij een trainingsblok, groen hoort bij de dagen vóór een wedstrijd. Let op: groen
> zonder training ervoor is geen vorm — dan zakt je fitheid mee.

Die laatste zin is verplicht wanneer er in de betreffende periode weinig activiteiten zijn.

### 6.1 Weinig data

Wanneer een kaart op te weinig gegevens rust, wordt hij **niet** getoond alsof hij klopt.
Toon de kaart met een zichtbare markering en de reden ("te weinig ritten in deze periode om
hier iets over te zeggen"). Niet stilzwijgend verbergen — dat is precies wat concurrenten
doen en waar gebruikers op vastlopen.

---

## 7. Profielregel

In het profiel staat één regel over wat Sparki van deze gebruiker ziet, met wat ontbreekt
erbij. Vorm:

> Sparki ziet van jou vermogen en hartslag per rit. Nog niet: je herstel — daarvoor is een
> horloge of ring nodig die je 's nachts draagt.

Geen niveaunaam, geen rang, geen kleurcode. Wat je mist staat er altijd bij, en waarom.

---

## 8. Acceptatietests

| # | Test | Verwacht |
|---|---|---|
| T1 | Compleet-gebruiker met vermogen én hartslag | alle `SPOOR_VH`-kaarten zichtbaar, geen enkele upgrademelding |
| T2 | Compleet-gebruiker met alleen vermogen | vermogenskaarten zichtbaar, ontkoppeling/efficiëntie tonen de **datamelding** (sensor), nooit het woord upgraden |
| T3 | Go-gebruiker met volledige sensorset | diepe analyse afwezig, **pakketmelding**, nooit "koppel een band" |
| T4 | Gebruiker levert 3 weken geen hartslag meer | precies één melding, niveau zakt zichtbaar, daarna stil |
| T5 | Herstelblok met 2 metingen in 7 dagen | geen uitspraak, expliciete melding dat er te weinig metingen zijn |
| T6 | Herstelblok, waarde 3 dagen ver boven basislijn | gezondheidsmelding, géén aangepast trainingsvoorstel |
| T7 | Vormgrafiek over een periode met 1 activiteit | waarschuwende zin over groen zonder training staat er |
| T8 | Gebruiker zonder enige sensor, abonnement Compleet | ochtendvraag beschikbaar, subjectieve basislijn wordt opgebouwd |
| T9 | Subjectieve laag alleen, 5 dagen slechte scores | herstelboodschap ja, **gezondheidsband nee** |
| T10 | Gebruiker met alleen hartslagband | eigen kaartenset zichtbaar, geen lege vermogenskaarten, geen melding dat hij iets "mist" behalve in de profielregel |
| T11 | Gevoel goed + meting afwijkend | het verschilbericht uit §5.5 verschijnt |

---

## 9. Beslist op 4 augustus 2026

1. De losse ochtendvraag komt er **wel**, ook zonder draagbare → `HERSTEL_S`, §5.4.
2. `SPOOR_H` krijgt een **eigen kaartenset** → §3.1a.
3. Er komt **later een aparte prijs voor het herstelniveau**. De laag wordt daarom nu al met
   een eigen rechtensleutel gebouwd, zodat hij later los verkocht kan worden zonder
   verbouwing → B2b.

### Wat hierdoor nieuw open staat

- Hoe krijgt Sparki de sporter zover dat hij die ochtendvraag daadwerkelijk dagelijks
  beantwoordt? Zonder reeks van minstens 3 per week is er geen basislijn en werkt de hele
  laag niet. Herinnering, plek in de app en moment van de dag zijn nog niet bepaald.
- Wat gebeurt er met de fitheidsreeks van een gebruiker die van `SPOOR_H` naar `SPOOR_V`
  overstapt? Voorstel staat in §3.1a (breuk tonen), moet nog bevestigd.

---

## 10. Volgorde

1. §1 meetopdracht uitvoeren en rapporteren — **blokkerend**
2. §3 meetniveaubepaling bouwen (waarneming uit activiteiten)
3. §4 twee poorten scheiden, inclusief de twee meldingsvormen
4. §6 uitleglaag op de bestaande kaarten (goedkoopste winst, kan parallel)
5. §5 herstelblok — alleen na een bevestigend antwoord op M2 en M3
