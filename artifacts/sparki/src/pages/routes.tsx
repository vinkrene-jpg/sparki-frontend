import { Link } from "wouter"
import { Flag, ChevronRight } from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { RoutePanel } from "@/components/sparki/route-panel"
import { useFeatureFlag } from "@/hooks/use-feature-flag"

// Hoofdstuk Routes — bundelt routes, GPX en kaart. De routeplanner is
// flag-gated; als hij nog niet aanstaat, tonen we dat eerlijk in plaats van een
// leeg scherm. Bordjes-sprinten is hier ook bereikbaar.
export default function RoutesPage() {
  const routePlannerEnabled = useFeatureFlag("route_planner")

  return (
    <ScreenShell section="routes">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Routes
        </h1>
        <p className="text-sm text-white/55">
          Plan je route, importeer een GPX en bekijk hem op de kaart.
        </p>
      </div>

      <section className="mt-8">
        {routePlannerEnabled ? (
          <>
            <SectionLabel title="Routeplanner" />
            <div className="mt-4">
              <RoutePanel />
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-white/[0.06] bg-[#070d16]/[0.55] p-4 backdrop-blur-md">
            <p className="text-[14px] font-medium text-white/70">
              Routeplanner nog niet beschikbaar
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-white/40">
              De routeplanner staat voor jouw account nog niet aan. Zodra hij
              beschikbaar is, verschijnt hij hier.
            </p>
          </div>
        )}
      </section>

      <section className="mt-8">
        <SectionLabel title="Meer" />
        <Link
          href="/sprinten"
          className="mt-4 flex w-full items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 text-left backdrop-blur-md transition-colors hover:border-cyan-300/30"
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08]"
            style={{ background: "rgba(120,210,230,0.08)" }}
          >
            <Flag className="h-5 w-5" strokeWidth={1.75} style={{ color: ACCENT }} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium text-white/90">
              Bordjes-sprinten
            </span>
            <span className="mt-0.5 block text-[12px] text-white/45">
              Sprint om plaatsnaamborden op je route
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/25" strokeWidth={1.75} />
        </Link>
      </section>
    </ScreenShell>
  )
}
