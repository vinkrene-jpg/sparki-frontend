// Sprint engine — "bordjes sprinten" (town-sign sprints).
//
// Owns honest detection of sprint boards along a route (via the routing
// provider's reverse geocoding) and deterministic scoring of a rider's sprint.
// Consumed by the sprints route.

export { detectSprintBoards } from "./detect";
export { scoreSprint, SPRINT_BASE_POINTS } from "./score";
export type { SprintScoreInput, SprintScore } from "./score";
