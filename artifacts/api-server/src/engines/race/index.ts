// Race Intelligence engine.
//
// Owns the deterministic preparation timeline, the auto-generated race-day report
// (honest about what is unknown), the race-fuel advice with budget alternatives,
// and the multi-day checklist grouping. All logic is pure over an athlete-entered
// race + the athlete's profile — no live feeds, no fabricated data. The races
// route composes this; the term "AI" never leaves this layer.

export {
  buildRaceIntel,
  buildPrepTimeline,
  buildRaceDayReport,
  buildRaceFuel,
  daysUntil as raceDaysUntil,
} from "../../lib/race-intel";

export type {
  RaceIntel,
  PrepPhase,
  RaceDayReport,
  ReportSection,
  ReportItem,
  RaceFuel,
  FuelTier,
  ChecklistGroup,
  IntelStatus,
  Range as FuelRange,
} from "../../lib/race-intel";
