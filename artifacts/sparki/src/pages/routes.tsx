import { Link, useLocation, useSearch } from "wouter"
import {
  Flag,
  ChevronRight,
  ChevronLeft,
  Map as MapIcon,
  Download,
  Bookmark,
  Globe2,
  Settings2,
} from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { RoutePanel } from "@/components/sparki/route-panel"
import { RouteLibrary } from "@/components/sparki/route-library"
import { NavSettingsPanel } from "@/components/sparki/nav-settings-panel"
import { RouteDiscover } from "@/components/sparki/route-discover"
import { useFeatureFlag } from "@/hooks/use-feature-flag"

type RoutesView =
  | "maken"
  | "gpx"
  | "bewaard"
  | "ontdek"
  | "instellingen"
  | null

const VIEW_TITLES: Record<Exclude<RoutesView, null>, string> = {
  maken: "Route laten maken",
  gpx: "GPX importeren",
  bewaard: "Bewaarde routes",
  ontdek: "Ontdek gereden routes",
  instellingen: "Navigatie-instellingen",
}

// Navigatiehoofdscherm — vier duidelijke keuzes. Elke keuze opent zijn eigen
// deelscherm via ?view=…; deep-links (?nav=, ?ritopties=, ?route=) zonder view
// landen automatisch op "bewaard", waar de routekaarten leven.
export default function RoutesPage() {
  const routePlannerEnabled = useFeatureFlag("route_planner")
  const search = useSearch()
  const [, setLocation] = useLocation()
  const params = new URLSearchParams(search)
  const rawView = params.get("view")
  const view: RoutesView =
    rawView === "maken" ||
    rawView === "gpx" ||
    rawView === "bewaard" ||
    rawView === "ontdek" ||
    rawView === "instellingen"
      ? rawView
      : params.get("nav") || params.get("ritopties") || params.get("route")
        ? "bewaard"
        : null

  const choices: {
    v: Exclude<RoutesView, null>
    title: string
    sub: string
    icon: typeof MapIcon
  }[] = [
    {
      v: "maken",
      title: "Route laten maken",
      sub: "In vier stappen: kaart, fiets, wensen, klaar",
      icon: MapIcon,
    },
    {
      v: "gpx",
      title: "GPX importeren",
      sub: "Upload een bestand met echt hoogteprofiel",
      icon: Download,
    },
    {
      v: "bewaard",
      title: "Bewaarde routes",
      sub: "Navigeren, delen, downloaden en aanpassen",
      icon: Bookmark,
    },
    {
      v: "ontdek",
      title: "Ontdek gereden routes",
      sub: "Openbare routes van andere gebruikers op de kaart",
      icon: Globe2,
    },
    {
      v: "instellingen",
      title: "Navigatie-instellingen",
      sub: "Datavelden, lettergrootte en kaartgedrag",
      icon: Settings2,
    },
  ]

  return (
    <ScreenShell section="routes">
      {view === null ? (
        <>
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              Routes
            </h1>
            <p className="text-sm text-white/55">
              Laat een route maken of importeer een GPX, bekijk hem op de kaart
              en navigeer onderweg.
            </p>
          </div>

          <section className="mt-8">
            {routePlannerEnabled ? (
              <div className="flex flex-col gap-3">
                {choices.map(({ v, title, sub, icon: Icon }) => (
                  <Link
                    key={v}
                    href={`/routes?view=${v}`}
                    className="flex w-full items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 text-left backdrop-blur-md transition-colors hover:border-cyan-300/30"
                  >
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08]"
                      style={{ background: "rgba(120,210,230,0.08)" }}
                    >
                      <Icon
                        className="h-5 w-5"
                        strokeWidth={1.75}
                        style={{ color: ACCENT }}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium text-white/90">
                        {title}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-white/45">
                        {sub}
                      </span>
                    </span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-white/25"
                      strokeWidth={1.75}
                    />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-[#070d16]/[0.55] p-4 backdrop-blur-md">
                <p className="text-[14px] font-medium text-white/70">
                  Routeplanner nog niet beschikbaar
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-white/40">
                  De routeplanner staat voor jouw account nog niet aan. Zodra
                  hij beschikbaar is, verschijnt hij hier.
                </p>
              </div>
            )}
          </section>

          <section className="mt-8">
            <SectionLabel title="Routebibliotheek" />
            <div className="mt-4">
              <RouteLibrary />
            </div>
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
                <Flag
                  className="h-5 w-5"
                  strokeWidth={1.75}
                  style={{ color: ACCENT }}
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-white/90">
                  Bordjes-sprinten
                </span>
                <span className="mt-0.5 block text-[12px] text-white/45">
                  Sprint om plaatsnaamborden op je route
                </span>
              </span>
              <ChevronRight
                className="h-4 w-4 shrink-0 text-white/25"
                strokeWidth={1.75}
              />
            </Link>
          </section>
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setLocation("/routes")}
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white/45 transition hover:text-cyan-300/80"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
            Navigatie
          </button>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            {VIEW_TITLES[view]}
          </h1>

          <div className="mt-6">
            {view === "instellingen" ? (
              <NavSettingsPanel />
            ) : view === "ontdek" ? (
              <RouteDiscover />
            ) : routePlannerEnabled ? (
              <RoutePanel view={view} />
            ) : (
              <div className="rounded-2xl border border-white/[0.06] bg-[#070d16]/[0.55] p-4 backdrop-blur-md">
                <p className="text-[14px] font-medium text-white/70">
                  Routeplanner nog niet beschikbaar
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-white/40">
                  De routeplanner staat voor jouw account nog niet aan.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </ScreenShell>
  )
}
