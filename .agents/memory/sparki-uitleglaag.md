---
name: Sparki uitleglaag (UitlegDot)
description: App-brede uitleglaag — centraal registry + toegankelijke info-dialog; regels voor eerlijke persoonlijke context.
---

De uitleglaag bestaat uit één centraal registry (`lib/uitleg-content.ts`, per key wat/waarom/hoe + versie) en één component (`UitlegDot` in `components/viz/uitleg.tsx`).

**Regels:**
- Nieuwe technische termen/grafieken krijgen een `UitlegDot` met een key uit het registry — nooit losse tooltips of ad-hoc uitlegteksten in componenten.
- Persoonlijke "Bij jou"-regels komen uit `buildUitlegContextRegels` en gebruiken uitsluitend echt aangeleverde waarden; ontbreekt data, dan een eerlijke "nog niet bekend"-regel, nooit een verzonnen getal.
- **Why:** de doelgroep (jeugdrenners/ouders/coaches) begrijpt jargon niet; dubbele definities of gefabriceerde context ondermijnen vertrouwen.
- **How to apply:** bij elke nieuwe metric/grafiek eerst registry-key toevoegen (test dwingt unieke 'wat'-tekst en geen "AI"-woord af), dan de dot plaatsen. Bare "TSS"-labels heten "Belasting (TSS)".
- A11y-contract van de dialog: aria-haspopup, focus-trap, Escape/backdrop sluiten, focus terug naar trigger, 44px hit area.
