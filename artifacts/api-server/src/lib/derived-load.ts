// Derived load (pure).
//
// Providers like Strava don't expose a belastingscore (TSS) on their activity
// summaries, but they DO give power. When an athlete's FTP is known, the
// belastingscore is fully determined by the standard definition:
//
//   IF  = genormaliseerd vermogen / FTP      (fallback: gemiddeld vermogen)
//   TSS = (duur in uren) × IF² × 100
//
// This is a deterministic derivation over real data — nothing is fabricated.
// When an ingredient is missing (no power, no FTP, no duration) the result is
// null and the session honestly stays without a belastingscore.
//
// The same module holds the weekly-target recalibration: an ESTIMATED weekly
// hour target (weeklyHourTargetEstimated=true) is re-derived from what the
// athlete actually rides, so advice never keeps comparing against a guess that
// reality has long overtaken. User-set targets are never touched.

export type DeriveTssInput = {
  durationMin: number | null | undefined;
  normalizedPower: number | null | undefined;
  avgPower: number | null | undefined;
  ftp: number | null | undefined;
};

export type DerivedTss = {
  tss: number;
  // 3-decimal intensity factor, matching the numeric(4,3) column.
  intensityFactor: number;
};

/**
 * Derive belastingscore + intensiteitsfactor from power and FTP.
 * Returns null when any ingredient is missing or the result is implausible
 * (which signals a wrong FTP or corrupt power — never store nonsense).
 */
export function deriveTss(input: DeriveTssInput): DerivedTss | null {
  const duration = input.durationMin;
  const ftp = input.ftp;
  const power = input.normalizedPower ?? input.avgPower;
  if (
    duration == null || !Number.isFinite(duration) || duration < 1 ||
    ftp == null || !Number.isFinite(ftp) || ftp < 50 || ftp > 600 ||
    power == null || !Number.isFinite(power) || power <= 0 || power > 2000
  ) {
    return null;
  }
  const intensity = power / ftp;
  // A whole-ride IF above 2 means the FTP is wrong or the power is corrupt —
  // deriving a score from it would poison the load model. Stay honest: null.
  if (intensity > 2) return null;
  const tss = Math.round((duration / 60) * intensity * intensity * 100);
  if (tss < 0 || tss > 1000) return null;
  return {
    tss,
    intensityFactor: Math.round(intensity * 1000) / 1000,
  };
}

export type FtpEntry = { measuredAt: string; ftpWatts: number };

/**
 * The FTP that applied on a given date: the most recent measurement at or
 * before that date; for rides older than the first measurement, the first
 * measurement (closest real knowledge we have); with no history at all, the
 * profile FTP (which may itself be flagged as estimated).
 */
export function ftpAtDate(
  history: FtpEntry[],
  date: string,
  profileFtp: number | null,
): number | null {
  const valid = history
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.measuredAt) && e.ftpWatts > 0)
    // Deterministic tie-break for same-day rows: highest watts wins (a floor
    // proven that day supersedes a lower same-day value).
    .sort(
      (a, b) =>
        a.measuredAt.localeCompare(b.measuredAt) || a.ftpWatts - b.ftpWatts,
    );
  if (valid.length === 0) return profileFtp;
  let applicable: FtpEntry | null = null;
  for (const e of valid) {
    if (e.measuredAt <= date) applicable = e;
    else break;
  }
  return (applicable ?? valid[0]!).ftpWatts;
}

// ── FTP-ondergrens uit echte inspanningen ────────────────────────────────────

export type EffortSession = {
  sessionDate: string;
  durationMin: number | null;
  normalizedPower: number | null;
  avgPower: number | null;
};

export type FtpFloor = {
  floorWatts: number;
  basis: {
    sessionDate: string;
    durationMin: number;
    watts: number;
    // "sustained" = hele rit van 45–120 min gehouden → FTP is minstens die NP.
    // "short"     = rit van 20–<45 min → 95%-regel (standaard 20-min-protocol).
    kind: "sustained" | "short";
  };
};

