import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ACCENT, Stat, Divider } from "@/components/sparki/ui"
import { RouteMap } from "@/components/sparki/route-map"
import { useWorkoutRoutes, type SparkiRoute } from "@/hooks/use-routes"
import { Map as MapIcon, ChevronRight, Mountain, Clock } from "lucide-react"

const SURFACE_LABEL: Record<string, string> = {
  asfalt: "Asfalt",
  gravel: "Gravel",
  mtb: "MTB",
  mixed: "Gemengd",
  pad: "Pad/trail",
  unknown: "Onbekend",
}

// Estimated moving time → compact "1u 23m" / "45m" label.
function formatDuration(sec: number | null): string {
  if (sec == null) return "—"
  const total = Math.round(sec / 60)
  const h = Math.floor(total / 60)
  const m = total % 60
  return h > 0 ? `${h}u ${m}m` : `${m}m`
}

function ElevationProfile({ profile }: { profile: number[] }) {
  if (profile.length === 0) return null
  const max = Math.max(...profile)
  const min = Math.min(...profile)
  const span = Math.max(1, max - min)
  return (
    <div className="mt-4 flex h-16 items-end gap-px">
      {profile.map((p, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-[1px]"
          style={{
            height: `${((p - min) / span) * 90 + 10}%`,
            background:
              "linear-gradient(180deg, rgba(120,210,230,0.55), rgba(120,210,230,0.08))",
          }}
        />
      ))}
    </div>
  )
}

