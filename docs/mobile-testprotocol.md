# Mobiel testprotocol — Sparki Navigatie (Expo)

Handmatig testprotocol voor de mobiele app (`artifacts/sparki-mobile`), gericht
op de productierijpheid van Golf 8: betrouwbare rit-synchronisatie, sensoren,
navigatie, val-detectie en diagnostiek. Voer dit uit op een echt toestel
(Expo Go of development build) — de simulator heeft geen echte GPS/BLE.

## Vooraf

- App gestart en ingelogd; API-server bereikbaar.
- Locatietoestemming verleend ("Altijd" voor achtergrond-opname).
- Voor BLE-tests: een echte sensor (hartslag/vermogen/cadans) bij de hand.
  In Expo Go is BLE eerlijk niet beschikbaar — de app meldt dat expliciet.

## 1. Rit opnemen en synchroniseren (idempotent)

1. Start een opname, beweeg minstens een paar honderd meter, stop de rit.
2. Verwacht: de rit wordt geüpload en verschijnt bij Activiteiten.
3. **Offline-pad:** zet vliegtuigstand aan, rijd en stop een rit.
   - Verwacht: de rit staat veilig in de wachtrij (banner op het startscherm,
     zichtbaar in Diagnostiek), met eerlijke foutmelding — niets gaat verloren.
4. Zet netwerk weer aan en open de app (of tik "Nu opnieuw proberen" in
   Diagnostiek).
   - Verwacht: de rit wordt alsnog geüpload en verdwijnt uit de wachtrij.
5. **Geen duplicaten:** tik tijdens slecht netwerk meermaals op opnieuw
   proberen. Verwacht: de activiteit staat precies één keer in Activiteiten
   (de backend ontdubbelt op de GPX-inhoud).
6. **Bewust weggooien:** zet een rit in de wachtrij en kies "Verwijderen" in
   Diagnostiek. Verwacht: bevestigingsvraag, daarna is de rit definitief weg.

## 2. Opname op de achtergrond

1. Start een opname, vergrendel de telefoon of wissel naar een andere app,
   beweeg enkele minuten.
2. Verwacht: na terugkeer loopt het spoor gewoon door (geen gat), afstand en
   duur kloppen.

## 3. BLE-sensoren

1. Koppel een sensor; controleer live waarden tijdens de rit.
2. Zet de sensor kort uit en weer aan.
   - Verwacht: automatisch herverbinden zonder handmatige actie; tijdens de
     onderbreking geen verzonnen waarden (leeg/eerlijk "geen verbinding").
3. Controleer of het batterijniveau wordt getoond wanneer de sensor dat meldt.
4. Sla de rit op. Verwacht: sensorwaarden staan in de opgeslagen activiteit
   (samenvatting komt overeen met wat er echt gemeten is).

## 4. Navigatie

1. Start navigatie op een opgeslagen route.
2. **Van de route af:** wijk bewust ~100 m af.
   - Verwacht: de app biedt een echte, gerouteerde terugweg aan (geen rechte
     lijn); de omweg verdwijnt vanzelf zodra je de route weer volgt.
3. **App-herstart:** sluit de app volledig tijdens het navigeren en open hem
   opnieuw.
   - Verwacht: op het startscherm staat "Navigatie hervatten"; hervatten
     brengt je terug in dezelfde navigatie. Wegvegen ruimt de kaart op.
4. **Offline:** zet vliegtuigstand aan tijdens het navigeren.
   - Verwacht: de route en aanwijzingen blijven werken op de lokaal bewaarde
     gegevens; alleen functies die echt netwerk vergen melden dat eerlijk.
5. **Waypoints & finish:** navigeer een route met tussenwaypoints.
   - Verwacht: GEEN finishvlag, geluid of gesproken "aankomst" bij een
     waypoint; alleen de echte eindbestemming geeft de aankomstmelding.
   - Een via-tussenstop (omrij-punt) toont hoogstens een stille regel
     "Tussenstop" in de lijst — nooit geluid of spraak.
6. **Geluidssignalen:** rijd naar een afslag met geluid aan.
   - Verwacht: vooraankondigingstoon en afslagtoon per afslag, precies één
     keer per stap/fase (nooit dubbel bij GPS-ruis); scherpe bochten klinken
     anders; van-de-route klinkt één keer per afwijking.
7. **Gesproken aanwijzingen:** zet spraak aan.
   - Verwacht: tijdige melding vóór de afslag (afstand afhankelijk van
     snelheid), niet dubbel, ook met het scherm uit (achtergrond); met de
     telefoon op stil/volume laag hoor je niets — de app forceert niets.
8. **Schakelaars direct van kracht:** zet "Geluidssignalen" of "Gesproken
   aanwijzingen" uit via de knoppen in het navigatiescherm of via
   Routes → Navigatie-instellingen (web).
   - Verwacht: direct stil tijdens de actieve navigatie, keuze blijft bewaard
     (ook offline lokaal) en geldt web én mobiel.

## 5. Val-detectie (eerlijk)

1. Simuleer een val: rijd/beweeg ≥ 20 km/u (fiets of auto als passagier) en
   stop daarna abrupt (< 3 km/u) en blijf 15 s stil.
   - Verwacht: het scherm "Alles oké?" verschijnt met afteltimer (30 s).
2. Tik "Ik ben oké". Verwacht: melding weg, 5 minuten lang geen nieuwe vraag.
3. Laat de teller aflopen of tik "Waarschuw nu".
   - Verwacht: de app zegt eerlijk dat meldingen zijn **klaargezet** — nooit
     dat iemand daadwerkelijk bereikt is. "Bel 112" opent de telefoon.
4. Gewoon stoppen bij een stoplicht na langzaam rijden mag NOOIT een melding
   geven (er is dan geen snelle fase binnen 30 s vooraf).

## 6. Bordjes-sprints

1. Rijd een route met sprintbordjes en sprint over een bordje.
   - Verwacht: één resultaat per bordje, ook bij slecht netwerk of dubbele
     verzending (de server ontdubbelt per sprint-moment).

## 7. Diagnostiek

1. Open het Diagnostiek-scherm.
   - Verwacht: eerlijke weergave van de upload-wachtrij (aantal pogingen,
     laatste fout, tijdstip), knop "Nu opnieuw proberen" met resultaatregel
     (geüpload/mislukt), en verwijderen met bevestiging.

## Geautomatiseerde tests

Vanuit `artifacts/sparki-mobile`:

- `pnpm run test:upload-queue` — wachtrij-helpers (idempotentie, backoff)
- `pnpm run test:fall-detection` — val-detectie-toestandsmachine
- `pnpm run test:ride-tracker` — rit-opname (voor-/achtergrondbuffer)
- `pnpm run test:ride-sensor-summary` — sensorsamenvatting ↔ GPX in lockstep
- `pnpm run test:nav-cues` — cue-engine (waypoints stil, dedupe, timing)

Vanuit `artifacts/api-server` (via shell):

- `pnpm run test:nav-sanitize` — waypoint-aankomsten server-side opgeschoond

Bij drukte in de omgeving kan de testrunner crashen op procesdruk; draai de
test dan direct: `npx tsx --test lib/<naam>.test.ts`.
