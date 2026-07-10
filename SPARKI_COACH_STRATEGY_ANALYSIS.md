# Strategische herontwerpanalyse — Sparki voor professionele trainers

**Status:** analyse (geen code gewijzigd). Opgesteld op verzoek: "stop tijdelijk met losse
coachfunctionaliteiten; bepaal eerst of Sparki écht onderscheidend is t.o.v. TrainingPeaks."

**Centrale ontwerpvraag:**
> *"Waarom zou een professionele trainer iedere dag éérst Sparki openen, vóórdat hij TrainingPeaks opent?"*

---

## 0. Eerlijkheidsvoorbehoud (lees dit eerst)

Deze analyse combineert twee soorten kennis en houdt ze bewust gescheiden:

1. **Feitelijk (verifieerbaar):** wat Sparki vandaag daadwerkelijk doet — afgeleid uit de
   codebase (rollen, `coach-home.tsx`, `coach.ts`, `coach_athlete_links`, `privacy_settings`,
   plan-adoptie). Dit staat in §3 en is nagelopen, niet aangenomen.
2. **Hypothese (nog te valideren):** de pijnpunten van trainers en de waarde-inschatting in
   §1 en §2. Dit is gebaseerd op algemeen bekende eigenschappen van TrainingPeaks en op
   redenering — **niet** op eigen marktonderzoek onder jouw doelgroep.

De pijnpunten hieronder zijn dus *onderbouwde aannames*, geen gemeten data. §6 bevat een
concrete validatielijst om ze te toetsen bij echte coaches vóór er architectuurkeuzes op
worden vastgezet. Dit past bij de kernregel van Sparki: niets verzinnen; onzekerheid
benoemen.

---

## 1. Fase 1 — Markt- en productanalyse

### 1A. Welke problemen lost TrainingPeaks uitstekend op?

TrainingPeaks is de **operationele ruggengraat** van de gestructureerde uithoudingssport.
Het is volwassen, betrouwbaar en de hele sport spreekt de "TP-taal". Sterk in:

- **Multi-atleetbeheer** — kalenderoverzicht over veel atleten tegelijk, compliance-tracking
  (gepland vs. uitgevoerd).
- **Workout builder + gestructureerde workouts** — intervallen ontwerpen en pushen naar
  Garmin/Wahoo/Zwift, zodat de atleet ze op het apparaat volgt.
- **Templates & periodisering** — Annual Training Plan (ATP), herbruikbare blokken,
  seizoensopbouw.
- **Analyse** — PMC (CTL/ATL/TSB), TSS-historie, en via WKO5 zeer diepe
  vermogensanalyse (power-duration, FTP-modellering).
- **Device- en platform-integraties** — het de-facto knooppunt waar data samenkomt.
- **Communicatie op workout-niveau** — comments per training.

**Conclusie:** TP is uitstekend als *systeem van registratie en uitvoering*. Dit kopiëren
levert geen concurrentievoordeel op — het is jaren werk in een verzadigde, volwassen markt.

### 1B. Welke problemen ervaren trainers ondanks TrainingPeaks nóg dagelijks?

*(hypothese — te valideren, zie §6)*

- **TP registreert; het oordeelt niet.** Het toont grafieken, maar zegt niet "wat betekent
  dit voor *deze* atleet vandaag?". Alle interpretatie moet de coach zelf doen.
- **Het is reactief, niet proactief.** TP wacht tot de coach kijkt. Het tikt de coach niet
  op de schouder: "atleet X sliep 3 nachten slecht, TSB keldert, wedstrijd over 5 dagen —
  kijk hiernaar."
- **Schaal dwingt triage af.** Een coach met 20–40 atleten kán niet iedereen elke dag diep
  bekijken. Door tijdgebrek worden signalen simpelweg gemist.
- **Context ontbreekt volledig.** TP weet niets van examens, werkdruk, ziekte in het gezin,
  mentale toestand, voeding of materiaal — terwijl dáár vaak de verklaring van een slechte
  week ligt.
- **Handmatig herplannen.** Ziek of oververmoeid? De coach schuift het plan met de hand om.
  TP helpt daar niet bij.
