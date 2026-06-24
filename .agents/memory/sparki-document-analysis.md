---
name: Sparki Document Analysis engine
description: How Sparki reads race/technical guides (PDF/image) and extracts key facts honestly.
---

# Sparki Document Analysis engine

Engine `document-analysis` reads an uploaded race/technical guide and returns
structured `gevonden / ontbreekt / wenselijk` + Dutch follow-up questions.

**Honesty contract (same spirit as health-check):** the LLM fills a field ONLY
if it's literally in the document, else `value: null`. Found/missing and the
follow-up questions are derived deterministically from the field map — they are
NOT invented by the model. Low-confidence present values earn a "Klopt het
dat…?" confirm question; missing core/desired fields earn a templated question.
**Why:** project rule "geen verzonnen data; bij onzekerheid vraagt Sparki door."

**Real extraction path:** Anthropic `messages.create` with a `document` block
(Base64PDFSource, media_type application/pdf) for PDFs, or an `image` block for
images. The Replit Anthropic proxy DOES support PDF document blocks (verified
end-to-end). Model claude-sonnet-4-6. `analyzeDocument` throws on bad output so
the route records status `failed` honestly instead of persisting fakes.

**Canonical fields** live in `lib/document-analysis/fields.ts` (core vs desired
tiers, each with a Dutch label + question). Add new fields there; the derive
logic and the frontend `FIELD_LABEL`/`QUESTION_FIELD` maps must stay in sync.

**Race linking:** `POST /:id/link` sets `linkedRaceId` AND enriches the linked
race via `fieldsToRacePatch` — only filling race columns that are currently
empty (startTime, location, distanceKm→distanceKm, stageType→course). Never
overwrites existing race values.

**Upload size:** base64 in JSON body; express limit is 12mb, client caps file at
11mb (base64 ~15mb of an 11mb file would exceed — but PDFs/photos are small).
