import { useState } from "react"
import { Link } from "wouter"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ACCENT, Stat, Divider } from "@/components/sparki/ui"
import { RouteMap } from "@/components/sparki/route-map"
import { useWorkoutRoutes, type SparkiRoute } from "@/hooks/use-routes"
import { ElevationProfile } from "@/components/sparki/elevation-profile"
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
        className="w-full overflow-y-auto border-l border-border bg-card p-0 backdrop-blur-xl sm:max-w-md"
      >
        {!route ? null : (
          <div className="flex flex-col gap-6 px-6 pb-16 pt-7">
            <SheetHeader className="space-y-2 text-left">
              <p className="font-mono text-[10px] tracking-[0.28em] text-muted-foreground">
                ROUTE · {route.source.toUpperCase()}
              </p>
              <SheetTitle className="text-balance font-sans text-2xl font-extralight leading-tight tracking-tight text-foreground">
                {route.name}
              </SheetTitle>
            </SheetHeader>

            {geometry.length > 1 && (
              <RouteMap geometry={geometry} climbs={climbs} />
            )}

            {profile.length > 0 && (
              <ElevationProfile
                profile={profile}
                distanceKm={route.distanceKm}
              />
            )}

            <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border pt-4">
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
                <span className="label-xs text-muted-foreground">KLIMMEN</span>
                <div className="mt-2 flex flex-col">
                  {climbs.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-baseline gap-3 border-b border-border py-2 last:border-0"
                    >
                      <div className="flex-1">
                        <span className="text-[13px] tracking-tight text-foreground/85">
                          {c.name}
                        </span>
                        {Number.isFinite(c.summitKm) && (
                          <span className="ml-2 font-mono text-[10px] tabular-nums text-muted-foreground">
                            top op {c.summitKm} km
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
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
              <p className="whitespace-pre-line text-[12px] leading-relaxed text-foreground/55">
                {route.rationale}
              </p>
            )}

            <div>
              <span className="label-xs text-muted-foreground">
                {nav.length > 0
                  ? `STAP-VOOR-STAP (${nav.length})`
                  : "NAVIGATIE"}
              </span>
              {nav.length > 0 ? (
                <div className="mt-2 flex flex-col">
                  {nav.map((n, i) => (
                    <div
                      key={i}
                      className="flex items-baseline gap-3 border-b border-border py-2.5 last:border-0"
                    >
                      <span className="w-12 shrink-0 font-mono text-[11px] tabular-nums text-accent-cyan">
                        {n.km}
                      </span>
                      <span className="w-24 shrink-0 break-words text-[13px] tracking-tight text-foreground/85">
                        {n.dir}
                      </span>
                      <span className="min-w-0 flex-1 break-words text-[12px] text-muted-foreground">
                        {n.note}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-muted-foreground">
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
      className="group block w-full overflow-hidden rounded-2xl border border-border bg-card text-left backdrop-blur-md transition-colors hover:border-accent-cyan/25"
    >
      {geometry.length > 1 && (
        <RouteMap
          geometry={geometry}
          height={132}
          interactive={false}
          className="rounded-none border-0 border-b border-border"
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
          <p className="truncate text-[14px] font-medium tracking-tight text-foreground/90">
            {route.name}
          </p>
          <div className="mt-0.5 flex items-center gap-3 font-mono text-[10px] tabular-nums text-muted-foreground">
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
          className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-accent-cyan"
          strokeWidth={1.75}
        />
      </div>
    </button>
  )
}

// LinkedRoutePreview — surfaces the route(s) saved against a planned workout on
// the training/home session view. Three honest states, driven by the workout
// status when provided:
//   1. Training nog te doen + route bewaard  → routekaart ("gaan we fietsen").
//   2. Training nog te doen + geen route     → "nog samen te stellen"-prompt.
//   3. Training gedaan/overgeslagen          → niets (de kaart reset).
// Without a status the old behaviour holds: render routes if any, else nothing.
export function LinkedRoutePreview({
  plannedWorkoutId,
  workoutStatus,
  className = "",
}: {
  plannedWorkoutId: number | null | undefined
  workoutStatus?: string | null
  className?: string
}) {
  const { data, isLoading } = useWorkoutRoutes(plannedWorkoutId)
  const [active, setActive] = useState<SparkiRoute | null>(null)
  const routes = data?.routes ?? []

  // Don't flash the "nog geen route"-prompt while the route fetch is running.
  if (isLoading) return null

  // After the ride (or a skipped session) the route card resets — the route
  // itself stays saved in the Routes chapter, but today's surface is clean.
  const isDone = workoutStatus === "completed" || workoutStatus === "skipped"
  if (isDone) return null

  const isPending = workoutStatus === "planned" || workoutStatus === "modified"

  if (routes.length === 0) {
    // New day, no route yet: say so plainly and offer the way to compose one.
    if (!isPending) return null
    return (
      <div className={className}>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-border bg-muted px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <MapIcon
              className="h-4 w-4 shrink-0 text-muted-foreground"
              strokeWidth={1.75}
            />
            <p className="truncate text-[12px] text-muted-foreground">
              Nog geen route voor deze training
            </p>
          </div>
          <Link
            href="/route"
            className="shrink-0 rounded-xl border border-accent-cyan/25 bg-accent-cyan/10 px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] text-accent-cyan transition-colors hover:border-accent-cyan/45"
          >
            STEL SAMEN
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="mb-2 flex items-center gap-2">
        <MapIcon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
        <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
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
