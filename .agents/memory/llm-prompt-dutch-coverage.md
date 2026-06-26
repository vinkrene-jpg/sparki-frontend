---
name: LLM prompt Dutch coverage
description: Every separate LLM prompt must independently carry the Dutch output rule; the structured-extraction prompt is not covered by SPARKI_SYSTEM.
---

# LLM prompts each need their own Dutch output rule

User-facing copy must be plain Dutch (no English). The main coaching prompt
`SPARKI_SYSTEM` (built in `lib/athlete-context.ts`) enforces this, but **other
LLM prompts are separate strings and do NOT inherit that rule**.

The structured-observation extractor `EXTRACT_SYSTEM` in
`lib/ai-memory.ts` was written in English with no language instruction, so the
model emitted observation `title` / `summary` / `observationText` /
`recommendedAction` in English. Those persist to `ai_observations`
(sourceType `training_analysis` from `/api/ai/brief`, `ai_chat` from
`/api/ai/ask`) and surface on the /you (JIJ) Core page as English insight cards.

**Why:** structured-output prompts return JSON whose *values* are still
user-visible; the enum keys (category/severity/confidence) stay English codes,
but the human-readable values must be Dutch.

**How to apply:**
- Any prompt that produces user-visible text needs its own explicit Dutch rule
  (and the no-"AI" / neutral-voice rules). Audit each `anthropic.messages.create`
  system string separately. As of this writing the Dutch-correct ones are
  `document-analysis/analyze.ts` and `material/analyze.ts`; the gap was
  `EXTRACT_SYSTEM`.
- Fixing the prompt only changes *future* extractions. Already-persisted English
  rows linger until they expire. To clear them, expire the LLM-extracted source
  types only (`training_analysis`, `ai_chat`) — `UPDATE ai_observations SET
  expires_at = now() WHERE source_type IN (...) AND status IN
  ('new','acknowledged','saved')`. They regenerate in Dutch on the next brief.
  Do NOT expire `daily_briefing` (the brief text is Dutch via SPARKI_SYSTEM) or
  `connection_analysis` (deterministic Dutch from memory-graph correlations).
