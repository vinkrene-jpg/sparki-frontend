---
name: Sparki file-import as a Data Hub source
description: Manual GPX/FIT/TCX uploads are a canonical connector ("file" provider), not a silo — the source-neutrality contract for future no-API platforms.
---

# File uploads are a first-class Data Hub source

Manual activity-file uploads (GPX/FIT/TCX) flow through the SAME `ingestBatch`
pipeline as any connector, under the neutral provider id `"file"`. A parsed file
is mapped to a `CanonicalActivity` and ingested, so cross-source dedupe/merge,
TSS derivation, and provenance all apply for free and every downstream engine
consumes an upload identically to a Strava sync.

**Why:** the product doctrine is source-neutrality — a platform that will never
grant partner API access (TrainingPeaks) must be addable later with ONLY a
connector, zero engine/dashboard changes. Manual export→import is that path
today. Before this, file upload was a silo that only wrote `activity_imports`
and never created a `training_sessions` row.

**How to apply:**
- Map summary→canonical in `lib/activity-file-ingest.ts`. Return `null` when the
  file has no real start time (a bare route GPX is a route, NOT a dated
  activity — never fabricate a date). Every metric the file omits stays null.
- Consent for a user's own upload is granted locally (`activities` +
  `training_history`) — do NOT require third-party connector consent; the file
  IS the user's data.
- `externalId` = **content-only** sha1 (filename deliberately excluded) so a
  byte-identical export renamed on disk is the same activity (idempotent
  provenance, no duplicate session).
- Import status semantics: dated file → `linked` (+ `linkedTrainingSessionId`);
  timeless GPX → `parsed`; no-parser CSV/unknown → `uploaded` (honest
  placeholder). On UNLINK restore the honest pre-link status via
  `unlinkedImportStatus(fileType, hasParsedSummary)` — any parseable type
  (gpx/fit/tcx) returns to `parsed`, not `uploaded`. When adding a new parser,
  update `PARSEABLE_FILE_TYPES` in lockstep or unlink silently downgrades it.
- Wrap ingest in try/catch in the route so a hub hiccup NEVER loses the parse —
  still record the import with an honest error note.
