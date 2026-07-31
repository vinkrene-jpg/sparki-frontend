# Sparki — Categorie- en licentiemodel (bronhiërarchie + bronmatrix)

**Status (besluit René 31-07-2026):** *Bronhiërarchie besloten; exacte categorie- en disciplinemapping nog te valideren tegen actuele UCI-, UEC- en KNWU-reglementen.*
Er wordt **geen definitieve mapping gebouwd** op basis van alleen een KNWU-webpagina; eerst deze bronmatrix, daarna validatie per discipline.

## 1. Bronhiërarchie (bindend)

1. **UCI** — primaire en leidende bron voor internationale wielercategorieën, leeftijdsgrenzen en disciplinegebonden regels.
2. **UEC** — Europese toepassing en wedstrijdcontext bínnen het UCI-kader (geen eigen categoriesysteem).
3. **KNWU** — Nederlandse vertaling naar licenties, nationale wedstrijden, pakketten en lokale benamingen.

## 2. Modelregels (bindend voor elke toekomstige implementatie)

- **Twee gescheiden velden, nooit samengevoegd:** `internationale_categorie` (UCI-kader: Youth/U19(Junior)/U23/Elite/Masters, met geslachtscode) en `nationale_licentiecontext` (bv. KNWU Licentie U17, 17+, pakket Basis/Plus/Premium). Een Nederlandse licentienaam **overschrijft nooit** de onderliggende UCI-categorie.
- **Provenance verplicht:** elke categorie-/licentiewaarde draagt bron, versie/documentdatum, ingangsdatum en land.
- **Geldigheidsperiode verplicht:** geen hardcoded categorie zonder ingangs-/einddatum (reglementen wijzigen per seizoen; KNWU-structuur is per 2026 hervormd).
- **Per discipline en per seizoen ondersteunen:** leeftijdscategorie-regels verschillen per discipline (weg/veld/MTB/baan/BMX) — het model laat per discipline een afwijkende mapping toe.
- **Nationale uitzonderingen blijven herkenbaar nationaal:** een KNWU-afwijking (bv. "nieuwelingen vallen onder U17 vanaf 2026") wordt opgeslagen als nationale regel met bron, nooit als internationale waarheid.
- **Leeftijdsberekening is een eigenschap van de bronregel**, niet één globale formule (zie matrix: UCI = jaartal wedstrijd − geboortejaar; KNWU-jeugd volgt de uniforme UCI-leeftijdsindeling).

## 3. Bronmatrix (op te leveren vóór elke mapping-bouw — huidige stand)

Legenda validatie: ✅ = geverifieerd tegen primaire bron (datum vermeld) · 🔎 = nog te valideren.

