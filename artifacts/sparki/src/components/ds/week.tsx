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
//
// Selecteerbare variant (`onSelecteer`): dagen worden knoppen (≥44px) met
// aria-pressed, zodat Plan een dag kan kiezen. In die modus betekent `actief`
// "geselecteerd" en markeert `vandaag` de echte vandaag-dag (aria-current).
// Zonder `onSelecteer` verandert er niets aan de bestaande statische weergave
// (daar betekent `actief` gewoon "vandaag").

export type DsWeekDagStatus = "training" | "herstel" | "leeg";

export interface DsWeekDag {
  /** Korte daglabel, bijv. "Ma". */
  label: string;
  status: DsWeekDagStatus;
  /** Statisch: vandaag. Selecteerbaar (onSelecteer): geselecteerde dag. */
  actief?: boolean;
  /** Alleen in de selecteerbare variant: markeert de echte vandaag-dag. */
  vandaag?: boolean;
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
  return <span className="h-px w-2 bg-muted" aria-hidden="true" />;
}

function dagAriaLabel(dag: DsWeekDag, selecteerbaar: boolean): string {
  const suffix = selecteerbaar
    ? `${dag.vandaag ? " (vandaag)" : ""}${dag.actief ? " (geselecteerd)" : ""}`
    : dag.actief
      ? " (vandaag)"
      : "";
  const waarde =
    dag.waarde != null && dag.waarde !== "—" ? `, belasting ${dag.waarde}` : "";
  return `${dag.label}: ${STATUS_TEKST[dag.status]}${suffix}${waarde}`;
}

function dagVlakKlassen(dag: DsWeekDag): string {
  return cn(
    "flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-lg border px-0.5 py-2",
    dag.actief
      ? "border-accent-cyan/60 bg-accent-cyan/10"
      : dag.vandaag
        ? "border-border bg-surface"
        : dag.status === "leeg"
          ? "border-border bg-muted"
          : "border-border bg-surface",
  );
}

function DagInhoud({ dag }: { dag: DsWeekDag }) {
  return (
    <>
      <span
        className={cn(
          "type-label",
          dag.actief
            ? "text-accent-cyan"
            : dag.vandaag
              ? "text-foreground/80"
              : "text-muted-foreground",
        )}
      >
        {dag.label}
      </span>
      <DagMarkering status={dag.status} />
      {dag.waarde != null && (
        <span
          className={cn(
            "num text-[11px] leading-none",
            dag.actief ? "text-foreground/80" : "text-muted-foreground",
          )}
          aria-hidden="true"
        >
          {dag.waarde}
        </span>
      )}
    </>
  );
}

export interface DsWeekProps {
  /** Precies 7 dagen (ma t/m zo); extra items worden genegeerd. */
  dagen: DsWeekDag[];
  className?: string;
  /** Maakt dagen selecteerbaar; ontvangt de dag-index (0–6). */
  onSelecteer?: (index: number) => void;
  /** Toegankelijk groepslabel in de selecteerbare variant. */
  selectieLabel?: string;
}

export function DsWeek({
  dagen,
  className,
  onSelecteer,
  selectieLabel,
}: DsWeekProps) {
  const week = dagen.slice(0, 7);

  if (onSelecteer) {
    return (
      <div
        role="group"
        aria-label={selectieLabel ?? "Kies een dag"}
        className={cn("grid grid-cols-7 gap-1.5", className)}
      >
        {week.map((dag, i) => (
          <button
            key={`${dag.label}-${i}`}
            type="button"
            onClick={() => onSelecteer(i)}
            aria-label={dagAriaLabel(dag, true)}
            aria-pressed={dag.actief ? "true" : "false"}
            aria-current={dag.vandaag ? "date" : undefined}
            className={cn(
              dagVlakKlassen(dag),
              "transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/60",
            )}
          >
            <DagInhoud dag={dag} />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div role="list" className={cn("grid grid-cols-7 gap-1.5", className)}>
      {week.map((dag, i) => (
        <div
          key={`${dag.label}-${i}`}
          role="listitem"
          aria-label={dagAriaLabel(dag, false)}
          aria-current={dag.actief ? "date" : undefined}
          className={dagVlakKlassen(dag)}
        >
          <DagInhoud dag={dag} />
        </div>
      ))}
    </div>
  );
}
