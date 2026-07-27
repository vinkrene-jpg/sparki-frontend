import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { IconLaden } from "./icons";

// Sparki-designsysteem — knop.
//
// Varianten: primair (accent-cyaan, donkere tekst), secundair (glas-pill met
// rand) en tekst (tekstactie in accentkleur). Elke knop is minimaal 44px hoog
// (min-h-11) — het minimale aanraakvlak op mobiel. `loading` toont een
// draaiende indicator, blokkeert kliks en meldt de toestand via aria-busy.

const dsButtonVariants = cva(
  [
    "inline-flex min-h-11 select-none items-center justify-center gap-2",
    "whitespace-nowrap rounded-control px-5 type-action transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60",
    "focus-visible:ring-offset-2 focus-visible:ring-offset-app",
    "disabled:pointer-events-none disabled:opacity-45",
    "[&_svg]:size-4 [&_svg]:shrink-0",
  ].join(" "),
  {
    variants: {
      variant: {
        primair:
          "bg-accent-cyan font-semibold text-on-accent hover:brightness-110",
        secundair:
          "border border-border bg-control text-white hover:bg-white/15",
        tekst: "px-2 text-accent-cyan underline-offset-4 hover:underline",
      },
    },
    defaultVariants: { variant: "primair" },
  },
);

export interface DsButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof dsButtonVariants> {
  /** Laadtoestand: toont spinner, blokkeert kliks, meldt aria-busy. */
  loading?: boolean;
}

export const DsButton = React.forwardRef<HTMLButtonElement, DsButtonProps>(
  (
    { className, variant, loading = false, disabled, children, type, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      type={type ?? "button"}
      className={cn(dsButtonVariants({ variant }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <IconLaden className="animate-spin" aria-hidden="true" />}
      {children}
    </button>
  ),
);
DsButton.displayName = "DsButton";
