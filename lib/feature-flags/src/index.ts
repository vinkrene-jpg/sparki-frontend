export const FEATURE_KEYS = [
  "ai_observations",
  "strava",
  "garmin",
  "route_planner",
  "autonomous_training",
  "coach_portal",
  "parent_portal",
  "testing_tools",
  "premium",
  "knowledge_base",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const FEATURE_DESCRIPTIONS: Record<FeatureKey, string> = {
  ai_observations:
    "AI-generated daily briefings, training insights, and coaching observations",
  strava: "Strava OAuth integration — activity sync, route import, power data",
  garmin: "Garmin Connect integration — HRV, sleep, RHR, activity sync",
  route_planner:
    "Route planner, elevation profiles, turn-by-turn navigation",
  autonomous_training:
    "Autonomous AI training schedule — Sparki builds and adapts a real plan when the athlete has no coach (advisory-only when coached)",
  coach_portal:
    "Coach portal — view and manage linked athlete training plans",
  parent_portal:
    "Parent portal — view linked athlete readiness and schedule",
  testing_tools:
    "Internal testing tools — flag management UI, data seeding, debug overlays",
  premium: "Premium feature tier — reserved for future paid features",
  knowledge_base:
    "Sparki Knowledge Base — daily-scanned sport-science library, browsable news/research surface, and cited retrieval in AI briefs",
};

export * from "./sports";
