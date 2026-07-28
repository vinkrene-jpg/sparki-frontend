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
