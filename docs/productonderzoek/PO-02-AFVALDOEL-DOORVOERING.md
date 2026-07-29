# PRODUCTONDERZOEK PO-02 — Het afvaldoel weegt aantoonbaar overal mee

Conform Product Proof Doctrine art. 9. Status: **TER GOEDKEURING** — geen implementatie gestart.
Datum: 29 juli 2026 · Taak #418

## 1. Productbelofte

> "Wie een afvaldoel instelt, ziet dat doel aantoonbaar en consequent meewegen — in het trainingsadvies, de voeding, de analyse en de uitleg — zonder dat het ooit ten koste gaat van gezondheid of prestatie op sleuteldagen."

## 2. Huidige Sparki-aanpak (feitelijk)

- **Opslag**: het doel bestaat op drie plekken — `athlete_profiles.development_goal`, `nutrition_season_goals.target_weight_kg` (met de bestaande RED-S/17+-beveiligingen en ≤0,5 kg/wk-sturing) en handmatige `athlete_goals`.
- **Consumptie**: de goals-engine aggregeert het tot een *doelenoverzicht*; de LLM-context injecteert het als LANGETERMIJNDOEL; de voedings-AI krijgt het als *context-hint* bij maaltijdanalyse.
- **Niet-consumptie (het gat)**: de deterministische rekenkernen — plan-generator, dagadvies, fueling-richtwaarden — gebruiken het doel **niet**. Het doel is dus zichtbaar in teksten, maar stuurt geen enkele berekende keuze.

Dit verklaart René's ervaring exact: het doel wordt opgeslagen en benoemd, maar niets verandert er aantoonbaar door.

## 3. Best beschikbare marktbenadering

| Product | Aanpak |
|---|---|
| **TrainerRoad** | Trainingsplan wijzigt NIET voor gewichtsverlies — intensiteitsdagen blijven heilig; gewichtsdoel loopt via voeding/energiebalans, niet via minder trainen. |
| **Garmin Connect** | Gewichtsdoel + calorieën-in/uit gekoppeld aan gemeten trainingsverbruik; trendweergave in plaats van dagcijfers. |
| **EatMyRide / Velorific / JOIN-ecosysteem** | De consensus-aanpak: **periodiseer het tekort om de training heen** — "fuel the work": volledige fueling tijdens en rond zware/lange trainingen, het calorietekort valt op rust- en rustige dagen; dagbudget = basisbehoefte + trainingsarbeid (kJ) − gedoseerd tekort. |

Marktconsensus in één zin: **een afvaldoel is een voedings- en planningsvraagstuk per dagtype, nooit een korting op trainingskwaliteit — en nooit op de fueling tijdens de inspanning zelf.**

## 4. Benodigde databronnen

Alles bestaat al in Sparki: gewicht + streefgewicht + tempo (season goal), trainingsarbeid in kJ/TSS (sessies, derived belastingscore), dagtype-engine (rust/duur/intensief/wedstrijd), leeftijd (exacte DOB), gezondheid/readiness. **Geen nieuwe databronnen nodig.**

## 5. Benodigde algoritmen

1. **Energierichting per dagtype** (deterministisch, uitbreiding van de bestaande fueling-engine): rustdag = tekortdag; duurdag = licht tekort; intensieve/lange/wedstrijddag = geen tekort + volledige fueling. Getallen uit de bestaande richtwaarden-SSOT; LLM blijft woorden-only.
2. **Plan-bijsturing binnen bestaande regels**: bij afvaldoel iets meer rustige duur waar het weekbudget het toelaat — nooit minder intensiteit, nooit boven de bestaande per-sessie-caps.
3. **Trend-analyse**: gewichtsverloop vs. het ingestelde tempo (≤0,5 kg/wk), eerlijk "geen weegdata" als die ontbreekt — geen schattingen.
4. **Verantwoording**: elke door het doel beïnvloede keuze benoemt dat in de bestaande uitleglaag ("rustdag = jouw tekortdag").

## 6. Benodigde architectuur

Geen nieuwe. Dit is een **doorvoeringsvraagstuk**: het doel wordt een verplichte input van vier bestaande engines (dagadvies, fueling, plan-generator, analyse) in plaats van een context-hint. De bestaande veiligheidslagen (17+/RED-S-weigering, raises-only gezondheid, jeugd-geen-getallen) blijven de buitenste schil en gaan altijd vóór.

## 7. Gaps

| Gap | Oorzaakcategorie (art. 5) |
|---|---|
| Doel stuurt geen enkele berekende keuze | **onvoldoende integratie** (de hoofdcategorie) |
| Drie opslagplekken zonder één leesbron | onvoldoende integratie |
| Geen energierichting per dagtype | ontbrekende functionaliteit (klein, bovenop bestaande engine) |
| Geen gewichtstrend vs. doel in analyse | ontbrekende functionaliteit (klein) |

Anders dan bij Routes is hier géén databron- of architectuurprobleem: de betere oplossing is aantoonbaar haalbaar binnen wat er staat.

## 8. Voorgestelde oplossing

Eén doorvoeringsronde over de vier engines (volgorde: één leesbron voor het doel → energierichting per dagtype in fueling/dagadvies → plan-bijsturing → trend in analyse → verantwoording in uitleg), afgesloten met een Product Proof:

- **Praktijktest**: doel instellen en een gesimuleerde week doorlopen; op elke plek waar Sparki een keuze maakt moet het doel aantoonbaar meewegen én benoemd worden; op intensieve dagen mag er aantoonbaar NIETS gekort worden.
- **Onafhankelijke validatie**: architect-review + e2e-test, score op de zes doctrine-criteria, gereed bij ≥9,0.
- **Veiligheidsbewijs**: 17-jarige krijgt weigering, gezondheidsstatus overrulet het tekort — beide expliciet getest.

**Beslispunt voor René**: akkoord met deze aanpak? Eén open keuze: moet het afvaldoel ook zichtbaar worden op Vandaag zelf (bijv. "vandaag is jouw tekortdag") of alleen in Plan/Voeding/Analyse?
