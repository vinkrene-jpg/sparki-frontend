---
name: Shell pipe exitcode-trap in poortketens
description: Waarom `cmd | tail` in een &&-keten een rode check laat doorglippen
---
De exitstatus van een pipeline is die van het LAATSTE commando. `pnpm run typecheck 2>&1 | tail -1 && git commit …` commit dus ook bij een rode typecheck (tail geeft 0).

**Why:** Op 02-08-2026 is zo bijna een commit met TS-fout gepusht; alleen de zichtbare regel "Exit status 2" verraadde het.

**How to apply:** In poortketens nooit een check pipen vóór `&&`. Draai de check kaal (of gebruik `set -o pipefail`), en pas daarna committen/pushen.
