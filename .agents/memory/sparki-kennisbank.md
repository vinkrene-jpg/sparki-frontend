---
name: Sparki Kennisbank governance
description: Golf 21 governed knowledge layer — lifecycle, version pinning, engine injection, honest citations.
---

# Kennisbank (governed knowledge layer)

- One governed layer, additive on existing knowledge/uitleg/document layers — never a second kennisbank.
- Lifecycle: concept → actief → verouderd/ingetrokken. Editing an ACTIVE item resets it to concept (never silent change). Retracted is final: edit/publish return 409, never republishable.
- Publish runs in a transaction with `SELECT ... FOR UPDATE`, bumps version and writes an immutable snapshot row. Usage events pin the exact version used by an engine.
- **Why:** citations must stay truthful over time — an engine's "bron: X v2" must always resolve to the text that was actually used.
- Engines consume knowledge two ways: LLM prompts get a `knowledgeSourceBlock` (literal text, prose must not rewrite numbers); the deterministic race-advice engine takes managed items as extra "feit" advice items (domain `vakkennis`, body verbatim, source in `basis`). Returning citations WITHOUT feeding the content into the advice is a review-fail — architect flagged exactly that.
- Only record usage for items actually consulted in composition (no false audit pinning).
- `isAdmin` returns true under DEV_AUTH_BYPASS, so HTTP 403 tests are impossible in dev-bypass test harness — test the guard directly with bypass toggled off.
- Document analysis per-field `page` numbers: honest null when the model is unsure; validate integer ≥1 before persisting to `sourcePages`.
