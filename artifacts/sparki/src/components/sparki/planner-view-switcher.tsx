// Weergaveniveau-kiezer van de routeplanner (besluit B6, 30/31-07-2026).
//
// Vier weergaven van dezelfde planner: Gratis · Go gewone fietser ·
// Go wielrenner/MTB/gravel · Wedstrijd. Automatisch voorgesteld uit het echte
// profiel, altijd handmatig aanpasbaar, keuze bewaard op de server, en met één
// tik terug naar automatisch. Volledig los van het abonnement; alle
// veiligheidsfuncties (blokkadepoort, verificatie, waarschuwingen) blijven op
// élk niveau actief — dat staat er eerlijk bij.
import { useState } from "react"
import { SlidersHorizontal } from "lucide-react"
import { usePlannerView } from "@/hooks/use-planner-view"
import {
  PLANNER_VIEW_DESCRIPTIONS,
  PLANNER_VIEW_LABELS,
  PLANNER_VIEW_ORDER,
} from "@/lib/planner-view"

export function PlannerViewSwitcher() {
  const pv = usePlannerView()
  const [open, setOpen] = useState(false)

  if (!pv.loaded) return null

  return (
    <div className="mt-4 rounded-xl border border-border bg-muted p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="flex items-center gap-2">
          <SlidersHorizontal
            className="h-3.5 w-3.5 text-muted-foreground"
            aria-hidden
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Weergave
          </span>
          <span className="text-[12px] font-medium text-muted-foreground">
            {PLANNER_VIEW_LABELS[pv.view]}
          </span>
          {pv.manual == null && (
            <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
              automatisch
            </span>
          )}
        </span>
        <span className="font-mono text-[10px] text-accent-cyan/70">
          {open ? "sluit" : "wijzig"}
        </span>
      </button>

      {open && (
        <div className="mt-3">
          <div className="flex flex-col gap-1.5">
            {PLANNER_VIEW_ORDER.map((v) => {
              const actief = pv.view === v
              return (
                <button
                  key={v}
                  type="button"
                  disabled={pv.saving}
                  onClick={() => pv.choose(v)}
                  className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                    actief
                      ? "border-accent-cyan/50 bg-accent-cyan/[0.1]"
                      : "border-border bg-transparent hover:border-border"
                  }`}
                >
                  <span
                    className={`block text-[13px] font-medium ${actief ? "text-accent-cyan" : "text-muted-foreground"}`}
                  >
                    {PLANNER_VIEW_LABELS[v]}
                    {pv.suggested === v && (
                      <span className="ml-2 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                        voorstel van Sparki
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">
                    {PLANNER_VIEW_DESCRIPTIONS[v]}
                  </span>
                </button>
              )
            })}
          </div>
          {pv.manual != null && (
            <button
              type="button"
              disabled={pv.saving}
              onClick={() => pv.choose(null)}
              className="mt-2 font-mono text-[10px] text-accent-cyan/70 transition hover:text-accent-cyan"
            >
              Terug naar automatisch (voorstel:{" "}
              {PLANNER_VIEW_LABELS[pv.suggested]})
            </button>
          )}
          <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
            De weergave bepaalt alleen welke keuzes je ziet — hij staat los van
            je abonnement, en alle veiligheidscontroles (blokkadepoort,
            wegdek-verificatie en waarschuwingen) blijven op elk niveau
            gewoon actief.
          </p>
        </div>
      )}
    </div>
  )
}
