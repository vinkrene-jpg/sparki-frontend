# ROUTEPLANNER_MOBIEL_01

**Bouwinstructie — Sparki**
Datum: 5 augustus 2026
Gemeten op: HEAD na `e15645a`
Zevende document in de reeks; index staat in `TRAINERSZANDBAK_EN_BLOKKEN_01` §0

---

## 0. Uitgangspunt voor de hele app

**Aangescherpte regel van 5 augustus 2026:**

> Tussen desktop en telefoon bestaat **geen verschil in data en functies**. In
> **uiterlijk en bediening moeten ze juist wél echt verschillen.**

Dit verduidelijkt de regel van 2 augustus, die tot nu toe ook op de vormgeving werd
toegepast. Gevolg voor de bouw: **één gedeelde datalaag, gescheiden schermlagen.**
De API-cliënt en de logica worden gedeeld — dat borgt gelijke data. De schermen
worden per omgeving gebouwd: telefoon met duimbereik, onderbladen, gebaren en
schermvullende kaarten; desktop met overzicht en meerdere kolommen.

**Gevolg voor de bestaande webbrug:** `artifacts/sparki-mobile/app/(app)/web.tsx`
(MOBIEL_ROLLEN_01 F1) toont de webapplicatie ín de app. Dat blijft toegestaan als
**tijdelijke** oplossing voor zeldzame rollen, maar is niet langer het eindstation.
Volgorde van vervanging: sporter (klaar) → trainer → ploegleider op wedstrijddag →
club en ouder → overige stafrollen mogen op de brug blijven.

**De routeplanner is het eerste bewijsstuk.** Wat hier gebouwd wordt, is het
voorbeeld waar de volgende schermen zich aan spiegelen.

---

## 1. Waarom dit opnieuw gebouwd wordt

Gemeten op 5 augustus:

- `route-panel.tsx` is **gegroeid** van 5.248 naar 5.293 regels — het goedgekeurde
  herontwerp van 1 augustus is niet uitgevoerd
- `pages/routes.tsx` (166 r.) is een gewone hoofdstukpagina met tabbladen, geen
  schermvullende kaart
- de bediening is een **stappenformulier** ("Kies eerst een startpunt (stap 1)") met
  uitklapvelden en labels in hoofdletters, in een raster van twee kolommen — op een
  telefoon
- het enige schermvullende element is een overlay met `lg:hidden`: een mobiele
  pleister op een desktopcomponent

Eén component van ruim vijfduizend regels waarin planning, klimkeuze,
trainingskoppeling, wegdekcontrole en kaartweergave door elkaar lopen, is niet meer
bij te schaven. Elke wijziging raakt de rest.

---

## 2. Wat er gebouwd wordt — het scherm

| # | Onderdeel |
|---|---|
| R1 | Kaart schermvullend, circa 80% van het scherm. Geen hoofdstukpagina met tabbladen |
| R2 | Zoekveld en driepuntsmenu bovenop de kaart |
| R3 | Filters als bolletjes op de kaart, met **trainingstype vooraan** — drie knoppen voor de meesten, vier voor de recreatieve fietser (extra: drukke wegen vermijden) |
| R4 | Kaartbediening rechtsonder, binnen duimbereik |
| R5 | Sleep-open onderblad met de routes die in beeld zijn: kaartuitsnede met de lijn en het hoogteprofiel. **Geen sfeerfoto bij een concrete route** |
| R6 | Inhoud van het onderblad verschilt per pakket: Gratis zoeken plus drie bewaarde routes · Go het routevoorstel van vandaag met de reden erbij · Compleet de training van vandaag met de route eronder |
| R7 | Route aanpassen op vier manieren: punt verslepen · waypoint toevoegen · in- of uitkorten · klim uit de buurt toevoegen |
| R8 | Bij starten schuift de **navigatielaag over dezelfde kaart** — geen apart navigatiescherm; planningsbediening verdwijnt, navigatiebediening komt ervoor in de plaats |

---

## 3. Wat er verdwijnt

