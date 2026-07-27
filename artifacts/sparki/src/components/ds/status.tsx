import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import {
  IconFout,
  IconInfo,
  IconPositief,
  IconWaarschuwing,
  type LucideIcon,
} from "./icons";

// Sparki-designsysteem — statusindicator.
//
// Status wordt NOOIT uitsluitend met kleur gecommuniceerd: elke status heeft
// een eigen icoon én een verplicht tekstlabel (children). Kleuren komen uit
// de tokenlaag (positive/warning/negative).

export type DsStatusSoort = "positief" | "waarschuwing" | "fout" | "neutraal";

const dsStatusVariants = cva(
  "inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1 type-label",
  {
    variants: {
      status: {
        positief: "border-positive/30 bg-positive/10 text-positive",
        waarschuwing: "border-warning/30 bg-warning/10 text-warning",
        fout: "border-negative/30 bg-negative/10 text-negative",
        neutraal: "border-border bg-surface text-white/70",
      },
    },
    defaultVariants: { status: "neutraal" },
  },
);

const STATUS_ICONEN: Record<DsStatusSoort, LucideIcon> = {
  positief: IconPositief,
  waarschuwing: IconWaarschuwing,
  fout: IconFout,
  neutraal: IconInfo,
};

export interface DsStatusProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof dsStatusVariants> {
  /** Verplicht tekstlabel — status is nooit alleen een kleur. */
  children: React.ReactNode;
}

export function DsStatus({
  status = "neutraal",
  children,
  className,
  ...props
}: DsStatusProps) {
  const Icon = STATUS_ICONEN[status ?? "neutraal"];
  return (
    <span className={cn(dsStatusVariants({ status }), className)} {...props}>
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </span>
  );
}
