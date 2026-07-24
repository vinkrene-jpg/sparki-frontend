// Sparki Foundation — contracts.
//
// Every foundation engine implements exactly one interface from this file and
// talks to the others ONLY through these contracts. The orchestrator routes,
// engines compute; no engine imports another foundation engine directly.

import type { Load, LoadPoint, RiskSignal } from "../../lib/recovery-load";
import type { Readiness } from "../../lib/sharing";

// ── Shared ──────────────────────────────────────────────────────────────────

export type FoundationEngineName =
  | "data"
  | "knowledge"
  | "athlete-model"
  | "strategy"
  | "pattern"
  | "decision-support"
  | "explainability";

/** Confidence is always calibrated: 0–99, never 100. */
export type FoundationConfidence = {
  score: number;
  redenen: string[];
  onzekerheden: string[];
};

export const ONVOLDOENDE_GEGEVENS = "Onvoldoende gegevens beschikbaar.";

// ── 1. Data Engine ──────────────────────────────────────────────────────────

export type DataSnapshot = {
  clerkId: string;
  peildatum: string; // YYYY-MM-DD
  profiel: {
    ftp: number | null;
    ftpEstimated: boolean;
    gewichtKg: number | null;
    zones: Array<{ zone: string; minWatts: number; maxWatts: number | null }> | null;
  };
  sessies: Array<{
    id: number;
    sessionDate: string;
    type: string | null;
    source: string | null;
    durationMin: number | null;
    tss: number | null;
  }>;
  belasting: (Load & { chartData: LoadPoint[] }) | null;
  risico: RiskSignal | null;
  paraatheid: Readiness | null;
  dagmetingen: Array<{
    metricDate: string;
    hrv: number | null;
    sleepHours: number | null;
    sleepQuality: number | null;
  }>;
  wedstrijden: Array<{ id: number; name: string; raceDate: string; priority: string | null }>;
  geplandeTrainingen: Array<{ id: number; date: string; targetTSS: number | null }>;
  /** Honest list of channels with no data at all. */
  ontbrekend: string[];
  /** Reproducibility: model versions + parameters used. */
  berekening: { versie: string; parameters: Record<string, unknown> };
};

export interface DataEngine {
  collect(clerkId: string): Promise<DataSnapshot>;
}

// ── 2. Knowledge Engine ─────────────────────────────────────────────────────

export type EvidenceRecord = {
  evidenceId: number;
  titel: string;
  bron: string | null;
  auteurs: string | null;
  doi: string | null;
  publicatiedatum: string | null;
  evidenceLevel: string;
  kwaliteitsscore: number | null;
  scoringVersie: string | null;
  geldigTot: string | null;
  verlopen: boolean;
  conflicten: Array<{ evidenceId: number; reden: string }>;
  tags: string[];
  versie: number | null;
};

export interface KnowledgeEngine {
  findEvidence(input: { tags?: string[]; limit?: number }): Promise<EvidenceRecord[]>;
  registerEvidence(input: {
    subjectKind: "knowledge_item" | "managed_item";
    knowledgeItemId?: number | null;
    managedItemId?: number | null;
    evidenceLevel: string;
    validFrom?: string | null;
    validUntil?: string | null;
    conflictsWith?: Array<{ evidenceId: number; reden: string }>;
    tags?: string[];
    notes?: string | null;
  }): Promise<EvidenceRecord>;
  /** Deterministic 0–100 quality score for an evidence row (versioned). */
  scoreQuality(input: { evidenceLevel: string; publicatiedatum: string | null; reliability?: string | null }): {
    score: number;
    versie: string;
  };
}

// ── 3. Athlete Model Engine ────────────────────────────────────────────────

export type AthleteModel = {
  clerkId: string;
  doelen: { hoofddoel: string | null; ontwikkeldoel: string | null };
  motivatie: string | null;
  ervaring: string | null;
  leerstijl: string | null;
  trainingsgeschiedenis: { sessiesLaatste90d: number; urenLaatste90d: number | null };
  wedstrijdplanning: Array<{ id: number; name: string; raceDate: string; priority: string | null }>;
  beschikbareUren: number | null;
  belastbaarheid: string | null;
  voorkeuren: string | null;
  materiaal: string | null;
  medischeBeperkingen: { gezondheidsstatus: string; blessurehistorie: string | null };
  privacy: { aiToestemming: boolean | null };
  communicatieniveau: string | null;
  kennisniveau: string | null;
  informatievoorkeur: string | null;
  /** Automatically-extensible dimensions (athlete_model_extensions). */
  uitbreidingen: Record<string, unknown>;
  ontbrekend: string[];
};

