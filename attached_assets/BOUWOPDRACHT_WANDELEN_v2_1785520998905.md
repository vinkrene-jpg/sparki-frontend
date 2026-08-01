# BOUWOPDRACHT — WANDELEN IN ROUTES EN NAVIGATIE (v2)

**Opdrachtgever:** René — Founder, Sparki
**Datum:** 31 juli 2026
**Taak:** #536
**Vervangt:** `BOUWOPDRACHT_WANDELEN_VOLLEDIG_1785520065211.md` volledig. Gebruik uitsluitend deze versie.

## Wat er is gewijzigd ten opzichte van v1

| Onderdeel | v1 | v2 |
|---|---|---|
| Fase F3, pakketgrens | "bewaren zit achter Go" | **fout.** Gratis mag 3 routes bewaren, 30 dagen, en houdt de basisbibliotheek (SPARKI-BESLUIT-2026-002 en -003) |
| Test bewaren | "geblokkeerd op Gratis" | toegestaan tot 3, de vierde geweigerd |
| Mirror-scenario 3 | "bewaren als Gratis: geblokkeerd" | toegestaan tot 3, de vierde geweigerd |
| Voorwaarde vooraf | `ROUTE_PAKKET_02` als één blok | de volledige reeks 01 t/m 02d, elk met Mirror-goedkeuring |
| Fase E, na afloop | "geen analyse, punt" | wandelingen terugzien is een **aparte, latere opdracht**; deze opdracht toont alleen wat de navigatiesessie zelf oplevert |

De fout in v1 kwam voort uit een oudere pakketgrens, van vóór het synchronisatiepakket van 31 juli.

## Doel in één zin

Een wandelaar kan zich aanmelden, een wandelroute plannen, bewaren, exporteren en navigeren, en ziet daarbij nergens fietsonderdelen of fietstaal — zonder dat er ook maar iets verandert voor een fietser.

## Vastgestelde besluiten die deze opdracht uitvoert

1. Wandelen wordt onderdeel van **Gratis en Go**. Geen apart product, geen aparte prijs. "Go wandelen" is Go zonder de fietsonderdelen.
2. De afbakening van **deze** opdracht is routeplanning en navigatie.
3. Wandel- en fietsroutes delen **één potje** voor de gratis maandlimiet van 8 gebruikte routes. Geen telling per sport.

## Voorwaarde vooraf — niet starten zonder dit

Deze opdracht start pas na **expliciete vrijgave door René** én **Mirror-goedkeuring van de volledige reeks `ROUTE_PAKKET_01` tot en met `02d`**.

Reden: er bestaat vandaag geen vastlegging van een gereden of gelopen navigatiesessie. In het schema staat alleen `nav-settings.ts` — geen navigatiesessie, geen afgelegd percentage, geen gebruikstelling. Die laag komt uit `02a` (meten) en `02b` (limiet en reserveringen). Deze opdracht bouwt daarop voort.

Bij start: bevestig de SHA, controleer dat navigatiesessie, afgelegd percentage en teller op `PROVEN_READY` staan, en meld afwijkingen **vóór** je begint te bouwen.

## Bouw tegen één vaste commit-SHA

De vindplaatsen hieronder zijn geverifieerd op commit `9ace581`. `main` is daarna doorgelopen; regelnummers kunnen verschoven zijn. Kies één actuele SHA, noem die in het eindrapport, bouw en test daar volledig tegen.

---

# Wat er al is — niet opnieuw bouwen

De routelaag is sportbewust gebouwd:

| Onderdeel | Vindplaats |
|---|---|
| `sports = ["cycling","running","walking","hiking"]` | `artifacts/api-server/src/lib/routing/profile-selection.ts` |
| `selectProfile` → `foot-walking` / `foot-hiking` | idem |
| Wegdek: `foot-walking` → asfalt, `foot-hiking` → pad | idem, `profileToSurface` |
| Kruissnelheid wandelen 5 km/h | idem, `profileCruisingSpeedKmh` |
| GraphHopper `foot-walking` → `foot`, `foot-hiking` → `hike` | `lib/routing/providers/graphhopper.ts` |
| Aparte `FOOT_AVOID` naast `CYCLING_AVOID` | `lib/routing/providers/ors.ts` |

Geen tweede routemotor, geen parallel profielsysteem, geen nieuwe sportabstractie naast `Sport`.

---

# Fase A — Sport door de keten

**A1.** `lib/plan-routes.ts` geeft vandaag `sport: "cycling"` hardgecodeerd mee. Dat wordt een echte parameter vanaf het verzoek. Ontbreekt de sport, dan afwijzen met een duidelijke fout — geen stilzwijgende aanname.

