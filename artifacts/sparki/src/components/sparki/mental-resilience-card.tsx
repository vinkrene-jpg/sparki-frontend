// Mentale Weerbaarheid — Lab-sectie. Toont de deterministische uitvoerings-
// score, weekontwikkeling, echte patronen met techniek uit de Mentale
// Bibliotheek, risicofactoren, advies, voorbereiding op de eerstvolgende zware
// training en een eerlijke nabespreking. Geen medische duiding; eerlijke lege
// staat als er te weinig gepland is.

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useLocation } from "wouter"
import { apiFetch } from "@/lib/api"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { MissingInputNotice } from "@/components/sparki/missing-input-notice"

type Technique = {
  key: string
  name: string
  short: string
  how: string
  intelDedupeKey: string | null
}

type Pattern = {
  key: string
  label: string
  detail: string
  occurrences: number
  technique: Technique
}

type WeekPoint = {
  weekStart: string
  score: number | null
  planned: number
  completed: number
}

type Preparation = {
  workoutId: number
  date: string
  title: string
  whyItMatters: string
  expectedResistance: string
  cues: string[]
  technique: Technique
}

type Debrief = {
  workoutId: number
  date: string
  title: string
  outcome: "volbracht" | "ingekort" | "gemist"
  facts: string
  reflection: string
}

type MentalOverview = {
  state: "ok" | "insufficient"
  reason: string | null
  score: number | null
  confidence: number | null
  confidenceReason: string | null
  weeks: WeekPoint[]
  patterns: Pattern[]
  riskFactors: string[]
  advice: string[]
  preparation: Preparation | null
  debrief: Debrief | null
  windowDays: number
  plannedCount: number
  completedCount: number
}

function useMentalOverview() {
  return useQuery({
    queryKey: ["mental-overview"],
    queryFn: () =>
      apiFetch<{ overview: MentalOverview }>("/api/mental/overview"),
    staleTime: 5 * 60 * 1000,
  })
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} />
}

function scoreColor(score: number): string {
  if (score >= 75) return ACCENT
  if (score >= 50) return "rgba(255,205,120,0.9)"
  return "rgba(255,140,120,0.9)"
}

