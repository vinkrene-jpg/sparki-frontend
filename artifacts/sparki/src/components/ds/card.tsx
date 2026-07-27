import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Sparki-designsysteem — kaartcontainer.
//
// De standaard "glaskaart" van het donkere ontwerp: subtiele rand, licht
// oppervlak, kaartradius uit de tokenlaag. Twee varianten:
//   • standaard — normale kaart-padding (p-card)
//   • compact   — dichte lijst-/detailkaart (p-card-compact)
// Alle waarden komen uit tokens (bg-surface, border-border, rounded-card).

const dsCardVariants = cva(
  "rounded-card border border-border bg-surface backdrop-blur",
  {
    variants: {
      variant: {
        standaard: "p-card",
        compact: "p-card-compact",
      },
    },
    defaultVariants: { variant: "standaard" },
  },
);

export interface DsCardProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof dsCardVariants> {}

export const DsCard = React.forwardRef<HTMLDivElement, DsCardProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(dsCardVariants({ variant }), className)}
      {...props}
    />
  ),
);
DsCard.displayName = "DsCard";

/** Kaarttitel in de vaste Figma-titelstijl (Title/Card). */
export function DsCardTitel({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("type-title-card text-white/90", className)} {...props} />
  );
}
