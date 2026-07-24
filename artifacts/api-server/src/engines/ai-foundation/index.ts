// Sparki Foundation — public facade.
//
// Routes and other engines import ONLY from here. Seven engines behind
// interfaces + a routing-only orchestrator; everything gated by the
// `ai_foundation` feature flag at the route layer.

export * from "./contracts";
export { FOUNDATION_CONFIG } from "./config";
export { createFoundationContainer } from "./container";
export { runFoundationAnalyse } from "./orchestrator";
export { createDataEngine } from "./data-engine";
export { createKnowledgeEngine } from "./knowledge-engine";
export { createAthleteModelEngine } from "./athlete-model-engine";
export { createStrategyEngine } from "./strategy-engine";
export { createPatternEngine } from "./pattern-engine";
export { createDecisionSupportEngine } from "./decision-support-engine";
export { createExplainabilityEngine } from "./explainability-engine";
