import { useState } from "react"
import { useLocation } from "wouter"
import { TrainingDayHome } from "@/components/sparki/training-day-home"
import { BottomNav } from "@/components/sparki/bottom-nav"
import type { DayType } from "@/lib/day-type"
import TrainPage from "@/pages/train"
import FeedPage from "@/pages/feed"
import LabPage from "@/pages/lab"
import YouPage from "@/pages/you"
import LandingPage from "@/pages/landing"

const LANDING_PATH = "/_dev/landing"

// Dev-only preview of each core day type (blueprint §4). "Auto" uses the real
// engine detection; the rest force a specific core-day briefing so every day
// type is visible without manipulating data. Race/Emergency stay out — their
// homepages belong to later phases.
const DAY_TYPE_OPTIONS: { label: string; value?: DayType }[] = [
  { label: "Auto" },
  { label: "Coach", value: "coach_training" },
  { label: "Sparki", value: "sparki_training" },
  { label: "Herstel", value: "recovery" },
  { label: "Rust", value: "rest" },
  { label: "Algemeen", value: "general" },
]

type DevView = {
  label: string
  path: string
}

const VIEWS: DevView[] = [
  { label: "Landing", path: LANDING_PATH },
  { label: "Home", path: "/" },
  { label: "Train", path: "/train" },
  { label: "Feed", path: "/feed" },
  { label: "Lab", path: "/lab" },
  { label: "You", path: "/you" },
]

function isActive(current: string, path: string): boolean {
  if (path === LANDING_PATH) return current.startsWith(LANDING_PATH)
  if (path === "/") return current === "/" || current === ""
  return current.startsWith(path)
}

function DevSwitcher({
  current,
  onSelect,
}: {
  current: string
  onSelect: (path: string) => void
}) {
  return (
    <div className="fixed left-1/2 top-3 z-[9999] -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-full border border-cyan-300/25 bg-[#040506]/85 px-1.5 py-1.5 shadow-[0_0_20px_rgba(120,210,230,0.12)] backdrop-blur-xl">
        <span className="px-2 font-mono text-[8px] uppercase tracking-[0.2em] text-cyan-300/60">
          DEV
        </span>
        {VIEWS.map((v) => {
          const active = isActive(current, v.path)
          return (
            <button
              key={v.path}
              type="button"
              onClick={() => onSelect(v.path)}
              className="rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors"
              style={{
                background: active ? "rgba(120,210,230,0.16)" : "transparent",
                color: active ? "rgba(120,210,230,1)" : "rgba(255,255,255,0.45)",
              }}
            >
              {v.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DayTypeSwitcher({
  value,
  onSelect,
}: {
  value: DayType | undefined
  onSelect: (value: DayType | undefined) => void
}) {
  return (
    <div className="fixed left-1/2 top-[3.4rem] z-[9999] -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-full border border-cyan-300/15 bg-[#040506]/85 px-1.5 py-1.5 shadow-[0_0_20px_rgba(120,210,230,0.08)] backdrop-blur-xl">
        <span className="px-2 font-mono text-[8px] uppercase tracking-[0.2em] text-cyan-300/50">
          DAGTYPE
        </span>
        {DAY_TYPE_OPTIONS.map((o) => {
          const active = value === o.value
          return (
            <button
              key={o.label}
              type="button"
              onClick={() => onSelect(o.value)}
              className="rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors"
              style={{
                background: active ? "rgba(120,210,230,0.16)" : "transparent",
                color: active ? "rgba(120,210,230,1)" : "rgba(255,255,255,0.45)",
              }}
            >
              {o.label}
            </button>
          )
        })}
      </div>
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
  } else if (location.startsWith("/train")) {
    page = <TrainPage />
  } else if (location.startsWith("/feed")) {
    page = <FeedPage />
  } else if (location.startsWith("/lab")) {
    page = <LabPage />
  } else if (location.startsWith("/you")) {
    page = <YouPage />
  } else {
    page = <TrainingDayHome devDayTypeOverride={dayType} />
    isHome = true
  }

  return (
    <>
      <DevSwitcher current={location} onSelect={setLocation} />
      {isHome && <DayTypeSwitcher value={dayType} onSelect={setDayType} />}
      {page}
      {showNav && <BottomNav />}
    </>
  )
}
