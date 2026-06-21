// Shared Performance-Lab atoms — identical to the frozen Home language.

export const ACCENT = "rgba(120,210,230,1)"

export function SectionLabel({ n, title }: { n?: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      {n ? (
        <span className="font-mono text-[11px] tabular-nums" style={{ color: ACCENT }}>
          {n}
        </span>
      ) : null}
      <span className="font-mono text-[11px] tracking-[0.22em] text-white/55">
        {title.toUpperCase()}
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-white/15 to-transparent" />
    </div>
  )
}

export function Delta({ value, invert = false }: { value: number; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0
  const sign = value > 0 ? "+" : ""
  return (
    <span
      className="font-mono text-[10px] tabular-nums"
      style={{ color: positive ? ACCENT : "rgba(255,140,120,0.85)" }}
    >
      {sign}
      {value}
    </span>
  )
}

export function Divider() {
  return <span className="h-7 w-px bg-white/[0.08]" />
}

export function Stat({
  label,
  value,
  accent,
  big,
}: {
  label: string
  value: string
  accent?: boolean
  big?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[9px] tracking-[0.16em] text-white/35">
        {label.toUpperCase()}
      </span>
      <span
        className={`font-sans font-light tabular-nums ${big ? "text-2xl" : "text-lg"}`}
        style={{ color: accent ? ACCENT : "rgba(255,255,255,0.9)" }}
      >
        {value}
      </span>
    </div>
  )
}
