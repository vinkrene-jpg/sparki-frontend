// Today-engine (WP-T1): deterministische orchestrator voor de Vandaag-pagina.
// Routes importeren uitsluitend deze facade.
export {
  orchestrateToday,
  recordTodayInteraction,
  amsterdamToday,
} from "./orchestrate";
export type {
  TodayResult,
  TodayItem,
  TodayAction,
  TodaySlotName,
} from "./orchestrate";
export { deriveTodayProfile } from "./profile";
export type { TodayProfile, TodayVariant } from "./profile";
