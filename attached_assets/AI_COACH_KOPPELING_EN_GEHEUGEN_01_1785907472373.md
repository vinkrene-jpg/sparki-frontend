# AI_COACH_KOPPELING_EN_GEHEUGEN_01

**Werkdocument — Sparki**
Datum: 5 augustus 2026
Gemeten op: `e15645a` (eigen kloon van de repo, statische meting)
Leest samen met: `MEETNIVEAU_EN_UITLEG_01`, `AI_INTELLIGENCE_ENGINE_02`

---

## 0. Waarom dit document er is

Twee dingen tegelijk:

1. **Vier koppelgaten in de AI-coach.** De coachlaag is goed gebouwd, maar krijgt
   een deel van de data die Sparki zelf berekent niet te zien, en legt van geen enkel
   advies vast waarop het gebaseerd was.
2. **Het geheugen moet naar een hoger niveau.** Eis van René: de gebruiker moet het
   geheugen herkennen, het moet terugleesbaar zijn, en de coach moet er later uit
   zichzelf op terugkomen. Geen mens nabouwen — wel een coach die onthoudt.

---

## 1. Meetresultaat — wat er vandaag staat

Vastgesteld in de code, met vindplaats. Dit is geen kritiek op wat er is; het is
het vertrekpunt.

**Goed en blijft zoals het is:**

| Onderdeel | Vindplaats | Oordeel |
|---|---|---|
| Centrale AI-gateway (doelenregister, kill switch, toestemming per aanroep fail-closed, jeugdgrens, redactie, metadata-logging) | `lib/ai/gateway.ts` (900 r.) | dekkend |
| Foundation-keten van 7 stappen, dirigent zonder eigen intelligentie | `engines/ai-foundation/orchestrator.ts` | conform AIE |
| Coachinstructie: meerdere signalen wegen, oorzaken rangschikken, bij twijfel vragen stellen, feit/observatie/hypothese scheiden, tegenstrijdigheden benoemen, geen zekerheidstaal | `lib/athlete-context.ts` (`SPARKI_SYSTEM`) | sterk |
| Doelen mét voortgang in de context | `goalsContextLine` via `lib/goals.ts` | werkt |
| Kennisbank met verbod op verzonnen bronnen | `gatherKnowledge` | werkt |
| Geheugenlaag: observaties met bron, categorie, vervaldatum, ontdubbeling, afkoelperiode na wegklikken | `lib/ai-memory.ts` (432 r.), `ai_observations` | goede basis |

**Wat de coach vandaag als context krijgt:** FTP/W-kg/gewicht/discipline ·
langetermijndoel · actieve doelen met voortgang · motivatie · weekuren · gezondheid
en blessurehistorie · geplande training van vandaag · check-in van vandaag (HRV,
rusthartslag, slaap, slaapkwaliteit, vermoeidheid, gevoel, notities) · 10 recente
sessies (NP, gem. vermogen, gem. HR, TSS, gevoel) · trends HRV/rusthartslag/slaap ·
FTP-historie · voedingslogs.

---

## 2. De vier gaten

| # | Bevinding | Vindplaats | Gevolg |
|---|---|---|---|
| G1 | **CTL/ATL/TSB zitten niet in de coachcontext.** De woorden staan alleen in de systeeminstructie; de waarden gaan niet mee | `lib/athlete-context.ts` — geen enkele verwijzing naar `computeLoadSeries` | De coach schat vorm uit losse TSS-getallen. Zijn oordeel kan de vormgrafiek in Analyse tegenspreken — dezelfde app, twee antwoorden |
| G2 | **De diepe analyse bereikt de coach niet.** Per rit gaan alleen NP, gem. vermogen, gem. HR en TSS mee | powercurve (`powerBests`, `routes/athlete.ts`), weekzones (`/weekly-zones`), streamanalyses (`artifacts/sparki/src/lib/stream-analysis.ts`) | De rijkste laag die er ligt wordt niet gelezen. De coach kan niets zeggen over zoneverdeling, intervaluitvoering of hartslagdrift |
| G3 | **Het adviesdossier wordt nergens aangemaakt.** `createAdviceDossier()` heeft buiten de test geen enkele aanroeper | `lib/advice-dossier.ts`, alleen aangeroepen in `tests/advice-dossier.ts` | Besluit B7 van 01-08 ("bij elk advies altijd kunnen tonen waarop het gebaseerd is") staat feitelijk uit. Dit blokkeert ook de terugleesbaarheid van het geheugen (§4.3) |
| G4 | **Het meetniveau is niet bekend bij de coach.** `observeSporen` wordt in de AI-laag niet gebruikt | `engines/meetniveau/`, `lib/athlete-context.ts` | De coach kan adviseren op data die de sporter niet meet, of zwijgen over wat hij wél heeft |

