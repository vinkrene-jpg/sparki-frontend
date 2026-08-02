# F9 — Ploegleider herindeling: voor & na

**Schermen:** de wedstrijd-room (`/wedstrijd-room`, pagina
`artifacts/sparki/src/pages/wedstrijd-room.tsx`) en de zichtbare ingang vanaf
het ploegleider-startpunt (`/rol-start/ploegleider`, data in
`artifacts/sparki/src/lib/role-start.ts`).
**Toestel:** telefoonformaat **402 × 874** (kleinste ondersteunde maat)
**Bewijs:** echte browserkliks tegen de **productiebuild** via de WP-S1-harnas
(`e2e/tests/f9-ploegleider.mjs`), Nix-chromium, echte Clerk-ticketlogin met het
QA-account (`x-dev-clerk-id`-pad), draaiende api-server. Screenshots in `voor/`
en `na/`. De "voor"-opnames zijn op HEAD `cf18daf9` vastgelegd vóór enige
codewijziging.

## Gemeten gaps (voor)

1. **Bereikbaarheidsgap** — de wedstrijd-room was alleen bereikbaar via
   `/races` (sporter-scherm) of een directe URL; het ploegleider-startpunt
   (`/rol-start/ploegleider`) linkte alleen naar `/club`.
2. **Room-blokken zonder tabs** — de room-detail toonde Foto's & clips, Updates
   en Dagcompilatie als drie blokken onder elkaar (zie
   `voor/ploegleider-mobiel-04-room-detail-fold.png`).
3. **Meerdere primaire acties** — in de room-detail stonden "Toevoegen",
   "Plaats" én "Maak dagcompilatie" tegelijk in beeld; in de roomlijst stond
   "+ Room" in de kop én een tweede "+ Room maken" in de lege toestand.
4. **Room aanmaken inline** — het aanmaakformulier verscheen inline in de
   roomlijst (`voor/ploegleider-mobiel-03-room-aanmaken.png`), geen
   stappenvenster.

## Meetbaar verschil (room-detail paginahoogte bij openen, 402×874)

| | Paginahoogte | Schermen scroll | Indeling |
|---|---|---|---|
| **Voor** | **1079 px** | **≈ 1,2** | drie blokken onder elkaar; scrollen voor Updates/Compilatie |
| **Na** | **874 px** | **≈ 1,0** | kop + dagdatum + 3 tabs; één onderdeel per tab, past boven de vouw |

## Voor

- `voor/ploegleider-mobiel-01-rolstart-fold.png` — ploegleider-startpunt (QA-
  account bezit de rol niet → fail-closed "Geen toegang"; de ingang is
  data-/testgeverifieerd, zie hieronder).
- `voor/ploegleider-mobiel-02-room-lijst-fold.png` — roomlijst met "+ Room" in
  de kop.
- `voor/ploegleider-mobiel-03-room-aanmaken.png` — aanmaken **inline** in de
  lijst.
- `voor/ploegleider-mobiel-04-room-detail-fold.png` — drie blokken onder elkaar,
  drie primaire acties zichtbaar, geen tabs.

## Na

- `na/ploegleider-mobiel-02-room-lijst-fold.png` — roomlijst: precies één
  primaire actie ("+ Room"); de lege toestand verwijst naar die knop i.p.v. een
  tweede knop te tonen.
- `na/ploegleider-mobiel-03-room-aanmaken.png` — aanmaken als **stappenvenster**
  over het scherm heen (BeheerSheet-patroon), met sluiten (X) en Escape als
  uitweg.
- `na/ploegleider-mobiel-04-room-detail-fold.png` — kop + dagdatum + **drie
  échte tabs** (Media / Updates / Compilatie); Media-onderdeel met één primaire
  actie ("Toevoegen") past boven de vouw.
- `na/ploegleider-mobiel-05-tab-media.png` · `-06-tab-updates.png` ·
  `-07-tab-compilatie.png` — elk onderdeel apart; per tab precies één primaire
  actie (Toevoegen / Plaats / Maak dagcompilatie).

## Per F9-regel

