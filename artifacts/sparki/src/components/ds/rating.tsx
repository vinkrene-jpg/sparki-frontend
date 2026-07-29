import * as React from "react";
import { cn } from "@/lib/utils";

// Sparki-designsysteem — sterren-beoordeling (1–5).
//
// Eén tik op een ster kiest de score; toetsenbord werkt via een radiogroep
// (pijltjes/tab). `value=null` = nog niet beoordeeld. `readOnly` toont alleen.
// De component slaat zelf niets op — de aanroeper bepaalt wat er met de score
// gebeurt (beoordelen van iets dat Sparki bouwde, nooit een instelling).

const STAR_LABELS = [
  "1 ster — slecht",
  "2 sterren — matig",
  "3 sterren — oké",
  "4 sterren — goed",
  "5 sterren — uitstekend",
] as const;

function StarIcon({
  filled,
  className,
}: {
  filled: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.5}
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinejoin="round"
        d="M12 3.25l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.53l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85L12 3.25z"
      />
    </svg>
  );
}

export interface DsStarRatingProps {
  /** Huidige score (1–5) of null wanneer nog niet beoordeeld. */
  value: number | null;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  disabled?: boolean;
  /** Grootte van één ster. */
  size?: "sm" | "md";
  className?: string;
  /** Toegankelijk label van de groep. */
  label?: string;
}

export function DsStarRating({
  value,
  onChange,
  readOnly = false,
  disabled = false,
  size = "md",
  className,
  label = "Sterren-beoordeling",
}: DsStarRatingProps) {
  const [hover, setHover] = React.useState<number | null>(null);
  const active = hover ?? value ?? 0;
  const starClass = size === "sm" ? "h-4 w-4" : "h-6 w-6";
  const interactive = !readOnly && !disabled && onChange != null;

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex items-center gap-1", className)}
      onMouseLeave={() => setHover(null)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= active;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={STAR_LABELS[n - 1]}
            disabled={!interactive}
            tabIndex={interactive ? (value === n || (value == null && n === 1) ? 0 : -1) : -1}
            onClick={() => interactive && onChange?.(n)}
            onMouseEnter={() => interactive && setHover(n)}
            onFocus={() => interactive && setHover(n)}
            onBlur={() => setHover(null)}
            className={cn(
              "rounded-sm p-0.5 transition-colors",
              filled ? "text-amber-300" : "text-white/25",
              interactive &&
                "cursor-pointer hover:text-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60",
              !interactive && "cursor-default",
            )}
          >
            <StarIcon filled={filled} className={starClass} />
          </button>
        );
      })}
    </div>
  );
}
