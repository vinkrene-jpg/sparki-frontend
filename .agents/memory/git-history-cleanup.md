---
name: Git history cleanup (filter-repo + LFS)
description: How to strip large binary blobs from git history and clean up LFS objects to reduce .git size for deploys
---

## The rule
Use `git filter-repo --path <file> ... --invert-paths --force` to strip specific paths from ALL history. Then delete orphaned LFS objects manually, run `git gc --aggressive --prune=now`, and force-push.

**Why:** Large zips/bundles committed to git (even once) stay in `.git/objects` or `.git/lfs/objects` forever, making the deploy image balloon past the 8 GiB limit. filter-repo is the only reliable tool; `git filter-branch` is too slow and leaves reflog cruft.

**How to apply:**

1. `pip install git-filter-repo`
2. Save on-disk copies of files that must survive to `/tmp/` before running filter-repo
3. Run: `git filter-repo --path <blob1> --path <blob2> ... --invert-paths --force`
   - filter-repo **removes the `origin` remote** — re-add it afterwards: `git remote add origin <url>`
4. Restore saved files from `/tmp/`, re-add them to git (`git add`)
5. Commit
6. Fix tracking branch before force-push: `git branch --set-upstream-to=origin/main main`
   - Otherwise gitPush callback errors with "current branch already tracks origin/history-cleanup-temp; cannot publish main"
7. Force-push via Replit gitPush callback: `gitPush({ branch: "main", force: true })`
8. Delete orphaned LFS objects: `find .git/lfs/objects -type f -delete`
9. Compact: `git gc --aggressive --prune=now`

**Gotchas:**
- LFS objects in `.git/lfs/objects` are NOT removed by filter-repo — they must be deleted manually after history rewrite
- After filter-repo, all local LFS objects become orphaned if their pointer commits were removed; safe to delete all of them
- If converting a file from LFS to a regular blob: `git lfs untrack '<pattern>'`, then `git rm --cached <file>`, then `git add <file>`
- A stale temp branch may remain on GitHub if branch deletion via direct `git push origin --delete` fails (credentials); delete via GitHub UI or API

**Result achieved:** .git reduced from 4.9 GB → 733 MB by stripping ~2.3 GB of LFS objects + rewriting history to exclude large blobs.

## Early-warning guard
A health check (`project_disk_size`, lib/health/disk-usage.ts) now measures `.git` + werkmap with `du` in the nightly health run. Env-managed dirs (node_modules, .cache, .config, .upm, .local) are excluded from the alarm total or it false-alarms forever; thresholds .git>1,5 GB / totaal>6 GiB orange, >7,25 GiB red.

## Recurrence trap: unpushed commits pin LFS objects
`git lfs prune` retains objects referenced by UNPUSHED commits — if an intermediate unpushed commit accidentally re-added big export files (even though HEAD no longer has them), their LFS objects stay pinned. Fix: `git filter-repo --path exports --invert-paths --refs origin/main..main --force` to strip only the unpushed segment (fast, keeps origin/main ancestry so no force-push needed), then set `lfs.fetchrecentrefsdays/fetchrecentcommitsdays/pruneoffsetdays` to 0 and `git lfs prune` again. Also: background `nohup git gc` dies at tool-call boundaries — run gc foreground (plain `--prune=now` is fast enough; aggressive not needed).

## Local-side cleanup (after remote rewrite)
- Local .git stays huge until backup refs are gone: delete `backup-pre-lighthistory`, `gitsafe-backup/main`, ALL stale `subrepl-*` branches+remotes, and the `replit-agent` branch (it pinned the heavy audit-export commit). Only after verifying `origin/main == main`.
- Then `git reflog expire --expire=now --all` + `git gc --prune=now --aggressive` → 5.1 GB → 493 MB.
- Trap: root `postcss.config.mjs` referencing `@tailwindcss/postcss` (Next.js leftover, restored by the reconciliation commit) breaks BOTH Vite apps — they use `@tailwindcss/vite` and Vite climbs to the root config. Keep root postcss plugins `{}`.

## Herhaling 2026-07-29
- .git groeide opnieuw naar 7,2 GB: 2,3 GB verweesde LFS-objecten + 2,0 GB `.git/lost-found` (achtergelaten door eerdere gc) + tientallen `subrepl-*`/backup-branches die alles pinden.
- Vaste kuur (main==origin/main eerst verifiëren!): branches -D, extra remotes weg, `rm -rf .git/lost-found`, LFS-objects delete, reflog expire, `git gc --prune=now` → 519 MB.
- **Nu geautomatiseerd**: `api-server/src/lib/git-maintenance.ts` draait deze kuur dagelijks (in-process planner via index.ts, óók in dev; plus in job:health). Fail-closed poort main==origin/main; no-op onder 1 GB .git; verwijdert alleen subrepl-*/backup-*/gitsafe-backup/*-refs + subrepl-remotes, nooit replit-agent/main/origin; LFS via `lfs prune` met retentie 0. Test: `test:git-maintenance` (via shell). Drempels project_disk_size verlaagd: .git>1,0 GB / totaal>5 GiB oranje.
