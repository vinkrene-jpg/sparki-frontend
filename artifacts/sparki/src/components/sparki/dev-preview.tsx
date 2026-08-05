import { useEffect, useState } from "react"
import { useLocation } from "wouter"
import { apiFetch } from "@/lib/api"
import { getDevAthleteId, setDevAthleteId } from "@/lib/dev"
import { DashboardAnalyse, type DevCoachOverride } from "@/components/sparki/day-home"
import { CommercialToday } from "@/components/sparki/commercial-shell"
// DASHBOARD_01 Fase C: de kaart-landing voor Gratis/Go, ook in de dev-preview
// zodat de toetsomgeving exact de pakketgestuurde landing toont (DSH-25: geen
// app/browser-verschil).
import { KaartLanding } from "@/components/sparki/kaart-landing"
import { usePackage } from "@/hooks/use-package"
import { CoachHome } from "@/components/sparki/coach-home"
// DASHBOARD_01 Fase B (DSH-13a/DSH-24): het drie-lagen dashboard is het eerste
// scherm van coach/ouder — óók in de dev-preview-router, zodat de toetsomgeving
// exact dezelfde gedaante toont als productie (geen tweede gedaante onder
// dezelfde naam). De werkomgevingen (roster, Kinderen) blijven doorklikbaar.
import { CoachDashboard } from "@/components/sparki/role-dashboards/coach-dashboard"
import { ParentDashboard } from "@/components/sparki/role-dashboards/parent-dashboard"
import ParentKinderenPage from "@/pages/parent-kinderen"
import ParentMeldingenPage from "@/pages/parent-meldingen"
import ParentToestemmingenPage from "@/pages/parent-toestemmingen"
import { useUserProfile } from "@/contexts/UserContext"
import type { DayType } from "@/lib/day-type"
import {
  COACH_SCENARIOS,
  COACH_SCENARIO_ORDER,
  type CoachOverrideMode,
  type CoachScenarioKey,
} from "@/lib/coach-engine"
import TrainPage from "@/pages/train"
import CorePlanPage from "@/pages/core-plan"
import JourneyPage from "@/pages/journey"
import SupportPage from "@/pages/support"
import ProfielPage from "@/pages/profiel"
import FeedPage from "@/pages/feed"
import { AnalyseSwitchPage } from "@/pages/analyse-switch"
import CoreActiviteitenPage from "@/pages/core-activiteiten"
import PhotoLabPage from "@/pages/photo-lab"
import YouPage from "@/pages/you"
import GeluidPage from "@/pages/geluid"
import RacesPage from "@/pages/races"
import WedstrijdRoomPage from "@/pages/wedstrijd-room"
import SamenPage from "@/pages/samen"
import LichaamPage from "@/pages/lichaam"
import MechaniekerPage from "@/pages/mechanieker"
import RoutesPage from "@/pages/routes"
import RouteSchermPage from "@/pages/route-scherm"
import KalenderPage from "@/pages/kalender"
import InvitationsPage from "@/pages/invitations"
import InviteAcceptPage from "@/pages/invite-accept"
import TesterQrPage from "@/pages/tester-qr"
import TesterWelcomePage from "@/pages/tester-welcome"
import CoachAthletePlanPage from "@/pages/coach-athlete-plan"
import CoachCockpitPage from "@/pages/coach-cockpit"
import SporterCoachPage from "@/pages/sporter-coach"
import LandingPage from "@/pages/landing"
import StartPage from "@/pages/start"
import LegalPage from "@/pages/legal"
import MeerPage from "@/pages/core-meer"
import SparkiConnectPage from "@/pages/sparki-connect"
import ClubPage from "@/pages/club"
import ClubBeheerPage from "@/pages/club-beheer"
import PaspoortPage from "@/pages/paspoort"
import KnowledgePage from "@/pages/knowledge"
import KlimmenPage from "@/pages/klimmen"
import { OnboardingV2 } from "@/components/sparki/onboarding-v2"
import { OnboardingCheckFailed } from "@/components/sparki/onboarding-check-failed"
import AdminPage from "@/pages/admin"
import AdminHealthDetailPage from "@/pages/admin-health-detail"
import DevDesignSystemPage from "@/pages/dev-design-system"
import NutritionSpecialistHome from "@/pages/nutrition-start"
import RolStartPage from "@/pages/rol-start"

