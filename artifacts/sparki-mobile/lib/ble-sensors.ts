import { PermissionsAndroid, Platform } from "react-native";

// Native Bluetooth (BLE) sensor layer — reads REAL watts / heart rate / cadence
// from standard GATT profiles during a ride, without the browser limits of Web
// Bluetooth (which iPhone-Safari lacks entirely). Honesty contract:
// - Only kinds with a standard GATT profile connect live: wattagemeter (0x1818),
//   hartslagmeter (0x180D), cadans_snelheid (0x1816). Watches and electronic
//   derailleurs use proprietary protocols → registration-only, stated plainly.
// - When the native BLE module is missing (Expo Go / web) support is reported
//   honestly as unavailable with a plain-Dutch reason — never faked.
// - No reading is ever fabricated: values stay null until a real notification
//   arrives, and drop back to null on disconnect.

export type LiveSensorKind = "wattagemeter" | "hartslagmeter" | "cadans_snelheid";

export type SensorReading = {
  watts?: number;
  cadence?: number;
  heartRate?: number;
};

export type SensorHandle = {
  deviceName: string | null;
  // Echte batterijstand (0–100%) uit de standaard Battery Service (0x180F),
  // of null wanneer de sensor die dienst niet aanbiedt — nooit geschat.
  batteryPercent: number | null;
  // Eerlijkheid: true wanneer er een gekoppelde voorkeurssensor bestond maar
  // (na de zoek-graceperiode) een ANDERE sensor is verbonden — de UI meldt dat
  // dan expliciet, zodat nooit stil andermans meetwaarden als eigen doorgaan.
  usedFallback: boolean;
  stop: () => void;
};

export type BleSupport = { available: boolean; reason: string | null };

const SERVICE_BY_KIND: Record<LiveSensorKind, string> = {
  wattagemeter: "00001818-0000-1000-8000-00805f9b34fb",
  hartslagmeter: "0000180d-0000-1000-8000-00805f9b34fb",
  cadans_snelheid: "00001816-0000-1000-8000-00805f9b34fb",
};

const CHARACTERISTIC_BY_KIND: Record<LiveSensorKind, string> = {
  wattagemeter: "00002a63-0000-1000-8000-00805f9b34fb",
  hartslagmeter: "00002a37-0000-1000-8000-00805f9b34fb",
  cadans_snelheid: "00002a5b-0000-1000-8000-00805f9b34fb",
};

// Standard GATT Battery Service / Battery Level characteristic.
const BATTERY_SERVICE = "0000180f-0000-1000-8000-00805f9b34fb";
const BATTERY_CHAR = "00002a19-0000-1000-8000-00805f9b34fb";

// How long the scanner keeps looking for the preferred (previously paired)
// device before honestly settling for the first matching sensor it saw.
const PREFERRED_GRACE_MS = 4000;
const SCAN_TIMEOUT_MS = 15000;

// ---------- Native module (lazily, so Expo Go fails honestly, not fatally) ----

let manager: unknown | null = null;
let managerError: string | null = null;

function getManager(): { manager: any | null; reason: string | null } {
  if (manager) return { manager, reason: null };
  if (managerError) return { manager: null, reason: managerError };
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { BleManager } = require("react-native-ble-plx");
    manager = new BleManager();
    return { manager, reason: null };
  } catch {
    managerError =
      "Bluetooth-sensoren werken alleen in de volledige Sparki-app op je telefoon, niet in Expo Go.";
    return { manager: null, reason: managerError };
  }
}

export function bleSupport(): BleSupport {
  const { manager: m, reason } = getManager();
  return { available: !!m, reason };
}

// ---------- Permissions (Android 12+ needs runtime BLUETOOTH_SCAN/CONNECT) ----

async function ensurePermissions(): Promise<string | null> {
  if (Platform.OS !== "android") return null;
  try {
    const wanted = [
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ].filter((p) => !!p);
    const res = await PermissionsAndroid.requestMultiple(wanted);
    const denied = Object.entries(res).filter(
      ([, v]) => v !== PermissionsAndroid.RESULTS.GRANTED,
    );
    // Older Androids don't have the BLUETOOTH_* runtime permissions at all —
    // only fine-location matters there; requestMultiple simply grants absent ones.
    if (denied.length > 0 && denied.length === Object.keys(res).length) {
      return "Sta Bluetooth (Apparaten in de buurt) toe om sensoren te koppelen.";
    }
    return null;
  } catch {
    return null;
  }
}

