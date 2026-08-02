// DASHBOARD_01 Fase B — herbruikbaar drie-lagen dashboardskelet voor alle
// niet-sporterrollen (DSH-08/09/13a, tabel §3).
//
// Eén scherm, drie lagen van boven naar beneden — hetzelfde skelet als de
// sporter, andere inhoud per rol:
//   Laag 1 — Waar sta je.  HARDE EIS: één visueel element (DSH-05/20). Niet vier
//            tegels, niet een cijfermuur. Eén beeld dat in één blik te lezen is.
//   Laag 2 — Wat vraagt aandacht.  Eén ding met een actie, boven de vouw
//            (DSH-06/19, 402×874).
//   Laag 3 — Risico's en kansen.  Mag onder de vouw.
//
// Regels die dit skelet AFDWINGT:
//   • Een laag zonder inhoud wordt WEGGELATEN — geen lege kaart, geen mededeling
//     dat er niets is (DSH-08/21).
//   • De inhoud volgt de BESTAANDE rechtenlaag; dit skelet is puur presentatie
//     en voegt geen tweede rechtenlaag toe (DSH-09/23).
//   • Licht en rustig, geen donkere/filmische opmaak (DSH-16..18).
//
// Rollen leveren hun lagen als props aan; wat er niet is geven ze door als
// `null` (of een lege lijst voor laag 3) zodat de laag eerlijk verdwijnt.

import type { ReactNode } from "react"
import { Link } from "wouter"
import { ChevronRight } from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { ACCENT } from "@/components/sparki/ui"

const CARD =
  "rounded-2xl border border-border bg-card p-5 backdrop-blur-md"

// ── Laag 1: het ene visuele element (DSH-05/20) ──────────────────────────────
// Eén rustige band bovenaan met een kop, één grote leesbare waarde en een korte
// duiding. Bewust GEEN tegelraster of cijfermuur: precies één beeld.
export type Layer1 = {
  /** Kleine bovenkop, bv. "Jouw sporters" of "Ledenbestand". */
  kicker: string
  /** De ene leesbare hoofdwaarde ("12", "3 groepen", …). */
  value: string
  /** Eén regel duiding onder de waarde — waar sta je in één blik. */
  meaning: string
  /** Optionele accentkleur (clubkleur/teamkleur uit bestaande data). */
  accent?: string | null
  /** Optionele fijne detailregel (bv. een trend uit bestaande data). */
  detail?: string | null
}

function Layer1Band({ kicker, value, meaning, accent, detail }: Layer1) {
  const color = accent ?? ACCENT
  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 backdrop-blur-md"
      data-testid="dashboard-laag1"
      aria-label={kicker}
    >
      {/* Zachte lichtgloed voor diepte — licht en rustig (DSH-16). */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-[0.18] blur-3xl"
        style={{ background: color }}
      />
      <p
        className="font-mono text-[10px] uppercase tracking-[0.24em]"
        style={{ color }}
      >
        {kicker}
      </p>
      <p className="mt-3 font-sans text-[40px] font-light leading-none tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-3 max-w-sm text-[15px] font-light leading-snug tracking-tight text-foreground/80">
        {meaning}
      </p>
      {detail && (
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{detail}</p>
      )}
    </section>
  )
}

// ── Laag 2: het ene aandachtsding met actie (DSH-06/19) ──────────────────────
export type Layer2 = {
  /** Titel van het ene ding dat aandacht vraagt. */
  title: string
  /** Eén regel context. */
  body: string
  /** Waar de actie heen gaat (bestaand werkscherm). */
  href: string
  /** Label van de actie. */
  actionLabel: string
  /** Optioneel: extra nadruk (urgent) — warme rand. */
  urgent?: boolean
}

function Layer2Block({ title, body, href, actionLabel, urgent }: Layer2) {
  return (
    <section
      className={CARD}
      data-testid="dashboard-laag2"
      style={urgent ? { borderColor: "oklch(0.78 0.16 60 / 0.5)" } : undefined}
    >
      <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
        Vraagt aandacht
      </p>
      <h2 className="mt-2 text-[16px] font-medium leading-snug tracking-tight text-foreground">
        {title}
      </h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{body}</p>
      <Link
        href={href}
        className="mt-3 inline-flex items-center gap-1 text-[13px]"
        style={{ color: ACCENT }}
      >
        {actionLabel}
        <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
      </Link>
    </section>
  )
}

