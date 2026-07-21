---
name: Sparki device sync (Garmin/Wahoo)
description: Cloud-to-cloud route push scaffolding; honest not-configured state until manufacturer keys exist.
---

Rule: Garmin/Wahoo route sync is fully wired (OAuth2, tokens in connector_connections, push endpoints) but reports `configured:false` until GARMIN_/WAHOO_CLIENT_ID+SECRET secrets exist; the UI says "wacht op goedkeuring fabrikant" — never a fake connected state.

**Why:** both platforms only grant server API access after developer-program approval; faking readiness violates the honesty contract.

**How to apply:** mirror strava-oauth.ts pattern (HMAC-signed stateless state; Garmin PKCE puts code_verifier INSIDE the signed state so the callback is stateless). Push: Wahoo = multipart GPX to /v1/routes; Garmin = Training API course JSON — validate both payload contracts against live docs once real keys arrive (endpoints implemented from public docs, untested). OAuth return flags (?garmin=/?wahoo=) are stripped + status invalidated by useDeviceSyncOAuthReturn.
