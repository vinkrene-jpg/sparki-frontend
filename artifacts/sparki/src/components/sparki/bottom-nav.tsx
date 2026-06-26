import { Home, Activity, Compass, Dumbbell, User, UserPlus, Radio } from "lucide-react"
import { Link, useLocation } from "wouter"
import { useUserProfile } from "@/contexts/UserContext"
import type { Role } from "@/contexts/UserContext"

type NavItem = {
  href: string
  icon: typeof Home
  label: string
}

// Experience-first navigation (approved restructure):
// Vandaag · Activiteiten · Ontdekken · Trainen · Jij.
// Nieuws + Kennis + Inzicht are being merged into Ontdekken; Races folds into
// Trainen; Samen is reachable from the profile/header; Core is an internal
// engine with no nav entry.
const ATHLETE_NAV: NavItem[] = [
  { href: "/", icon: Home, label: "Vandaag" },
  { href: "/activiteiten", icon: Activity, label: "Activiteiten" },
  { href: "/feed", icon: Compass, label: "Ontdekken" },
  { href: "/train", icon: Dumbbell, label: "Trainen" },
  { href: "/you", icon: User, label: "Jij" },
]

const COACH_NAV: NavItem[] = [
  { href: "/", icon: Home, label: "Vandaag" },
  { href: "/invitations", icon: UserPlus, label: "Uitnodigen" },
  { href: "/you", icon: User, label: "Profiel" },
]

const PARENT_NAV: NavItem[] = [
  { href: "/", icon: Home, label: "Vandaag" },
  { href: "/feed", icon: Radio, label: "Nieuws" },
  { href: "/invitations", icon: UserPlus, label: "Uitnodigen" },
  { href: "/you", icon: User, label: "Profiel" },
]

function navForRole(role: Role | null | undefined): NavItem[] {
  if (role === "coach") return COACH_NAV
  if (role === "parent") return PARENT_NAV
  return ATHLETE_NAV
}

export function BottomNav() {
  const [pathname] = useLocation()
  const { profile } = useUserProfile()
  const items = navForRole(profile?.activeRole)

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-[#040506] to-transparent"
      />
      <div className="mx-auto flex max-w-md items-center border-t border-white/[0.06] bg-[#040506]/85 px-2 pb-7 pt-3.5 backdrop-blur-xl">
        {items.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className="h-5 w-5 transition-colors"
                style={{
                  color: isActive ? "var(--accent-cyan)" : "rgba(255,255,255,0.4)",
                  filter: isActive
                    ? "drop-shadow(0 0 6px var(--accent-cyan))"
                    : "none",
                }}
                strokeWidth={1.75}
              />
              <span
                className="font-mono text-[10px] uppercase tracking-[0.03em] whitespace-nowrap"
                style={{
                  color: isActive ? "var(--accent-cyan)" : "rgba(255,255,255,0.5)",
                }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
