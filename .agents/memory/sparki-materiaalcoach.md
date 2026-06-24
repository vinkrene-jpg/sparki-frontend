---
name: Sparki Materiaalcoach
description: Photo-driven equipment/nutrition advice engine — honesty contract, cost estimate, storage flow.
---

# Sparki Materiaalcoach

Photo-driven coach where Sparki judges REAL uploaded equipment/nutrition photos and
gives honest advice (pros/cons/risks/alternatives) with explicit confidence, asks for
an extra photo when uncertain, and adds a DIY-vs-professional cost estimate (own
confidence) for material cases only.

## Honesty contract (do not soften)
- Vision call must return explicit `confidence` (unknown|low|medium|high). Low/unknown →
  `needsMorePhoto:true` + a concrete `followUpQuestion` instead of guessing.
- `costEstimate` only for `kind:"material"` (never for nutrition). DIY/professional sub-blocks
  are null when not honestly estimable; the estimate carries its OWN confidence.
- Never fabricate — `detectedItem` falls back to the category label, advice arrays may be empty.

## Category registry = SSOT for which questions Sparki may ask
- `MATERIAL_CATEGORIES` in `lib/material/analyze.ts`, re-exported via `engines/material`.
  Context-sensitive prompts only — never a mandatory form, never during onboarding.
- Each category has `kind: material|nutrition` which gates the cost estimate.

## Storage flow
- Photos go to object storage (App Storage bucket), ACL owner/private, paths in
  `material_analyses.photoPaths` (jsonb string[]). Persist photos only AFTER a successful
  analysis. Served via ownership-checked `GET /api/material/photo/:id/:idx` streaming from GCS.
- Add-photo flow (`POST /:id/photo`) re-downloads prior photos to base64 and re-judges ALL
  photos together, so confidence reflects the full set.
- **Why:** copied objectStorage.ts template had a `signed_url` on `unknown` TS error — cast the
  `response.json()` result. Fix-before-review applies to copied template code too.

## Client
- `fileToResizedPhoto` (canvas downscale to max edge 1536, jpeg 0.85) keeps uploads small and
  within vision input limits; sends raw base64 + mediaType. Express body limit is 12mb.
- Mounted as section "09 Materiaalcoach" in `pages/lab.tsx` (Inzicht), alongside Nutrition/Memory panels.
