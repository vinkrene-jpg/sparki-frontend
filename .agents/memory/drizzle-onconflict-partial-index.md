---
name: Drizzle onConflict with a partial unique index
description: onConflictDoNothing emits the arbiter predicate from `where`, NOT `targetWhere` (that key only works on onConflictDoUpdate).
---

When upserting against a **partial** unique index (e.g. `UNIQUE (clerk_id, dedupe_key) WHERE dedupe_key IS NOT NULL`), Postgres requires the ON CONFLICT clause to carry the same predicate, or it errors with:
`there is no unique or exclusion constraint matching the ON CONFLICT specification`.

The trap: drizzle-orm uses **different config keys** for the two conflict actions:
- `onConflictDoUpdate({ target, set, targetWhere })` — predicate key is `targetWhere`.
- `onConflictDoNothing({ target, where })` — predicate key is `where` (NOT `targetWhere`).

Passing `targetWhere` to `onConflictDoNothing` compiles fine and runs without error, but drizzle silently drops it — the emitted SQL has `ON CONFLICT (cols) DO NOTHING` with no WHERE, so every insert fails the arbiter match and **nothing persists** (no exception is thrown by `onConflictDoNothing`, so it fails invisibly).

**Why:** the bug surfaced as "inserts report success but the table stays empty" — verified by reading the bundled drizzle source: `onConflictDoNothing` builds `sql\`(${target})${whereSql} do nothing\`` from `config.where`, while `onConflictDoUpdate` reads `config.targetWhere`.

**How to apply:** for a partial-index DO NOTHING, write
`.onConflictDoNothing({ target: [t.clerkId, t.dedupeKey], where: sql\`${t.dedupeKey} IS NOT NULL\` })`.
Always confirm persistence with a real DB count after the first run, not just the absence of an error.
