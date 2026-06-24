---
name: Sparki wedstrijdkalender-import
description: How external race-calendar import works and which sources are/aren't feasible.
---

# Sparki external race-calendar import (/races → "Uit kalender")

Lets athletes prefill the race form from public calendars instead of manual entry.
Backend engine: `artifacts/api-server/src/lib/calendar/` + `routes/calendar.ts`.
Frontend: `hooks/use-calendar.ts`, `components/sparki/import-from-calendar.tsx`.

## Source feasibility (verified by probing the live sites)
- **Fietssport** (fietssport.nl/toertochten) — fully server-rendered. List cards
  carry name/location/type/distance but only a relative day label, so the exact
  date is resolved on select from the detail page `<title>` (`/event` endpoint).
  `needsDateLookup: true`.
- **We-Tri** (we-tri.nl/competition) — server-rendered table; exact dates inline.
- **KNWU** — only the ~5 "Komende wedstrijden" on `www.knwu.nl/kalender` are
  server-rendered. The full calendar AND a member's personal inschrijvingen live
  in the `mijn.knwu.nl` SPA, which returns the same ~6.8KB empty shell for every
  path with NO reachable data API or login endpoint. A real KNWU full-calendar
  or password-login integration is therefore NOT buildable; it is marked
  `status: "limited"` with a plain-Dutch note and never faked.

**Why:** the no-mock / honest-failure rule forbids inventing the unreachable KNWU
data; storing a password for a login that can't be made to work was also rejected.
**How to apply:** if asked to "finish" KNWU, the blocker is the SPA having no
public/authable API — re-verify before promising it; don't fabricate events.

## Parser conventions
- No HTML parser dependency — defensive regex on stable markup; parsers return
  [] (honest empty) when markup changes rather than guessing.
- SSRF guard: `lib/calendar/html.ts` `isAllowedUrl` allow-lists only the three
  source hosts; `/event` validates the url before fetching.
- 30-min in-memory cache per source; Node 24 global fetch with AbortController timeout.
