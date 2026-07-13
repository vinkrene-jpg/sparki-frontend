import { MapPin, Thermometer, Wind, Droplets, CloudSnow } from "lucide-react"
import type { WeatherSummary, WeatherAdvisory } from "@/lib/weather-types"

// Compact home-weather row for the Vandaag state surface (Fase 2 "De
// aandachtswet", §5.2 #3). Weather only rides along where it is a real decision
// factor — right before a planned training or on race day — so the caller gates
// on both `weatherAllowed(moment)` AND a truly-resolved forecast, then passes the
// already-available summary here. This component never fabricates: it renders
// only the real fields that are present.
export function HomeWeatherRow({
  summary,
  locationLabel,
  advisory,
}: {
  summary: WeatherSummary
  locationLabel: string | null
  advisory: WeatherAdvisory | null
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
      <div className="flex items-center gap-1.5 text-white/45">
        <MapPin className="h-3 w-3" strokeWidth={1.75} />
        <span className="font-mono text-[10px] uppercase tracking-[0.15em]">
          Weer vandaag{locationLabel ? ` — ${locationLabel}` : ""}
        </span>
      </div>
      <p className="mt-2 text-[14px] font-medium tracking-tight text-white/90">
        {summary.label}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[12px] tabular-nums text-white/65">
        {(summary.tempMinC != null || summary.tempMaxC != null) && (
          <span className="flex items-center gap-1.5">
            <Thermometer className="h-3 w-3" strokeWidth={1.75} />
            {summary.tempMinC != null && summary.tempMaxC != null
              ? `${Math.round(summary.tempMinC)}–${Math.round(summary.tempMaxC)}°C`
              : `${Math.round((summary.tempMaxC ?? summary.tempMinC)!)}°C`}
          </span>
        )}
        {summary.windMaxKmh != null && summary.windMaxKmh >= 15 && (
          <span className="flex items-center gap-1.5">
            <Wind className="h-3 w-3" strokeWidth={1.75} />
            {Math.round(summary.windMaxKmh)} km/u
          </span>
        )}
        {summary.snowfallCm != null && summary.snowfallCm > 0 ? (
          <span className="flex items-center gap-1.5">
            <CloudSnow className="h-3 w-3" strokeWidth={1.75} />
            {summary.snowfallCm.toFixed(1)} cm
          </span>
        ) : (
          summary.precipMm != null &&
          summary.precipMm >= 1 && (
            <span className="flex items-center gap-1.5">
              <Droplets className="h-3 w-3" strokeWidth={1.75} />
              {Math.round(summary.precipMm)} mm
            </span>
          )
        )}
        {summary.precipProbMaxPct != null && summary.precipProbMaxPct >= 30 && (
          <span className="flex items-center gap-1.5">
            <Droplets className="h-3 w-3" strokeWidth={1.75} />
            {summary.precipProbMaxPct}% kans
          </span>
        )}
      </div>
      {advisory && advisory.severity !== "ok" && (
        <p className="mt-2.5 text-pretty text-[12px] leading-relaxed text-amber-200/75">
          {advisory.headline} — {advisory.detail}
        </p>
      )}
    </div>
  )
}