const LANDING_PATH = "/_dev/landing"
const ONBOARDING_PATH = "/_dev/onboarding"
const COMMERCIAL_PATH = "/_dev/commercial"
const ONBOARDING_FAILED_PATH = "/_dev/onboarding-failed"
const DESIGN_PATH = "/_dev/design"

// Dev-only preview of each day type (blueprint §4). "Auto" uses the real engine
// detection; the rest force a specific day type so every homepage is visible
// without manipulating data. Race homepages render their real (or empty) race
// context when forced here.
const DAY_TYPE_OPTIONS: { label: string; value?: DayType }[] = [
  { label: "Auto" },
  { label: "Coach", value: "coach_training" },
  { label: "Sparki", value: "sparki_training" },
  { label: "Herstel", value: "recovery" },
  { label: "Rust", value: "rest" },
  { label: "Algemeen", value: "general" },
  { label: "Ziek", value: "emergency" },
  { label: "Race-week", value: "race_week" },
  { label: "Dag vóór", value: "day_before_race" },
  { label: "Racedag", value: "race_day" },
  { label: "Reisdag", value: "travel_day" },
  { label: "Na race", value: "post_race" },
]

type DevView = {
  label: string
  path: string
}

// WP-R0: rolbewuste paginalijsten. De lijst per rol spiegelt wat die rol in de
// echte router als startpunt/ingangen heeft — géén sporterlijst voor iedereen.
// Rollen zonder eigen werkomgeving (ouder, clubrollen) krijgen bewust een korte
// lijst: hun eerlijke huidige toestand is precies wat getest moet worden.
const COACH_VIEWS: DevView[] = [
  { label: "Dashboard", path: "/" },
  { label: "Jouw sporters", path: "/coach" },
  { label: "Invites", path: "/invitations" },
  { label: "Coach Plan", path: "/coach/athletes/demo/plan" },
  { label: "Coach Cockpit", path: "/coach/athletes/demo/cockpit" },
  { label: "Samen", path: "/samen" },
  { label: "Meer", path: "/meer" },
  { label: "Privacy", path: "/privacy" },
]

const PARENT_VIEWS: DevView[] = [
  { label: "Start (ouder)", path: "/" },
  { label: "Invites", path: "/invitations" },
  { label: "Meer", path: "/meer" },
  { label: "Privacy", path: "/privacy" },
]

const VIEWS: DevView[] = [
  { label: "Landing", path: LANDING_PATH },
  { label: "Onboarding", path: ONBOARDING_PATH },
  { label: "Start", path: "/" },
  { label: "Dashboard", path: "/dashboard" },
  { label: "Commercieel", path: COMMERCIAL_PATH },
  { label: "Design system", path: DESIGN_PATH },
  { label: "Activiteiten", path: "/activiteiten" },
  { label: "Train", path: "/train" },
  { label: "Coach", path: "/coach" },
  { label: "Feed", path: "/feed" },
  { label: "Analyse", path: "/analyse" },
  { label: "You", path: "/you" },
  { label: "Geluid", path: "/geluid" },
  { label: "Lichaam", path: "/lichaam" },
  { label: "Mechanieker", path: "/mechanieker" },
  { label: "Routes", path: "/routes" },
  { label: "Kalender", path: "/kalender" },
  { label: "Foto-lab", path: "/photo-lab" },
  { label: "Wedstrijd-room", path: "/wedstrijd-room" },
  { label: "Samen", path: "/samen" },
  { label: "Kennis", path: "/kennis" },
  { label: "Klimmen", path: "/klimmen" },
  { label: "Invites", path: "/invitations" },
  { label: "Tester-QR", path: "/tester-qr" },
  { label: "Welkom-tester", path: "/welkom-tester" },
  { label: "Coach Plan", path: "/coach/athletes/demo/plan" },
  { label: "Coach Cockpit", path: "/coach/athletes/demo/cockpit" },
  { label: "Club", path: "/club" },
  { label: "Club-beheer", path: "/club/beheer" },
  { label: "Admin", path: "/admin" },
]

