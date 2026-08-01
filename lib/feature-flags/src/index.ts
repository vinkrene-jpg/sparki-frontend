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
  "rit_verhaal",
  "climb_explorer",
  "ai_foundation",
  "commercial_shell",
  "commercial_tiers",
  "stripe_checkout",
  "stripe_webhooks",
  "stripe_portal",
  "media_uitleg_motion",
  "media_uitleg_dieptekaart",
  "mobile_routeplanner_v2",
  "walking_routes",
  "hiking_routes",
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
  rit_verhaal:
    "De keten (Fase 1) — sync-status, na-rit moment op Vandaag, rit-verhaal met vier hoofdstukken, inline schemagevolg en chat-met-ritcontext",
  climb_explorer:
    "Klimmenverkenner — doorzoekbare beklimmingen/cols/toppen (OpenStreetMap) met echte hoogte, afgeleid klimprofiel en omschrijving uit OSM/Wikipedia",
  ai_foundation:
    "Sparki Foundation — orchestrator + zeven analyse-engines (data, kennis, sportersmodel, strategie, patronen, beslisondersteuning, uitlegbaarheid); niets staat automatisch aan",
  commercial_shell:
    "Commerciële lichte schil — Vandaag in de lichte commerciële vormgeving (mobiel + desktop), zelfde echte data en acties; uit = huidige donkere Vandaag",
  commercial_tiers:
    "Commercieel tier-stelsel (FREE/GO/COMPLETE) — resolver kijkt naar user_profiles.commercial_tier en tier_feature_grants. Default uit; commercial_tier=NULL blijft byte-identiek legacy-gedrag",
  stripe_checkout:
    "Stripe Checkout (TESTMODUS) — abonnement afsluiten voor accounts op de billing-testallowlist. Default uit",
  stripe_webhooks:
    "Stripe-webhookendpoint (TESTMODUS) — idempotente eventverwerking volgens het fase-1-webhookcontract. Default uit",
  stripe_portal:
    "Stripe Customer Portal (TESTMODUS) — facturen/betaalmethoden/annuleren voor allowlist-accounts. Default uit",
  media_uitleg_motion:
    "MEDIA_UITLEG_01 F1 — gedeelde motionbasis: instelling 'Verminder beweging' (server-side bewaard) + centrale animatie-uitschakelaar en testpagina. Default uit",
  media_uitleg_dieptekaart:
    "MEDIA_UITLEG_01 F2 — diepte-/zweefkaart (CMP-40) op het ene vrijgegeven moment 'training voltooid'; subtiele kanteling alleen tijdens aanraking. Default uit",
  mobile_routeplanner_v2:
    "MOBILE_ROUTE_WALKING_01 Deel A — telefoon-gerichte routeplanner-wizard (voortgang, vaste primaire actie, veilige schermranden); zelfde state en route-engine als desktop. Default uit",
  walking_routes:
    "MOBILE_ROUTE_WALKING_01 Deel B — Wandelen als volwaardige routefamilie (foot-walking-profiel + voet-geschiktheid); nooit stil fietsprofiel. Default uit",
  hiking_routes:
    "MOBILE_ROUTE_WALKING_01 Deel B — Hiken als volwaardige routefamilie (foot-hiking-profiel, onverhard/hoogte leidend); nooit stil fietsprofiel. Default uit",
};

export * from "./sports";
