import { useEffect } from "react"
import { createPortal } from "react-dom"
import {
  X,
  MessageSquarePlus,
  MessageCircle,
  RefreshCw,
  LogOut,
  Shield,
  IdCard,
  LifeBuoy,
} from "lucide-react"
import { useLocation } from "wouter"
import { useClerk } from "@clerk/react"
import { useFeedback } from "@/contexts/FeedbackContext"
import { useUserProfile, type Role } from "@/contexts/UserContext"
import { useClubMembership } from "@/hooks/use-club"
import { useAdminWhoami } from "@/hooks/use-bug-reports"
import { chaptersForRole } from "@/lib/chapters"

// Hoofdmenu — één bron van waarheid met het startscherm (lib/chapters). Naast
// de hoofdstukken huisvest het de rustige secundaire acties die uit de
// bovenbalk zijn verhuisd: Vraag Sparki, rolwissel, Sportpaspoort, feedback
// en uitloggen. Club verschijnt alleen bij een echte, geaccepteerde
// trainerkoppeling.

const ROLE_LABEL: Record<Role, string> = {
  athlete: "Sporter",
  coach: "Coach",
  parent: "Ouder",
  nutrition_specialist: "Voedingsdeskundige",
}

function isActiveHref(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href)
}

export function MainMenu({
  open,
  onClose,
  onOpenChat,
}: {
  open: boolean
  onClose: () => void
  onOpenChat?: () => void
}) {
  const [pathname, setLocation] = useLocation()
  const { openFeedback } = useFeedback()
  const { profile, switchRole } = useUserProfile()
  const { signOut } = useClerk()
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "")
  const role = profile?.activeRole as Role | undefined
  // Club-poort: alleen een GEACCEPTEERDE trainerkoppeling telt. Nooit gefingeerd.
  const { isMember } = useClubMembership()
  // Admin-ingang: alleen zichtbaar wanneer de server bevestigt dat dit account
  // admin is (whoami) — de echte poort blijft server-side op elke admin-route.
  const { data: adminWho } = useAdminWhoami()
  const isAdmin = adminWho?.isAdmin === true

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

  const chapters = chaptersForRole(role, isMember)
  const roles = (profile?.roles ?? []) as Role[]
  const active = (profile?.activeRole ?? "athlete") as Role
  const testerLabel =
    profile?.isHeadTester && typeof profile.headTesterNumber === "number"
      ? `Tester #${String(profile.headTesterNumber).padStart(3, "0")}`
      : profile?.isHeadTester
        ? "Tester"
        : null

  const go = (href: string) => {
    onClose()
    setLocation(href)
  }
  const cycleRole = () => {
    const idx = roles.indexOf(active)
    const next = roles[(idx + 1) % roles.length]
    if (next && next !== active) void switchRole(next)
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
            {testerLabel && (
              <span
                className="ml-1 flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em]"
                style={{
                  color: "oklch(0.82 0.16 200)",
                  background: "rgba(120,210,230,0.07)",
                  border: "1px solid rgba(120,210,230,0.22)",
                }}
              >
                <Shield className="h-2.5 w-2.5" strokeWidth={2} />
                {testerLabel}
              </span>
            )}
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

        {/* Vraag Sparki — prominent bovenin het menu (verhuisd uit de bovenbalk). */}
        {onOpenChat && (
          <button
            type="button"
            onClick={() => {
              onClose()
              onOpenChat()
            }}
            className="mt-6 flex items-center gap-3 rounded-2xl border border-cyan-300/30 bg-cyan-300/[0.08] px-4 py-3.5 text-left backdrop-blur-md transition-colors hover:bg-cyan-300/[0.14]"
          >
            <MessageCircle className="h-5 w-5 text-cyan-300" strokeWidth={1.75} />
            <span>
              <span className="block text-[15px] font-medium text-white/92">Analyse openen</span>
              <span className="block text-[11px] text-white/45">Bespreek je training, belasting en voortgang</span>
            </span>
          </button>
        )}

        <div className="mt-4 grid grid-cols-2 gap-3">
          {chapters.map((c) => {
            const Icon = c.icon
            const chapterActive = isActiveHref(pathname, c.href)
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => go(c.href)}
                aria-current={chapterActive ? "page" : undefined}
                className="group flex min-h-[7.5rem] flex-col justify-between rounded-2xl border p-4 text-left backdrop-blur-md transition-colors"
                style={{
                  borderColor: chapterActive
                    ? "rgba(120,210,230,0.45)"
                    : "rgba(255,255,255,0.10)",
                  background: chapterActive
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
                      color: chapterActive
                        ? "var(--accent-cyan)"
                        : "rgba(255,255,255,0.75)",
                    }}
                  />
                </span>
                <span className="mt-3">
                  <span
                    className="block text-[15px] font-medium"
                    style={{
                      color: chapterActive ? "var(--accent-cyan)" : "rgba(255,255,255,0.92)",
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

        {/* Rustige secundaire acties. */}
        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          {(role === "athlete" || role === undefined) && (
            <button
              type="button"
              onClick={() => go("/paspoort")}
              className="flex items-center gap-2.5 rounded-full border border-white/15 px-4 py-2 text-[13px] text-white/75 transition-colors hover:border-cyan-300/40 hover:text-cyan-300"
            >
              <IdCard className="h-4 w-4" strokeWidth={1.75} />
              Sportpaspoort
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => go("/admin")}
              className="flex items-center gap-2.5 rounded-full border border-white/15 px-4 py-2 text-[13px] text-white/75 transition-colors hover:border-cyan-300/40 hover:text-cyan-300"
            >
              <Shield className="h-4 w-4" strokeWidth={1.75} />
              Admin
            </button>
          )}
          <button
            type="button"
            onClick={() => go("/support")}
            className="flex items-center gap-2.5 rounded-full border border-white/15 px-4 py-2 text-[13px] text-white/75 transition-colors hover:border-cyan-300/40 hover:text-cyan-300"
          >
            <LifeBuoy className="h-4 w-4" strokeWidth={1.75} />
            Hulp &amp; ondersteuning
          </button>
          <button
            type="button"
            onClick={() => {
              onClose()
              openFeedback()
            }}
            className="flex items-center gap-2.5 rounded-full border border-white/15 px-4 py-2 text-[13px] text-white/75 transition-colors hover:border-cyan-300/40 hover:text-cyan-300"
          >
            <MessageSquarePlus className="h-4 w-4" strokeWidth={1.75} />
            Feedback of bug melden
          </button>
          {roles.length > 1 && (
            <button
              type="button"
              onClick={cycleRole}
              className="flex items-center gap-2.5 rounded-full border border-white/15 px-4 py-2 text-[13px] text-white/75 transition-colors hover:border-cyan-300/40 hover:text-cyan-300"
              title="Wissel van rol"
            >
              <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
              Rol: {ROLE_LABEL[active]}
            </button>
          )}
          {profile && (
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: basePath || "/" })}
              className="flex items-center gap-2.5 rounded-full border border-white/15 px-4 py-2 text-[13px] text-white/75 transition-colors hover:border-red-300/40 hover:text-red-300"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
              Uitloggen
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
