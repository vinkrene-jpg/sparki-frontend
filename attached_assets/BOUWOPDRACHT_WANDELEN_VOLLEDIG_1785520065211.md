# BOUWOPDRACHT — WANDELEN BRUIKBAAR MAKEN (ROUTES EN NAVIGATIE)

**Opdrachtgever:** René — Founder, Sparki
**Datum:** 31 juli 2026
**Aard:** bouwopdracht. Bouwen, testen, bewijs leveren.
**Vervangt** de eerdere opdracht "Wandelen in routeplanning en navigatie" volledig.

## Doel in één zin

Een wandelaar kan zich aanmelden, een wandelroute plannen, bewaren, exporteren en navigeren, en ziet daarbij nergens fietsonderdelen of fietstaal — zonder dat er ook maar iets verandert voor een fietser.

## Vastgestelde besluiten die deze opdracht uitvoert

1. Wandelen wordt onderdeel van **Gratis en Go**. Geen apart product, geen aparte prijs. "Go wandelen" is Go zonder de fietsonderdelen.
2. De afbakening blijft **routeplanning en navigatie**. Er komt géén training, trainingsplan, belastbaarheid, herstel, materiaal, garage, wedstrijd of AI-begeleiding voor wandelen.
3. Wandel- en fietsroutes delen **één potje** voor de gratis maandlimiet van 8 gebruikte routes. Geen telling per sport.

## Volgorde — lees dit eerst

Deze opdracht is **afhankelijk van `ROUTE_PAKKET_02`** en mag daar niet parallel aan lopen.

Reden: er bestaat vandaag geen vastlegging van een gereden of gelopen navigatiesessie. In het schema staat alleen `nav-settings.ts`; er is geen navigatiesessie, geen afgelegd percentage en geen gebruikstelling. `ROUTE_PAKKET_02` bouwt dat. Deze opdracht bouwt erbovenop en past dezelfde teller aan. Twee opdrachten tegelijk in die code betekent dat je bij een fout niet weet welke hem veroorzaakte.

**Bouw `ROUTE_PAKKET_02` eerst af, inclusief bewijs. Start daarna pas hiermee.**

## Bouw tegen één vaste commit-SHA

De vindplaatsen hieronder zijn geverifieerd op commit `9ace581`. `main` is daarna doorgelopen, dus regelnummers kunnen verschoven zijn. Kies vóór de start één actuele SHA, noem die in het eindrapport, bouw en test daar volledig tegen.

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

**A1.** `artifacts/api-server/src/lib/plan-routes.ts` geeft vandaag `sport: "cycling"` hardgecodeerd mee. Dat wordt een echte parameter vanaf het verzoek. Ontbreekt de sport, dan afwijzen met een duidelijke fout — geen stilzwijgende aanname.

**A2.** Schema. `lib/db/src/schema/route-library.ts` heeft `bikeType: text("bike_type").notNull()`. Een wandelroute heeft daar geen geldige waarde.
- voeg een `sport`-kolom toe;
- maak `bike_type` nullable, uitsluitend geldig wanneer `sport = 'cycling'`;
- bestaande rijen krijgen bij migratie `sport = 'cycling'` en behouden hun `bike_type` ongewijzigd;
- geen bestaande gebruikersdata verliezen.

**A3.** GPX. Export van een wandelroute draagt de sport mee. Bij import zonder sport wordt **niet** stilzwijgend `"cycling"` aangenomen — `lib/activity-file-ingest.ts` doet dat vandaag wel. Vraag het de gebruiker, of markeer als onbekend en behandel onbekend fail-closed.

---

# Fase B — De geschiktheidspoort per sport

**Dit is het zwaartepunt van de opdracht.** Onderschat het niet: `lib/route-surfaces.ts` is 993 regels en `lib/routing/loop-quality.ts` 923, en er hangen afnemers aan in routezoeken, gereden-routekandidaten en route-opmerkingen.

Het fietsgeschiktheids- en blokkadesysteem beoordeelt routes vandaag met fietsregels. Een trap, een voetpad of een onverhard bospad is voor een wandelaar precies goed en voor een racefiets een harde afkeuring.

Eisen:

- de poort weet welke sport hij beoordeelt en past de bijbehorende regels toe;
- een wandelroute wordt nooit met fietsregels afgekeurd;
- een route die als wandelroute is gegenereerd wordt nooit als fietsroute aangeboden, hergebruikt of uit de bibliotheek voorgesteld zonder volledige herbeoordeling tegen de fietsregels;
- **fail-closed blijft leidend**: onbekende sport, ontbrekend oordeel of een fout in de beoordeling betekent blokkeren, niet doorlaten. Dit versoepelt onder geen enkele omstandigheid voor wandelroutes;
- de bestaande fietsuitkomsten veranderen niet — bewijs met een volledig herbewijs op de bestaande fietsscenario's.

---

# Fase C — Onboarding

Een nieuwe gebruiker wordt vandaag als renner binnengehaald. `lib/onboarding-questions.ts` leidt uit het ervaringsniveau een geschatte FTP af. Een wandelaar krijgt daarmee wielrenvragen en een geschat vermogen dat nergens op slaat.

**C1.** De sportkeuze komt vooraan in de onboarding: fietsen of wandelen.

**C2.** Kiest iemand wandelen, dan vervallen alle wielrenspecifieke vragen en afleidingen: geen ervaringsniveau-naar-FTP, geen geschat vermogen, geen wekelijkse trainingsuren, geen fietstype.

**C3.** Er wordt voor een wandelaar **geen geschatte FTP of trainingsdoel weggeschreven**. Een leeg veld is eerlijk; een verzonnen getal is precies wat Sparki niet doet.

