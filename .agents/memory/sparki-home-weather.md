---
name: Sparki home weather (everyday surfaces)
description: How real Open-Meteo weather feeds Sparki's non-race Home/coach/daily-advice, and the cross-module heat-threshold alignment trap.
---

# Sparki home weather on everyday (non-race) surfaces

Real Open-Meteo weather for the athlete's saved **home location** (real `homeLat`/`homeLon` on `athlete_profiles`, no geocoding) drives everyday coaching: a `/api/weather/home` endpoint, the observation/coach engine, the daily-advice engine, and the Home "Het weer vandaag" card. Reuses the existing `lib/weather` helpers (`open-meteo`, `assess`). Honest reasons: `no_home` / `no_forecast` / `ok`; never fabricates.

## The alignment trap (the durable lesson)

Two independent code paths decide whether weather matters, and they MUST agree:

1. **daily-advice engine** downgrades an outdoor tempo/intervals session → endurance when `advisory.severity === "severe"` OR `today.apparentMaxC >= 30` (heat), regardless of session duration.
2. **`assess.ts` `assessTraining`** only emits a heat **caution** when `feelMax >= 30` **AND** `isLongish` (estDurationMin ≥ 120 or trainingType "duur"). Heat does NOT fire for shorter sessions.

The home advisory is computed by calling `assessTraining` with a single **representative** intensive outdoor session (`INTENSIVE_OUTDOOR` in `lib/weather/home.ts`). If that representative session is < 120 min, the home advisory stays "ok" at e.g. 40°C feels-like while the daily-advice card simultaneously downgrades the session for heat — a visible, incoherent split for the user (weather card silent, "Wat nu" says "eased for heat").

**Fix / rule:** the representative session's `estDurationMin` must be ≥ 120 so `isLongish` is true and the advisory's heat/cold reads stay consistent with the daily-advice engine's thresholds. A representative *intensive* ride from home (warm-up + quality blocks + cool-down) is realistically ~2h, so this is honest, not gamed.

**Why:** the everyday weather card and the session-downgrade reason are two surfaces of the same judgment; if their thresholds diverge the user sees the conditions flagged in one place and ignored in the other.

**How to apply:** any time you change `assess.ts` heat/cold gating, or the representative session in `home.ts`, or the daily-advice heat threshold, re-check that all three agree at the 30°C / severe boundary.

## Other notes

- The Home weather card lives in the **"full" (volledige analyse) drill-in surface** of Vandaag (`general-day-home.tsx`), not the calm State Card surface. Deep-links force the state surface, so the card is reached via "Bekijk de volledige analyse".
- Card suppresses `severity === "ok"` advisories (shows raw conditions only) — never prints a false "all clear".
- `no_home` empty state routes to the set-home-location flow (`homeLocation` target in `lib/missing-input.ts`); `/train` has no `?focus` auto-scroll for it (acceptable; existing tip guides the user).
