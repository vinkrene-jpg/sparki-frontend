# SPARKI — V1 DEKKINGSAUDIT (huidige stand)

**Datum:** 28 juni 2026
**Doel:** Eerlijke, actuele meting van de volledige V2-specificatie (blueprint §1–11) tegen de *werkelijke* code van vandaag — niet alleen "bestaat het scherm", maar "werkt de hele gebruikersflow" (frontend → API → database).
**Belangrijk:** `SPARKI_MIGRATION_AUDIT.md` en `SPARKI_MASTER_BLUEPRINT.md` dateren van 22 juni en zijn **achterhaald**. Sindsdien is het overgrote deel gebouwd. Dit document vervangt de statuskolommen.

**Legenda:** 🟢 Volledig gebouwd · 🟡 Gedeeltelijk · 🔴 Ontbreekt · ⚪ Bewust vervallen / buiten web-scope

---

## 0. Eindoordeel in één alinea

Sparki is **veel verder dan een app-shell**: de vijf kernschermen, de volledige day-type-intelligentielaag (10+ dagtypes met eigen briefing), de observatie-/coach-engine, races + race-intelligentie + kalenderimport, routeplanner met kaart + GPX, Samen/coach/ouder, Data Hub + Strava, gezondheid/privacy/voeding, en zelfs een Photo-Lab + web-push zijn **echt en werkend**. Wat rest voor een afgeronde V1 is **afmaken en ontsluiten**, niet opnieuw bouwen. De echte gaten zijn klein in aantal maar belangrijk voor de "premium compleet"-beleving: **power/duration-curve, per-training fueling-tijdlijn, route-lijn slepen + publieke routebibliotheek, lange-termijn seizoenstijdlijn, en navigatie-ontsluiting** van Samen/Routes/Clubs.

---

## 1. Status per blok

### A. Training & uitvoering
| # | Feature | Status | Toelichting |
|---|---|---|---|
| A1 | Training Experience (/train) | 🟢 | 4-laags spine (bron/doel/vandaag/patronen) werkt end-to-end. |
| A2 | Intervalblok-visualisatie | 🟢 | `structure.blocks` gerenderd als zonegekleurd staafprofiel. |
| A3 | Doelzones + target-blok | 🟢 | Live zones op FTP + per-blok % FTP / wattage / Z-range. |
| A4 | Fueling Strategy (per training) | 🟡 | Race-fueling + voedingslog bestaan; **per-training intra-workout fueling-tijdlijn** ontbreekt nog. |
| A5 | Prep-checklist | 🟢 | Afvinkbaar, met foto-verificatie via Materiaalcoach. |
| A6 | In-workout live coaching | 🔴/⚪ | Pre-ride briefing + post-ride feedback zijn er; **live pacing/cadans tijdens de rit** ontbreekt. Web kan dit niet betrouwbaar zonder live sensor-stream → eerlijk als bewust uitgesteld te markeren. |
| A7 | Equipment Advisor / materiaal | 🟢 | Foto-gedreven Materiaalcoach (banden/ketting/remmen) + kosten/DIY. |
| A8 | Compliance plan-vs-werkelijk | 🟢 | IF/TSS/NP/gevoel-vergelijking via Core-prediction-engine. |

### B. Routes & groep
| # | Feature | Status | Toelichting |
|---|---|---|---|
| B1 | Smart Route Planner | 🟢 | ORS-generator, elevatieprofiel, climbs, turn-by-turn, Leaflet-kaart. |
| B1b | Route tekenen / slepen | 🟡 | Waypoints plaatsen + slepen werkt; **de route-lijn zelf slepen (rubber-band/reroute over een specifieke weg)** ontbreekt. |
| B2 | Coach Route | 🟢 | Route koppelbaar aan geplande training. |
| B3 | Group Ride Planner | 🟢 | `group_training_proposals` + invitees + RSVP via Samen. |
| B4 | Meeting Point Optimizer | 🔴 | Verzamelpunten handmatig plaatsen kan; **optimalisatie o.b.v. deelnemerslocaties** ontbreekt (vereist locatie-input). |
| B5 | Shared Routes + bibliotheek | 🟡 | `visibility` (privé/team/club/publiek) bestaat; **dedicated routebibliotheek-/ontdekpagina + zoeken/filteren** ontbreekt. |
| B6 | Export Garmin/Komoot/Wahoo/GPX + import | 🟢 | GPX + TCX-course export (turn-cues), GPX-import. *Gat:* geïmporteerde GPX krijgt geen turn-by-turn (`nav` blijft null). |

