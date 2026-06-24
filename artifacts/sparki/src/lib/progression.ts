// Pure helpers for "trainingsverloop" — the development of an athlete over
// multiple trainings/weeks. Everything here derives from REAL logged data
// (sessions + the load model); nothing is fabricated. When the input is empty
// the output is honestly empty/zero so the UI can show a missing-data state.

export type WeekBucket = {
  /** ISO date (yyyy-mm-dd) of the Monday that starts this week. */
  weekStart: string
  /** Short Dutch label, e.g. "12 mei". */
  label: string
  sessions: number
  totalTss: number
  totalMin: number
}

type SessionLike = {
  sessionDate: string
  tss: number | null
  durationMin: number | null
}

function mondayOf(d: Date): Date {
  const x = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  )
  const day = (x.getUTCDay() + 6) % 7 // 0 = Monday
  x.setUTCDate(x.getUTCDate() - day)
  return x
}

/**
 * Bucket sessions into the last `weeks` calendar weeks (Monday-based),
 * most-recent-week last. Sessions outside the window are ignored.
 */
export function weeklyBuckets(
  sessions: SessionLike[],
  weeks: number,
  now: Date = new Date(),
): WeekBucket[] {
  const thisMonday = mondayOf(now)
  const buckets: WeekBucket[] = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisMonday)
    start.setUTCDate(start.getUTCDate() - i * 7)
    buckets.push({
      weekStart: start.toISOString().slice(0, 10),
      label: start.toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "short",
      }),
      sessions: 0,
      totalTss: 0,
      totalMin: 0,
    })
  }
  for (const s of sessions) {
    if (!s.sessionDate) continue
    const d = new Date(s.sessionDate + "T12:00:00Z")
    if (Number.isNaN(d.getTime())) continue
    const m = mondayOf(d).toISOString().slice(0, 10)
    const b = buckets.find((x) => x.weekStart === m)
    if (!b) continue
    b.sessions += 1
    b.totalTss += s.tss ?? 0
    b.totalMin += s.durationMin ?? 0
  }
  return buckets
}

export type TrendDir = "up" | "flat" | "down"

/**
 * Direction of change from `first` to `last`, with a relative dead-band so tiny
 * fluctuations read as "flat".
 */
export function trendDir(first: number, last: number, rel = 0.05): TrendDir {
  if (first <= 0) return last > 0 ? "up" : "flat"
  const change = (last - first) / first
  if (change > rel) return "up"
  if (change < -rel) return "down"
  return "flat"
}

/**
 * Compare the average weekly TSS of the most recent `window` complete weeks
 * against the `window` weeks before them. Returns null when there isn't enough
 * data on both sides to make an honest comparison.
 */
export function volumeTrend(
  buckets: WeekBucket[],
  window = 2,
): TrendDir | null {
  if (buckets.length < window * 2) return null
  const recent = buckets.slice(-window)
  const prior = buckets.slice(-window * 2, -window)
  const avg = (arr: WeekBucket[]) =>
    arr.reduce((a, b) => a + b.totalTss, 0) / arr.length
  const recentAvg = avg(recent)
  const priorAvg = avg(prior)
  if (recentAvg === 0 && priorAvg === 0) return null
  return trendDir(priorAvg, recentAvg, 0.1)
}