function viewsForRole(role: string | undefined): DevView[] {
  if (role === "coach") return COACH_VIEWS
  if (role === "parent") return PARENT_VIEWS
  return VIEWS
}

function isActive(current: string, path: string): boolean {
  if (path === LANDING_PATH) return current.startsWith(LANDING_PATH)
  if (path === ONBOARDING_PATH) return current.startsWith(ONBOARDING_PATH)
  if (path === "/") return current === "/" || current === ""
  return current.startsWith(path)
}

const pillStyle = (active: boolean) => ({
  background: active ? "var(--color-accent)" : "transparent",
  color: active ? "var(--color-accent-cyan)" : "var(--color-muted-foreground)",
})

type PreviewAthlete = {
  clerkId: string
  name: string | null
  group?: string
  personaLabel: string
  basis: string
}

// Dev-only switcher for the ACTIVE preview athlete. Lists the seeded preview
// athletes (honest: only those that actually exist) and, on pick, pins the
// choice and does a full reload so UserContext + every query refetch for the new
// athlete — the cleanest way to swap identity without coordinating cache state.
function AthleteSwitcher() {
  const [athletes, setAthletes] = useState<PreviewAthlete[]>([])
  const [error, setError] = useState(false)
  const selected = getDevAthleteId()

  useEffect(() => {
    let cancelled = false
    apiFetch<{ athletes: PreviewAthlete[] }>("/api/dev/preview-athletes")
      .then((res) => {
        if (!cancelled) setAthletes(res.athletes)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const pick = (clerkId: string | null) => {
    setDevAthleteId(clerkId)
    window.location.reload()
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
        Kijk als gebruiker
      </span>
      {error ? (
        <p className="mt-1.5 text-[10px] text-[color:var(--color-warning)]">
          Kon preview-atleten niet laden. Draai{" "}
          <span className="font-mono">seed:preview</span>.
        </p>
      ) : athletes.length === 0 ? (
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Nog geen preview-atleten geseed.
        </p>
      ) : (
        <div className="mt-1.5 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => pick(null)}
            className="rounded-lg px-2.5 py-1 text-left font-mono text-[10px] uppercase tracking-[0.1em] transition-colors"
            style={pillStyle(!selected)}
          >
            Standaard
          </button>
          {athletes.map((a, i) => {
            const prev = athletes[i - 1]
            const showHeader = a.group && a.group !== prev?.group
            return (
              <div key={a.clerkId} className="flex flex-col gap-1">
                {showHeader ? (
                  <span className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
                    {a.group}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => pick(a.clerkId)}
                  className="rounded-lg px-2.5 py-1 text-left transition-colors"
                  style={pillStyle(selected === a.clerkId)}
                >
                  <span className="block font-mono text-[10px] uppercase tracking-[0.1em]">
                    {a.name ?? a.clerkId}
                  </span>
                  <span className="block text-[9px] normal-case tracking-normal text-muted-foreground">
                    {a.personaLabel} — {a.basis}
                  </span>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// A single collapsible developer panel that consolidates the page switcher and
// (on the home view) the day-type previewer. Collapsed by default so the real
// app — with only its production BottomNav — is what's on screen. This whole
// component is dev-only and never bundled into production.
function DevPanel({
  current,
  onNavigate,
  isHome,
  dayType,
  onDayType,
  coachMode,
  onCoachMode,
  coachScenario,
  onCoachScenario,
}: {
  current: string
  onNavigate: (path: string) => void
  isHome: boolean
  dayType: DayType | undefined
  onDayType: (value: DayType | undefined) => void
  coachMode: CoachOverrideMode
  onCoachMode: (value: CoachOverrideMode) => void
  coachScenario: CoachScenarioKey | undefined
  onCoachScenario: (value: CoachScenarioKey | undefined) => void
}) {
  const [open, setOpen] = useState(false)
  // WP-S1: TESTCONTEXT-label — altijd zichtbaar, toont de ECHTE actieve
  // identiteit + rol + echte rechten van die rij (geen dev-bypass meer).
  const { profile } = useUserProfile()
  const identiteit =
    profile?.displayName ?? getDevAthleteId() ?? "standaard dev-gebruiker"
  const rol = profile?.activeRole ?? "?"
  const rechten = [
    profile?.isAdmin ? "admin" : null,
    profile?.isHeadTester ? "hoofdtester" : null,
  ]
    .filter(Boolean)
    .join("+")
  const illustratieActief = dayType !== undefined || coachScenario !== undefined
  // Omgevingsnaam + commit-SHA verplicht zichtbaar in elke niet-productieomgeving.
  const buildSha =
    typeof __SPARKI_BUILD_SHA__ === "string" ? __SPARKI_BUILD_SHA__ : "onbekend"
  const contextLabel = `TESTCONTEXT · DEV PREVIEW @ ${buildSha} · ${identiteit} · rol ${rol}${
    rechten ? ` · ${rechten}` : ""
  }${illustratieActief ? " · ILLUSTRATIE" : ""}`

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-[9999] flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-background px-3 py-1.5 shadow-float backdrop-blur-xl"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-amber-300/80" />
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[color:var(--color-warning)]">
          {contextLabel}
        </span>
      </button>
    )
  }

  return (
    <div className="fixed left-3 top-3 z-[9999] max-h-[calc(100vh-1.5rem)] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-accent-cyan/20 bg-background p-3 shadow-float backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[color:var(--color-warning)]">
          {contextLabel}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-muted-foreground"
        >
          Sluiten
        </button>
      </div>

      <div className="mt-3">
        <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
          Pagina
        </span>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {viewsForRole(profile?.activeRole).map((v) => {
            const active = isActive(current, v.path)
            return (
              <button
                key={v.path}
                type="button"
                onClick={() => onNavigate(v.path)}
                className="rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors"
                style={pillStyle(active)}
              >
                {v.label}
              </button>
            )
          })}
        </div>
      </div>

      <AthleteSwitcher />

      {isHome && (
        <div className="mt-3 border-t border-border pt-3">
          <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
            Dagtype{" "}
            <span className="text-[color:var(--color-warning)]">— illustratie, geen echte data</span>
          </span>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {DAY_TYPE_OPTIONS.map((o) => {
              const active = dayType === o.value
              return (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => onDayType(o.value)}
                  className="rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors"
                  style={pillStyle(active)}
                >
                  {o.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {isHome && (
        <div className="mt-3 border-t border-border pt-3">
          <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-muted-foreground">
            Coach-engine · type sporter{" "}
            <span className="text-[color:var(--color-warning)]">— illustratie, geen echte data</span>
          </span>

          {/* Mode toggle — Scenario (fictief profiel + dagdata) is default;
              Profiel wisselt alleen het profiel en behoudt echte dagdata. */}
          <div className="mt-1.5 flex gap-1">
            {(
              [
                { label: "Scenario", value: "scenario" as const },
                { label: "Profiel", value: "profile" as const },
              ]
            ).map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => onCoachMode(m.value)}
                className="rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors"
                style={pillStyle(coachMode === m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Sporter-keuze — Uit = echte profiel-engine, geen override. */}
          <div className="mt-1.5 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => onCoachScenario(undefined)}
              className="rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors"
              style={pillStyle(coachScenario === undefined)}
            >
              Uit
            </button>
            {COACH_SCENARIO_ORDER.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => onCoachScenario(key)}
                className="rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors"
                style={pillStyle(coachScenario === key)}
              >
                {COACH_SCENARIOS[key].label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 font-mono text-[8px] leading-relaxed text-muted-foreground">
            {coachMode === "scenario"
              ? "Fictief profiel + dagdata + wedstrijdcontext."
              : "Alleen profiel wisselt — echte check-in/hersteldata blijven."}
          </p>
        </div>
      )}
    </div>
  )
}

// DASHBOARD_01 Fase C (DSH-10/12/24/25): de sporter-landing volgt het pakket,
// exact zoals productie-SporterLanding. Compleet → drie-lagen dashboard
// (CommercialToday, één gedaante); Go/Gratis → de kaart met onderblad. Bij een
// onbekend pakket de kaart (veilige default die voor élk pakket werkt).
function SporterLandingPreview() {
  const { pkg } = usePackage()
  if (pkg === "compleet") return <CommercialToday />
  return <KaartLanding pkg={pkg === "go" ? "go" : "gratis"} />
}

// Development Preview Mode shell. Rendered only in the Vite dev server. Bypasses
// authentication and onboarding and renders the exact production components,
// driven by the wouter location so the BottomNav works too. Production uses the
// normal auth-gated router instead — this component is never bundled there.
export function DevPreview() {
  const [location, setLocation] = useLocation()
  // Rol-bewuste home, zelfde regel als productie-RoleHome: een coach ziet de
  // trainerstartpagina, een sporter het Vandaag-scherm. Dev-tooling only.
  const { profile } = useUserProfile()
  const [dayType, setDayType] = useState<DayType | undefined>(undefined)
  // Coach-engine override (Adaptive Coach Engine selector). Default mode is
  // Scenario override; no athlete is selected until you pick one ("Uit" = the
  // real profile-driven engine).
  const [coachMode, setCoachMode] = useState<CoachOverrideMode>("scenario")
  const [coachScenario, setCoachScenario] = useState<
    CoachScenarioKey | undefined
  >(undefined)
  const devCoachOverride: DevCoachOverride | undefined = coachScenario
    ? { mode: coachMode, scenario: coachScenario }
    : undefined

  let page: React.ReactNode
  let showNav = true
  let isHome = false

  if (location.startsWith(LANDING_PATH)) {
    page = <LandingPage />
    showNav = false
  } else if (location.startsWith(ONBOARDING_FAILED_PATH)) {
    // Dev-preview van de beperkte foutstatus (A2-01): serverstatus tijdelijk
    // niet verifieerbaar — in productie alleen bereikbaar bij echte storing.
    page = <OnboardingCheckFailed onRetry={() => setLocation("/")} />
    showNav = false
  } else if (location.startsWith(ONBOARDING_PATH)) {
    page = (
      <OnboardingV2
        firstName="Dylan"
        onComplete={() => setLocation("/")}
      />
    )
    showNav = false
  } else if (location.startsWith(COMMERCIAL_PATH)) {
    // Commerciële lichte schil — preview van Vandaag in de nieuwe vormgeving
    // met dezelfde echte data (flag: commercial_shell blijft default UIT).
    page = <CommercialToday />
    showNav = false
  } else if (location.startsWith(DESIGN_PATH)) {
    // Interne designsysteem-testpagina — tokens, typografie en componenten.
    page = <DevDesignSystemPage />
    showNav = false
  } else if (location.startsWith("/dashboard/analyse")) {
    // DSH-07: de diepere dagtype-analyse als doorklik vanaf het Dashboard —
    // een eigen scherm, geen tweede gedaante. De dagtype-kiezer in het
    // devpaneel stuurt hier de weergave.
    page = <DashboardAnalyse devDayTypeOverride={dayType} devCoachOverride={devCoachOverride} />
    showNav = false
    isHome = true
  } else if (location.startsWith("/dashboard") || location.startsWith("/vandaag")) {
    // DSH-01/03: /dashboard is de nieuwe naam; /vandaag blijft als alias werken
    // (in productie een redirect). DASHBOARD_01 Fase B (DSH-13a/24): coach en
    // ouder krijgen hier hun drie-lagen dashboard — de nieuwe vorm van hun
    // eerste scherm; de werkomgeving is één doorklik verderop.
    if (profile?.activeRole === "coach") {
      page = <CoachDashboard />
    } else if (profile?.activeRole === "parent") {
      page = <ParentDashboard />
    } else if (profile?.activeRole === "nutrition_specialist") {
      // F3 (BB-14): voedingsdeskundige houdt het eigen startscherm, geen
      // stille terugval op de sporterweergave.
      page = <NutritionSpecialistHome />
    } else {
      // DASHBOARD_01 Fase C: /dashboard volgt het pakket (Compleet: dashboard;
      // Go: dashboard met beperkte laag 3; Gratis: nette landing op de kaart).
      page = <SporterLandingPreview />
      showNav = false
    }
  } else if (location.startsWith("/rol-start")) {
    // F3 (BB-08): rolgestuurde startpunten — zelfde pagina als de echte router.
    page = <RolStartPage />
  } else if (location.startsWith("/kinderen")) {
    // WP-R1 ouderomgeving — zonder deze regels viel de ouderonderbalk hier
    // stil terug op de StartPage-fallback (zelfde valkuil als /privacy in WP-S1).
    page = <ParentKinderenPage />
  } else if (location.startsWith("/meldingen")) {
    page = <ParentMeldingenPage />
  } else if (location.startsWith("/toestemmingen")) {
    page = <ParentToestemmingenPage />
  } else if (location.startsWith("/club/beheer")) {
    page = <ClubBeheerPage />
  } else if (location.startsWith("/club")) {
    page = <ClubPage />
  } else if (location.startsWith("/paspoort")) {
    page = <PaspoortPage />
  } else if (location.startsWith("/train")) {
    page = <CorePlanPage />
    showNav = false
  } else if (location.startsWith("/feed")) {
    page = <FeedPage />
    showNav = false
  } else if (location.startsWith("/lab") || location.startsWith("/analyse")) {
    // Exact dezelfde component + switchlogica als productie-/analyse (A-06):
    // geen shortcut die een andere pagina toont dan gebruikers zien.
    // /lab blijft hier als alias werken, net als de redirect in de router.
    page = <AnalyseSwitchPage />
    showNav = false
  } else if (location.startsWith("/activiteiten")) {
    // Mirrors ActiviteitenSwitchPage with commercial_shell on.
    page = <CoreActiviteitenPage />
    showNav = false
  } else if (location.startsWith("/you")) {
    page = <YouPage />
  } else if (location.startsWith("/geluid")) {
    page = <GeluidPage />
  } else if (location.startsWith("/lichaam")) {
    page = <LichaamPage />
  } else if (location.startsWith("/mechanieker")) {
    page = <MechaniekerPage />
  } else if (location.startsWith("/routes")) {
    page = <RoutesPage />
  } else if (location.startsWith("/route")) {
    // ROUTEPLANNER_MOBIEL_01 — nieuw schermvullend routescherm (ná /routes:
    // dat prefix-match anders alles vangt). Eigen chrome, geen onderbalk.
    page = <RouteSchermPage />
    showNav = false
  } else if (location.startsWith("/kalender")) {
    page = <KalenderPage />
  } else if (location.startsWith("/photo-lab")) {
    page = <PhotoLabPage />
    showNav = false
  } else if (location.startsWith("/kennis")) {
    page = <KnowledgePage />
  } else if (location.startsWith("/klimmen")) {
    page = <KlimmenPage />
  } else if (location.startsWith("/wedstrijd-room")) {
    page = <WedstrijdRoomPage />
  } else if (location.startsWith("/journey")) {
    page = <JourneyPage />
  } else if (location.startsWith("/support")) {
    page = <SupportPage />
  } else if (location.startsWith("/profiel/")) {
    page = <ProfielPage />
  } else if (location.startsWith("/races")) {
    page = <RacesPage />
  } else if (location.startsWith("/samen")) {
    page = <SamenPage />
  } else if (location.startsWith("/admin/health/")) {
    page = <AdminHealthDetailPage />
    showNav = false
  } else if (location.startsWith("/admin")) {
    page = <AdminPage />
    showNav = false
  } else if (location.startsWith("/invitations")) {
    page = <InvitationsPage />
  } else if (location.startsWith("/tester-qr")) {
    page = <TesterQrPage />
    showNav = false
  } else if (location.startsWith("/welkom-tester")) {
    page = <TesterWelcomePage />
    showNav = false
  } else if (
    location.startsWith("/coach/athletes/") &&
    location.includes("/cockpit")
  ) {
    page = <CoachCockpitPage />
  } else if (location.startsWith("/coach/athletes/")) {
    page = <CoachAthletePlanPage />
  } else if (location === "/coach" || location.startsWith("/coach?")) {
    // Rol-bewust, gespiegeld aan CoachSwitchPage in App.tsx: trainers zien de
    // trainerswerkomgeving (roster), sporters hun eigen coach-omgeving (#607).
    page =
      profile?.activeRole === "coach" ? <CoachHome /> : <SporterCoachPage />
  } else if (location.startsWith("/meer")) {
    page = <MeerPage />
  } else if (location.startsWith("/privacy")) {
    // WP-S1: publieke juridische pagina's ontbraken in de dev-preview-routetabel,
    // waardoor Meer → Privacy hier stil op de StartPage-fallback landde terwijl
    // productie de echte Privacyverklaring toont (de door René gevonden fout).
    page = <LegalPage kind="privacy" />
    showNav = false
  } else if (location.startsWith("/voorwaarden")) {
    page = <LegalPage kind="terms" />
    showNav = false
  } else if (location.startsWith("/connect")) {
    page = <SparkiConnectPage />
  } else if (location.startsWith("/invite/")) {
    page = <InviteAcceptPage />
    showNav = false
  } else if (location === "/" || location === "") {
    // Home route: rol-bewust, net als RoleHome in de echte router. DASHBOARD_01
    // Fase B (DSH-13a/24): coach en ouder landen op hun drie-lagen dashboard;
    // een sporter op de CommercialToday-schil (commercial_shell globally
    // enabled). StartPage is de legacy fallback (flag off) — alleen in de echte
    // router, niet hier.
    if (profile?.activeRole === "coach") {
      page = <CoachDashboard />
    } else if (profile?.activeRole === "parent") {
      // WP-R0: spiegelt RoleHome — een ouder ziet zijn dashboard, geen
      // sporterweergave meer als stille terugval.
      page = <ParentDashboard />
    } else if (profile?.activeRole === "nutrition_specialist") {
      // F3 (BB-14): spiegelt RoleHome — eigen startscherm, geen terugval.
      page = <NutritionSpecialistHome />
    } else {
      // DASHBOARD_01 Fase C (DSH-10/12/24): sporter-landing volgt het pakket.
      page = <SporterLandingPreview />
      showNav = false
    }
  } else {
    page = <StartPage />
  }

  return (
    <>
      <DevPanel
        current={location}
        onNavigate={setLocation}
        isHome={isHome}
        dayType={dayType}
        onDayType={setDayType}
        coachMode={coachMode}
        onCoachMode={setCoachMode}
        coachScenario={coachScenario}
        onCoachScenario={setCoachScenario}
      />
      {page}
    </>
  )
}
