---
name: Sparki Sportpaspoort (Golf 20)
description: Traceable profile layer on top of athlete_profiles — provenance events, confirmation proposals, atomic write+event, composed export.
---

# Sportpaspoort

- athlete_profiles stays the SSOT; the passport adds only provenance (`passport_value_events`), proposals (`passport_proposals`) and composed views. No parallel value store.
- **Atomic write+event is the core invariant**: every tracked value change and its event go in ONE db.transaction (`applyValueChange` + `recordValueEvent(input, tx)` with a `PassportDbx` executor param). Best-effort `.catch` on event inserts violates "never silent overwrites" — architect flagged it; don't reintroduce.
- **Why:** a DB failure between value write and event insert would leave an untraceable change, breaking the honesty guarantee.
- `decideProposal` must flip status (only WHERE status='open', race-safe) AND apply the value in the same transaction — otherwise "decided but not applied" states appear.
- Zone-affecting automatic changes (non-estimated FTP from the floor engine, etc.) become proposals, never direct writes; the ESTIMATED FTP auto-raise remains allowed but records a `berekend` event. Accepting a `berekend` FTP proposal keeps `ftpEstimated=true`.
- Numeric equality when composing: numeric columns render "71.50" vs event "71.5" — compare via Number() (sameValue helper), not string equality.
- Export composer: gezondheid/locatie/notities default OFF; empty selection = 400. Club has no passport access; only self + accepted coach (proposals only).
- Ontwikkelingsweergave reliability gate: ≥2 FTP points OR ≥5 weights OR ≥8 sessions, otherwise honest "onvoldoende meetpunten".
