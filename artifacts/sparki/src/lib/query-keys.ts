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

  parent: {
    all: () => ["parent"] as const,
    athletes: () => ["parent", "athletes"] as const,
  },

  links: {
    all: () => ["links"] as const,
    mine: () => ["links", "mine"] as const,
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
    plan: (from: string, to: string) =>
      ["athlete", "plan", from, to] as const,
    workout: (id: number) => ["athlete", "workout", "detail", id] as const,
  },

  aiMemory: {
    all: () => ["ai-memory"] as const,
    observations: () => ["ai-memory", "observations"] as const,
    preferences: () => ["ai-memory", "preferences"] as const,
  },

  contextMemory: {
    all: () => ["context-memory"] as const,
    list: () => ["context-memory", "list"] as const,
    due: () => ["context-memory", "due"] as const,
  },

  privacy: {
    all: () => ["privacy"] as const,
    settings: () => ["privacy", "settings"] as const,
  },

  nutrition: {
    all: () => ["nutrition"] as const,
    logs: (limit?: number) =>
      limit != null
        ? (["nutrition", "logs", limit] as const)
        : (["nutrition", "logs"] as const),
  },

  notifications: {
    all: () => ["notifications"] as const,
    list: () => ["notifications", "list"] as const,
  },

  activityImports: {
    all: () => ["activity-imports"] as const,
    list: () => ["activity-imports", "list"] as const,
  },

  routes: {
    all: () => ["routes"] as const,
    list: () => ["routes", "list"] as const,
    detail: (id: number) => ["routes", "detail", id] as const,
    byWorkout: (plannedWorkoutId: number) =>
      ["routes", "by-workout", plannedWorkoutId] as const,
  },

  trainingPlan: {
    all: () => ["training-plan"] as const,
    current: () => ["training-plan", "current"] as const,
  },

  bugReports: {
    all: () => ["bug-reports"] as const,
    mine: () => ["bug-reports", "mine"] as const,
    admin: () => ["bug-reports", "admin"] as const,
  },

  admin: {
    all: () => ["admin"] as const,
    whoami: () => ["admin", "whoami"] as const,
    status: () => ["admin", "status"] as const,
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

  knowledge: {
    all: () => ["knowledge"] as const,
    meta: () => ["knowledge", "meta"] as const,
    list: (q: string, discipline: string, type: string) =>
      ["knowledge", "list", q, discipline, type] as const,
  },

  feed: {
    all: () => ["feed"] as const,
    news: () => ["feed", "news"] as const,
  },

  social: {
    all: () => ["social"] as const,
    friends: () => ["social", "friends"] as const,
    requests: () => ["social", "requests"] as const,
    search: (q: string) => ["social", "search", q] as const,
    feed: () => ["social", "feed"] as const,
    suggestion: () => ["social", "suggestion"] as const,
    proposals: () => ["social", "proposals"] as const,
    team: () => ["social", "team"] as const,
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
