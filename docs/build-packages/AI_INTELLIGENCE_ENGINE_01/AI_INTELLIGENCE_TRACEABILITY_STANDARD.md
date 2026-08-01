# AI_INTELLIGENCE — ADVIESHERLEIDBAARHEID

**Deel 10 van 21**

---

## 1. Het adviesdossier

Ieder advies krijgt een dossier met twintig velden. **Geen advies zonder herleidbare basis.**

| # | Veld |
|---|---|
| 1 | advies-ID |
| 2 | gebruiker |
| 3 | actieve rol |
| 4 | tijdstip |
| 5 | actief doel |
| 6 | gebruikte databronnen |
| 7 | gebruikte periode |
| 8 | datakwaliteit |
| 9 | gebruikte engines |
| 10 | deterministisch of taalmodel |
| 11 | gebruikte kennisbronnen |
| 12 | confidence |
| 13 | onzekerheid |
| 14 | waarom dit advies |
| 15 | waarom het alternatief niet is gekozen |
| 16 | ontbrekende informatie |
| 17 | aanbevolen actie |
| 18 | menselijke bevestiging vereist ja/nee |
| 19 | vervolgactie |
| 20 | latere uitkomst |

---

## 2. Twee weergaven

**AIE-53** De **UI toont de begrijpelijke versie**: wat, waarom, hoe zeker, wat nu. In gewone taal, binnen het mobiele tekstbudget.

**AIE-54** **Audit en Mirror krijgen de volledige technische versie**: alle twintig velden, inclusief promptversie, modelnaam en engine-uitkomsten.

**AIE-55** De twee weergaven komen uit hetzelfde dossier. Een verschil tussen wat de gebruiker leest en wat er is vastgelegd, is een fout.

---

## 3. Twee velden die vaak vergeten worden

**Veld 15 — waarom het alternatief niet is gekozen.** Zonder dit veld is een advies niet te beoordelen: je ziet alleen de uitkomst, niet de afweging. Het is ook het veld dat een verzonnen advies het snelst ontmaskert.

**Veld 20 — latere uitkomst.** Dit wordt pas ingevuld ná het advies en is de grondstof voor het leren uit deel 7. Zonder dit veld leert het systeem niets en blijft "leren" een woord.

---

## 4. Harde regels

**AIE-56** Een advies zonder dossier wordt niet getoond. Deze regel geldt voor **nieuwe** adviezen vanaf F1, en wordt pas geactiveerd nadat de overgang is bewezen.

**Bestaande adviezen — de overgang.** Adviezen die vóór F1 zijn ontstaan, worden **niet met verzonnen waarden aangevuld**. Zij krijgen de status **`LEGACY_NIET_VOLLEDIG_HERLEIDBAAR`**, de UI benoemt dat eerlijk waar het relevant is, en zij blijven werken. Er verdwijnt geen bestaand, werkend advies doordat deze laag wordt ingevoerd, en bestaande deterministische adviezen kennen geen regressie.
**AIE-57** Velden worden niet met plaatsvervangende waarden gevuld. Ontbreekt een gegeven, dan staat dat in veld 16.
**AIE-58** Het dossier wordt server-side bewaard; niets wordt lokaal als vastgelegd getoond zonder serverantwoord.
**AIE-59** Het dossier is onveranderlijk. Een herzien advies is een **nieuw** advies met een verwijzing naar het vorige.
**AIE-60** Veld 12 en 13 komen uit de confidence-standaard, niet uit een taalmodel.

---

*Deel 10 van 21.*
