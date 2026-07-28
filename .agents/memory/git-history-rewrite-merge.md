---
name: Git history-rewrite merge reconciliation
description: What to do when a task force-pushes a rewritten (lighter) remote history that misses recent local work
---

Rule: after a history-rewrite task force-pushes GitHub, local main and origin/main share NO history — a normal push is rejected and the rewritten remote tip may be based on an OLDER content snapshot (recent features missing on the remote).

**Why:** the cleanup task branched earlier; its filter-repo result became the new remote root, dropping later merges' content at the tip. Blindly resetting hard to origin/main would delete working recent features.

**How to apply:**
1. Working tree = source of truth (it runs and is tested). Make a safety branch first.
2. `git reset --mixed origin/main` (keeps working tree, index becomes remote tip), extend .gitignore for heavy artifacts (`*.zip.part*` etc. — `*.zip` does NOT match `.zip.partNN`), then `git add -A` + one commit + push via gitPush.
3. Verify remote afterwards with `git ls-tree origin/main -- <recent file>`.
Also: such a merge breaks the frozen lockfile and can append stale file fragments (root tsconfig.json got Next.js junk appended) — check esbuild/vite "Expected end of file in JSON" errors against root configs, and post-merge install should fall back to `--no-frozen-lockfile`.
