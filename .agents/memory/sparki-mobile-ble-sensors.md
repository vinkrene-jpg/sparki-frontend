---
name: Sparki mobile BLE sensors
description: Native Bluetooth sensor readout in the Expo app — platform split, Expo Go limitation, honesty contract
---

Live sensor readout (watts/HR/cadence) in the Expo app uses `react-native-ble-plx` behind a platform split: `lib/ble-sensors.ts` (native) + `lib/ble-sensors.web.ts` (honest stub). The native file `require()`s ble-plx inside a try/catch — in Expo Go the native module is missing, so `bleSupport()` reports `available:false` with a plain-Dutch reason ("werkt alleen in de volledige Sparki-app, niet in Expo Go") instead of crashing at import.

**Why:** ble-plx needs a development build (config plugin added in app.json: iOS `NSBluetoothAlwaysUsageDescription`, Android `BLUETOOTH_SCAN`/`BLUETOOTH_CONNECT` + runtime `PermissionsAndroid.requestMultiple` on API 31+). Expo Go can never load it, and static top-level import would break the whole screen.

**How to apply:**
- BLE characteristic values arrive **base64-encoded** strings; decode manually (own decoder — don't rely on `atob`).
- GATT parsing mirrors the web `use-power-meter`: power 0x1818/0x2A63 (flag-offset crank data → cadence, wrap at 65536, 1/1024 s units, coasting → 0 after 2.5 s), HR 0x180D/0x2A37 (flag bit0 = uint16), CSC 0x1816/0x2A5B (crank only — never derive speed from wheel revs, GPS is the speed source).
- Scan prefers the garage `deviceName` for ~4 s, then honestly takes the first device advertising the right service; honest timeout error at 15 s.
- Honesty: `horloge`/`derailleur` stay registration-only (backend `pairable` flag is the gate); values are null until a real notification and cleared on disconnect.
- UI: `hooks/useLiveSensors.ts` (one connection per live kind) + `components/LiveSensorsPanel.tsx`, surfaced via a bluetooth toggle on both `record.tsx` and `navigate/[id].tsx`; second metrics row only when connected.