**A2.** Schema. `lib/db/src/schema/route-library.ts` heeft `bikeType: text("bike_type").notNull()`.
- voeg een `sport`-kolom toe;
- maak `bike_type` nullable, uitsluitend geldig wanneer `sport = 'cycling'`;
- bestaande rijen krijgen bij migratie `sport = 'cycling'` en behouden hun `bike_type` ongewijzigd;
- geen bestaande gebruikersdata verliezen.

**A3.** GPX. Export van een wandelroute draagt de sport mee. Bij import zonder sport wordt **niet** stilzwijgend `"cycling"` aangenomen — `lib/activity-file-ingest.ts` doet dat vandaag wel. Vraag het de gebruiker, of markeer als onbekend en behandel onbekend fail-closed.

---

# Fase B — De geschiktheidspoort per sport

**Zwaartepunt van de opdracht.** `lib/route-surfaces.ts` is 993 regels, `lib/routing/loop-quality.ts` 923, met afnemers in routezoeken, gereden-routekandidaten en route-opmerkingen.

Een trap, een voetpad of een onverhard bospad is voor een wandelaar precies goed en voor een racefiets een harde afkeuring.

- de poort weet welke sport hij beoordeelt en past de bijbehorende regels toe;
- een wandelroute wordt nooit met fietsregels afgekeurd;
- een route die als wandelroute is gegenereerd wordt nooit als fietsroute aangeboden, hergebruikt of voorgesteld zonder volledige herbeoordeling tegen de fietsregels;
- **fail-closed blijft leidend**: onbekende sport, ontbrekend oordeel of een fout in de beoordeling betekent blokkeren, niet doorlaten. Dit versoepelt onder geen enkele omstandigheid voor wandelroutes;
- bestaande fietsuitkomsten veranderen niet — volledig herbewijs op de bestaande fietsscenario's.

---

# Fase C — Onboarding

`lib/onboarding-questions.ts` leidt vandaag uit het ervaringsniveau een geschatte FTP af. Een wandelaar krijgt daarmee wielrenvragen en een verzonnen vermogen.

**C1.** Sportkeuze vooraan in de onboarding: fietsen of wandelen.
**C2.** Bij wandelen vervallen alle wielrenspecifieke vragen en afleidingen: geen ervaringsniveau-naar-FTP, geen geschat vermogen, geen wekelijkse trainingsuren, geen fietstype.
**C3.** Voor een wandelaar wordt **geen geschatte FTP of trainingsdoel weggeschreven**. Leeg is eerlijk; een verzonnen getal is precies wat Sparki niet doet.
**C4.** Wie later ook wil fietsen, zet dat aan zonder opnieuw te beginnen. Sport is geen eenmalige keuze bij aanmelding.

---

# Fase D — Taal en interface, begrensd

"Rit" komt in 47 frontendbestanden voor, "fiets" in 65, "renner" in 43.

**Een app-brede hernoeming is verboden.** Zoek-en-vervang over de hele frontend raakt trainings- en wedstrijdschermen die een wandelaar nooit ziet, en levert een onreviewbare diff op.

**D1.** Pas alleen de schermen aan die een wandelaar passeert: onboarding, planner, routebibliotheek, navigatiescherm, en de bevestiging na afloop.
**D2.** Op die schermen is de taal sportafhankelijk. Een wandelaar leest "wandeling", "gelopen", "afstand"; een fietser leest exact wat hij nu leest.
**D3.** Fietsonderdelen zijn voor een wandelaar niet zichtbaar: fietstypekeuze, garage, materiaal.
**D4.** Lever een lijst van de aangepaste schermen. Alles daarbuiten blijft ongemoeid — dat is een acceptatievoorwaarde, geen tekortkoming.

---

# Fase E — Navigatie en afronding

**E1.** Herberekenen onderweg gebruikt hetzelfde profiel waarmee de route is gemaakt. Gesproken aanwijzingen komen van de provider en volgen het profiel. Bewijs dat het klopt; bouw niets nieuws tenzij een test aantoont dat het nodig is.

**E2.** Na afloop toont deze opdracht uitsluitend wat de navigatiesessie uit `02a`/`02b` zelf al oplevert: afgelegde afstand, tijd, en of de route is afgerond.

**E3.** **Wandelingen terugzien is een aparte, latere opdracht.** René heeft besloten dat wandelingen ook uit Strava en Garmin moeten komen, dat ze over tijd vergelijkbaar moeten zijn, en dat hoogtemeters, hoogteprofiel, tempo per kilometer en hartslag erbij horen. Dat raakt de volledige activiteitenketen en hoort niet in een route- en navigatieopdracht. Bouw daar in #536 **niets** van vooruit: geen velden, geen migraties, geen schermen, geen vlaggen.

---

# Fase F — Teller en pakketgrenzen

**F1.** Eén gedeeld potje van 8 gebruikte routes per kalendermaand voor alle sporten samen. **Voeg geen sportdimensie toe aan de teller.**

