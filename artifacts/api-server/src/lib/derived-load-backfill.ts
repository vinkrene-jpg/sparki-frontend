// Self-healing derived-load pass.
//
// Two honest repairs over data that already exists:
//   1. Sessions imported WITHOUT a belastingscore (providers like Strava never
//      send one) get it derived from their own power + the athlete's FTP at
//      that date — the standard deterministic formula in lib/derived-load.
//      A session without power or without a known FTP stays honestly empty.
//   2. Athletes whose weekly hour target is still an ESTIMATE
//      (weeklyHourTargetEstimated = true) get it re-derived from what they
//      actually ride (median over recent complete weeks), so advice stops
//      comparing reality against a stale guess. A user-set target is never
//      touched.
//
// Runs fire-and-forget at server start (covers the production rows that were
// imported before this derivation existed) and per-athlete after every sync.
// Idempotent: only rows with tss IS NULL are considered, and the target is
// only written when the derived value actually differs.

import { and, eq, isNull, isNotNull, or, sql } from "drizzle-orm";
import {
  db,
  pool,
  trainingSessionsTable,
  athleteProfilesTable,
  ftpHistoryTable,
} from "@workspace/db";
import {
  deriveTss,
  estimateFtpFloor,
  ftpAtDate,
  medianWeeklyHours,
  type FtpEntry,
} from "./derived-load";
import { recordComputation } from "../engines/data-origin";

// Advisory lock so overlapping instances (autoscale) don't do the same work
// twice. Distinct from the world-seed lock id.
const ADVISORY_LOCK_ID = 727401002;

export type DerivedBackfillSummary = {
  ran: boolean;
  sessionsUpdated: number;
  sessionsSkipped: number;
  targetsRecalibrated: number;
  ftpFloorsRaised: number;
  ftpProfileMismatches: number;
};

export type FtpProfileMismatch = {
  clerkId: string;
  profileFtp: number | null;
  latestHistoryFtp: number;
  latestHistoryDate: string;
};

/**
 * Consistency check: profiel-FTP hoort overeen te komen met de nieuwste
 * GELDIGE ftp_history-rij (achterhaalde afgeleide rijen tellen niet mee).
 * Een afwijking betekent dat schermen een andere "huidige FTP" tonen dan de
 * meetgeschiedenis rechtvaardigt — zoals het geseedde dev-account dat wél
 * historie had maar profile.ftp = null. Waarschuwt alleen (repareert niets):
 * de reparatiepaden hierboven hebben elk hun eigen honesty-regels.
 */
export async function findFtpProfileMismatches(): Promise<
  FtpProfileMismatch[]
> {
  const result = await db.execute(sql`
    SELECT p.clerk_id AS "clerkId",
           p.ftp AS "profileFtp",
           h.ftp_watts AS "latestHistoryFtp",
           h.measured_at AS "latestHistoryDate"
    FROM athlete_profiles p
    JOIN LATERAL (
      SELECT ftp_watts, measured_at
      FROM ftp_history f
      WHERE f.clerk_id = p.clerk_id
        AND NOT (f.test_type = 'derived'
                 AND coalesce(f.notes, '') LIKE '[achterhaald]%')
      ORDER BY f.measured_at DESC, f.id DESC
      LIMIT 1
    ) h ON TRUE
    WHERE p.ftp IS DISTINCT FROM h.ftp_watts
  `);
  return (result.rows as unknown as FtpProfileMismatch[]).map((r) => ({
    clerkId: r.clerkId,
    profileFtp: r.profileFtp == null ? null : Number(r.profileFtp),
    latestHistoryFtp: Number(r.latestHistoryFtp),
    latestHistoryDate: String(r.latestHistoryDate),
  }));
}

type Log = (msg: string) => void;

