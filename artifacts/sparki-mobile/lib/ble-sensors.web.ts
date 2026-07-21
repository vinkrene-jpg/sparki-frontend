// Web build of the BLE sensor layer. Native Bluetooth does not exist in the
// browser bundle of this app, so support is reported honestly as unavailable —
// the rider is pointed to the phone app. Nothing is faked.

export type LiveSensorKind = "wattagemeter" | "hartslagmeter" | "cadans_snelheid";

export type SensorReading = {
  watts?: number;
  cadence?: number;
  heartRate?: number;
};

export type SensorHandle = {
  deviceName: string | null;
  stop: () => void;
};

export type BleSupport = { available: boolean; reason: string | null };

export function bleSupport(): BleSupport {
  return {
    available: false,
    reason:
      "Sensoren live uitlezen werkt in de Sparki-app op je telefoon, niet in de browser.",
  };
}

export async function connectSensor(
  _kind: LiveSensorKind,
  _opts: {
    preferredName?: string | null;
    onReading: (r: SensorReading) => void;
    onDisconnect: () => void;
  },
): Promise<SensorHandle> {
  throw new Error(
    "Sensoren live uitlezen werkt in de Sparki-app op je telefoon, niet in de browser.",
  );
}
