---
name: Sparki tester overview & session telemetry
description: Admin tester roster on /invitations + how honest last-login/device/app-version telemetry is captured.
---

# Tester overview & session telemetry

The admin `/invitations` screen ("Testers & koppelingen") has a "Testeroverzicht"
section: one card per invitation showing Naam, Testernummer (#001), Rol, Status,
Uitgenodigd, Laatste login, App-versie, Toestel, and Feedback/Bugs/Ideeën counts.

## Telemetry honesty rule (the durable decision)
- `recordTelemetry()` runs on every authenticated `/api/auth/me` + `/sync`.
- It ALWAYS writes `lastSeenAt = now`, but writes `lastPlatform` / `appVersion`
  **only when the signal is actually present** (UA matched a known device; the
  `X-Sparki-App-Version` request header was sent). A missing signal must NOT
  overwrite a previously-captured honest value with null.
- **Why:** these fields started untracked. Showing "—" until first real capture
  is the honesty contract; fabricating or clobbering would violate it.
- Untracked-but-now-captured: device from User-Agent parse, version from the
  `X-Sparki-App-Version` header that `lib/api.ts` attaches to every request.
- `recordTelemetry` must NOT bump `updatedAt` (it's not a profile edit).

## Roster scope decision
- `GET /api/admin/testers` returns ONE ROW PER INVITATION (no relationship
  filter), LEFT JOIN profile on `accepted_by_clerk_id` + grouped `bug_reports`
  counts (`kind` bug/idea). **Why not filter to "real testers" only:** in the
  beta every invited participant (coach, parent, role-invitee, head-tester) IS a
  tester; filtering would HIDE real testers and reduce completeness. Matches the
  sibling "Verstuurde uitnodigingen" per-invitation model.

## Status / role derivation (frontend `lib/tester-types.ts`)
- Status: testerCompletedAt→Klaar, accepted→Actief, revoked→Ingetrokken,
  expired→Verlopen, else Uitgenodigd. Admin toggles Klaar via
  `POST /api/admin/testers/:clerkId/complete {completed}` (404 if no profile).
- Rol: head-tester→Hoofdtester, coach→Coach, parent→Ouder, else Tester.
- Testernummer is an EXPLICIT field with "—" fallback (not a conditional badge).
