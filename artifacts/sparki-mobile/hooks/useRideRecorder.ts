import { useCallback, useEffect, useRef, useState } from "react";

import { haversineMeters, type LatLon } from "@/lib/geo";
import type { LiveLocation } from "@/hooks/useLiveLocation";
import {
  clearRecoverableRide,
  loadRecoverableRide,
  persistForegroundRide,
  startRideTracker,
  stopRideTracker,
  subscribeRideTracker,
} from "@/lib/ride-tracker";

// A single recorded fix: the real device position plus the wall-clock time it
// arrived. Timestamps let the backend GPX parser compute the ride duration.
export type RidePoint = {
  latitude: number;
  longitude: number;
  time: number; // epoch ms
};

// One real sensor reading snapshot, timestamped when it was sampled. Only
// values a connected Bluetooth sensor actually reported are present — a sample
// is only logged when at least one value is real, and a null field stays null
// (never fabricated). Merged onto the GPS track at save time by timestamp.
export type RideSensorSample = {
  time: number; // epoch ms
  watts: number | null;
  heartRate: number | null;
  cadence: number | null;
};

// Live sensor values as read at sample time (matches useLiveSensors values).
export type LiveSensorSnapshot = {
  watts: number | null;
  heartRate: number | null;
  cadence: number | null;
};

export type RideRecording = {
  recording: boolean;
  points: RidePoint[];
  distanceKm: number;
  elapsedSec: number;
  // True while the OS-level background task keeps the ride recording with the
  // screen locked / the app backgrounded.
  backgroundActive: boolean;
  // True when background permission was explicitly denied: recording works, but
  // only while the navigate screen is in the foreground.
  backgroundDenied: boolean;
  // A real, unfinished ride found persisted on disk after an app kill/crash.
  // Only the actual captured fixes — nothing fabricated. Null when there is none.
  recoverable: RecoverableRide | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
  // Drop the recovered ride (rider chose not to keep it).
  discardRecovered: () => void;
  // Snapshot of the real sensor readings logged so far this ride. Stable
  // getter (ref-backed) so reading it doesn't force re-renders each second.
  getSensorSamples: () => RideSensorSample[];
};

// An in-progress ride recovered from disk after the app was killed mid-ride.
export type RecoverableRide = {
  points: RidePoint[];
  distanceKm: number;
  startedAt: number;
};

// Ignore GPS jitter while standing still: a new fix closer than this to the last
// recorded one is dropped, so a stationary rider doesn't inflate the distance.
const MIN_MOVE_METERS = 5;

// Rebuild the filtered track + real haversine distance from a raw fix list.
// Used for the background buffer, which is delivered as the full array on every
// update. Nothing is fabricated: only real fixes that moved far enough are kept.
function buildTrack(raw: RidePoint[]): { points: RidePoint[]; distanceKm: number } {
  const out: RidePoint[] = [];
  let distanceKm = 0;
  let last: RidePoint | null = null;
  for (const p of raw) {
    if (last) {
      const a: LatLon = { latitude: last.latitude, longitude: last.longitude };
      const b: LatLon = { latitude: p.latitude, longitude: p.longitude };
      const moved = haversineMeters(a, b);
      if (moved < MIN_MOVE_METERS) continue;
      distanceKm += moved / 1000;
    }
    out.push(p);
    last = p;
  }
  return { points: out, distanceKm };
}

/**
 * Records a live ride from the real GPS fixes. Two paths, chosen automatically:
 *
 * 1. Background (native, permission granted): an OS-level location task
 *    (`lib/ride-tracker`) keeps accumulating fixes even when the screen locks or
 *    the app is backgrounded, so the full ride is captured. The hook mirrors that
 *    buffer via `subscribeRideTracker`.
 * 2. Foreground-only (web, or background permission denied): fixes come from the
 *    `location` prop (`useLiveLocation`), which only streams while the screen is
 *    in the foreground. The rider is told recording pauses when the screen locks.
 *
 * Nothing is fabricated: when the device emits no location no points are added,
 * so a too-short track is honestly empty and cannot be saved.
 */
// How often the live sensor values are sampled into the ride log while
// recording. 1s matches the GPS fix cadence of the background tracker.
const SENSOR_SAMPLE_MS = 1000;

