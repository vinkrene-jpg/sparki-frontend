import { useEffect, useState } from "react"
import { useLocation } from "wouter"
import { apiFetch } from "@/lib/api"
import { getDevAthleteId, setDevAthleteId } from "@/lib/dev"
import { DayHome, type DevCoachOverride } from "@/components/sparki/day-home"
import { CommercialToday } from "@/components/sparki/commercial-shell"
import { CoachHome } from "@/components/sparki/coach-home"
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
import SprintenPage from "@/pages/sprinten"
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
import KalenderPage from "@/pages/kalender"
import InvitationsPage from "@/pages/invitations"
import InviteAcceptPage from "@/pages/invite-accept"
import TesterQrPage from "@/pages/tester-qr"
import TesterWelcomePage from "@/pages/tester-welcome"
import CoachAthletePlanPage from "@/pages/coach-athlete-plan"
import CoachCockpitPage from "@/pages/coach-cockpit"
import LandingPage from "@/pages/landing"
import StartPage from "@/pages/start"
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

const VIEWS: DevView[] = [
  { label: "Landing", path: LANDING_PATH },
  { label: "Onboarding", path: ONBOARDING_PATH },
  { label: "Start", path: "/" },
  { label: "Vandaag", path: "/vandaag" },
  { label: "Commercieel", path: COMMERCIAL_PATH },
  { label: "Design system", path: DESIGN_PATH },
  { label: "Activiteiten", path: "/activiteiten" },
  { label: "Train", path: "/train" },
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
  { label: "Admin", path: "/admin" },
]

function isActive(current: string, path: string): boolean {
  if (path === LANDING_PATH) return current.startsWith(LANDING_PATH)
  if (path === ONBOARDING_PATH) return current.startsWith(ONBOARDING_PATH)
  if (path === "/") return current === "/" || current === ""
  return current.startsWith(path)
}

const pillStyle = (active: boolean) => ({
  background: active ? "rgba(120,210,230,0.16)" : "transparent",
  color: active ? "rgba(120,210,230,1)" : "rgba(255,255,255,0.45)",
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
    <div className="mt-3 border-t border-white/[0.07] pt-3">
      <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">
        Kijk als gebruiker
      </span>
      {error ? (
        <p className="mt-1.5 text-[10px] text-amber-200/70">
          Kon preview-atleten niet laden. Draai{" "}
          <span className="font-mono">seed:preview</span>.
        </p>
      ) : athletes.length === 0 ? (
        <p className="mt-1.5 text-[10px] text-white/40">
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
                  <span className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.2em] text-white/25">
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
                  <span className="block text-[9px] normal-case tracking-normal text-white/35">
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

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-[9999] flex items-center gap-1.5 rounded-full border border-cyan-300/25 bg-[#040506]/85 px-3 py-1.5 shadow-[0_0_20px_rgba(120,210,230,0.12)] backdrop-blur-xl"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-300/80" />
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-300/70">
          Dev
        </span>
      </button>
    )
  }

  return (
    <div className="fixed left-3 top-3 z-[9999] w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-cyan-300/20 bg-[#040506]/90 p-3 shadow-[0_0_30px_rgba(120,210,230,0.12)] backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-300/70">
          Dev preview
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/40 transition-colors hover:text-white/70"
        >
          Sluiten
        </button>
      </div>

      <div className="mt-3">
        <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">
          Pagina
        </span>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {VIEWS.map((v) => {
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
        <div className="mt-3 border-t border-white/[0.07] pt-3">
          <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">
            Dagtype
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
        <div className="mt-3 border-t border-white/[0.07] pt-3">
          <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">
            Coach-engine · type sporter
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
          <p className="mt-1.5 font-mono text-[8px] leading-relaxed text-white/25">
            {coachMode === "scenario"
              ? "Fictief profiel + dagdata + wedstrijdcontext."
              : "Alleen profiel wisselt — echte check-in/hersteldata blijven."}
          </p>
        </div>
      )}
    </div>
  )
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
  } else if (location.startsWith("/vandaag")) {
    // commercial_shell is globally enabled — dev preview follows the same
    // flag-respecting path as VandaagPage in the real router.
    page = <CommercialToday />
    showNav = false
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
  } else if (location.startsWith("/sprinten")) {
    page = <SprintenPage />
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
  } else if (location.startsWith("/meer")) {
    page = <MeerPage />
  } else if (location.startsWith("/connect")) {
    page = <SparkiConnectPage />
  } else if (location.startsWith("/invite/")) {
    page = <InviteAcceptPage />
    showNav = false
  } else if (location === "/" || location === "") {
    // Home route: rol-bewust, net als RoleHome in de echte router. Een coach
    // krijgt de trainerstartpagina; een sporter de CommercialToday-schil
    // (commercial_shell is globally enabled). StartPage is the legacy fallback
    // (flag off) — only kept as a fallback in the real router, not here.
    if (profile?.activeRole === "coach") {
      page = <CoachHome />
    } else {
      page = <CommercialToday />
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
