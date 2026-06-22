/**
 * Centralised query key factory.
 *
 * Convention:
 *   queryKeys.<domain>.<entity>(...args) → readonly tuple
 *
 * Using functions (not plain strings) means React Query can match both
 * broad invalidations ("invalidate everything under 'coach'") and precise
 * ones ("invalidate only coach athlete #123's plan").
 *
 * Usage:
 *   useQuery({ queryKey: queryKeys.user.profile(), ... })
 *   queryClient.invalidateQueries({ queryKey: queryKeys.coach.athletes() })
 */
export const queryKeys = {
  user: {
    all: () => ["user"] as const,
    profile: () => ["user", "profile"] as const,
    flags: () => ["user", "flags"] as const,
  },

  coach: {
    all: () => ["coach"] as const,
    athletes: () => ["coach", "athletes"] as const,
    athlete: (athleteId: string) => ["coach", "athletes", athleteId] as const,
    plan: (athleteId: string) =>
      ["coach", "athletes", athleteId, "plan"] as const,
    sessions: (athleteId: string) =>
      ["coach", "athletes", athleteId, "sessions"] as const,
    notes: (athleteId: string) =>
      ["coach", "athletes", athleteId, "notes"] as const,
  },

  athlete: {
    all: () => ["athlete"] as const,
    profile: () => ["athlete", "profile"] as const,
    dashboard: () => ["athlete", "dashboard"] as const,
    todayWorkout: () => ["athlete", "workout", "today"] as const,
    sessions: (limit?: number) =>
      limit != null
        ? (["athlete", "sessions", limit] as const)
        : (["athlete", "sessions"] as const),
    metrics: (days?: number) =>
      days != null
        ? (["athlete", "metrics", days] as const)
        : (["athlete", "metrics"] as const),
    load: () => ["athlete", "load"] as const,
    ftpHistory: () => ["athlete", "ftp"] as const,
    brief: () => ["athlete", "ai", "brief"] as const,
  },

  races: {
    all: () => ["races"] as const,
    list: () => ["races", "list"] as const,
  },

  invitations: {
    all: () => ["invitations"] as const,
    list: () => ["invitations", "list"] as const,
    detail: (token: string) => ["invitations", "detail", token] as const,
  },
} as const;

/** Default stale times (ms) — import these rather than hardcoding magic numbers. */
export const STALE = {
  /** Nearly-static data: user profile, role list. Re-validates every 5 min. */
  profile: 5 * 60_000,
  /** Session/training data: stale after 2 min. */
  session: 2 * 60_000,
  /** Feature flags: stale after 10 min. */
  flags: 10 * 60_000,
  /** Real-time feel: always considered stale. */
  live: 0,
} as const;
