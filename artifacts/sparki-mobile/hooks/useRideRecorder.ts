import { useCallback, useEffect, useRef, useState } from "react";

import { haversineMeters, type LatLon } from "@/lib/geo";
import { setRideActive } from "@/lib/release";
import type { LiveLocation } from "@/hooks/useLiveLocation";
import {
  createRideFlowState,
  manualPause as flowManualPause,
  manualResume as flowManualResume,
  rideFlowTick,
  type PauseState,
  type RideFlowState,
} from "@/lib/ride-flow";
import {
  clearRecoverableRide,
  loadRecoverableRide,
  persistForegroundRide,
  persistRideSensorSamples,
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

// Een pauzevenster tijdens de rit. `end === null` betekent: nu gepauzeerd.
export type PauseInterval = { start: number; end: number | null };

// Een door de flow-engine voorgesteld rit-einde (waarschijnlijke autorit na de
// fietsrit). Alleen echte, gecombineerde signalen leiden hiertoe — zie
// `lib/ride-flow.ts`.
export type RideEndSuggestion = {
  confidence: "strong" | "weak";
  lastBikePointIndex: number;
  lastBikeTime: number;
  reasons: string[];
  suggestedAt: number;
};

export type RideRecording = {
  recording: boolean;
  points: RidePoint[];
  distanceKm: number;
  elapsedSec: number;
  // Bewegingstijd: verstreken tijd minus alle (auto/handmatige) pauzes.
  movingSec: number;
  // Pauzestatus van de rit (rijdend / automatisch / handmatig gepauzeerd).
  pauseState: PauseState;
  // Handmatig pauzeren; hervatten kan handmatig én gebeurt automatisch zodra
  // meerdere opeenvolgende metingen echt fietsen laten zien.
  pauseRide: () => void;
  resumeRide: () => void;
  // Actueel einde-voorstel van de flow-engine (autorit herkend), of null.
  endSuggestion: RideEndSuggestion | null;
  dismissEndSuggestion: () => void;
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
  // Real sensor readings that were persisted before the crash/kill. Empty when
  // the ride was ridden without sensors — never fabricated.
  sensorSamples: RideSensorSample[];
};

// Ignore GPS jitter while standing still: a new fix closer than this to the last
// recorded one is dropped, so a stationary rider doesn't inflate the distance.
const MIN_MOVE_METERS = 5;

// Rebuild the filtered track + real haversine distance from a raw fix list.
// Used for the background buffer, which is delivered as the full array on every
// update. Nothing is fabricated: only real fixes that moved far enough are kept.
function buildTrack(
  raw: RidePoint[],
  pauses: PauseInterval[] = [],
): { points: RidePoint[]; distanceKm: number } {
  const out: RidePoint[] = [];
  let distanceKm = 0;
  let last: RidePoint | null = null;
  for (const p of raw) {
    // Punten binnen een (auto/handmatig) pauzevenster tellen niet mee voor de
    // track of de afstand — de rit stond toen stil.
    if (
      pauses.some((w) => p.time >= w.start && (w.end == null || p.time <= w.end))
    ) {
      continue;
    }
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
  const [pauseState, setPauseState] = useState<PauseState>("riding");
  const [movingSec, setMovingSec] = useState(0);
  const [endSuggestion, setEndSuggestion] = useState<RideEndSuggestion | null>(
    null,
  );

  const startedAtRef = useRef<number | null>(null);
  const lastRef = useRef<RidePoint | null>(null);
  // Flow-engine (auto-pauze/hervatting + rit-einde-detectie) — puur, in
  // `lib/ride-flow.ts`, gevoed met 1 Hz echte metingen hieronder.
  const flowRef = useRef<RideFlowState>(createRideFlowState());
  const pausesRef = useRef<PauseInterval[]>([]);
  const pausedRef = useRef(false);
  const locRef = useRef<LiveLocation | null>(null);
  const flowPrevLocRef = useRef<LiveLocation | null>(null);
  // Ref-spiegel van points zodat de 1 Hz engine-tick geen re-subscribes vraagt.
  const pointsRef = useRef<RidePoint[]>([]);
  // Ref mirror of backgroundActive so the foreground effect can bail out without
  // re-subscribing whenever the flag flips.
  const backgroundActiveRef = useRef(false);
  // Real sensor readings logged this ride (ref: read at save time, no renders).
  const sensorSamplesRef = useRef<RideSensorSample[]>([]);

  // Spiegel de laatste locatie + points voor de 1 Hz flow-engine-tick.
  useEffect(() => {
    locRef.current = location;
  }, [location]);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  // Foreground path: append each new real fix from the prop. Skipped entirely
  // while the background tracker owns the track (avoids double-counting).
  useEffect(() => {
    if (!recording || backgroundActiveRef.current || !location) return;
    // Tijdens een (auto/handmatige) pauze worden geen punten of afstand
    // toegevoegd — de rit staat stil.
    if (pausedRef.current) return;
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
          sensorSamples: Array.isArray(ride.sensorSamples)
            ? ride.sensorSamples
            : [],
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
      const track = buildTrack(raw, pausesRef.current);
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
      // Mirror the sensor log into the persisted ride snapshot so a crash/kill
      // keeps the measured values, not just the GPS track. Writes are throttled
      // inside the tracker, so this is cheap to call every sample.
      persistRideSensorSamples(sensorSamplesRef.current);
    }, SENSOR_SAMPLE_MS);
    return () => clearInterval(id);
  }, [recording, getSensorValues]);

  // Wall-clock elapsed timer, independent of GPS fix cadence. Also derives the
  // real moving time: elapsed minus all pause windows.
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      if (startedAtRef.current != null) {
        const now = Date.now();
        setElapsedSec(Math.floor((now - startedAtRef.current) / 1000));
        const pausedMs = pausesRef.current.reduce(
          (sum, w) => sum + Math.max(0, (w.end ?? now) - w.start),
          0,
        );
        setMovingSec(
          Math.max(
            0,
            Math.floor((now - startedAtRef.current - pausedMs) / 1000),
          ),
        );
      }
    }, 1000);
    return () => clearInterval(id);
  }, [recording]);

  // 1 Hz flow-engine-tick: voedt de pure engine met echte metingen (GPS-
  // snelheid/verplaatsing, richting, cadans/vermogen) en verwerkt de events
  // (auto-pauze, auto-hervatting, rit-einde-suggestie). JS-timers pauzeren op
  // de achtergrond, dus dit werkt eerlijk alleen met het scherm aan.
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      const now = Date.now();
      const loc = locRef.current;
      const prev = flowPrevLocRef.current;
      flowPrevLocRef.current = loc;
      const movedM =
        loc && prev
          ? haversineMeters(
              { latitude: prev.latitude, longitude: prev.longitude },
              { latitude: loc.latitude, longitude: loc.longitude },
            )
          : 0;
      const sensors = getSensorValues ? getSensorValues() : null;
      const res = rideFlowTick(flowRef.current, {
        t: now,
        speedMps: loc?.speedMps ?? null,
        movedM,
        headingDeg: loc?.heading ?? null,
        cadence: sensors?.cadence ?? null,
        watts: sensors?.watts ?? null,
        distToFinishM: null,
        pointIndex: Math.max(0, pointsRef.current.length - 1),
      });
      flowRef.current = res.state;
      for (const ev of res.events) {
        if (ev.kind === "auto_pause") {
          pausesRef.current.push({ start: now, end: null });
          pausedRef.current = true;
          lastRef.current = null;
          setPauseState("auto_paused");
        } else if (ev.kind === "auto_resume") {
          const open = pausesRef.current[pausesRef.current.length - 1];
          if (open && open.end == null) open.end = now;
          pausedRef.current = false;
          setPauseState("riding");
        } else if (ev.kind === "end_suggested") {
          setEndSuggestion((cur) => {
            // Een sterke suggestie verdringt een zwakke; nooit andersom.
            if (cur && cur.confidence === "strong" && ev.confidence === "weak") {
              return cur;
            }
            return {
              confidence: ev.confidence,
              lastBikePointIndex: ev.lastBikePointIndex,
              lastBikeTime: ev.lastBikeTime,
              reasons: ev.reasons,
              suggestedAt: now,
            };
          });
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [recording, getSensorValues]);

  const pauseRide = useCallback(() => {
    if (pausedRef.current) return;
    const now = Date.now();
    flowRef.current = flowManualPause(flowRef.current);
    pausesRef.current.push({ start: now, end: null });
    pausedRef.current = true;
    lastRef.current = null;
    setPauseState("manual_paused");
  }, []);

  const resumeRide = useCallback(() => {
    if (!pausedRef.current) return;
    const now = Date.now();
    flowRef.current = flowManualResume(flowRef.current);
    const open = pausesRef.current[pausesRef.current.length - 1];
    if (open && open.end == null) open.end = now;
    pausedRef.current = false;
    setPauseState("riding");
  }, []);

  const dismissEndSuggestion = useCallback(() => {
    setEndSuggestion(null);
  }, []);

  const start = useCallback(() => {
    startedAtRef.current = Date.now();
    lastRef.current = null;
    backgroundActiveRef.current = false;
    sensorSamplesRef.current = [];
    flowRef.current = createRideFlowState();
    pausesRef.current = [];
    pausedRef.current = false;
    flowPrevLocRef.current = null;
    setPauseState("riding");
    setMovingSec(0);
    setEndSuggestion(null);
    // Starting a new ride supersedes any recovered one.
    setRecoverable(null);
    setPoints([]);
    setDistanceKm(0);
    setElapsedSec(0);
    setBackgroundActive(false);
    setBackgroundDenied(false);
    setRecording(true);
    // Golf 28: tijdens een actieve rit nooit een versieblokkade tonen.
    setRideActive(true);

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
    setRideActive(false);
    // Een nog open pauzevenster netjes afsluiten voor de eindstatistieken.
    const open = pausesRef.current[pausesRef.current.length - 1];
    if (open && open.end == null) open.end = Date.now();
    pausedRef.current = false;
    setPauseState("riding");
    stopRideTracker().catch(() => {});
  }, []);

  const reset = useCallback(() => {
    setRecording(false);
    setRideActive(false);
    startedAtRef.current = null;
    lastRef.current = null;
    backgroundActiveRef.current = false;
    sensorSamplesRef.current = [];
    flowRef.current = createRideFlowState();
    pausesRef.current = [];
    pausedRef.current = false;
    flowPrevLocRef.current = null;
    setPauseState("riding");
    setMovingSec(0);
    setEndSuggestion(null);
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
    movingSec,
    pauseState,
    pauseRide,
    resumeRide,
    endSuggestion,
    dismissEndSuggestion,
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
