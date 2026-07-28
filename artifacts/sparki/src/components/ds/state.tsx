import * as React from "react";
import { cn } from "@/lib/utils";
import { DsButton } from "./button";
import {
  IconInfo,
  IconLeeg,
  IconNietBeschikbaar,
  type LucideIcon,
} from "./icons";

// Sparki-designsysteem — compacte toestand.
//
// Voor korte informatieve meldingen, "nog geen gegevens" en "niet
// beschikbaar". Eerlijk by design: dit component toont uitsluitend de
// aangeleverde tekst — nooit verzonnen voorbeeld- of nepdata. Een optionele
// herstelactie geeft de gebruiker direct een uitweg.

export type DsStateSoort = "info" | "leeg" | "nietBeschikbaar";

const SOORT_ICONEN: Record<DsStateSoort, LucideIcon> = {
  info: IconInfo,
  leeg: IconLeeg,
  nietBeschikbaar: IconNietBeschikbaar,
};

export interface DsStateProps {
  soort?: DsStateSoort;
  titel: string;
  /** Maximaal één korte zin — details horen in `uitleg`. */
  beschrijving?: string;
  /** Optionele herstelactie (bijv. "Opnieuw proberen" of "Koppel je meter"). */
  actie?: { label: string; onClick: () => void };
  /** Langere toelichting, ingeklapt achter een "Meer uitleg"-link. */
  uitleg?: { tekst: string; label?: string };
  className?: string;
}

export function DsState({
  soort = "info",
  titel,
  beschrijving,
  actie,
  uitleg,
  className,
}: DsStateProps) {
  const Icon = SOORT_ICONEN[soort];
  const [uitlegOpen, setUitlegOpen] = React.useState(false);
  return (
    <div
      role="status"
      className={cn(
        "rounded-card border border-border bg-surface p-card-compact",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <Icon
          className="mt-0.5 h-4 w-4 shrink-0 text-white/45"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="type-body font-medium text-white/85">{titel}</p>
          {/* Actie eerst, dan maximaal één korte zin, details achter een link. */}
          {actie && (
            <DsButton
              variant="secundair"
              className="mt-2.5"
              onClick={actie.onClick}
            >
              {actie.label}
            </DsButton>
          )}
          {beschrijving && (
            <p className="mt-2 type-body-sm text-white/50">{beschrijving}</p>
          )}
          {uitleg && (
            <>
              <button
                type="button"
                onClick={() => setUitlegOpen((v) => !v)}
                aria-expanded={uitlegOpen}
                className="mt-2 type-body-sm text-white/45 underline underline-offset-2 transition-colors hover:text-white/70"
              >
                {uitleg.label ?? "Meer uitleg"}
              </button>
              {uitlegOpen && (
                <p className="mt-1.5 type-body-sm text-white/50">
                  {uitleg.tekst}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
