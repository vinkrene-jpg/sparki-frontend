import type {
  HealthCategory,
  HealthStatusColor,
  HealthUrgency,
} from "@workspace/db";

// What a probe returns after actually testing its dependency. The engine merges
// this with the check's static metadata before persisting. A probe never throws
// to the engine — it catches and reports red/orange with a plain-language error.
export interface ProbeResult {
  status: HealthStatusColor;
  passed: boolean;
  responseTimeMs: number;
  // Plain-language reason (Dutch). For GREY this is the "nog niet gekoppeld"
  // explanation; for RED/ORANGE it is the human-readable failure.
  message?: string | null;
  // Optional technical detail for an admin who wants to dig deeper.
  technicalDetails?: string | null;
  // A probe may raise the urgency / change remediation dynamically (e.g. a token
  // about to expire). When omitted the static metadata is used.
  urgency?: HealthUrgency;
  remediation?: string | null;
}

// Static, human-written metadata for a check plus its real probe function.
export interface CheckDefinition {
  key: string;
  category: HealthCategory;
  // Plain Dutch label + what this check verifies.
  title: string;
  description: string;
  responsibleModule: string;
  // Who feels it when this breaks (plain Dutch, names the audiences).
  userImpact: string;
  // Default urgency/remediation; a probe may override on failure.
  urgency: HealthUrgency;
  remediation: string;
  // Real probe. Must measure its own latency and never throw.
  probe: () => Promise<ProbeResult>;
}

export interface RunOptions {
  mode: "manual" | "single" | "daily" | "weekly" | "release";
  triggeredBy: string;
  // Limit a run to a single check key.
  onlyKey?: string;
}
