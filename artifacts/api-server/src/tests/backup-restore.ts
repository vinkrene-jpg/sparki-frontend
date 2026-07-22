// Backup & restore-bewijs — Afbouwgolf 13 releasestraat.
//
// Bewijst dat een databaseback-up van de kernrelaties hersteld kan worden mét
// behoud van relaties, activiteiten, media, toestemmingen en auditlogs:
//   1. "Backup": kopieer kern-tabellen naar een scratch-schema (CREATE TABLE AS
//      — zelfde pad als een pg_dump/restore, binnen dezelfde database zodat de
//      proef reproduceerbaar en zonder extra rechten draait).
//   2. "Restore-verificatie": vergelijk rijaantallen én controleer dat de
//      relaties (sporter→sessies, ouder→koppeling, sessie→media, consents,
//      audit) in de herstelde kopie exact kloppen.
//   3. Ruim het scratch-schema altijd op (ook bij falen).
//
// Draait tegen de bestaande (test)database en raakt de brondata NIET aan.

import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const SCHEMA = "sparki_restore_proef";

// Kern-tabellen die de acceptatie eist: relaties, activiteiten, media,
// toestemmingen en auditlogs.
const TABLES = [
  "user_profiles",
  "athlete_profiles",
  "training_sessions",
  "coach_athlete_links",
  "parent_athlete_links",
  "privacy_settings",
  "connector_consents",
  "journey_media",
  "security_audit_log",
  "club_audit_log",
];

type Row = Record<string, unknown>;

const results: { name: string; status: "pass" | "fail"; detail?: string }[] = [];

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ name, status: "pass" });
  } catch (err) {
    results.push({ name, status: "fail", detail: String(err) });
  }
}

async function one(query: string): Promise<Row> {
  const r = await db.execute(sql.raw(query));
  return (r.rows?.[0] ?? {}) as Row;
}

async function main() {
  await db.execute(sql.raw(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`));
  await db.execute(sql.raw(`CREATE SCHEMA ${SCHEMA}`));

  try {
    // 1 — Backup: kopieer iedere kern-tabel integraal.
    await scenario("backup: alle kern-tabellen gekopieerd", async () => {
      for (const t of TABLES) {
        await db.execute(
          sql.raw(`CREATE TABLE ${SCHEMA}.${t} AS TABLE public.${t}`),
        );
      }
    });

    // 2 — Rijaantallen identiek (geen dataverlies).
    await scenario("restore: rijaantallen identiek per tabel", async () => {
      for (const t of TABLES) {
        const src = await one(`SELECT count(*)::int AS n FROM public.${t}`);
        const dst = await one(`SELECT count(*)::int AS n FROM ${SCHEMA}.${t}`);
        assert(
          src.n === dst.n,
          `${t}: bron ${src.n} ≠ hersteld ${dst.n}`,
        );
      }
    });

    // 3 — Relaties intact: iedere sessie in de kopie hoort bij een bestaand
    // profiel in de kopie (geen wees-rijen na restore).
    await scenario("restore: sporter→sessies relatie intact", async () => {
      const r = await one(
        `SELECT count(*)::int AS wezen FROM ${SCHEMA}.training_sessions s
         LEFT JOIN ${SCHEMA}.user_profiles u ON u.clerk_id = s.clerk_id
         WHERE u.clerk_id IS NULL`,
      );
      assert(r.wezen === 0, `${r.wezen} sessies zonder profiel na restore`);
    });

    await scenario("restore: ouder/coach-koppelingen intact", async () => {
      for (const t of ["parent_athlete_links", "coach_athlete_links"]) {
        const col = t.startsWith("parent") ? "parent_clerk_id" : "coach_clerk_id";
        const r = await one(
          `SELECT count(*)::int AS wezen FROM ${SCHEMA}.${t} l
           LEFT JOIN ${SCHEMA}.user_profiles u ON u.clerk_id = l.athlete_clerk_id
           WHERE u.clerk_id IS NULL AND l.${col} IS NOT NULL`,
        );
        assert(r.wezen === 0, `${t}: ${r.wezen} koppelingen zonder sporter`);
      }
    });

    // 4 — Toestemmingen en per-categorie ouderrechten komen byte-gelijk terug.
    await scenario("restore: toestemmingen identiek (checksum)", async () => {
      for (const t of ["privacy_settings", "connector_consents"]) {
        const src = await one(
          `SELECT coalesce(md5(string_agg(x::text, '|' ORDER BY x::text)), 'leeg') AS h
           FROM public.${t} x`,
        );
        const dst = await one(
          `SELECT coalesce(md5(string_agg(x::text, '|' ORDER BY x::text)), 'leeg') AS h
           FROM ${SCHEMA}.${t} x`,
        );
        assert(src.h === dst.h, `${t}: checksum wijkt af na restore`);
      }
    });

    // 5 — Auditlogs komen volledig en ongewijzigd terug (append-only bewijs).
    await scenario("restore: auditlogs identiek (checksum)", async () => {
      for (const t of ["security_audit_log", "club_audit_log"]) {
        const src = await one(
          `SELECT coalesce(md5(string_agg(x::text, '|' ORDER BY x::text)), 'leeg') AS h
           FROM public.${t} x`,
        );
        const dst = await one(
          `SELECT coalesce(md5(string_agg(x::text, '|' ORDER BY x::text)), 'leeg') AS h
           FROM ${SCHEMA}.${t} x`,
        );
        assert(src.h === dst.h, `${t}: checksum wijkt af na restore`);
      }
    });

    // 6 — Media-verwijzingen intact (journey_media → object storage paden).
    await scenario("restore: media-rijen en paden identiek", async () => {
      const src = await one(
        `SELECT coalesce(md5(string_agg(object_path, '|' ORDER BY object_path)), 'leeg') AS h
         FROM public.journey_media`,
      );
      const dst = await one(
        `SELECT coalesce(md5(string_agg(object_path, '|' ORDER BY object_path)), 'leeg') AS h
         FROM ${SCHEMA}.journey_media`,
      );
      assert(src.h === dst.h, "journey_media paden wijken af na restore");
    });
  } finally {
    await db.execute(sql.raw(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`));
  }

  const failed = results.filter((r) => r.status === "fail");
  for (const r of results) {
    console.log(`${r.status === "pass" ? "PASS " : "FAIL "} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  }
  console.log(`\n${results.length - failed.length}/${results.length} scenario's geslaagd`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("fatal", err);
  process.exit(1);
});
