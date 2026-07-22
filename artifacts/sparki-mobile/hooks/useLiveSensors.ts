import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { customFetch } from "@workspace/api-client-react";

import {
  bleSupport,
  connectSensor,
  type LiveSensorKind,
  type SensorHandle,
} from "@/lib/ble-sensors";

// A sensor as registered in the Fietsengarage (GET /api/garage → sensors).
// `pairable` is derived by the backend from the kind: only power, heart rate
// and cadence/speed have a standard GATT profile. Watches and electronic
// derailleurs stay registration-only — that honesty contract is kept here.
export type GarageSensor = {
  id: number;
  bikeId: number | null;
  kind: string;
  brand: string | null;
  model: string | null;
  deviceName: string | null;
  batteryNote: string | null;
  pairable: boolean;
};

export type SensorConnState = {
  status: "idle" | "connecting" | "connected" | "reconnecting" | "error";
  deviceName: string | null;
  error: string | null;
  // Echte batterijstand (0–100%) uit de standaard Battery Service, of null
  // wanneer de sensor die niet aanbiedt — nooit geschat.
  batteryPercent: number | null;
};

export type LiveSensorValues = {
  watts: number | null;
  cadence: number | null;
  heartRate: number | null;
};

const IDLE: SensorConnState = {
  status: "idle",
  deviceName: null,
  error: null,
  batteryPercent: null,
};

// Automatisch herverbinden na een weggevallen verbinding: 3 pogingen met
// oplopende wachttijd. Daarna een eerlijke foutmelding met handmatige retry.
const RECONNECT_DELAYS_MS = [2000, 5000, 15000];

const LIVE_KINDS: readonly LiveSensorKind[] = [
  "wattagemeter",
  "hartslagmeter",
  "cadans_snelheid",
];

export function isLiveKind(kind: string): kind is LiveSensorKind {
  return (LIVE_KINDS as readonly string[]).includes(kind);
}

/** The registered sensors from the Fietsengarage — the same saved list the
 *  web app shows, so nothing is entered twice. */