- **Geen jeugd-/ouderdimensie.** TP is gebouwd voor prestatiemaximalisatie bij volwassenen,
  niet voor ontwikkelingsgerichte jeugdbegeleiding met ouderbetrokkenheid en RED-S-veiligheid.

### 1C. Welk werk gebeurt nog BUITEN TrainingPeaks?

Dit is de kern van de kans. Het *waardevolste* werk van een coach leeft grotendeels buiten TP:

- **WhatsApp / berichten** — "hoe voel je je?", ziekmeldingen, motivatie, snelle vragen,
  foto's van eten of materiaal.
- **Het hoofd van de coach** — "deze atleet stort altijd in tijdens tentamens." Waardevolle
  kennis die nergens is vastgelegd en verloren gaat bij overdracht.
- **Excel / losse notities** — testresultaten, materiaalinfo, seizoensdoelen, aantekeningen.
- **Gesprekken** — telefonisch/persoonlijk overleg, ouderoverleg.
- **Interpretatiewerk** — de coach die 's avonds handmatig data zit te duiden.
- **Losse documenten** — wedstrijdreglementen, routes, voedingsschema's.

> **Kernobservatie:** TrainingPeaks bezit de *data*. De *intelligentie en context* — verzamelen,
> combineren, interpreteren, onthouden, de relatie onderhouden — zitten in het hoofd van de
> coach en in versnipperde kanalen. Daar is geen systeem voor. Daar kan Sparki wél winnen.

---

## 2. De differentiatiethese

**Sparki moet niet de registratie-/uitvoeringslaag van TP overnemen, maar de intelligentie-
en contextlaag zijn die TP structureel mist.**

Concreet: Sparki is de **proactieve co-coach** die élke ochtend — vóór de coach — alle atleten
al heeft doorgenomen, context uit alle bronnen heeft gecombineerd (training + slaap + leven +
mentaal + voeding + wedstrijdkalender), conclusies heeft getrokken, en de coach een
**geprioriteerde caseload-briefing** geeft: "wat vraagt vandaag jouw aandacht, en waarom."

Het sterke punt: **dit is precies wat Sparki's architectuur al doet — maar voor de atleet.**
De observation-engine, context-memory, day-type/readiness en honest-reasoning bestaan al. Ze
zijn alleen nog niet doorgetrokken naar de coach als *primaire* gebruiker.

---

## 3. Waar staat Sparki vandaag écht? (feitelijk)

Nagelopen in de codebase — geen inschatting:

| Coachcapaciteit | Status vandaag |
|---|---|
| Meerdere atleten beheren (roster + readiness/gezondheid) | **Echt** (`coach-home.tsx`, `GET /api/coach/athletes`) |
| Advies-plan bekijken + overnemen ("Overnemen") | **Echt** (`coach-athlete-plan.tsx`, `POST …/plan/adopt`) |
| Context-memories per atleet (het "waarom") | **Echt** (`…/athletes/:id/context`) |
| Uitnodigen + koppelen (token) | **Echt** (`invitations.tsx`, `coach_athlete_links`) |
| Privacy-/consent-gestuurde zichtbaarheid (none/summary/full) | **Echt** (`privacy_settings`) |
| Workout builder (intervallen ontwerpen) | **Afwezig** |
| Periodisering / ATP | **Afwezig** |
| Templates | **Afwezig** |
| Directe communicatie / chat met atleet | **Dun** (alleen geautomatiseerde `coach_update`-meldingen) |
| Diepe analyse (PMC/CTL/ATL/TSB-grafieken) | **Dun** (readiness + basis-historie) |
| Kalender | **Dun** (lijst van 7 dagen; geen maandgrid/drag-drop) |

**Eerlijke samenvatting:** Sparki is vandaag ~90% atleet-first. De coach is een
**"audit-and-approve"-supervisor**, geen operationele werkbank. Beoordeeld als
coach-operatietool is Sparki nu **niet** onderscheidend genoeg — maar de ontbrekende stukken
zijn precies de TP-kloonstukken die we juist *niet* moeten bouwen.

---

## 4. Het antwoord op de centrale vraag

