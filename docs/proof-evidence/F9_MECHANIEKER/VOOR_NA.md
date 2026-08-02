# F9 — Mechanieker herindeling: voor & na

**Scherm:** `/mechanieker` (pagina `artifacts/sparki/src/pages/mechanieker.tsx`)
**Toestel:** telefoonformaat **402 × 874** (kleinste ondersteunde maat)
**Bewijs:** echte browserkliks tegen de **productiebuild** via de WP-S1-harnas
(`e2e/tests/f9-mechanieker.mjs`), Nix-chromium, echte Clerk-ticketlogin met het
QA-account (`x-dev-clerk-id`-pad), draaiende api-server. Screenshots in `voor/`
en `na/`. De VOOR-opname is gemaakt van de HEAD-versie (mijn wijzigingen
tijdelijk weggestasht) vóór de herindeling.

## Meetbaar verschil (paginahoogte bij openen, 402×874)

| | Paginahoogte | Schermen scroll | Indeling |
|---|---|---|---|
| **Voor** | **3926 px** | **≈ 4,5** | één lange scroll: 9 secties onder elkaar (signalen, 3D-werkblad, garage, uitrusting, sensoren, ontwikkelingen, pro-teams, vergelijkingstest + modelschatting inline, materiaalcoach) |
| **Na** | **874 px** | **≈ 1,0** | kop + één hoofdactie + 4 tabs; rest per tab/venster |

De hoofdhandeling en kerninformatie staan **na** in beeld bij openen
(`na/mechanieker-mobiel-01-mechanieker-fold.png`): de primaire knop
"Materiaalfoto beoordelen", de vier tabs én de eerste kerninfo
(onderhoudssignalen) passen boven de vouw.

## Voor

- `voor/mechanieker-mobiel-01-mechanieker-fold.png` — bij openen; geen keuzelaag,
  direct de sectie Onderhoudssignalen en meteen daaronder de Fietsengarage.
- `voor/mechanieker-mobiel-02-…-scroll-1.png` en `-03-…-scroll-2.png` — diep in
  de scroll: garage-onderdelen en de inline-vergelijkingstest met
  modelschatting als lange formulieren (TUX-24/25/27-overtreding:
  hoofdhandelingen alleen bereikbaar na fors scrollen; test/schatting als één
  lang inline-blok).

## Na

- `na/mechanieker-mobiel-01-mechanieker-fold.png` — hoofdactie + tabs +
  kerninfo in beeld.
- `na/mechanieker-mobiel-04-tab-onderhoud.png` — onderhoudssignalen + je eigen
  fiets (3D-werkblad met scan).
- `na/mechanieker-mobiel-05-tab-garage.png` — fietsengarage, uitrusting,
  sensoren, ontwikkelingen, pro-teams.
- `na/mechanieker-mobiel-06-tab-testen.png` — twee knoppen die elk een
  stappenvenster openen (modelschatting vooraf · twee ritten vergelijken).
- `na/mechanieker-mobiel-07-tab-advies.png` — foto-gedreven materiaalcoach.
- `na/mechanieker-mobiel-08-stappenvenster-modelschatting.png` — de
  modelschatting als stappenvenster over het scherm heen, met sluiten (X) en
  Escape als uitweg.

## Per F9-regel

1. **Eén primaire actie per scherm** — de kop toont precies één primaire knop
   ("Materiaalfoto beoordelen", opent de Advies-tab). Testflows en garage-acties
   zijn secundair (tabs) of achter een venster.
2. **Max vier kaarten boven de vouw** — bij openen staan de kop, één primaire
   knop, de tabbalk en het eerste kerninfo-blok boven de vouw; de overige
   secties zitten achter tabs/vensters.
3. **2–4 échte tabs** — vier tabs (Onderhoud · Garage · Testen · Advies), elk met
   echte inhoud; geen lege tabs.
4. **Onbevoegden: weglaten** — n.v.t. op dit persoonlijke atleet-scherm (geen
   rol-afhankelijke beheeropties); niets uitgegrijsd.
5. **Details naar apart scherm/venster** — de vergelijkingstest en de
   modelschatting (voorheen inline, diep in de scroll) openen nu elk als sheet.
6. **Meerstapsinvoer als stappenvenster** — hergebruikt het bestaande
   `BeheerSheet` (Sheet-primitief: portal + focus-trap + sluitknop). Elk venster
   heeft een uitweg (X/Escape); geen lang scrolformulier.
7. **Hoofdhandeling + kerninfo in beeld bij openen (402×874)** — aangetoond:
   874 px totaal (≈ 1,0 scherm), hoofdactie + tabs + eerste kerninfo boven de
   vouw; geen scrollverplichting.
8. **Rol + omgeving zichtbaar** — al aanwezig in de gedeelde `ScreenShell`
   (`ContextRegel` → `DsContextRegel`): "Mechanieker"-rolbadge, "Testomgeving"-
   badge (amber) en omgeving staan permanent bovenaan. **Geen** shell-wijziging
   nodig; zichtbaar in elke screenshot.
9. **Alles blijft bereikbaar** — geen functionaliteit verwijderd of weggelaten:
   onderhoudssignalen, 3D-werkblad/scan, garage (fietsen, uitrusting, sensoren,
   ontwikkelingen, pro-teams), materiaalcoach, vergelijkingstest én
   modelschatting leven nu allemaal onder een tab of in een venster.

## Eerlijke beperkingen

- Het QA-account heeft (nog) geen fietsen/onderhoudssignalen, dus de garage- en
  onderhoud-tabs tonen de eerlijke lege-staten; de indeling en tabs zijn niettemin
  volledig zichtbaar en klikbaar in het bewijs.
- `test:navigation` kon in dit gedeelde omgevingsvenster niet groen worden
  bevestigd door aanhoudende esbuild-/spawn-druk (transient, 4× herhaald,
  environment-resource — geen testlogica-fout). De wijziging raakt de routering
  niet (`/mechanieker` blijft ongewijzigd geregistreerd). `npx tsc` is schoon
  voor de gewijzigde bestanden en `check-brand-copy` is groen.