---

## 3. Reparaties

### R1 — Vorm en belasting in de coachcontext

Voeg aan de context toe, uit dezelfde bron als de grafiek (`computeLoadSeries` —
**geen tweede berekening**):

- CTL, ATL en TSB van vandaag
- de richting over 7 en 28 dagen (stijgend/vlak/dalend)
- het aantal dagen met belasting in de getoonde periode

Regel: **wat in Analyse staat en wat de coach zegt, komt uit hetzelfde getal.**
Wijken ze af, dan is dat een fout, geen interpretatieverschil.

### R2 — De diepe analyse naar de coach

Voeg per recente rit toe wat er al ligt: zoneverdeling, herkende intervallen met de
vergelijking tegen het geplande blok, hartslagdrift en vermogensverval. Plus, op
atleetniveau, de powercurve van dit blok tegen het vorige.

**Let op:** een deel van deze analyses staat nu aan de clientkant
(`artifacts/sparki/src/lib/stream-analysis.ts`) terwijl de streams server-side zijn
opgeslagen. Verplaats de rekenfuncties naar een gedeelde plek of de serverkant —
**niet opnieuw implementeren**, dat levert twee waarheden op.

Grens: de context blijft samenvattend. Geen ruwe reeksen naar het model, alleen de
uitkomsten.

### R3 — Het adviesdossier daadwerkelijk aanmaken

Elk advies uit `/brief`, `/ask`, `workout-explain(-extended)` en `workout-adjust`
maakt een dossier aan. Zonder dossier geen advies tonen — de al gebouwde
`DossierIncompleteError` is daarvoor bedoeld. Bestaande adviezen blijven
`LEGACY_NIET_VOLLEDIG_HERLEIDBAAR` en worden eerlijk gemarkeerd, conform het besluit
van 01-08.

In het dossier hoort minimaal: de gebruikte datapunten met hun datum, de gebruikte
herinneringen (§4), het meetniveau op dat moment, en waarom het alternatief niet is
gekozen.

### R4 — Meetniveau in de context

Eén regel: welke sporen deze sporter heeft (`BASIS`, `SPOOR_V`, `SPOOR_H`,
`SPOOR_VH`, `HERSTEL_S`, `HERSTEL_R`) en wat daarmee ontbreekt. Met de instructie:
adviseer nooit op een grootheid die deze sporter niet meet, en benoem één keer wat
een ontbrekende sensor zou toevoegen — nooit als verkooppraatje.

---

## 4. Het geheugen

### 4.0 Wat er al is en blijft

`lib/ai-memory.ts` met `ai_observations`: bron, categorie, status, vervaldatum,
ontdubbeling op sleutel én op strekking, afkoelperiode na wegklikken, en een poort
die observaties op achterhaalde FTP-waarden tegenhoudt. Dat is een goede basis en
wordt niet vervangen.

Het paneel "Sparki Geheugen" bestaat (`components/sparki/ai-memory-panel.tsx`) maar
staat op de Lab-pagina, en de verbanden (`engines/memory-graph/correlations.ts`)
komen pas als de gebruiker op "Verbanden zoeken" drukt.

### 4.1 Bevestigd geheugen — de kern van de herkenbaarheid

Sparki legt een conclusie vóór in plaats van hem stil op te slaan:

> "Ik zie dat je slecht herstelt van drie harde dagen op rij. Klopt dat?"

- **Klopt** → de herinnering wordt `bevestigd` en weegt zwaarder in elk advies
- **Klopt niet** → de herinnering verdwijnt én de correctie wordt zelf onthouden,
  zodat dezelfde conclusie niet over drie weken terugkomt
- **Weet niet** → blijft `voorlopig`, wordt niet gebruikt voor een directief advies
  maar wel voor een vraag

Nieuwe statussen naast de bestaande: `voorlopig` · `bevestigd` · `weerlegd`.
Alleen `bevestigd` mag een advies dragen; `voorlopig` mag alleen een vraag dragen.

**Tempo:** maximaal één bevestigingsvraag per dag en nooit tegelijk met de
ochtendvraag uit `MEETNIVEAU_EN_UITLEG_01` §5.4a.

### 4.2 Proactief = de situatie herkent zichzelf

Een herinnering hoort af te gaan wanneer vandaag lijkt op toen — niet wanneer
iemand op een knop drukt. Bouw een triggerlaag die bij het samenstellen van de
dagelijkse context kijkt of de huidige situatie overeenkomt met de voorwaarde van
een bevestigde herinnering.

