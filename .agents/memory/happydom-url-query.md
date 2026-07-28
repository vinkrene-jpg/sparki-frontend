---
name: happy-dom URL query params in node-page tests
description: How to make window.location.search work in the sparki node:test + happy-dom page tests
---

Rule: in the node-page tests, `window.history.pushState({}, "", "/x?y=1")` does NOT update `window.location.search` (it stays empty). Pages that read `new URLSearchParams(window.location.search)` see nothing.

**Why:** discovered while testing the race-wizard `?step=1` deep-link — the wizard never opened because search was empty despite pushState.

**How to apply:** bake the query into registration: `GlobalRegistrator.register({ url: "http://localhost/page?param=1" })` at the top of the test file, before any imports of the page.
