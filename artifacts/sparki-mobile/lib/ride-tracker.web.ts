import type { RidePoint } from "@/hooks/useRideRecorder";

// Web stub: browsers have no background location task. Recording on web runs
// foreground-only via the browser Geolocation watch (see useLiveLocation), so
// this module is a no-op and reports background as unavailable (not "denied").
export const RIDE_TASK = "sparki-ride-location";

export type StartResult = {
  started: boolean;
  background: boolean;
  backgroundDenied: boolean;
  reason?: string;
};

export type PersistedRide = {
  startedAt: number;
  points: RidePoint[];
};

export function subscribeRideTracker(
  _listener: (points: RidePoint[]) => void,
): () => void {
  return () => {};
}

export async function startRideTracker(): Promise<StartResult> {
  return { started: true, background: false, backgroundDenied: false };
}

export async function stopRideTracker(): Promise<void> {}

// Web has no persistent OS-level background task and no crash-recovery path
// (a killed browser tab loses the in-memory watch entirely), so recovery is a
// no-op here. Never fabricate a recovered ride.
export async function loadRecoverableRide(): Promise<PersistedRide | null> {
  return null;
}

export async function clearRecoverableRide(): Promise<void> {}

export function persistForegroundRide(
  _points: RidePoint[],
  _startedAt: number,
): void {}
