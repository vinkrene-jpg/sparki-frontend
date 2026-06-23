---
name: Dutch-only copy — accepted proper-noun exceptions
description: Which English terms are allowed exceptions to the hard "all user-facing copy plain Dutch" rule, so future agents don't wrongly "translate" them.
---

The hard rule: every rendered user-facing string in Sparki must be plain Dutch (no English tech-jargon, never "AI").

**Accepted exceptions (do NOT translate these):**
- **Sparki** — the product/brand name.
- **Performance Center** — the product's full name is literally "Sparki — Performance Center" (see replit.md). Treated as a brand proper noun, used in onboarding ("Naar je Performance Center") and not-found copy.
- **FTP** — keep the acronym, but spell out its meaning in Dutch around it (e.g. "Je FTP — het vermogen dat je langdurig kunt volhouden — …"). Never render "Functional Threshold Power".
- **gran fondo** — established cycling term, kept as-is.
- **W / kg / cm** — units kept; but English abbreviations like "yr"/"hr" must become "jr"/"u".

**Why:** Onboarding (the adaptive question bank in api-server `lib/onboarding-questions.ts`, the quick-start flow, and the profile-prompt card) originally shipped fully in English and had to be retranslated during QA. The DB-stored DISCIPLINE option *values* ("Road"/"Gravel"/"Mountain"/"Track") must stay English for storage compatibility — translate only the labels.

**How to apply:** When QA-ing or adding any user-facing copy, grep changed files for English render strings before sign-off. Backend FactDef `prompt`/`help`/option-label strings ARE user-facing (served to the prompt card) — they count.
