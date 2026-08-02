import { useState, useEffect } from "react"
import { Link, useLocation } from "wouter"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { StateCard } from "@/components/sparki/state-card"
import { PerformanceNumbers } from "@/components/sparki/performance-numbers"
import { SportPassport } from "@/components/sparki/sport-passport"
import { ProfileSettings } from "@/components/sparki/profile-settings"
import { useMotionPreference } from "@/hooks/use-motion-preference"
import { HoofdstukTabs, type HoofdstukTab } from "@/components/sparki/hoofdstuk-tabs"
import { useAthleteExtendedProfile } from "@/hooks/use-athlete-extended-profile"
import { useClearPhotoDecor } from "@/hooks/use-photo-style"
import { attachmentUrl } from "@/hooks/use-input-center"
import { useObservations, useRunConnections } from "@/hooks/use-ai-memory"
import { useFtpHistory } from "@/hooks/use-ftp-history"
import { useLoad } from "@/hooks/use-load"
import { useSessions } from "@/hooks/use-sessions"
import { useDailyMetrics } from "@/hooks/use-daily-metrics"
import { useSparkiState } from "@/hooks/use-sparki-state"
import { GraphInsightCard } from "@/components/sparki/insight/graph-insight-card"
import { GoalsWorksheet } from "@/components/sparki/goals-worksheet"
import {
  groupObservations,
  dedupeObservationsByText,
  type InsightGroup,
  type InsightSources,
} from "@/lib/insight-grouping"
import { ownsObservation } from "@/lib/insight-ownership"
import { useFixParams, useCompleteFix, useStartFix } from "@/hooks/use-missing-input"
import {
  deriveIdentity,
  categorizeObservations,
  observationLane,
  deriveEvolution,
  deriveBelastbaarheid,
  deriveBandbreedte,
  deriveOntwikkelprioriteit,
  developmentGoalInfo,
  type EvolutionTone,
  type ObservationLane,
  type Ontwikkelprioriteit,
} from "@/lib/core-profile"
import { missingTargets, type InputTargetKey } from "@/lib/missing-input"
import { labelSignal } from "@/lib/signal-labels"
import {
  Settings,
  X,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  Compass,
  Users,
  ChevronRight,
} from "lucide-react"

// ── Tab definitions ────────────────────────────────────────────────────────────

type Tab = "profiel" | "inzichten" | "kompas"

const TABS: ReadonlyArray<HoofdstukTab<Tab>> = [
  { id: "profiel",   label: "Profiel"   },
  { id: "inzichten", label: "Inzichten" },
  { id: "kompas",    label: "Kompas"    },
]

// Tokens that belong to an editor inside the Instellingen sheet. When the app
// deep-links to /you?focus=<one of these>, the sheet opens and jumps to it.
const SETTINGS_FOCUS_TOKENS = new Set([
  "ftp",
  "weeklyHours",
  "weight",
  "height",
  "birthYear",
  "sportProfile",
  "goal",
  "checkin",
  "connections",
  "abonnement",
])

// ?focus= tokens that live on the Kompas tab.
const KOMPAS_FOCUS_TOKENS = new Set(["ontwikkelkompas", "doelen", "developmentGoal"])

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 backdrop-blur-md">
      {children}
    </div>
  )
}

