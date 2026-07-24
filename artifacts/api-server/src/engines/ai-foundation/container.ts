// Sparki Foundation — dependency-injection container.
//
// Each engine is created behind its interface; tests can override any engine
// with a stub via `overrides`. The default container wires the real engines.

import type { FoundationContainer } from "./contracts";
import { createDataEngine } from "./data-engine";
import { createKnowledgeEngine } from "./knowledge-engine";
import { createAthleteModelEngine } from "./athlete-model-engine";
import { createStrategyEngine } from "./strategy-engine";
import { createPatternEngine } from "./pattern-engine";
import { createDecisionSupportEngine } from "./decision-support-engine";
import { createExplainabilityEngine } from "./explainability-engine";

export function createFoundationContainer(
  overrides: Partial<FoundationContainer> = {},
): FoundationContainer {
  return {
    data: overrides.data ?? createDataEngine(),
    knowledge: overrides.knowledge ?? createKnowledgeEngine(),
    athleteModel: overrides.athleteModel ?? createAthleteModelEngine(),
    strategy: overrides.strategy ?? createStrategyEngine(),
    pattern: overrides.pattern ?? createPatternEngine(),
    decisionSupport: overrides.decisionSupport ?? createDecisionSupportEngine(),
    explainability: overrides.explainability ?? createExplainabilityEngine(),
  };
}
