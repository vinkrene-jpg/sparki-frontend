// Fietsengarage engine.
//
// Owns the curated component knowledge base (honest klasse/aero/gewicht
// assessments — unknown parts stay "onbekend"), the deterministic upgrade
// advice per specialism, and the curated pro-team materiaal dataset. Consumed
// by the garage route. Never fabricated scores.

export {
  KNOWLEDGE_BASE,
  CLASS_RANK,
  CLASS_LABEL,
  matchKnowledgeEntry,
  assessComponent,
} from "../../lib/garage/knowledge-base";
export type {
  KnowledgeEntry,
  ComponentClass,
  ComponentAssessment,
} from "../../lib/garage/knowledge-base";

export {
  SPECIALISMS,
  SPECIALISM_LABEL,
  rankUpgrades,
} from "../../lib/garage/upgrade";
export type {
  Specialism,
  UpgradeAdvice,
  UpgradeSuggestion,
} from "../../lib/garage/upgrade";

export {
  PRO_TEAMS,
  PRO_TEAM_SEASON,
  PRO_TEAM_SOURCE,
  matchProTeams,
} from "../../lib/garage/pro-teams";
export type { ProTeam, ProTeamMatch } from "../../lib/garage/pro-teams";
