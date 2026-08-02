import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import {
  computeKanteling,
  kantelTransform,
  RUST_TRANSFORM,
} from "@/lib/zweefkaart";

// Sparki-designsysteem — kaartcontainer.
//
// LICHT_THEMA_01 LT-04: de kaart is nu een LICHT vlak dat diepte krijgt van
// ZACHTE, GELAAGDE SCHADUW (shadow-card) i.p.v. gloed. Subtiele donkergetinte
// rand, dekkend wit oppervlak, kaartradius uit de tokenlaag. Twee varianten:
//   • standaard — normale kaart-padding (p-card)
//   • compact   — dichte lijst-/detailkaart (p-card-compact)
// Alle waarden komen uit tokens (bg-surface, border-border, rounded-card,
// shadow-card).
//
// MEDIA_UITLEG_01 F2 (CMP-40): optionele diepte via `diepte`. Geen nieuwe
// kaart — dezelfde DsCard, met subtiele kanteling UITSLUITEND tijdens directe
// aanraking (mobiel) of hover/klik (desktop). Rust = geen transform. Faalt
// het effect, dan is dit een gewone kaart met identieke functie. De aanroeper
// beslist óf diepte mag (flag × verminder-beweging × vrijgegeven moment) via
// shouldEnableDiepte uit @/lib/zweefkaart.

const dsCardVariants = cva(
  "rounded-card border border-border bg-surface shadow-card",
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
    VariantProps<typeof dsCardVariants> {
  /** CMP-40 — subtiele diepte tijdens aanraking. Alleen aanzetten via
   *  shouldEnableDiepte(...); nooit hard op true op nieuwe plekken. */
  diepte?: boolean;
}

export const DsCard = React.forwardRef<HTMLDivElement, DsCardProps>(
  ({ className, variant, diepte, style, ...props }, ref) => {
    const [transform, setTransform] = React.useState<string>(RUST_TRANSFORM);
    const actief = transform !== RUST_TRANSFORM;

    const kantel = (e: React.PointerEvent<HTMLDivElement>) => {
      if (!diepte) return;
      // Vangnet: staat de centrale uitschakelaar aan, dan nooit kantelen —
      // ook als een aanroeper de gate vergeet.
      if (typeof document !== "undefined" &&
          document.documentElement.dataset.motion === "off") return;
      const rect = e.currentTarget.getBoundingClientRect();
      setTransform(kantelTransform(computeKanteling(e.clientX, e.clientY, rect)));
    };
    const rust = () => setTransform(RUST_TRANSFORM);

    return (
      <div
        ref={ref}
        className={cn(dsCardVariants({ variant }), className)}
        style={
          diepte
            ? {
                ...style,
                transform,
                // Puur transform — geen layoutshift; duur/easing uit de
                // bevroren motionconfig (F1), niet per component aanpasbaar.
                transitionProperty: "transform",
                transitionDuration: actief
                  ? "var(--motion-duur-kort)"
                  : "var(--motion-duur-normaal)",
                transitionTimingFunction: actief
                  ? "var(--motion-easing-in)"
                  : "var(--motion-easing-uit)",
                willChange: actief ? "transform" : undefined,
              }
            : style
        }
        onPointerDown={diepte ? kantel : undefined}
        onPointerMove={
          diepte
            ? (e) => {
                // Mobiel: alleen tijdens directe aanraking (knoppen ingedrukt);
                // desktop-hover (muis) mag zonder knop.
                if (e.pointerType === "mouse" || e.buttons > 0) kantel(e);
              }
            : undefined
        }
        onPointerUp={diepte ? rust : undefined}
        onPointerLeave={diepte ? rust : undefined}
        onPointerCancel={diepte ? rust : undefined}
        {...props}
      />
    );
  },
);
DsCard.displayName = "DsCard";

/** Kaarttitel in de vaste Figma-titelstijl (Title/Card). */
export function DsCardTitel({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("type-title-card text-foreground", className)} {...props} />
  );
}
