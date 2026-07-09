---
name: Sparki Voeding screen
description: How nutrition/voeding is structured — dedicated screen, photo logs, age-tuned guidance.
---

Voeding is its own dedicated screen (right Sheet) opened from a Vandaag card, NOT an inline expand. `?focus=nutrition` opens the sheet directly.

**Why:** food logging + photo advice + knowledge was buried (inline expand on Vandaag, photo-chips inside Materiaalcoach). It needed first-class space.

**How to apply:**
- Nutrition photos reuse the material storage engine (`uploadMaterialPhoto`/`streamMaterialPhoto`); logs store `photoPaths` and are served owner-checked via `GET /api/nutrition/photo/:id/:idx`. Photo-advies categories are the `kind==="nutrition"` rows of the same material categories; Materiaalcoach is filtered to `kind==="material"`.
- `/api/nutrition/guidance` is real LLM grounded in athlete context; age from `birthYear`, youth `<16` = light/positive/no-numbers, adult = concrete fueling numbers. Honest 5xx, robust JSON parse, no user-facing "AI".
- Guidance query must be gated `enabled={sheetOpen}` so the LLM call doesn't fire while the sheet is closed.
- **Any at-submit-time processing needs a retroactive path.** A tester's meal photo logged minutes before the assessment feature deployed sat in storage forever ("er gebeurt niks mee"). When a feature processes input at POST time, also add an owner-checked on-demand endpoint (e.g. `POST /api/nutrition/:id/photo-advice`) + a visible retry action on the stored item — deploy timing and transient LLM failures otherwise turn stored data into a silent dead-end, especially if failure copy promises "probeer het later opnieuw".