1. **Eén primaire actie per scherm (TUX-24)** — roomlijst: alleen "+ Room" in de
   kop. Room-detail: per zichtbare tab precies één primaire knop; omdat de tabs
   elkaar uitsluiten, staat er nooit meer dan één primaire actie in beeld.
2. **Max vier kaarten boven de vouw** — room-detail toont bij openen kop +
   dagdatum + tabbalk + één onderdeelkaart; ruim binnen vier.
3. **Twee tot vier échte tabs, geen lege tabs** — drie tabs (Media, Updates,
   Compilatie), elk met werkelijke inhoud.
4. **Beheeropties van onbevoegden weglaten** — n.v.t.: de wedstrijd-room is een
   enkelgebruiker-scherm (Fase 1); er zijn geen rolafhankelijke beheeropties om
   te verbergen.
5. **Details naar apart scherm / venster** — room-detail is al een apart scherm
   (via de roomlijst); room aanmaken is nu een apart stappenvenster.
6. **Meerstaps = stappenvenster met uitweg (TUX-25)** — room aanmaken opent als
   BeheerSheet met titel "Nieuwe room", knoppen "Room maken"/"Annuleren", en X +
   Escape als uitweg. Nooit doodlopend.
7. **Hoofdhandeling in beeld bij openen (TUX-26)** — de room-detail past nu in
   één scherm (874 px, geen scroll voor de hoofdhandeling).
8. **Rol + omgeving zichtbaar (TUX-28)** — via de bestaande
   ScreenShell-ContextRegel (op elke opname zichtbaar: "TESTOMGEVING · SPORTER"
   in dit QA-account).
9. **Bereikbaarheid hersteld (F3-grens)** — het ploegleider-startpunt
   (`role-start.ts`, rol `ploegleider`) heeft nu naast "Selecties & kalender"
   een tweede ingang: **"Wedstrijd-room (koersdag vastleggen)"** → `/wedstrijd-room`.
   Dit is alleen een link/kaart op wat al bestaat — geen nieuw rolstartscherm.
   De lege-toestandtekst is bijgewerkt zodat de room als werkende ingang wordt
   genoemd. Verificatie via de bestaande unit-test
   `src/lib/role-start.test.ts` (10/10 groen) en de navigatietest
   (`test:navigation`, 12/12 groen).

## Eerlijke beperkingen

- Het QA-account (`x-dev-clerk-id`-pad) bezit de clubrol **ploegleider** niet.
  De fail-closed rolbezit-poort in `/rol-start/:rol` toont daarom voor dit
  account "Geen toegang" (zie `voor/`- en `na/`-rolstart-opname). De nieuwe
  ingang is daardoor **niet** live op screenshot te tonen; hij is in plaats
  daarvan bewezen via de data (`role-start.ts`) en de groene unit-test, die
  toetst dat elk startpunt echte ingangen of een volledige lege toestand heeft.
  Een echte ploegleider ziet op zijn startpunt nu de kaart naar de
  wedstrijd-room.
- De wedstrijd-room is een enkelgebruiker-scherm (Fase 1). Er is geen
  ploegleider-specifieke data toegevoegd; de herindeling verplaatst en
  hergroepeert uitsluitend bestaande functionaliteit. Alles blijft bereikbaar.

## Verificatie

- `npx tsc --noEmit` — schoon (exit 0).
- `pnpm run test:navigation` — 12/12 groen.
- `src/lib/role-start.test.ts` — 10/10 groen (via `node --import tsx --test`;
  de tsx-wrapper crashte hier op omgevings-resourcedruk, geen testlogica).
- `node scripts/check-brand-copy.mjs` — geen verboden merkvermeldingen.

## Gewijzigde bestanden

- `artifacts/sparki/src/pages/wedstrijd-room.tsx` — roomlijst: één primaire
  actie + aanmaken als stappenvenster; room-detail: 3 HoofdstukTabs i.p.v. drie
  gestapelde blokken.
- `artifacts/sparki/src/lib/role-start.ts` — ploegleider-startpunt: ingang naar
  de wedstrijd-room + bijgewerkte lege-toestandtekst.
- `e2e/tests/f9-ploegleider.mjs` — nieuw bewijs-harnas (patroon van
  `f9-clubbeheer.mjs`).
