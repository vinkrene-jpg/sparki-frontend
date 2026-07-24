---
name: Sparki entitlement-fundament
description: Commercial rights layer (legacy_unrestricted vs subscription) separated from operational feature flags; fail-closed semantics.
---

# Entitlement-fundament

- Two layers, ANDed: commercial entitlement (mode/variant/personal grants) AND operational flag AND role AND kill-switch. Flags never grant commercial access; grants never bypass flags.
- `legacy_unrestricted` (default for all existing + new users until sales start) = commercially unrestricted; behavior identical to pre-entitlement app.
- **Error semantics (product decision):** subscription/unknown mode/unknown user = fail-closed (degraded reads yield zero grants ⇒ deny). Legacy is the deliberate carve-out: read errors in entitlement tables never revoke legacy access, because legacy access doesn't depend on them — errors may never unlock EXTRA, only protect existing access.
- Unknown/corrupt `entitlement_mode` or `product_variant` values resolve to subscription/null ⇒ deny.
- `variant_feature_grants` ships EMPTY on purpose — filling it is the sales-start switch.
- Testing the admin 403 production path in dev: `isAdmin` reads `DEV_AUTH_BYPASS` per call while dev-auth middleware is mounted from cached IS_DEV — flip the env var per request in the test, restore in finally.

**How to apply:** wire feature gates through `resolveFeatureAccess` (api-server lib/entitlements); never re-implement the AND logic inline.
