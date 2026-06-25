import { ACCENT } from "@/components/sparki/ui"

/**
 * Heading for one of the four Training layers. Deliberately not the old numbered
 * "01/02" motif — each layer is named for what it does, with a one-line reason
 * it exists, so the page reads as a thinking partner, not a list of widgets.
 */
export function LayerHeading({
  title,
  subtitle,
}: {
  title: string
  subtitle: string
}) {
  return (
    <div className="flex gap-3">
      <span
        className="mt-1 w-[2px] shrink-0 rounded-full"
        style={{
          background: `linear-gradient(${ACCENT}, transparent)`,
          minHeight: 34,
        }}
      />
      <div>
        <h2 className="font-sans text-lg font-light tracking-tight text-white/90">
          {title}
        </h2>
        <p className="mt-0.5 text-pretty text-[12px] leading-relaxed text-white/40">
          {subtitle}
        </p>
      </div>
    </div>
  )
}
