import { useState } from "react"
import { useLocation } from "wouter"
import { useTrainingPlan } from "@/hooks/use-training-plan"
import { useLoad } from "@/hooks/use-load"
import { judgeGoalFit, type GoalVerdict } from "@/lib/train-intelligence"
import { ThreeWeekPlan } from "@/components/sparki/three-week-plan"
import { LayerHeading } from "@/components/sparki/train/layer-heading"
import { Target, ChevronRight, Plus, Link2 } from "lucide-react"

const VERDICT_COLOR: Record<GoalVerdict, string> = {
  op_koers: "rgba(120,210,230,0.9)",
  te_zwaar: "rgba(255,140,80,0.9)",
  te_licht: "rgba(255,210,90,0.9)",
  onbekend: "rgba(255,255,255,0.45)",
}

const VERDICT_LABEL: Record<GoalVerdict, string> = {
  op_koers: "Op koers",
  te_zwaar: "Te zwaar",
  te_licht: "Te licht",
  onbekend: "Nog onbekend",
}

const cardClass =
  "rounded-2xl border border-border bg-card p-5 backdrop-blur-md"

// Langere toelichting ingeklapt achter een link ("Meer uitleg" /
// "Waarom is dit nodig?") — kort-by-default, details op verzoek.
function GoalDetail({ label, tekst }: { label: string; tekst: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="text-[12px] text-muted-foreground underline underline-offset-2 transition-colors hover:text-muted-foreground"
      >
        {label}
      </button>
      {open && (
        <p className="mt-1.5 text-pretty text-[12px] leading-relaxed text-muted-foreground">
          {tekst}
        </p>
      )}
    </div>
  )
}

export function GoalLayer() {
  const [, navigate] = useLocation()
  const { data: plan } = useTrainingPlan()
  const { data: load } = useLoad()

  const fit = judgeGoalFit({ inputs: plan?.inputs, load })
  const color = VERDICT_COLOR[fit.verdict]
  const noGoal = !plan?.inputs?.nextRace
  const needsMoreData = fit.verdict === "onbekend" && !noGoal

  return (
    <section className="flex flex-col gap-4">
      <LayerHeading
        title="Je doel als maatlat"
        subtitle="Alles wat je traint, wordt afgemeten aan waar je naartoe wilt."
      />

      <div className={cardClass}>
        <div className="flex items-center gap-2">
          <Target className="h-3.5 w-3.5" style={{ color }} strokeWidth={2} />
          <span
            className="font-mono text-[10px] tracking-[0.2em]"
            style={{ color }}
          >
            {VERDICT_LABEL[fit.verdict].toUpperCase()}
          </span>
        </div>
        <h3 className="mt-2.5 text-balance font-sans text-[17px] font-light leading-snug text-foreground/90">
          {fit.headline}
        </h3>

        {/* Belangrijkste actie eerst; korte zin daarna, details achter een link. */}
        {noGoal && (
          <button
            type="button"
            onClick={() => navigate("/you?focus=doelen")}
            className="mt-3.5 flex items-center gap-1.5 rounded-xl px-4 py-2.5 font-sans text-[13px] font-semibold transition-opacity"
            style={{ background: "rgba(120,210,230,0.9)", color: "#040506" }}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Voeg een doel toe
          </button>
        )}

        <p className="mt-3 text-pretty text-[13px] leading-relaxed text-muted-foreground">
          {fit.reason}
        </p>

        {fit.detail && (
          <GoalDetail
            label={noGoal ? "Waarom is dit nodig?" : "Meer uitleg"}
            tekst={fit.detail}
          />
        )}

        {needsMoreData && (
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => navigate("/train?focus=logsession")}
              className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 font-sans text-[13px] font-medium text-muted-foreground transition-colors hover:border-accent-cyan"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Log een training
            </button>
            <button
              type="button"
              onClick={() => navigate("/you?focus=connections")}
              className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 font-sans text-[13px] font-medium text-muted-foreground transition-colors hover:border-border"
            >
              <Link2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              Koppel een platform
            </button>
          </div>
        )}

        {!noGoal && !needsMoreData && (
          <button
            type="button"
            onClick={() => navigate("/races")}
            className="mt-3 flex items-center gap-1 font-mono text-[11px] tracking-wide text-accent-cyan transition-colors hover:text-accent-cyan"
          >
            Bekijk je wedstrijden
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Concrete plan toward the goal (read-only here; building lives above). */}
      <ThreeWeekPlan hideLabel hideEmptyCta hideRegenerate />
    </section>
  )
}
