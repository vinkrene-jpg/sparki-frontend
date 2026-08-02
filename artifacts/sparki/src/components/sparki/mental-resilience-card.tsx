// Mentale Weerbaarheid — Lab-sectie. Toont de deterministische uitvoerings-
// score, weekontwikkeling, echte patronen met techniek uit de Mentale
// Bibliotheek, risicofactoren, advies, voorbereiding op de eerstvolgende zware
// training en een eerlijke nabespreking. Geen medische duiding; eerlijke lege
// staat als er te weinig gepland is.

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useLocation } from "wouter"
import { apiFetch } from "@/lib/api"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { MissingInputNotice } from "@/components/sparki/missing-input-notice"
import { Loader2 } from "lucide-react"

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

type AthleteReflection = {
  motivationBefore: number | null
  mentalEffort: number | null
  note: string | null
}

type Debrief = {
  workoutId: number
  date: string
  title: string
  outcome: "volbracht" | "ingekort" | "gemist"
  facts: string
  reflection: string
  athleteReflection: AthleteReflection | null
  reflectionPrompt: string | null
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

type CardDeepening = {
  why: string
  pitfall: string
  weekPractice: string
}

type TrainingCard = {
  key: string
  name: string
  depth: 1 | 2 | 3
  core: string
  how: string | null
  deepening: CardDeepening | null
  intelDedupeKey: string | null
}

function useMentalCards() {
  return useQuery({
    queryKey: ["mental-cards"],
    queryFn: () => apiFetch<{ cards: TrainingCard[] }>("/api/mental/cards"),
    staleTime: 5 * 60 * 1000,
  })
}

function useSetCardDepth() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ cardKey, depth }: { cardKey: string; depth: number }) =>
      apiFetch<{ cards: TrainingCard[] }>(
        `/api/mental/cards/${cardKey}/depth`,
        { method: "PUT", body: JSON.stringify({ depth }) },
      ),
    onSuccess: (data) => {
      qc.setQueryData(["mental-cards"], data)
    },
  })
}

const DEPTH_LABEL: Record<1 | 2 | 3, string> = {
  1: "Alleen de kern",
  2: "Kern + hoe je het doet",
  3: "Volledige verdieping",
}