> *"Waarom opent de coach éérst Sparki?"*

**Omdat Sparki hem in 2 minuten vertelt wat TrainingPeaks hem in 45 minuten handmatig zou
laten uitzoeken — en signalen ziet die hij door tijdgebrek zou missen.**

Analogie: TP is het patiëntendossier; Sparki is de assistent die 's ochtends de nacht heeft
doorgenomen en zegt: "deze 3 atleten moet je nú zien, en dit is waarom." De coach opent Sparki
eerst omdat het zijn **triage- en oordeelslaag** is; TP blijft daarna open als het
**uitvoeringsdossier**.

*Vandaag* kan Sparki dit antwoord nog niet waarmaken voor de coach (§3). De belofte is
architectonisch dichtbij, maar de coach is nog geen first-class consument van de intelligentie.

---

## 5. Architecturale implicatie — twee richtingen

**Richting A — Coach-CRM bouwen (afgeraden).**
Workout builder, kalendergrid, periodisering, templates. = TrainingPeaks-kloon. Jaren werk,
inhalen van een volwassen product, geen verdedigbaar voordeel. Dit is precies wat de opdracht
uitsluit.

**Richting B — "Coach Intelligence Layer" + interoperabiliteit (aanbevolen).**

1. **Promoveer de coach tot first-class gebruiker van de bestaande intelligentie.**
   Kernproduct = de **dagelijkse geprioriteerde caseload-briefing**: "Sparki heeft je 24
   atleten doorgenomen; 3 vragen vandaag aandacht — hier is waarom en wat je kunt doen."
   Dit hergebruikt de observation-/readiness-/context-engines die al bestaan.
2. **Maak context-aggregatie tot kernproduct.** Vang het werk dat nu in WhatsApp, het
   geheugen van de coach en losse notities leeft (honest, privacy-gated), zodat coach-kennis
   niet verloren gaat en Sparki's oordeel rijker wordt dan wat TP ooit kan zien.
3. **Interopereer i.p.v. concurreren.** Lees/schrijf met TrainingPeaks (en/of Garmin/Strava).
   De coach hoeft TP niet op te geven voor uitvoering; Sparki levert het oordeel eroverheen.
   Dat verlaagt de drempel drastisch — geen "of/of", maar "Sparki eerst, TP daarna".
4. **Buit de structureel verdedigbare hoeken uit.** Context-memory, honest reasoning en de
   jeugd-/ouder-/RED-S-dimensie zijn dingen die TP níet heeft en niet makkelijk namaakt.

---

## 6. Wat eerst te valideren (vóór bouwen)

De pijnpunten in §1B/§1C zijn hypotheses. Toets ze bij 5–10 echte doelgroep-coaches:

- Hoeveel atleten begeleiden ze, en hoeveel tijd kost de dagelijkse "doorloop" in TP nu?
- Welk deel van hun werk gebeurt buiten TP (WhatsApp/Excel/geheugen)? Vraag om voorbeelden.
- Zouden ze een ochtendbriefing die hun caseload prioriteert écht eerst openen? Waarom (niet)?
- Is "TP houden voor uitvoering + Sparki voor oordeel" acceptabel, of willen ze één systeem?
- Betalen ze bovenop hun TP-abonnement voor een oordeels-/contextlaag?

Als deze aannames standhouden → Richting B. Zo niet → herijk de these vóór verdere bouw.

---

## 7. Verdict

- **Is Sparki nu onderscheidend genoeg voor professionele trainers?**
  Nog niet — beoordeeld als coach-operatietool (§3).
- **Moet de architectuur worden aangepast vóór verdere coachfunctionaliteit?**
  **Ja** — maar het is een *positionerings- en laagkeuze*, geen herbouw: promoveer de coach
  tot first-class consument van de bestáánde atleet-intelligentie, bouw de contextlaag, en
  interopereer met TP i.p.v. te klonen.
- **Concrete eerste stap:** stop met losse coachfeatures; definieer en prototype de
  **"Coach Daily Briefing"** als het kernproduct dat de centrale vraag beantwoordt — en
  valideer de §6-aannames parallel bij echte coaches.