// Full route detail in a right-side drawer: real map, elevation profile, climbs,
// rationale and turn-by-turn navigation. All data comes from the saved route —
// nothing is fabricated; nav stays absent when the provider didn't return it.
export function RouteDetailDrawer({
  route,
  open,
  onOpenChange,
}: {
  route: SparkiRoute | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const profile = route?.profile ?? []
  const climbs = route?.climbs ?? []
  const nav = route?.nav ?? []
  const geometry = route?.geometry ?? []

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-l border-white/[0.08] bg-[#05070e]/95 p-0 backdrop-blur-xl sm:max-w-md"
      >
        {!route ? null : (
          <div className="flex flex-col gap-6 px-6 pb-16 pt-7">
            <SheetHeader className="space-y-2 text-left">
              <p className="font-mono text-[10px] tracking-[0.28em] text-white/35">
                ROUTE · {route.source.toUpperCase()}
              </p>
              <SheetTitle className="text-balance font-sans text-2xl font-extralight leading-tight tracking-tight text-white">
                {route.name}
              </SheetTitle>
            </SheetHeader>

            {geometry.length > 1 && (
              <RouteMap geometry={geometry} climbs={climbs} />
            )}

            {profile.length > 0 && <ElevationProfile profile={profile} />}

            <div className="flex items-center gap-5 border-t border-white/[0.07] pt-4">
              <Stat
                label="Afstand"
                value={route.distanceKm != null ? `${route.distanceKm} km` : "—"}
              />
              <Divider />
              <Stat label="Duur" value={formatDuration(route.durationSec)} />
              <Divider />
              <Stat
                label="Hoogtemeters"
                value={
                  route.elevationGainM != null ? `${route.elevationGainM} m` : "—"
                }
              />
              <Divider />
              <Stat
                label="Ondergrond"
                value={SURFACE_LABEL[route.surface] ?? route.surface}
              />
            </div>

            {climbs.length > 0 && (
              <div>
                <span className="label-xs text-white/35">KLIMMEN</span>
                <div className="mt-2 flex flex-col">
                  {climbs.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-baseline gap-3 border-b border-white/[0.05] py-2 last:border-0"
                    >
                      <div className="flex-1">
                        <span className="text-[13px] tracking-tight text-white/85">
                          {c.name}
                        </span>
                        {Number.isFinite(c.summitKm) && (
                          <span className="ml-2 font-mono text-[10px] tabular-nums text-white/35">
                            top op {c.summitKm} km
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] tabular-nums text-white/45">
                        {c.lengthKm} km
                      </span>
                      <span
                        className="font-mono text-[11px] tabular-nums"
                        style={{ color: ACCENT }}
                      >
                        {c.avgGradePct}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {route.rationale && (
              <p className="whitespace-pre-line text-[12px] leading-relaxed text-white/55">
                {route.rationale}
              </p>
            )}

            <div>
              <span className="label-xs text-white/35">
                {nav.length > 0
                  ? `STAP-VOOR-STAP (${nav.length})`
                  : "NAVIGATIE"}
              </span>
              {nav.length > 0 ? (
                <div className="mt-2 flex flex-col">
                  {nav.map((n, i) => (
                    <div
                      key={i}
                      className="flex items-baseline gap-3 border-b border-white/[0.05] py-2.5 last:border-0"
                    >
                      <span className="w-12 shrink-0 font-mono text-[11px] tabular-nums text-cyan-300/70">
                        {n.km}
                      </span>
                      <span className="w-24 shrink-0 text-[13px] tracking-tight text-white/85">
                        {n.dir}
                      </span>
                      <span className="flex-1 text-[12px] text-white/40">
                        {n.note}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-white/30">
                  Stap-voor-stap navigatie nog niet beschikbaar voor deze route
                </p>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function RoutePreviewCard({
  route,
  onOpen,
}: {
  route: SparkiRoute
  onOpen: () => void
}) {
  const geometry = route.geometry ?? []
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group block w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] text-left backdrop-blur-md transition-colors hover:border-cyan-300/25"
    >
      {geometry.length > 1 && (
        <RouteMap
          geometry={geometry}
          height={132}
          interactive={false}
          className="rounded-none border-0 border-b border-white/[0.07]"
        />
      )}
      <div className="flex items-center gap-3 p-4">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
          style={{
            borderColor: "rgba(120,210,230,0.25)",
            background: "rgba(120,210,230,0.08)",
          }}
        >
          <MapIcon className="h-4 w-4" style={{ color: ACCENT }} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium tracking-tight text-white/90">
            {route.name}
          </p>
          <div className="mt-0.5 flex items-center gap-3 font-mono text-[10px] tabular-nums text-white/45">
            <span>{route.distanceKm != null ? `${route.distanceKm} km` : "—"}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" strokeWidth={1.75} />
              {formatDuration(route.durationSec)}
            </span>
            {route.elevationGainM != null && (
              <span className="flex items-center gap-1">
                <Mountain className="h-3 w-3" strokeWidth={1.75} />
                {route.elevationGainM} m
              </span>
            )}
          </div>
        </div>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-white/30 transition-colors group-hover:text-cyan-300/60"
          strokeWidth={1.75}
        />
      </div>
    </button>
  )
}

// LinkedRoutePreview — surfaces the route(s) saved against a planned workout on
// the training/home session view. Compact map + distance/duration cards that
// open the full route detail (map + turn-by-turn nav) on tap. Renders nothing
// when no route is attached, so it's safe to drop into any workout card.
export function LinkedRoutePreview({
  plannedWorkoutId,
  className = "",
}: {
  plannedWorkoutId: number | null | undefined
  className?: string
}) {
  const { data } = useWorkoutRoutes(plannedWorkoutId)
  const [active, setActive] = useState<SparkiRoute | null>(null)
  const routes = data?.routes ?? []

  if (routes.length === 0) return null

  return (
    <div className={className}>
      <div className="mb-2 flex items-center gap-2">
        <MapIcon className="h-3.5 w-3.5 text-white/40" strokeWidth={1.75} />
        <span className="font-mono text-[10px] tracking-[0.2em] text-white/45">
          {routes.length > 1 ? `ROUTES (${routes.length})` : "JOUW ROUTE"}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {routes.map((route) => (
          <RoutePreviewCard
            key={route.id}
            route={route}
            onOpen={() => setActive(route)}
          />
        ))}
      </div>
      <RouteDetailDrawer
        route={active}
        open={active != null}
        onOpenChange={(open) => {
          if (!open) setActive(null)
        }}
      />
    </div>
  )
}
