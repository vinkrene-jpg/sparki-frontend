import { useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { ACCENT } from "@/components/sparki/ui"
import type { SessionStreams } from "@/lib/stream-analysis"
import { hasChannel } from "@/lib/stream-analysis"

// Kanaal-metadata: kleur, eenheid, plain-Dutch label.
const CHANNELS = {
  power: { label: "Vermogen", unit: "W", color: ACCENT },
  heartRate: { label: "Hartslag", unit: "bpm", color: "rgba(255,120,120,0.9)" },
  cadence: { label: "Cadans", unit: "opm", color: "rgba(190,160,255,0.9)" },
  speedKph: { label: "Snelheid", unit: "km/u", color: "rgba(120,220,160,0.9)" },
  temperatureC: { label: "Temperatuur", unit: "°C", color: "rgba(255,200,120,0.9)" },
} as const

export type StreamChannelKey = keyof typeof CHANNELS

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60)
  if (m >= 60) return `${Math.floor(m / 60)}u${String(m % 60).padStart(2, "0")}`
  return `${m} min`
}

/**
 * Lijn-grafiek over de echte ritstreams met kanaal-keuze, hoogteprofiel als
 * achtergrond, optionele blok-markering (intervallen) en een zoom-borstel.
 * Gaten in de data blijven gaten (connectNulls uit) — sensor-uitval is
 * zichtbaar, nooit weggeïnterpoleerd.
 */
export function StreamChart({
  streams,
  bands,
  height = 180,
}: {
  streams: SessionStreams
  /** Gemarkeerde blokken (bijv. gedetecteerde intervallen), in seconden. */
  bands?: Array<{ startSec: number; endSec: number }>
  height?: number
}) {
  const available = (Object.keys(CHANNELS) as StreamChannelKey[]).filter((k) =>
    hasChannel(streams, k),
  )
  const [active, setActive] = useState<StreamChannelKey | null>(
    available[0] ?? null,
  )
  const activeKey = active && available.includes(active) ? active : available[0]

  const data = useMemo(
    () =>
      streams.t.map((t, i) => ({
        t,
        power: streams.power?.[i] ?? null,
        heartRate: streams.heartRate?.[i] ?? null,
        cadence: streams.cadence?.[i] ?? null,
        speedKph: streams.speedKph?.[i] ?? null,
        temperatureC: streams.temperatureC?.[i] ?? null,
        elevationM: streams.elevationM?.[i] ?? null,
      })),
    [streams],
  )

  if (!activeKey) return null
  const ch = CHANNELS[activeKey]
  const hasElevation = hasChannel(streams, "elevationM")

  return (
    <div>
      {available.length > 1 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {available.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setActive(k)}
              className="rounded-full border px-2.5 py-0.5 text-[11px] transition-colors"
              style={
                k === activeKey
                  ? {
                      borderColor: CHANNELS[k].color,
                      color: CHANNELS[k].color,
                      background: "rgba(255,255,255,0.04)",
                    }
                  : {
                      borderColor: "rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.45)",
                    }
              }
            >
              {CHANNELS[k].label}
              {k === "speedKph" && streams.speedDerived ? " (afgeleid)" : ""}
            </button>
          ))}
        </div>
      )}

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="t"
              tickFormatter={fmtTime}
              tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
              stroke="rgba(255,255,255,0.1)"
              minTickGap={40}
            />
            <YAxis
              tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
              stroke="rgba(255,255,255,0.1)"
              width={46}
              domain={["auto", "auto"]}
              label={{ value: ch.unit, angle: -90, position: "insideLeft", offset: 10, fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
            />
            {hasElevation && (
              <YAxis yAxisId="ele" hide domain={["dataMin", "dataMax"]} />
            )}
            <Tooltip
              contentStyle={{
                background: "rgba(7,13,22,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                fontSize: 12,
              }}
              labelFormatter={(v) => `Na ${fmtTime(Number(v))}`}
              formatter={(value: number | string, name: string) => {
                if (name === "elevationM") return [`${value} m`, "Hoogte"]
                return [`${value} ${ch.unit}`, ch.label]
              }}
            />
            {bands?.map((b, i) => (
              <ReferenceArea
                key={i}
                x1={b.startSec}
                x2={b.endSec}
                fill="rgba(80,200,230,0.08)"
                stroke="rgba(80,200,230,0.25)"
              />
            ))}
            {hasElevation && (
              <Line
                yAxisId="ele"
                dataKey="elevationM"
                dot={false}
                stroke="rgba(255,255,255,0.14)"
                strokeWidth={1}
                connectNulls={false}
                isAnimationActive={false}
              />
            )}
            <Line
              dataKey={activeKey}
              dot={false}
              stroke={ch.color}
              strokeWidth={1.5}
              connectNulls={false}
              isAnimationActive={false}
            />
            {data.length > 60 && (
              <Brush
                dataKey="t"
                height={18}
                travellerWidth={8}
                stroke="rgba(255,255,255,0.25)"
                fill="rgba(255,255,255,0.03)"
                tickFormatter={fmtTime}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Klein los hoogteprofiel (vlak-grafiek) voor waar alleen hoogte relevant is. */
export function ElevationArea({
  streams,
  height = 90,
}: {
  streams: SessionStreams
  height?: number
}) {
  const data = useMemo(
    () =>
      streams.t.map((t, i) => ({ t, ele: streams.elevationM?.[i] ?? null })),
    [streams],
  )
  if (!hasChannel(streams, "elevationM")) return null
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 4, bottom: 0, left: -18 }}>
          <XAxis
            dataKey="t"
            tickFormatter={fmtTime}
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
            stroke="rgba(255,255,255,0.1)"
            minTickGap={40}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
            stroke="rgba(255,255,255,0.1)"
            width={46}
            label={{ value: "m", angle: -90, position: "insideLeft", offset: 10, fill: "rgba(255,255,255,0.35)", fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(7,13,22,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 10,
              fontSize: 12,
            }}
            labelFormatter={(v) => `Na ${fmtTime(Number(v))}`}
            formatter={(value: number | string) => [`${value} m`, "Hoogte"]}
          />
          <Area
            dataKey="ele"
            stroke="rgba(255,255,255,0.3)"
            fill="rgba(255,255,255,0.07)"
            connectNulls={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
