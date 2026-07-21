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
  status: "idle" | "connecting" | "connected" | "error";
  deviceName: string | null;
  error: string | null;
};

export type LiveSensorValues = {
  watts: number | null;
  cadence: number | null;
  heartRate: number | null;
};

const IDLE: SensorConnState = { status: "idle", deviceName: null, error: null };

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
      handlesRef.current[kind]?.stop();
      delete handlesRef.current[kind];
      setConnections((c) => ({ ...c, [kind]: IDLE }));
      clearValuesFor(kind);
    },
    [clearValuesFor],
  );

  const connect = useCallback(
    async (kind: LiveSensorKind, preferredName?: string | null) => {
      if (handlesRef.current[kind]) return;
      setConnections((c) => ({
        ...c,
        [kind]: { status: "connecting", deviceName: null, error: null },
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
            setConnections((c) => ({
              ...c,
              [kind]: {
                status: "error",
                deviceName: null,
                error: "Verbinding met de sensor is weggevallen.",
              },
            }));
            clearValuesFor(kind);
          },
        });
        handlesRef.current[kind] = handle;
        setConnections((c) => ({
          ...c,
          [kind]: {
            status: "connected",
            deviceName: handle.deviceName,
            error: null,
          },
        }));
      } catch (err) {
        setConnections((c) => ({
          ...c,
          [kind]: {
            status: "error",
            deviceName: null,
            error:
              err instanceof Error && err.message
                ? err.message
                : "Kon geen verbinding maken met de sensor.",
          },
        }));
      }
    },
    [clearValuesFor],
  );

  const disconnectAll = useCallback(() => {
    for (const kind of LIVE_KINDS) {
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

  // Drop all connections when the screen unmounts — no orphaned radios.
  useEffect(() => {
    return () => {
      for (const kind of LIVE_KINDS) {
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
