import * as React from "react";
import { cn } from "@/lib/utils";
import {
  IconAnalyse,
  IconHome,
  IconMenu,
  IconPlan,
  IconRijden,
  type LucideIcon,
} from "./icons";

// Sparki-designsysteem — mobiele hoofdnavigatie (herbruikbaar).
//
// Presentational component: geen routerkennis, navigatie loopt via
// `onNavigeer`. Elk item heeft een aanraakvlak van minimaal 44px en de balk
// respecteert de safe-area onderaan. De actieve tab krijgt accent-cyaan met
// gloed; een optionele aandachtstatus toont een stip mét sr-only-tekst
// (nooit alleen kleur). De bestaande app-navigatie (BottomNav) blijft
// ongewijzigd — dit is de designsysteem-basis voor toekomstige migratie.

export interface DsNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Vraagt aandacht (stip + sr-only-melding). */
  aandacht?: boolean;
}

/** Standaardindeling volgens de Figma-basis. */
export const DS_NAV_STANDAARD: DsNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: IconHome },
  { href: "/plan", label: "Plan", icon: IconPlan },
  { href: "/rijden", label: "Rijden", icon: IconRijden },
  { href: "/analyse", label: "Analyse", icon: IconAnalyse },
  { href: "/meer", label: "Meer", icon: IconMenu },
];

export interface DsMobileNavProps {
  items?: DsNavItem[];
  actiefPad: string;
  onNavigeer?: (href: string) => void;
  /** Vast onderaan het scherm (standaard) of in de contentflow (demo). */
  vast?: boolean;
  className?: string;
}

export function DsMobileNav({
  items = DS_NAV_STANDAARD,
  actiefPad,
  onNavigeer,
  vast = true,
  className,
}: DsMobileNavProps) {
  return (
    <nav
      aria-label="Hoofdnavigatie"
      className={cn(
        vast && "fixed inset-x-0 bottom-0 z-40",
        "border-t border-border bg-app-deep/90 backdrop-blur-xl",
        className,
      )}
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
    >
      <div className="mx-auto flex w-full max-w-md items-stretch px-2 pt-1.5">
        {items.map((item) => {
          const actief =
            item.href === actiefPad || actiefPad.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => onNavigeer?.(item.href)}
              aria-current={actief ? "page" : undefined}
              className="flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 overflow-hidden rounded-lg py-1 transition-colors"
            >
              <span className="relative">
                <Icon
                  className={cn(
                    "h-5 w-5",
                    actief ? "text-accent-cyan" : "text-muted-foreground",
                  )}
                  style={
                    actief
                      ? { filter: "drop-shadow(0 0 6px var(--accent-cyan))" }
                      : undefined
                  }
                  aria-hidden="true"
                />
                {item.aandacht && (
                  <span
                    className="absolute -right-1 -top-0.5 h-1.5 w-1.5 rounded-full bg-warning"
                    aria-hidden="true"
                  />
                )}
              </span>
              <span
                className={cn(
                  "type-label",
                  actief ? "text-accent-cyan" : "text-muted-foreground",
                )}
              >
                {item.label}
                {item.aandacht && (
                  <span className="sr-only"> — vraagt aandacht</span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