**C4.** Iemand die later ook wil fietsen moet dat kunnen aanzetten zonder opnieuw te beginnen. Sport is geen eenmalige keuze bij aanmelding.

---

# Fase D — Taal en interface, begrensd

De app is doortrokken van fietstaal: "rit" komt in 47 frontendbestanden voor, "fiets" in 65, "renner" in 43.

**Dit wordt uitdrukkelijk géén app-brede hernoeming.** Zoek-en-vervang over de hele frontend is verboden — dat raakt trainings- en wedstrijdschermen die een wandelaar nooit ziet, en levert een onreviewbare diff op.

**D1.** Pas alleen de schermen aan die een wandelaar daadwerkelijk passeert: onboarding, de planner, de routebibliotheek, het navigatiescherm, en de bevestiging na afloop.

**D2.** Op die schermen is de taal sportafhankelijk. Een wandelaar leest "wandeling", "gelopen", "afstand"; een fietser leest exact wat hij nu leest. Ongewijzigd voor fietsers.

**D3.** Fietsonderdelen zijn voor een wandelaar niet zichtbaar: fietstypekeuze, garage, materiaal.

**D4.** Lever een lijst van de aangepaste schermen. Alles daarbuiten blijft ongemoeid en dat is een acceptatievoorwaarde, geen tekortkoming.

---

# Fase E — Navigatie en afronding

**E1.** Herberekenen onderweg gebruikt hetzelfde profiel waarmee de route is gemaakt. Gesproken aanwijzingen komen van de provider en volgen het profiel. Verwachting: dit werkt mee zodra sport wordt doorgegeven — bewijs dat, bouw niets nieuws tenzij een test aantoont dat het nodig is.

**E2.** Na afloop ziet de wandelaar uitsluitend wat de navigatiesessie uit `ROUTE_PAKKET_02` zelf al oplevert: afgelegde afstand, tijd, en of de route is afgerond.

**E3.** Dat is **geen analyse**. Geen tempo-oordeel, geen inspanning, geen belasting, geen advies, geen vergelijking met eerdere wandelingen, geen trend. Wordt daar meer gevraagd of bedacht, dan is dat een nieuwe opdracht en een nieuw besluit van René.

---

# Fase F — Teller en pakketgrenzen

**F1.** Eén gedeeld potje van 8 gebruikte routes per kalendermaand voor alle sporten samen. **Voeg geen sportdimensie toe aan de teller.**

**F2.** De bestaande gebruikssoorten blijven gelden. De soort die in `ROUTE_PAKKET_02` "gereden" heet, telt voor wandelen op dezelfde manier zodra de route voor minstens 20% is afgelegd. Alleen de klantgerichte tekst wordt sportafhankelijk.

**F3.** De Gratis/Go-grens geldt voor wandelen identiek aan fietsen: plannen is gratis, bewaren zit achter Go, exporteren en navigeren zijn gratis. Geen aparte wandelgrens.

---

# Uitdrukkelijk buiten scope

Training, trainingsplan, analyse van een afgelegde activiteit, belastbaarheid, herstel, voorspelling, materiaal, garage, wedstrijd, AI-begeleiding, Strava- en Garmin-koppeling voor wandelactiviteiten.

Er komt in deze opdracht **geen sportdimensie in het activiteiten- of analysemodel**.

**Hardlopen en hiken worden niet opengesteld**, ook al kent de routemotor die profielen al. Alleen `walking` wordt bereikbaar voor de gebruiker.

---

# Te leveren bewijs

1. Gewijzigde bestanden met commit-SHA en reden per wijziging.
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
   - bewaren van een wandelroute is geblokkeerd op Gratis en toegestaan op Go.
5. **Volledig herbewijs van alle bestaande fietsscenario's**, met de uitkomst vóór en ná deze wijziging naast elkaar. Elke afwijking is een defect, geen bijwerking.
6. `typecheck` groen, alle bestaande testsuites groen.

# Mirror-scenario's

Te toetsen ná oplevering, niet door de bouwer:

1. aanmelden als wandelaar: geen wielrenvragen, geen geschat vermogen in het profiel;
2. wandelroute plannen, exporteren en navigeren als gratis gebruiker;
3. wandelroute bewaren als gratis gebruiker: geblokkeerd met begrijpelijke uitleg;
4. idem als Go-gebruiker: toegestaan, en fietsonderdelen zijn niet zichtbaar;
5. wandel- en fietsroute in dezelfde maand: tellen in hetzelfde potje van 8;
6. wandelroute over een trap of voetpad: niet geblokkeerd;
7. diezelfde route als fietsroute: wél geblokkeerd;
8. bestaande fietsroute uit de bibliotheek na migratie openen, navigeren en exporteren;
9. GPX zonder sport importeren: geen stilzwijgende aanname;
10. onderweg afwijken bij een wandelroute en laten herberekenen;
11. na afloop: afstand, tijd en afronding zichtbaar, en verder niets;
12. als wandelaar later fietsen aanzetten en een fietsroute plannen.

# Doelbestanden

- `docs/product/SPARKI_WANDELEN_ROUTES_EN_NAVIGATIE.md` — wat is gebouwd, welke regels per sport gelden, welke schermen zijn aangepast, wat buiten scope bleef
- `docs/SPARKI_MIRROR_WANDEL_TEST.md` — de twaalf scenario's met verwachte uitkomst

# Wat níét mag

Geen nieuwe abonnementsvorm, geen prijswijziging, geen nieuwe rol, geen tweede routemotor, geen versoepeling van de fail-closed poort, geen sportdimensie in het activiteiten- of analysemodel, en geen app-brede hernoeming van fietstaal.
