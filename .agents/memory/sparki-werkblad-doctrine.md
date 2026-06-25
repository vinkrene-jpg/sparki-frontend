---
name: Sparki intelligent-werkblad migration
description: How "every screen is an intelligent werkblad, never a blank form" was applied wave-by-wave, and the honest connector-supply gating rule.
---

# Intelligent werkblad doctrine — applied across flagged surfaces

Doctrine (codified in replit.md): gather → combine → analyse → propose; the user only
confirms/fills GENUINE gaps. Never re-ask data that already exists or is derivable.

Waves migrated: Races (flagship), Routes, Voeding context, Prep-checklist auto-check,
Train logging confirm-card, Settings connector-supply gating.

## Confirm-not-ask pattern (Train logging)
A connector-imported session that lacks only the SUBJECTIVE gap (feel) renders a confirm
card showing objective facts read-only, asking only feel (+note). Never a blank form.
The backend mutation for the gap must be narrow: ownership-checked + only the gap fields
(feel/notes), never the imported objective fields.

## Honest connector-supply gating (Settings) — the durable rule
A manual metric input is replaced by "Sparki haalt dit op uit <connector>" ONLY when a
CONNECTED connector's `importedDataTypes` actually contains the token (realized via real
sync) — NOT the aspirational `provides` list. Helper: `connectorSupplying(connectors, token)`
(`status === "connected"` AND token in `importedDataTypes`).

**Why:** `provides` is what a platform *could* deliver; only `importedDataTypes` proves a
real sync delivered it. Claiming "supplied" off `provides` would fabricate. Also:
`athlete_daily_metrics` has NO per-record source column, so honesty is only possible at
the capability level (which connector supplies this type), not per stored value.

**How to apply:** Subjective metrics (feel/sleep/fatigue) are never connector-supplied —
always manual. For connector-suppliable metrics (weight, hrv, resting_hr, sleep), gate the
hide on realized supply and ALWAYS keep a manual-override affordance ("Handmatig corrigeren")
so it is never a dead-end.
