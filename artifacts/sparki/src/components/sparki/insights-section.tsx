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
    return <div className="h-16 animate-pulse rounded-2xl bg-white/[0.03]" />
  }

  const loops = data?.loops ?? []
  if (loops.length === 0) {
    return (
      <p className="text-pretty text-[12px] leading-relaxed text-white/35">
        Sparki heeft nog geen observaties geopend. Rijd een paar ritten en koppel je
        data — dan begint hij theorieën te vormen.
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
          <span className="font-sans text-[13px] leading-snug text-white/85">{loop.text}</span>
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
        {ask.isPending ? "Bezig…" : "Sparki, eerlijk?"}
      </button>

      {ask.isError && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 font-sans text-[12px] text-red-400">
          Kon Sparki's oordeel niet laden. Probeer het zo nog eens.
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
    return <div className="h-24 animate-pulse rounded-2xl bg-white/[0.03]" />
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
            <span className="font-sans text-[15px] font-semibold tracking-tight text-white/95">
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
        <p className="text-pretty text-[12px] leading-relaxed text-white/35">
          Rond de kennismaking met Sparki af om je Founding Athlete-nummer te verdienen.
        </p>
      )}

      {data.isHeadTester && data.headTesterLine && (
        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-4">
          <Wrench className="h-4 w-4 shrink-0 text-white/55" strokeWidth={1.75} />
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">
              Hoofdtester
            </span>
            <span className="font-sans text-[13px] leading-snug text-white/80">
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
      <SectionLabel title="Wat vandaag opvalt" />
      <p className="mt-2 text-pretty text-[12px] leading-relaxed text-white/35">
        Wat opvalt in jouw echte data — alleen als er iets te zeggen valt
      </p>
      <div className="mt-5 flex flex-col gap-6">
        <OpenLoops />
        <div>
          <p className="mb-3 text-pretty text-[12px] leading-relaxed text-white/35">
            Of vraag Sparki om één eerlijke observatie — alleen als de data het
            onderbouwt.
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