export function useRideRecorder(
  location: LiveLocation | null,
  // Optional reader of the CURRENT live Bluetooth sensor values (watts / heart
  // rate / cadence). Sampled once per second while recording; only real
  // readings are logged. JS timers pause while the app is backgrounded, so the
  // log honestly has gaps when the screen is locked (GPS-only there).
  getSensorValues?: () => LiveSensorSnapshot,
): RideRecording {
  const [recording, setRecording] = useState(false);
  const [points, setPoints] = useState<RidePoint[]>([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [backgroundActive, setBackgroundActive] = useState(false);
  const [backgroundDenied, setBackgroundDenied] = useState(false);
  const [recoverable, setRecoverable] = useState<RecoverableRide | null>(null);

  const startedAtRef = useRef<number | null>(null);
  const lastRef = useRef<RidePoint | null>(null);
  // Ref mirror of backgroundActive so the foreground effect can bail out without
  // re-subscribing whenever the flag flips.
  const backgroundActiveRef = useRef(false);
  // Real sensor readings logged this ride (ref: read at save time, no renders).
  const sensorSamplesRef = useRef<RideSensorSample[]>([]);

  // Foreground path: append each new real fix from the prop. Skipped entirely
  // while the background tracker owns the track (avoids double-counting).
  useEffect(() => {
    if (!recording || backgroundActiveRef.current || !location) return;
    const next: RidePoint = {
      latitude: location.latitude,
      longitude: location.longitude,
      time: Date.now(),
    };
    const last = lastRef.current;
    if (last) {
      const a: LatLon = { latitude: last.latitude, longitude: last.longitude };
      const b: LatLon = { latitude: next.latitude, longitude: next.longitude };
      const moved = haversineMeters(a, b);
      if (moved < MIN_MOVE_METERS) return;
      setDistanceKm((d) => d + moved / 1000);
    }
    lastRef.current = next;
    setPoints((prev) => {
      const updated = [...prev, next];
      // Mirror the foreground track to disk so a crash/kill doesn't lose it
      // even when the OS-level background task isn't running.
      if (startedAtRef.current != null) {
        persistForegroundRide(updated, startedAtRef.current);
      }
      return updated;
    });
  }, [recording, location]);

  // On mount, surface any unfinished ride that survived an app kill/crash. Only
  // offered while not actively recording, so a fresh ride never collides with it.
  useEffect(() => {
    let cancelled = false;
    loadRecoverableRide()
      .then((ride) => {
        if (cancelled || !ride) return;
        const track = buildTrack(ride.points);
        if (track.points.length < 2) return;
        setRecoverable({
          points: track.points,
          distanceKm: track.distanceKm,
          startedAt: ride.startedAt,
        });
      })
      .catch(() => {
        // No recoverable ride, or unreadable store: nothing to offer.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Background path: mirror the OS task buffer while it is active.
  useEffect(() => {
    if (!recording || !backgroundActive) return;
    const unsub = subscribeRideTracker((raw) => {
      const track = buildTrack(raw);
      setPoints(track.points);
      setDistanceKm(track.distanceKm);
    });
    return unsub;
  }, [recording, backgroundActive]);

  // Sensor sample log: once per second, snapshot the live Bluetooth values.
  // Only samples with at least one REAL reading are logged — no sensors
  // connected means an empty log, never zeros. Interval timers pause while the
  // app is backgrounded, so screen-locked stretches honestly have no samples.
  useEffect(() => {
    if (!recording || !getSensorValues) return;
    const id = setInterval(() => {
      const v = getSensorValues();
      if (v.watts == null && v.heartRate == null && v.cadence == null) return;
      sensorSamplesRef.current.push({
        time: Date.now(),
        watts: v.watts,
        heartRate: v.heartRate,
        cadence: v.cadence,
      });
    }, SENSOR_SAMPLE_MS);
    return () => clearInterval(id);
  }, [recording, getSensorValues]);

  // Wall-clock elapsed timer, independent of GPS fix cadence.
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      if (startedAtRef.current != null) {
        setElapsedSec(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(id);
  }, [recording]);

  const start = useCallback(() => {
    startedAtRef.current = Date.now();
    lastRef.current = null;
    backgroundActiveRef.current = false;
    sensorSamplesRef.current = [];
    // Starting a new ride supersedes any recovered one.
    setRecoverable(null);
    setPoints([]);
    setDistanceKm(0);
    setElapsedSec(0);
    setBackgroundActive(false);
    setBackgroundDenied(false);
    setRecording(true);

    startRideTracker()
      .then((res) => {
        if (res.started && res.background) {
          backgroundActiveRef.current = true;
          setBackgroundActive(true);
        } else if (res.backgroundDenied) {
          setBackgroundDenied(true);
        }
      })
      .catch(() => {
        // Tracker failed to start (e.g. no capability): keep the foreground
        // path running rather than losing the ride.
      });
  }, []);

  const stop = useCallback(() => {
    setRecording(false);
    stopRideTracker().catch(() => {});
  }, []);

  const reset = useCallback(() => {
    setRecording(false);
    startedAtRef.current = null;
    lastRef.current = null;
    backgroundActiveRef.current = false;
    sensorSamplesRef.current = [];
    setPoints([]);
    setDistanceKm(0);
    setElapsedSec(0);
    setBackgroundActive(false);
    setBackgroundDenied(false);
    setRecoverable(null);
    stopRideTracker().catch(() => {});
    // The ride is finished (saved or dropped): clear the persisted track so it
    // is never offered again for recovery.
    clearRecoverableRide().catch(() => {});
  }, []);

  const getSensorSamples = useCallback(
    () => sensorSamplesRef.current.slice(),
    [],
  );

  const discardRecovered = useCallback(() => {
    setRecoverable(null);
    clearRecoverableRide().catch(() => {});
  }, []);

  return {
    recording,
    points,
    distanceKm,
    elapsedSec,
    backgroundActive,
    backgroundDenied,
    recoverable,
    start,
    stop,
    reset,
    discardRecovered,
    getSensorSamples,
  };
}
