---
name: Sparki invitation/tester flow
description: Token-based invite flow design + the atomicity rule for accepting one-time tokens
---

# Sparki invitation / tester flow

Token-based invites grant a role and (optionally) create a coach_athlete / parent_athlete link on accept.

- `invitations` table: token (unique), inviterClerkId, createdByRole, targetRole, relationship (`coach_athlete`|`parent_athlete`|`none`), email?, status (`pending|accepted|expired|revoked`), acceptedByClerkId?, expiresAt.
- Permissions: coach_athlete needs coach role; parent_athlete needs parent role; `none` (role grant) needs admin (`isAdmin` from `SPARKI_ADMIN_IDS` in `lib/flags.ts`). `/api/auth/me` returns `isAdmin`.
- Self-accept blocked for relationship invites; revoke restricted to inviter/admin and only while pending.
- Lazy expiry: `expirePending()` flips pending+past-expiry → expired; **call it before revoke too**, not just on reads, or an expired invite can be revoked as if active.

## Rule: accepting a one-time token must be atomic
Do the `pending → accepted` status flip as a **conditional UPDATE inside a transaction** (`WHERE id=? AND status='pending' RETURNING`), and only grant role + create link if that UPDATE matched a row (else 409). A read-then-update without the status guard lets concurrent accepts all pass the check and double-apply.

**Why:** a plain read-check then update-by-id is non-atomic — 10 concurrent accepts otherwise all succeed. Verified fix: 1×200, 9×409, exactly one link row.
**How to apply:** any "consume token / claim once" endpoint — make the state transition itself the guard, wrapped in `db.transaction`, not a separate pre-read.

## Dev-preview routing caveat
`dev-preview.tsx` mounts pages directly (no `<Route>`), so `useParams()` returns empty there. For `/invite/:token`, derive the token from `useLocation()` (regex on the base-stripped path) so it works both under the prod `<Route>` and dev-preview.
