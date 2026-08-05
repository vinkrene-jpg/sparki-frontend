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
import { Link, useLocation, useSearch } from "wouter"
import { useUserProfile } from "@/contexts/UserContext"
import type { Role } from "@/contexts/UserContext"
import {
  ATHLETE_NAV_ENTRIES,
  COACH_NAV_ENTRIES,
  PARENT_NAV_ENTRIES,
  NUTRITION_SPECIALIST_NAV_ENTRIES,
  clubNavEntriesFor,
  type NavEntry,
} from "@/lib/chapters"
import { useClubNavStand } from "@/lib/club-nav"
import { useMyClubs } from "@/hooks/use-club"
import { Building2, CalendarDays, Users, MessageSquare, FileText } from "lucide-react"

type NavItem = NavEntry & { icon: LucideIcon }

// Vijf hoofdkeuzes voor de sporter: Vandaag · Trainen · Routes · Wedstrijd ·
// Meer. Alle overige hoofdstukken (Jij, Lichaam, Mechanieker, Samen, enz.)
// blijven bereikbaar via Meer, het startoverzicht (/) en het hoofdmenu.
// De lijsten zelf staan in lib/chapters (één bron van waarheid + testbaar);
// hier worden alleen de iconen eraan gekoppeld.
const NAV_ICONS: Record<string, LucideIcon> = {
  "/dashboard": Sun,
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
const NUTRITION_NAV: NavItem[] = withIcons(NUTRITION_SPECIALIST_NAV_ENTRIES)

function navForRole(role: Role | null | undefined): NavItem[] {
  if (role === "coach") return COACH_NAV
  if (role === "parent") return PARENT_NAV
  // BB-14: eigen rolomgeving, geen terugval op de sporterbalk.
  if (role === "nutrition_specialist") return NUTRITION_NAV
  return ATHLETE_NAV
}

// C2: iconen voor clubbalk-labels (op label, want hrefs dragen tab-params).
const CLUB_LABEL_ICONS: Record<string, LucideIcon> = {
  Organisatie: Building2,
  Leden: Users,
  Agenda: CalendarDays,
  Berichten: MessageSquare,
  Trainingen: Dumbbell,
  Groepen: Users,
  Wedstrijden: Trophy,
  Documenten: FileText,
  Club: Building2,
  Meer: LayoutGrid,
}

function withClubIcons(entries: NavEntry[]): NavItem[] {
  return entries.map((e) => ({ ...e, icon: CLUB_LABEL_ICONS[e.label] ?? Building2 }))
}

/** Is dit nav-item actief, rekening houdend met een eventuele ?tab=. */
function itemActive(href: string, pathname: string, search: string): boolean {
  const [path, query] = href.split("?")
  if (href === "/") return pathname === "/"
  if (!pathname.startsWith(path!)) return false
  if (!query) return true
  const wantTab = new URLSearchParams(query).get("tab")
  const haveTab = new URLSearchParams(search).get("tab")
  // Zonder tab in de URL is het eerste tabblad van dat scherm actief.
  return wantTab === (haveTab ?? wantTab)
}

export function BottomNav() {
  const [pathname] = useLocation()
  const search = useSearch()
  const { profile } = useUserProfile()
  const { data: myClubs } = useMyClubs()
  // C2 (besluit 01-08): actieve clubcontext ⇒ eigen clubbalk, géén terugval
  // op de sporterbalk. Fail-closed + C-T6-standaard voor clubbeheer zitten
  // in useClubNavStand (server bevestigt het lidmaatschap).
  const stand = useClubNavStand(myClubs)
  const clubEntries =
    stand && profile?.activeRole === "athlete" ? clubNavEntriesFor(stand.role) : null
  const items = clubEntries ? withClubIcons(clubEntries) : navForRole(profile?.activeRole)

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-10 h-10 bg-gradient-to-t from-background to-transparent"
      />
      <div className="mx-auto flex max-w-md items-center border-t border-border bg-background/85 px-2 pb-7 pt-3.5 backdrop-blur-xl">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = itemActive(item.href, pathname, search)
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
                  // LICHT_THEMA_01: inactief = gedempte donkere voorgrond
                  // (leesbaar op licht), actief = merkaccent. Geen gloed op
                  // licht — de accentkleur zelf draagt de actieve staat.
                  color: isActive
                    ? "var(--accent-cyan)"
                    : "var(--color-muted-foreground)",
                }}
                strokeWidth={1.75}
              />
              <span
                className="font-mono text-[10px] uppercase tracking-[0.03em] whitespace-nowrap"
                style={{
                  color: isActive
                    ? "var(--accent-cyan)"
                    : "var(--color-muted-foreground)",
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
