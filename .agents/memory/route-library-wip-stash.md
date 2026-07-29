---
name: Route-library/plan-wizard WIP in git stash
description: Unfinished route-library + plan-wizard work was moved out of a task commit into a git stash; recover it before working on the route-library migration task.
---

Unrelated WIP (route_library/route_library_comments schema, /api/routes/bibliotheek* endpoints, PlanWizard, plan-overview lib + tests, assets) sat uncommitted in the working tree and kept getting auto-swept into an unrelated task's completion commit, causing code-review rejections.

**Where it is now:** `git stash` entry "route-library/plan-wizard WIP + assets (los van taak 362; zie taak #363)". Recover with `git stash list` / `git stash pop` before doing the route-library migration work.

**Why:** completion review + auto-commit include the ENTIRE working tree, not just files you edited. Foreign WIP in the tree pollutes your task diff.

**How to apply:** before `markTaskComplete`, check `git status`; if unrelated changes exist, reset to a clean base, commit only your task's files, and stash the rest (untracked included, `-u`). Also: the stash may be stale vs later merges — rebase carefully when popping.