Starttriggers (uit te breiden met de lijst van René, §8):

- derde opeenvolgende dag met belasting boven het gemiddelde
- eerste wedstrijd na een trainingsblok
- dezelfde kalenderweek als een eerder ingezakte periode
- eerste rit boven 28 graden dit seizoen
- rusthartslag of gevoel wijkt af zoals bij een eerder herkend patroon
- terugkeer na meer dan 10 dagen zonder activiteit

Bij een treffer opent de coach ermee, met de herinnering zichtbaar:
*"Vorig jaar rond deze tijd zakte je na zo'n blok in. Zullen we dag drie lichter
maken?"*

### 4.3 Terugleesbaar — bij het advies, niet alleen op een pagina

Onder elk advies staat waarop het gebaseerd is, met de gebruikte herinneringen als
aanklikbare regels naar het dossier uit R3. Daar staat per herinnering: wanneer
ontstaan, uit welke rit of welk antwoord, en wanneer bevestigd.

Daarnaast verhuist het geheugenpaneel van Lab naar een plek in de gewone route —
voorstel: onder het profiel, met filters op categorie en status, en per regel de
mogelijkheid om te corrigeren of te verwijderen.

### 4.4 Vergeten is een functie

- een herinnering ouder dan één seizoen en nooit bevestigd, zakt terug naar
  `voorlopig` en wordt **één keer** opnieuw voorgelegd
- daarna vervalt hij stil
- een weerlegde herinnering komt nooit automatisch terug
- verwijdert de sporter een herinnering, dan verdwijnt hij ook uit lopende adviezen
  (niet uit afgesloten dossiers — die blijven als historie staan)

### 4.5 Wat níét onthouden wordt

- losse stemmingen en eenmalige klachten zonder patroon
- alles wat onder de bestaande privacypoort valt: staat `ai_memory` uit, dan wordt
  er niets bewaard behalve systeemrijen (dit werkt al zo)
- conclusies over gezondheid als vaststelling — die blijven observatie met
  doorverwijzing, conform het besluit van 01-08

---

## 5. Acceptatietests

| # | Test | Verwacht |
|---|---|---|
| A1 | Vorm in Analyse en het oordeel van de coach op dezelfde dag | zelfde CTL/ATL/TSB, geen tegenspraak |
| A2 | Rit met zoneverdeling en herkende intervallen | de coach kan er inhoudelijk naar verwijzen |
| A3 | Advies opvragen | dossier aangemaakt; zonder dossier verschijnt geen advies |
| A4 | Sporter zonder vermogensmeter | de coach adviseert niet op vermogensgrootheden en noemt het ontbreken hoogstens één keer |
| A5 | Voorgelegde conclusie met "klopt niet" beantwoord | herinnering verdwijnt, correctie opgeslagen, conclusie komt niet binnen 90 dagen terug |
| A6 | Trigger vuurt (derde harde dag op rij) | de coach opent met de herinnering, met bronregel |
| A7 | Herinnering ouder dan een seizoen, nooit bevestigd | precies één keer opnieuw voorgelegd, daarna stil vervallen |
| A8 | `ai_memory` uitgezet | geen enkele nieuwe herinnering opgeslagen |
| A9 | Bevestigingsvraag en ochtendvraag op dezelfde dag | nooit tegelijk getoond |

---

## 6. Volgorde

1. **R3 adviesdossier** — eerst, want R1, R2 en §4.3 hangen er allemaal aan
2. **R1 vorm in de context** — kleinste ingreep, grootste correctie
3. **R4 meetniveau in de context** — één regel, voorkomt onzinadvies
4. **§4.1 bevestigd geheugen** — statussen en de vraagstroom
5. **R2 diepe analyse naar de coach** — inclusief het verplaatsen van de
   rekenfuncties naar een gedeelde plek
6. **§4.2 triggerlaag** — pas nadat de lijst uit §8 binnen is
7. **§4.3 verhuizing van het geheugenpaneel**

---

## 7. Wat er níét gebouwd wordt

- geen tweede geheugenstructuur naast `ai_observations`
- geen tweede berekening van belasting, vorm of zones
- geen vrij pratende coach die zich alles "herinnert" zonder bron
- geen herinnering die een advies draagt voordat de sporter hem bevestigd heeft

---

## 8. Openstaand bij René

De triggerlijst van §4.2. Welke terugkerende patronen zou een app hebben moeten
onthouden — bij hemzelf als renner en bij de renners om hem heen? Die lijst bepaalt
wanneer het geheugen afgaat, en dat is het verschil tussen een geheugen dat indruk
maakt en een geheugen dat alleen maar volloopt.
