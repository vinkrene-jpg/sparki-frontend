import { useCallback, useEffect, useRef, useState } from "react";

import { haversineMeters, type LatLon } from "@/lib/geo";
import type { LiveLocation } from "@/hooks/useLiveLocation";
import {
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
  start: () => void;
  stop: () => void;
  reset: () => void;
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
export function useRideRecorder(location: LiveLocation | null): RideRecording {
  const [recording, setRecording] = useState(false);
  const [points, setPoints] = useState<RidePoint[]>([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [backgroundActive, setBackgroundActive] = useState(false);
  const [backgroundDenied, setBackgroundDenied] = useState(false);

  const startedAtRef = useRef<number | null>(null);
  const lastRef = useRef<RidePoint | null>(null);
  // Ref mirror of backgroundActive so the foreground effect can bail out without
  // re-subscribing whenever the flag flips.
  const backgroundActiveRef = useRef(false);

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
    setPoints((prev) => [...prev, next]);
  }, [recording, location]);

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
    setPoints([]);
    setDistanceKm(0);
    setElapsedSec(0);
    setBackgroundActive(false);
    setBackgroundDenied(false);
    stopRideTracker().catch(() => {});
  }, []);

  return {
    recording,
    points,
    distanceKm,
    elapsedSec,
    backgroundActive,
    backgroundDenied,
    start,
    stop,
    reset,
  };
}