// The deeper explanation revealed under "Uitgebreid": the suggested action, the
// real signals behind the conclusion ("Waarop dit is gebaseerd"), any other
// same-metric observations, and alternative explanations. Returns undefined when
// there is no real depth so the toggle stays hidden.
function renderGroupExtended(group: InsightGroup): React.ReactNode | undefined {
  const { lead, members } = group
  // Same-metric members are often paraphrases of the lead's fact; collapse
  // near-duplicates (and drop any that merely re-tell the lead) before listing.
  const others = dedupeObservationsByText(
    members.filter((m) => m.id !== lead.id),
    [lead],
  ).slice(0, 3)
  const signals = lead.signals ?? []
  const alts = lead.alternativeExplanations ?? []
  if (
    !lead.recommendedAction &&
    signals.length === 0 &&
    alts.length === 0 &&
    others.length === 0
  ) {
    return undefined
  }
  return (
    <div className="space-y-3">
      {lead.recommendedAction && (
        <div className="flex items-start gap-2 rounded-xl border border-accent-cyan/15 bg-accent-cyan/[0.04] px-3 py-2.5">
          <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-cyan" strokeWidth={1.75} />
          <p className="text-[13px] leading-relaxed text-foreground/80">{lead.recommendedAction}</p>
        </div>
      )}
      {signals.length > 0 && (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Waarop dit is gebaseerd
          </p>
          {signals.map((s, i) => (
            <div key={`${s.kind}-${i}`} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted" />
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                <span className="text-foreground/80">{s.label}:</span> {s.value}
              </p>
            </div>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Ook hierover opgevallen
          </p>
          {others.map((o) => (
            <p key={o.id} className="text-pretty text-[12px] leading-relaxed text-muted-foreground">
              {o.observationText}
            </p>
          ))}
        </div>
      )}
      {alts.length > 0 && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Andere mogelijke verklaringen: {alts.join("; ")}.
        </p>
      )}
    </div>
  )
}

// One honest derived insight, chart-first: leads with the real series behind the
// maatstaf, then a short read, with the "why" behind an "Uitgebreid" toggle.
// Same-metric observations are collapsed into one card (lead + members).
function GroupInsightCard({ group }: { group: InsightGroup }) {
  const { lead } = group
  return (
    <GraphInsightCard
      title={lead.title}
      confidence={lead.confidence}
      concern={lead.severity === "important" || lead.severity === "urgent"}
      series={group.series}
      read={lead.observationText || lead.summary || ""}
      extended={renderGroupExtended(group)}
    />
  )
}

// The single highest-impact development limiter, with its concrete next action
// and an expandable "why" carrying the real factor readouts.
function PrioriteitCard({
  prioriteit,
}: {
  prioriteit: Ontwikkelprioriteit
}) {
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-accent-cyan" strokeWidth={1.75} />
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
            Je grootste hefboom
          </span>
        </div>
        <span className="shrink-0 rounded-full bg-accent-cyan/10 px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-accent-cyan ring-1 ring-ring/20">
          {prioriteit.label}
        </span>
      </div>
      <p className="mt-2.5 text-[14px] leading-relaxed text-foreground/80">{prioriteit.finding}</p>
      <div className="mt-3 flex items-start gap-2 rounded-xl border border-accent-cyan/15 bg-accent-cyan/[0.04] px-3 py-2.5">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-cyan" strokeWidth={1.75} />
        <p className="text-[13px] leading-relaxed text-foreground/80">{prioriteit.action}</p>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-accent-cyan"
        aria-expanded={open}
      >
        Waarop dit is gebaseerd
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2.5 space-y-2 border-t border-border pt-3">
          {prioriteit.signals.map((s) => (
            <div key={s.label} className="flex items-start gap-2.5">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted" />
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                <span className="text-foreground/80">{s.label}:</span> {s.value}
              </p>
            </div>
          ))}
          {prioriteit.goalRef && (
            <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
              Gewogen tegen je doel: {prioriteit.goalRef}.
            </p>
          )}
        </div>
      )}
    </Card>
  )
}

function InsightSection({
  n,
  title,
  blurb,
  groups,
  max,
}: {
  n: string
  title: string
  blurb: string
  groups: InsightGroup[]
  // When set, only the `max` strongest groups show by default; the rest fold
  // behind a "Toon meer" toggle (nothing is removed — groups are strongest-first).
  max?: number
}) {
  const [expanded, setExpanded] = useState(false)
  if (groups.length === 0) return null
  const limit = max ?? Infinity
  const collapsed = !expanded && groups.length > limit
  const shown = collapsed ? groups.slice(0, limit) : groups
  const hiddenCount = groups.length - shown.length
  return (
    <section>
      <SectionLabel n={n} title={title} />
      <p className="mt-2 text-pretty text-[12px] leading-relaxed text-muted-foreground">{blurb}</p>
      <div className="mt-3 flex flex-col gap-3">
        {shown.map((g) => (
          <GroupInsightCard key={g.key} group={g} />
        ))}
      </div>
      {(collapsed || expanded) && groups.length > limit && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:bg-muted"
        >
          {expanded ? "Toon minder" : `Toon meer (${hiddenCount})`}
        </button>
      )}
    </section>
  )
}

const TONE_ICON: Record<EvolutionTone, typeof TrendingUp> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
}

const TONE_COLOR: Record<EvolutionTone, string> = {
  up: "text-accent-cyan",
  down: "text-[color:var(--color-warning)]",
  flat: "text-muted-foreground",
}

