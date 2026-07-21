import { useCallback, useEffect, useRef, useState } from "react"

// Web Bluetooth power meter — reads REAL watts from a Cycling Power Service
// (GATT 0x1818) power meter, so a sprint's watt-bonus is based on actual power,
// never a fabricated number. When Web Bluetooth is unavailable (notably iOS
// Safari) the hook reports supported:false and the app falls back to speed-only
// scoring, stated plainly to the rider.

const CYCLING_POWER_SERVICE = 0x1818
const CYCLING_POWER_MEASUREMENT = 0x2a63

type PowerState = {
  supported: boolean
  connected: boolean
  deviceName: string | null
  // Most recent instantaneous power (W), null until a reading arrives.
  watts: number | null
  // Most recent crank cadence (rpm), null until a crank reading arrives. Only
  // power meters that report crank-revolution data expose this — many do not,
  // so it stays null rather than being fabricated.
  cadence: number | null
  error: string | null
}

// Parse the Cycling Power Measurement characteristic (0x2A63). Byte 0-1 are the
// flags, bytes 2-3 the instantaneous power. Crank-revolution data (used for
// cadence) is optional and sits after the other optional fields, so its offset
// depends on which flags are set. Returns the watts plus, when present, the
// cumulative crank revolutions and last crank event time (1/1024 s units).
function parseMeasurement(dv: DataView): {
  watts: number | null
  crankRevs: number | null
  crankTime: number | null
} {
  if (dv.byteLength < 4) return { watts: null, crankRevs: null, crankTime: null }
  const flags = dv.getUint16(0, true)
  const watts = dv.getInt16(2, true)
  let offset = 4
  if (flags & 0x0001) offset += 1 // Pedal Power Balance (uint8)
  if (flags & 0x0004) offset += 2 // Accumulated Torque (uint16)
  if (flags & 0x0010) offset += 6 // Wheel Revolution Data (uint32 + uint16)
  let crankRevs: number | null = null
  let crankTime: number | null = null
  if (flags & 0x0020 && dv.byteLength >= offset + 4) {
    crankRevs = dv.getUint16(offset, true)
    crankTime = dv.getUint16(offset + 2, true)
  }
  return { watts, crankRevs, crankTime }
}

export function usePowerMeter() {
  const supported =
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { bluetooth?: unknown }).bluetooth !==
      "undefined"

  const [state, setState] = useState<PowerState>({
    supported,
    connected: false,
    deviceName: null,
    watts: null,
    cadence: null,
    error: null,
  })

  const deviceRef = useRef<any>(null)
  const charRef = useRef<any>(null)
  // Rolling window of {t, watts} so a 5-second peak can be computed by callers.
  const historyRef = useRef<{ t: number; w: number }[]>([])
  // Previous crank sample (cumulative revolutions + last event time in 1/1024 s)
  // and when we last saw the crank actually turn — for cadence + coasting.
  const crankRef = useRef<{ revs: number; time: number } | null>(null)
  const lastCrankMoveRef = useRef<number>(0)

  const onValue = useCallback((e: Event) => {
    const target = e.target as any
    const dv = target.value
    if (!dv) return
    const { watts, crankRevs, crankTime } = parseMeasurement(dv)
    const now = Date.now()
    if (watts !== null) {
      const hist = historyRef.current
      hist.push({ t: now, w: watts })
      while (hist.length && now - hist[0]!.t > 30000) hist.shift()
    }

    // Derive cadence (rpm) from the change in crank revolutions over the change
    // in crank event time (units of 1/1024 s), both of which wrap at 65536.
    let cadence: number | null | undefined
    if (crankRevs !== null && crankTime !== null) {
      const prev = crankRef.current
      if (prev) {
        const dRevs = (crankRevs - prev.revs + 65536) % 65536
        const dTime = (crankTime - prev.time + 65536) % 65536
        if (dTime > 0) {
          cadence = Math.round((dRevs * 1024 * 60) / dTime)
          if (dRevs > 0) lastCrankMoveRef.current = now
        } else if (now - lastCrankMoveRef.current > 2500) {
          // No new crank event for a while → the rider is coasting.
          cadence = 0
        }
      }
      crankRef.current = { revs: crankRevs, time: crankTime }
    }

    setState((s) => ({
      ...s,
      watts: watts !== null ? watts : s.watts,
      cadence: cadence === undefined ? s.cadence : cadence,
    }))
  }, [])

  const connect = useCallback(async () => {
    if (!supported) {
      setState((s) => ({
        ...s,
        error: "Deze telefoon of browser ondersteunt geen Bluetooth-koppeling.",
      }))
      return
    }
    try {
      const bt = (navigator as Navigator & { bluetooth: any }).bluetooth
      const device = await bt.requestDevice({
        filters: [{ services: [CYCLING_POWER_SERVICE] }],
      })
      deviceRef.current = device
      const server = await device.gatt?.connect()
      if (!server) throw new Error("no-gatt")
      const service = await server.getPrimaryService(CYCLING_POWER_SERVICE)
      const char = await service.getCharacteristic(CYCLING_POWER_MEASUREMENT)
      charRef.current = char
      await char.startNotifications()
      char.addEventListener("characteristicvaluechanged", onValue)
      device.addEventListener("gattserverdisconnected", () => {
        // An unexpected drop must clear live metrics + the crank baseline, so we
        // never show stale watts/cadence or compute a bogus first cadence on
        // reconnect against an old crank sample.
        crankRef.current = null
        setState((s) => ({
          ...s,
          connected: false,
          watts: null,
          cadence: null,
        }))
      })
      setState((s) => ({
        ...s,
        connected: true,
        deviceName: device.name ?? "Vermogensmeter",
        error: null,
      }))
    } catch (err) {
      // User cancelling the chooser is not an error worth shouting about.
      const name = (err as { name?: string })?.name
      if (name === "NotFoundError") {
        setState((s) => ({ ...s, error: null }))
        return
      }
      setState((s) => ({
        ...s,
        connected: false,
        error: "Kon geen verbinding maken met de vermogensmeter.",
      }))
    }
  }, [supported, onValue])

  const disconnect = useCallback(() => {
    try {
      charRef.current?.removeEventListener("characteristicvaluechanged", onValue)
      deviceRef.current?.gatt?.disconnect()
    } catch {
      // ignore
    }
    charRef.current = null
    deviceRef.current = null
    crankRef.current = null
    setState((s) => ({ ...s, connected: false, watts: null, cadence: null }))
  }, [onValue])

  // Peak average power over the last `seconds` window (W), or null when no real
  // readings landed in that window.
  const peakWatts = useCallback((seconds: number): number | null => {
    const now = Date.now()
    const cutoff = now - seconds * 1000
    const inWindow = historyRef.current.filter((p) => p.t >= cutoff)
    if (inWindow.length === 0) return null
    let peak = 0
    for (const p of inWindow) if (p.w > peak) peak = p.w
    return peak
  }, [])

  useEffect(() => () => disconnect(), [disconnect])

  return { ...state, connect, disconnect, peakWatts }
}
