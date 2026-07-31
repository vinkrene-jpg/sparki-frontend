import { Link, useLocation, useSearch } from "wouter"
import { dagSfeer } from "@/lib/sfeer"
import { Flag, ChevronRight } from "lucide-react"
import { CommercialShell } from "@/components/sparki/commercial-shell"
import { ACCENT } from "@/components/sparki/ui"
import { HoofdstukTabs, type HoofdstukTab } from "@/components/sparki/hoofdstuk-tabs"
import { RoutePanel } from "@/components/sparki/route-panel"
import { RouteLibrary } from "@/components/sparki/route-library"
import { NavSettingsPanel } from "@/components/sparki/nav-settings-panel"
import { RouteDiscover } from "@/components/sparki/route-discover"
import { RouteLibrarySection } from "@/components/sparki/route-library-section"
import { useFeatureFlag } from "@/hooks/use-feature-flag"

type RoutesView = "maken" | "gpx" | "bewaard" | "ontdek" | "instellingen"

// Hoofdstuk-tabbalk (Strava-stijl, gekozen 28-7-2026) — vervangt de oude
// keuzelijst. Korte labels; de volgorde volgt de oude keuzevolgorde.
const TABS: ReadonlyArray<HoofdstukTab<RoutesView>> = [
  { id: "maken", label: "Maken" },
  { id: "gpx", label: "GPX" },
  { id: "bewaard", label: "Bewaard" },
  { id: "ontdek", label: "Ontdek" },
  { id: "instellingen", label: "Instellingen" },
]

const TAB_INTRO: Record<RoutesView, string> = {
  maken: "Plan je route direct op de kaart, in vier stappen.",
  gpx: "Upload een GPX-bestand met echt hoogteprofiel.",
  bewaard: "Navigeren, delen, downloaden en aanpassen.",
  ontdek: "Openbare routes van andere gebruikers op de kaart.",
  instellingen: "Datavelden, lettergrootte en kaartgedrag.",
}

// Rijden-hoofdscherm met tabbladen. Elke tab blijft deep-linkbaar via
// ?view=…; deep-links (?nav=, ?ritopties=, ?route=) zonder view landen
// automatisch op "Bewaard", waar de routekaarten leven. Zonder parameters
// opent "Maken" (besluit René 31-07-2026): wie het hoofdstuk Rijden opent,
// begint bij het plannen van een route.
export default function RoutesPage() {
  const routePlannerEnabled = useFeatureFlag("route_planner")
  const search = useSearch()
  const [, setLocation] = useLocation()
  const params = new URLSearchParams(search)
  const rawView = params.get("view")
  const view: RoutesView = TABS.some((t) => t.id === rawView)
    ? (rawView as RoutesView)
    : params.has("route") || params.has("nav") || params.has("ritopties")
      ? "bewaard"
      : "maken"

  // Tab-wissel schrijft alleen ?view= — oude deep-linkparameters (?route=…)
  // horen bij de vorige weergave en gaan niet mee.
  const kiesTab = (v: RoutesView) => setLocation(`/routes?view=${v}`)

  const plannerUit = (
    <div className="rounded-2xl border border-white/[0.06] bg-map-panel/[0.55] p-4 backdrop-blur-md">
      <p className="text-[14px] font-medium text-white/70">
        Routeplanner nog niet beschikbaar
      </p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-white/40">
        De routeplanner staat voor jouw account nog niet aan. Zodra hij
        beschikbaar is, verschijnt hij hier.
      </p>
    </div>
  )

  return (
    <CommercialShell actief="/routes" sfeer={dagSfeer("rijden")}>
      {/* Standaard paginakolom van de schil: zonder deze wrapper plakt alle
          tekst tegen de schermrand (de schil zelf geeft geen zijmarge). */}
      <div className="mx-auto w-full max-w-2xl px-5 pb-10 pt-8 lg:max-w-3xl lg:px-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Routes
        </h1>
        <p className="text-sm text-white/55">{TAB_INTRO[view]}</p>
      </div>

      {/* Vast tabmenu: blijft bovenin staan tijdens scrollen, met een
          donkere blur-achtergrond zodat inhoud er niet doorheen schijnt.
          -mx/px zodat de balk tot de randen van de content doorloopt. */}
      <div className="sticky top-0 z-30 -mx-5 mt-5 bg-map-ink/85 px-5 pb-1 pt-2 backdrop-blur-md lg:-mx-10 lg:px-10">
        <HoofdstukTabs
          tabs={TABS}
          actief={view}
          onKies={kiesTab}
          variant="donker"
          ariaLabel="Routes-secties"
        />
      </div>

      {/* Eén tabpanel per tab — altijd aanwezig zodat aria-controls op elke
          tab naar een bestaand element wijst; alleen het actieve tabblad
          rendert zijn inhoud (de panelen zijn zwaar: kaarten, queries). */}
      {TABS.filter(({ id }) => id !== view).map(({ id }) => (
        <div
          key={id}
          id={`tab-${id}`}
          role="tabpanel"
          aria-labelledby={`tabknop-${id}`}
          hidden
        />
      ))}
      <div
        className="mt-6"
        id={`tab-${view}`}
        role="tabpanel"
        aria-labelledby={`tabknop-${view}`}
      >
        {view === "instellingen" ? (
          <NavSettingsPanel />
        ) : view === "ontdek" ? (
          <>
            <RouteLibrarySection />
            <div className="mt-8">
              <RouteDiscover />
            </div>
            {/* Bordjes-sprinten hoorde bij het oude hoofdscherm; het is een
                ontdek-achtige nevenweg en woont nu onder dit tabblad. */}
            <section className="mt-8">
              <Link
                href="/sprinten"
                className="flex w-full items-center gap-4 rounded-2xl border border-white/[0.08] bg-map-panel/[0.82] p-4 text-left backdrop-blur-md transition-colors hover:border-cyan-300/30"
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
        ) : view === "bewaard" ? (
          <>
            {routePlannerEnabled ? <RoutePanel view="bewaard" /> : plannerUit}
            {/* Eén lijst (besluit René 30-07-2026): de routebibliotheek is dé
                lijst van het Bewaard-tabblad — compact, alles ingeklapt. Zodra
                één route open staat (?route=/?nav=/?ritopties=) verdwijnt de
                lijst tijdelijk; de terugknop boven de routekaart brengt hem
                terug. Zo staat elke route maar één keer op het scherm. */}
            {!(
              params.has("route") ||
              params.has("nav") ||
              params.has("ritopties")
            ) && (
              <section className="mt-8">
                <RouteLibrary />
              </section>
            )}
          </>
        ) : routePlannerEnabled ? (
          <RoutePanel view={view} />
        ) : (
          plannerUit
        )}
      </div>
      </div>
    </CommercialShell>
  )
}