export default function YouPage() {
  const [, navigate] = useLocation()
  const { focus } = useFixParams()
  const completeFix = useCompleteFix()
  const startFix = useStartFix()

  const { data: profile, isLoading: profileLaadt } = useAthleteExtendedProfile()
  const clearDecor = useClearPhotoDecor()
  const { data: state } = useSparkiState()
  const { data: obsData, isLoading: obsLoading } = useObservations()
  const { data: ftpHistory } = useFtpHistory()
  const { data: load } = useLoad()
  const { data: sessions } = useSessions(40)
  const { data: metrics } = useDailyMetrics(30)
  const runConnections = useRunConnections()

  // Real data sources so insight cards can lead with charts and group per metric.
  const insightSources: InsightSources = { metrics, ftpHistory, load, sessions }

  const [settingsOpen, setSettingsOpen] = useState(false)

  // ── Tab state with URL sync ────────────────────────────────────────────────
  const initieleTab = (): Tab => {
    const t = new URLSearchParams(window.location.search).get("tab")
    return TABS.some((tab) => tab.id === t) ? (t as Tab) : "profiel"
  }
  const [activeTab, setActiveTabState] = useState<Tab>(initieleTab)
  const setActiveTab = (tab: Tab) => {
    setActiveTabState(tab)
    const url = new URL(window.location.href)
    if (tab === "profiel") url.searchParams.delete("tab")
    else url.searchParams.set("tab", tab)
    window.history.replaceState(null, "", url.pathname + url.search)
  }

  // Open the settings sheet when the app deep-links to an editor that lives in it.
  useEffect(() => {
    if (focus && SETTINGS_FOCUS_TOKENS.has(focus)) setSettingsOpen(true)
  }, [focus])

  // Deep-link naar een sectie op de Kompas-tab (Ontwikkelkompas, Doelen). Schakel
  // eerst naar de juiste tab, dan scroll naar de sectie. Asynchroon geladen content
  // duikt de sectie steeds weg — blijf ~2s re-scrollen tot de layout stabiel is.
  const [goalsAutoAdd, setGoalsAutoAdd] = useState(false)
  useEffect(() => {
    if (focus !== "ontwikkelkompas" && focus !== "doelen") return undefined
    // Switch to the Kompas tab first.
    setActiveTabState("kompas")
    const url = new URL(window.location.href)
    url.searchParams.set("tab", "kompas")
    window.history.replaceState(null, "", url.pathname + url.search)

    if (focus === "doelen") setGoalsAutoAdd(true)
    let lastTop: number | null = null
    let stableTicks = 0
    const started = Date.now()
    const tick = () => {
      const el = document.getElementById(focus)
      if (el) {
        const top = el.getBoundingClientRect().top
        if (lastTop === null || Math.abs(top - lastTop) > 4) {
          el.scrollIntoView({ behavior: "auto", block: "start" })
          stableTicks = 0
        } else {
          stableTicks += 1
        }
        lastTop = el.getBoundingClientRect().top
      }
      if (stableTicks >= 3 || Date.now() - started > 2500) {
        window.clearInterval(interval)
        navigate("/you", { replace: true })
      }
    }
    const interval = window.setInterval(tick, 250)
    tick()
    return () => window.clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, navigate])

  // Deep-link for developmentGoal: switch to Kompas tab and open the fix flow.
  useEffect(() => {
    if (focus === "developmentGoal") {
      setActiveTabState("kompas")
      const url = new URL(window.location.href)
      url.searchParams.set("tab", "kompas")
      window.history.replaceState(null, "", url.pathname + url.search)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus])

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    if (!settingsOpen) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSettings()
    }
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsOpen])

  const closeSettings = () => {
    setSettingsOpen(false)
    if (focus) navigate("/you", { replace: true })
  }

  const onCompleteFix = () => {
    const navigated = completeFix()
    if (!navigated) closeSettings()
  }

  const sessionsCount = sessions?.length ?? 0
  const identity = deriveIdentity(profile, sessionsCount)
  // Cross-tab ontdubbeling: the training-pattern observations are owned by
  // Trainen "Wat over tijd opvalt"; /you Core owns the durable, non-training
  // profiel-traits. Filtering here keeps the same insight from appearing on both
  // tabs. lib/insight-ownership is the SSOT.
  const observations = (obsData?.observations ?? []).filter((o) =>
    ownsObservation("you", o),
  )
  const lenses = categorizeObservations(observations)

  // Group ALL durable observations ONCE so the same maatstaf is shown a single
  // time across the whole page. The live set is exactly what categorize kept
  // (dismissed/outdated/transient already filtered), reconstructed from its
  // buckets so there's one source of truth. groupObservations collapses
  // same-metric observations into one card (lead + supporting members) and
  // returns them strongest-first.
  const liveObservations = [
    ...lenses.strengths,
    ...lenses.development,
    ...lenses.patterns,
    ...lenses.uncertainty,
  ]
  const allGroups = groupObservations(liveObservations, insightSources)
  // The headline group = the one carrying the overall lead; shown only in §03.
  const leadGroup = lenses.lead
    ? allGroups.find((g) => g.members.some((m) => m.id === lenses.lead!.id)) ?? null
    : null
  // Route every remaining group into exactly one lens by its lead's tone, so a
  // metric never reappears in a second section (no duplicate cards).
  const laneGroups: Record<ObservationLane, InsightGroup[]> = {
    strengths: [],
    development: [],
    patterns: [],
    uncertainty: [],
  }
  for (const g of allGroups) {
    if (leadGroup && g.key === leadGroup.key) continue
    laneGroups[observationLane(g.lead)].push(g)
  }

  const evolution = deriveEvolution(ftpHistory, load, sessions)
  const belastbaarheid = deriveBelastbaarheid(load, sessions, profile)
  const bandbreedte = deriveBandbreedte(ftpHistory, load, profile)
  const prioriteit = deriveOntwikkelprioriteit(load, sessions, profile)
  const goalInfo = developmentGoalInfo(profile?.developmentGoal)

  // What Sparki still wants to collect — only genuinely missing profile inputs.
  const gapTargets = missingTargets(
    ["sportProfile", "ftp", "weight", "weeklyHours", "goal"] as InputTargetKey[],
    profile,
  )
  const needsSportData = sessionsCount === 0
  const stateMissing = state?.missing ?? []

  const decorPath = profile?.decorPhotoPath ?? null

  return (
    <ScreenShell section="You" bg="/atmosphere/training-renster-bos.webp">
      {/* SFEERBEELD — the athlete's own photo dressing up the profile. Only
          shown when one is actually chosen; otherwise the cinematic background
          stands on its own (no fake hero). */}
      {decorPath && (
        <section className="-mt-2">
          <div className="relative overflow-hidden rounded-2xl border border-border">
            <img
              src={attachmentUrl(decorPath)}
              alt="Jouw sfeerbeeld"
              className="h-44 w-full object-cover sm:h-56"
            />
            {/* Dark Sparki overlays keep text legible and on-brand. */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/55 to-transparent" />
            <div className="pointer-events-none absolute inset-0 bg-card" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.28em] text-accent-cyan">
                Jouw profiel
              </p>
              <p className="mt-1 text-lg font-light tracking-tight text-foreground">
                {profile?.displayName ?? "Jouw profiel"}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* HEADER */}
      <section className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent-cyan">
            Jouw profiel
          </p>
          <h1 className="mt-1 font-sans text-2xl font-extralight tracking-tight text-foreground">
            Wat er van je bekend is
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/journey"
            className="rounded-full border border-border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan"
          >
            Jouw verhaal
          </Link>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan"
            aria-label="Instellingen"
          >
            <Settings className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </section>

      {/* TABBALK — donkere Strava-stijl variant, deep-linkbaar via ?tab= */}
      <div className="-mx-5 px-5">
        <HoofdstukTabs
          tabs={TABS}
          actief={activeTab}
          onKies={setActiveTab}
          variant="donker"
          ariaLabel="Jij-secties"
        />
      </div>

      {/* ── TAB: PROFIEL ────────────────────────────────────────────────────── */}
      <div
        id="tab-profiel"
        role="tabpanel"
        aria-labelledby="tabknop-profiel"
        hidden={activeTab !== "profiel"}
        className="flex flex-col gap-5"
      >
        {/* WIE BEN JIJ ALS SPORTER */}
        {identity && (
          <section>
            <SectionLabel n="01" title="Wie je bent als sporter" />
            <div className="mt-3">
              <Card>
                <div className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-accent-cyan" strokeWidth={1.75} />
                  <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                    Jouw sporterstype
                  </span>
                </div>
                <p className="mt-2.5 text-[20px] font-light tracking-tight text-foreground">
                  {identity.archetypeLabel}
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {identity.levelLabel}
                  {identity.disciplineLabel ? ` · ${identity.disciplineLabel}` : ""}
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                  {identity.descriptor}
                </p>

                {identity.facts.length > 0 && (
                  <div className="mt-4 flex items-stretch border-t border-border pt-4">
                    {identity.facts.map((f, i) => (
                      <div
                        key={f.label}
                        className={`flex-1 text-center ${i > 0 ? "border-l border-border" : ""}`}
                      >
                        <p
                          className="font-sans text-lg font-light tabular-nums"
                          style={{ color: f.accent ? ACCENT : "var(--color-foreground)" }}
                        >
                          {f.value}
                        </p>
                        <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                          {f.label}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Gebaseerd op {identity.confidenceLabel} van je.
                  {identity.sharpenWith.length > 0 && (
                    <>
                      {" "}
                      Scherper wordt het zodra{" "}
                      {identity.sharpenWith.length === 1
                        ? `${identity.sharpenWith[0]} bekend is`
                        : `${identity.sharpenWith.slice(0, -1).join(", ")} en ${
                            identity.sharpenWith[identity.sharpenWith.length - 1]
                          } bekend zijn`}
                      .
                    </>
                  )}
                </div>
              </Card>
            </div>
          </section>
        )}

        {/* SAMEN TRAINEN — social/team surface has no nav tab; it lives here on
            the profile (and as a header button) so it stays easy to reach. */}
        <button
          type="button"
          onClick={() => navigate("/samen")}
          className="flex w-full items-center gap-3.5 rounded-2xl border border-border bg-card p-4 text-left backdrop-blur-md transition-colors hover:border-accent-cyan/30"
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border"
            style={{ background: "rgba(120,210,230,0.08)" }}
          >
            <Users className="h-4 w-4" style={{ color: ACCENT }} strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-foreground/90">Samen trainen</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
              Je overzicht met vrienden, ploeg en gedeelde momenten.
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        </button>

        {/* JOUW GETALLEN */}
        <section>
          <SectionLabel n="02" title="Jouw getallen" />
          <p className="mt-2 text-pretty text-[12px] leading-relaxed text-muted-foreground">
            De harde cijfers uit je eigen metingen — geen schattingen
          </p>
          <div className="mt-3">
            <PerformanceNumbers
              profile={profile}
              ftpHistory={ftpHistory}
              load={load}
              bandbreedte={bandbreedte}
              laadt={profileLaadt}
            />
          </div>
        </section>

        {/* SPORTPASPOORT */}
        <section id="sportpaspoort" className="scroll-mt-24">
          <SectionLabel n="02b" title="Sportpaspoort" />
          <p className="mt-2 text-pretty text-[12px] leading-relaxed text-muted-foreground">
            Waar iedere waarde vandaan komt — en jij houdt de regie
          </p>
          <div className="mt-3">
            <SportPassport />
          </div>
        </section>

        {/* CORE STATUS */}
        <section>
          <SectionLabel n="03" title="Je status vandaag" />
          <p className="mt-2 text-pretty text-[12px] leading-relaxed text-muted-foreground">
            Hoe je er vandaag voorstaat — en hoe je je voelt
          </p>
          <div className="mt-4">
            <StateCard />
          </div>
        </section>
      </div>

      {/* ── TAB: INZICHTEN ──────────────────────────────────────────────────── */}
      <div
        id="tab-inzichten"
        role="tabpanel"
        aria-labelledby="tabknop-inzichten"
        hidden={activeTab !== "inzichten"}
        className="flex flex-col gap-5"
      >
        {/* WAT HEEFT SPARKI GELEERD */}
        <section>
          <div className="flex items-center justify-between">
            <SectionLabel n="04" title="Wat tot nu toe opvalt" />
            {observations.length > 0 && (
              <button
                type="button"
                onClick={() => runConnections.mutate()}
                disabled={runConnections.isPending}
                className="flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-accent-cyan disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${runConnections.isPending ? "animate-spin" : ""}`}
                  strokeWidth={1.75}
                />
                Opnieuw kijken
              </button>
            )}
          </div>
          <div className="mt-3">
            {obsLoading ? (
              <div className="h-24 animate-pulse rounded-2xl bg-muted" />
            ) : leadGroup ? (
              <>
                <p className="mb-3 text-[12px] leading-relaxed text-muted-foreground">
                  Uit je data {lenses.total === 1 ? "is" : "zijn"} {lenses.total}{" "}
                  {lenses.total === 1 ? "ding" : "dingen"} over je afgeleid. Dit valt het meest op:
                </p>
                <GroupInsightCard group={leadGroup} />
              </>
            ) : (
              <Card>
                <p className="text-[14px] leading-relaxed text-muted-foreground">
                  Er is nog niets over je afgeleid.
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                  Zodra je ritten en check-ins binnenkomen, ontstaan hier de eerste inzichten —
                  eigenschappen, patronen en ontwikkelpunten. Hieronder zie je wat daarvoor
                  nog nodig is.
                </p>
              </Card>
            )}
          </div>
        </section>

        {/* STERKE EIGENSCHAPPEN */}
        <InsightSection
          n="05"
          title="Sterke eigenschappen"
          blurb="Wat bij jou werkt"
          groups={laneGroups.strengths}
        />

        {/* ONTWIKKELPUNTEN */}
        <InsightSection
          n="06"
          title="Ontwikkelpunten"
          blurb="Waar de meeste winst voor je ligt"
          groups={laneGroups.development}
        />

        {/* PATRONEN */}
        <InsightSection
          n="07"
          title="Terugkerende patronen"
          blurb="Verbanden die over tijd terugkomen in je data"
          groups={laneGroups.patterns}
          max={3}
        />

        {/* WAAR SPARKI ONZEKER OVER IS */}
        {(laneGroups.uncertainty.length > 0 || stateMissing.length > 0) && (
          <section>
            <SectionLabel n="08" title="Waar nog onzekerheid zit" />
            <p className="mt-2 text-pretty text-[12px] leading-relaxed text-muted-foreground">
              Eerlijk gezegd: dit is nog niet zeker
            </p>
            <div className="mt-3 flex flex-col gap-3">
              {laneGroups.uncertainty.map((g) => (
                <GroupInsightCard key={g.key} group={g} />
              ))}
              {stateMissing.length > 0 && (
                <Card>
                  <div className="flex items-start gap-2.5">
                    <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    <div>
                      <p className="text-[14px] font-medium text-foreground/85">
                        Nog niet alles is in beeld
                      </p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                        Voor je huidige beeld ontbreekt nog: {stateMissing.map((k) => labelSignal(k)).join(", ")}. Daardoor is
                        de inschatting voorzichtiger dan ze kan zijn.
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </section>
        )}

        {/* WELKE INFORMATIE WIL SPARKI VERZAMELEN */}
        <section>
          <SectionLabel n="09" title="Welke informatie nog ontbreekt" />
          <p className="mt-2 text-pretty text-[12px] leading-relaxed text-muted-foreground">
            Vul aan wat ontbreekt — elk stukje maakt het beeld scherper
          </p>
          <div className="mt-3">
            {gapTargets.length === 0 && !needsSportData ? (
              <Card>
                <p className="text-[14px] leading-relaxed text-muted-foreground">
                  Alle basisgegevens zijn er.
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  Je profiel is compleet. Hoe meer je traint en incheckt, hoe scherper je beeld
                  wordt.
                </p>
              </Card>
            ) : (
              <div className="flex flex-col gap-2.5">
                {gapTargets.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => startFix(t.key)}
                    className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left backdrop-blur-md transition-colors hover:border-accent-cyan/30"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-cyan/10 ring-1 ring-ring/25">
                      <ArrowRight className="h-3.5 w-3.5 text-accent-cyan" strokeWidth={2} />
                    </span>
                    <div className="flex-1">
                      <p className="text-[14px] font-medium text-foreground/90">{t.missingTitle}</p>
                      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{t.missingWhy}</p>
                      <span className="mt-2 inline-block font-mono text-[10px] uppercase tracking-[0.14em] text-accent-cyan transition-colors group-hover:text-accent-cyan">
                        {t.label} →
                      </span>
                    </div>
                  </button>
                ))}
                {needsSportData && (
                  <button
                    type="button"
                    onClick={() => startFix("sportData")}
                    className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left backdrop-blur-md transition-colors hover:border-accent-cyan/30"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-cyan/10 ring-1 ring-ring/25">
                      <ArrowRight className="h-3.5 w-3.5 text-accent-cyan" strokeWidth={2} />
                    </span>
                    <div className="flex-1">
                      <p className="text-[14px] font-medium text-foreground/90">
                        Nog geen sportdata gekoppeld
                      </p>
                      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                        Koppel je sporthorloge of -account zodat je ritten binnenkomen en
                        geanalyseerd worden. Zonder ritten blijven veel inzichten leeg.
                      </p>
                      <span className="mt-2 inline-block font-mono text-[10px] uppercase tracking-[0.14em] text-accent-cyan transition-colors group-hover:text-accent-cyan">
                        Sportdata koppelen →
                      </span>
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── TAB: KOMPAS ─────────────────────────────────────────────────────── */}
      <div
        id="tab-kompas"
        role="tabpanel"
        aria-labelledby="tabknop-kompas"
        hidden={activeTab !== "kompas"}
        className="flex flex-col gap-5"
      >
        {/* ONTWIKKELKOMPAS */}
        <section id="ontwikkelkompas" className="scroll-mt-24">
          <SectionLabel n="10" title="Je ontwikkelkompas" />
          <p className="mt-2 text-pretty text-[12px] leading-relaxed text-muted-foreground">
            Waar je naartoe groeit, hoeveel training je lichaam aankan, en hoe je je
            basis ontwikkelt
          </p>
          <div className="mt-3 flex flex-col gap-2.5">
            {goalInfo ? (
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                      Langetermijndoel
                    </span>
                    <p className="mt-2 text-[18px] font-light tracking-tight text-foreground">
                      {goalInfo.label}
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                      {goalInfo.blurb}
                    </p>
                    {goalInfo.key === "persoonlijk" && profile?.goals && (
                      <p className="mt-2 text-pretty text-[13px] italic leading-relaxed text-muted-foreground">
                        {profile.goals}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => startFix("developmentGoal")}
                    className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-accent-cyan transition-colors hover:text-accent-cyan"
                  >
                    Aanpassen
                  </button>
                </div>
              </Card>
            ) : (
              <button
                type="button"
                onClick={() => startFix("developmentGoal")}
                className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-4 text-left backdrop-blur-md transition-colors hover:border-accent-cyan/30"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-cyan/10 ring-1 ring-ring/25">
                  <Compass className="h-3.5 w-3.5 text-accent-cyan" strokeWidth={2} />
                </span>
                <div className="flex-1">
                  <p className="text-[14px] font-medium text-foreground/90">
                    Kies je langetermijndoel
                  </p>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                    Bepaal waar je naartoe wilt — recreatief, een toertocht, wedstrijden of
                    hoger. Elk advies wordt afgewogen tegen dat doel.
                  </p>
                  <span className="mt-2 inline-block font-mono text-[10px] uppercase tracking-[0.14em] text-accent-cyan transition-colors group-hover:text-accent-cyan">
                    Doel kiezen →
                  </span>
                </div>
              </button>
            )}

            {/* Ontwikkelprioriteit */}
            {prioriteit.hasData &&
              (prioriteit.balanced ? (
                <Card>
                  <div className="flex items-center gap-2">
                    <Compass className="h-4 w-4 text-accent-cyan" strokeWidth={1.75} />
                    <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                      Je grootste hefboom
                    </span>
                  </div>
                  <p className="mt-2.5 text-[15px] font-light tracking-tight text-foreground">
                    {prioriteit.label}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                    {prioriteit.finding}
                  </p>
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-accent-cyan/15 bg-accent-cyan/[0.04] px-3 py-2.5">
                    <Sparkles
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-cyan"
                      strokeWidth={1.75}
                    />
                    <p className="text-[13px] leading-relaxed text-foreground/80">{prioriteit.action}</p>
                  </div>
                </Card>
              ) : (
                <PrioriteitCard prioriteit={prioriteit} />
              ))}

            {belastbaarheid.hasData ? (
              <Card>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                    Belastbaarheid
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                    {belastbaarheid.confidenceLabel}
                  </span>
                </div>
                <div className="mt-2.5 flex items-baseline gap-2">
                  <span
                    className={`text-[34px] font-light leading-none tabular-nums ${
                      belastbaarheid.band === "beperkt" ? "text-[color:var(--color-warning)]" : "text-accent-cyan"
                    }`}
                  >
                    {belastbaarheid.score}
                  </span>
                  <span className="text-[13px] text-muted-foreground">/ 100</span>
                </div>
                <p className="mt-2.5 text-[15px] font-light tracking-tight text-foreground">
                  {belastbaarheid.headline}
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  {belastbaarheid.meaning}
                </p>
                <div className="mt-4 flex items-stretch border-t border-border pt-4">
                  {belastbaarheid.factors.map((f, i) => (
                    <div
                      key={f.label}
                      className={`flex-1 text-center ${i > 0 ? "border-l border-border" : ""}`}
                    >
                      <p className="font-sans text-[14px] font-light text-foreground/85">{f.value}</p>
                      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                        {f.label}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
                  {belastbaarheid.windowLabel}. Dit beeld wordt scherper naarmate er meer
                  maanden aan data zijn.
                </p>
              </Card>
            ) : (
              <Card>
                <div className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                  <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                    Belastbaarheid
                  </span>
                </div>
                <p className="mt-2.5 text-[14px] leading-relaxed text-muted-foreground">
                  Nog niet betrouwbaar in te schatten.
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  {belastbaarheid.reason}
                </p>
                {needsSportData && (
                  <button
                    type="button"
                    onClick={() => startFix("sportData")}
                    className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold text-[color:var(--color-on-accent)] transition hover:brightness-110"
                    style={{ background: ACCENT }}
                  >
                    Sportdata koppelen
                    <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
                  </button>
                )}
              </Card>
            )}

            {/* Potentieel-bandbreedte */}
            {bandbreedte.hasData ? (
              <Card>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                    Groeiruimte
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                    {bandbreedte.confidenceLabel}
                  </span>
                </div>
                <p className="mt-2.5 text-[15px] font-light tracking-tight text-foreground">
                  {bandbreedte.headline}
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  {bandbreedte.meaning}
                </p>

                <div className="mt-4 flex items-stretch border-t border-border pt-4">
                  <div className="flex-1 text-center">
                    <p className="text-[15px] font-light tabular-nums text-muted-foreground">
                      {bandbreedte.low} {bandbreedte.unit}
                    </p>
                    <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                      Behoudend
                    </p>
                  </div>
                  <div className="flex-1 border-l border-r border-border text-center">
                    <p className="text-[22px] font-light leading-none tabular-nums text-accent-cyan">
                      {bandbreedte.expected} {bandbreedte.unit}
                    </p>
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                      Verwacht
                    </p>
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-[15px] font-light tabular-nums text-muted-foreground">
                      {bandbreedte.high} {bandbreedte.unit}
                    </p>
                    <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                      Optimistisch
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-stretch border-t border-border pt-4">
                  {bandbreedte.factors.map((f, i) => (
                    <div
                      key={f.label}
                      className={`flex-1 text-center ${i > 0 ? "border-l border-border" : ""}`}
                    >
                      <p className="font-sans text-[13px] font-light text-foreground/85">{f.value}</p>
                      <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                        {f.label}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Schatting voor {bandbreedte.horizonLabel} (huidige FTP {bandbreedte.current}{" "}
                  {bandbreedte.unit}). Een realistische bandbreedte, geen belofte — je
                  werkelijke groei hangt af van je training en herstel.
                </p>
              </Card>
            ) : (
              <Card>
                <div className="flex items-center gap-2">
                  <Compass className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                  <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                    Groeiruimte
                  </span>
                </div>
                <p className="mt-2.5 text-[14px] leading-relaxed text-muted-foreground">
                  Nog niet betrouwbaar in te schatten.
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  {bandbreedte.reason}
                </p>
                <button
                  type="button"
                  onClick={() => startFix("ftp")}
                  className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold text-[color:var(--color-on-accent)] transition hover:brightness-110"
                  style={{ background: ACCENT }}
                >
                  FTP invullen
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
                </button>
              </Card>
            )}

            {/* Benutting & ontwikkeling */}
            <div className="mt-1.5 flex items-center gap-2">
              <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                Benutting & ontwikkeling
              </span>
              <span className="text-[11px] text-muted-foreground">— je verandering over tijd</span>
            </div>
            {evolution.hasAny ? (
              evolution.items.map((item) => {
                const Icon = TONE_ICON[item.tone]
                return (
                  <Card key={item.key}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        {item.label}
                      </span>
                      <span
                        className={`flex items-center gap-1.5 text-[13px] font-medium ${TONE_COLOR[item.tone]}`}
                      >
                        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                        {item.change}
                      </span>
                    </div>
                    <p className="mt-2 text-[22px] font-light tabular-nums text-foreground">
                      {item.current}
                    </p>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">{item.detail}</p>
                  </Card>
                )
              })
            ) : (
              <Card>
                <p className="text-[14px] leading-relaxed text-muted-foreground">
                  Nog te weinig verloop om te tonen.
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
                  Zodra je meerdere FTP-metingen of ritten hebt, zie je hier hoe je conditie,
                  vermogen en ritme zich ontwikkelen.
                </p>
              </Card>
            )}
          </div>
        </section>

        {/* DOELEN */}
        <section id="doelen" className="scroll-mt-24">
          <SectionLabel n="11" title="Je doelen" />
          <p className="mt-2 text-pretty text-[12px] leading-relaxed text-muted-foreground">
            Waar je naartoe werkt — dit seizoen en verder — en hoe je ervoor staat
          </p>
          <GoalsWorksheet autoAdd={goalsAutoAdd} />
        </section>

        {/* SFEERBEELD */}
        <section>
          <SectionLabel n="12" title="Sfeerbeeld" />
          <div className="mt-3">
            <Card>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent-cyan" strokeWidth={1.75} />
                <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                  Jouw foto op je profiel
                </span>
              </div>
              <p className="mt-2.5 text-[13px] leading-relaxed text-muted-foreground">
                {decorPath
                  ? "Je sfeerbeeld staat bovenaan je profiel. Je kunt een andere foto kiezen of hem weghalen."
                  : "Upload een foto en geef hem de rustige, donkere Sparki-look. Kies je hem als sfeerbeeld, dan komt hij bovenaan je profiel te staan."}
              </p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => navigate("/photo-lab")}
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-semibold text-[color:var(--color-on-accent)] transition hover:brightness-110"
                  style={{ background: ACCENT }}
                >
                  {decorPath ? "Andere foto kiezen" : "Foto kiezen"}
                  <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
                </button>
                {decorPath && (
                  <button
                    type="button"
                    disabled={clearDecor.isPending}
                    onClick={() => clearDecor.mutate()}
                    className="inline-flex items-center rounded-full border border-border px-4 py-2.5 text-[13px] font-medium text-foreground/75 transition hover:bg-muted disabled:opacity-60"
                  >
                    {clearDecor.isPending ? "Bezig…" : "Sfeerbeeld weghalen"}
                  </button>
                )}
              </div>
              {clearDecor.isError && (
                <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[13px] text-[color:var(--color-warning)]">
                  Weghalen lukte nu niet. Probeer het zo nog eens.
                </p>
              )}
            </Card>
          </div>
        </section>
      </div>

      {/* INSTELLINGEN — drill-in sheet */}
      {settingsOpen && (
        <div
          className="fixed inset-0 z-[9998] flex flex-col overflow-y-auto"
          style={{
            background:
              "radial-gradient(120% 80% at 50% 0%, #0a1622 0%, #05070e 60%, #03040a 100%)",
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Instellingen"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4 backdrop-blur-md">
            <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-accent-cyan">
              Instellingen
            </span>
            <button
              type="button"
              onClick={closeSettings}
              className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
              Sluiten
            </button>
          </div>
          <div className="mx-auto w-full max-w-xl flex-1 px-5 py-8">
            <button
              type="button"
              onClick={() => navigate("/geluid")}
              className="mb-6 flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 text-left backdrop-blur-md transition-colors hover:bg-muted"
            >
              <span>
                <span className="block text-sm font-medium text-foreground">
                  Geluid &amp; wekker
                </span>
                <span className="block text-xs text-muted-foreground">
                  App-geluiden, volume en de wekker instellen.
                </span>
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent-cyan">
                Open
              </span>
            </button>
            <VerminderBewegingInstelling />
            <ProfileSettings focus={focus} onCompleteFix={onCompleteFix} />
          </div>
        </div>
      )}
    </ScreenShell>
  )
}

// MEDIA_UITLEG_01 F1 / GF8-02 — instelling "Verminder beweging" (vindbare plek
// in de instellingen, server-side bewaard). De instelling staat ALTIJD in de
// instellingen (uit de flag-gate gehaald): alles blijft volledig bruikbaar met
// beweging uit. Werkt onafhankelijk van de systeeminstelling: staat één van
// beide aan, dan is beweging uit.
function VerminderBewegingInstelling() {
  const { sparkiReduced, sparkiReducedLoaded, setSparkiReduced, saving, systemReduced } =
    useMotionPreference()
  return (
    <div className="mb-6 flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 backdrop-blur-md">
      <span>
        <span className="block text-sm font-medium text-foreground">
          Verminder beweging
        </span>
        <span className="block text-xs text-muted-foreground">
          {systemReduced
            ? "Je systeem staat al op verminderde beweging; deze instelling geldt daarnaast op al je apparaten."
            : "Zet animaties uit; alles blijft gewoon werken. Geldt op al je apparaten."}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={sparkiReduced}
        aria-label="Verminder beweging"
        disabled={saving || !sparkiReducedLoaded}
        onClick={() => setSparkiReduced(!sparkiReduced)}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
          sparkiReduced
            ? "border-accent-cyan/40 bg-accent-cyan/30"
            : "border-border bg-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4.5 w-4.5 rounded-full bg-card transition-transform ${
            sparkiReduced ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
          style={{ height: 18, width: 18 }}
        />
      </button>
    </div>
  )
}
