import {
  Home,
  Sun,
  Dumbbell,
  Map,
  Trophy,
  LayoutGrid,
  User,
  UserPlus,
  Radio,
  type LucideIcon,
} from "lucide-react"
import { Link, useLocation } from "wouter"
import { useUserProfile } from "@/contexts/UserContext"
import type { Role } from "@/contexts/UserContext"
import {
  ATHLETE_NAV_ENTRIES,
  COACH_NAV_ENTRIES,
  PARENT_NAV_ENTRIES,
  type NavEntry,
} from "@/lib/chapters"

type NavItem = NavEntry & { icon: LucideIcon }

// Vijf hoofdkeuzes voor de sporter: Vandaag · Trainen · Rijden · Wedstrijd ·
// Meer. Alle overige hoofdstukken (Jij, Lichaam, Mechanieker, Samen, enz.)
// blijven bereikbaar via Meer, het startoverzicht (/) en het hoofdmenu.
// De lijsten zelf staan in lib/chapters (één bron van waarheid + testbaar);
// hier worden alleen de iconen eraan gekoppeld.
const NAV_ICONS: Record<string, LucideIcon> = {
  "/vandaag": Sun,
  "/train": Dumbbell,
  "/routes": Map,
  "/races": Trophy,
  "/meer": LayoutGrid,
  "/": Home,
  "/invitations": UserPlus,
  "/you": User,
  "/feed": Radio,
}

function withIcons(entries: NavEntry[]): NavItem[] {
  return entries.map((e) => ({ ...e, icon: NAV_ICONS[e.href] ?? Home }))
}

const ATHLETE_NAV: NavItem[] = withIcons(ATHLETE_NAV_ENTRIES)
const COACH_NAV: NavItem[] = withIcons(COACH_NAV_ENTRIES)
const PARENT_NAV: NavItem[] = withIcons(PARENT_NAV_ENTRIES)

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
