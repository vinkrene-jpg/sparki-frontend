---
name: Open choices tracker convention
description: How to keep the user's "openstaande keuzes" surfaced in chat so decisions are never forgotten.
---

The user cannot keep track of the many points where I ask them to make a choice; across
a long stream of tasks these get buried and forgotten.

The rule (chosen by the user on 2026-06-28):

- A living list of unresolved choices lives in `.agents/open-choices.md` (NOT in MEMORY.md —
  it is a changing TODO-style list, not a durable lesson; it just needs a stable home).
- **At the START of every turn, read `.agents/open-choices.md` and, if it has any open items,
  begin the reply with a short "Openstaande keuzes" overview** (one numbered line each) so the
  user can answer with e.g. "3 = optie B". Keep it compact; skip the block when the list is empty.
- When I ask the user a new choice (user_query or a plain either/or question), **add it** to the
  list. When they decide, **remove it** (optionally move to the "Beslist" archive with the chosen
  option + date).

**Why:** the user explicitly asked for this so open decisions stop slipping through; they picked
the "in de chat" surfacing (not a canvas panel).

**How to apply:** treat the read-and-surface step as a standing pre-flight at the top of each turn,
like checking the task list. The backing file was seeded from a retroactive scan of the full
conversation transcript (parsed `tool_calls` user_query questions + the following user reply;
"drift" = reply that did not address the question).
