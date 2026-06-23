import { Home, Bike, Flag, Radio, FlaskConical, User, UserPlus, BookOpen } from "lucide-react"
import { Link, useLocation } from "wouter"
import { useUserProfile } from "@/contexts/UserContext"
import type { Role } from "@/contexts/UserContext"
import { useFeatureFlag } from "@/hooks/use-feature-flag"

type NavItem = {
  href: string
  icon: typeof Home
  label: string
}

const ATHLETE_NAV: NavItem[] = [
  { href: "/", icon: Home, label: "Vandaag" },
  { href: "/train", icon: Bike, label: "Training" },
  { href: "/races", icon: Flag, label: "Races" },
  { href: "/feed", icon: Radio, label: "Nieuws" },
  { href: "/lab", icon: FlaskConical, label: "Inzicht" },
  { href: "/you", icon: User, label: "Profiel" },
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
  const knowledgeOn = useFeatureFlag("knowledge_base")
  let items = navForRole(profile?.activeRole)
  // Knowledge base is flag-gated and only surfaced for athletes; replace the
  // lower-priority "Races" slot to keep the bar from overcrowding.
  if (knowledgeOn && profile?.activeRole !== "coach" && profile?.activeRole !== "parent") {
    items = [
      ...items.filter((i) => i.href !== "/races"),
      { href: "/kennis", icon: BookOpen, label: "Kennis" },
    ]
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-[#040506] to-transparent"
      />
      <div className="mx-auto flex max-w-md items-center justify-between border-t border-white/[0.06] bg-[#040506]/85 px-7 pb-7 pt-3.5 backdrop-blur-xl">
        {items.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1.5"
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
                className="font-mono text-[10px] uppercase tracking-[0.12em]"
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
