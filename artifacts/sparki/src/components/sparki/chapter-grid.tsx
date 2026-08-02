import { useLocation } from "wouter"
import { useUserProfile, type Role } from "@/contexts/UserContext"
import { useClubMembership } from "@/hooks/use-club"
import { chaptersForRole, type Chapter } from "@/lib/chapters"

// Herbruikbaar hoofdstukkenraster. Ontworpen om op gangbare telefoons zonder
// verticaal scrollen te passen: drie kolommen met compacte, automatisch
// schalende tegels (clamp-groottes), grote aanraakvlakken (≥64 px hoog) en een
// subtiele 3D-diepte (gradient + schaduw + press-effect). Professioneel en
// rustig — geen kinderachtige kleuren.
export function ChapterGrid({
  onNavigate,
  compact = false,
  chapters: chaptersProp,
}: {
  onNavigate?: () => void
  compact?: boolean
  // Optioneel: expliciete lijst (bijv. de Meer-pagina). Zonder prop blijft het
  // rooster de rolgebonden hoofdstukkenlijst tonen (startscherm/hoofdmenu).
  chapters?: Chapter[]
}) {
  const [pathname, setLocation] = useLocation()
  const { profile } = useUserProfile()
  const role = profile?.activeRole as Role | undefined
  const { isMember } = useClubMembership()
  const chapters = chaptersProp ?? chaptersForRole(role, isMember)

  const go = (href: string) => {
    onNavigate?.()
    setLocation(href)
  }

  return (
    <div
      className="grid grid-cols-3 gap-[clamp(0.4rem,1.8vw,0.75rem)]"
      role="navigation"
      aria-label="Hoofdstukken"
    >
      {chapters.map((c) => {
        const Icon = c.icon
        const active =
          c.href === "/" ? pathname === "/" : pathname.startsWith(c.href)
        return (
          <button
            key={c.href + c.label}
            type="button"
            onClick={() => go(c.href)}
            aria-current={active ? "page" : undefined}
            className="group flex min-h-[clamp(4rem,9.5dvh,5.5rem)] flex-col items-center justify-center gap-[clamp(0.25rem,0.8vw,0.45rem)] rounded-2xl border px-1.5 py-2 text-center transition-transform duration-150 active:scale-[0.97]"
            style={{
              borderColor: active
                ? "rgba(120,210,230,0.45)"
                : "rgba(255,255,255,0.10)",
              background: active
                ? "linear-gradient(160deg, rgba(120,210,230,0.14), rgba(120,210,230,0.05))"
                : "linear-gradient(160deg, rgba(16,26,38,0.9), rgba(7,13,22,0.82))",
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.06) inset, 0 6px 14px -8px rgba(0,0,0,0.7)",
            }}
          >
            <Icon
              className="h-[clamp(1.05rem,2.4dvh,1.35rem)] w-[clamp(1.05rem,2.4dvh,1.35rem)]"
              strokeWidth={1.75}
              style={{
                color: active ? "var(--accent-cyan)" : "rgba(255,255,255,0.78)",
              }}
            />
            <span
              className="block w-full truncate px-0.5 text-[clamp(10px,1.5dvh,12px)] font-medium leading-tight"
              style={{
                color: active ? "var(--accent-cyan)" : "rgba(255,255,255,0.88)",
              }}
            >
              {c.label}
            </span>
            {!compact && (
              <span className="hidden w-full truncate text-[10px] leading-tight text-muted-foreground min-[380px]:block">
                {c.hint}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