function WeekBars({ weeks }: { weeks: WeekPoint[] }) {
  const shown = weeks.slice(-6)
  if (shown.length === 0) return null
  return (
    <div className="flex items-end gap-2" aria-hidden>
      {shown.map((w) => (
        <div key={w.weekStart} className="flex flex-col items-center gap-1">
          <div className="flex h-14 w-6 items-end rounded bg-white/[0.04]">
            {w.score != null ? (
              <div
                className="w-full rounded"
                style={{
                  height: `${Math.max(6, w.score)}%`,
                  background: scoreColor(w.score),
                  opacity: 0.85,
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="text-[9px] text-white/25">?</span>
              </div>
            )}
          </div>
          <span className="font-mono text-[9px] text-white/30">
            {new Date(w.weekStart + "T12:00:00").toLocaleDateString("nl-NL", {
              day: "numeric",
              month: "numeric",
            })}
          </span>
        </div>
      ))}
    </div>
  )
}

function TechniqueChip({ technique }: { technique: Technique }) {
  const [open, setOpen] = useState(false)
  const [, navigate] = useLocation()
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-white/[0.1] px-3 py-1 text-[11px] text-white/70 transition-colors hover:border-white/25"
      >
        Techniek: {technique.name} {open ? "−" : "+"}
      </button>
      {open && (
        <div className="mt-2 rounded-xl bg-white/[0.03] p-3">
          <p className="text-[12px] text-white/70">{technique.how}</p>
          {technique.intelDedupeKey && (
            <button
              type="button"
              onClick={() => navigate("/feed")}
              className="mt-2 text-[11px] underline decoration-white/25 underline-offset-2"
              style={{ color: ACCENT }}
            >
              Lees meer in Ontdekken
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const OUTCOME_LABEL: Record<Debrief["outcome"], string> = {
  volbracht: "Volbracht",
  ingekort: "Ingekort",
  gemist: "Niet gereden",
}

export function MentalResilienceCard({ n }: { n?: string }) {
  const { data, isLoading, isError } = useMentalOverview()
  const [, navigate] = useLocation()
  const [showPrep, setShowPrep] = useState(false)

  return (
    <section>
      <SectionLabel n={n} title="Mentale weerbaarheid" />
      <div className="mt-4">
        {isLoading ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : isError || !data ? (
          <p className="text-[12px] text-white/45">
            Het overzicht kon nu niet worden geladen. Probeer het later opnieuw.
          </p>
        ) : data.overview.state === "insufficient" ? (
          <MissingInputNotice
            compact
            showOrb={false}
            title="Nog geen beeld van je uitvoering"
            description={
              data.overview.reason ??
              "Er zijn te weinig geplande trainingen om patronen te zien."
            }
            actions={[
              {
                label: "Ga naar Training",
                onClick: () => navigate("/train"),
              },
            ]}
          />
        ) : (
          <div className="flex flex-col gap-5">
            {/* Score + weekly development */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-baseline gap-2">
                  <span
                    className="font-mono text-3xl tabular-nums"
                    style={{ color: scoreColor(data.overview.score ?? 0) }}
                  >
                    {data.overview.score}
                  </span>
                  <span className="text-[11px] text-white/35">/ 100</span>
                </div>
                <p className="mt-1 max-w-[30ch] text-[11px] leading-relaxed text-white/45">
                  Uitvoering van je geplande trainingen, laatste{" "}
                  {data.overview.windowDays} dagen:{" "}
                  {data.overview.completedCount} van {data.overview.plannedCount}{" "}
                  gereden.
                </p>
              </div>
              <WeekBars weeks={data.overview.weeks} />
            </div>

            {data.overview.confidenceReason && (
              <p className="text-[11px] leading-relaxed text-white/35">
                {data.overview.confidenceReason}
              </p>
            )}

            {/* Patterns */}
            {data.overview.patterns.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                  Terugkerende patronen
                </p>
                {data.overview.patterns.map((p) => (
                  <div
                    key={p.key}
                    className="rounded-xl border border-white/[0.06] bg-[#070d16]/[0.82] p-3 backdrop-blur-md"
                  >
                    <p className="text-[13px] font-medium text-white/85">
                      {p.label}
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-white/55">
                      {p.detail}
                    </p>
                    <TechniqueChip technique={p.technique} />
                  </div>
                ))}
              </div>
            )}

            {/* Risk factors */}
            {data.overview.riskFactors.length > 0 && (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                  Waar dit toe kan leiden
                </p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {data.overview.riskFactors.map((r) => (
                    <li key={r} className="text-[12px] leading-relaxed text-white/55">
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Advice */}
            {data.overview.advice.length > 0 && (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                  Advies
                </p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {data.overview.advice.map((a) => (
                    <li
                      key={a}
                      className="text-[12px] leading-relaxed text-white/70"
                    >
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preparation for the next quality workout */}
            {data.overview.preparation && (
              <div className="rounded-xl border border-white/[0.06] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
                <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                  Voorbereiding
                </p>
                <p className="mt-1.5 text-[13px] font-medium text-white/85">
                  {data.overview.preparation.title} —{" "}
                  {new Date(
                    data.overview.preparation.date + "T12:00:00",
                  ).toLocaleDateString("nl-NL", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-white/55">
                  {data.overview.preparation.whyItMatters}
                </p>
                <button
                  type="button"
                  onClick={() => setShowPrep((v) => !v)}
                  className="mt-3 rounded-full border border-white/[0.1] px-3 py-1 text-[11px] text-white/70 transition-colors hover:border-white/25"
                >
                  {showPrep ? "Verberg voorbereiding" : "Bereid je voor"}
                </button>
                {showPrep && (
                  <div className="mt-3 flex flex-col gap-3">
                    <p className="text-[12px] leading-relaxed text-white/55">
                      {data.overview.preparation.expectedResistance}
                    </p>
                    <div>
                      <p className="text-[11px] text-white/40">
                        Zinnen om te onthouden voor onderweg:
                      </p>
                      <ul className="mt-1.5 flex flex-col gap-1">
                        {data.overview.preparation.cues.map((c) => (
                          <li
                            key={c}
                            className="text-[12px] italic leading-relaxed text-white/70"
                          >
                            “{c}”
                          </li>
                        ))}
                      </ul>
                    </div>
                    <TechniqueChip
                      technique={data.overview.preparation.technique}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Debrief of the most recent workout */}
            {data.overview.debrief && (
              <div className="rounded-xl border border-white/[0.06] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
                <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">
                  Nabespreking
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <p className="text-[13px] font-medium text-white/85">
                    {data.overview.debrief.title}
                  </p>
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-white/55">
                    {OUTCOME_LABEL[data.overview.debrief.outcome]}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-white/40">
                  {data.overview.debrief.facts}
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-white/60">
                  {data.overview.debrief.reflection}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
