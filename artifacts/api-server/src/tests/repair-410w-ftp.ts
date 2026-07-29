// Test: repair-410w-ftp — idempotentie + volgorde met backfill.
//
// Verifies:
//   1. Eerste run prefixeert de 410W-FTP-rij correct en null de getroffen sessies.
//   2. Tweede run is een exacte no-op.
//   3. backfillTssForAthlete herleidt de genulled scores na de repair.
//   4. Rij van een andere clerkId wordt NIET aangeraakt.
//   5. repair410wFtp() is een no-op in dev (productie-clerkId ontbreekt).
//
// Run: `pnpm --filter @workspace/api-server run test:repair-410w-ftp`
// Requires: DATABASE_URL.

import {
  db,
  pool,
  trainingSessionsTable,
  athleteProfilesTable,
  userProfilesTable,
  ftpHistoryTable,
} from "@workspace/db";
import { eq, and, lt, isNotNull, sql } from "drizzle-orm";
import { repair410wFtp } from "../lib/repair-410w-ftp";
import { backfillTssForAthlete } from "../lib/derived-load-backfill";

type Status = "pass" | "fail";
const results: { scenario: string; status: Status; note?: string }[] = [];

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

async function scenario(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    results.push({ scenario: name, status: "pass" });
  } catch (err) {
    results.push({
      scenario: name,
      status: "fail",
      note: err instanceof Error ? err.message : String(err),
    });
  }
}

// Nep-clerkId voor de test-fixture — nooit de echte productie-clerkId.
const CLERK = "test-repair-410w-ftp-user";
const OTHER = "test-repair-410w-other-user";

// Herbruikbare repair-transactie die dezelfde logica als repair410wFtp uitvoert
// maar op een injecteerbare clerkId, zodat de test nooit productiedata raakt.
async function runRepairFor(clerkId: string): Promise<{ sessionsNulled: number; skipped: boolean }> {
  const [row] = await db
    .select({ notes: ftpHistoryTable.notes })
    .from(ftpHistoryTable)
    .where(
      and(
        eq(ftpHistoryTable.clerkId, clerkId),
        eq(ftpHistoryTable.measuredAt, "2026-05-25"),
        eq(ftpHistoryTable.ftpWatts, 410),
        eq(ftpHistoryTable.testType, "derived"),
      ),
    )
    .limit(1);

  if (!row || (row.notes ?? "").startsWith("[achterhaald]")) {
    return { sessionsNulled: 0, skipped: true };
  }

  let sessionsNulled = 0;
  await db.transaction(async (tx) => {
    await tx
      .update(ftpHistoryTable)
      .set({ notes: sql`'[achterhaald] ' || coalesce(${ftpHistoryTable.notes}, '')` })
      .where(
        and(
          eq(ftpHistoryTable.clerkId, clerkId),
          eq(ftpHistoryTable.measuredAt, "2026-05-25"),
          eq(ftpHistoryTable.ftpWatts, 410),
          eq(ftpHistoryTable.testType, "derived"),
          sql`coalesce(${ftpHistoryTable.notes}, '') NOT LIKE '[achterhaald]%'`,
        ),
      );

    const updated = await tx
      .update(trainingSessionsTable)
      .set({ tss: null, intensityFactor: null, updatedAt: new Date() })
      .where(
        and(
          eq(trainingSessionsTable.clerkId, clerkId),
          lt(trainingSessionsTable.sessionDate, "2026-06-26"),
          isNotNull(trainingSessionsTable.tss),
        ),
      )
      .returning({ id: trainingSessionsTable.id });

    sessionsNulled = updated.length;
  });

  return { sessionsNulled, skipped: false };
}

