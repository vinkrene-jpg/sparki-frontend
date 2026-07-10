---
name: Sparki exact age from date of birth
description: Why age uses a full birth_date (not year-only) and how the birthDate/birthYear lockstep works.
---

# Exact age from date of birth

Age must be computed from a full date of birth, not `currentYear - birthYear`.
The year-only subtraction overshoots by up to a full year for anyone whose
birthday hasn't happened yet this year (a tester born 24-09 showed 19 while
still 18). `birth_date` (nullable `date`) is the source of truth; `birthYear`
stays as a coarse fallback for older profiles that never captured a full DOB.

**Rule:** never compute age inline. Use the shared `computeAge(birthDate,
birthYear, now?)` helper — it exists in BOTH `artifacts/api-server/src/lib/age.ts`
and `artifacts/sparki/src/lib/age.ts` (keep them in sync). It returns exact age
from DOB, falls back to year-only, and returns `null` when neither is usable or
the result is implausible (<0 or >120).

**Lockstep:** when a valid `birthDate` is written via `PUT /api/athlete/profile`,
`birthYear` is ALWAYS re-derived from it — even if the caller sent a conflicting
`birthYear` in the same payload. This guarantees the year-only fallback can never
drift from the exact date.

**Why:** the two columns must agree so any code path (DOB-aware or year-only)
yields the same age; a diverging pair would make age depend on which field a
given screen happened to read.

**How to apply:**
- Any new age site: select `birthDate` alongside `birthYear`, call `computeAge`.
- The `PUT /profile` handler follows the endpoint's existing convention:
  invalid/future dates are silently ignored (not a 400), same as `heightCm` and
  `birthYear`, so one bad field never discards other valid fields in the save.
  The frontend date input already blocks future/invalid values (max=today).
- Schema pushes via drizzle-kit need a TTY here; add columns with raw
  `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` then `pnpm --filter @workspace/db run build`.
- Onboarding intentionally stays year-only (accepted coarse fallback).