// ── Laag 3: risico's en kansen (mag onder de vouw) ───────────────────────────
export type Layer3Item = {
  key: string
  title: string
  body?: string | null
  href?: string | null
  actionLabel?: string | null
}

function Layer3List({ title, items }: { title: string; items: Layer3Item[] }) {
  return (
    <section className="space-y-3" data-testid="dashboard-laag3">
      <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
        {title}
      </p>
      <div className="space-y-2.5">
        {items.map((it) => (
          <div
            key={it.key}
            className="rounded-2xl border border-border bg-muted p-4"
          >
            <p className="text-[14px] tracking-tight text-foreground/90">{it.title}</p>
            {it.body && (
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                {it.body}
              </p>
            )}
            {it.href && it.actionLabel && (
              <Link
                href={it.href}
                className="mt-2 inline-flex items-center gap-1 text-[12px]"
                style={{ color: ACCENT }}
              >
                {it.actionLabel}
                <ChevronRight className="h-3 w-3" strokeWidth={2} />
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Het skelet ───────────────────────────────────────────────────────────────
export type RoleDashboardProps = {
  /** Schil-sectie (bepaalt navigatiecontext + achtergrond via ScreenShell). */
  section: string
  bg?: string | null
  /** Nog aan het laden: rustige plaatshouder in plaats van een lege pagina. */
  loading?: boolean
  /** Laag 1 — precies één visueel element. Weglaten (null) als er geen bron is. */
  laag1: Layer1 | null
  /** Laag 2 — het ene aandachtsding met actie. Null ⇒ laag weggelaten. */
  laag2: Layer2 | null
  /** Laag 3 — titel + items. Lege lijst of null ⇒ laag weggelaten. */
  laag3?: { title: string; items: Layer3Item[] } | null
  /**
   * Doorklik naar het bestaande werkscherm (cockpit, clubbeheer, wedstrijd-room,
   * kinderen). Altijd bereikbaar — niets weglaten (DSH-13a). Onderaan, rustig.
   */
  werkscherm?: { href: string; label: string; hint?: string } | null
  /** Zeldzaam: extra vrije inhoud onderaan (bv. rolwissel). */
  footer?: ReactNode
}

export function RoleDashboard({
  section,
  bg,
  loading,
  laag1,
  laag2,
  laag3,
  werkscherm,
  footer,
}: RoleDashboardProps) {
  const heeftLaag3 = laag3 != null && laag3.items.length > 0

  return (
    <ScreenShell section={section} bg={bg ?? undefined}>
      <div className="space-y-5" data-testid="role-dashboard">
        {loading ? (
          <>
            <div className="h-40 animate-pulse rounded-3xl bg-muted" />
            <div className="h-28 animate-pulse rounded-2xl bg-muted" />
          </>
        ) : (
          <>
            {/* Laag 1 én laag 2 horen boven de vouw op 402×874 (DSH-06). */}
            {laag1 && <Layer1Band {...laag1} />}
            {laag2 && <Layer2Block {...laag2} />}

            {/* Laag 3 mag onder de vouw; weggelaten als er niets is (DSH-08). */}
            {heeftLaag3 && <Layer3List title={laag3!.title} items={laag3!.items} />}

            {/* Doorklik naar het bestaande werkscherm — altijd bereikbaar. */}
            {werkscherm && (
              <Link
                href={werkscherm.href}
                className="flex items-center justify-between rounded-2xl border border-border px-4 py-3.5 text-left transition-colors hover:border-accent-cyan"
                data-testid="dashboard-werkscherm"
              >
                <span>
                  <span className="text-[14px] text-foreground/90">
                    {werkscherm.label}
                  </span>
                  {werkscherm.hint && (
                    <span className="mt-0.5 block text-[12px] text-muted-foreground">
                      {werkscherm.hint}
                    </span>
                  )}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            )}

            {footer}
          </>
        )}
      </div>
    </ScreenShell>
  )
}
