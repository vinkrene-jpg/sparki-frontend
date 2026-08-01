# MEDIA_UITLEG_01 — TESTMATRIX

**Deel 11 van 20**

---

## 0. Gebruik

De matrix wordt niet in elke fase volledig gedraaid. Per fase geldt de **relevante doorsnede**; F10 draait hem in zijn geheel. Een cel die niet van toepassing is, wordt met reden vastgelegd — "niet getest" is geen uitkomst.

---

## 1. Apparaten

| # | Apparaat | Waarom |
|---|---|---|
| A1 | kleine iPhone-breedte (360 dp) | smalste ondersteunde weergave |
| A2 | grote iPhone-breedte | meest voorkomende weergave |
| A3 | kleine Android | zwakste prestaties in de praktijk |
| A4 | grote Android | afwijkend rendergedrag |
| A5 | PWA (geïnstalleerd) | ander gedrag bij media en opslag |
| A6 | desktop | ruimere weergave, zelfde functionaliteit |

## 2. Instellingen

| # | Instelling |
|---|---|
| I1 | normale beweging |
| I2 | Verminder beweging in Sparki |
| I3 | systeeminstelling Verminder beweging |
| I4 | animaties volledig uit |
| I5 | 200% tekstgrootte |
| I6 | schermlezer actief |
| I7 | geluid uit |

## 3. Netwerk

| # | Toestand |
|---|---|
| N1 | wifi |
| N2 | mobiele data toegestaan |
| N3 | mobiele data niet toegestaan |
| N4 | lage bandbreedte |
| N5 | offline |
| N6 | afgebroken download |
| N7 | herstelde verbinding |

## 4. Media

| # | Toestand | Verwacht gedrag |
|---|---|---|
| M1 | volledig aanwezig | normale weergave |
| M2 | poster aanwezig, video ontbreekt | poster + tekstvariant, eerlijke melding |
| M3 | ondertiteling ontbreekt | **niet gepubliceerd** — verschijnt niet |
| M4 | tekstalternatief ontbreekt | **niet gepubliceerd** — verschijnt niet |
| M5 | licentie verlopen | niet-beschikbaarstatus, geen leeg vlak |
| M6 | content ingetrokken | niet-beschikbaarstatus, historie blijft |
| M7 | verkeerde contentversie | geblokkeerd, niet getoond |
| M8 | lage-resolutievariant | aangeboden op N4 |
| M9 | fout formaat | fouttoestand binnen de speler |

## 5. Gebruikers

| # | Gebruiker |
|---|---|
| G1 | gast |
| G2 | Gratis |
| G3 | Compleet |
| G4 | sporter |
| G5 | trainer |
| G6 | minderjarige |
| G7 | ouder |
| G8 | ploegleider |
| G9 | mechanieker |
| G10 | soigneur |
| G11 | `medical_staff` |
| G12 | gebruiker zonder toestemming |
| G13 | gebruiker met meerdere rollen |

## 6. Situaties

| # | Situatie | Verwacht |
|---|---|---|
| S1 | actieve navigatie | geen media, geen melding |
| S2 | actieve training | geen media, geen melding |
| S3 | wedstrijddagmodus | volledig stil |
| S4 | onboarding | geen media, geen melding |
| S5 | formulier | geen media, geen melding |
| S6 | acute melding | geen video, geen animatie, geen Academy-flow |
| S7 | medische waarschuwing | geen diepte, geen speelse animatie |
| S8 | rustmoment | melding en uitleg toegestaan |
| S9 | eerste gebruik | uitlegvraag toegestaan |
| S10 | herhaald gebruik | geen herhaalde vraag |
| S11 | content al bekeken | status gerespecteerd |
| S12 | content overgeslagen | niet opnieuw aangeboden, wel via Help |
| S13 | pakket verloren | toegang weg, voortgang blijft |
| S14 | rol ingetrokken | inhoud van die rol verdwijnt met uitleg, niet stil |

---

## 7. Verplichte combinaties

Deze kruisingen worden altijd gedraaid, ook wanneer de fase klein is:

| Combinatie | Waarom |
|---|---|
| G6 × M1 × S8 | minderjarige met media op een rustmoment — de jeugdpoort |
| G6 × S6 | minderjarige bij een acute melding — niet negeerbaar |
| A3 × N4 × M8 | zwakste toestel, laagste bandbreedte |
| I4 × alle rolflows | het bewijs van bewering B4 |
| N3 × M1 | mobiele data zonder toestemming |
| G13 × S8 | meerdere rollen: geen samengevoegd aanbod |
| M3 en M4 | toegankelijkheid als publicatiepoort, niet als wens |
| N6 → N7 | afgebroken download gevolgd door herstel |

---

*Deel 11 van 20.*
