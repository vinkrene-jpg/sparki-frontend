---
name: Sparki Fietsengarage
description: Honesty rules for the bike garage component knowledge base and upgrade advice.
---

# Sparki Fietsengarage

- Component ratings are NEVER stored — klasse/aero/gewicht derive live from the curated in-code knowledge base; unknown parts stay honestly "onbekend".
  - **Why:** stored ratings go stale and could be faked; live derivation keeps the honesty contract and applies KB updates retroactively.
  - **How to apply:** new garage surfaces call the assess function server-side; never persist a klasse.
- KB matching must be strict whole-word matching with letter↔digit splitting (so "GP5000" ≡ "GP 5000") — a permissive substring fallback caused false positives ("red" inside "Shredder" matched SRAM Red), which fabricates ratings. Code review rejected the first version for exactly this; keep regression tests for incidental substrings.
- Upgrade advice is deterministic (specialism weight × class headroom) with only direction labels — never invented watts/grams; unknown parts go in an honest separate bucket.
- Pro-team matching = brand overlap only, with season + source attribution; unmatched teams stay visible as an overview, never fabricated matches.