// Star picker for the depth of one card. Saved server-side per card, so the
// choice travels with the account.
function DepthStars({
  card,
  onSelect,
  pending,
}: {
  card: TrainingCard
  onSelect: (depth: number) => void
  pending: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex" role="group" aria-label={`Diepgang voor ${card.name}`}>
        {([1, 2, 3] as const).map((d) => {
          const filled = card.depth >= d
          return (
            <button
              key={d}
              type="button"
              disabled={pending}
              onClick={() => onSelect(d)}
              title={DEPTH_LABEL[d]}
              aria-label={`${d} ${d === 1 ? "ster" : "sterren"}: ${DEPTH_LABEL[d]}`}
              className="px-0.5 text-[16px] leading-none transition-colors disabled:opacity-50"
              style={{ color: filled ? ACCENT : "var(--color-muted-foreground)" }}
            >
              {filled ? "★" : "☆"}
            </button>
          )
        })}
      </div>
      {pending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
    </div>
  )
}

function MentalTrainingCardBlock({ card }: { card: TrainingCard }) {
  const setDepth = useSetCardDepth()
  const [, navigate] = useLocation()
  return (
    <div className="rounded-xl border border-border bg-card p-3 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-foreground/85">{card.name}</p>
        <DepthStars
          card={card}
          pending={setDepth.isPending}
          onSelect={(depth) => setDepth.mutate({ cardKey: card.key, depth })}
        />
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-foreground/70">
        {card.core}
      </p>
      {card.how && (
        <div className="mt-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Zo doe je het
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-foreground/60">
            {card.how}
          </p>
        </div>
      )}
      {card.deepening && (
        <div className="mt-2 flex flex-col gap-2">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Waarom dit werkt
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-foreground/60">
              {card.deepening.why}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              De valkuil
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-foreground/60">
              {card.deepening.pitfall}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Oefening voor deze week
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-foreground/60">
              {card.deepening.weekPractice}
            </p>
          </div>
        </div>
      )}
      {setDepth.isError && (
        <p className="mt-2 text-[11px] text-[color:var(--color-negative)]">
          Diepgang opslaan lukte niet. Probeer het zo opnieuw.
        </p>
      )}
      {card.intelDedupeKey && card.depth >= 2 && (
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
  )
}

// The six mental training cards with per-card adjustable depth (stars).
function MentalTrainingLibrary() {
  const { data, isLoading, isError } = useMentalCards()
  if (isLoading) return <Skeleton className="h-40 w-full rounded-xl" />
  if (isError || !data) {
    return (
      <p className="text-[12px] text-muted-foreground">
        De trainingskaarten konden nu niet worden geladen. Probeer het later
        opnieuw.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Mentale training
      </p>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Zes technieken om je hoofd te trainen. Stel per kaart met de sterren in
        hoeveel diepgang je wilt: ★ alleen de kern, ★★ ook hoe je het doet, ★★★
        de volledige verdieping. Je keuze wordt per kaart bewaard.
      </p>
      {data.cards.map((c) => (
        <MentalTrainingCardBlock key={c.key} card={c} />
      ))}
    </div>
  )
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
  return <div className={`animate-pulse rounded bg-muted ${className}`} />
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
          <div className="flex h-14 w-6 items-end rounded bg-muted">
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
                <span className="text-[9px] text-muted-foreground">?</span>
              </div>
            )}
          </div>
          <span className="font-mono text-[9px] text-muted-foreground">
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
        className="rounded-full border border-border px-3 py-1 text-[11px] text-foreground/70 transition-colors hover:border-border"
      >
        Techniek: {technique.name} {open ? "−" : "+"}
      </button>
      {open && (
        <div className="mt-2 rounded-xl bg-muted p-3">
          <p className="text-[12px] text-foreground/70">{technique.how}</p>
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

const MOTIVATION_LABELS = [
  "Heel weinig zin",
  "Weinig zin",
  "Neutraal",
  "Gemotiveerd",
  "Heel gemotiveerd",
]
const EFFORT_LABELS = [
  "Mentaal makkelijk",
  "Redelijk licht",
  "Gemiddeld",
  "Mentaal zwaar",
  "Mentaal loodzwaar",
]

function ScalePicker({
  label,
  value,
  onChange,
  endpoints,
}: {
  label: string
  value: number | null
  onChange: (v: number) => void
  endpoints: [string, string]
}) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="mt-1.5 flex gap-1.5">
        {[1, 2, 3, 4, 5].map((v) => {
          const active = value === v
          return (
            <button
              key={v}
              type="button"
              onClick={() => onChange(v)}
              className="h-8 flex-1 rounded-lg border font-mono text-[12px] tabular-nums transition-colors"
              style={{
                borderColor: active
                  ? "rgba(120,210,230,0.5)"
                  : "var(--color-border)",
                background: active ? "rgba(120,210,230,0.12)" : "transparent",
                color: active ? ACCENT : "var(--color-muted-foreground)",
              }}
            >
              {v}
            </button>
          )
        })}
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-muted-foreground">
        <span>{endpoints[0]}</span>
        <span>{endpoints[1]}</span>
      </div>
    </div>
  )
}

function useSaveReflection(workoutId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      motivationBefore: number | null
      mentalEffort: number | null
      note: string | null
    }) =>
      apiFetch(`/api/mental/reflection/${workoutId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mental-overview"] })
    },
  })
}

// The athlete's own mental reflection for the debriefed workout. When they
// already reflected, it is shown back (confirm-first); otherwise one targeted
// invite — never a blank form. Fully optional; any single signal is enough.
function MentalReflectionBlock({ debrief }: { debrief: Debrief }) {
  const existing = debrief.athleteReflection
  const skipped = debrief.outcome === "gemist"
  const save = useSaveReflection(debrief.workoutId)
  const [editing, setEditing] = useState(false)
  const [motivation, setMotivation] = useState<number | null>(
    existing?.motivationBefore ?? null,
  )
  const [effort, setEffort] = useState<number | null>(
    existing?.mentalEffort ?? null,
  )
  const [note, setNote] = useState(existing?.note ?? "")

  const canSave =
    motivation != null || effort != null || note.trim().length > 0

  const handleSave = () => {
    save.mutate(
      {
        motivationBefore: motivation,
        mentalEffort: effort,
        note: note.trim() ? note.trim() : null,
      },
      { onSuccess: () => setEditing(false) },
    )
  }

  // Read-only summary of an existing reflection.
  if (existing && !editing) {
    return (
      <div className="mt-3 rounded-lg border border-border bg-muted p-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Jouw mentale reflectie
        </p>
        <div className="mt-1.5 flex flex-col gap-1">
          {existing.motivationBefore != null && (
            <p className="text-[12px] text-foreground/65">
              Motivatie vooraf:{" "}
              <span className="text-foreground/85">
                {MOTIVATION_LABELS[existing.motivationBefore - 1]}
              </span>
            </p>
          )}
          {existing.mentalEffort != null && (
            <p className="text-[12px] text-foreground/65">
              Mentaal zwaar:{" "}
              <span className="text-foreground/85">
                {EFFORT_LABELS[existing.mentalEffort - 1]}
              </span>
            </p>
          )}
          {existing.note && (
            <p className="text-[12px] italic leading-relaxed text-foreground/70">
              “{existing.note}”
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-2 text-[11px] underline decoration-white/25 underline-offset-2"
          style={{ color: ACCENT }}
        >
          Aanpassen
        </button>
      </div>
    )
  }

  // Invite / edit form.
  return (
    <div className="mt-3 rounded-lg border border-border bg-muted p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Jouw mentale reflectie
      </p>
      {debrief.reflectionPrompt && !existing && (
        <p className="mt-1.5 text-[12px] leading-relaxed text-foreground/55">
          {debrief.reflectionPrompt}
        </p>
      )}
      <div className="mt-3 flex flex-col gap-3">
        <ScalePicker
          label="Hoe was je motivatie vooraf?"
          value={motivation}
          onChange={setMotivation}
          endpoints={["Geen zin", "Vol goede zin"]}
        />
        {!skipped && (
          <ScalePicker
            label="Hoe zwaar was het mentaal?"
            value={effort}
            onChange={setEffort}
            endpoints={["Makkelijk", "Loodzwaar"]}
          />
        )}
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder={
            skipped
              ? "Wat gaf de doorslag om niet te rijden? (optioneel)…"
              : "Wat ging er in je hoofd om? (optioneel)…"
          }
          className="w-full resize-none rounded-lg border border-border bg-muted px-3 py-2 text-[13px] text-foreground/90 placeholder:text-muted-foreground focus:border-accent-cyan/40 focus:outline-none"
        />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || save.isPending}
          className="flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-40"
          style={{
            borderColor: "rgba(120,210,230,0.4)",
            background: "rgba(120,210,230,0.1)",
            color: ACCENT,
          }}
        >
          {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Bewaren
        </button>
        {existing && (
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="text-[12px] text-muted-foreground transition-colors hover:text-foreground/70"
          >
            Annuleren
          </button>
        )}
      </div>
      {save.isError && (
        <p className="mt-2 text-[11px] text-[color:var(--color-negative)]">
          Opslaan lukte niet. Probeer het zo opnieuw.
        </p>
      )}
    </div>
  )
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
          <p className="text-[12px] text-muted-foreground">
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
                  <span className="text-[11px] text-muted-foreground">/ 100</span>
                </div>
                <p className="mt-1 max-w-[30ch] text-[11px] leading-relaxed text-muted-foreground">
                  Uitvoering van je geplande trainingen, laatste{" "}
                  {data.overview.windowDays} dagen:{" "}
                  {data.overview.completedCount} van {data.overview.plannedCount}{" "}
                  gereden.
                </p>
              </div>
              <WeekBars weeks={data.overview.weeks} />
            </div>

            {data.overview.confidenceReason && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {data.overview.confidenceReason}
              </p>
            )}

            {/* Patterns */}
            {data.overview.patterns.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Terugkerende patronen
                </p>
                {data.overview.patterns.map((p) => (
                  <div
                    key={p.key}
                    className="rounded-xl border border-border bg-card p-3 backdrop-blur-md"
                  >
                    <p className="text-[13px] font-medium text-foreground/85">
                      {p.label}
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-foreground/55">
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
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Waar dit toe kan leiden
                </p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {data.overview.riskFactors.map((r) => (
                    <li key={r} className="text-[12px] leading-relaxed text-foreground/55">
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Advice */}
            {data.overview.advice.length > 0 && (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Advies
                </p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {data.overview.advice.map((a) => (
                    <li
                      key={a}
                      className="text-[12px] leading-relaxed text-foreground/70"
                    >
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preparation for the next quality workout */}
            {data.overview.preparation && (
              <div className="rounded-xl border border-border bg-card p-4 backdrop-blur-md">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Voorbereiding
                </p>
                <p className="mt-1.5 text-[13px] font-medium text-foreground/85">
                  {data.overview.preparation.title} —{" "}
                  {new Date(
                    data.overview.preparation.date + "T12:00:00",
                  ).toLocaleDateString("nl-NL", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-foreground/55">
                  {data.overview.preparation.whyItMatters}
                </p>
                <button
                  type="button"
                  onClick={() => setShowPrep((v) => !v)}
                  className="mt-3 rounded-full border border-border px-3 py-1 text-[11px] text-foreground/70 transition-colors hover:border-border"
                >
                  {showPrep ? "Verberg voorbereiding" : "Bereid je voor"}
                </button>
                {showPrep && (
                  <div className="mt-3 flex flex-col gap-3">
                    <p className="text-[12px] leading-relaxed text-foreground/55">
                      {data.overview.preparation.expectedResistance}
                    </p>
                    <div>
                      <p className="text-[11px] text-muted-foreground">
                        Zinnen om te onthouden voor onderweg:
                      </p>
                      <ul className="mt-1.5 flex flex-col gap-1">
                        {data.overview.preparation.cues.map((c) => (
                          <li
                            key={c}
                            className="text-[12px] italic leading-relaxed text-foreground/70"
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
              <div className="rounded-xl border border-border bg-card p-4 backdrop-blur-md">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Nabespreking
                </p>
                <div className="mt-1.5 flex items-center gap-2">
                  <p className="text-[13px] font-medium text-foreground/85">
                    {data.overview.debrief.title}
                  </p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-foreground/55">
                    {OUTCOME_LABEL[data.overview.debrief.outcome]}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  {data.overview.debrief.facts}
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-foreground/60">
                  {data.overview.debrief.reflection}
                </p>
                <MentalReflectionBlock debrief={data.overview.debrief} />
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mt-6">
        <MentalTrainingLibrary />
      </div>
    </section>
  )
}
