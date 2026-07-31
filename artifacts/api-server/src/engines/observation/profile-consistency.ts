// Profile-consistency module — Sparki notices when profile values contradict
// real riding, names it, asks about it and (only after the athlete confirms)
// corrects the profile.
//
// Three deterministic checks over ProfileFacts (claims vs proof):
//   1. profile_ftp_low        — a user-set FTP lower than the floor a real
//                               whole-ride effort already proved. Estimated
//                               FTP's are excluded: those self-heal after
//                               every sync (recalibrateEstimatedFtp).
//   2. profile_level_mismatch — level says "beginner" while the athlete rides
//                               big, structured weeks (median ≥ 8 h over ≥ 4
//                               real weeks).
//   3. profile_week_target_off— a user-set week target far from what the
//                               athlete actually rides (median ≥ 1.5× or
//                               ≤ 0.5× the target, difference ≥ 2 h).
//
// Honesty contract: detection is pure over real data (no thresholds met = no
// message), and a correction is NEVER auto-applied to a user-set value — the
// athlete confirms first, and even then the applier re-verifies the evidence
// from the database before writing.

import type { AiObservationCategory, AiObservationSeverity } from "@workspace/db";
import type { ProfileFacts } from "./types";

export type ProfileInconsistencyId =
  | "profile_ftp_low"
  | "profile_level_mismatch"
  | "profile_week_target_off";

export type ProfileInconsistency = {
  id: ProfileInconsistencyId;
  /** Plain-Dutch observation (what Sparki noticed, with the real numbers). */
  statement: string;
  /** Plain-Dutch question Sparki asks before touching anything. */
  question: string;
  /** Plain-Dutch reason the question matters. */
  because: string;
  tone: "concern" | "neutral";
  category: AiObservationCategory;
  severity: AiObservationSeverity;
};

/** All follow-up ids this module owns (used for longer answer retention). */
export function isProfileFollowUp(id: string): boolean {
  return id.startsWith("profile_");
}

// ── Pure detection ───────────────────────────────────────────────────────────

export function detectProfileInconsistencies(
  p: ProfileFacts | null | undefined,
): ProfileInconsistency[] {
  if (!p) return [];
  const out: ProfileInconsistency[] = [];

  // 1. FTP lower than a proven effort. Only for user-set (non-estimated) FTP:
  //    estimated values are auto-raised after every sync.
  if (
    p.ftp != null &&
    !p.ftpEstimated &&
    p.ftpFloor != null &&
    p.ftpFloor.floorWatts > Math.round(p.ftp * 1.05)
  ) {
    const f = p.ftpFloor;
    const proof =
      f.kind === "sustained"
        ? `je hield op ${f.sessionDate} ${f.durationMin} minuten lang ${f.watts} watt vol`
        : `je reed op ${f.sessionDate} ${f.durationMin} minuten met ${f.watts} watt gemiddeld`;
    out.push({
      id: "profile_ftp_low",
      statement: `Je FTP staat op ${p.ftp} watt, maar ${proof} — je FTP is dus minstens ${f.floorWatts} watt.`,
      question: `Zullen we je FTP op ${f.floorWatts} watt zetten?`,
      because:
        "met een te lage FTP rekent Sparki al je zones en belastingscores te licht",
      tone: "concern",
      category: "training",
      severity: "important",
    });
  }

  // 2. "Beginner" with big, consistent training weeks.
  if (
    p.experienceLevel === "beginner" &&
    p.medianHours != null &&
    p.weeksWithRiding >= 4 &&
    p.medianHours >= 8
  ) {
    out.push({
      id: "profile_level_mismatch",
      statement: `Je niveau staat op beginner, maar je reed de afgelopen weken zo'n ${p.medianHours} uur per week — dat past eerder bij een gevorderde renner.`,
      question: `Klopt "beginner" nog als jouw niveau?`,
      because:
        "je niveau bepaalt hoe voorzichtig Sparki je belasting opbouwt en hoe je uitleg klinkt",
      tone: "neutral",
      category: "planning",
      severity: "watch",
    });
  }

  // 3. User-set week target far from reality (both directions).
  if (
    p.weeklyHourTarget != null &&
    !p.weeklyHourTargetEstimated &&
    p.medianHours != null &&
    p.weeksWithRiding >= 4
  ) {
    const target = p.weeklyHourTarget;
    const real = p.medianHours;
    const far =
      (real >= target * 1.5 && real - target >= 2) ||
      (real <= target * 0.5 && target - real >= 2);
    if (far) {
      const richting =
        real > target
          ? `je rijdt in werkelijkheid zo'n ${real} uur — flink meer`
          : `je komt in werkelijkheid op zo'n ${real} uur — flink minder`;
      out.push({
        id: "profile_week_target_off",
        statement: `Je weekdoel staat op ${target} uur, maar ${richting}. Die twee passen niet bij elkaar.`,
        question: `Zullen we je weekdoel op ${real} uur zetten?`,
        because:
          "een weekdoel dat ver van de praktijk ligt maakt je planning en adviezen scheef",
        tone: "neutral",
        category: "planning",
        severity: "watch",
      });
    }
  }

  return out;
}

