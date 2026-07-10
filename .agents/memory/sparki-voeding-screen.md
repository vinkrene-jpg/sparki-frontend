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
- **Text-only food logs also get a real estimate, and quantity is rider-authoritative.** A meal typed without a photo (`preTrainingFood`/`postTrainingFood`, NOT notes-only) must still return nutrition values — mirror the photo path with a text analyzer. The `/:id/photo-advice` endpoint doubles as the re-assess path for BOTH photo and text logs and takes an optional `correction` string that overrides the read ("het waren 10 broodjes, niet 6"). **Why:** the rider was there; a visual/text count is a guess, their stated amount wins. Frontend gates loading/labels on `photos OR foodText` (willAssess), and `followUpQuestion` must show for text source too (text analysis sets `needsMorePhoto=false`, so gating only on that hides valid follow-ups).