async function main() {
  // ── Setup ──────────────────────────────────────────────────────────────────
  try {
    for (const clerkId of [CLERK, OTHER]) {
      await db.insert(userProfilesTable).values({
        clerkId,
        email: `repair-410w-${clerkId}-${Date.now()}@example.invalid`,
      });
      await db.insert(athleteProfilesTable).values({
        clerkId,
        ftp: 272,
        ftpEstimated: false,
      });
      // FTP-rij met de foute markeringsconventie.
      await db.insert(ftpHistoryTable).values({
        clerkId,
        measuredAt: "2026-05-25",
        ftpWatts: 410,
        testType: "derived",
        notes: "ACHTERHAALD — niet gebruiken als actuele FTP. Historische afgeleide waarde.",
      });
      // Geldige FTP-rij (later).
      await db.insert(ftpHistoryTable).values({
        clerkId,
        measuredAt: "2026-06-26",
        ftpWatts: 272,
        testType: "strava",
        notes: "Geïmporteerd uit Strava",
      });
    }

    // Sessies voor CLERK (drie vóór cutoff met TSS, afgeleid met FTP 410).
    await db.insert(trainingSessionsTable).values([
      {
        clerkId: CLERK,
        sessionDate: "2026-05-25",
        type: "ride",
        sport: "cycling",
        durationMin: 56,
        avgPower: 410,
        tss: 93,
        intensityFactor: "1.000",
      },
      {
        clerkId: CLERK,
        sessionDate: "2026-05-20",
        type: "ride",
        sport: "cycling",
        durationMin: 74,
        normalizedPower: 161,
        tss: 19,
        intensityFactor: "0.393",
      },
      {
        clerkId: CLERK,
        sessionDate: "2026-06-24",
        type: "ride",
        sport: "cycling",
        durationMin: 161,
        normalizedPower: 185,
        tss: 55,
        intensityFactor: "0.451",
      },
    ]);

    // ── Tests ──────────────────────────────────────────────────────────────────

    await scenario("repair: ftp_history-rij geprefixed met [achterhaald]", async () => {
      const r = await runRepairFor(CLERK);
      assert(!r.skipped, "repair moet uitgevoerd zijn (niet overgeslagen)");
      const [row] = await db
        .select({ notes: ftpHistoryTable.notes })
        .from(ftpHistoryTable)
        .where(
          and(
            eq(ftpHistoryTable.clerkId, CLERK),
            eq(ftpHistoryTable.measuredAt, "2026-05-25"),
            eq(ftpHistoryTable.ftpWatts, 410),
          ),
        )
        .limit(1);
      assert(row?.notes?.startsWith("[achterhaald]"), `notes: "${row?.notes}"`);
    });

    await scenario("repair: 3 sessies vóór cutoff genulled", async () => {
      // sessionsNulled is al nul na de vorige scenario (tss=null na de repair).
      // We controleren de DB direct.
      const rows = await db
        .select({ tss: trainingSessionsTable.tss })
        .from(trainingSessionsTable)
        .where(
          and(
            eq(trainingSessionsTable.clerkId, CLERK),
            lt(trainingSessionsTable.sessionDate, "2026-06-26"),
          ),
        );
      assert(rows.length === 3, `verwacht 3 sessies, got ${rows.length}`);
      assert(rows.every((r) => r.tss === null), `niet alle tss zijn null: ${JSON.stringify(rows)}`);
    });

    await scenario("repair (tweede run): idempotent — geen dubbele prefix", async () => {
      const r = await runRepairFor(CLERK);
      assert(r.skipped, "tweede run moet overgeslagen zijn");
      assert(r.sessionsNulled === 0, `tweede run nullde ${r.sessionsNulled} sessies (moet 0)`);
      const [row] = await db
        .select({ notes: ftpHistoryTable.notes })
        .from(ftpHistoryTable)
        .where(
          and(
            eq(ftpHistoryTable.clerkId, CLERK),
            eq(ftpHistoryTable.measuredAt, "2026-05-25"),
            eq(ftpHistoryTable.ftpWatts, 410),
          ),
        )
        .limit(1);
      assert(
        !row?.notes?.startsWith("[achterhaald] [achterhaald]"),
        `dubbele prefix: "${row?.notes}"`,
      );
    });

    await scenario("backfill herleidt scores na repair (volgorde repair → backfill)", async () => {
      const r = await backfillTssForAthlete(CLERK);
      assert(r.updated === 3, `verwacht 3 herberekend, got ${r.updated}`);

      const sessions = await db
        .select({
          date: trainingSessionsTable.sessionDate,
          dur: trainingSessionsTable.durationMin,
          avg: trainingSessionsTable.avgPower,
          np: trainingSessionsTable.normalizedPower,
          tss: trainingSessionsTable.tss,
        })
        .from(trainingSessionsTable)
        .where(eq(trainingSessionsTable.clerkId, CLERK));

      for (const s of sessions) {
        assert(s.tss !== null, `sessie ${s.date} heeft nog steeds tss=null`);
        const p = s.np ?? s.avg;
        if (!p || !s.dur) continue;
        const ifVal = p / 272;
        const expected = Math.round((s.dur / 60) * ifVal * ifVal * 100);
        assert(
          s.tss === expected,
          `sessie ${s.date}: tss ${s.tss} !== verwacht ${expected} (FTP 272)`,
        );
      }
    });

    await scenario("backfill tweede run is no-op na herberekening", async () => {
      const r = await backfillTssForAthlete(CLERK);
      assert(r.updated === 0, `tweede backfill-run updatde ${r.updated} (moet 0)`);
    });

    await scenario("identity guard: OTHER-clerkId wordt NIET aangeraakt door repair op CLERK", async () => {
      const [before] = await db
        .select({ notes: ftpHistoryTable.notes })
        .from(ftpHistoryTable)
        .where(
          and(
            eq(ftpHistoryTable.clerkId, OTHER),
            eq(ftpHistoryTable.measuredAt, "2026-05-25"),
            eq(ftpHistoryTable.ftpWatts, 410),
          ),
        )
        .limit(1);

      // Repair op CLERK (al idempotent na eerste run) — raakt OTHER niet.
      await runRepairFor(CLERK);

      const [after] = await db
        .select({ notes: ftpHistoryTable.notes })
        .from(ftpHistoryTable)
        .where(
          and(
            eq(ftpHistoryTable.clerkId, OTHER),
            eq(ftpHistoryTable.measuredAt, "2026-05-25"),
            eq(ftpHistoryTable.ftpWatts, 410),
          ),
        )
        .limit(1);

      assert(
        before?.notes === after?.notes,
        `OTHER-rij gewijzigd: "${before?.notes}" → "${after?.notes}"`,
      );
    });

  } finally {
    for (const clerkId of [CLERK, OTHER]) {
      await db.delete(userProfilesTable).where(eq(userProfilesTable.clerkId, clerkId));
    }
  }

  // De echte repair410wFtp() gebruikt de hardcoded productie-clerkId.
  // In dev bestaat die niet → applied: false (veilige no-op).
  await scenario("repair410wFtp(): no-op in dev (productie-clerkId niet aanwezig)", async () => {
    const r = await repair410wFtp();
    assert(!r.applied, `applied=${r.applied} — productie-clerkId mag niet in dev bestaan`);
    assert(r.sessionsNulled === 0, `sessionsNulled=${r.sessionsNulled} in dev (moet 0)`);
  });

  // ── Report ──────────────────────────────────────────────────────────────────
  let failed = 0;
  for (const r of results) {
    const mark = r.status === "pass" ? "✓" : "✗";
    console.log(`${mark} ${r.scenario}${r.note ? ` — ${r.note}` : ""}`);
    if (r.status === "fail") failed++;
  }
  console.log(`\n${results.length - failed}/${results.length} passed`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => {});
  process.exit(1);
});
