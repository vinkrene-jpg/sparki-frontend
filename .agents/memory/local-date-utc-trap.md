---
name: Local-date UTC off-by-one trap
description: Why toISOString().slice(0,10) produces wrong calendar dates for NL users, and what to use instead.
---

# Local date serialization (YYYY-MM-DD)

`new Date(...).toISOString().slice(0, 10)` returns the **UTC** calendar date. In
the Netherlands (UTC+1/+2) local midnight maps to the *previous* UTC day, so this
silently produces off-by-one dates for any user-facing or stored calendar day
(e.g. a race day, a default start date, a day-tab label one day too early).

**Rule:** when you need a local `YYYY-MM-DD`, build it from local getters:

```ts
function toLocalIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
```

**Why:** Sparki's audience is Dutch; calendar correctness (race days, schedules) is
user-visible and was caught in code review on the Wedstrijd-room page.

**How to apply:** never `toISOString().slice(0,10)` for a *local* calendar day.
`toISOString()` is still fine for true UTC timestamps. Parsing a stored
`YYYY-MM-DD` back as local should use `new Date(`${iso}T00:00:00`)` (local midnight).
