# MEDIA_UITLEG_01 — VERTAALTABEL

> **0. Uitvoeringsregel (01-08-2026 — SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01, K1–K6 beslist)**
> Alle in dit document beschreven wacht- en vrijgavepoorten (wachten op René, wachten op
> Mirror-goedkeuring, per-fase-vrijgave, featureflag-als-vrijgavepoort, `RENE_APPROVED` in de
> deployketen) zijn vervallen. Fasevolgorde geldt uitsluitend als technische afhankelijkheid;
> Mirror toetst parallel; productiepublicatie loopt via de automatische technische poort.
> Bindende regel + elf hard stops + verplichte testset: `docs/SPARKI_CONTINUOUS_EXECUTION_GOVERNANCE_01.md`.


**Deel 19 van 20** · van bestaande codes naar fasen en documenten

---

## 1. Componenten

| Code | Component | Fase | Contract |
|---|---|---|---|
| CMP-40 | Diepte-/zweefkaart | F2 | deel 4 |
| CMP-41 | Toegankelijke mediaspeler | F3 | deel 4 |
| CMP-42 | Uitlegflow | F5 | deel 4 |
| CMP-43 | Oefenkaart | F6 | deel 4 |
| CMP-44 | Zwevende coachmelding | F7 | deel 4 |

Daarnaast hergebruikt, niet gewijzigd: CMP-00 (componentcontract) · CMP-17 (zoekveld, in Academy) · CMP-27 (uitlegsheet, voor heropening) · CMP-29 (lege toestand) · CMP-31 (skeleton) · CMP-35 (onderbouwing binnen CMP-44).

## 2. Patronen

| Code | Patroon | Fase |
|---|---|---|
| PAT-28 | Subtiele diepte zonder drukte | F2 |
| PAT-29 | Bewegende uitleg op eerste gebruik | F5 |
| PAT-30 | Video met poster en tekstfallback | F3 |
| PAT-31 | Oefening bekijken en uitvoeren | F6 |
| PAT-32 | Coachmelding op rustmoment | F7 |
| PAT-33 | Verminder beweging | F1 |
| PAT-34 | Media op lage bandbreedte | F3 |
| PAT-35 | Media ontbreekt | F3 |
| PAT-36 | Mediarechten en versie | F3, F6 |
| PAT-37 | Uitleg bekeken of overgeslagen | F4, F5 |
| PAT-38 | Geen video tijdens actieve taak | F3, F5, F7 |
| PAT-39 | Animatie uit, functionaliteit gelijk | F1, F10 |

## 3. Mirror-toetsen

| Code | Toets | Fase |
|---|---|---|
| MTS-50 | animatie aan en uit | alle |
| MTS-51 | verminder beweging | alle |
| MTS-52 | geen functieverlies zonder animatie | alle, sluitbewijs F10 |
| MTS-53 | lage bandbreedte | F3, F10 |
| MTS-54 | mobiele data zonder toestemming | F3 |
| MTS-55 | uitlegflow | F5, F8 |
| MTS-56 | bekeken of overgeslagen | F4, F5, F8 |
| MTS-57 | ontbrekende media | F1, F3, F8 |
| MTS-58 | ondertiteling, tekstalternatief, schermlezer | F3 |
| MTS-59 | geen media tijdens actieve taak | F3, F5, F7, F9 |
| MTS-60 | leeftijdsgeschikte inhoud | F6, F9 |
| MTS-61 | uitleg toont de echte interface | F5 |
| MTS-62 | oefenkaart compleet | F6 |
| MTS-63 | coachmelding onderbreekt niet | F7, F9 |
| MTS-64 | acute melding | F7, F9 |
| MTS-65 | afgebroken download | F3, F10 |
| MTS-66 | speler blokkeert niets | F3 |
| MTS-67 | rechten en versie | F3, F6, F10 |
| MTS-68 | verbruik en zwaarte | alle |
| MTS-69 | directe herstelgronden | alle |

## 4. MUX-regels die dit pakket het meest raken

MUX-14 (vijf hoofditems) · MUX-48 en MUX-49 (lege toestanden) · MUX-51 (geen voorbeelddata) · MUX-55 (geen lokale bevestiging) · MUX-57 (wachtgrens met uitweg) · MUX-63 en MUX-65 (deeplink en notificatie) · MUX-66 t/m MUX-71 (toegankelijkheid) · MUX-88 (geen doodlopend scherm) · MUX-90 t/m MUX-92 (AI-gedrag) · MUX-93 (geen verrassingen) · MUX-96j (stil in de wedstrijddagmodus) · MUX-98 (eerste bruikbare interactie) · MUX-99 (functie hoort bij een hoofdtaak) · MUX-100 (rolintroductie).

**Dit pakket voegt geen enkele nieuwe MUX-, CMP-, PAT- of MTS-code toe.**

---

*Deel 19 van 20.*
