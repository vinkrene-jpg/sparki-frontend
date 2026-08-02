# F9 — Clubbeheer herindeling: voor & na

**Scherm:** `/club/beheer` (pagina `artifacts/sparki/src/pages/club-beheer.tsx`)
**Toestel:** telefoonformaat **402 × 874** (kleinste ondersteunde maat)
**Bewijs:** echte browserkliks tegen de **productiebuild** via de WP-S1-harnas
(`e2e/tests/f9-clubbeheer.mjs`), Nix-chromium, echte Clerk-ticketlogin met het
QA-account (`x-dev-clerk-id`-pad), draaiende api-server. Screenshots in
`voor/` en `na/`.

## Meetbaar verschil (paginahoogte bij openen, 402×874)

| | Paginahoogte | Schermen scroll | Indeling |
|---|---|---|---|
| **Voor** | **3532 px** | **≈ 4,0** | één lange scroll: alle 14 secties onder elkaar |
| **Na** | **1200 px** | **≈ 1,4** | kop + hoofdactie + Vandaag + 4 tabs; rest per tab/venster |

De hoofdhandeling en kerninformatie staan **na** in beeld bij openen
(`na/clubbeheer-mobiel-01-beheer-fold.png`): de knop "Nieuw lid uitnodigen",
de operationele prioriteiten (Vandaag) én de vier tabs passen boven de vouw.

## Voor

- `voor/clubbeheer-mobiel-01-beheer-fold.png` — bij openen; direct onder de
  Vandaag-kaarten begint al de sectie Clubinstellingen (geen keuzelaag).
- `voor/clubbeheer-mobiel-02-beheer-scroll-1.png` en `-03-…-scroll-2.png` —
  diep in de scroll: lange inline-formulieren voor training plannen, wedstrijd
  aanmaken en documenten (TUX-24/25/27-overtreding: hoofdhandelingen alleen
  bereikbaar na fors scrollen; meerstapsinvoer als één lang formulier).

## Na

- `na/clubbeheer-mobiel-01-beheer-fold.png` — hoofdactie + kerninformatie +
  tabs in beeld.
- `na/clubbeheer-mobiel-04-tab-overzicht.png` — signalen, inrichting, plannen
  (knoppen die vensters openen), verantwoording.
- `na/clubbeheer-mobiel-05-tab-leden.png` — uitnodigen + ledenlijst.
- `na/clubbeheer-mobiel-06-tab-structuur.png` — oprichting, seizoenen & teams,
  locaties- en documentenknop (openen als venster).
- `na/clubbeheer-mobiel-07-tab-instellingen.png` — clubprofiel, clubcode; pakket
  & facturatie **alleen** voor de eigenaar (weggelaten voor niet-eigenaar).
- `na/clubbeheer-mobiel-08-stappenvenster-uitnodigen.png` — meerstaps-invoer als
  stappenvenster over het scherm heen, met sluiten (X) en Escape als uitweg.

## Per F9-regel

1. **Eén primaire actie per scherm** — kop toont precies één primaire knop
   ("Nieuw lid uitnodigen", of "Club in oprichting afronden" in concept).
   Plan-/wedstrijd-/document-/locatie-acties zijn visueel secundair of achter
   een venster.
2. **Max vier kaarten boven de vouw** — bij openen staan de Vandaag-kaarten +
   tabbalk boven de vouw; de overige secties zitten achter tabs/vensters.
3. **2–4 échte tabs** — vier tabs (Overzicht · Leden · Structuur · Instellingen),
   elk met echte inhoud; geen lege tabs.
4. **Onbevoegden: weglaten** — Sparki Team-abonnement en Pakket & limieten
   worden voor een niet-eigenaar **niet gerenderd** (geen uitgegrijsde knoppen).
5. **Details naar apart scherm/venster** — locaties, documenten, plannen en
   uitnodigen openen als sheet i.p.v. inline.
6. **Meerstapsinvoer als stappenvenster** — hergebruikt het bestaande
   `BeheerSheet` (Sheet-primitief: portal + focus-trap + sluitknop). Elk venster
   heeft een volgende actie en een uitweg; geen lang scrolformulier.
7. **Hoofdhandeling + kerninfo in beeld bij openen (402×874)** — aangetoond:
   1200 px totaal, hoofdactie en Vandaag boven de vouw.
8. **Rol + omgeving zichtbaar** — al aanwezig in de gedeelde `ScreenShell`
   (`ContextRegel` → `DsContextRegel`), óók in `bare`-modus: "Testomgeving"-badge
   (amber), rol-badge en clubnaam staan permanent bovenaan. **Geen** shell-
   wijziging nodig; zichtbaar in elke screenshot.
9. **Alles blijft bereikbaar** — geen functionaliteit verwijderd; elke oude
   sectie leeft nu onder een tab of in een venster.

## Eerlijke beperking

De QA-account heeft al een bestaande club ("E2E Rolstart Club", rol Beheerder),
dus de harness legt die echte beheerpagina vast (aanmaak-stap wordt
overgeslagen; `DELETE 0` bij opruimen is daardoor verwacht). De rol-badge toont
"ATHLETE" omdat het QA-account als atleet is ingelogd terwijl het tevens
beheerder van die club is — de omgeving/rol-regel uit de gedeelde shell werkt,
maar de actieve globale rol is athlete. Dit is bestaand gedrag, buiten de F9-
scope.
