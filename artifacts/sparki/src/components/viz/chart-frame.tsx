import type { ReactNode } from "react"
import { UitlegDot } from "@/components/viz/uitleg"
import type { UITLEG } from "@/lib/uitleg-content"

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
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">
            {title}
          </span>
          {uitlegKey ? <UitlegDot uitlegKey={uitlegKey} label={title} /> : null}
        </div>
        {actions}
      </div>

      <div className="mt-2">{children}</div>

      {metaRows.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-0.5 border-t border-white/[0.06] pt-2">
          {metaRows.map(([label, value]) => (
            <span key={label} className="text-[11px] text-white/45">
              <span className="text-white/30">{label}: </span>
              {value}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
