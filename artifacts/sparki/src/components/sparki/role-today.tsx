// Rol-Vandaag-sectie (WP-T2): rendert de Today Orchestrator-uitkomst voor een
// rolweergave (trainer, ouder, clubbeheer, hoofdtrainer) bovenaan het rolhome.
// Zelfde contract als de atleten-Vandaag: lead (met onderbouwing als
// disclosure), inzicht en één wisselend blok; ontbreekt een slot, dan wordt er
// niets gerenderd (eerlijke lege toestand, geen vulkaart). Rechten zijn
// server-side leidend — dit is puur presentatie.

import { useState } from "react"
import { useLocation } from "wouter"
import { ChevronRight } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import {
  useToday,
  useTodayInteraction,
  type TodayAction,
  type TodayItem,
  type TodayRole,
} from "@/hooks/use-today"

const CARD =
  "rounded-2xl border border-border bg-card p-4 backdrop-blur-md"

function RoleTodayCard({
  item,
  support,
  onOpen,
}: {
  item: TodayItem
  support?: TodayItem | null
  onOpen: (item: TodayItem, action: TodayAction) => void
}) {
  return (
    <div
      className={CARD}
      style={
        item.urgent
          ? { borderColor: "oklch(0.75 0.17 40 / 0.45)" }
          : undefined
      }
    >
      <div className="text-[15px] tracking-tight text-foreground/90">{item.title}</div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{item.body}</p>
      {support && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[12px] text-muted-foreground">
            {support.title}
          </summary>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
            {support.body}
          </p>
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            Bron: {support.source}
          </p>
        </details>
      )}
      {item.actions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-3">
          {item.actions.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onOpen(item, a)}
              className="inline-flex items-center gap-1 text-[12px]"
              style={{ color: ACCENT }}
            >
              {a.label}
              <ChevronRight className="h-3 w-3" strokeWidth={2} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function RoleTodaySection({ rol }: { rol: TodayRole }) {
  const { data, isLoading, isError } = useToday(rol)
  const interact = useTodayInteraction()
  const [, navigate] = useLocation()

  if (isLoading || isError || !data) return null

  const open = (item: TodayItem, action: TodayAction) => {
    interact.mutate({ itemKey: item.key, action: "clicked" })
    navigate(action.href)
  }

  const secondary = [data.insight, data.rotating].filter(
    (i): i is TodayItem => i != null,
  )
  if (!data.lead && secondary.length === 0) return null

  return (
    <section aria-label="Nu belangrijk" className="space-y-3">
      {data.lead && (
        <RoleTodayCard item={data.lead} support={data.support} onOpen={open} />
      )}
      {secondary.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {secondary.map((item) => (
            <RoleTodayCard key={item.key} item={item} onOpen={open} />
          ))}
        </div>
      )}
      <TodayDebugPanel rol={rol} />
    </section>
  )
}

/**
 * WP-T3: onderbouwingsweergave voor bevoegde testers/admins. De server is
 * leidend: het debug-blok komt alleen mee voor admin/Hoofdtester (?debug=1);
 * gewone gebruikers zien deze knop niet en krijgen ook server-side nooit
 * debugdetails.
 */
export function TodayDebugPanel({ rol }: { rol?: TodayRole }) {
  const [open, setOpen] = useState(false)
  const base = useToday(rol)
  const debugQuery = useToday(rol, { debug: open })
  // Zichtbaarheid volgt exact de strikte serverpoort (debugAllowed): bewust
  // NIET profile.isAdmin — die vlag heeft in dev preview een bypass waardoor
  // gewone gebruikers de knop (zonder data) zouden zien.
  if (base.data?.debugAllowed !== true) return null

  const d = open ? debugQuery.data?.debug : undefined
  return (
    <div className="rounded-xl border border-dashed border-border px-3.5 py-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground"
      >
        Onderbouwing (tester) {open ? "▾" : "▸"}
      </button>
      {open && !d && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {debugQuery.isLoading ? "Onderbouwing wordt geladen…" : "Geen onderbouwing beschikbaar."}
        </p>
      )}
      {open && d && (
        <div className="mt-2 space-y-2 text-[11px] leading-relaxed text-muted-foreground">
          <p>
            Profiel: <span className="text-muted-foreground">{d.profile.variant}</span> · Rol:{" "}
            <span className="text-muted-foreground">{d.role}</span> · Beschikbare rollen:{" "}
            {d.availableRoles.join(", ")} · AI gebruikt:{" "}
            <span className="text-muted-foreground">{d.aiUsed ? "ja" : "nee"}</span> · Samengesteld:{" "}
            {new Date(d.generatedAt).toLocaleString("nl-NL")}
          </p>
          <div>
            <p className="text-muted-foreground">Gekozen kaarten (bron · confidence):</p>
            {(["lead", "support", "insight", "rotating"] as const).map((slot) => {
              const c = d.chosen[slot]
              return (
                <p key={slot} className="font-mono text-[10px] text-muted-foreground">
                  {slot}: {c ? `${c.key} — ${c.source} · ${c.confidence ?? "—"}${c.urgent ? " · URGENT" : ""}` : "leeg (eerlijk)"}
                </p>
              )
            })}
          </div>
          {d.passedOver.length > 0 && (
            <div>
              <p className="text-muted-foreground">Afgevallen kandidaten:</p>
              {d.passedOver.map((p) => (
                <p key={p.key} className="font-mono text-[10px] text-muted-foreground">
                  {p.key} — {p.reason}
                </p>
              ))}
            </div>
          )}
          {d.history.length > 0 && (
            <div>
              <p className="text-muted-foreground">Weergavehistorie (waarom opnieuw getoond):</p>
              {d.history.map((h) => (
                <p key={h.itemKey} className="font-mono text-[10px] text-muted-foreground">
                  {h.itemKey} — {h.daysShown} dag(en) getoond, laatst{" "}
                  {new Date(h.lastShownAt).toLocaleDateString("nl-NL")}
                  {h.clicked ? ", interactie geregistreerd" : ", nog geen interactie"}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Weergavewissel voor accounts met meerdere rolweergaven binnen dezelfde
 * omgeving (bv. trainer die óók hoofdtrainer of clubbeheerder is). De server
 * bepaalt welke weergaven beschikbaar zijn; dit toont alleen echte opties.
 */
export function RoleViewSwitch({
  value,
  options,
  onChange,
}: {
  value: TodayRole
  options: { rol: TodayRole; label: string }[]
  onChange: (rol: TodayRole) => void
}) {
  if (options.length < 2) return null
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.rol}
          type="button"
          onClick={() => onChange(o.rol)}
          className={`rounded-full px-3 py-1.5 text-[12px] transition-colors ${
            value === o.rol
              ? "border border-accent-cyan bg-accent-cyan text-accent-cyan"
              : "border border-border text-muted-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
