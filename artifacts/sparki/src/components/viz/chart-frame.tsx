import type { ReactNode } from "react"
import { UitlegDot } from "@/components/viz/uitleg"
import { UITLEG, UITLEG_DOEN } from "@/lib/uitleg-content"

/**
 * Herbruikbaar kader voor elke grafiek: titel + uitleg-stipje bovenaan en een
 * eerlijke meta-voet onderaan (periode, bronnen, wat er ontbreekt, en — bij
 * vergelijkingen — de vergelijkingsbasis). De voet toont alleen regels die
 * echt zijn meegegeven: niets wordt verzonnen.
 */
export function ChartFrame({
  title,
  uitlegKey,
  children,
  periode,
  bronnen,
  ontbrekend,
  vergelijkingsbasis,
  actions,
}: {
  title: string
  uitlegKey?: keyof typeof UITLEG | string
  children: ReactNode
  /** Bijv. "za 14 juni · 2 u 15 min" */
  periode?: string | null
  /** Bijv. ["vermogensmeter", "hartslagband"] */
  bronnen?: string[] | null
  /** Eerlijke ontbreekt-regel, bijv. "geen temperatuur in dit bestand" */
  ontbrekend?: string | null
  /** Alleen bij vergelijkingen: waarop de vergelijking is gebaseerd. */
  vergelijkingsbasis?: string | null
  actions?: ReactNode
}) {
  const metaRows: Array<[string, string]> = []
  if (periode) metaRows.push(["Periode", periode])
  if (bronnen && bronnen.length > 0) metaRows.push(["Bron", bronnen.join(" · ")])
  if (ontbrekend) metaRows.push(["Ontbreekt", ontbrekend])
  if (vergelijkingsbasis) metaRows.push(["Vergelijking", vergelijkingsbasis])

  return (
    <div className="rounded-xl border border-border bg-muted px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {title}
          </span>
          {uitlegKey ? <UitlegDot uitlegKey={uitlegKey} label={title} /> : null}
        </div>
        {actions}
      </div>

      <div className="mt-2">{children}</div>

      {/* Twee-zinnen-opbouw (besluit B6 04-08): altijd zichtbaar — wat je
          ziet + wat je ermee doet; de rekenwijze achter een uitklap. */}
      {uitlegKey != null && UITLEG[uitlegKey] != null && (
        <div className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
          <p>
            {UITLEG[uitlegKey].wat}
            {UITLEG_DOEN[uitlegKey] ? ` ${UITLEG_DOEN[uitlegKey]}` : ""}
          </p>
          <details className="mt-1">
            <summary className="cursor-pointer select-none text-accent-cyan/80 hover:text-accent-cyan focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50">
              Hoe wordt dit berekend?
            </summary>
            <p className="mt-1">{UITLEG[uitlegKey].hoe}</p>
          </details>
        </div>
      )}

      {metaRows.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-0.5 border-t border-border pt-2">
          {metaRows.map(([label, value]) => (
            <span key={label} className="text-[11px] text-muted-foreground">
              <span className="text-muted-foreground">{label}: </span>
              {value}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
