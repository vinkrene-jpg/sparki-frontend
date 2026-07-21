import { useEffect } from "react"
import { createPortal } from "react-dom"
import {
  Home,
  Dumbbell,
  Trophy,
  HeartPulse,
  Wrench,
  Map,
  Users,
  User,
  CalendarDays,
  Building2,
  UserPlus,
  Radio,
  X,
} from "lucide-react"
import { useLocation } from "wouter"
import { useUserProfile, type Role } from "@/contexts/UserContext"
import { useMyLinks } from "@/hooks/use-links"

type Chapter = {
  href: string
  icon: typeof Home
  label: string
  hint: string
}

// Chapter model — the app is organised in hoofdstukken (chapters) that bundle
// related surfaces so each can offer more depth. Every screen opens this menu
// from the header; there is no bottom tab bar. Vandaag is always first.
const ATHLETE_CHAPTERS: Chapter[] = [
  { href: "/", icon: Home, label: "Vandaag", hint: "Dagstart & moment" },
  { href: "/train", icon: Dumbbell, label: "Trainen", hint: "Schema & verloop" },
  { href: "/races", icon: Trophy, label: "Wedstrijd", hint: "Races & voorbereiding" },
  { href: "/lichaam", icon: HeartPulse, label: "Lichaam", hint: "Voeding, herstel, gezondheid" },
  { href: "/mechanieker", icon: Wrench, label: "Mechanieker", hint: "Materiaal & onderhoud" },
  { href: "/routes", icon: Map, label: "Routes", hint: "Routes, GPX & kaart" },
  { href: "/samen", icon: Users, label: "Samen", hint: "Team, vrienden & nieuws" },
  { href: "/you", icon: User, label: "Jij", hint: "Profiel, doelen & koppelingen" },
  { href: "/kalender", icon: CalendarDays, label: "Kalender", hint: "Trainingen & wedstrijden" },
]

// Club is only shown to athletes who are actually linked to a coach — i.e. they
// belong to a club whose trainer uses Sparki. Never faked: the link must exist.
const CLUB_CHAPTER: Chapter = {
  href: "/samen",
  icon: Building2,
  label: "Club",
  hint: "Clubtrainingen & coach",
}

const COACH_CHAPTERS: Chapter[] = [
  { href: "/", icon: Home, label: "Vandaag", hint: "Dagstart" },
  { href: "/samen", icon: Users, label: "Samen", hint: "Team & vrienden" },
  { href: "/invitations", icon: UserPlus, label: "Uitnodigen", hint: "Sporters koppelen" },
  { href: "/you", icon: User, label: "Profiel", hint: "Jouw gegevens" },
]

const PARENT_CHAPTERS: Chapter[] = [
  { href: "/", icon: Home, label: "Vandaag", hint: "Dagstart" },
  { href: "/feed", icon: Radio, label: "Nieuws", hint: "Wat er speelt" },
  { href: "/invitations", icon: UserPlus, label: "Uitnodigen", hint: "Koppelen" },
  { href: "/you", icon: User, label: "Profiel", hint: "Jouw gegevens" },
]

function isActiveHref(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href)
}

export function MainMenu({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [pathname, setLocation] = useLocation()
  const { profile } = useUserProfile()
  const role = profile?.activeRole as Role | undefined
  // Club gate — an accepted/pending coach link is the honest signal that the
  // athlete's trainer is on Sparki. Only queried; never fabricated.
  const { data: links } = useMyLinks(role === "athlete" || role === undefined)
  const hasCoach = (links?.coaches?.length ?? 0) > 0

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  let chapters: Chapter[]
  if (role === "coach") chapters = COACH_CHAPTERS
  else if (role === "parent") chapters = PARENT_CHAPTERS
  else chapters = hasCoach ? [...ATHLETE_CHAPTERS, CLUB_CHAPTER] : ATHLETE_CHAPTERS

  const go = (href: string) => {
    onClose()
    setLocation(href)
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col overflow-y-auto overscroll-contain">
      <button
        type="button"
        aria-label="Menu sluiten"
        onClick={onClose}
        className="fixed inset-0 bg-[#03050a]/80 backdrop-blur-md"
      />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-16 pt-12">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" />
            </span>
            <span className="font-mono text-[11px] tracking-[0.35em] text-white/70">
              HOOFDMENU
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="rounded-full border border-white/15 p-2 text-white/60 transition-colors hover:border-cyan-300/40 hover:text-cyan-300"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </header>

        <div className="mt-8 grid grid-cols-2 gap-3">
          {chapters.map((c) => {
            const Icon = c.icon
            const active = isActiveHref(pathname, c.href)
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => go(c.href)}
                aria-current={active ? "page" : undefined}
                className="group flex min-h-[7.5rem] flex-col justify-between rounded-2xl border p-4 text-left backdrop-blur-md transition-colors"
                style={{
                  borderColor: active
                    ? "rgba(120,210,230,0.45)"
                    : "rgba(255,255,255,0.10)",
                  background: active
                    ? "rgba(120,210,230,0.10)"
                    : "rgba(7,13,22,0.82)",
                }}
              >
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08]"
                  style={{ background: "rgba(120,210,230,0.08)" }}
                >
                  <Icon
                    className="h-5 w-5"
                    strokeWidth={1.75}
                    style={{
                      color: active
                        ? "var(--accent-cyan)"
                        : "rgba(255,255,255,0.75)",
                    }}
                  />
                </span>
                <span className="mt-3">
                  <span
                    className="block text-[15px] font-medium"
                    style={{
                      color: active ? "var(--accent-cyan)" : "rgba(255,255,255,0.92)",
                    }}
                  >
                    {c.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-white/40">
                    {c.hint}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
