# VORMLAAG_01 — F0 inventarisatie

**Datum:** 06-08-2026 · **SHA:** 047ec8bd (main) · **Methode:** bestaand
MUX_375-script (`e2e/mux-375-shots.mjs`), acceptatiebuild + governor-rolfixtures,
TESTCONTEXT-regel zichtbaar op elke afdruk.
**Afdrukken:** `docs/ux/shots/047ec8bd/375/` (10 rollen, fold + full per tabblad),
index in `docs/ux/shots/047ec8bd/INDEX.md`.

## Eerlijke gaten in deze meting

1. **Renés toestelbreedte ontbreekt.** Onderdeel B van MUX_375 toont de breedte
   in de versieregel op de gepubliceerde site, maar de afgelezen waarde is nooit
   in de repo beland. Zodra René hem doorgeeft (of afleest en meldt) draait
   dezelfde run met alleen `BREEDTE=<waarde>` — zonder codewijziging.
   Tot die tijd is 375 px de enige gecertificeerde breedte.
2. **"Past op één scherm" is op afdrukken maar deels meetbaar.** Veel schermen
   scrollen in een eigen binnencontainer (`fixed inset-0`-lagen, onderbladen);
   de full-page-hoogte zegt daar niets. Waar hieronder "past niet" staat, is dat
   gemeten op de full-afdrukhoogte (> 812 px) óf geteld in de code.
3. Admin en Admin-ops zitten niet in de rolfixture-moduleset van het script;
   hun tabbladen zijn hieronder uit de code geteld, zonder afdruk.

## Tabbladen per module (het gat uit §1 van de opdracht gesloten)

| module | tabbladen | bron | past naast elkaar op 375? |
|---|---:|---|---|
| Analyse (`core-analyse.tsx`) | 7 | code (opdracht §1) | nee — scrolt weg (R5-overtreding) |
| Routes | 6 (+ kaart-ingang) | code + afdrukken | nee — scrolt weg |
| Coach-cockpit | 5 | code (opdracht §1) | nee — krap, scrolt |
| Club (`club.tsx`) | 5 (hoofd/vandaag/berichten/documenten/meer) | afdrukken (alle clubrollen) | nee — krap |
| Clubbeheer (`club-beheer.tsx`) | 5 (hoofd/structuur/mensen/organisatie/beheer) | afdrukken | nee — krap |
| Wedstrijdruimte | 4 | code (opdracht §1) | ja, krap |
| Mechanieker (`mechanieker.tsx`) | 4 (onderhoud/garage/testen/advies) | code | ja, krap |
| Admin (`admin.tsx`) | 4 (overzicht/gezondheid/signalen/gegevens) | code | ja, krap |
| Jij (`you.tsx`) | 4 op afdruk (hoofd/profiel/inzichten/kompas) | afdrukken | ja |
| Admin-ops (`admin-ops.tsx`) | 3 (systeem/beoordelingen/auditlog) | code | ja |

Norm (twee tot vier tabbladen): **Analyse, Routes, Coach-cockpit, Club en
Clubbeheer overschrijden hem**; de component verbergt dat nu met
`overflow-x-auto` (F4 haalt dat weg).

## Wat past er nu op één scherm (375×812, standaardtekst)

Gemeten op full-afdrukhoogte, met beperking 2 in het achterhoofd:

- **Past niet zonder scrollen:** Jij → hoofd én profiel (±1144 px), Trainen
  (±985 px), Jij → inzichten/kompas (±680 px), Meer (±600 px bij de meeste
  rollen), Clubbeheer → mensen (±616 px).
- **Past (of scrolt alleen in een binnencontainer):** dashboard, analyse-hoofd,
  wedstrijd, club-tabbladen, routes-tabbladen, ouder- en trainerschermen.
- Kanttekening: veel "passende" schermen tonen bij de fixture weinig data
  (lege staten). Met een gevuld seizoen groeit vooral Analyse, Trainen en Jij.

## Voorstel per module — vier kaarten op niveau 1, rest achter de doorgang

Per R4 (dagelijks blijft boven) en R3 (doorgang benoemt inhoud + aantal):

- **Analyse (7 tabs, 3.190 regels) — zwaarste verbouwing.** Niveau 1: vorm van
  de week, belastingstrend, laatste sessie-verdict, één opvallendheid. Doorgang:
  "Volledige weekanalyse" en "Alle grafieken (N)". **Verlies:** de vijf
  specialistische tabbladen (o.a. vermogenscurves, vergelijkingen) verdwijnen
  naar niveau 2 — dat is echt minder direct zichtbaar, geen truc.
- **Routes (6 tabs).** Niveau 1: kaart-ingang, "Maak een route", bewaard
  (aantal), laatst gereden. Doorgang: "Alle N routes". GPX-import en
  instellingen naar niveau 2. **Verlies:** import staat niet meer één tik diep.
- **Coach-cockpit (5 tabs).** Niveau 1: vandaag-overzicht, sporters met
  aandacht, open voorstellen, berichten. Doorgang: "Alle N sporters".
- **Club/Clubbeheer (5+5 tabs).** Club: vandaag, berichten (aantal), eerstvolgende
  activiteit, documenten (aantal) — "meer" vervalt als tabblad en wordt de
  doorgang. Clubbeheer: structuur, mensen (aantal), open taken, organisatie;
  beheer-instellingen naar niveau 2. **Verlies:** beheerformulieren twee tikken
  diep; voor een maandelijkse handeling is dat de bedoelde prijs.
- **Jij (4 tabs, maar 1144 px hoog).** Tabbladen passen; de inhoud niet. Knip
  binnen "hoofd": kern-identiteit + kompas-samenvatting + twee lenzen, doorgang
  "Alle inzichten (N)" en "Volledig profiel".
- **Trainen (985 px).** Niveau 1: vandaag-sessie, weekvoortgang, eerstvolgende
  twee dagen, koppelingsstatus. Doorgang: "Hele weekschema".
- **Wedstrijdruimte, Mechanieker, Admin, Admin-ops:** binnen de tabnorm; alleen
  vormtaal (F1) en de vaste doorgang-rij toevoegen waar lijsten lang worden
  (bv. "Auditlog (N)").
- **Route-scherm (kaart):** expliciet als laatste, ná KAART_VECTOR_01 —
  bevestigd, dat bestand is deze week herschreven.

## Vormlaag-stand (bevestiging van §1)

- `diepte` alleen op `ds/card.tsx`, gebruikt door 3 schermen; beide
  media-uitleg-vlaggen staan uit; `sparki-mobile` heeft nul diepte/zweef-code.
  F1–F3 kloppen dus qua uitgangspunt; niets nieuws gevonden dat dat weerlegt.
