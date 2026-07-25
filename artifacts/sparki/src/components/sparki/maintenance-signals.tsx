import { AlertTriangle, Wrench, Info } from "lucide-react"
import { useMaintenanceSignals, type MaintenanceSignal } from "@/hooks/use-garage"
import {
  useSuppressedAttentionKeys,
  useReportAttentionSeen,
} from "@/hooks/use-attention"

// Onderhoudssignalen uit de garage — altijd afgeleid uit echte gekoppelde
// ritten en eigen registraties. Drie eerlijke niveaus:
// - controleadvies: op basis van kilometers is een controle verstandig
// - vermoedelijke slijtage: de kilometrage ligt boven de gebruikelijke levensduur
// - vastgesteld defect: door de renner zelf geregistreerd (nooit uit foto's afgeleid)
// De boodschap blijft voorzichtig: Sparki adviseert controleren, stelt nooit
// zelf een defect vast.
//
// Aandacht-rotatie (alleen context "vandaag"): een controleadvies of
// vermoedelijke slijtage die dagenlang genegeerd wordt, pauzeert een paar dagen
// en komt daarna terug zolang de situatie echt bestaat. Een vastgesteld defect
// rouleert NOOIT, en in de garage/wedstrijd-context wordt altijd alles getoond.

const LEVEL_STYLE: Record<
  MaintenanceSignal["level"],
  { label: string; color: string; bg: string; Icon: typeof Info }
> = {
  controleadvies: {
    label: "Controleadvies",
    color: "rgba(255,255,255,0.6)",
    bg: "rgba(255,255,255,0.06)",
    Icon: Info,
  },
  vermoedelijke_slijtage: {
    label: "Vermoedelijke slijtage",
    color: "rgb(253,230,138)",
    bg: "rgba(253,230,138,0.1)",
    Icon: Wrench,
  },
  vastgesteld_defect: {
    label: "Vastgesteld defect",
    color: "rgb(252,165,165)",
    bg: "rgba(252,165,165,0.1)",
    Icon: AlertTriangle,
  },
}

// Stabiele rotatie-identiteit per signaal: per onderdeel (of per fiets als er
// geen onderdeel is) én per niveau — verergert een signaal van controleadvies
// naar vermoedelijke slijtage, dan is dat een nieuwe sleutel en dus verse
// aandacht. Een vastgesteld defect krijgt bewust géén sleutel (rouleert nooit).
function attentionKeyFor(s: MaintenanceSignal): string | null {
  if (s.level === "vastgesteld_defect") return null
  const target = s.componentId != null ? `${s.componentId}` : `fiets-${s.bikeId ?? "0"}`
  return `onderhoud:${s.level}:${target}`
}

export function MaintenanceSignalsPanel({
  context,
  compact = false,
}: {
  context: "vandaag" | "wedstrijd" | "garage"
  compact?: boolean
}) {
  const { data, isLoading } = useMaintenanceSignals(context)
  const rotates = context === "vandaag"
  const { suppressed, ready: attentionReady } = useSuppressedAttentionKeys()

  const allSignals = data?.signals ?? []
  // Alleen op Vandaag rouleren niet-kritieke signalen; garage en wedstrijd
  // tonen altijd alles. Zolang de rotatiestatus laadt tonen we niets extra's
  // weg (fail-open zodra bekend, nooit oneerlijk verzwegen).
  const signals =
    rotates && attentionReady
      ? allSignals.filter((s) => {
          const key = attentionKeyFor(s)
          return key == null || !suppressed.has(key)
        })
      : allSignals

  // Meld alleen wat hier echt in beeld staat (alleen op Vandaag).
  const seenKeys = rotates
    ? signals
        .map(attentionKeyFor)
        .filter((k): k is string => k != null)
        .slice(0, 12)
    : []
  useReportAttentionSeen(seenKeys.length > 0 ? seenKeys : null)

  if (isLoading && !compact) {
    return <p className="text-[12px] text-white/40">Bezig…</p>
  }
  if (signals.length === 0) {
    if (compact) return null
    return (
      <p className="text-[12px] leading-relaxed text-white/40">
        Geen onderhoudssignalen op dit moment. Signalen verschijnen op basis van
        je gekoppelde ritten en je eigen registraties in de garage.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {signals.map((s, i) => {
        const style = LEVEL_STYLE[s.level]
        return (
          <div
            key={`${s.level}-${s.componentId ?? s.bikeId ?? i}`}
            className="rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] p-3 backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <style.Icon
                className="h-3.5 w-3.5 shrink-0"
                strokeWidth={1.75}
                style={{ color: style.color }}
              />
              <span
                className="rounded-full px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em]"
                style={{ color: style.color, background: style.bg }}
              >
                {style.label}
              </span>
              {s.bikeName && (
                <span className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-white/35">
                  {s.bikeName}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[13px] font-medium text-white/85">
              {s.label.charAt(0).toUpperCase() + s.label.slice(1)}
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-white/55">
              {s.message}
            </p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-white/30">
              {s.advice}
            </p>
          </div>
        )
      })}
    </div>
  )
}
