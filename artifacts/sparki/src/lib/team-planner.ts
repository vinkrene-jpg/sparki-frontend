// Team Meeting Planner (task #4, step 6) — pure logic.
//
// When several riders attend the same race, propose a meeting point, a shared
// (carpool) departure and a per-rider departure so everyone arrives at the venue
// together. Optimises around a single venue-arrival target. Every clock time is
// DERIVED from athlete-entered travel times (no live GPS / traffic), so the
// result is flagged as estimates.

import type { Race, TeamRider } from "@/lib/race-types";
import { venueArrivalMinutes, fmtHM } from "@/lib/race-planner";

export type TeamRiderPlan = {
  id: string;
  name: string;
  startLocation: string | null;
  travelDurationMin: number | null;
  /** When this rider should leave to arrive with the group ("HH:MM" or null). */
  departureTime: string | null;
};

export type TeamPlan = {
  /** Suggested meeting / carpool point (athlete-entered departure location). */
  meetingPoint: string | null;
  /** Target time everyone arrives at the venue ("HH:MM" or null). */
  arrivalTarget: string | null;
  /** When a shared carpool should leave the meeting point ("HH:MM" or null). */
  sharedDeparture: string | null;
  riders: TeamRiderPlan[];
  /** True — all times are derived estimates, never live data. */
  isEstimate: true;
};

/**
 * Compute the team meeting plan for a race. Returns null when there are no
 * additional riders (the planner only appears for multi-rider races).
 */
export function computeTeamPlan(race: Race): TeamPlan | null {
  const riders: TeamRider[] = race.teamRiders ?? [];
  if (riders.length === 0) return null;

  const arrivalMin = venueArrivalMinutes(race);
  const meetingPoint = race.logistics?.departureLocation ?? null;

  // Carpool leaves the meeting point early enough to cover the (entered) travel
  // time to the venue. We reuse the athlete's own travel time as the
  // meeting-point→venue estimate when present.
  const groupTravel = race.logistics?.travelDurationMin ?? null;
  const sharedDeparture =
    arrivalMin != null && groupTravel != null
      ? fmtHM(arrivalMin - groupTravel)
      : null;

  const riderPlans: TeamRiderPlan[] = riders.map((r) => ({
    id: r.id,
    name: r.name,
    startLocation: r.startLocation ?? null,
    travelDurationMin: r.travelDurationMin ?? null,
    departureTime:
      arrivalMin != null && r.travelDurationMin != null
        ? fmtHM(arrivalMin - r.travelDurationMin)
        : null,
  }));

  return {
    meetingPoint,
    arrivalTarget: fmtHM(arrivalMin),
    sharedDeparture,
    riders: riderPlans,
    isEstimate: true,
  };
}
