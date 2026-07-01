// Sparki World — copy-seed for an EMPTY (freshly published) database.
//
// Publishing copies the database *schema* but not its *content*, so a newly
// deployed app starts with an empty Sparki World and honestly shows "nog geen
// renners". This module fills that gap WITHOUT any image generation: the world
// was already generated once in development and its images live in the shared
// object-storage bucket (the same bucket is used by dev and the deployment).
// We only copy the database rows here — every `object_path` keeps pointing at an
// image that already exists, so no new (paid) media is ever created.
//
// The export (artifacts/api-server/src/scripts/data/world-seed.json) is a plain
// dump of the fictional-world tables. Real-user rows are intentionally excluded:
// follows and affinity are per-user, and only virtual-actor interactions are
// carried (real-user interactions would reference users that do not exist in a
// fresh database).
//
// Idempotent & concurrency-safe: an advisory lock serialises concurrent boots,
// the seed only runs when the world is empty, and every insert is
// ON CONFLICT DO NOTHING so a re-run can never duplicate or clobber.

import { pool } from "@workspace/db";
import seed from "../scripts/data/world-seed.json";

type Row = Record<string, unknown>;
type SeedFile = { exportedAt: string; tables: Record<string, Row[]> };

const DATA = seed as unknown as SeedFile;

// Insert order respects foreign keys: media → athletes (avatar) → events →
// career → relationships → posts (athlete/event/media) → interactions (post).
const TABLE_ORDER = [
  "virtual_media",
  "virtual_athletes",
  "virtual_events",
  "virtual_career_entries",
  "virtual_athlete_relationships",
  "virtual_posts",
  "virtual_interactions",
] as const;

// Columns that are jsonb in the schema — they must be re-serialised and cast so
// objects/arrays land as real jsonb, not as a broken string or pg-array.
const JSONB_COLUMNS: Record<string, Set<string>> = {
  virtual_media: new Set(["attributes"]),
  virtual_athletes: new Set(["traits"]),
  virtual_events: new Set(["payload"]),
  virtual_posts: new Set(["poll_options"]),
};

// A fixed lock id so two instances can't seed at the same time.
const ADVISORY_LOCK_ID = 918273645;

// Structural type satisfied by both a Pool and a pooled Client — avoids taking a
// direct dependency on pg's types just to annotate the connection.
interface Queryable {
  query: (
    text: string,
    values?: unknown[],
  ) => Promise<{ rowCount: number | null }>;
}

async function insertRows(
  client: Queryable,
  table: string,
  rows: Row[],
): Promise<number> {
  if (!rows.length) return 0;
  const jsonbCols = JSONB_COLUMNS[table] ?? new Set<string>();
  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(", ");
  const placeholders = cols
    .map((c, i) => (jsonbCols.has(c) ? `$${i + 1}::jsonb` : `$${i + 1}`))
    .join(", ");
  const sql = `INSERT INTO ${table} (${colList}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`;

  let inserted = 0;
  for (const row of rows) {
    const values = cols.map((c) => {
      const v = row[c];
      if (v !== null && v !== undefined && jsonbCols.has(c)) {
        return JSON.stringify(v);
      }
      return v ?? null;
    });
    const res = await client.query(sql, values);
    inserted += res.rowCount ?? 0;
  }
  return inserted;
}

export type WorldSeedResult =
  | { seeded: false; reason: string }
  | { seeded: true; inserted: Record<string, number>; total: number };

/**
 * Fill an empty Sparki World from the bundled dev export. Safe to call on every
 * boot: it no-ops the moment the world already has athletes (unless `force`).
 */
export async function ensureWorldSeed(opts?: {
  force?: boolean;
  log?: (msg: string) => void;
}): Promise<WorldSeedResult> {
  const log = opts?.log ?? (() => {});
  const force = opts?.force ?? false;

  // Cheap pre-check outside the lock — the common case (already populated) pays
  // only one count query per boot.
  const pre = await pool.query<{ c: number }>(
    "SELECT count(*)::int AS c FROM virtual_athletes",
  );
  if ((pre.rows[0]?.c ?? 0) > 0 && !force) {
    return { seeded: false, reason: "world already populated" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [ADVISORY_LOCK_ID]);

    // Re-check inside the lock so a racing instance that already seeded wins.
    const inside = await client.query<{ c: number }>(
      "SELECT count(*)::int AS c FROM virtual_athletes",
    );
    if ((inside.rows[0]?.c ?? 0) > 0 && !force) {
      await client.query("ROLLBACK");
      return { seeded: false, reason: "world already populated" };
    }

    const inserted: Record<string, number> = {};
    let total = 0;
    for (const table of TABLE_ORDER) {
      const rows = DATA.tables[table] ?? [];
      const n = await insertRows(client, table, rows);
      inserted[table] = n;
      total += n;
      log(`${table}: +${n} rijen`);
    }

    // Keep the serial sequences ahead of the copied ids so the nightly world
    // simulation can keep appending without primary-key collisions.
    for (const table of TABLE_ORDER) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence('${table}', 'id'), (SELECT COALESCE(MAX(id), 1) FROM ${table}))`,
      );
    }

    await client.query("COMMIT");
    log(`Sparki World gevuld: ${total} rijen gekopieerd.`);
    return { seeded: true, inserted, total };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
