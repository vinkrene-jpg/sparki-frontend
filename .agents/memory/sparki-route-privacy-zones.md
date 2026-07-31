---
name: Sparki privacyzones routebibliotheek
description: User-managed privacy zones masking every shared route/ride view; suggest-exclude ownership rule.
---

- Location privacy stays a READ-TIME transform with a LIST of zones (owner's profile home is always an implicit zone on top of user-managed ones). Never persist a "safe" copy, and never send home coordinates over the wire — the management UI only gets a boolean "home is protected".
- **Why:** a home-only zone couldn't cover work/other sensitive places; multi-zone keeps the fail-closed contract (zones requested but none known ⇒ trim start/end anyway).
- Dropping in-zone points is NOT masking: the map draws a straight connector through the circle. Keep only the longest contiguous run whose points AND connecting segments stay outside every zone; tests must assert segment-circle distance, not just vertices.
- **How to apply:** "every shared or shown view" means EVERY viewer path — route library AND the World Social ride-track view (a first pass missed the latter and review rejected it). Any new surface serving another user's geometry must go through the shared zone-loading helper + transform, and zone masking is NON-optional for viewers: owner share settings may relax trimming/simplify, never the zones themselves.
- Owner rule: the athlete decides which routes Sparki may use for suggestions (suggest-exclude flag). Every engine that picks the athlete's own saved routes as proposals must honor it — the flag predates its first consumer (built concurrently), so verify consumers actually filter.
- Dev-bypass tests: a wrong auth-bypass header name silently resolves every request to the same fallback user, inverting cross-account assertions — copy the header from an existing passing contract test, never from memory.
