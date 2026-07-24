// Sparki Foundation — per-engine configuration (versions + deterministic
// parameters). Versions travel into every explanation so results stay
// reproducible: same inputs + same version ⇒ same output.

import type { FoundationEngineName } from "./contracts";

export type EngineConfig = {
  versie: string;
  parameters: Record<string, unknown>;
};

export const FOUNDATION_CONFIG: Record<FoundationEngineName, EngineConfig> = {
  data: {
    versie: "1.0.0",
    parameters: {
      sessieVensterDagen: 90,
      belastingModel: "EWMA CTL42/ATL7 (computeLoadSeries)",
      metriekVensterDagen: 42,
    },
  },
  knowledge: {
    versie: "1.0.0",
    parameters: { scoring: "evidence-level + recency + reliability", maxResultaten: 20 },
  },
  "athlete-model": {
    versie: "1.0.0",
    parameters: { basis: "athlete_profiles + athlete_model_extensions" },
  },
  strategy: {
    versie: "1.0.0",
    parameters: { fasegrens: { basisWeken: 12, opbouwWeken: 4, piekWeken: 1 } },
  },
  pattern: {
    versie: "1.0.0",
    parameters: {
      trendVensterDagen: 42,
      afwijkingZScore: 2,
      correlatieMinPunten: 10,
      voorspellingHorizonDagen: 14,
    },
  },
  "decision-support": {
    versie: "1.0.0",
    parameters: { scenarios: ["A", "B", "C"] },
  },
  explainability: {
    versie: "1.0.0",
    parameters: { maxVertrouwen: 99 },
  },
};
