export const FEATURE_KEYS = [
  "ai_observations",
  "strava",
  "garmin",
  "route_planner",
  "coach_portal",
  "parent_portal",
  "testing_tools",
  "premium",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_DESCRIPTIONS: Record<FeatureKey, string> = {
  ai_observations:
    "AI-generated daily briefings, training insights, and coaching observations",
  strava: "Strava OAuth integration — activity sync, route import, power data",
  garmin: "Garmin Connect integration — HRV, sleep, RHR, activity sync",
  route_planner:
    "Route planner, elevation profiles, turn-by-turn navigation",
  coach_portal:
    "Coach portal — view and manage linked athlete training plans",
  parent_portal:
    "Parent portal — view linked athlete readiness and schedule",
  testing_tools:
    "Internal testing tools — flag management UI, data seeding, debug overlays",
  premium: "Premium feature tier — reserved for future paid features",
};