export interface AthleteModelEngine {
  build(clerkId: string, snapshot: DataSnapshot): Promise<AthleteModel>;
  setExtension(clerkId: string, key: string, value: unknown, source: string): Promise<void>;
}

// ── 4. Strategy Engine ─────────────────────────────────────────────────────

export type StrategyConflict = { code: string; beschrijving: string; ernst: "laag" | "middel" | "hoog" };

export type StrategyView = {
  doelhierarchie: Array<{ niveau: number; doel: string; bron: string }>;
  periodisering: { fase: string | null; wekenTotHoofddoel: number | null; toelichting: string };
  afhankelijkheden: Array<{ van: string; naar: string; reden: string }>;
  scenarioBasis: { huidigeVorm: string | null; trend: string | null };
  prioriteiten: string[];
  conflicten: StrategyConflict[];
};

export interface StrategyEngine {
  build(model: AthleteModel, snapshot: DataSnapshot): StrategyView;
}

// ── 5. Pattern Engine ──────────────────────────────────────────────────────

export type DetectedPattern = {
  soort: "trend" | "afwijking" | "correlatie" | "persoonlijk" | "voorspelling";
  code: string;
  beschrijving: string;
  waarde: number | null;
  vertrouwen: FoundationConfidence;
};

export interface PatternEngine {
  detect(snapshot: DataSnapshot): DetectedPattern[];
}

// ── 6. Decision Support Engine ─────────────────────────────────────────────

export type DecisionScenario = {
  code: "A" | "B" | "C";
  naam: string;
  beschrijving: string;
  kansVanSlagen: FoundationConfidence;
  risico: "laag" | "middel" | "hoog";
  benodigdeInspanning: string;
  benodigdeTijd: string;
  kosten: string | null;
  verwachteEffecten: string[];
};

export type DecisionSupport = {
  huidigeSituatie: string;
  doel: string | null;
  scenarios: DecisionScenario[]; // always ≥2 — never one mandatory advice
};

export interface DecisionSupportEngine {
  build(input: {
    model: AthleteModel;
    strategie: StrategyView;
    patronen: DetectedPattern[];
    snapshot: DataSnapshot;
  }): DecisionSupport;
}

// ── 7. Explainability Engine ───────────────────────────────────────────────

export type FoundationExplanation = {
  gebruikteData: string[];
  gebruikteModellen: Array<{ engine: FoundationEngineName; versie: string }>;
  gebruikteKennis: Array<{ titel: string; evidenceLevel: string; doi: string | null }>;
  persoonlijkeFactoren: string[];
  vertrouwen: FoundationConfidence;
  aannames: string[];
  onzekerheden: string[];
  alternatieveScenarios: string[];
  berekeningsketen: Array<{ stap: number; engine: FoundationEngineName; omschrijving: string; duurMs: number }>;
};

export interface ExplainabilityEngine {
  explain(run: FoundationRun): Promise<FoundationExplanation>;
}

// ── Orchestrator result ────────────────────────────────────────────────────

export type FoundationStepTrace = {
  stap: number;
  engine: FoundationEngineName;
  duurMs: number;
  ok: boolean;
};

export type FoundationRun = {
  clerkId: string;
  gestartOp: string;
  snapshot: DataSnapshot;
  kennis: EvidenceRecord[];
  model: AthleteModel;
  strategie: StrategyView;
  patronen: DetectedPattern[];
  beslisondersteuning: DecisionSupport;
  stappen: FoundationStepTrace[];
};

export type FoundationResult = FoundationRun & { uitleg: FoundationExplanation };

export type FoundationContainer = {
  data: DataEngine;
  knowledge: KnowledgeEngine;
  athleteModel: AthleteModelEngine;
  strategy: StrategyEngine;
  pattern: PatternEngine;
  decisionSupport: DecisionSupportEngine;
  explainability: ExplainabilityEngine;
};
