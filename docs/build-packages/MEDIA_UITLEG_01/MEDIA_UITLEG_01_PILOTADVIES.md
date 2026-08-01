# MEDIA_UITLEG_01 — PILOTADVIES

**Deel 15 van 20**

---

## 0. Voorbehoud

De pilotselectie wordt **definitief vastgesteld in F0**. Onderstaande kandidaten zijn door René genoemd of volgen logisch uit de componentgrenzen; F0 bevestigt of ze in deze vorm bestaan en voldoende stabiel zijn.

**Selectiecriteria** — alleen schermen die: al bestaan · voldoende stabiel zijn · niet gelijktijdig zwaar worden herbouwd · echte gebruikerswaarde hebben · geen kritieke veiligheidsflow zijn.

---

## 1. De pilotset

De volledige pilot bestaat uit acht onderdelen. Ze worden **niet in één fase** gebouwd; ze komen samen in F9.

| # | Onderdeel | Fase | Component |
|---|---|---|---|
| 1 | één subtiele dieptekaart | F2 | CMP-40 |
| 2 | één niet-acute coachmelding | F7 | CMP-44 |
| 3 | één uitlegflow van een stabiele functie | F5 | CMP-42 |
| 4 | twee oefendemonstraties | F6 | CMP-43 |
| 5 | één Academy-startpagina | F8 | — |
| 6 | Verminder beweging | F1 | — |
| 7 | volledige tekstfallback | F3 | CMP-41 |
| 8 | lage-bandbreedte- en ontbrekende-mediaflow | F3 | CMP-41 |

---

## 2. Kandidaten per onderdeel

### Dieptekaart

| Kandidaat | Voordeel | Risico | Afhankelijkheid | Bewijslast |
|---|---|---|---|---|
| **Training voltooid** | natuurlijk rustmoment; hoge frequentie; geen media nodig | bestaat er een afrondingsscherm | F0 | diepte aan/uit identiek bruikbaar |
| Route opgeslagen of gestart | duidelijk afgebakend moment | grenst aan navigatie — diepte mag daar niet | F0 | geen diepte zodra navigatie start |
| Route- of klimdetail | sluit aan op progressief laden | zwaar scherm; kaart en profiel laden traag | F0, PAT-01 | kernbediening werkt vóór diepte |
| Persoonlijk record | emotioneel juiste plek | zeldzaam; moeilijk reproduceerbaar te toetsen | — | reproduceerbaar testgeval |

**Aanbeveling: training voltooid.** Rustmoment, geen navigatie in de buurt, en reproduceerbaar te toetsen.

**Let op de volgorde.** "Training voltooid" is de **samengestelde eindpilot**, niet de eerste codefase. Hij ontstaat pas na F2 (dieptekaart) én F7 (niet-acute coachmelding). **F2 is de eerste codefase voor de zichtbare pilot**; de coachmelding wordt daar pas aan toegevoegd nadat F7 **zelfstandig** `MIRROR_PROVEN` is. Echte adviesgrond blijft daarbij verplicht — **geen demo-advies**.

### Coachmelding

| Kandidaat | Voordeel | Risico | Afhankelijkheid | Bewijslast |
|---|---|---|---|---|
| **Na afronding van een rit** | rustmoment per definitie; MUX-90 wordt niet geraakt | vereist een echte adviesgrond | bestaande coachlaag | reden, gegevens, periode, onzekerheid aanwezig |
| Bij terugkeer op het startscherm | vaak bereikt | minder duidelijk rustmoment | — | melding blokkeert primaire actie niet |

**Aanbeveling: na afronding van een rit**, mits er een echte adviesgrond is. Zo niet: dit onderdeel wacht.

### Uitlegflow

| Kandidaat | Voordeel | Risico | Afhankelijkheid | Bewijslast |
|---|---|---|---|---|
| **Routeplanner, eerste opening** | meest gebruikte functie; uitleg is gratis | de planner is een mobiele webpagina — schermversie moet vaststaan | F0, versievastheid | uitleg geblokkeerd bij afwijkende schermversie |
| Analyse begrijpen | hoge waarde | analysescherm nog in beweging | — | — |
| Onboarding | logische plek | onboarding is een actieve taak — uitleg mag daar niet | — | — |

**Aanbeveling: routeplanner**, mits F0 bevestigt dat de schermversie stabiel is. Onboarding valt af: dat is een actieve taak.

### Oefendemonstraties

| Kandidaat | Voordeel | Risico | Afhankelijkheid | Bewijslast |
|---|---|---|---|---|
| Twee uit de genoemde pilotset (plank, squat, glute bridge, dead bug, heupmobiliteit) | eenvoudig, weinig blessurerisico, geen apparatuur | vereist contentmodel én rechten én een bevoegde beoordelaar | `KENNIS_01`, open besluit | minderjarig account ziet geen 1RM-, gewichts- of caloriedoel |

**Aanbeveling: twee eenvoudige, apparaatvrije oefeningen.** Dit onderdeel is het meest afhankelijk van zaken buiten dit pakket en komt daarom laat.

---

## 3. Definitieve aanbeveling

**Bouw de pilot in deze volgorde, en begin met het deel dat nergens op wacht.**

1. **F1 + F2 als eerste zichtbare resultaat:** Verminder beweging plus de dieptekaart op "training voltooid". Dit vraagt geen media, geen rechten, geen contentmodel en geen bevoegde beoordelaar. Het bewijst meteen de zwaarste bewering (B4) op een klein oppervlak.
2. **Daarna F3 en F4:** speler met volledige tekstfallback en de lage-bandbreedteflow, plus de gebruikersstatus. F3 start pas met een rechtenvrij testasset; zonder dat asset blijft de fase `OPEN` en gaat er niets half door.
3. **Daarna F5 en F7:** uitlegflow en coachmelding, elk zodra hun voorwaarde er is.
4. **F6 en F8 als laatste van de pilot:** oefenkaart en Academy, want die wachten op `KENNIS_01`, op de bevoegde beoordelaar en op de technische route uit F0. De Academy-locatie zelf staat vast.

**Definitieve interfacevideo's worden pas opgenomen na Mirror-bewijs van het betreffende scherm.** Een opname van een scherm dat daarna nog verandert, is direct verouderd — en verouderde uitleg wordt door CMP-42 geblokkeerd, dus zo'n opname is weggegooid werk.

---

## 4. Pilotmedia

Tijdelijke testmedia mag alleen wanneer alle vijf voorwaarden uit deel 7 hoofdstuk 4 gelden. Voldoet één punt niet, dan gaat de pilot **zonder media** door en is de tekstvariant de volledige inhoud. Dat is geen noodoplossing maar precies wat bewering B4 verlangt.

---

*Deel 15 van 20.*
