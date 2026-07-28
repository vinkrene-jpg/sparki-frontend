---
name: Sparki Ontdekken visual feed
description: /feed visuele kaartenfeed — engine, personalisatie en sfeerbeeld-regels
---

# Ontdekken (/feed) visuele feed

- Pure engine `artifacts/sparki/src/lib/ontdekken-feed.ts` (+ tests, run via `node --import tsx --test`): nieuws-classificatie (woordgrens-regexes → nieuws/materiaal/trainingstip), personalisatie-score, mengFeed (max 2 zelfde types op rij), stabieleIndex voor sfeerbeeld.
- Voorkeuren (`feed-prefs.ts`) zijn bewust localStorage per apparaat — copy zegt "op dit apparaat"; nooit doen alsof dit account-breed synct.
- Sfeerbeelden komen ALLEEN uit de centrale atmosphere-bibliotheek, deterministisch per kaart-key; geen tekst over beeld behalve één chip met backdrop-blur op de rustige hoek. Categorielabel nooit dubbel (chip óf tekstregel).
- **Why:** brief eiste alleen echte data + rustige visuele feed; beelden zijn sfeer, geen artikel-foto's — niet presenteren alsof ze bij het artikel horen.
- **How to apply:** nieuwe feedbronnen → kaart in de useMemo-builder + type in engine; nooit mock-items. `useKnowledge` query-key bevat nu `limit` (verschillende limits deelden cache — bug).
- Skeletons app-breed: gebruik `motion-safe:animate-pulse` (reduced motion).