| # | Vervalt |
|---|---|
| R9 | Het stappenformulier ("kies eerst een startpunt, stap 1") |
| R10 | Rasters van twee kolommen naast elkaar op de telefoon |
| R11 | De filtervelden op routeberekening uit de hoofdbediening: rotondes, spoorwegovergangen, verkeerslichten, drempels, wind, temperatuur. Dit is tevens de bron van de tientallen kaartvragen per route en daarmee van de traagheid en de bevragingslimieten |

Sparki hoeft niet te winnen op routeberekening. Het onderscheid zit in de
trainingskoppeling, vrienden op de kaart en wat er onderweg te zien is.

---

## 4. Wat meeverhuist — niet opnieuw bouwen

| # | Blijft |
|---|---|
| R12 | Routegeneratie, wegdekcontrole, klimmenverkenner, GPX-import, bibliotheek en Strava-import |
| R13 | De vastgelegde regels: geen woonwijken (ook bij een vrije rit) · begin en eind afkappen bij openbare routes · openbare routes anoniem tonen · onbekend wegdek alleen in het buitenland laten bevestigen · e-bikebereik "onbekend" zonder bron |

---

## 5. Hoe het gebouwd wordt

| # | Werkwijze |
|---|---|
| R14 | Als **nieuw scherm naast** het oude paneel, met een afgesproken einddatum voor het oude — anders blijven er twee bestaan |
| R15 | De 5.293 regels worden gesplitst: rekenwerk en datatoegang naar losse modules (gedeeld met desktop), het scherm zelf blijft dun |
| R16 | Prestatie-eis: **één routeaanvraag per keuze** in plaats van tientallen kaartvragen per route |
| R17 | Desktop krijgt hetzelfde gedrag en dezelfde data, met een eigen indeling — geen kopie van het telefoonscherm en geen kopie van het oude paneel |

---

## 6. Acceptatietests

| # | Test | Verwacht |
|---|---|---|
| R-T1 | Routescherm op een telefoon openen | kaart beeldvullend, bediening bovenop, geen paginakop met tabbladen |
| R-T2 | Alle schermen doorlopen op een telefoon | nergens twee kolommen naast elkaar |
| R-T3 | Filterbolletje trainingstype gebruiken | precies één routeaanvraag, meetbaar in de logging |
| R-T4 | Route starten | navigatielaag over dezelfde kaart, planningsbediening weg |
| R-T5 | Gratis, Go en Compleet naast elkaar | het onderblad verschilt zoals in R6 |
| R-T6 | Openbare route van een ander openen | begin en eind afgekapt, geen naam van de maker |
| R-T7 | Route met onbekend wegdek in Nederland | melding, geen bevestigingsvraag |
| R-T8 | Zelfde route op desktop | dezelfde data en functies, andere indeling |

---

## 6a. Datums — besluit van 5 augustus 2026

Alles op vandaag. Geen fasering over dagen; wel poorten: elke stap gaat pas open als
de tests van de vorige groen zijn.

| Stap | Wanneer | Poort |
|---|---|---|
| Oud paneel **bevriezen** — geen enkele wijziging meer in `route-panel.tsx` | direct | — |
| Telefoonscherm af (§2) | vandaag | R-T1 t/m R-T7 groen |
| Desktop volgt met eigen indeling (R17) | vandaag | R-T8 groen |
| Oud paneel **verwijderd**, niet uitgezet | vandaag | alle tests groen én desktop live |

**Bevriezen is het belangrijkste onderdeel.** Elke pleister in het oude paneel is
weggegooid werk en houdt de vervanging tegen.

**Terugvalregel:** haalt een stap zijn poort niet, dan blijft het oude paneel staan
tot hij groen is. Het paneel wordt nooit verwijderd voordat het nieuwe scherm op
beide omgevingen werkt — liever een dag langer twee panelen dan een uur geen
routeplanner.

---

## 7. Openstaand bij René

- of de oude filters (rotondes, verkeerslichten, wind, temperatuur) **helemaal
  verdwijnen** of achter het driepuntsmenu bereikbaar blijven voor wie ze wil

---

## 8. Wat er níét gebouwd wordt

- geen tweede routegeneratie of tweede wegdekcontrole
- geen apart navigatiescherm
- geen sfeerfoto bij een concrete route
- geen nieuwe webbrug: dit scherm wordt echt voor de telefoon gebouwd
