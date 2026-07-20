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

export function subscribeRideTracker(
  _listener: (points: RidePoint[]) => void,
): () => void {
  return () => {};
}

export async function startRideTracker(): Promise<StartResult> {
  return { started: true, background: false, backgroundDenied: false };
}

export async function stopRideTracker(): Promise<void> {}
