---
name: Taalherstel merknaam-lint
description: UI-copy mag de merknaam niet in de derde persoon gebruiken; bewaking via scripts/check-brand-copy.mjs + zin-exacte allowlist.
---

Regel (opdracht TAALHERSTEL 31-07-2026): gebruikersgerichte UI-zinnen spreken direct ("Bekijk de analyse"), nooit derde persoon ("Sparki ziet…"). Toegestaan blijven: appnaam/logo, productnamen "Sparki Go"/"Sparki Compleet", juridische teksten, formele e-mails/afzendernaam, organisatie-als-geheel, LLM-promptidentiteit, testbestanden.

**Bewaking:** `node scripts/check-brand-copy.mjs` zit in de `typecheck-api`-validatieketen. Uitzonderingen horen zin-exact in `scripts/brand-copy-allowlist.json` (`file` exact + `contains` + `reason`); alleen juridische tekst mag bestandsbreed.

**Why:** architect-review wees uit dat bestandsbrede allowlist-entries stille false negatives geven; en een regelbrede `/*`-vrijstelling liet copy ná een JSX-commentaar door — daarom commentaar-strip per regel.

**How to apply:** nieuwe UI-copy nooit "Sparki <werkwoord>"; bij een bewuste uitzondering altijd de exacte zin + reden in de allowlist zetten, nooit het hele bestand.
