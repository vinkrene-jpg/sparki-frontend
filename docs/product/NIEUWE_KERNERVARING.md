# Sparki — Ontwerp: de nieuwe kernervaring voor de renner

Datum: 12 juli 2026. **Ontwerpdocument — er is geen productcode gewijzigd.** Gebouwd op de audit (`FEATURE_INVENTORY.md`, `RIDER_CORE_JOURNEY.md`, `DYLAN_VALUE_GAPS.md`, `FEATURE_CONSOLIDATION_MATRIX.md`) en de strategie (`SPARKI-STRATEGIE.md`). De waarde-eenheid uit de strategie is leidend:

> *"Een betrouwbare persoonlijke trainingsbeslissing die de renner zonder Sparki niet, later of minder goed had kunnen nemen."*

De vier ontwerpopdrachten:

1. **Vandaag als momentgestuurde coach** — niet per dag maar per moment binnen de dag.
2. **Eén vloeiende keten:** rit → analyse → betekenis → schemagevolg.
3. **Eén ontwikkelbestemming.**
4. **Adaptieve inhoudsdiepte** (o.a. voor Dylan).

---

## 1. Het centrale ontwerpprincipe: het Moment

De audit toonde (kernreis stap 2, Dylan-vraag 3): de huidige home kiest een **dagbeeld per dag** — maar de drie strategische rennersvragen zijn **momentvragen**:

| Strategische vraag | Moment |
|---|---|
| "Wat betekende deze training werkelijk?" | **NA** — vlak na een binnengekomen rit |
| "Wat is vandaag verstandig?" | **VOOR** — vóór de training van vandaag |
| "Word ik aantoonbaar beter?" | **PERIODIEK** — rustdag/avond/weekwissel |