/** Derive + persist belastingscore for one athlete's score-less sessions. */
export async function backfillTssForAthlete(clerkId: string): Promise<{
  updated: number;
  skipped: number;
}> {
  const rows = await db
    .select({
      id: trainingSessionsTable.id,
      sessionDate: trainingSessionsTable.sessionDate,
      durationMin: trainingSessionsTable.durationMin,
      normalizedPower: trainingSessionsTable.normalizedPower,
      avgPower: trainingSessionsTable.avgPower,
    })
    .from(trainingSessionsTable)
    .where(
      and(
        eq(trainingSessionsTable.clerkId, clerkId),
        isNull(trainingSessionsTable.tss),
        isNotNull(trainingSessionsTable.durationMin),
        or(
          isNotNull(trainingSessionsTable.normalizedPower),
          isNotNull(trainingSessionsTable.avgPower),
        ),
      ),
    );
  if (rows.length === 0) return { updated: 0, skipped: 0 };

  const [profile] = await db
    .select({ ftp: athleteProfilesTable.ftp })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId))
    .limit(1);
  const history: FtpEntry[] = (
    await db
      .select({
        measuredAt: ftpHistoryTable.measuredAt,
        ftpWatts: ftpHistoryTable.ftpWatts,
      })
      .from(ftpHistoryTable)
      .where(
        and(
          eq(ftpHistoryTable.clerkId, clerkId),
          // Achterhaalde afgeleide rijen tellen nergens meer mee — ook niet
          // in de belastingscore-afleiding.
          sql`NOT (${ftpHistoryTable.testType} = 'derived' AND coalesce(${ftpHistoryTable.notes}, '') LIKE '[achterhaald]%')`,
        ),
      )
  ).map((e) => ({ measuredAt: e.measuredAt, ftpWatts: e.ftpWatts }));

  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    const ftp = ftpAtDate(history, row.sessionDate, profile?.ftp ?? null);
    const derived = deriveTss({
      durationMin: row.durationMin,
      normalizedPower: row.normalizedPower,
      avgPower: row.avgPower,
      ftp,
    });
    if (!derived) {
      skipped++;
      continue;
    }
    const changed = await db
      .update(trainingSessionsTable)
      .set({
        tss: derived.tss,
        intensityFactor: String(derived.intensityFactor),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(trainingSessionsTable.id, row.id),
          // Guard against a concurrent writer having filled it meanwhile —
          // a real (provider- or user-supplied) score always wins.
          isNull(trainingSessionsTable.tss),
        ),
      )
      .returning({ id: trainingSessionsTable.id });
    // Herleidbaarheid (Data Origin): alleen registreren als de update echt
    // landde (de guard kan hem stil overslaan).
    if (changed.length > 0) {
      await recordComputation({
        clerkId,
        subjectType: "derived_tss",
        subjectId: String(row.id),
        engine: "deriveTss",
        engineVersion: "1",
        parameters: {
          ftp,
          durationMin: row.durationMin,
          normalizedPower: row.normalizedPower,
          avgPower: row.avgPower,
        },
        inputs: [
          {
            bron: "derived",
            tabel: "training_sessions",
            recordId: row.id,
            veld: "avgPower/normalizedPower/durationMin",
          },
          { bron: "derived", tabel: "ftp_history", veld: "ftp_watts" },
        ],
        reliability: "afgeleid",
      });
    }
    updated++;
  }
  return { updated, skipped };
}

/**
 * Raise an ESTIMATED FTP to the honest floor proven by real efforts in the
 * last `windowDays`. Only ever RAISES (a floor can't lower anything), only
 * touches profiles with ftpEstimated=true, and records the correction in
 * ftp_history so belastingscores use the right FTP from that date on.
 * A user-measured FTP is never touched.
 */
