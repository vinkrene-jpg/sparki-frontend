import { useState } from "react"
import { useLocation } from "wouter"
import { DayHome } from "@/components/sparki/day-home"
import { BottomNav } from "@/components/sparki/bottom-nav"
import type { DayType } from "@/lib/day-type"
import TrainPage from "@/pages/train"
import FeedPage from "@/pages/feed"
import LabPage from "@/pages/lab"
import CorePlaygroundPage from "@/pages/core-playground"
import YouPage from "@/pages/you"
import RacesPage from "@/pages/races"
import SamenPage from "@/pages/samen"
import InvitationsPage from "@/pages/invitations"
import InviteAcceptPage from "@/pages/invite-accept"
import TesterQrPage from "@/pages/tester-qr"
import CoachAthletePlanPage from "@/pages/coach-athlete-plan"
import LandingPage from "@/pages/landing"
import KnowledgePage from "@/pages/knowledge"
import { OnboardingV2 } from "@/components/sparki/onboarding-v2"
import AdminPage from "@/pages/admin"
import AdminHealthDetailPage from "@/pages/admin-health-detail"

const LANDING_PATH = "/_dev/landing"
const ONBOARDING_PATH = "/_dev/onboarding"

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
  { label: "Home", path: "/" },
  { label: "Train", path: "/train" },
  { label: "Feed", path: "/feed" },
  { label: "Lab", path: "/lab" },
  { label: "Core", path: "/core" },
  { label: "You", path: "/you" },
  { label: "Samen", path: "/samen" },
  { label: "Kennis", path: "/kennis" },
  { label: "Invites", path: "/invitations" },
  { label: "Tester-QR", path: "/tester-qr" },
  { label: "Coach Plan", path: "/coach/athletes/demo/plan" },
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
}: {
  current: string
  onNavigate: (path: string) => void
  isHome: boolean
  dayType: DayType | undefined
  onDayType: (value: DayType | undefined) => void
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
    </div>
  )
}

// Development Preview Mode shell. Rendered only in the Vite dev server. Bypasses
// authentication and onboarding and renders the exact production components,
// driven by the wouter location so the BottomNav works too. Production uses the
// normal auth-gated router instead — this component is never bundled there.
export function DevPreview() {
  const [location, setLocation] = useLocation()
  const [dayType, setDayType] = useState<DayType | undefined>(undefined)

  let page: React.ReactNode
  let showNav = true
  let isHome = false

  if (location.startsWith(LANDING_PATH)) {
    page = <LandingPage />
    showNav = false
  } else if (location.startsWith(ONBOARDING_PATH)) {
    page = (
      <OnboardingV2
        firstName="Dylan"
        onComplete={() => setLocation("/")}
      />
    )
    showNav = false
  } else if (location.startsWith("/train")) {
    page = <TrainPage />
  } else if (location.startsWith("/feed")) {
    page = <FeedPage />
  } else if (location.startsWith("/core")) {
    page = <CorePlaygroundPage />
    showNav = false
  } else if (location.startsWith("/lab")) {
    page = <LabPage />
  } else if (location.startsWith("/you")) {
    page = <YouPage />
  } else if (location.startsWith("/kennis")) {
    page = <KnowledgePage />
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
  } else if (location.startsWith("/coach/athletes/")) {
    page = <CoachAthletePlanPage />
  } else if (location.startsWith("/invite/")) {
    page = <InviteAcceptPage />
    showNav = false
  } else {
    page = <DayHome devDayTypeOverride={dayType} />
    isHome = true
  }

  return (
    <>
      <DevPanel
        current={location}
        onNavigate={setLocation}
        isHome={isHome}
        dayType={dayType}
        onDayType={setDayType}
      />
      {page}
      {showNav && <BottomNav />}
    </>
  )
}
