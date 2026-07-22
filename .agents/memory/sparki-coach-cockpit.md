---
name: Sparki Coachomgeving (cockpit)
description: Coach dashboard, signalen, planning-CRUD, voorstellen, berichten, context-items — ownership & idempotency lessons.
---

# Sparki Coachomgeving

- **Cross-coach isolatie needs an owner column, not just link-gating.** Two coaches can both hold an accepted link to the same athlete; link+sharing gates alone let coach B edit coach A's workouts. `planned_workouts.coach_clerk_id` (nullable, additive) records the creating coach; PUT/repeat/proposal-decision allow only owner-or-legacy-null; proposal lists join workouts and filter by owner.
  - **Why:** authorization must key on resource ownership, not merely relationship to the athlete.
  - **How to apply:** any coach-writable resource tied to an athlete needs its own creator/owner column checked on every mutation.
- **Read-then-insert idempotency races.** Open-proposal uniqueness enforced with a partial unique index (`workout_id WHERE status='open'`) + `onConflictDoNothing()`; drizzle partial-index predicate key is `.where(sql\`...\`)` on `uniqueIndex`.
- **`or(...empty array)` in drizzle produces invalid SQL** — guard list-driven `or()`/mark-as-read updates with a length check or use `inArray`.
- Sparki never auto-overwrites coach workouts: athlete feedback creates a coach_change_proposals row; only an explicit coach decision applies changes.
- Messaging gate is looser than data gate: accepted link suffices (even sharing "none"); data surfaces require sharing != none (fail-closed).