export async function recalibrateEstimatedFtp(
  clerkId: string,
  windowDays = 120,
): Promise<{ changed: boolean; ftp: number | null }> {
  const [profile] = await db
    .select({
      ftp: athleteProfilesTable.ftp,
      estimated: athleteProfilesTable.ftpEstimated,
    })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId))
    .limit(1);
  if (!profile) return { changed: false, ftp: null };

  // Zelf ingevoerde/gemeten FTP wordt NOOIT automatisch aangepast — als een
  // echte inspanning aantoont dat hij te laag staat, wordt dat een
  // paspoortvoorstel dat de sporter (of bevoegde coach) moet bevestigen,
  // omdat een FTP-wijziging alle trainingszones verandert.
  if (!profile.estimated) {
    if (profile.ftp == null) return { changed: false, ftp: null };
    const measured = await db
      .select({
        sessionDate: trainingSessionsTable.sessionDate,
        durationMin: trainingSessionsTable.durationMin,
        normalizedPower: trainingSessionsTable.normalizedPower,
        avgPower: trainingSessionsTable.avgPower,
      })
      .from(trainingSessionsTable)
      .where(
        and(
          eq(trainingSessionsTable.clerkId, clerkId),
          sql`${trainingSessionsTable.sessionDate} >= (CURRENT_DATE - make_interval(days => ${windowDays}))::date`,
        ),
      );
    const measuredFloor = estimateFtpFloor(measured);
    if (
      measuredFloor &&
      measuredFloor.floorWatts > Math.round(profile.ftp * 1.05)
    ) {
      const { createProposal } = await import("./passport");
      await createProposal({
        clerkId,
        field: "ftp",
        proposedValue: String(measuredFloor.floorWatts),
        origin: "berekend",
        source: "bewezen inspanning",
        reason:
          measuredFloor.basis.kind === "sustained"
            ? `Je hield ${measuredFloor.basis.watts} watt vol over ${measuredFloor.basis.durationMin} min op ${measuredFloor.basis.sessionDate} — je FTP is minstens ${measuredFloor.floorWatts} watt.`
            : `Je reed ${measuredFloor.basis.watts} watt over ${measuredFloor.basis.durationMin} min op ${measuredFloor.basis.sessionDate} — 95%-regel geeft een ondergrens van ${measuredFloor.floorWatts} watt.`,
        proposedBy: "ftp-ondergrens-engine",
      }).catch(() => {
        // Best-effort: een mislukt voorstel mag de backfill nooit breken.
      });
    }
    return { changed: false, ftp: profile.ftp };
  }

  // Zelfherstel vóór alles: staat er een ECHTE invoer (handmatig of uit een
  // provider) in ftp_history die NIEUWER is dan de nieuwste afgeleide rij,
  // dan is het profiel ten onrechte als schatting blijven staan (oude bug:
  // de import zette ftpEstimated niet op false). De echte waarde wint —
  // herleidbaar via een paspoort-event, nooit stil.
  const [latestReal] = await db
    .select({
      measuredAt: ftpHistoryTable.measuredAt,
      ftpWatts: ftpHistoryTable.ftpWatts,
    })
    .from(ftpHistoryTable)
    .where(
      and(
        eq(ftpHistoryTable.clerkId, clerkId),
        sql`${ftpHistoryTable.testType} <> 'derived'`,
      ),
    )
    .orderBy(sql`${ftpHistoryTable.measuredAt} DESC`)
    .limit(1);
  const [latestDerived] = await db
    .select({ measuredAt: ftpHistoryTable.measuredAt })
    .from(ftpHistoryTable)
    .where(
      and(
        eq(ftpHistoryTable.clerkId, clerkId),
        eq(ftpHistoryTable.testType, "derived"),
      ),
    )
    .orderBy(sql`${ftpHistoryTable.measuredAt} DESC`)
    .limit(1);
  if (
    latestReal &&
    (!latestDerived || latestReal.measuredAt >= latestDerived.measuredAt)
  ) {
    const { recordValueEvent: recordRepair } = await import("./passport");
    await db.transaction(async (tx) => {
      await tx
        .update(athleteProfilesTable)
        .set({
          ftp: latestReal.ftpWatts,
          ftpEstimated: false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(athleteProfilesTable.clerkId, clerkId),
            eq(athleteProfilesTable.ftpEstimated, true),
          ),
        );
      // Afgeleide rijen die OUDER zijn dan de echte waarde zijn achterhaald:
      // ze blijven bestaan (historie is heilig) maar worden gemarkeerd zodat
      // ze niet meer als toonbare FTP-waarde verschijnen. Idempotent: een al
      // gemarkeerde rij wordt niet nogmaals geprefixt.
      await tx.execute(
        sql`UPDATE ftp_history
            SET notes = '[achterhaald] ' || coalesce(notes, '')
            WHERE clerk_id = ${clerkId}
              AND test_type = 'derived'
              AND measured_at <= ${latestReal.measuredAt}
              AND coalesce(notes, '') NOT LIKE '[achterhaald]%'`,
      );
      if (profile.ftp !== latestReal.ftpWatts) {
        await recordRepair(
          {
            clerkId,
            field: "ftp",
            oldValue: profile.ftp == null ? null : String(profile.ftp),
            newValue: String(latestReal.ftpWatts),
            origin: "handmatig",
            source: "eigen invoer/import (zelfherstel)",
            actorType: "engine",
            actorId: "ftp-ondergrens-engine",
            measuredAt: latestReal.measuredAt,
            note:
              "Zelfherstel: je eigen (geïmporteerde of handmatige) FTP is leidend boven een oudere afgeleide schatting.",
          },
          tx,
        );
      }
    });
    return { changed: true, ftp: latestReal.ftpWatts };
  }

  const sessions = await db
    .select({
      sessionDate: trainingSessionsTable.sessionDate,
      durationMin: trainingSessionsTable.durationMin,
      normalizedPower: trainingSessionsTable.normalizedPower,
      avgPower: trainingSessionsTable.avgPower,
    })
    .from(trainingSessionsTable)
    .where(
      and(
        eq(trainingSessionsTable.clerkId, clerkId),
        sql`${trainingSessionsTable.sessionDate} >= (CURRENT_DATE - make_interval(days => ${windowDays}))::date`,
      ),
    );
  const floor = estimateFtpFloor(sessions);
  if (!floor) return { changed: false, ftp: profile.ftp };
  if (profile.ftp != null && floor.floorWatts <= profile.ftp) {
    return { changed: false, ftp: profile.ftp };
  }

  // Een ECHTE invoer die NIEUWER is dan de bewijsdatum van de ondergrens wint
  // altijd: geen automatische ophoging — hoogstens een paspoortvoorstel.
  if (latestReal && latestReal.measuredAt >= floor.basis.sessionDate) {
    if (floor.floorWatts > Math.round(latestReal.ftpWatts * 1.05)) {
      const { createProposal } = await import("./passport");
      await createProposal({
        clerkId,
        field: "ftp",
        proposedValue: String(floor.floorWatts),
        origin: "berekend",
        source: "bewezen inspanning",
        reason: `Je reed ${floor.basis.watts} watt over ${floor.basis.durationMin} min op ${floor.basis.sessionDate} — dat wijst op een FTP van minstens ${floor.floorWatts} watt, hoger dan je huidige waarde.`,
        proposedBy: "ftp-ondergrens-engine",
      }).catch(() => {
        // Best-effort: een mislukt voorstel mag de backfill nooit breken.
      });
    }
    return { changed: false, ftp: profile.ftp };
  }

  // Atomair: FTP-ophoging + ftp_history + paspoort-event in één transactie —
  // de geschatte FTP kan nooit veranderen zonder herleidbaar event.
  const notes =
    floor.basis.kind === "sustained"
      ? `Ondergrens: ${floor.basis.watts} watt volgehouden over ${floor.basis.durationMin} min`
      : `Ondergrens: 95% van ${floor.basis.watts} watt over ${floor.basis.durationMin} min`;
  const { recordValueEvent } = await import("./passport");
  await db.transaction(async (tx) => {
    await tx
      .update(athleteProfilesTable)
      .set({
        ftp: floor.floorWatts,
        // Still a derived value (a lower bound, not a measurement) — the flag
        // stays true so a stronger real effort keeps raising it.
        ftpEstimated: true,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(athleteProfilesTable.clerkId, clerkId),
          eq(athleteProfilesTable.ftpEstimated, true),
        ),
      );

    // Record in ftp_history so ftpAtDate applies the corrected value to rides
    // from the proof date on. Idempotent PER DAY: at most one derived row per
    // clerkId+measuredAt — a re-derivation for the same proof date UPDATES that
    // row instead of stacking same-day duplicates (which would make FTP-at-date
    // selection order-dependent).
    const [existing] = await tx
      .select({ id: ftpHistoryTable.id, ftpWatts: ftpHistoryTable.ftpWatts })
      .from(ftpHistoryTable)
      .where(
        and(
          eq(ftpHistoryTable.clerkId, clerkId),
          eq(ftpHistoryTable.measuredAt, floor.basis.sessionDate),
          eq(ftpHistoryTable.testType, "derived"),
        ),
      )
      .limit(1);
    if (!existing) {
      await tx.insert(ftpHistoryTable).values({
        clerkId,
        measuredAt: floor.basis.sessionDate,
        ftpWatts: floor.floorWatts,
        testType: "derived",
        notes,
      });
    } else if (existing.ftpWatts !== floor.floorWatts) {
      await tx
        .update(ftpHistoryTable)
        .set({ ftpWatts: floor.floorWatts, notes })
        .where(eq(ftpHistoryTable.id, existing.id));
    }

    // Sportpaspoort: de automatische ophoging van een SCHATTING blijft
    // toegestaan (het is een correctie van een geschatte waarde, geen meting),
    // maar wordt herleidbaar vastgelegd — nooit een stille overschrijving.
    await recordValueEvent(
      {
        clerkId,
        field: "ftp",
        oldValue: profile.ftp == null ? null : String(profile.ftp),
        newValue: String(floor.floorWatts),
        origin: "berekend",
        source: "bewezen inspanning",
        actorType: "engine",
        actorId: "ftp-ondergrens-engine",
        measuredAt: floor.basis.sessionDate,
        note: notes,
      },
      tx,
    );
  });

  return { changed: true, ftp: floor.floorWatts };
}