**F2.** De gebruikssoorten uit `02a` blijven gelden. De soort die daar "gereden" heet, telt voor wandelen op dezelfde manier zodra de route voor minstens 20% is afgelegd. Alleen de klantgerichte tekst wordt sportafhankelijk.

**F3.** De Gratis/Go-grens geldt voor wandelen identiek aan fietsen, volgens SPARKI-BESLUIT-2026-002 en -003:

- **gratis**: plannen en genereren, aanpassen op afstand/tijd/wegtype/hoogte/wind, bekijken, GPX-export, afslag-voor-afslag navigatie, spraakaanwijzingen, hoogteprofiel met schuifbalk, en de basisbibliotheek — eigen routes zien, openen en verwijderen;
- **gratis bewaren**: maximaal 3 routes tegelijk, bewaartermijn 30 dagen;
- **Go**: uitgebreid bibliotheekbeheer, waaronder zoeken en sorteren.

Geen aparte wandelgrens.

---

# Uitdrukkelijk buiten scope

Training, trainingsplan, analyse van een afgelegde activiteit, belastbaarheid, herstel, voorspelling, materiaal, garage, wedstrijd, AI-begeleiding, en het terugzien van wandelactiviteiten (zie E3).

Geen sportdimensie in het activiteiten- of analysemodel.

**Hardlopen en hiken worden niet opengesteld**, ook al kent de routemotor die profielen. Alleen `walking` wordt bereikbaar voor de gebruiker.

---

# Te leveren bewijs

1. Gewijzigde bestanden met start-SHA, eind-SHA en reden per wijziging.
2. Migratie uitgevoerd op een verse database én op een kopie met bestaande routes, met rijaantallen voor en na.
3. Lijst van aangepaste schermen (fase D).
4. Automatische tests, minimaal:
   - wandelroute genereren levert `foot-walking`;
   - een wandelroute over een voetpad of trap wordt **niet** geblokkeerd;
   - **dezelfde route** als fietsroute wordt **wél** geblokkeerd;
   - een bewaarde wandelroute komt niet terug in een fietsvoorstel;
   - ontbrekende of onbekende sport ⇒ geblokkeerd, niet doorgelaten;
   - herberekenen onderweg houdt het wandelprofiel vast;
   - bestaande route-bewaring met `bike_type` blijft werken na migratie;
   - onboarding als wandelaar schrijft géén geschatte FTP of trainingsdoel weg;
   - een wandelaar kan later fietsen aanzetten zonder opnieuw te beginnen;
   - de gebruiksteller telt wandel- en fietsroutes in hetzelfde potje van 8;
   - **een gratis gebruiker kan een wandelroute bewaren tot het maximum van 3; de vierde wordt geweigerd met begrijpelijke uitleg; de gratis basisbibliotheek werkt ook voor wandelroutes.**
5. **Volledig herbewijs van alle bestaande fietsscenario's**, met de uitkomst vóór en ná deze wijziging naast elkaar. Elke afwijking is een defect, geen bijwerking.
6. `typecheck` groen, alle bestaande testsuites groen.

# Mirror-scenario's

1. aanmelden als wandelaar: geen wielrenvragen, geen geschat vermogen in het profiel;
2. wandelroute plannen, exporteren en navigeren als gratis gebruiker;
3. **wandelroute bewaren als gratis gebruiker: toegestaan tot 3, de vierde geweigerd met begrijpelijke uitleg;**
4. idem als Go-gebruiker: uitgebreid bibliotheekbeheer werkt, fietsonderdelen zijn niet zichtbaar;
5. wandel- en fietsroute in dezelfde maand: tellen in hetzelfde potje van 8;
6. wandelroute over een trap of voetpad: niet geblokkeerd;
7. diezelfde route als fietsroute: wél geblokkeerd;
8. bestaande fietsroute uit de bibliotheek na migratie openen, navigeren en exporteren;
9. GPX zonder sport importeren: geen stilzwijgende aanname;
10. onderweg afwijken bij een wandelroute en laten herberekenen;
11. na afloop: afstand, tijd en afronding zichtbaar, en verder niets;
12. als wandelaar later fietsen aanzetten en een fietsroute plannen.

# Doelbestanden

- `docs/product/SPARKI_WANDELEN_ROUTES_EN_NAVIGATIE.md`
- `docs/SPARKI_MIRROR_WANDEL_TEST.md`

# Wat níét mag

Geen nieuwe abonnementsvorm, geen prijswijziging, geen nieuwe rol, geen tweede routemotor, geen versoepeling van de fail-closed poort, geen sportdimensie in het activiteiten- of analysemodel, geen app-brede hernoeming van fietstaal, en niets vooruitbouwen op het terugzien van wandelactiviteiten.
