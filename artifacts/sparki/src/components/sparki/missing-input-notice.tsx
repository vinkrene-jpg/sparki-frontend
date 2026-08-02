// ── MissingInputNotice ────────────────────────────────────────────────────────
// The shared UI for every "Sparki needs X" situation. It always:
//   1. explains what's missing (title + description),
//   2. renders a direct action button per missing input (from the registry),
//   3. carries returnTo + retry so the user is sent back and the action retried.
// No empty-state in the app should be a dead-end — use this instead.

import type { ReactNode } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { SparkiCore } from "@/components/sparki/sparki-core";
import { ACCENT } from "@/components/sparki/ui";
import { useStartFix } from "@/hooks/use-missing-input";
import {
  missingTargets,
  type InputTargetKey,
} from "@/lib/missing-input";
import type { AthleteProfile } from "@/lib/athlete-types";

export interface ManualAction {
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}

interface MissingInputNoticeProps {
  title: string;
  description: string;
  /** Profile-backed inputs to offer; only the missing ones render a button. */
  targets?: InputTargetKey[];
  profile?: AthleteProfile | null;
  /** Where to send the user back after they fill in a value. */
  returnTo?: string;
  /** Action key the origin should re-run on return. */
  retry?: string;
  /** Extra manual buttons (e.g. "Ik weet mijn FTP niet", "Race toevoegen"). */
  actions?: ManualAction[];
  /** The main filled action, rendered last (e.g. "Bouw mijn plan"). */
  primary?: ManualAction;
  /** Slim inline variant for small empty-states. */
  compact?: boolean;
  /** Kleurtoon: "dark" (standaard, glaskaart op foto) of "light" voor de witte
   *  datapagina's zoals Analyse. */
  tone?: "dark" | "light";
  /** Show the Sparki orb (full variant only). Default true. */
  showOrb?: boolean;
  icon?: ReactNode;
}

function SecondaryButton({
  label,
  onClick,
  loading,
  disabled,
  tone = "dark",
}: ManualAction & { tone?: "dark" | "light" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={
        tone === "light"
          ? "flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-card px-4 py-2.5 font-sans text-[13px] font-medium text-slate-700 transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan disabled:opacity-40"
          : "flex items-center justify-between gap-2 rounded-xl border border-border bg-muted px-4 py-2.5 font-sans text-[13px] font-medium text-foreground/80 transition-colors hover:border-accent-cyan/30 hover:text-accent-cyan disabled:opacity-40"
      }
    >
      <span>{label}</span>
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <ChevronRight
          className={tone === "light" ? "h-3.5 w-3.5 text-slate-400" : "h-3.5 w-3.5 text-muted-foreground"}
          strokeWidth={2}
        />
      )}
    </button>
  );
}

function PrimaryButton({ label, onClick, loading, disabled }: ManualAction) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="flex items-center justify-center gap-2 rounded-2xl px-5 py-3 font-sans text-[13px] font-semibold disabled:opacity-50"
      style={{ background: ACCENT, color: "var(--color-on-accent)" }}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {label}
    </button>
  );
}

export function MissingInputNotice({
  title,
  description,
  targets = [],
  profile,
  returnTo,
  retry,
  actions = [],
  primary,
  compact = false,
  showOrb = true,
  icon,
  tone = "dark",
}: MissingInputNoticeProps) {
  const startFix = useStartFix();
  const missing = missingTargets(targets, profile);

  const targetButtons = missing.map((t) => ({
    label: t.label,
    onClick: () => startFix(t.key, { returnTo, retry }),
  }));
  const allSecondary = [...targetButtons, ...actions];

  if (compact) {
    return (
      <div
        className={
          tone === "light"
            ? "rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5"
            : "rounded-xl border border-border bg-card px-4 py-3.5 backdrop-blur-md"
        }
      >
        <p className={tone === "light" ? "font-sans text-[13px] font-medium text-slate-800" : "font-sans text-[13px] font-light text-foreground/80"}>{title}</p>
        <p className={tone === "light" ? "mt-1 text-[12px] leading-relaxed text-slate-500" : "mt-1 text-[12px] leading-relaxed text-muted-foreground"}>
          {description}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {allSecondary.map((b, i) => (
            <SecondaryButton key={i} {...b} tone={tone} />
          ))}
          {primary && <PrimaryButton {...primary} />}
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        tone === "light"
          ? "flex flex-col items-center gap-5 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-10 text-center"
          : "flex flex-col items-center gap-5 rounded-2xl border border-border bg-card px-6 py-10 text-center backdrop-blur-md"
      }
    >
      {icon ?? (showOrb && (
        <SparkiCore size={40} accent={ACCENT} readiness={0.85} variant="orb" />
      ))}
      <div>
        <p className={tone === "light" ? "font-sans text-[15px] font-medium text-slate-800" : "font-sans text-[15px] font-light text-foreground/85"}>{title}</p>
        <p className={tone === "light" ? "mt-1.5 max-w-[28rem] text-[13px] leading-relaxed text-slate-500" : "mt-1.5 max-w-[28rem] text-[13px] leading-relaxed text-muted-foreground"}>
          {description}
        </p>
      </div>
      {allSecondary.length > 0 && (
        <div className="flex w-full max-w-xs flex-col gap-2">
          {allSecondary.map((b, i) => (
            <SecondaryButton key={i} {...b} tone={tone} />
          ))}
        </div>
      )}
      {primary && <PrimaryButton {...primary} />}
    </div>
  );
}