**Ontwerpbesluit:** Vandaag krijgt bovenaan één **Momentblok** dat per app-open de relevantste van deze drie vragen beantwoordt. Al het andere (check-in, nudges, leskaart, weer) staat eronder of verschijnt contextueel. **Inzicht vóór invoer** wordt een harde wet: een invoerverzoek mag nooit het eerste blok zijn (lost Dylan-gat #2 op: check-in stond regelmatig bovenaan).

### De zes momenttypen

| Moment | Trigger (bestaande data, geen nieuwe bron nodig) | Leidende vraag |
|---|---|---|
| **NA-RIT** | rit gesynchroniseerd/geïmporteerd sinds vorige app-open, analyse gereed | "Wat betekende dit?" |
| **RIT-BINNEN** | rit binnen, analyse nog bezig | eerlijke tussenstand ("Je rit is binnen, de analyse volgt") |
| **VOOR-TRAINING** | geplande training vandaag, nog niet gereden | "Wat is vandaag verstandig?" |
| **RACEDAG** | race vandaag (bestaande racedag-detectie) | "Zo sta je ervoor; dit is je plan" |
| **HERSTEL/RUST** | rustdag of gezondheidssignaal | "Waarom rust nu winst is" |
| **BALANS** | geen training/rit vandaag, of avond na afgeronde dag | "Word je beter? Dit veranderde deze week" |

Het bestaande dag-type-mechanisme (`day-homes/`, precedentie §4 in memory) blijft de ruggengraat; het Momentblok is een **verfijning bovenop** het dagtype: binnen een trainingsdag wisselt het blok van VOOR-TRAINING naar RIT-BINNEN naar NA-RIT zodra de data dat draagt. Eerlijkheidscontract blijft: geen data → geen gefabriceerd moment, dan valt het blok terug op BALANS met een eerlijke lege staat.

### Zichtbare synchronisatiestatus (vertrouwensmoment)

Kernreis stap 4 vond: geen zichtbare "laatste sync". Het Momentblok krijgt een vaste, kleine statusregel: *"Laatste rit binnengekomen: vandaag 17:42 (Strava)"* of *"Nog geen rit binnengekomen sinds je training — controleer je koppeling"* met directe actie. Nooit een draaiende spinner zonder uitleg; nooit een verzonnen "gesynchroniseerd".

---

## 2. De nieuwe kernreis (ontwerp)

De huidige reis kent 9 stappen over 3 oppervlakken met impliciete bruggen (auditconclusie: "drie oppervlakken met een impliciete brug"). De nieuwe reis is dezelfde reis, maar met **één doorlopende lijn** en expliciete overgangen:

```
Stap 1  OPENEN        → Vandaag toont het Momentblok (0 tikken tot inzicht)
Stap 2  MOMENT LEZEN  → één leidende conclusie + "waarom" één tik diep
Stap 3  (VOOR) TRAINING → "Dit is het plan voor vandaag" + kern-verwachting
        (verwachting = bestaande Core-voorspelling, nu op het moment zelf getoond)
Stap 4  RIJDEN        → buiten de app
Stap 5  RIT BINNEN    → Momentblok wisselt zelf naar NA-RIT (statusregel toont sync)
Stap 6  RIT-VERHAAL   → één scherm, vier vaste hoofdstukken (zie §3):
                        Wat je deed → Wat het betekende → Wat het verandert → Bevestigd
Stap 7  SCHEMAGEVOLG  → zit ín het Rit-verhaal (hoofdstuk 3), niet op een andere pagina
Stap 8  ONTWIKKELING  → één bestemming: Jij (zie §4); Vandaag toont hooguit een teaser
Stap 9  VERVOLGVRAAG  → chat vanuit elk hoofdstuk, mét contextbevestiging
                        ("Deze vraag gaat over je rit van vandaag")
```

**Tikken-doel per stap** (t.o.v. huidige situatie uit de frictietabel):

| Stap | Nu | Ontwerp |
|---|---|---|
| Inzicht na openen | 0, maar concurrentie met invoer | 0, gegarandeerd leidend |
| Rit-analyse na rit | 2 tikken + zelf zoeken | 1 tik vanaf Momentblok (NA-RIT → "Bekijk het hele verhaal") |
| Analyse → schemagevolg | 1–2 extra sprongen via home | 0 sprongen — zelfde scherm, hoofdstuk 3 |
| Kern-voorspelling (VOORSPELD↔WERKELIJK) | 2–3 tikken diep in drawer | hoofdstuk 2 van het Rit-verhaal |
| Ontwikkeling | 3 plekken | 1 bestemming (Jij), 1 tik |

---

## 3. De keten: het Rit-verhaal (rit → analyse → betekenis → schemagevolg)

Dit is het antwoord op het grootste Dylan-waardegat (#8: *"de analyse bewijst niet zichtbaar dat het plan ervan leert"*). Eén scherm (uitbreiding van de bestaande `session-detail-drawer`), vier vaste hoofdstukken in vaste volgorde:

### Hoofdstuk 1 — Wat je deed
De bestaande NP/IF/TSS-analyse (echte getallen, niveau-afhankelijk gepresenteerd, zie §6). Niets nieuws bouwen; wel niveauschakeling toepassen.

### Hoofdstuk 2 — Wat het betekende
- **VOORSPELD ↔ WERKELIJK** naast elkaar (de bestaande kern-voorspelling had al een WERKELIJK-pad; de vergelijking wordt nu getoond in plaats van verstopt). Eerlijk: geen voorspelling gemaakt → hoofdstuk toont "Voor deze rit was geen verwachting opgesteld" (nooit achteraf construeren).
- Eén duidingszin die de rit aan het totaalbeeld koppelt ("Deze rit bevestigt dat je duurvermogen stijgt") — gevoed door de bestaande observatie-engine (≥2-signalenregel blijft; bij onvoldoende signaal: geen duiding, geen vulling).

### Hoofdstuk 3 — Wat het verandert
- De causale regel, expliciet: *"Op basis van deze rit: [gevolg]"* — drie eerlijke varianten:
  1. **Aanpassing voorgesteld** → het bestaande feedback-adjust-voorstel verschijnt hier inline, met bekijken/accepteren (zelfde geteste machinerie, andere plek).
  2. **Geen aanpassing nodig** → dat wordt óók gezegd: *"Je schema blijft staan — deze rit paste bij het plan."* (Een stille no-op is een gemiste vertrouwensopbouw.)
  3. **Nog niet te bepalen** → eerlijk benoemd met wat er ontbreekt (Smart Missing Input Flow-patroon).
- Bij races vult het bestaande maar UI-loze race-evaluatie-endpoint (F-053) dit hoofdstuk voor race-activiteiten — daarmee krijgt de weesfunctie zijn plek.

### Hoofdstuk 4 — Bevestigd
Na accepteren: de concrete schemaregel die veranderde ("Donderdag: intervallen → duurrit, 75 min"), met link naar Trainen. De keten sluit zichtbaar.

**Momentblok NA-RIT is de samenvatting van hoofdstuk 2+3 in twee regels** — wie niet doorklikt heeft toch de kern.

---

## 4. Eén ontwikkelbestemming: Jij

Consolidatiecluster 1 wordt uitgevoerd zoals geanalyseerd:

| Nu | Wordt |
|---|---|
| `/lab` (bevestigd onbereikbaar weesscherm) | **opgeheven** — inhoud (insights-secties, mentale-veerkracht-kaart) verhuist naar Jij |
| `/you` lenzen/patronen/kompas/evolutie | **de bestemming** — herordend in drie vaste vragen |
| Trainingsverloop op /train | blijft als grafiek op Trainen, maar de dúiding ("dit kwam door jouw week") leeft op Jij; /train linkt ernaar |
| Ontwikkelprioriteit-kaart (home) | wordt teaser: één zin + "Bekijk je ontwikkeling" → Jij |
| Home coach-analyse "Wat valt op" | blijft op Vandaag (dag-inzicht is momentwaarde), maar duurzame patronen verhuizen naar Jij |

**Jij wordt geordend rond drie vragen** (niet rond componenten):

1. **Wie ben je als renner?** — archetype, sterktes, identiteit (bestaande lenzen).
2. **Word je beter?** — ontwikkelkompas + trend + evolutie + VOORSPELD↔WERKELIJK-trefzekerheid over tijd ("de verwachtingen zaten er de laatste 4 weken gemiddeld X% naast" — eerlijk gemaakt uit bestaande snapshots).
3. **Wat is nu je grootste hefboom?** — ontwikkelprioriteit + belastbaarheid + patronen/verbanden (memory-graph).

Profielinstellingen blijven de drill-in-sheet (bestaand `?focus=`-gedrag ongewijzigd). De regel "drie plekken voor één verhaal" (kernreisstap 8) is daarmee opgelost: home = teaser, Trainen = grafiek in context, **Jij = het verhaal**.

---

## 5. Prioriteitsregels (de aandachtswet van Vandaag)

Eén geordende regelset bepaalt wat het Momentblok is én wat eronder mag staan. Hoger wint altijd; gezondheids-/veiligheidsvoorrang komt rechtstreeks uit de strategie (§8: "veiligheids- en gezondheidsmeldingen altijd voorrang").

### 5.1 Wat leidt (Momentblok — precies één)

| Prio | Conditie | Momentblok |
|---|---|---|
| 1 | gezondheids-/overbelastingssignaal actief | veiligheidsadvies (nooit gedempt, nooit weggedraaid door variatie) |
| 2 | racedag | RACEDAG |
| 3 | verse rit binnen, analyse gereed | NA-RIT |
| 4 | verse rit binnen, analyse bezig | RIT-BINNEN |
| 5 | openstaand schema-aanpassingsvoorstel | het voorstel (met de rit-aanleiding erbij) |
| 6 | geplande training vandaag, nog niet gereden | VOOR-TRAINING |
| 7 | rustdag | HERSTEL/RUST |
| 8 | anders | BALANS |

### 5.2 Wat mag meerijden (onder het Momentblok)

1. **Check-in wordt een chip, geen kaart:** één regel onder het Momentblok ("Hoe voel je je? [goed] [matig] [slecht]") — één tik, nooit bovenaan, nooit blokkerend. Avond-follow-ups (context-memory) volgen dezelfde regel.
2. **Maximaal één nudge per bezoek** (cluster 7): één aansporingsbudget over alle bronnen (materiaal, connector-herstel, engagement, herinnering). Rangorde: verbinding-kapot > materiaal-veiligheid > overige. Gezondheid valt buiten het budget (is prio 1 hierboven).
3. **Leskaart en weer worden contextueel:** weer alleen bij VOOR-TRAINING/RACEDAG (daar is het een beslisfactor); leskaart alleen bij HERSTEL/BALANS (daar is er ruimte om te leren).
4. **Presentatievariatie blijft, maar onder de wet:** de per-bezoek-variatie mag alleen roteren bínnen gelijk-geprioriteerde elementen; het Momentblok zelf varieert nooit van plek.
5. **Niets verdwijnt stil:** wat niet meerijdt is bereikbaar via zijn eigen bestemming (Jij, Ontdekken, Activiteiten).

---

## 6. Adaptieve inhoudsdiepte (het Dylan-mechanisme)

Dylan-vraag 4: de inhoud kan Dylan aan, **de presentatie differentieert niet**. Ontwerp:

### 6.1 Drie diepteniveaus

| Niveau | Voor wie | Presentatie |
|---|---|---|
| **Begrijpen** | jeugd, beginners, ouders | geen afkortingen; alles in gevolg-taal ("Deze rit was zwaarder dan gepland — morgen rustig aan") |
| **Duiden** | gevorderd (default) | huidige stijl: getallen mét vertaling ("TSS 82 — een stevige duurprikkel") |
| **Doorgronden** | ervaren renners (Dylan) | getallen voorop, kwantitatieve duiding, onzekerheid expliciet ("IF 0,79 bij TSB −8; verwacht verval 4–6%, gemeten 3% — beter dan het model; n=6 vergelijkbare ritten") |

### 6.2 Hoe het niveau bepaald wordt (confirm-not-ask-doctrine)

- **Startwaarde afleiden, niet vragen:** ervaring/FTP-bron/historie-omvang uit het bestaande profiel geven een voorstel ("Je krijgt de uitgebreide weergave — past dat?"). Eén bevestiging, klaar.
- **Altijd handmatig instelbaar** op Jij (instellingen-sheet) — de gebruiker houdt de regie (bestaande override-regel).
- **Gedrag verfijnt:** klikt iemand structureel "Uitgebreid" open → voorstel om een niveau omhoog te gaan; blijft "Uitgebreid" dicht → nooit stil terugschakelen, hooguit één voorstel. Geen verborgen automatiek.

### 6.3 Waar het niveau werkt

Overal waar duiding staat: Momentblok, Rit-verhaal (alle hoofdstukken), Jij, chatantwoorden. De bestaande twee-laags uitleg (`TieredExplanation`) blijft het mechaniek; het niveau bepaalt **wat er in laag 1 staat** en hoe kwantitatief laag 2 is. Eerlijkheidsregel blijft: geen echte diepte → geen "Uitgebreid"-knop, op geen enkel niveau. Analysefeedback (strategie §7.1: nuttig / al bekend / niet relevant / onjuist) komt onder elk Rit-verhaal-hoofdstuk 2; "al bekend" is het directe signaal dat het niveau omhoog moet.

---

## 7. Navigatievoorstel

### 7.1 Onderbalk (blijft 5, wordt scherper)

| Tab | Inhoud | Wijziging |
|---|---|---|
| **Vandaag** | Momentblok + meerijders (§5) | herordend, niet verplaatst |
| **Activiteiten** | ritlijst → Rit-verhaal | drawer wordt het keten-scherm (§3) |
| **Trainen** | schema, plan, verloop-grafiek | "vandaag"-laag (L3) verdwijnt hier als duplicaat — Vandaag ís het vandaag-oppervlak; /train opent op het weekschema |
| **Jij** | dé ontwikkelbestemming (§4) + instellingen-sheet | absorbeert /lab-inhoud |
| **Ontdekken** | nieuws + kennis + intel "Voor jou" + renners-reel | cluster 2: één leesbestemming; intel-rangschikking stuurt de volgorde |

### 7.2 Header (van vijf naar drie ingangen)

- **Blijft:** SPARKI-chatmerk, notificatiebel, feedback-knop.
- **Verhuist:** **Samen** en **Wereld** verliezen hun permanente header-knop; Samen wordt bereikbaar via Ontdekken (sectie "Jouw omgeving") én via een contextuele kaart wanneer er echt iets is (volgverzoek, teamupdate); Wereld wordt een sectie binnen Ontdekken (consolidatierichting cluster 3, laagdrempelige vorm = de reel).
- Rolwisselaar en uitloggen: ongewijzigd.

### 7.3 Opgeheven/verplaatste routes

| Route | Besluit |
|---|---|
| `/lab` | opheffen; redirect naar Jij |
| `/geluid` | blijft (bereikbaar via Jij/instellingen — al geverifieerd) |
| `/core`, `/photo-lab` | ongewijzigd prototype-status (geen onderdeel van deze ervaring) |
| `/wereld`, `/samen` | routes blijven bestaan (deep-links), ingang via Ontdekken |
| `/races` | krijgt een vaste, vindbare ingang als sectie op Trainen ("Jouw wedstrijden") — lost audit-onzekerheid A5 op met een ontwerpbesluit i.p.v. een losse nav-knop |

---

## 8. Wireframes (schematisch)

### 8.1 Vandaag — moment VOOR-TRAINING

```
┌──────────────────────────────────────────┐
│ SPARKI●          [rol] [bel] [feedback]  │
├──────────────────────────────────────────┤
│  MOMENTBLOK · VOOR JE TRAINING           │
│  Vandaag is kwaliteit verstandig.        │
│  Je vorm is fris (+5) en je sliep goed.  │
│  ▸ Intervallen · 75 min · verwachting:   │
│    stevig maar haalbaar                  │
│  [ Bekijk de training ]  [ Waarom? ▾ ]   │
│  ── laatste rit binnen: gisteren 18:04 ──│
├──────────────────────────────────────────┤
│  Hoe voel je je?  [goed] [matig] [slecht]│   ← chip, één regel
├──────────────────────────────────────────┤
│  16° · droog · wind ZW 3 — goed venster  │   ← weer alleen in dit moment
│  tussen 16:00 en 19:00                   │
├──────────────────────────────────────────┤
│  (max. één nudge, alleen indien nodig)   │
├──────────────────────────────────────────┤
│  Je ontwikkeling: duurvermogen stijgt →  │   ← teaser naar Jij
└──────────────────────────────────────────┘
│ Vandaag  Activiteiten  Trainen  Jij  Ontdekken │
```

### 8.2 Vandaag — moment NA-RIT

```
┌──────────────────────────────────────────┐
│  MOMENTBLOK · JE RIT IS BINNEN           │
│  Zwaarder dan gepland, en dat was oké.   │
│  82 TSS (plan: 70) — je herstel draagt   │
│  het. Morgen verandert er niets.         │
│  [ Bekijk het hele verhaal → ]           │
│  ── rit binnengekomen: 17:42 (Strava) ── │
├──────────────────────────────────────────┤
│  Hoe voelde de rit? [licht][zwaar][slecht]│  ← feedback-chip i.p.v. check-in
└──────────────────────────────────────────┘
```

### 8.3 Rit-verhaal (de keten, één scherm)

```
┌──────────────────────────────────────────┐
│ ← Terug            Rit van vandaag 17:42 │
├──────────────────────────────────────────┤
│ 1 · WAT JE DEED                          │
│   2:05 u · 68 km · NP 231 · IF 0,79 ·    │
│   TSS 82   (weergave volgt jouw niveau)  │
├──────────────────────────────────────────┤
│ 2 · WAT HET BETEKENDE                    │
│   VERWACHT      →   WERKELIJK            │
│   verval 4–6%       verval 3% ✓          │
│   "Je duurvermogen ontwikkelt zich       │
│    sneller dan het model verwachtte."    │
│   Was dit nuttig? [nuttig][al bekend]    │
│                   [niet relevant][onjuist]│
├──────────────────────────────────────────┤
│ 3 · WAT HET VERANDERT                    │
│   Op basis van deze rit:                 │
│   ▸ Donderdag wordt lichter: intervallen │
│     → duurrit 75 min.                    │
│   [ Bekijk voorstel ]  [ Accepteer ]     │
├──────────────────────────────────────────┤
│ 4 · BEVESTIGD (na accepteren)            │
│   ✓ Schema aangepast — bekijk donderdag  │
│     op Trainen.                          │
├──────────────────────────────────────────┤
│   Vraag door over deze rit → [chat]      │
│   ("Deze vraag gaat over je rit van      │
│     vandaag" staat in de chat bevestigd) │
└──────────────────────────────────────────┘
```

### 8.4 Jij — de ontwikkelbestemming

```
┌──────────────────────────────────────────┐
│  JIJ                        [instellingen]│
├──────────────────────────────────────────┤
│  WIE JE BENT                             │
│  Klimmer · gevorderd · 8,2 u/week        │
├──────────────────────────────────────────┤
│  WORD JE BETER?                          │
│  [trendgrafiek]  "Je duurvermogen steeg  │
│  6 weken op rij. De verwachtingen zaten  │
│  er gemiddeld 4% naast — het model kent  │
│  je steeds beter."                       │
├──────────────────────────────────────────┤
│  JE GROOTSTE HEFBOOM                     │
│  Herstelkwaliteit. Korte nachten na      │
│  zware dagen remmen je opbouw (gezien in │
│  3 van de laatste 4 weken). [Uitgebreid ▾]│
├──────────────────────────────────────────┤
│  Patronen & verbanden · Doelen ·         │
│  Mentale veerkracht · Geluid & wekker    │   ← geabsorbeerd uit /lab e.a.
└──────────────────────────────────────────┘
```

---

## 9. Featuremapping (audit-inventaris → nieuwe ervaring)

Legenda: **B** = blijft (evt. andere plek) · **S** = samengevoegd · **C** = contextueel gemaakt · **W** = krijgt eindelijk UI · **X** = opgeheven als eigen oppervlak.

| Feature (audit-ID) | Nu | In de nieuwe ervaring |
|---|---|---|
| F-001/F-002 dagbeeld + StateCard | home | **B** — ruggengraat van het Momentblok (verfijnd per moment) |
| F-004 coach-analyse "Wat valt op" | home | **B** — dag-inzichten onder het Momentblok; duurzame patronen → Jij |
| F-007 check-in | kaart, soms bovenaan | **C** — chip onder Momentblok, nooit leidend |
| F-008 leskaart | home, altijd | **C** — alleen bij HERSTEL/BALANS |
| F-010 zelf-update hub | home | **B** — ongewijzigd (doctrine blijft) |
| F-011 ontwikkelprioriteit-kaart | home | **S** — teaser-regel; inhoud op Jij |
| F-013 engagement-nudges | eigen logica | **C** — onder het éne aansporingsbudget |
| F-020 /train L3 "vandaag" | duplicaat | **X** — Vandaag is het vandaag-oppervlak |
| F-023/F-024 werkout-drawer + verloop | /train | **B** — drawer blijft; verloop-duiding → Jij |
| Kern-voorspelling (VOORSPELD↔WERKELIJK) | 2–3 tikken diep | **B**↑ — hoofdstuk 2 van het Rit-verhaal + trefzekerheid op Jij |
| F-041 bestand-import | /activiteiten | **B** — ongewijzigd |
| F-044 connector-herstel-nudge | shell | **B** — hoogste rang binnen het nudgebudget |
| Sessie-analyse/drawer | /activiteiten | **B**↑ — wordt het Rit-verhaal (4 hoofdstukken) |
| Feedback-adjust / CoachDecision | home-kaart | **S** — inline in Rit-verhaal hoofdstuk 3; als los moment prio 5 |
| F-053 race-evaluatie-endpoint | wees (geen UI) | **W** — hoofdstuk 3 voor race-activiteiten |
| F-062 materiaal-nudge | home | **C** — nudgebudget |
| F-065 mentale-veerkracht-kaart | verborgen op /lab | **W** — sectie op Jij |
| F-070/F-030 lenzen + kompas | /you | **B** — kern van Jij (drie-vragen-ordening) |
| F-073 chat | overlay | **B**↑ — + contextbevestiging per bron ("over je rit van vandaag") |
| F-078 /lab | wees | **X** — redirect naar Jij |
| F-090/F-092/F-093 nieuws/kennis/intel | 3 ingangen | **S** — één Ontdekken, intel-gestuurd |
| F-094/F-101 reel + Wereld | feed + header | **S/C** — sectie in Ontdekken; header-knop vervalt |
| F-100 Samen | header | **C** — via Ontdekken + contextuele kaart bij echte gebeurtenis |
| F-105 weer | home, altijd | **C** — alleen VOOR-TRAINING/RACEDAG |
| F-130 notificatiebel | header | **B** — ongewijzigd |
| F-134 geluid/wekker | via /you | **B** — sectie op Jij |
| F-160/F-161 prototypes | verborgen | **B** — buiten deze ervaring |
| Races (F-050 e.v.) | zonder vaste ingang | **B**↑ — sectie "Jouw wedstrijden" op Trainen |
| Smart Missing Input Flow | overal | **B** — wet blijft; nieuw toepasbaar in Rit-verhaal hoofdstuk 3-variant "nog niet te bepalen" |

Coach- en ouderportalen, admin, privacy, hub, onboarding: **buiten scope van dit ontwerp** (renner-kernervaring), ongewijzigd.

---

## 10. Voorbeeldteksten (plain Dutch, neutrale stem, geen "AI")

Alle teksten volgen de bestaande wetten: geen "Sparki ziet/denkt", geen Engels jargon zonder vertaling, eerlijk bij twijfel.

### Momentblok VOOR-TRAINING
- Begrijpen: *"Vandaag staat er een stevige training klaar. Je bent er klaar voor: je hebt goed geslapen en gisteren rustig gedaan."*
- Doorgronden (Dylan): *"Intervallen, 75 min, doel-IF 0,85. TSB +5, HRV op je 7-daags gemiddelde — kwaliteit is vandaag verantwoord. Verwacht vermogensverval in het laatste blok: 4–6%."*

### Momentblok NA-RIT
- Begrijpen: *"Je rit is binnen. Hij was zwaarder dan gepland, maar dat kon je hebben. Morgen verandert er niets."*
- Doorgronden: *"82 TSS tegen 70 gepland (+17%). Verval 3% waar 4–6% verwacht was — beter dan het model. Geen schemagevolg; donderdag blijft staan."*

### Onzekerheid (alle niveaus, verplicht eerlijk)
- *"Hier is nog te weinig van je bekend om iets over te zeggen. Na drie ritten met vermogensdata kan dit wel."*
- *"Deze conclusie is voorzichtig: hij steunt op maar twee weken gegevens."*

### Schemagevolg (hoofdstuk 3)
- Aanpassing: *"Op basis van deze rit wordt donderdag lichter: de intervallen worden een duurrit van 75 minuten. Zo houd je de opbouw vast zonder je herstel te belasten."*
- Geen aanpassing: *"Je schema blijft staan — deze rit paste precies bij het plan."*
- Onbepaald: *"Of dit gevolgen heeft voor je week is nog niet te zeggen: er ontbreekt hartslagdata van deze rit. Koppel je meter of vul je gevoel in, dan wordt dit alsnog beoordeeld."*

### Sync-statusregel
- *"Laatste rit binnengekomen: vandaag 17:42 (Strava)."*
- *"Nog geen rit binnengekomen sinds je training van 16:00. Meestal duurt dit tot een kwartier. Duurt het langer? Controleer je Strava-koppeling."*

### Niveau-bevestiging (eenmalig)
- *"Op basis van je profiel krijg je de uitgebreide weergave: getallen voorop, met de onzekerheid erbij. Aanpassen kan altijd bij Jij → Instellingen."*

### Chat-contextbevestiging
- *"Deze vraag gaat over je rit van vandaag (17:42). Andere rit? Open die eerst bij Activiteiten."*

---

## 11. Dylan-testscenario

Doel: falsificatietest van de propositie (strategie §2). Slaagt het ontwerp, dan opent Dylan de app vrijwillig omdat een vraag hier beter beantwoord wordt dan in Garmin/Strava.

### Opzet
Dylan (ervaren, trainingskundig onderlegd, Strava gekoppeld, ≥6 weken historie, niveau "Doorgronden") doorloopt één echte trainingsdag. Geen begeleiding, geen uitleg vooraf.

### Script en meetpunten

| # | Handeling | Verwacht gedrag | Slaagt als | Faalt als |
|---|---|---|---|---|
| 1 | Opent app om 07:30 (training gepland 17:00) | Momentblok VOOR-TRAINING met kwantitatieve duiding + verwachting | Dylan noemt binnen 10 sec één ding dat hij "nog niet wist of nergens anders zo ziet" | eerste blok is een invoerverzoek, of duiding is generiek ("lekker trainen vandaag!") |
| 2 | Kijkt naar de check-in | chip, één tik, onder het blok | invullen kost <5 sec en voelt optioneel | check-in blokkeert of staat boven het inzicht |
| 3 | Rijdt de training; opent app 17:50 | statusregel toont sync; blok = RIT-BINNEN of NA-RIT | Dylan hoeft nergens te zoeken of te verversen | hij weet niet of de rit binnen is (het oude stap-4-gat) |
| 4 | Tikt "Bekijk het hele verhaal" | Rit-verhaal, 4 hoofdstukken | VOORSPELD↔WERKELIJK is zichtbaar zonder extra tikken; hij leest hoofdstuk 3 zonder ernaar te vragen | hij vraagt "en wat betekent dit voor donderdag?" — dan is de keten niet gesloten |
| 5 | Hoofdstuk 3 stelt aanpassing voor | inline voorstel, accepteren op dezelfde plek | van rit naar geaccepteerde schemawijziging in ≤2 tikken zonder paginawissel | hij moet terug naar home/Trainen om het gevolg te vinden |
| 6 | Geeft analysefeedback | "al bekend" beschikbaar per duiding | bij "al bekend" volgt (later) merkbaar kwantitatievere duiding | feedback verdwijnt in het niets |
| 7 | Opent Jij aan het eind van de week | drie vragen-structuur; trefzekerheid van verwachtingen zichtbaar | hij vindt "word ik beter?" op één plek en citeert een concreet getal | hij zoekt op meerdere plekken of vindt alleen kwalitatieve teksten |
| 8 | Volgende ochtend, rustdag | Momentblok HERSTEL/BALANS; geen weer, wel leskaart toegestaan | de app zegt iets anders dan gisteren omdat het moment anders is | zelfde opbouw als trainingsdag ("dag-sjabloon"-gevoel) |

### Slaagcriteria (gekoppeld aan de acht Dylan-vragen uit de audit)

1. Tijd-tot-uniek-inzicht: **0 tikken, gegarandeerd bovenaan** (was: concurrentie).
2. Verplichte keuzes vóór inzicht: **0**.
3. Momentgevoeligheid: ochtend ≠ na-rit ≠ rustdag, zichtbaar verschillend.
4. Niveau: minstens één kwantitatieve duiding per analyse die Garmin/Strava niet geeft (verwachting↔realisatie).
5. Generieke info: niet aanwezig in de eerste twee blokken van Vandaag.
6. Diepste waardevolle inzicht (VOORSPELD↔WERKELIJK): **≤1 tik** vanaf het Momentblok.
7. Aandachtconcurrentie: maximaal Momentblok + chip + 1 nudge + 1 teaser boven de vouw.
8. Analyse→schema: **zelfde scherm**, expliciete causale regel, ook bij "geen gevolg".

**Meetbaar erbij (strategie §7.2):** vrijwillige opens per week, opvolging van voorstellen, "al bekend"-ratio (moet dalen na niveauschakeling), gebruik van Garmin/Strava naast Sparki voor dezelfde vraag (moet dalen).

---

## 12. Wat dit ontwerp bewust NIET doet

- Geen nieuwe data-engines: elk blok wordt gevoed door bestaande, geteste machinerie (dag-type, observatie, kern-voorspelling, feedback-adjust, memory-graph, intel). Het ontwerp is een **herordening van presentatie en navigatie**, plus twee kleine echte gaten: sync-statusregel en race-evaluatie-UI.
- Geen engagementmechanieken, geen streaks, geen limieten (strategie §5/§8 blijven wet).
- Geen wijziging aan coach-/ouderportalen, onboarding, admin of privacy-model.
- Geen implementatie: dit document stopt hier, ter beoordeling.

### Voorgestelde bouwvolgorde (indien akkoord — nog niet gestart)

1. **Fase 1 — De keten:** Rit-verhaal (4 hoofdstukken) + sync-statusregel + NA-RIT-moment. (Grootste Dylan-waarde, kleinste structuuringreep.)
2. **Fase 2 — De aandachtswet:** Momentblok-prioriteiten + check-in-chip + nudgebudget + contextuele weer/leskaart.
3. **Fase 3 — Eén bestemming:** Jij-herordening + /lab-opheffing + teaser-model.
4. **Fase 4 — Diepte & nav:** niveauschakeling + Ontdekken-consolidatie + header-versobering.
