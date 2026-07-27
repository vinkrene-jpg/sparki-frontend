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
  beschrijving?: string;
  /** Optionele herstelactie (bijv. "Opnieuw proberen" of "Koppel je meter"). */
  actie?: { label: string; onClick: () => void };
  className?: string;
}

export function DsState({
  soort = "info",
  titel,
  beschrijving,
  actie,
  className,
}: DsStateProps) {
  const Icon = SOORT_ICONEN[soort];
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
          {beschrijving && (
            <p className="mt-0.5 type-body-sm text-white/50">{beschrijving}</p>
          )}
          {actie && (
            <DsButton
              variant="secundair"
              className="mt-3"
              onClick={actie.onClick}
            >
              {actie.label}
            </DsButton>
          )}
        </div>
      </div>
    </div>
  );
}
