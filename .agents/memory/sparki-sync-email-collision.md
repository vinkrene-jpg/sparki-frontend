---
name: Sparki auth/sync email-collision brick
description: Why seeded demo rows with real emails brick onboarding, and the sync insert-order rule that prevents it.
---

# auth/sync email collision → onboarding brick

`user_profiles.email` is `UNIQUE` and `athlete_profiles.clerk_id` has an FK →
`user_profiles.clerk_id` (onDelete cascade, no onUpdate cascade).

**The trap:** `POST /api/auth/sync` upserts `user_profiles` then inserts
`athlete_profiles`. If `user_profiles` insert uses `onConflictDoNothing()` and the
email already belongs to a *different* clerkId, the insert no-ops → no parent row
for the current clerkId → the `athlete_profiles` insert violates the FK and 500s.
The profile is never created, so every later `PUT /api/athlete/profile` returns
404 "Profile not found" (the symptom the user sees on the onboarding screen).

**Rule:** in sync, after the user_profiles upsert, re-select by clerkId and only
insert athlete_profiles when that parent row exists. On collision return a clear
409 (Dutch copy), never attempt the child insert.

**Why it actually happened:** a demo/seed task wrote a realistic athlete (real
Gmail address, full plan/memory/observations) into the **shared** DB. The real
human signed in via Clerk with the same email under a new clerkId → collision.

**How to apply / prevent:**
- Never seed demo data using a real person's email into the shared (dev==prod)
  database. Replit deployments commonly reuse the dev `DATABASE_URL`.
- To clear such pollution: delete the seed clerkId across every `clerk_id`-keyed
  table (≈23 tables; query `information_schema.columns WHERE column_name='clerk_id'`),
  `user_profiles` last (athlete_profiles cascades). Freeing the email lets the
  real user sync cleanly — no redeploy needed for the data fix.
- Open follow-up (not done): derive `email` in sync from Clerk claims instead of
  trusting the request body (prevents squatting/enumeration).
