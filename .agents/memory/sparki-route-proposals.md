---
name: Sparki routevoorstellen & nav-instellingen
description: Route proposals between friends + persistent nav settings; key traps.
---

- Proposals router mounted under /api/routes BEFORE the main routes router, or GET /voorstellen is swallowed by GET /:id (400 "Ongeldige id"). After changing api-server routes, RESTART the dev workflow — `pnpm build` alone leaves the old bundle running.
- Accept path must be one DB transaction (status flip open→geaccepteerd + route copy together); notification is post-commit best-effort. **Why:** a 500 mid-way otherwise leaves "geaccepteerd" without a copied route.
- Nav-settings defaults trap: RoutePanel always passes a non-null rideOptions fallback (`chosenRideOptions ?? loadLastRideOptions()`), so gating defaults on `rideOptions == null` never fires. Use an explicit `rideOptionsExplicit` prop (true only when the start menu was actually used).
- Adjust ("aanpassen") always creates a NEW route for the receiver (real regenerated loop via ORS, or honest 503 when unconfigured; plain duplicate when no new distance asked) — original stays untouched.
