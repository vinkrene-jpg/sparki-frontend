---
name: Sparki tester QR onboarding access
description: How the QR tester-entry flow is wired and the two non-obvious constraints behind it.
---

# Tester QR onboarding access

A tester scans a QR → opens the live app → signs in → (token) accepts invite →
accelerated onboarding (QuickStartFlow). QR codes are generated client-side with
`qrcode.react` (QRCodeCanvas, download via `canvas.toDataURL`). Page: `/tester-qr`.

## Non-obvious constraint 1 — token must survive the sign-in round-trip
A signed-out visitor to `/invite/:token` cannot go through plain `ProtectedPage`
(it redirects to `/sign-in` and drops the token). Instead the invite route
redirects to `/sign-in?redirect_url=<basePath + invite path>`.
**Why:** Clerk's `<SignIn>` honours the `redirect_url` query param over the
page's `fallbackRedirectUrl`, so the tester returns to the invite page after
auth and the role/link is granted. `redirect_url` must include `basePath`
because Clerk's routerPush runs it through `stripBase`.
**How to apply:** Any new "deep-link behind auth" entry point should use the
`redirect_url` query param pattern, not a bare redirect to `/sign-in`.

## Non-obvious constraint 2 — QR base URL is editable, not just origin
The QR base defaults to `window.location.origin` but is an editable field
persisted in localStorage (`sparki_qr_base_url`).
**Why:** codes are often prepared from the workspace preview, whose origin is the
dev domain — not the published deployment. There is no reliable way to read the
*deployment* domain from a dev session, so the operator pastes/opens-on the live
domain once. Opening the page on the published app makes the default correct.

## Scope kept
Accept stays a one-tap screen (reusing the existing invitation flow) rather than
auto-accepting — auto-accept would be new auth logic (out of scope).
