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
  error: string | null
}

// Parse instantaneous power (int16, little-endian) from the Cycling Power
// Measurement characteristic. The first 2 bytes are flags; watts follow.
function parseInstantaneousPower(dv: DataView): number | null {
  if (dv.byteLength < 4) return null
  return dv.getInt16(2, true)
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
    error: null,
  })

  const deviceRef = useRef<any>(null)
  const charRef = useRef<any>(null)
  // Rolling window of {t, watts} so a 5-second peak can be computed by callers.
  const historyRef = useRef<{ t: number; w: number }[]>([])

  const onValue = useCallback((e: Event) => {
    const target = e.target as any
    const dv = target.value
    if (!dv) return
    const w = parseInstantaneousPower(dv)
    if (w === null) return
    const now = Date.now()
    const hist = historyRef.current
    hist.push({ t: now, w })
    while (hist.length && now - hist[0]!.t > 30000) hist.shift()
    setState((s) => ({ ...s, watts: w }))
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
        setState((s) => ({ ...s, connected: false }))
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
    setState((s) => ({ ...s, connected: false, watts: null }))
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