// ── Facts from the database ──────────────────────────────────────────────────

const FTP_WINDOW_DAYS = 120;
const HOURS_WINDOW_DAYS = 70;

/**
 * Load the real claims-vs-proof facts for one athlete. Every field comes from
 * the stored profile or from real sessions; nothing is guessed.
 */
export async function loadProfileFacts(
  clerkId: string,
  now = new Date(),
): Promise<ProfileFacts | null> {
  const { db, athleteProfilesTable, trainingSessionsTable } = await import(
    "@workspace/db"
  );
  const { and, eq, sql } = await import("drizzle-orm");
  const { estimateFtpFloor, medianWeeklyHours } = await import(
    "../../lib/derived-load"
  );

  const [profile] = await db
    .select({
      ftp: athleteProfilesTable.ftp,
      ftpEstimated: athleteProfilesTable.ftpEstimated,
      experienceLevel: athleteProfilesTable.experienceLevel,
      weeklyHourTarget: athleteProfilesTable.weeklyHourTarget,
      weeklyHourTargetEstimated:
        athleteProfilesTable.weeklyHourTargetEstimated,
    })
    .from(athleteProfilesTable)
    .where(eq(athleteProfilesTable.clerkId, clerkId))
    .limit(1);
  if (!profile) return null;

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
        sql`${trainingSessionsTable.sessionDate} >= (CURRENT_DATE - make_interval(days => ${FTP_WINDOW_DAYS}))::date`,
      ),
    );

  const floor = estimateFtpFloor(sessions);
  const cutoff = new Date(now.getTime() - HOURS_WINDOW_DAYS * 24 * 3600 * 1000);
  const cutoffStr = [
    cutoff.getFullYear(),
    String(cutoff.getMonth() + 1).padStart(2, "0"),
    String(cutoff.getDate()).padStart(2, "0"),
  ].join("-");
  const { weeksWithRiding, medianHours } = medianWeeklyHours(
    sessions.filter((s) => s.sessionDate >= cutoffStr),
    now,
  );

  return {
    ftp: profile.ftp,
    ftpEstimated: profile.ftpEstimated,
    experienceLevel: profile.experienceLevel,
    weeklyHourTarget: profile.weeklyHourTarget,
    weeklyHourTargetEstimated: profile.weeklyHourTargetEstimated,
    ftpFloor: floor
      ? {
          floorWatts: floor.floorWatts,
          sessionDate: floor.basis.sessionDate,
          durationMin: floor.basis.durationMin,
          watts: floor.basis.watts,
          kind: floor.basis.kind,
        }
      : null,
    weeksWithRiding,
    medianHours,
  };
}

// ── Confirmed corrections (write path) ───────────────────────────────────────

export type ProfileCorrectionResult = {
  applied: boolean;
  /** Plain-Dutch line describing what changed (or why nothing did). */
  message: string;
};

/**
 * Apply ONE confirmed profile correction. Re-verifies the evidence from the
 * database first: if the inconsistency no longer holds (data changed since the
 * question was asked), nothing is written — never a blind write.
 */