| Categorie | Leeftijdsberekening | Discipline | Internationale bron (UCI) | Europese context (UEC) | Nederlandse licentievertaling (KNWU) | Ingangsdatum | Bekende uitzondering |
|---|---|---|---|---|---|---|---|
| Youth (≤16) | jaartal wedstrijd − geboortejaar ≤ 16 | alle (beheer bij nationale federaties) | ✅ UCI Reglement Deel 1, art. 1.1.036/1.1.037 (versie 16-06-2025, geraadpleegd 31-07-2026) | volgt UCI | ✅ KNWU-jeugd U7/U9/U11/U13/U15/U17 (uniform UCI-leeftijd, m/v gelijk); licenties U13 en U17 (kenniscentrum.knwu.nl, geraadpleegd 30-07-2026) | UCI-tekst gewijzigd t/m 17-07-2023; KNWU-hervorming per 2026 | ✅ BMX Racing/Freestyle, Trials en Para-cycling: internationaal al ≤16 toegestaan (art. 1.1.035); ✅ NL: U8 rijdt geen NK's; nieuwelingen vallen per 2026 onder U17 (nationale regel) |
| Junior / U19 (MJ/WJ, 17–18) | idem, 17–18 | alle; disciplinespecifieke deelnameregels 🔎 per UCI-deel (weg 2, baan 3, MTB 4, veld 5, BMX 6) | ✅ art. 1.1.036/1.1.037 | ✅ eigen EK-blok "Juniors" binnen UCI-kader (UEC Technical Guide Road EC 2025, Drôme-Ardèche) | ✅ UCI-licentie U19 en hoger via KNWU | idem | 🔎 materiaal-/verzetsbeperkingen en deelname-uitzonderingen per discipline |
| U23 (MU/WU, 19–22) | idem, 19–22 | weg/veld/MTB kennen eigen U23-wedstrijdregels 🔎 | ✅ art. 1.1.036/1.1.037 ("unless otherwise provided" bij WU) | ✅ eigen EK-blok "U23" | ✅ valt in NL onder UCI-licentie (beloften) | idem | 🔎 disciplines waar U23 met Elite samenrijdt of aparte klassementen heeft (o.a. veldrijden/MTB); WU23 expliciet "tenzij anders bepaald" |
| Elite (ME/WE, ≥23) | idem, ≥23 | alle | ✅ art. 1.1.036/1.1.037 | ✅ eigen EK-blok "Elite" | ✅ UCI-licentie via KNWU | idem | — |
| Masters (MO ≥30 / WM ≥30, op eigen keuze) | idem, ≥30 én expliciete keuze | alle; masters-WK's per discipline 🔎 | ✅ art. 1.1.036/1.1.037 (niet mogelijk voor renners van een UCI-geregistreerd team; MO = "Men Open" incl. niet-WM-gerechtigden) | 🔎 UEC-masters-events | 🔎 exacte NL masters-/H-indeling: KNWU-pagina's benoemen die niet in de oude H3–H6-vorm; te verifiëren op 17+/UCI-licentiepagina's | idem | ✅ status is een keuze, geen automatisme |
| Nationale deelnamestructuur 17+ | n.v.t. — nationale licentie, geen UCI-categorie | nationale wedstrijden NL | n.v.t. (bewust NIET aan UCI-veld koppelen) | n.v.t. | ✅ KNWU Licentie 17+ vervangt startlicentie/nieuwelingen/sportklasse/amateurs (kenniscentrum.knwu.nl, 30-07-2026) | per 2026 | ✅ dit is een licentie-/deelnamestructuur; internationale categorie van dezelfde renner blijft apart bestaan |
| Pakketten Basis/Plus/Premium | n.v.t. | n.v.t. (lidmaatschaps-/pakketstructuur) | n.v.t. | n.v.t. | 🔎 exacte inhoud/voorwaarden per pakket op knwu.nl | 🔎 | ✅ nooit in het categorieveld opslaan |
| Cycling for all / recreatief | n.v.t. | toertochten e.d. | ✅ art. 1.1.039 (aparte licentie, alleen cycling-for-all-kalender) | volgt UCI | 🔎 NL-vertaling (basislidmaatschap) | idem | — |

**Fundamentele UCI-regels (primair geverifieerd 31-07-2026, Deel 1 versie 16-06-2025):**
- art. 1.1.034 — categorie = verschil tussen **jaartal van het evenement en geboortejaar** (dus leeftijd per 31 december van het wedstrijdjaar);
- art. 1.1.035 — internationale kalender vanaf 17 jaar, met uitzonderingen (BMX/Trials/Para ≤16; EPAC ≥19);
- art. 1.1.038 — benamingen mógen per taal worden aangepast → precies daarom blijft de UCI-code (MJ/WJ, MU/WU, ME/WE, MO/WM) het canonieke veld en is elke NL-naam alleen weergave/licentiecontext.

## 4. Nog te valideren vóór een definitieve mapping (🔎-punten)

1. Disciplinedelen van het UCI-reglement (Deel 2 weg, 3 baan, 4 MTB, 5 veldrijden, 6 BMX): afwijkende leeftijds-/deelnameregels per discipline en seizoen.
2. UEC-reglementen/technical guides per discipline (bevestigen dat UEC nergens eigen categoriegrenzen introduceert).
3. KNWU: exacte masters-indeling, pakketinhoud Basis/Plus/Premium, en de volledige licentietabel 2026 met ingangsdata.
4. Ingangsdata per regelversie vastleggen zodra de mapping gebouwd wordt (reglementversies dragen zelf hun wijzigingsdata).

## 5. Bronnen

- UCI Cycling Regulations, Part 1 "General organisation of cycling as a sport", versie 16-06-2025 (officiële PDF, uci.org) — primair, geraadpleegd 31-07-2026.
- UEC Road European Championships Technical Guide 2025 (uec.ch) — Europese context, geraadpleegd 31-07-2026.
- KNWU kenniscentrum: wedstrijd- en licentiestructuur 2026, licentiepagina's U13/U17/17+ — geraadpleegd 30-07-2026 (zie ook Hoofdstuk J-kalibratie).
