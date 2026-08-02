import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { Sparkles, Award, Wrench, ChevronRight } from "lucide-react"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { apiFetch } from "@/lib/api"
import { queryKeys, STALE } from "@/lib/query-keys"

// ─────────────────────────────────────────────────────────────────────────────
// Sparki's evidence-gated surfaces, split by where they belong:
//  • SparkiObservations (Inzicht) — the curiosity headline "Wat vandaag opvalt":
//      · Open loops — curiosity teasers Sparki has earned the right to open.
//      · "Sparki, eerlijk?" — one honest observation, on demand.
//  • FoundingSection (Profiel) — account identity:
//      · Founding Athlete badge — a real account fact (#00N) + its copy.
//      · Hoofdtester — running joke surface, only when the account is flagged.
//
// Everything here is backed by real endpoints. No mock data: when Sparki has no
// evidence yet, the surface says so plainly instead of inventing content.
// ─────────────────────────────────────────────────────────────────────────────

type OpenLoop = { id: string; text: string }
type Honest = {
  text: string
  founded: boolean
  kind: "underestimates" | "better_than_thought" | "doubts_theory" | "insufficient"
}
type Identity = {
  foundingNumber: number | null
  foundingLabel: string | null
  foundingLines: string[]
  isHeadTester: boolean
  headTesterLine: string | null
}

// ── Open loops ───────────────────────────────────────────────────────────────

function OpenLoops() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.insights.openLoops(),
    queryFn: () => apiFetch<{ loops: OpenLoop[] }>("/api/open-loops"),
    staleTime: STALE.session,
  })

  if (isLoading) {
    return <div className="h-16 animate-pulse rounded-2xl bg-muted" />
  }

  const loops = data?.loops ?? []
  if (loops.length === 0) {
    return (
      <p className="text-pretty text-[12px] leading-relaxed text-muted-foreground">
        Nog geen observaties beschikbaar. Log een paar ritten of koppel je data —
        zodra de data er aanleiding toe geeft, verschijnen ze hier.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2.5">
      {loops.map((loop) => (
        <div
          key={loop.id}
          className="flex items-center gap-3 rounded-2xl border px-4 py-3.5"
          style={{ borderColor: "rgba(120,210,230,0.18)", background: "rgba(120,210,230,0.05)" }}
        >
          <Sparkles className="h-4 w-4 shrink-0" style={{ color: ACCENT }} strokeWidth={1.75} />
          <span className="font-sans text-[13px] leading-snug text-foreground/80">{loop.text}</span>
        </div>
      ))}
    </div>
  )
}

// ── "Sparki, eerlijk?" ───────────────────────────────────────────────────────

function HonestButton() {
  const [result, setResult] = useState<Honest | null>(null)

  const ask = useMutation({
    mutationFn: () => apiFetch<{ observation: Honest }>("/api/honest"),
    onSuccess: (d) => setResult(d.observation),
  })

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => ask.mutate()}
        disabled={ask.isPending}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border font-sans text-[13px] font-medium transition-colors disabled:opacity-50"
        style={{ borderColor: "rgba(120,210,230,0.3)", background: "rgba(120,210,230,0.06)", color: "rgba(255,255,255,0.9)" }}
      >
        {ask.isPending ? "Bezig…" : "Toon onderbouwde observatie"}
      </button>

      {ask.isError && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 font-sans text-[12px] text-red-400">
          De observatie kon niet worden geladen. Probeer het zo nog eens.
        </p>
      )}

      {result && (
        <div
          className="rounded-2xl border px-4 py-3.5"
          style={
            result.founded
              ? { borderColor: "rgba(120,210,230,0.25)", background: "rgba(120,210,230,0.06)" }
              : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.025)" }
          }
        >
          <p
            className="font-sans text-[14px] leading-relaxed"
            style={{ color: result.founded ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.55)" }}
          >
            {result.text}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Founding Athlete badge + Hoofdtester ─────────────────────────────────────

function IdentityBadges() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.onboarding.identity(),
    queryFn: () => apiFetch<Identity>("/api/onboarding/identity"),
    staleTime: STALE.profile,
  })

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-2xl bg-muted" />
  }
  if (!data) return null

  return (
    <div className="flex flex-col gap-3">
      {data.foundingLabel ? (
        <div
          className="overflow-hidden rounded-2xl border px-5 py-4"
          style={{ borderColor: "rgba(120,210,230,0.3)", background: "rgba(120,210,230,0.06)" }}
        >
          <div className="flex items-center gap-3">
            <Award className="h-5 w-5 shrink-0" style={{ color: ACCENT }} strokeWidth={1.75} />
            <span className="font-sans text-[15px] font-semibold tracking-tight text-foreground/90">
              {data.foundingLabel}
            </span>
          </div>
          {data.foundingLines.length > 0 && (
            <div className="mt-3 flex flex-col gap-1 pl-8">
              {data.foundingLines.map((line, i) => (
                <p
                  key={i}
                  className="font-sans text-[12px] leading-relaxed"
                  style={{ color: i === data.foundingLines.length - 1 ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.6)" }}
                >
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>
      ) : (
        <p className="text-pretty text-[12px] leading-relaxed text-muted-foreground">
          Rond de kennismaking met Sparki af om je Founding Athlete-nummer te verdienen.
        </p>
      )}

      {data.isHeadTester && data.headTesterLine && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-muted px-5 py-4">
          <Wrench className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Hoofdtester
            </span>
            <span className="font-sans text-[13px] leading-snug text-foreground/80">
              {data.headTesterLine}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Inzicht: the daily curiosity surface ─────────────────────────────────────

/**
 * "Wat vandaag opvalt" — the curiosity headline for Inzicht. Shows the open
 * loops that have been earned (auto, evidence-gated) plus one
 * honest observation on demand. Stays plain / silent when there is not enough
 * real data — it never invents a teaser.
 */
export function SparkiObservations() {
  return (
    <section>
      <SectionLabel title="Observaties uit je data" />
      <p className="mt-2 text-pretty text-[12px] leading-relaxed text-muted-foreground">
        Automatische observaties op basis van je eigen trainingsdata — alleen zichtbaar wanneer de data er aanleiding toe geeft
      </p>
      <div className="mt-5 flex flex-col gap-6">
        <OpenLoops />
        <div>
          <p className="mb-3 text-pretty text-[12px] leading-relaxed text-muted-foreground">
            Vraag één onderbouwde observatie op — alleen wanneer de data die ondersteunt.
          </p>
          <HonestButton />
        </div>
      </div>
    </section>
  )
}

// ── Profiel: Founding Athlete identity ───────────────────────────────────────

/** Founding Athlete number + Hoofdtester line — a real account fact, on Profiel. */
export function FoundingSection() {
  return (
    <section>
      <SectionLabel n="05" title="Founding Athlete" />
      <div className="mt-4">
        <IdentityBadges />
      </div>
    </section>
  )
}