### C. Race & competitie
| # | Feature | Status | Toelichting |
|---|---|---|---|
| C1 | Race Week | 🟢 | Aftel-modus + taper + prep-timeline. |
| C2 | Day Before Race | 🟢 | Checklist, planner, fuel. |
| C3 | Race Day + Race Mode overlay | 🟢 | Dedicated briefing + start-race-modus. |
| C4 | Race Day Planner | 🟢 | Tijdlijn terug-gerekend vanaf start. |
| C5 | Team Meeting Planner | 🟢 | `teamRiders` → verzamel-/vertrektijden. |
| C6 | Season Planning | 🟡 | CTL/ATL/TSB + periodisering sturen onder de motorkap; **jaartijdlijn-view met A-races + FTP-ontwikkeling** ontbreekt (horizon nu ~21 dagen). |
| — | Kalenderimport (Fietssport/We-Tri/KNWU) | 🟢 | Echt/parseerbaar; KNWU eerlijk-beperkt. |
| — | Race-intelligentie + document-analyse | 🟢 | Prep/fuel/checklist + PDF/foto-gids inlezen. |

### D. Analyse — Lab
| # | Feature | Status | Toelichting |
|---|---|---|---|
| D1 | Lab-scherm | 🟢 | Secties 01–08 op live data. |
| D2 | **Power/duration-curve** | 🔴 | **Volledig ontbrekend** — geen mean-maximal-curve (huidig vs seizoenspiek). Grootste analyse-gat. |
| D3 | Recovery & Form | 🟢 | TSB/load/recovery via bio-radar. |
| D4 | Readiness & HRV-trend | 🟢 | 14-daagse trends. |
| D5 | FTP-ontwikkeling + voorspelling | 🟡 | Historie 🟢; **seizoens-FTP-voorspelling als grafiek** ontbreekt. |
| D6 | Season Progress (CTL/ATL/TSB) | 🟢 | Fitness-traject + volume. |