export function useGarageSensors() {
  return useQuery({
    queryKey: ["garage-sensors"],
    queryFn: () =>
      customFetch<{ sensors: GarageSensor[] }>("/api/garage", {
        responseType: "json",
      }).then((r) => r.sensors ?? []),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Live sensor readouts over native Bluetooth during a ride. One connection per
 * live kind (power / heart rate / cadence). Values are real notifications from
 * the device — null until a reading arrives and cleared on disconnect, never
 * fabricated. On unsupported builds (browser, Expo Go without the native
 * module) `support.available` is false with a plain-Dutch reason.
 */
export function useLiveSensors() {
  const support = bleSupport();
  const [connections, setConnections] = useState<
    Record<LiveSensorKind, SensorConnState>
  >({
    wattagemeter: IDLE,
    hartslagmeter: IDLE,
    cadans_snelheid: IDLE,
  });
  const [values, setValues] = useState<LiveSensorValues>({
    watts: null,
    cadence: null,
    heartRate: null,
  });

  const handlesRef = useRef<Partial<Record<LiveSensorKind, SensorHandle>>>({});
  // Naam van het gekoppelde apparaat per soort, zodat automatisch herverbinden
  // dezelfde sensor terugzoekt. Timers + pogingteller voor de backoff.
  const preferredRef = useRef<Partial<Record<LiveSensorKind, string | null>>>({});
  const reconnectTimerRef = useRef<
    Partial<Record<LiveSensorKind, ReturnType<typeof setTimeout>>>
  >({});
  const reconnectAttemptRef = useRef<Partial<Record<LiveSensorKind, number>>>({});
  const unmountedRef = useRef(false);

  const clearReconnect = useCallback((kind: LiveSensorKind) => {
    const t = reconnectTimerRef.current[kind];
    if (t) clearTimeout(t);
    delete reconnectTimerRef.current[kind];
    reconnectAttemptRef.current[kind] = 0;
  }, []);

  const clearValuesFor = useCallback((kind: LiveSensorKind) => {
    setValues((v) => ({
      watts: kind === "wattagemeter" ? null : v.watts,
      heartRate: kind === "hartslagmeter" ? null : v.heartRate,
      // Cadence can come from either the power meter or a cadence sensor; it
      // is cleared when its own source drops (both sources clear it, honest
      // over clever — a stale rpm is worse than a dash).
      cadence:
        kind === "wattagemeter" || kind === "cadans_snelheid" ? null : v.cadence,
    }));
  }, []);

  const disconnect = useCallback(
    (kind: LiveSensorKind) => {
      clearReconnect(kind);
      handlesRef.current[kind]?.stop();
      delete handlesRef.current[kind];
      setConnections((c) => ({ ...c, [kind]: IDLE }));
      clearValuesFor(kind);
    },
    [clearValuesFor, clearReconnect],
  );

  // Eén verbindpoging. `isReconnect` bepaalt de getoonde status; bij een
  // weggevallen verbinding wordt automatisch (max 3x, oplopende wachttijd)
  // dezelfde sensor teruggezocht voordat een eerlijke fout blijft staan.
  const attemptConnect = useCallback(
    async (kind: LiveSensorKind, isReconnect: boolean) => {
      if (handlesRef.current[kind] || unmountedRef.current) return;
      const preferredName = preferredRef.current[kind] ?? null;
      setConnections((c) => ({
        ...c,
        [kind]: {
          status: isReconnect ? "reconnecting" : "connecting",
          deviceName: c[kind].deviceName,
          error: null,
          batteryPercent: null,
        },
      }));
      try {
        const handle = await connectSensor(kind, {
          preferredName,
          onReading: (r) => {
            setValues((v) => ({
              watts: r.watts !== undefined ? r.watts : v.watts,
              cadence: r.cadence !== undefined ? r.cadence : v.cadence,
              heartRate: r.heartRate !== undefined ? r.heartRate : v.heartRate,
            }));
          },
          onDisconnect: () => {
            delete handlesRef.current[kind];
            clearValuesFor(kind);
            if (unmountedRef.current) return;
            const attempt = (reconnectAttemptRef.current[kind] ?? 0) + 1;
            if (attempt <= RECONNECT_DELAYS_MS.length) {
              reconnectAttemptRef.current[kind] = attempt;
              setConnections((c) => ({
                ...c,
                [kind]: {
                  status: "reconnecting",
                  deviceName: c[kind].deviceName,
                  error: null,
                  batteryPercent: null,
                },
              }));
              reconnectTimerRef.current[kind] = setTimeout(() => {
                delete reconnectTimerRef.current[kind];
                void attemptConnect(kind, true);
              }, RECONNECT_DELAYS_MS[attempt - 1]);
            } else {
              reconnectAttemptRef.current[kind] = 0;
              setConnections((c) => ({
                ...c,
                [kind]: {
                  status: "error",
                  deviceName: null,
                  error:
                    "Verbinding met de sensor is weggevallen en herverbinden is niet gelukt. Controleer de sensor en probeer opnieuw.",
                  batteryPercent: null,
                },
              }));
            }
          },
        });
        // Herverbonden of eerste keer verbonden: pogingteller terug naar nul.
        reconnectAttemptRef.current[kind] = 0;
        handlesRef.current[kind] = handle;
        // Bewaar de echte apparaatnaam zodat een volgende herverbinding
        // dezelfde sensor terugzoekt.
        if (handle.deviceName) preferredRef.current[kind] = handle.deviceName;
        setConnections((c) => ({
          ...c,
          [kind]: {
            status: "connected",
            deviceName: handle.deviceName,
            error: null,
            batteryPercent: handle.batteryPercent,
          },
        }));
      } catch (err) {
        if (unmountedRef.current) return;
        const attempt = reconnectAttemptRef.current[kind] ?? 0;
        if (isReconnect && attempt < RECONNECT_DELAYS_MS.length) {
          // Herverbindpoging mislukt: volgende poging met langere wachttijd.
          reconnectAttemptRef.current[kind] = attempt + 1;
          reconnectTimerRef.current[kind] = setTimeout(() => {
            delete reconnectTimerRef.current[kind];
            void attemptConnect(kind, true);
          }, RECONNECT_DELAYS_MS[attempt]);
          return;
        }
        reconnectAttemptRef.current[kind] = 0;
        setConnections((c) => ({
          ...c,
          [kind]: {
            status: "error",
            deviceName: null,
            error:
              err instanceof Error && err.message
                ? err.message
                : "Kon geen verbinding maken met de sensor.",
            batteryPercent: null,
          },
        }));
      }
    },
    [clearValuesFor],
  );

  const connect = useCallback(
    async (kind: LiveSensorKind, preferredName?: string | null) => {
      if (handlesRef.current[kind]) return;
      clearReconnect(kind);
      preferredRef.current[kind] = preferredName ?? null;
      await attemptConnect(kind, false);
    },
    [attemptConnect, clearReconnect],
  );

  const disconnectAll = useCallback(() => {
    for (const kind of LIVE_KINDS) {
      clearReconnect(kind);
      handlesRef.current[kind]?.stop();
      delete handlesRef.current[kind];
    }
    setConnections({
      wattagemeter: IDLE,
      hartslagmeter: IDLE,
      cadans_snelheid: IDLE,
    });
    setValues({ watts: null, cadence: null, heartRate: null });
  }, []);

  // Drop all connections when the screen unmounts — no orphaned radios and
  // no reconnect timers that keep scanning after the rider left the screen.
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      for (const kind of LIVE_KINDS) {
        const t = reconnectTimerRef.current[kind];
        if (t) clearTimeout(t);
        delete reconnectTimerRef.current[kind];
        handlesRef.current[kind]?.stop();
        delete handlesRef.current[kind];
      }
    };
  }, []);

  const anyConnected = LIVE_KINDS.some(
    (k) => connections[k].status === "connected",
  );

  return {
    support,
    connections,
    values,
    anyConnected,
    connect,
    disconnect,
    disconnectAll,
  };
}
