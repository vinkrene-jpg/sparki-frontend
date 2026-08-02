import { useLocation } from "wouter"
import {
  useTrainingPlan,
  usePlanWindow,
  useGeneratePlan,
  useAdaptTrainingPlan,
} from "@/hooks/use-training-plan"
import { useAthleteExtendedProfile } from "@/hooks/use-athlete-extended-profile"
import { detectSource } from "@/lib/train-intelligence"
import { isTargetSet } from "@/lib/missing-input"
import { MissingInputNotice } from "@/components/sparki/missing-input-notice"
import { LayerHeading } from "@/components/sparki/train/layer-heading"
import { ACCENT } from "@/components/sparki/ui"
import {
  UserCog,
  PencilLine,
  Sparkles,
  Loader2,
  RefreshCw,
  Hammer,
} from "lucide-react"

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} />
}

const cardClass =
  "rounded-2xl border border-border bg-card p-5 backdrop-blur-md"

export function SourceLayer() {
  const [, navigate] = useLocation()
  const { data: plan, isLoading } = useTrainingPlan()
  const { data: planWindow } = usePlanWindow(3)
  const { data: profile } = useAthleteExtendedProfile()
  const generate = useGeneratePlan()
  const adapt = useAdaptTrainingPlan()

  const hasManual =
    (planWindow?.length ?? 0) > 0 && !plan?.plan && !plan?.hasCoach
  const source = detectSource(plan, hasManual)
  const canBuildNow =
    isTargetSet("ftp", profile) && isTargetSet("weeklyHours", profile)

  const Icon =
    source.kind === "coach"
      ? UserCog
      : source.kind === "sparki"
        ? Sparkles
        : PencilLine

  const scrollToGrid = () =>
    setTimeout(() => {
      document
        .getElementById("three-week-plan")
        ?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 120)

  const build = () =>
    generate.mutate(undefined, { onSuccess: scrollToGrid })

  const adaptationCount = plan?.plan?.adaptationState?.adaptationCount ?? 0

  return (
    <section className="flex flex-col gap-4">
      <LayerHeading
        title="Waar komt je training vandaan"
        subtitle="Wie je schema bepaalt, bepaalt ook hoe het meebeweegt met je vorm."
      />

      {isLoading ? (
        <div className={cardClass}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-3 h-4 w-full" />
        </div>
      ) : (
        <div className={cardClass}>
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
              style={{
                borderColor: "rgba(120,210,230,0.25)",
                background: "rgba(120,210,230,0.07)",
              }}
            >
              <Icon className="h-4 w-4" style={{ color: ACCENT }} strokeWidth={1.75} />
            </span>
            <div>
              <p className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
                BRON
              </p>
              <p className="font-sans text-[15px] font-medium text-foreground/90">
                {source.label}
              </p>
            </div>
          </div>

          <p className="mt-3 text-pretty text-[13px] leading-relaxed text-muted-foreground">
            {source.detail}
          </p>

          {/* Sparki is the source → it can rebuild and adapt the plan. */}
          {source.kind === "sparki" && (
            <>
              {plan?.plan?.summary && (
                <p className="mt-3 rounded-xl border border-border bg-muted p-3 text-pretty text-[12px] leading-relaxed text-muted-foreground">
                  {plan.plan.summary}
                </p>
              )}
              {adaptationCount > 0 && (
                <p className="mt-2 font-mono text-[10px] tracking-wide text-muted-foreground">
                  {adaptationCount}× aangepast op hoe je traint
                </p>
              )}
              <div className="ds-actiebalk mt-4 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => adapt.mutate()}
                  disabled={adapt.isPending}
                  className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 font-sans text-[13px] font-medium text-muted-foreground transition-colors hover:border-accent-cyan disabled:opacity-50"
                >
                  {adapt.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
                  )}
                  Pas mijn plan aan
                </button>
                <button
                  type="button"
                  onClick={build}
                  disabled={generate.isPending}
                  className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 font-sans text-[13px] font-medium text-muted-foreground transition-colors hover:border-border disabled:opacity-50"
                >
                  {generate.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Hammer className="h-3.5 w-3.5" strokeWidth={1.75} />
                  )}
                  Bouw opnieuw
                </button>
              </div>
              {adapt.isError && (
                <p className="mt-2.5 text-[12px] text-[color:var(--color-negative)]">
                  Aanpassen lukte niet. Probeer het opnieuw.
                </p>
              )}
              {!adapt.isPending && adapt.isSuccess && adapt.data && (
                <p
                  className={`mt-2.5 rounded-xl border p-3 text-pretty text-[12px] leading-relaxed ${
                    adapt.data.adapted
                      ? "border-accent-cyan bg-accent-cyan text-accent-cyan"
                      : "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  {adapt.data.adapted
                    ? adapt.data.note
                    : "Geen aanpassing nodig — je voorlopige weken passen nog bij je herstel."}
                </p>
              )}
            </>
          )}

          {/* No source yet (or self-entered) → offer to let Sparki build one. */}
          {(source.kind === "none" || source.kind === "self") && (
            <div className="mt-4">
              {!canBuildNow ? (
                <MissingInputNotice
                  compact
                  showOrb={false}
                  title="Laat je schema opbouwen"
                  description="Met je FTP en wekelijkse uren komt er een periodiseerd plan dat meebeweegt met je vorm."
                  targets={["ftp", "weeklyHours"]}
                  profile={profile}
                  returnTo="/train"
                  retry="generate-plan"
                />
              ) : (
                <button
                  type="button"
                  onClick={build}
                  disabled={generate.isPending}
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 font-sans text-[13px] font-semibold transition-opacity disabled:opacity-50"
                  style={{ background: ACCENT, color: "#040506" }}
                >
                  {generate.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Hammer className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                  Schema bouwen
                </button>
              )}
              {generate.isError && (
                <p className="mt-3 text-[12px] text-[color:var(--color-negative)]">
                  {generate.error instanceof Error &&
                  generate.error.message.includes("profile_incomplete")
                    ? "Je FTP of wekelijkse uren ontbreken nog. Vul ze aan bij je profiel."
                    : "Het opbouwen lukte niet. Probeer het opnieuw."}
                </p>
              )}
            </div>
          )}

          {/* Coach owns the schedule → Sparki only advises. */}
          {source.kind === "coach" && (
            <button
              type="button"
              onClick={() => navigate("/samen")}
              className="mt-4 font-mono text-[11px] tracking-wide text-accent-cyan transition-colors hover:text-accent-cyan"
            >
              Bekijk wat je trainer heeft klaargezet →
            </button>
          )}

          {/* Honest about what isn't wired: no external schedule import yet. */}
          {source.kind !== "coach" && (
            <p className="mt-4 border-t border-border pt-3 font-mono text-[10px] leading-relaxed tracking-wide text-muted-foreground">
              Externe schema's importeren (zoals TrainingPeaks) kan nog niet —
              alleen je eigen invoer en gekoppelde platforms tellen mee.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
