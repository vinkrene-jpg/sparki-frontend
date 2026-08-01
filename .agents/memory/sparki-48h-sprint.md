---
name: Sparki 48-uurs afbouwsprint (besluit 31-07-2026)
description: Bindende sprintregels van René die de eerdere per-stap-vrijgave vervangen tijdens de sprint.
---

# 48-uurs volledige afbouwsprint — besluit René 31-07-2026

Bron: attached_assets/Pasted-SPARKI-48-UURS-VOLLEDIGE-AFBOUWSPRINT-BESLUIT-REN-*.txt (staging; besluit is bindend).

**Regelwijzigingen t.o.v. het synchronisatiepakket 31-07:**
- Na een GROENE Mirror-toets start automatisch de volgende vastgelegde opdracht — geen aparte expliciete vrijgave per stap meer nodig tijdens de sprint.
- Open punten #10/#12/#13 zijn geparkeerd (blokkeren niet); niet meer elke beurt tonen.
- Verplichte volgorde afhankelijke delen: 01-hertoetsing → 02a → 02b → 02c → 02d → Wandelen v2 (BOUWOPDRACHT_WANDELEN_v2, taak #536) → volledige regressie.
- Parallel mogen alleen domeinen die de routeketen-code/tabellen/rechten NIET raken.
- Downgrade naar Gratis (productbesluit): routes boven de limiet worden alleen-lezen, niets verwijderen, gebruiker kiest zelf welke 3 actief blijven (hoort bij 02c).
- Afgerond = uitsluitend MIRROR_PROVEN; "gebouwd maar niet getoetst" telt niet. Eindeis: één totaaltabel met MIRROR_PROVEN / AFGEKEURD MET BLOKKADE / NIET BEWIJSBAAR MET REDEN.
- Stoppen alleen bij: datarisico, ontbrekend productbesluit, architectuurblokkade, Mirror-afkeuring.
- Defecte zichtbare schermen repareren, nooit verbergen/verwijderen/doorschuiven; geen mock/seed/demo-data als echte gebruikersdata.

**Why:** René wil de volledige huidige scope in 2 bouwdagen bewezen af; de oude per-stap-vrijgave was te traag.
**How to apply:** statusregister bijhouden in docs/SPARKI_48U_AFBOUWSPRINT_STATUS.md; per domein bewijs (start/eind-SHA, tests+exitcodes, desktop/mobiel/API-bewijs, Mirror-oordeel).
