const intervals = [
  { h: 22, on: false },
  { h: 28, on: false },
  { h: 70, on: true },
  { h: 30, on: false },
  { h: 78, on: true },
  { h: 32, on: false },
  { h: 84, on: true },
  { h: 30, on: false },
  { h: 76, on: true },
  { h: 34, on: false },
  { h: 88, on: true },
  { h: 26, on: false },
  { h: 24, on: false },
]

export function TrainingIntervals() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between">
        <div className="flex flex-col">
          <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-white/40">
            Today
          </span>
          <span className="font-sans text-base font-light text-white">
            Threshold Intervals
          </span>
        </div>
        <span className="text-[11px] uppercase tracking-[0.25em] text-white/45 tabular-nums">
          5 × 6 min
        </span>
      </div>

      <div className="flex h-16 items-end gap-1">
        {intervals.map((bar, i) => (
          <div
            key={i}
            className="flex-1 rounded-[2px]"
            style={{
              height: `${bar.h}%`,
              background: bar.on
                ? "linear-gradient(to top, color-mix(in oklch, var(--accent-cyan) 35%, transparent), var(--accent-cyan))"
                : "rgba(255,255,255,0.10)",
              boxShadow: bar.on
                ? "0 0 10px color-mix(in oklch, var(--accent-cyan) 50%, transparent)"
                : "none",
            }}
          />
        ))}
      </div>

      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/35 tabular-nums">
        <span>00:00</span>
        <span>Zone 4 · 295W</span>
        <span>58:00</span>
      </div>
    </div>
  )
}
