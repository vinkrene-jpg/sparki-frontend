---
name: Sparki reminder delivery (email)
description: Durable rules for honest scheduled email reminders — idempotency, "ready" means the SENDER domain is verified, never fake-send.
---

Sparki delivers reminders (evening check-in, open follow-ups, training tomorrow, races within ~3 days) via in-app notifications plus optional email.

**Idempotency rule:** every reminder carries a stable `dedupeKey` and rides a *partial* unique index on `notifications (clerk_id, dedupe_key) WHERE dedupe_key IS NOT NULL`, plus a `sentAt` column. A reminder already emailed (`sentAt` set) is never re-sent; a *failed* email leaves `sentAt` NULL so the next run retries. The partial-index upsert must use `onConflictDoNothing({ where })` — see `drizzle-onconflict-partial-index.md`.

**Email honesty rule (the one that bit us):** the channel is "ready" (Health Check green) ONLY when the domain we actually send FROM is itself verified — i.e. `isSenderDomainVerified(fromAddress(), verifiedDomains)`. It is NOT enough that *some* domain is verified, nor that a custom sender env var is merely set.
- **Why:** an earlier version returned `ready` whenever `verified.length > 0 || customFromSet`, but the actual sender could still be the sandbox fallback (`onboarding@resend.dev`, owner-only delivery) or a non-verified domain → a false-positive "green" that would silently fail to reach athletes. Code review rejected it.
- **How to apply:** classification lives in a pure `classifyVerifiedChannel(verified, from)` so it is unit-testable without the proxy; the proxy call only fetches verified domains then delegates to it. Delivery gates on `state === "ready"`, so fixing the classifier also stops sandbox sends. When no domain is verified the channel stays "limited" (Health Check orange) and reminders are in-app only — never fabricated.

Provider is Resend via the Replit connectors proxy (no API key in code). A verified sending domain + a `from` address on it is the only path to real athlete email. The scheduled job should run a few times/day; evening check-ins only fire after 17:00 local.
