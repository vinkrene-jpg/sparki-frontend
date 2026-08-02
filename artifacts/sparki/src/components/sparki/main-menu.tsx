import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import {
  X,
  MessageSquarePlus,
  MessageCircle,
  RefreshCw,
  LogOut,
  Shield,
  ShieldCheck,
  IdCard,
  LifeBuoy,
  CreditCard,
} from "lucide-react"
import { useLocation } from "wouter"
import { useQueryClient } from "@tanstack/react-query"
import { useClerk } from "@clerk/react"
import { useFeedback } from "@/contexts/FeedbackContext"
import { useUserProfile, type Role } from "@/contexts/UserContext"
import { useClubMembership, useMyClubs } from "@/hooks/use-club"
import { roleStartFor } from "@/lib/role-start"
import { useAdminWhoami } from "@/hooks/use-bug-reports"
import { chaptersForRole, ROLE_LABELS } from "@/lib/chapters"
import { ErrorBoundary } from "@/components/sparki/error-boundary"
import { useBillingStatus } from "@/hooks/use-billing"

// Hoofdmenu — één bron van waarheid met het startscherm (lib/chapters). Naast
// de hoofdstukken huisvest het de rustige secundaire acties die uit de
// bovenbalk zijn verhuisd: Vraag Sparki, rolwissel, Sportpaspoort, feedback
// en uitloggen. Club verschijnt alleen bij een echte, geaccepteerde
// trainerkoppeling.

