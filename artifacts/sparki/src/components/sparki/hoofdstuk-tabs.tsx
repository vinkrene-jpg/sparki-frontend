// Hoofdstuk-tabbalk — de "dubbele menulaag" (Strava-stijl, gekozen door René
// 28-7-2026, canvas-optie A): teksttabs over de volle breedte met een
// accentstreepje onder de actieve tab. Eén component voor alle hoofdstukken:
// - variant "donker": op de glazen Sparki-achtergrond (Rijden, later meer)
// - variant "licht": in de witte datawerkruimte van Analyse
// Presentatie-only: de aanroeper blijft eigenaar van de actieve staat en de
// (deep-linkbare) URL. Geen data-fetching hier.
import { cn } from "@/lib/utils"

export type HoofdstukTab<Id extends string = string> = {
  id: Id
  label: string
}

export function HoofdstukTabs<Id extends string>({
  tabs,
  actief,
  onKies,
  variant = "donker",
  ariaLabel,
}: {
  tabs: ReadonlyArray<HoofdstukTab<Id>>
  actief: Id
  onKies: (id: Id) => void
  variant?: "donker" | "licht"
  ariaLabel: string
}) {
  const donker = variant === "donker"
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "flex -mb-px overflow-x-auto scrollbar-none border-b",
        donker ? "border-border" : "border-slate-200",
      )}
    >
      {tabs.map((tab) => {
        const isActief = actief === tab.id
        return (
          <button
            key={tab.id}
            id={`tabknop-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={isActief}
            aria-controls={`tab-${tab.id}`}
            onClick={() => onKies(tab.id)}
            className={cn(
              "relative flex-1 whitespace-nowrap px-3 pb-2.5 pt-2 text-center text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset",
              donker
                ? "focus-visible:ring-cyan-300/60"
                : "focus-visible:ring-sky-500/60",
              isActief
                ? donker
                  ? "font-medium text-accent-cyan"
                  : "font-medium text-sky-600"
                : donker
                  ? "text-muted-foreground hover:text-muted-foreground"
                  : "text-slate-500 hover:text-slate-800",
            )}
          >
            {tab.label}
            {isActief && (
              <span
                aria-hidden
                className={cn(
                  "absolute bottom-0 left-3 right-3 h-[2px] rounded-t-full",
                  donker
                    ? "bg-cyan-300 shadow-[0_0_8px_rgba(127,231,240,0.5)]"
                    : "bg-sky-500",
                )}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
