import { useLocation } from "wouter"
import { TrainingDayHome } from "@/components/sparki/training-day-home"
import { BottomNav } from "@/components/sparki/bottom-nav"
import TrainPage from "@/pages/train"
import FeedPage from "@/pages/feed"
import LabPage from "@/pages/lab"
import YouPage from "@/pages/you"
import LandingPage from "@/pages/landing"

const LANDING_PATH = "/_dev/landing"

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

// Development Preview Mode shell. Rendered only in the Vite dev server. Bypasses
// authentication and onboarding and renders the exact production components,
// driven by the wouter location so the BottomNav works too. Production uses the
// normal auth-gated router instead — this component is never bundled there.
export function DevPreview() {
  const [location, setLocation] = useLocation()

  let page: React.ReactNode
  let showNav = true

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
    page = <TrainingDayHome />
  }

  return (
    <>
      <DevSwitcher current={location} onSelect={setLocation} />
      {page}
      {showNav && <BottomNav />}
    </>
  )
}
