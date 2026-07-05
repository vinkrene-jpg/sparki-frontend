---
name: Sparki profile-consistency questions
description: How Sparki notices profile values that contradict real riding, asks first, and corrects only on confirmation
---

# Profile-consistency (notice → name → ask → confirm → correct)

The observation engine detects profile claims that contradict proven riding
(user-set FTP below a proven whole-ride floor, "beginner" with big real weeks,
week target far from actual median hours) and raises them as observations plus
follow-up questions. A correction is applied ONLY on the athlete's "pas_aan"
answer.

**Rules that must hold when extending this:**
- Detection is pure over a `ProfileFacts` snapshot (claims vs proof); estimated
  values (ftpEstimated / weeklyHourTargetEstimated) are EXCLUDED because they
  self-heal after every sync — only user-set values get a question.
- The write path re-verifies the inconsistency from the DB before writing AND
  uses compare-and-set (`WHERE` on the exact verified pre-state + `.returning()`
  length check). Zero rows ⇒ honest `applied:false`, never a blind overwrite.
- A confirmed FTP correction is written as `ftpEstimated=true` (it's a floor,
  not a measurement) so future stronger efforts keep raising it, and gets a
  per-day idempotent `ftp_history` derived row.
- Profile follow-up answers are retained ~45 days in `loadTodayAnswers` (not
  just today) so "laat_staan" doesn't nag daily. Answers are deduped by
  questionId with the latest date winning.

**Why:** user-set values must never be auto-touched (product law), yet stale
confirmations from an open tab must also never clobber a fresh edit.

**Gotcha:** `ensureAccount` in lib/account takes POSITIONAL args
`(clerkId, email, displayName, logger)` — not an options object.
