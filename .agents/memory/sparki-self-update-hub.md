---
name: Sparki surface ownership — Vandaag / Inzicht / Profiel
description: Which surface owns self-input vs insight vs identity, and the rules for relocating a panel between surfaces.
---

# Sparki surface ownership

**Rule:** each kind of content has one home.
- **Vandaag** owns athlete self-input (daily check-in, voeding/hydratatie,
  materiaalcoach). No self-input lives anywhere else.
- **Inzicht** owns insight + curiosity (the "Sparki ziet vandaag" open-loops and
  the honest observation). No self-input panels here.
- **Profiel** owns account identity (Founding Athlete, settings).

**Why:** the user wants one obvious place to update yourself and one place to be
made curious; inputs/insights scattered across pages produced confusing
cross-page jumps and felt unintelligent.

**How to apply:**
- The curiosity/insight engine (evidence-gated open-loops + honest observation,
  humour/cynisme via voice trust tiers) already exists — surface it on Inzicht,
  don't rebuild it.
- A panel that lives in only one of a surface's sub-views won't react to a
  deep-link targeting it unless that sub-view is forced first. Handle the
  deep-link at the surface dispatcher and switch sub-views before the panel's own
  scroll/open effect runs.
- When relocating a panel, move EVERY deep-link producer with it — frontend route
  maps AND backend producers (notification/nudge actionUrls) and their tests.
  Grep all producers after the move.
- Shared input/insight components take an optional section-number prop so the host
  page controls numbering.
