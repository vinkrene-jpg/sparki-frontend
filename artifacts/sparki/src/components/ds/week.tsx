import * as React from "react";
import { cn } from "@/lib/utils";

// Sparki-designsysteem — weekcomponent.
//
// Zeven dagen naast elkaar, past binnen 358px contentbreedte (mobiel 390px
// minus 2×16px marge). Dagstatus wordt niet alleen met kleur getoond: elke
// status heeft een eigen vorm (gevulde stip = training, ring = herstel,
// streepje = leeg) én een aria-label per dag.
//
// Optioneel toont een dag een echte waarde (bijv. belasting "75") onder de
// markering — uitsluitend echte data; "—" betekent eerlijk "geen waarde".

export type DsWeekDagStatus = "training" | "herstel" | "leeg";

export interface DsWeekDag {
  /** Korte daglabel, bijv. "Ma". */
  label: string;
  status: DsWeekDagStatus;
  /** Vandaag/geselecteerd. */
  actief?: boolean;
  /** Optionele echte dagwaarde (bijv. belasting "75"); "—" = geen waarde. */
  waarde?: string;
}

const STATUS_TEKST: Record<DsWeekDagStatus, string> = {
  training: "training",
  herstel: "hersteldag",
  leeg: "geen training",
};

function DagMarkering({ status }: { status: DsWeekDagStatus }) {
  if (status === "training") {
    return (
      <span
        className="h-2 w-2 rounded-full bg-accent-cyan"
        aria-hidden="true"
      />
    );
  }
  if (status === "herstel") {
    return (
      <span
        className="h-2 w-2 rounded-full border-[1.5px] border-positive"
        aria-hidden="true"
      />
    );
  }
  return <span className="h-px w-2 bg-white/25" aria-hidden="true" />;
}

export interface DsWeekProps {
  /** Precies 7 dagen (ma t/m zo); extra items worden genegeerd. */
  dagen: DsWeekDag[];
  className?: string;
}

export function DsWeek({ dagen, className }: DsWeekProps) {
  const week = dagen.slice(0, 7);
  return (
    <div role="list" className={cn("grid grid-cols-7 gap-1.5", className)}>
      {week.map((dag, i) => (
        <div
          key={`${dag.label}-${i}`}
          role="listitem"
          aria-label={`${dag.label}: ${STATUS_TEKST[dag.status]}${dag.actief ? " (vandaag)" : ""}${
            dag.waarde != null && dag.waarde !== "—"
              ? `, belasting ${dag.waarde}`
              : ""
          }`}
          aria-current={dag.actief ? "date" : undefined}
          className={cn(
            "flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-lg border px-0.5 py-2",
            dag.actief
              ? "border-accent-cyan/60 bg-accent-cyan/10"
              : dag.status === "leeg"
                ? "border-white/5 bg-white/[0.02]"
                : "border-border bg-surface",
          )}
        >
          <span
            className={cn(
              "type-label",
              dag.actief ? "text-accent-cyan" : "text-white/60",
            )}
          >
            {dag.label}
          </span>
          <DagMarkering status={dag.status} />
          {dag.waarde != null && (
            <span
              className={cn(
                "num text-[11px] leading-none",
                dag.actief ? "text-white/85" : "text-white/55",
              )}
              aria-hidden="true"
            >
              {dag.waarde}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
