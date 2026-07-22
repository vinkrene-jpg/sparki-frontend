---
name: Sparki fueling engine (Opdracht 17)
description: Deterministic nutrition/hydration richtwaarden engine + consent-gated preferences + in-ride logging
---

- Deterministic core `computeSessionFuelTargets` (api-server lib/fueling.ts) is the SSOT for richtwaarden; the LLM fueling-plan prompt gets a "BEREKENDE RICHTWAARDEN (leidend)" block so prose can never contradict the numbers.
- **Why:** honest-numbers rule — LLM may phrase, never compute. Youth (<16) path returns NO gram/ml/mg numbers (RED-S), only habit advice; coach instructions are injected verbatim and always first.
- Preferences (`nutrition_preferences`) are consent-gated fail-closed: `consentAt` null ⇒ never used in advice; PUT with consent=false nulls consentAt.
- Mobile in-ride bidon/eetmoment counters: snapshot BOTH counts and the ride's local date at STOP, not at save — saving after midnight otherwise logs on the wrong day.
- `compareFuelPlanToLogs` gives per-hour verdicts only when logs exist; zero logs ⇒ honest "geen inname geregistreerd", never a judgment.
