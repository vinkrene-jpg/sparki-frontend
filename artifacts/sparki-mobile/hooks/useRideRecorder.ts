import { useCallback, useEffect, useRef, useState } from "react";

import { haversineMeters, type LatLon } from "@/lib/geo";
import type { LiveLocation } from "@/hooks/useLiveLocation";

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
  start: () => void;
  stop: () => void;
  reset: () => void;
};

// Ignore GPS jitter while standing still: a new fix closer than this to the last
// recorded one is dropped, so a stationary rider doesn't inflate the distance.
const MIN_MOVE_METERS = 5;

/**
 * Records a live ride by accumulating the real GPS fixes emitted by
 * `useLiveLocation` while recording is active. Nothing is fabricated: when the
 * device emits no location (permission denied / no signal) no points are added,
 * so an empty or too-short track is honestly empty and cannot be saved.
 *
 * The elapsed timer runs off the wall clock from `start()` so it keeps counting
 * even between GPS fixes; distance is real haversine over the recorded track.
 */
export function useRideRecorder(location: LiveLocation | null): RideRecording {
  const [recording, setRecording] = useState(false);
  const [points, setPoints] = useState<RidePoint[]>([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);

  const startedAtRef = useRef<number | null>(null);
  const lastRef = useRef<RidePoint | null>(null);

  // Append each new real fix to the track while recording, skipping fixes that
  // haven't moved far enough to be a genuine displacement.
  useEffect(() => {
    if (!recording || !location) return;
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
    setPoints([]);
    setDistanceKm(0);
    setElapsedSec(0);
    setRecording(true);
  }, []);

  const stop = useCallback(() => setRecording(false), []);

  const reset = useCallback(() => {
    setRecording(false);
    startedAtRef.current = null;
    lastRef.current = null;
    setPoints([]);
    setDistanceKm(0);
    setElapsedSec(0);
  }, []);

  return { recording, points, distanceKm, elapsedSec, start, stop, reset };
}
