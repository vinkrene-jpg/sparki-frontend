import { Sparkles } from "lucide-react"

export function AiInsight() {
  return (
    <div className="relative overflow-hidden">
      {/* glow underlay */}
      <div
        aria-hidden="true"
        className="absolute -inset-x-6 -inset-y-2 blur-2xl"
        style={{
          background:
            "radial-gradient(ellipse at left, color-mix(in oklch, var(--accent-cyan) 16%, transparent), transparent 70%)",
        }}
      />
      <div className="relative flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] px-4 py-3.5 backdrop-blur-md">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-cyan)]/15">
          <Sparkles
            className="h-3.5 w-3.5 text-[var(--accent-cyan)]"
            strokeWidth={2}
          />
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-[var(--accent-cyan)]/80">
            Sparki Coach
          </span>
          <p className="text-pretty text-sm font-light leading-relaxed text-white/90">
            Elite window open. Push hard before 16:00.
          </p>
        </div>
      </div>
    </div>
  )
}
