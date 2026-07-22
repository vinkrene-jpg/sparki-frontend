---
name: Sparki World sociale omgeving
description: Golf 18 — reference-only shares, visibility tiers, minors fail-closed, route-privacytransform op leesmoment.
---

- Shares are reference-only (world_shared_items points at source rows); source delete must call removeWorldRefsForSource AND the feed self-heals at read time — never copy data into the share.
- Openbaar delen: requires explicit confirmPublic AND adult (18+ from birthDate) OR parentConsentStatus="granted"; unknown age fail-closed 403. Test-seeding consent must UPSERT privacy_settings (row may not exist — plain update silently no-ops).
- Route privacy is a READ-TIME transform (trim 500m ends, 750m home zone, simplify, null when too little left; owner gets original) — never persist a "safe" copy.
- Duplicate waardering returns 200 (idempotent no-op), not 201 — tests must accept both.
- Blocks are bilateral in both feed filtering and visibility checks; report auto-signal ("sparki-signaal") flags but never hides/deletes.