// F4: rollabels komen uit één bron van waarheid (lib/chapters ROLE_LABELS).
const ROLE_LABEL = ROLE_LABELS

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
  const qc = useQueryClient()
  const { openFeedback } = useFeedback()
  const { profile, switchRole } = useUserProfile()
  const { signOut } = useClerk()
  const basePath = (import.meta.env?.BASE_URL ?? "/").replace(/\/$/, "")
  const role = profile?.activeRole as Role | undefined
  // Club-poort: alleen een GEACCEPTEERDE trainerkoppeling telt. Nooit gefingeerd.
  const { isMember } = useClubMembership()
  const { data: myClubs } = useMyClubs()
  const [wisselOpen, setWisselOpen] = useState(false)
  const [contextFilter, setContextFilter] = useState("")
  // Admin-ingang: alleen zichtbaar wanneer de server bevestigt dat dit account
  // admin is (whoami) — de echte poort blijft server-side op elke admin-route.
  const { data: adminWho } = useAdminWhoami()
  const isAdmin = adminWho?.isAdmin === true
  // Huidige abonnementslaag — alleen presentatie; de server blijft de poort.
  // Faalt stil: geen billing-status ⇒ geen badge (nooit de rest meetrekken).
  const { data: billing } = useBillingStatus()
  const tierBadge =
    billing?.status === "legacy_unrestricted"
      ? "Volledig"
      : billing?.tier === "GO"
        ? "Go"
        : billing?.tier === "COMPLETE"
          ? "Compleet"
          : billing
            ? "Gratis"
            : null

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

  // Fail-closed op de hoofdstukkenlijst: een onbekende rolwaarde uit
  // productie mag nooit een niet-array of misvormde rij (zonder icon/label)
  // opleveren die bij het renderen op undefined.icon crasht. We filteren
  // misvormde rijen weg en waarschuwen luid zodat het niet stil misgaat.
  const chaptersRaw = chaptersForRole(role, isMember)
  const chapters = (Array.isArray(chaptersRaw) ? chaptersRaw : []).filter((c) => {
    // Een lucide-icoon is een function óf een forwardRef/memo-object — beide
    // zijn geldig; alleen null/undefined of een ontbrekende href is misvormd.
    const iconOk = c != null && c.icon != null
    const ok = iconOk && typeof c.href === "string"
    if (!ok) console.warn("[MainMenu] misvormd hoofdstuk overgeslagen:", c)
    return ok
  })
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

  // Rolwissel end-to-end: server bevestigt de actieve rol (switchRole →
  // PUT /api/auth/me/role → profiel bijgewerkt), daarna verversen we ALLE
  // queries (de vorige rol z'n dashboard-data mag niet blijven hangen) en
  // navigeren we naar het rolstartscherm. Elke globale rol rendert z'n eigen
  // start op "/" (RoleHome is rolbewust: coach/ouder/voeding/sporter), dus
  // "/" is het juiste, begrijpelijke startpunt na een wissel — ook wanneer je
  // vanaf een rolvreemde pagina wisselt.
  const switchToRole = async (r: Role) => {
    if (r === active) return
    onClose()
    try {
      await switchRole(r)
    } catch (err) {
      console.error("[MainMenu] rolwissel mislukt", err)
      return
    }
    // Verse data voor de nieuwe rol; daarna naar het rolstartscherm.
    void qc.invalidateQueries()
    setLocation("/")
  }

  // Besluitenpatch 2026-08-01 (hoofdstuk B): de rolwisselaar toont een lijst
  // van ALLE contexten (accountrollen + clubcontexten). Bij meer dan vijf
  // contexten verschijnt een zoekveld. De actieve context blijft daarnaast
  // permanent zichtbaar in de schilkop (DsContextRegel).
  const contexts = useMemo(() => {
    const items: { key: string; label: string; onSelect: () => void; actief: boolean }[] =
      roles.map((r) => ({
        key: `rol:${r}`,
        label: `Rol: ${ROLE_LABEL[r] ?? r}`,
        actief: r === active,
        onSelect: () => {
          void switchToRole(r)
        },
      }))
    // Fail-closed: de server kan bij storing (prod gaf op /api/clubs eerder
    // 500/afwijkende vorm) iets anders dan een array teruggeven, of rijen
    // zonder membership. Nooit blind itereren: alleen echte arrays, en per
    // rij misvormde data overslaan (met een luide console.warn zodat het
    // niet stil kapotgaat) i.p.v. de hele pagina meenemen.
    if (!Array.isArray(myClubs)) {
      if (myClubs != null) {
        console.warn("[MainMenu] verwacht een array van clubs, kreeg:", myClubs)
      }
    } else {
      for (const row of myClubs) {
        const membership = row?.membership
        if (!membership || membership.clubId == null) {
          console.warn("[MainMenu] clubrij zonder geldige membership overgeslagen:", row)
          continue
        }
        const clubRol = membership.role
        const clubRolLabel =
          (clubRol ? roleStartFor(clubRol)?.label : null) ?? clubRol ?? "Onbekende rol"
        items.push({
          key: `club:${membership.clubId}`,
          label: `${row?.club?.name ?? "Club"} — ${clubRolLabel}`,
          actief: false,
          onSelect: () => go("/club"),
        })
      }
    }
    return items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles.join(","), active, myClubs])
  const toonZoekveld = contexts.length > 5
  const zichtbareContexts = contextFilter.trim()
    ? contexts.filter((c) => c.label.toLowerCase().includes(contextFilter.trim().toLowerCase()))
    : contexts

  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col overflow-y-auto overscroll-contain">
      <button
        type="button"
        aria-label="Menu sluiten"
        onClick={onClose}
        className="fixed inset-0 bg-[#03050a]/80 backdrop-blur-md"
      />
      {/* Foutisolatie: een fout binnen het menu mag NOOIT de onderliggende
          pagina meenemen. De boundary vangt de fout op en toont een nette
          Nederlandse melding IN het menu-overlay, met een sluitknop die
          onClose aanroept zodat je gewoon terug bent op de pagina. */}
      <ErrorBoundary
        fallback={
          <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-base font-semibold text-white/85">
              Het menu kon niet worden geladen
            </p>
            <p className="max-w-xs text-sm text-white/45">
              Er ging iets mis in het menu. De pagina zelf blijft gewoon staan —
              sluit het menu en probeer het opnieuw.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-full border border-white/15 px-4 py-2 text-sm text-white/70 transition-colors hover:border-cyan-300/40 hover:text-cyan-300"
            >
              Menu sluiten
            </button>
          </div>
        }
      >
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
          {(role === "athlete" || role === undefined) && (
            <button
              type="button"
              onClick={() => go("/ai-toestemming")}
              className="flex items-center gap-2.5 rounded-full border border-white/15 px-4 py-2 text-[13px] text-white/75 transition-colors hover:border-cyan-300/40 hover:text-cyan-300"
            >
              <ShieldCheck className="h-4 w-4" strokeWidth={1.75} />
              AI-toestemming
            </button>
          )}
          {(role === "athlete" || role === undefined) && (
            <button
              type="button"
              onClick={() => go("/abonnement")}
              className="flex items-center gap-2.5 rounded-full border border-white/15 px-4 py-2 text-[13px] text-white/75 transition-colors hover:border-cyan-300/40 hover:text-cyan-300"
            >
              <CreditCard className="h-4 w-4" strokeWidth={1.75} />
              Abonnement
              {tierBadge && (
                <span className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-[10px] font-medium text-cyan-200">
                  {tierBadge}
                </span>
              )}
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
          {contexts.length > 1 && (
            <div className="w-full">
              <button
                type="button"
                onClick={() => setWisselOpen((v) => !v)}
                aria-expanded={wisselOpen}
                className="flex items-center gap-2.5 rounded-full border border-white/15 px-4 py-2 text-[13px] text-white/75 transition-colors hover:border-cyan-300/40 hover:text-cyan-300"
                title="Wissel van context"
              >
                <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
                Context: {ROLE_LABEL[active] ?? String(active)}
              </button>
              {wisselOpen && (
                <div className="mt-2 space-y-1 rounded-2xl border border-white/10 bg-white/[0.03] p-2">
                  {toonZoekveld && (
                    <input
                      type="search"
                      value={contextFilter}
                      onChange={(e) => setContextFilter(e.target.value)}
                      placeholder="Zoek een context…"
                      aria-label="Zoek een context"
                      className="mb-1 w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-[13px] text-white/85 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-cyan-300/50"
                    />
                  )}
                  {zichtbareContexts.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => {
                        setWisselOpen(false)
                        c.onSelect()
                      }}
                      className={`flex w-full items-center rounded-lg px-3 py-2 text-left text-[13px] transition-colors ${
                        c.actief
                          ? "text-cyan-300"
                          : "text-white/75 hover:bg-white/[0.06] hover:text-white"
                      }`}
                      aria-current={c.actief ? "true" : undefined}
                    >
                      {c.label}
                      {c.actief && <span className="ml-2 text-[11px] text-white/45">actief</span>}
                    </button>
                  ))}
                  {zichtbareContexts.length === 0 && (
                    <p className="px-3 py-2 text-[13px] text-white/45">
                      Geen context gevonden voor deze zoekterm.
                    </p>
                  )}
                </div>
              )}
            </div>
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
      </ErrorBoundary>
    </div>,
    document.body,
  )
}