### E. Welzijn & profiel — You/Core
| # | Feature | Status | Toelichting |
|---|---|---|---|
| E1 | You/Core-scherm | 🟢 | Levend profiel (afgeleide identiteit + lenzen). |
| E2 | Gestructureerde doelen | 🟢 | Ontwikkeldoel-enum + voortgang; *minor:* geen los "doeldatum"-veld per doel. |
| E3 | Herstel check-in | 🟢 | Feel/sleep/fatigue/HRV/notitie. |
| E4 | Slaap | 🟡 | Kwaliteit (1–5) in check-in; **slaap-uren als dagmetriek** ontbreekt (alleen profiel-default). |
| E5 | Voeding | 🟢 | Context-bewuste begeleiding + log (foto's). |
| E6 | Connected Apps | 🟢 | Strava live; 13+ providers "voorbereid" met eerlijke 4-staten-readiness. |
| E7 | Account: gezondheid/privacy/voorkeuren | 🟢 | Health-status voedt Emergency-dagtype; privacy-gate end-to-end. |

### F. Sociaal, coach & ouder
| # | Feature | Status | Toelichting |
|---|---|---|---|
| F1 | Feed/Nieuws (Ontdekken) | 🟢 | Echte data, interesse-ranking, in-app reader. |
| F2 | Coach-portal | 🟢 | Roster → atleet → advies-plan adopteren (source=coach), privacy-gated. |
| F3 | Ouder-dashboard | 🟢 | Read-only welzijn/veiligheid; geen vermogensdata (by design). |
| — | Samen/Circle/Clubs/Trainingsgroepen | 🟢 (functie) / 🟡 (vindbaar) | Volledig werkend, maar **slecht ontsloten in navigatie** (zie §3). |

### Intelligentielaag (§4–5)
| Onderdeel | Status |
|---|---|
| Day-type engine (Emergency/Race-fases/Coach/Sparki/Recovery/Rest/General + Travel/Post-race) | 🟢 |
| Adaptieve homepage op atleetniveau | 🟢 |
| Observatie-/coach-engine (opportunity/risk/performance/recovery) | 🟢 |
| In-workout coaching | 🔴/⚪ |
| FTP-voorspelling (autonoom) | 🟡 |

### Datamodel & integraties (§7–8)
🟢 Uitgebreid en levend: `routes`, `races`, `social`, `connectors`/`data-hub`, `ai-memory`, `context-memory`, `intel`, `nutrition`, `material`, `photo-lab`, `push-subscriptions`, `notifications` e.v.a. — ruim voorbij de blueprint-lijst. Strava is de enige echte koppeling; de rest is eerlijk "voorbereid".

### Visueel & "persoonlijke beleving" (Prioriteit 4 — grotendeels NET-NIEUW)
| Onderdeel | Status |
|---|---|
| Cinematic-achtergrond-renderer | 🟢 (sterk; maar **statisch** — past zich nog niet aan tijd/seizoen/weer/fase) |
| Profielfoto's: upload/opslag | 🟡 (Photo-Lab + object-storage bestaat) — **bijsnijden/meerdere/vervangen/verwijderen = nieuw** |
| AI-sportbeelden genereren (Alpen/gravel/sprint…) | 🔴 (alleen "relight" van bestaande foto bestaat) |
| Dynamische achtergrondkeuze-logica | 🔴 (renderer klaar, beslissingslogica nieuw) |
| Prestatiekaarten (PR's/badges/mijlpalen, deelbaar) | 🔴 (data-signalen in `intel` bestaan; visuele kaarten nieuw) |

---

## 2. Geconsolideerde gatenlijst — wat rest vóór "V1 compleet"

**Echt ontbrekend (🔴):**
1. **Power/duration-curve** (Lab D2) — datamodel uit sessies (mean-maximal) + UI.
2. **Publieke routebibliotheek / ontdekpagina + zoeken/filteren** (B5).
3. **Route-lijn slepen / rubber-band reroute** (B1b).
4. **Meeting Point Optimizer** (B4) — vereist deelnemerslocatie-input.

**Afmaken (🟡):**
5. **Per-training fueling-tijdlijn** (A4).
6. **Lange-termijn seizoenstijdlijn** met A-races + FTP-ontwikkeling (C6).
7. **Seizoens-FTP-voorspelling als grafiek** (D5).
8. **Slaap-uren als dagmetriek** (E4) — kleine toevoeging aan check-in.
9. **Turn-by-turn voor geïmporteerde GPX** (B6) — `nav` afleiden.
10. **Navigatie-ontsluiting** van Samen/Routes/Clubs/Trainingsgroepen (Prioriteit 3).

**Bewust uitstellen / buiten web-scope (⚪, eerlijk markeren):**
- In-workout live coaching (A6) — geen betrouwbare live sensor-stream in de browser.
- Garmin/Komoot/Wahoo/TrainingPeaks echte koppeling — afhankelijk van OAuth/integratie-toegang.

**Prioriteit 4 (persoonlijke beleving) = grotendeels nieuwe uitbreiding**, niet "V1-afmaken". Volgens jouw eigen richtlijn ("eerst compleet, geen nieuwe grote modules tot V1 af") hoort dit ná de gatenlijst hierboven — zie §4 voor mijn voorstel.

---

## 3. Navigatie (Prioriteit 3) — bevinding

Huidige bottom-nav (atleet): Vandaag · Activiteiten · Ontdekken · Trainen · Jij.
**Verstopt:** Samen-trainen (`/samen`), Routes/Routeplanner (in `/train`), Clubs (in `/you`), Trainingsgroepen (in `/samen`). Voor een sociale/route-feature die je vaak gebruikt is dit te diep weggestopt. Aanbeveling in §4.

---

## 4. Aanbevolen volgorde + verbetervoorstellen (ter goedkeuring)

Conform jouw richtlijn **eerst compleet → dan optimaliseren → dan uitbreiden**:

**Blok 1 — Routeplanner compleet maken (jouw Prioriteit 2).** Sleep-edit van de route-lijn, publieke/persoonlijke routebibliotheek met zoeken/filteren, GPX-import turn-by-turn, koppeling route↔training en route↔Samen verstevigen. Architectuur nu al voorbereiden op een latere "slimme routeplanner" (intentie→routevoorstel).

**Blok 2 — Navigatie ontsluiten (Prioriteit 3).** Voorstel: voeg **"Samen"** toe als primair nav-item (of een "Ontdekken"-hub die Samen/Routes/Clubs/Trainingsgroepen bovenaan toont). *Dit raakt de hoofd-UX → ik lever eerst een kort voorstel met 1–2 nav-varianten voordat ik wijzig.*

**Blok 3 — Analyse-gaten dichten.** Power-curve (D2), seizoenstijdlijn (C6), FTP-voorspelling-grafiek (D5), per-training fueling (A4), slaap-uren (E4).

**Blok 4 — Samen-pagina herordenen (Prioriteit 5).** *Vereist eerst voorstel (volgorde kaarten/CTA's) — ik lever dat los op.*

**Blok 5 — Productieproces robuust (Prioriteit 6).** Automatische release-checks: migraties uitgevoerd, schema-sync dev↔prod, ontbrekende tabellen/kolommen, deploy-health. Sluit aan op de bestaande health-check-engine.

**Blok 6 — Persoonlijke beleving / AI-beelden (Prioriteit 4).** Grote nieuwe module → modulair opzetten (profielfoto-beheer → AI-sportbeelden met toestemming → dynamische achtergrondkeuze → prestatiekaarten). *Vereist akkoord op scope + eerst een ontwerpvoorstel; conflicteert deels met "geen nieuwe grote modules tot V1 af" — daarom bewust ná blokken 1–5.*

**Blok 7 — Mentale training / sterrensysteem (Prioriteit 7).** *Vereist eerst ontwerpvoorstel.* Pas ná stabiliteit.

**Blok 8 — Visuele afwerking (Prioriteit 8).** Animaties, overgangen, micro-interacties, laadanimaties. Als laatste.

### Open beslissingen die ik aan jou voorleg
- **A6 in-workout coaching** en **echte Garmin/Komoot-koppelingen**: akkoord om deze eerlijk als "buiten huidige web-scope / volgende fase" te markeren in plaats van te forceren?
- **Prioriteit 4-scope**: volledige module nu plannen, of eerst alleen **profielfoto-beheer + dynamische achtergrondkeuze** (kleinste premium-winst, laagste risico) en de AI-beeldgeneratie als aparte vervolgstap?
- **Navigatie-variant** (blok 2) en **Samen-herordening** (blok 4): ik lever beide eerst als voorstel — bevestig dat je die voorstel-eerst-aanpak wilt.
