import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import type { RidePoint, RideSensorSample } from "@/hooks/useRideRecorder";

// Name of the background location task. Defined at module scope so it is
// registered when the JS bundle loads (a hard requirement of expo-task-manager).
export const RIDE_TASK = "sparki-ride-location";

// Persistent store for the ride currently in progress. Fixes are written here
// incrementally as they arrive so that if the OS kills the app mid-ride (memory
// pressure, crash) the real track survives and can be recovered on relaunch.
const RIDE_STORE_KEY = "sparki:active-ride";

type Listener = (points: RidePoint[]) => void;

// The shape persisted to disk. Only real device fixes are stored; nothing here
// is fabricated.
export type PersistedRide = {
  // Wall-clock ms the ride started, so a recovered ride keeps its real duration.
  startedAt: number;
  points: RidePoint[];
  // Real Bluetooth sensor readings (watts/heart rate/cadence) logged so far.
  // Optional: rides without sensors persist no samples. Only readings a real
  // sensor reported are ever in here — nothing fabricated.
  sensorSamples?: RideSensorSample[];
};

// The raw fixes delivered by the OS while a ride is being recorded. This buffer
// keeps growing even while the app is backgrounded / the screen is locked,
// because the OS keeps calling the background task. Nothing here is fabricated —
// every point is a real device fix the OS handed us.
let buffer: RidePoint[] = [];
// Start time of the active ride, mirrored into every persisted snapshot.
let activeStartedAt: number | null = null;
// Real sensor readings logged this ride, mirrored from the recorder hook so a
// crash/kill doesn't lose the measured watts/heart rate/cadence. The hook only
// samples in the foreground, so background/lockscreen stretches honestly stay
// without sensor data.
let sensorBuffer: RideSensorSample[] = [];
const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) l(buffer);
}

// ---------------------------------------------------------------------------
// Incremental persistence
//
// The background task can be relaunched headlessly by the OS after a kill with a
// fresh (empty) module state. To avoid clobbering the already-captured track we
// hydrate `buffer` from disk once at module load and always await that before
// appending. Writes are throttled so a long ride doesn't hammer AsyncStorage on
// every one-second batch.
// ---------------------------------------------------------------------------

const hydration: Promise<void> = (async () => {
  try {
    const raw = await AsyncStorage.getItem(RIDE_STORE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as PersistedRide | null;
    if (parsed && Array.isArray(parsed.points)) {
      // Only restore if the live buffer hasn't already been seeded by a start.
      if (buffer.length === 0) buffer = parsed.points;
      if (activeStartedAt == null && typeof parsed.startedAt === "number") {
        activeStartedAt = parsed.startedAt;
      }
      // Restore the pre-kill sensor log too, so a headless relaunch's next
      // persisted snapshot never clobbers the measured values with an empty log.
      if (sensorBuffer.length === 0 && Array.isArray(parsed.sensorSamples)) {
        sensorBuffer = parsed.sensorSamples;
      }
    }
  } catch {
    // Corrupt/unreadable store: ignore rather than crash. Recovery simply won't
    // find a ride — never fabricate one.
  }
})();

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistPending = false;

async function writeStore(): Promise<void> {
  persistTimer = null;
  if (!persistPending) return;
  persistPending = false;
  if (activeStartedAt == null) return;
  try {
    const snapshot: PersistedRide = {
      startedAt: activeStartedAt,
      points: buffer,
      sensorSamples: sensorBuffer,
    };
    await AsyncStorage.setItem(RIDE_STORE_KEY, JSON.stringify(snapshot));
  } catch {
    // Disk write failed: keep going, the next throttled write retries.
  }
}

function schedulePersist(): void {
  persistPending = true;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    void writeStore();
  }, 4000);
}

async function flushPersist(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  await writeStore();
}

/** The persisted in-progress ride, if any real track survived. Null otherwise. */
export async function loadRecoverableRide(): Promise<PersistedRide | null> {
  try {
    const raw = await AsyncStorage.getItem(RIDE_STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedRide | null;
    if (
      parsed &&
      Array.isArray(parsed.points) &&
      parsed.points.length >= 2 &&
      typeof parsed.startedAt === "number"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

/** Discard the persisted ride (after it has been saved or explicitly dropped). */
export async function clearRecoverableRide(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  persistPending = false;
  activeStartedAt = null;
  buffer = [];
  sensorBuffer = [];
  try {
    await AsyncStorage.removeItem(RIDE_STORE_KEY);
  } catch {
    // Ignore: worst case a stale ride is offered again and can be discarded.
  }
}

/**
 * Persist the foreground-only track. When background permission is denied the
 * fixes come from the hook (not this module's task), so the hook mirrors them
 * here to get the same crash-safety. Throttled the same way.
 */
export function persistForegroundRide(points: RidePoint[], startedAt: number): void {
  activeStartedAt = startedAt;
  buffer = points;
  schedulePersist();
}

/**
 * Mirror the recorder hook's sensor log into the persisted snapshot so a
 * crash/kill mid-ride keeps the measured watts/heart rate/cadence, not just the
 * GPS track. Called on every sample; writes stay throttled with the track.
 * Only real readings ever reach this — the hook never logs fabricated values.
 */
export function persistRideSensorSamples(samples: RideSensorSample[]): void {
  sensorBuffer = samples;
  schedulePersist();
}

// Register the background task. The OS invokes this with batched location
// updates, in the foreground AND while backgrounded/locked. We only append real
// fixes; on error we do nothing (never invent a position).
TaskManager.defineTask(RIDE_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: Location.LocationObject[] } | null)
    ?.locations;
  if (!locations || locations.length === 0) return;
  // Restore any pre-kill track before appending, so a headless relaunch never
  // overwrites the real captured fixes with a fresh empty buffer.
  await hydration;
  for (const loc of locations) {
    buffer.push({
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      time: loc.timestamp,
    });
  }
  schedulePersist();
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
  // Start a fresh ride: drop any leftover buffer and stamp a new start time.
  // Any previously persisted (unrecovered) ride is overwritten from here on.
  buffer = [];
  sensorBuffer = [];
  activeStartedAt = Date.now();

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
  // Flush the latest fixes to disk immediately. The store is intentionally NOT
  // cleared here — it is cleared only once the ride is saved (or the recovered
  // ride is explicitly discarded), so a crash between stop and save can't lose it.
  await flushPersist();
}
