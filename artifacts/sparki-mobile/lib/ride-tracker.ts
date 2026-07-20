import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import type { RidePoint } from "@/hooks/useRideRecorder";

// Name of the background location task. Defined at module scope so it is
// registered when the JS bundle loads (a hard requirement of expo-task-manager).
export const RIDE_TASK = "sparki-ride-location";

type Listener = (points: RidePoint[]) => void;

// The raw fixes delivered by the OS while a ride is being recorded. This buffer
// keeps growing even while the app is backgrounded / the screen is locked,
// because the OS keeps calling the background task. Nothing here is fabricated —
// every point is a real device fix the OS handed us.
let buffer: RidePoint[] = [];
const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) l(buffer);
}

// Register the background task. The OS invokes this with batched location
// updates, in the foreground AND while backgrounded/locked. We only append real
// fixes; on error we do nothing (never invent a position).
TaskManager.defineTask(RIDE_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: Location.LocationObject[] } | null)
    ?.locations;
  if (!locations || locations.length === 0) return;
  for (const loc of locations) {
    buffer.push({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      time: loc.timestamp,
    });
  }
  emit();
});

/** Subscribe to the growing background track. Fires immediately with current. */
export function subscribeRideTracker(listener: Listener): () => void {
  listeners.add(listener);
  listener(buffer);
  return () => {
    listeners.delete(listener);
  };
}

export type StartResult = {
  // Whether foreground location was granted and tracking is running at all.
  started: boolean;
  // Whether background location was granted, so the ride keeps recording while
  // the app is backgrounded / the screen is locked.
  background: boolean;
  // True only when background permission was explicitly denied (so the caller
  // can honestly tell the rider recording is foreground-only).
  backgroundDenied: boolean;
  reason?: string;
};

/**
 * Start recording the ride. Requests foreground permission first (required),
 * then background permission (optional). When background is granted we register
 * an OS-level location task with an Android foreground service so the track
 * keeps growing while the phone is locked. When background is denied we still
 * start, but the caller must fall back to foreground-only recording and tell
 * the rider. Nothing is fabricated when a permission is missing.
 */
export async function startRideTracker(): Promise<StartResult> {
  buffer = [];

  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") {
    return {
      started: false,
      background: false,
      backgroundDenied: false,
      reason: "Geen toegang tot je locatie. Sta locatie toe om een rit op te nemen.",
    };
  }

  let background = false;
  let backgroundDenied = false;
  try {
    const bg = await Location.requestBackgroundPermissionsAsync();
    background = bg.status === "granted";
    backgroundDenied = !background;
  } catch {
    // Background permission can throw on devices/builds without the capability;
    // treat as unavailable rather than denied so we don't over-warn.
    background = false;
    backgroundDenied = false;
  }

  if (background) {
    // Clear any stale task from a previous ride that didn't stop cleanly.
    const already = await Location.hasStartedLocationUpdatesAsync(RIDE_TASK).catch(
      () => false,
    );
    if (already) {
      await Location.stopLocationUpdatesAsync(RIDE_TASK).catch(() => {});
    }
    await Location.startLocationUpdatesAsync(RIDE_TASK, {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: 3,
      timeInterval: 1000,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      activityType: Location.ActivityType.Fitness,
      foregroundService: {
        notificationTitle: "Sparki neemt je rit op",
        notificationBody: "Je locatie wordt vastgelegd terwijl je rijdt.",
        notificationColor: "#0bd3d3",
      },
    });
  }

  return { started: true, background, backgroundDenied };
}

/** Stop the background location task if it is running. Safe to call twice. */
export async function stopRideTracker(): Promise<void> {
  const already = await Location.hasStartedLocationUpdatesAsync(RIDE_TASK).catch(
    () => false,
  );
  if (already) {
    await Location.stopLocationUpdatesAsync(RIDE_TASK).catch(() => {});
  }
}