/**
 * Re-derive an ESTIMATED weekly hour target from real riding. No-op when the
 * target was set by the user, when there aren't enough complete riding weeks,
 * or when the derived value equals the current one.
 */
export async function recalibrateWeeklyTarget(
  clerkId: string,
  now = new Date(),
): Promise<{ changed: boolean; hours: number | null }> {
  const [profile] = await db
    .select({
      weeklyHourTarget: athleteProfilesTable.weeklyHourTarget,
      estimated: athleteProfilesTable.weeklyHourTargetEstimated,
    })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId))
    .limit(1);
  if (!profile || !profile.estimated) return { changed: false, hours: null };

  const sessions = await db
    .select({
      sessionDate: trainingSessionsTable.sessionDate,
      durationMin: trainingSessionsTable.durationMin,
    })
    .from(trainingSessionsTable)
    .where(
      and(
        eq(trainingSessionsTable.clerkId, clerkId),
        sql`${trainingSessionsTable.sessionDate} >= (CURRENT_DATE - INTERVAL '70 days')::date`,
      ),
    );
  const { medianHours } = medianWeeklyHours(sessions, now);
  if (medianHours == null) return { changed: false, hours: null };
  if (medianHours === profile.weeklyHourTarget) {
    return { changed: false, hours: medianHours };
  }
  await db
    .update(athleteProfilesTable)
    .set({
      weeklyHourTarget: medianHours,
      // It stays a derived value (not user-set), so the flag stays true and a
      // later change in real riding keeps recalibrating it.
      weeklyHourTargetEstimated: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(athleteProfilesTable.clerkId, clerkId),
        eq(athleteProfilesTable.weeklyHourTargetEstimated, true),
      ),
    );
  return { changed: true, hours: medianHours };
}