// ---------- Base64 → bytes (BLE values arrive base64-encoded) ----------------

const B64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (B64.indexOf(clean[i]!) << 18) |
      (B64.indexOf(clean[i + 1] ?? "A") << 12) |
      ((B64.indexOf(clean[i + 2] ?? "A") & 63) << 6) |
      (B64.indexOf(clean[i + 3] ?? "A") & 63);
    out.push((n >> 16) & 255);
    if (clean[i + 2] && clean[i + 2] !== "=") out.push((n >> 8) & 255);
    if (clean[i + 3] && clean[i + 3] !== "=") out.push(n & 255);
  }
  return Uint8Array.from(out);
}

function u16le(b: Uint8Array, o: number): number {
  return b[o]! | (b[o + 1]! << 8);
}

// ---------- GATT parsing (same math as the web app's use-power-meter) --------

type CrankSample = { revs: number; time: number };

// Cycling Power Measurement (0x2A63): flags(16) + instantaneous power(int16),
// optional fields after; crank revolution data (flag bit 5) drives cadence.
function parsePower(b: Uint8Array): {
  watts: number | null;
  crank: CrankSample | null;
} {
  if (b.length < 4) return { watts: null, crank: null };
  const flags = u16le(b, 0);
  let watts = u16le(b, 2);
  if (watts >= 0x8000) watts -= 0x10000; // int16
  let offset = 4;
  if (flags & 0x0001) offset += 1; // Pedal Power Balance
  if (flags & 0x0004) offset += 2; // Accumulated Torque
  if (flags & 0x0010) offset += 6; // Wheel Revolution Data
  let crank: CrankSample | null = null;
  if (flags & 0x0020 && b.length >= offset + 4) {
    crank = { revs: u16le(b, offset), time: u16le(b, offset + 2) };
  }
  return { watts, crank };
}

// Heart Rate Measurement (0x2A37): flags(8); bit0 = HR is uint16 else uint8.
function parseHeartRate(b: Uint8Array): number | null {
  if (b.length < 2) return null;
  const flags = b[0]!;
  if (flags & 0x01) {
    if (b.length < 3) return null;
    return u16le(b, 1);
  }
  return b[1]!;
}

// CSC Measurement (0x2A5B): flags(8); bit0 wheel data (uint32+uint16), bit1
// crank data (uint16+uint16). Only crank data (cadence) is used — speed comes
// from real GPS, never from an unverified wheel circumference.
function parseCsc(b: Uint8Array): CrankSample | null {
  if (b.length < 1) return null;
  const flags = b[0]!;
  let offset = 1;
  if (flags & 0x01) offset += 6;
  if (flags & 0x02 && b.length >= offset + 4) {
    return { revs: u16le(b, offset), time: u16le(b, offset + 2) };
  }
  return null;
}

// Derive cadence (rpm) from consecutive crank samples. Both fields wrap at
// 65536; crank time is in 1/1024 s units. Returns undefined when no new
// conclusion can be drawn (so the previous value is kept, never fabricated).
function cadenceFromCrank(
  prev: CrankSample | null,
  next: CrankSample,
  lastMoveAt: { t: number },
  now: number,
): number | undefined {
  if (!prev) return undefined;
  const dRevs = (next.revs - prev.revs + 65536) % 65536;
  const dTime = (next.time - prev.time + 65536) % 65536;
  if (dTime > 0) {
    if (dRevs > 0) lastMoveAt.t = now;
    return Math.round((dRevs * 1024 * 60) / dTime);
  }
  if (now - lastMoveAt.t > 2500) return 0; // coasting
  return undefined;
}

// ---------- Connect + monitor -------------------------------------------------

