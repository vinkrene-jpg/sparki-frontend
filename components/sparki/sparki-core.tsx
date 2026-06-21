"use client"

// THE SPARKI SIGNATURE: a living AI core — a breathing biometric halo.
// Same element across all three concepts, re-skinned per concept via `accent`.

type SparkiCoreProps = {
  size?: number
  accent?: string
  /** 0-1 readiness drives ring fill + glow intensity */
  readiness?: number
  variant?: "orb" | "halo" | "reactor"
  className?: string
}

export function SparkiCore({
  size = 180,
  accent = "rgba(120,210,230,1)",
  readiness = 0.87,
  variant = "orb",
  className,
}: SparkiCoreProps) {
  return (
    <div
      className={className}
      style={{ width: size, height: size, position: "relative" }}
      aria-hidden="true"
    >
      {/* outer glow */}
      <div
        className="absolute inset-0 animate-breathe-slow rounded-full"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${accent}, transparent 62%)`,
          opacity: 0.28 + readiness * 0.25,
          filter: "blur(8px)",
        }}
      />

      {/* rotating dashed orbit rings */}
      <svg
        className="absolute inset-0 animate-spin-slow"
        viewBox="0 0 100 100"
        style={{ opacity: 0.5 }}
      >
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="none"
          stroke={accent}
          strokeWidth="0.4"
          strokeDasharray="1 6"
          opacity="0.6"
        />
      </svg>
      <svg className="absolute inset-0 animate-spin-rev" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={accent}
          strokeWidth="0.5"
          strokeDasharray="14 8"
          opacity="0.4"
        />
      </svg>

      {/* readiness arc */}
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="34"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1.5"
        />
        <circle
          cx="50"
          cy="50"
          r="34"
          fill="none"
          stroke={accent}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray={`${readiness * 2 * Math.PI * 34} ${2 * Math.PI * 34}`}
          style={{ filter: `drop-shadow(0 0 4px ${accent})` }}
        />
      </svg>

      {/* core body */}
      {variant !== "halo" && (
        <div
          className="absolute animate-breathe rounded-full"
          style={{
            inset: "32%",
            background:
              variant === "reactor"
                ? `radial-gradient(circle at 38% 32%, rgba(255,255,255,0.95), ${accent} 55%, transparent 78%)`
                : `radial-gradient(circle at 40% 35%, rgba(255,255,255,0.85), ${accent} 60%, rgba(0,0,0,0.2) 100%)`,
            boxShadow: `0 0 24px ${accent}, inset 0 0 18px rgba(255,255,255,0.4)`,
          }}
        />
      )}

      {/* inner scanning particles */}
      <svg className="absolute inset-0" viewBox="0 0 100 100">
        {[0, 72, 144, 216, 288].map((deg, i) => {
          const a = (deg * Math.PI) / 180
          const cx = 50 + Math.cos(a) * 22
          const cy = 50 + Math.sin(a) * 22
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r="0.9"
              fill="white"
              className="animate-blink"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
          )
        })}
      </svg>
    </div>
  )
}