/** Post-sync hook: repair this athlete's derived numbers. Never throws. */
export async function refreshDerivedLoadForAthlete(
  clerkId: string,
): Promise<void> {
  try {
    // FTP first: the corrected value must feed the score derivation below.
    await recalibrateEstimatedFtp(clerkId);
    await backfillTssForAthlete(clerkId);
    await recalibrateWeeklyTarget(clerkId);
  } catch {
    // Best-effort: a failed derivation must never break a successful sync.
  }
}

/**
 * Server-start pass over ALL athletes with derivable-but-missing scores or a
 * stale estimated target. Skips silently when another instance holds the lock.
 */
export async function backfillDerivedLoad(
  opts: { log?: Log } = {},
): Promise<DerivedBackfillSummary> {
  const log = opts.log ?? (() => {});
  const summary: DerivedBackfillSummary = {
    ran: false,
    sessionsUpdated: 0,
    sessionsSkipped: 0,
    targetsRecalibrated: 0,
    ftpFloorsRaised: 0,
    ftpProfileMismatches: 0,
  };

  // Advisory locks are SESSION-bound: acquire and release MUST happen on the
  // same connection, so hold a dedicated client for the whole pass. Pool-level
  // queries could unlock on a different session and leave the lock stuck.
  const client = await pool.connect();
  let locked = false;
  try {
    const lock = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [ADVISORY_LOCK_ID],
    );
    locked = lock.rows[0]?.locked === true;
    if (!locked) return summary; // another instance is on it
    summary.ran = true;

    // FTP floors first: score derivation below must use the corrected FTP.
    const estimatedFtp = await db
      .select({ clerkId: athleteProfilesTable.clerkId })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.ftpEstimated, true));
    for (const p of estimatedFtp) {
      const r = await recalibrateEstimatedFtp(p.clerkId);
      if (r.changed) summary.ftpFloorsRaised++;
    }

    // Athletes with at least one derivable session missing a score.
    const candidates = await db
      .selectDistinct({ clerkId: trainingSessionsTable.clerkId })
      .from(trainingSessionsTable)
      .where(
        and(
          isNull(trainingSessionsTable.tss),
          isNotNull(trainingSessionsTable.durationMin),
          or(
            isNotNull(trainingSessionsTable.normalizedPower),
            isNotNull(trainingSessionsTable.avgPower),
          ),
        ),
      );
    for (const c of candidates) {
      const r = await backfillTssForAthlete(c.clerkId);
      summary.sessionsUpdated += r.updated;
      summary.sessionsSkipped += r.skipped;
    }

    // Everyone whose weekly target is still an estimate.
    const estimated = await db
      .select({ clerkId: athleteProfilesTable.clerkId })
      .from(athleteProfilesTable)
      .where(eq(athleteProfilesTable.weeklyHourTargetEstimated, true));
    for (const p of estimated) {
      const r = await recalibrateWeeklyTarget(p.clerkId);
      if (r.changed) summary.targetsRecalibrated++;
    }

    // Consistentiecheck (waarschuwt alleen): profiel-FTP vs nieuwste geldige
    // historierij. Een afwijking wijst op een gebroken profiel-historie-
    // koppeling of inconsistente (seed)data en mag nooit stil blijven.
    const mismatches = await findFtpProfileMismatches();
    summary.ftpProfileMismatches = mismatches.length;
    for (const m of mismatches) {
      log(
        `WAARSCHUWING FTP-inconsistentie: ${m.clerkId} heeft profiel-FTP ` +
          `${m.profileFtp ?? "leeg"} maar nieuwste geldige meting is ` +
          `${m.latestHistoryFtp} W (${m.latestHistoryDate})`,
      );
    }

    if (
      summary.sessionsUpdated > 0 ||
      summary.targetsRecalibrated > 0 ||
      summary.ftpFloorsRaised > 0
    ) {
      log(
        `belastingscores afgeleid: ${summary.sessionsUpdated} ritten bijgewerkt, ` +
          `${summary.sessionsSkipped} overgeslagen; ` +
          `${summary.targetsRecalibrated} weekdoelen geijkt op echt rijgedrag; ` +
          `${summary.ftpFloorsRaised} FTP-schattingen opgetrokken naar bewezen ondergrens`,
      );
    }
  } finally {
    if (locked) {
      await client
        .query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_ID])
        .catch(() => {});
    }
    client.release();
  }
  return summary;
}
