// Shared Performance-Lab atoms — identical to the frozen Home language.

export const ACCENT = "rgba(120,210,230,1)"

export function SectionLabel({ n, title }: { n?: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      {n ? (
        <span
          className="font-sans text-[11px] font-semibold tabular-nums"
          style={{ color: ACCENT, fontVariantNumeric: "tabular-nums lining-nums" }}
        >
          {n}
        </span>
      ) : null}
      <span className="label-sm text-white/50">{title.toUpperCase()}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-white/12 to-transparent" />
    </div>
  )
}

export function Delta({ value, invert = false }: { value: number; invert?: boolean }) {
  const positive = invert ? value < 0 : value > 0
  const sign = value > 0 ? "+" : ""
  return (
    <span
      className="font-sans text-[10px] font-semibold tabular-nums"
      style={{
        color: positive ? ACCENT : "rgba(255,140,120,0.85)",
        fontVariantNumeric: "tabular-nums lining-nums",
      }}
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
  value: string | number
  accent?: boolean
  big?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="label-xs text-white/35">{label.toUpperCase()}</span>
      <span
        className={`font-sans font-semibold tabular-nums leading-none ${big ? "text-2xl" : "text-[15px]"}`}
        style={{
          color: accent ? ACCENT : "rgba(255,255,255,0.9)",
          fontVariantNumeric: "tabular-nums lining-nums",
        }}
      >
        {value}
      </span>
    </div>
  )
}
