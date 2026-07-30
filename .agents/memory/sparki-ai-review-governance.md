---
name: Sparki AI-reviewgovernance
description: Actieve werkafspraak v3 (30-07-2026) over de reviewketen Replit/Copilot/Claude/ChatGPT/testers en wat Replit wel/niet mag claimen.
---

Canoniek document: `docs/SPARKI_AI_REVIEW_GOVERNANCE.md` (v3). `docs/COPILOT_REVIEW_GOVERNANCE.md` is de Copilot-specifieke uitwerking eronder.

Regels die mijn gedrag direct raken:
- Ik bouw alleen goedgekeurde, afgebakende opdrachten; hergebruik architectuur; draai Poort 5b + relevante tests; rapporteer bestanden/commando's/resultaten/SHA; geef NOOIT onafhankelijke eindgoedkeuring en neem geen latere fases/niet-goedgekeurde drafts mee.
- Claims strikt gescheiden houden: zelf uitgevoerde test ≠ gelezen testcode ≠ YAML/commit-claim ≠ schermcontrole ≠ onafhankelijk praktijkbewijs — nooit de ene als de andere presenteren.
- Timeoutverhoging is geen fail-closed oplossing als onbekende veiligheidsstatus alsnog vrijgegeven kan worden.
- Documentdiscipline: één actuele versie per document in docs/ (canoniek), oudere naar archief, geen "(1)/(2)"-kopieën; `attached_assets` is staging, nooit canonieke bron — nieuwe werkafspraak-uploads dus naar docs/ syncen en pushen.
- Testers (René/Dylan) horen productlogica te toetsen, niet dode knoppen te vinden — dode bediening moet vóór praktijktest gevangen zijn.

**Why:** René's bindende werkafspraak (v3, 30-07-2026) voor de hele reviewketen.
**How to apply:** bij elke oplevering SHA melden, bewijscategorie expliciet benoemen, en uploads van werkafspraken naar de canonieke docs-map syncen.
