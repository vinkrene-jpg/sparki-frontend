type ReadinessRingProps = {
  score: number
}

export function ReadinessRing({ score }: ReadinessRingProps) {
  const size = 230
  const stroke = 3
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference

  return (
    <div className="relative flex items-center justify-center">
      {/* ambient glow */}
      <div
        aria-hidden="true"
        className="absolute inset-0 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in oklch, var(--accent-cyan) 22%, transparent) 0%, transparent 60%)",
        }}
      />
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="relative -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent-cyan)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          style={{ filter: "drop-shadow(0 0 6px var(--accent-cyan))" }}
        />
      </svg>

      <div className="absolute flex flex-col items-center">
        <span className="text-[11px] font-medium uppercase tracking-[0.4em] text-white/45">
          Readiness
        </span>
        <span className="mt-1 font-sans text-7xl font-extralight leading-none text-white tabular-nums">
          {score}
        </span>
        <span className="mt-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-[var(--accent-cyan)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-cyan)] shadow-[0_0_8px_var(--accent-cyan)]" />
          Elite window open
        </span>
      </div>
    </div>
  )
}
