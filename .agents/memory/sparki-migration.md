---
name: Sparki migration pattern
description: Notes on migrating flat Next.js apps where fullstack_copy_frontend.sh fails to auto-detect CLIENT_DIR
---

When `fullstack_detect.sh` reports an empty `CLIENT_DIR` (flat monorepo with no `apps/` subdirectory), `fullstack_copy_frontend.sh` will fail with "Could not find client directory." Write source files directly to the artifact instead.

**Why:** The copy script expects a recognizable monorepo layout. v0 exports that put everything at root level don't match its heuristics.

**How to apply:** Read all source files from `.migration-backup/` manually and write them to `artifacts/<slug>/src/` using the write tool. This is more reliable for flat v0 exports.
