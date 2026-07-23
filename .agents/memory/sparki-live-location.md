---
name: Sparki live locatie delen (Opdracht 4)
description: Opt-in live location sharing during navigation — authz, staleness, no-history rules
---
- Sharing is opt-in per session, default OFF; no readable endpoint without an active session + valid grant.
- **Rule:** authorization must be re-checked at EVERY read, not just grant existence — friendship revoked or group participation ended ⇒ position gone immediately. **Why:** grants created at start go stale; architect flagged the minor group branch missing the read-time friend/guardian re-check (privacy hole). **How to apply:** any read path over live_location_grants must re-derive the relationship live, incl. the minor/unknown-age fail-closed filter.
- **Rule:** idle-expiry anchors on the LAST POSITION timestamp, not session startedAt — otherwise active sharers get 409 after 30 min on long rides. Pass lastPositionAt into sessionIsLive on the position-write path too.
- No location history: exactly one position row per session (upsert on sessionId), deleted when the session ends.
- Honest staleness ladder: Live ≤20s → "x geleden" → ≥5 min coords nulled → ≥15 min dropped entirely; viewer client re-ages locally when its own polls go stale.
- Adaptive send interval needs REAL device inputs (AppState for screen, expo-battery for battery) — hardcoding screenOn:true silently defeats the requirement; offline ⇒ send nothing, buffer nothing.
- Minor/unknown age sharing in a group is fail-closed to accepted friends ∪ guardians at start AND at read.