export async function applyProfileCorrection(
  clerkId: string,
  questionId: string,
): Promise<ProfileCorrectionResult> {
  const facts = await loadProfileFacts(clerkId);
  const stillThere = detectProfileInconsistencies(facts).find(
    (i) => i.id === questionId,
  );
  if (!facts || !stillThere) {
    return {
      applied: false,
      message: "Niets aangepast: de gegevens kloppen inmiddels al met elkaar.",
    };
  }

  const { db, athleteProfilesTable, ftpHistoryTable } = await import(
    "@workspace/db"
  );
  const { and, eq } = await import("drizzle-orm");

  switch (questionId) {
    case "profile_ftp_low": {
      const floor = facts.ftpFloor!;
      // Compare-and-set against the exact verified pre-state: if the athlete
      // changed their FTP in the meantime, this writes nothing (0 rows) and
      // the confirmation is honestly reported as not applied.
      // WP-K1: compare-and-set + herkomst-event in één transactie — de waarde
      // verandert nooit zonder herleidbaar paspoort-event.
      const { recordValueEvent } = await import("../../lib/passport");
      const updated = await db.transaction(async (tx) => {
        const rows = await tx
          .update(athleteProfilesTable)
          .set({
            ftp: floor.floorWatts,
            // A floor is a derived lower bound, not a measurement: flag it as
            // estimated so a stronger real effort keeps raising it automatically.
            ftpEstimated: true,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(athleteProfilesTable.clerkId, clerkId),
              eq(athleteProfilesTable.ftp, facts.ftp!),
              eq(athleteProfilesTable.ftpEstimated, false),
            ),
          )
          .returning({ clerkId: athleteProfilesTable.clerkId });
        if (rows.length > 0) {
          await recordValueEvent(
            {
              clerkId,
              field: "ftp",
              oldValue: String(facts.ftp!),
              newValue: String(floor.floorWatts),
              origin: "berekend",
              source: "FTP-ondergrens (door jou bevestigd)",
              actorType: "sporter",
              actorId: clerkId,
            },
            tx,
          );
        }
        return rows;
      });
      if (updated.length === 0) {
        return {
          applied: false,
          message:
            "Niets aangepast: je FTP is net gewijzigd — Sparki kijkt er bij de volgende analyse opnieuw naar.",
        };
      }

      // Record in ftp_history so belastingscores use the corrected FTP from
      // the proof date on. Idempotent per day (same pattern as the
      // recalibration in lib/derived-load-backfill).
      const notes =
        floor.kind === "sustained"
          ? `Ondergrens: ${floor.watts} watt volgehouden over ${floor.durationMin} min (door jou bevestigd)`
          : `Ondergrens: 95% van ${floor.watts} watt over ${floor.durationMin} min (door jou bevestigd)`;
      const [existing] = await db
        .select({ id: ftpHistoryTable.id, ftpWatts: ftpHistoryTable.ftpWatts })
        .from(ftpHistoryTable)
        .where(
          and(
            eq(ftpHistoryTable.clerkId, clerkId),
            eq(ftpHistoryTable.measuredAt, floor.sessionDate),
            eq(ftpHistoryTable.testType, "derived"),
          ),
        )
        .limit(1);
      if (!existing) {
        await db.insert(ftpHistoryTable).values({
          clerkId,
          measuredAt: floor.sessionDate,
          ftpWatts: floor.floorWatts,
          testType: "derived",
          notes,
        });
      } else if (existing.ftpWatts !== floor.floorWatts) {
        await db
          .update(ftpHistoryTable)
          .set({ ftpWatts: floor.floorWatts, notes })
          .where(eq(ftpHistoryTable.id, existing.id));
      }
      return {
        applied: true,
        message: `Je FTP staat nu op ${floor.floorWatts} watt.`,
      };
    }

    case "profile_level_mismatch": {
      // Guarded on the verified pre-state ("beginner"): a concurrent change
      // means 0 rows and an honest not-applied.
      const updated = await db
        .update(athleteProfilesTable)
        .set({ experienceLevel: "intermediate", updatedAt: new Date() })
        .where(
          and(
            eq(athleteProfilesTable.clerkId, clerkId),
            eq(athleteProfilesTable.experienceLevel, "beginner"),
          ),
        )
        .returning({ clerkId: athleteProfilesTable.clerkId });
      if (updated.length === 0) {
        return {
          applied: false,
          message: "Niets aangepast: je niveau is net al gewijzigd.",
        };
      }
      return { applied: true, message: "Je niveau staat nu op gevorderd." };
    }

    case "profile_week_target_off": {
      const hours = facts.medianHours!;
      // WP-K1: compare-and-set + herkomst-event in één transactie.
      const { recordValueEvent } = await import("../../lib/passport");
      const updated = await db.transaction(async (tx) => {
        const rows = await tx
          .update(athleteProfilesTable)
          .set({
            weeklyHourTarget: hours,
            // Derived from real riding — keep the flag true so it keeps
            // recalibrating when the athlete's weeks change.
            weeklyHourTargetEstimated: true,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(athleteProfilesTable.clerkId, clerkId),
              eq(athleteProfilesTable.weeklyHourTarget, facts.weeklyHourTarget!),
              eq(athleteProfilesTable.weeklyHourTargetEstimated, false),
            ),
          )
          .returning({ clerkId: athleteProfilesTable.clerkId });
        if (rows.length > 0) {
          await recordValueEvent(
            {
              clerkId,
              field: "weeklyHourTarget",
              oldValue: String(facts.weeklyHourTarget!),
              newValue: String(hours),
              origin: "berekend",
              source: "weekritme (door jou bevestigd)",
              actorType: "sporter",
              actorId: clerkId,
            },
            tx,
          );
        }
        return rows;
      });
      if (updated.length === 0) {
        return {
          applied: false,
          message: "Niets aangepast: je weekdoel is net al gewijzigd.",
        };
      }
      return {
        applied: true,
        message: `Je weekdoel staat nu op ${hours} uur.`,
      };
    }

    default:
      return { applied: false, message: "Onbekende correctie." };
  }
}