/**
 * Honest LOWER BOUND for FTP, derived from whole-ride power the athlete has
 * actually held. We only store per-ride averages (no intra-ride power curve),
 * so an exact FTP is NOT derivable — but a floor is: whoever held X watt
 * normalized for 45–120 minutes has an FTP of at least X, and for a 20–<45
 * minute ride at least 0.95×X (the standard 20-min test factor, conservative
 * here because whole-ride NP ≤ best-segment NP).
 *
 * Returns null when no ride in the window qualifies — honestly no signal.
 */
export function estimateFtpFloor(sessions: EffortSession[]): FtpFloor | null {
  let best: FtpFloor | null = null;
  for (const s of sessions) {
    const dur = s.durationMin;
    const power = s.normalizedPower ?? s.avgPower;
    if (
      dur == null || !Number.isFinite(dur) ||
      power == null || !Number.isFinite(power) || power <= 0 || power > 2000 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(s.sessionDate)
    ) {
      continue;
    }
    let kind: "sustained" | "short";
    let floor: number;
    if (dur >= 45 && dur <= 120) {
      kind = "sustained";
      floor = Math.round(power);
    } else if (dur >= 20 && dur < 45) {
      kind = "short";
      floor = Math.round(power * 0.95);
    } else {
      continue;
    }
    // Implausible floors signal corrupt power data — never propagate them.
    if (floor < 80 || floor > 600) continue;
    if (!best || floor > best.floorWatts) {
      best = {
        floorWatts: floor,
        basis: { sessionDate: s.sessionDate, durationMin: dur, watts: power, kind },
      };
    }
  }
  return best;
}

// ── Weekly-target recalibration ──────────────────────────────────────────────

export type WeeklyHoursResult = {
  // Number of complete weeks (in the window) that had at least one session.
  weeksWithRiding: number;
  // Median hours over those weeks, rounded to the nearest whole hour (min 1).
  // Null when fewer than `minWeeks` weeks qualify — not enough real signal.
  medianHours: number | null;
};

// Monday of the ISO week containing a local "YYYY-MM-DD" date.
function mondayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  const day = dt.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? 6 : day - 1;
  dt.setUTCDate(dt.getUTCDate() - diff);
  return dt.toISOString().slice(0, 10);
}

/**
 * Median weekly training hours over the last `windowWeeks` COMPLETE weeks
 * (the running week is excluded — it would understate the median). Weeks
 * without any session are skipped: an athlete who rides 10h in the weeks they
 * ride shouldn't see the target dragged down by a holiday week.
 */
export function medianWeeklyHours(
  sessions: Array<{ sessionDate: string; durationMin: number | null }>,
  now: Date,
  windowWeeks = 8,
  minWeeks = 4,
): WeeklyHoursResult {
  const localToday = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  const currentWeek = mondayOf(localToday);
  // First Monday of the window: windowWeeks complete weeks before this week.
  const start = new Date(`${currentWeek}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - windowWeeks * 7);
  const windowStart = start.toISOString().slice(0, 10);

  const minutesByWeek = new Map<string, number>();
  for (const s of sessions) {
    if (s.durationMin == null || s.durationMin <= 0) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.sessionDate)) continue;
    const week = mondayOf(s.sessionDate);
    if (week < windowStart || week >= currentWeek) continue;
    minutesByWeek.set(week, (minutesByWeek.get(week) ?? 0) + s.durationMin);
  }

  const weekly = [...minutesByWeek.values()].map((min) => min / 60);
  if (weekly.length < minWeeks) {
    return { weeksWithRiding: weekly.length, medianHours: null };
  }
  weekly.sort((a, b) => a - b);
  const mid = Math.floor(weekly.length / 2);
  const median =
    weekly.length % 2 === 1 ? weekly[mid]! : (weekly[mid - 1]! + weekly[mid]!) / 2;
  return {
    weeksWithRiding: weekly.length,
    medianHours: Math.max(1, Math.round(median)),
  };
}