export async function connectSensor(
  kind: LiveSensorKind,
  opts: {
    // Advertising name captured at an earlier pairing (garage `deviceName`) —
    // preferred during the scan so the rider's own sensor wins.
    preferredName?: string | null;
    onReading: (r: SensorReading) => void;
    onDisconnect: () => void;
  },
): Promise<SensorHandle> {
  const { manager: m, reason } = getManager();
  if (!m) throw new Error(reason ?? "Bluetooth niet beschikbaar.");

  const permErr = await ensurePermissions();
  if (permErr) throw new Error(permErr);

  const state = await m.state();
  if (state !== "PoweredOn") {
    throw new Error("Zet Bluetooth aan om je sensor te koppelen.");
  }

  const serviceUUID = SERVICE_BY_KIND[kind];
  const charUUID = CHARACTERISTIC_BY_KIND[kind];
  const preferred = (opts.preferredName ?? "").trim().toLowerCase();

  // Scan: prefer the previously paired device by name; after a grace period,
  // honestly take the first sensor that advertises the right service.
  const device: any = await new Promise((resolve, reject) => {
    let fallback: any = null;
    let done = false;
    const finish = (dev: any, err?: Error) => {
      if (done) return;
      done = true;
      try {
        m.stopDeviceScan();
      } catch {
        // ignore
      }
      clearTimeout(graceTimer);
      clearTimeout(scanTimer);
      if (err) reject(err);
      else resolve(dev);
    };
    const graceTimer = setTimeout(() => {
      if (fallback) finish(fallback);
    }, PREFERRED_GRACE_MS);
    const scanTimer = setTimeout(() => {
      if (fallback) finish(fallback);
      else
        finish(
          null,
          new Error(
            "Geen sensor gevonden. Zet de sensor aan (even trappen of bewegen) en probeer opnieuw.",
          ),
        );
    }, SCAN_TIMEOUT_MS);
    m.startDeviceScan([serviceUUID], null, (error: any, dev: any) => {
      if (error) {
        finish(null, new Error("Scannen naar sensoren mislukt."));
        return;
      }
      if (!dev) return;
      const name = String(dev.name ?? dev.localName ?? "").toLowerCase();
      if (preferred && name && name === preferred) {
        finish(dev);
        return;
      }
      if (!preferred) {
        finish(dev);
        return;
      }
      if (!fallback) fallback = dev;
    });
  });

  const connected = await device.connect({ timeout: 10000 });
  await connected.discoverAllServicesAndCharacteristics();

  // Batterijstand: één echte uitlezing van de standaard Battery Service. Niet
  // elke sensor biedt die aan — dan blijft hij eerlijk null (nooit geschat).
  let batteryPercent: number | null = null;
  try {
    const ch = await connected.readCharacteristicForService(
      BATTERY_SERVICE,
      BATTERY_CHAR,
    );
    if (ch?.value) {
      const bytes = base64ToBytes(String(ch.value));
      if (bytes.length >= 1 && bytes[0]! <= 100) batteryPercent = bytes[0]!;
    }
  } catch {
    // Geen batterijdienst op dit apparaat — eerlijk onbekend.
  }

  // Cadence state across notifications (power crank data or CSC crank data).
  let prevCrank: CrankSample | null = null;
  const lastMoveAt = { t: 0 };
  let stopped = false;

  const disconnectSub = m.onDeviceDisconnected(device.id, () => {
    if (!stopped) opts.onDisconnect();
  });

  const monitorSub = connected.monitorCharacteristicForService(
    serviceUUID,
    charUUID,
    (error: any, characteristic: any) => {
      if (error || !characteristic?.value) return;
      const bytes = base64ToBytes(String(characteristic.value));
      const now = Date.now();
      if (kind === "hartslagmeter") {
        const hr = parseHeartRate(bytes);
        if (hr != null) opts.onReading({ heartRate: hr });
        return;
      }
      if (kind === "wattagemeter") {
        const { watts, crank } = parsePower(bytes);
        const reading: SensorReading = {};
        if (watts != null) reading.watts = watts;
        if (crank) {
          const cad = cadenceFromCrank(prevCrank, crank, lastMoveAt, now);
          prevCrank = crank;
          if (cad !== undefined) reading.cadence = cad;
        }
        if (Object.keys(reading).length > 0) opts.onReading(reading);
        return;
      }
      const crank = parseCsc(bytes);
      if (crank) {
        const cad = cadenceFromCrank(prevCrank, crank, lastMoveAt, now);
        prevCrank = crank;
        if (cad !== undefined) opts.onReading({ cadence: cad });
      }
    },
  );

  const connectedName = device.name ?? device.localName ?? null;
  return {
    deviceName: connectedName,
    // Andere sensor dan de gekoppelde voorkeur? Dan expliciet melden.
    usedFallback:
      !!preferred && (connectedName ?? "").trim().toLowerCase() !== preferred,
    batteryPercent,
    stop: () => {
      stopped = true;
      try {
        monitorSub?.remove?.();
      } catch {
        // ignore
      }
      try {
        disconnectSub?.remove?.();
      } catch {
        // ignore
      }
      m.cancelDeviceConnection(device.id).catch(() => {});
    },
  };
}
