// Test Management Dashboard 2.0 — admin view of how testers actually use Sparki.
// Every number comes from GET /api/admin/test-dashboard, which derives everything
// from real telemetry + existing data. Absent values render honestly as "—" or
// "nog niet gemeten", never a fabricated figure. Cinematic Sparki design language.

import { useState } from "react"
import { useLocation } from "wouter"
import { ChevronDown } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import {
  RELIABILITY_LABEL,
  PHASE_LABEL,
  formatDuration,
  formatLastActivity,
  type DashboardTester,
  type DashboardSummary,
  type DashboardSignal,
  type ScreenCoverage,
  type CoverageStatus,
  type TestPhase,
  type ReliabilityLevel,
} from "@/lib/tester-types"

const COVERAGE_STYLE: Record<CoverageStatus, { color: string; bg: string }> = {
  never: { color: "rgba(255,255,255,0.28)", bg: "rgba(255,255,255,0.05)" },
  viewed: { color: "rgba(120,210,230,0.85)", bg: "rgba(120,210,230,0.12)" },
  active: { color: "rgba(130,220,160,0.95)", bg: "rgba(130,220,160,0.16)" },
}

const PHASE_STYLE: Record<TestPhase, { color: string; bg: string; border: string }> = {
  "nog-niet-gestart": { color: "rgba(255,255,255,0.5)", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.12)" },
  onboarding: { color: ACCENT, bg: "rgba(120,210,230,0.08)", border: "rgba(120,210,230,0.22)" },
  verkennend: { color: "rgba(190,170,255,0.95)", bg: "rgba(190,170,255,0.08)", border: "rgba(190,170,255,0.24)" },
  actief: { color: "rgba(130,220,160,0.95)", bg: "rgba(130,220,160,0.08)", border: "rgba(130,220,160,0.22)" },
  grondig: { color: "rgba(150,235,180,1)", bg: "rgba(130,220,160,0.14)", border: "rgba(130,220,160,0.34)" },
}

const RELIABILITY_COLOR: Record<ReliabilityLevel, string> = {
  geen: "rgba(255,255,255,0.4)",
  laag: "rgba(255,200,120,0.9)",
  gemiddeld: "rgba(120,210,230,0.9)",
  hoog: "rgba(130,220,160,0.95)",
}

const SIGNAL_STYLE: Record<DashboardSignal["tone"], { color: string; bg: string; border: string }> = {
  info: { color: "rgba(120,210,230,0.9)", bg: "rgba(120,210,230,0.06)", border: "rgba(120,210,230,0.2)" },
  warn: { color: "rgba(255,190,120,0.95)", bg: "rgba(255,190,120,0.06)", border: "rgba(255,190,120,0.22)" },
  good: { color: "rgba(130,220,160,0.95)", bg: "rgba(130,220,160,0.06)", border: "rgba(130,220,160,0.22)" },
}

// A 0-100 score shown as a number + thin bar. Honest "—" when there's no data.
function ScoreBar({
  label,
  value,
  hasData,
  accent = ACCENT,
}: {
  label: string
  value: number
  hasData: boolean
  accent?: string
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        <span className="font-sans text-[13px] font-light text-foreground/90">
          {hasData ? value : "—"}
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: hasData ? `${value}%` : "0%",
            background: accent,
          }}
        />
      </div>
    </div>
  )
}

function CoverageGrid({ coverage }: { coverage: ScreenCoverage[] }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {coverage.map((c) => {
        const st = COVERAGE_STYLE[c.status]
        return (
          <div
            key={c.key}
            className="flex items-center justify-between rounded-lg px-2.5 py-1.5"
            style={{ background: st.bg }}
          >
            <span className="truncate text-[11px] text-muted-foreground">{c.label}</span>
            <span
              className="ml-2 shrink-0 font-mono text-[10px] tabular-nums"
              style={{ color: st.color }}
            >
              {c.views > 0 ? `${c.views}×` : "—"}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function KpiCell({
  label,
  value,
  sub,
}: {
  label: string
  value: string | number
  sub?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-muted px-3 py-2.5">
      <p className="font-sans text-[22px] font-light leading-none text-foreground/90">
        {value}
      </p>
      <p className="mt-1.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  )
}

function SummaryHeader({ summary }: { summary: DashboardSummary }) {
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4 backdrop-blur-md">
      <div className="grid grid-cols-3 gap-2">
        <KpiCell
          label="Testers"
          value={summary.total}
          sub={`${summary.activeTesters} actief`}
        />
        <KpiCell
          label="Gem. testscore"
          value={summary.activeTesters > 0 ? summary.avgTestscore : "—"}
        />
        <KpiCell
          label="Feedback"
          value={summary.totalFeedback}
          sub={summary.openBugs > 0 ? `${summary.openBugs} open` : "alles afgehandeld"}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <KpiCell
          label="Nog niet gestart"
          value={summary.notStarted}
        />
        <KpiCell
          label="Onboarding klaar"
          value={summary.completedOnboarding}
        />
        <KpiCell
          label="Test afgerond"
          value={summary.completedTesting}
        />
      </div>

      <div>
        <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
          Schermdekking — aandeel testers dat elk scherm opende
        </p>
        <div className="space-y-1.5">
          {summary.coveragePerScreen.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <span className="w-24 shrink-0 truncate text-[11px] text-muted-foreground">
                {s.label}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${s.openedPct}%`,
                    background:
                      s.openedPct === 0
                        ? "rgba(255,140,120,0.5)"
                        : ACCENT,
                  }}
                />
              </div>
              <span className="w-9 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                {s.openedPct}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {summary.signals.length > 0 && (
        <div className="space-y-1.5">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            Signalen
          </p>
          {summary.signals.map((sig, i) => {
            const st = SIGNAL_STYLE[sig.tone]
            return (
              <div
                key={i}
                className="rounded-lg px-3 py-2 text-[12px] leading-relaxed"
                style={{ background: st.bg, border: `1px solid ${st.border}`, color: st.color }}
              >
                {sig.message}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function testerLabel(t: DashboardTester): string {
  return t.displayName || t.email || "Onbekende tester"
}

function testerRoleLabel(t: DashboardTester): string {
  if (t.isHeadTester) return "Hoofdtester"
  if (t.roles.includes("coach")) return "Coach"
  if (t.roles.includes("parent")) return "Ouder"
  return "Tester"
}

function DashboardTesterCard({
  tester,
  onToggleDone,
  busy,
}: {
  tester: DashboardTester
  onToggleDone: (clerkId: string, completed: boolean) => void
  busy: boolean
}) {
  const [open, setOpen] = useState(false)
  const phase = PHASE_STYLE[tester.scores.phase]
  const done = tester.testerCompletedAt != null
  const hasData = tester.usage.hasData
  const number =
    tester.headTesterNumber != null
      ? `#${String(tester.headTesterNumber).padStart(3, "0")}`
      : null

  return (
    <div className="rounded-2xl border border-border bg-card p-4 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-sans text-[15px] font-light text-foreground/90">
            {testerLabel(tester)}
          </p>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            {testerRoleLabel(tester)}
            {number ? ` · ${number}` : ""}
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]"
          style={{ color: phase.color, background: phase.bg, border: `1px solid ${phase.border}` }}
        >
          {PHASE_LABEL[tester.scores.phase]}
        </span>
      </div>

      {/* Headline testscore + reliability */}
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-muted px-3 py-2.5">
        <div>
          <p className="font-sans text-[26px] font-light leading-none text-foreground/90">
            {hasData ? tester.scores.testscore : "—"}
          </p>
          <p className="mt-1 font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-foreground">
            Testscore
          </p>
        </div>
        <div className="ml-auto text-right">
          <p
            className="font-sans text-[13px] font-light"
            style={{ color: RELIABILITY_COLOR[tester.scores.reliability] }}
          >
            {RELIABILITY_LABEL[tester.scores.reliability]}
          </p>
          <p className="mt-0.5 font-mono text-[8.5px] uppercase tracking-[0.12em] text-muted-foreground">
            Betrouwbaarheid
          </p>
        </div>
      </div>

      {!hasData && (
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground">
          Nog niet gemeten — deze tester heeft de app nog niet gebruikt sinds
          telemetrie actief is.
        </p>
      )}

      {/* Quick usage strip */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        <div className="text-center">
          <p className="font-sans text-[16px] font-light text-foreground/90">
            {hasData ? tester.usage.sessions : "—"}
          </p>
          <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-muted-foreground">
            Sessies
          </p>
        </div>
        <div className="text-center">
          <p className="font-sans text-[16px] font-light text-foreground/90">
            {formatDuration(tester.usage.totalSeconds)}
          </p>
          <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-muted-foreground">
            In app
          </p>
        </div>
        <div className="text-center">
          <p className="font-sans text-[16px] font-light text-foreground/90">
            {hasData ? `${tester.coveragePct}%` : "—"}
          </p>
          <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-muted-foreground">
            Dekking
          </p>
        </div>
        <div className="text-center">
          <p className="font-sans text-[16px] font-light text-foreground/90">
            {tester.feedback.total}
          </p>
          <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-muted-foreground">
            Feedback
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-muted"
      >
        {open ? "Minder details" : "Meer details"}
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {/* Scores */}
          <div className="space-y-2.5">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Scores
            </p>
            <ScoreBar label="Compleetheid" value={tester.scores.compleetheid} hasData={hasData || tester.scores.compleetheid > 0} />
            <ScoreBar label="Activiteit" value={tester.scores.activiteit} hasData={hasData} />
            <ScoreBar label="Feedbackkwaliteit" value={tester.scores.feedbackkwaliteit} hasData={tester.feedback.total > 0} />
            <ScoreBar label="Herhaalbaarheid" value={tester.scores.herhaalbaarheid} hasData={hasData} />
          </div>

          {/* Coverage */}
          <div className="space-y-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Schermdekking
            </p>
            <CoverageGrid coverage={tester.coverage} />
          </div>

          {/* Onboarding */}
          <div className="space-y-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Onboarding
            </p>
            <div className="rounded-lg border border-border bg-muted px-3 py-2 text-[12px] text-muted-foreground">
              {tester.onboarding == null ? (
                "Nog niet begonnen"
              ) : tester.onboarding.fullyComplete ? (
                "Volledig afgerond"
              ) : tester.onboarding.coreCompleted ? (
                `Basis afgerond · ${tester.onboarding.completedSteps} stappen`
              ) : (
                `Bezig · ${tester.onboarding.completedSteps} stappen`
              )}
            </div>
          </div>

          {/* Connectors */}
          <div className="space-y-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Koppelingen
            </p>
            {tester.connectors.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">Nog geen koppelingen.</p>
            ) : (
              <div className="space-y-1.5">
                {tester.connectors.map((c) => (
                  <div
                    key={c.provider}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted px-3 py-2"
                  >
                    <span className="text-[12px] capitalize text-muted-foreground">
                      {c.provider}
                    </span>
                    <span
                      className="font-mono text-[10px]"
                      style={{
                        color:
                          c.permissionRevoked || c.errorStatus
                            ? "rgba(255,140,120,0.9)"
                            : c.status === "connected"
                              ? "rgba(130,220,160,0.95)"
                              : "rgba(255,255,255,0.45)",
                      }}
                    >
                      {c.permissionRevoked
                        ? "Toegang ingetrokken"
                        : c.errorStatus
                          ? "Storing"
                          : c.status === "connected"
                            ? c.lastSyncAt
                              ? `Gekoppeld · ${formatLastActivity(c.lastSyncAt)}`
                              : "Gekoppeld"
                            : c.status === "pending"
                              ? "In afwachting"
                              : c.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Feedback breakdown */}
          <div className="space-y-2">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
              Feedback
            </p>
            {tester.feedback.total === 0 ? (
              <p className="text-[12px] text-muted-foreground">Nog geen feedback gegeven.</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                <div className="rounded-lg border border-border bg-muted px-2 py-2 text-center">
                  <p className="font-sans text-[15px] font-light text-foreground/90">{tester.feedback.bugs}</p>
                  <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-muted-foreground">Bugs</p>
                </div>
                <div className="rounded-lg border border-border bg-muted px-2 py-2 text-center">
                  <p className="font-sans text-[15px] font-light text-foreground/90">{tester.feedback.ideas}</p>
                  <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-muted-foreground">Ideeën</p>
                </div>
                <div className="rounded-lg border border-border bg-muted px-2 py-2 text-center">
                  <p className="font-sans text-[15px] font-light text-foreground/90">{tester.feedback.openCount}</p>
                  <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-muted-foreground">Open</p>
                </div>
                <div className="rounded-lg border border-border bg-muted px-2 py-2 text-center">
                  <p className="font-sans text-[15px] font-light text-foreground/90">{tester.feedback.fixedCount}</p>
                  <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-muted-foreground">Opgelost</p>
                </div>
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Laatst actief</p>
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                {formatLastActivity(tester.usage.lastActivityAt)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Actieve dagen (30d)</p>
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                {hasData ? tester.usage.activeDays30 : "—"}
              </p>
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Gem. sessieduur</p>
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                {formatDuration(tester.usage.avgSeconds)}
              </p>
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">App-versie</p>
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                {tester.appVersion ?? "—"}
              </p>
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Toestel</p>
              <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                {tester.lastPlatform ?? "—"}
              </p>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => onToggleDone(tester.clerkId, !done)}
        disabled={busy}
        className="mt-3 w-full rounded-lg border border-border py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
      >
        {done ? "Heropenen" : "Markeer als klaar"}
      </button>
    </div>
  )
}

export function TestDashboardView({
  summary,
  testers,
  onToggleDone,
  busy,
}: {
  summary: DashboardSummary
  testers: DashboardTester[]
  onToggleDone: (clerkId: string, completed: boolean) => void
  busy: boolean
}) {
  const [, setLocation] = useLocation()
  return (
    <div className="space-y-3">
      <SummaryHeader summary={summary} />
      {testers.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center backdrop-blur-md">
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Nog geen testers. Zodra je iemand uitnodigt en die meedoet, verschijnt
            hier het volledige overzicht.
          </p>
          <button
            type="button"
            onClick={() => setLocation("/tester-qr")}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] transition-colors"
            style={{
              borderColor: "rgba(120,210,230,0.4)",
              background: "rgba(120,210,230,0.12)",
              color: ACCENT,
            }}
          >
            Nodig een tester uit
          </button>
        </div>
      ) : (
        testers.map((t) => (
          <DashboardTesterCard
            key={t.clerkId}
            tester={t}
            busy={busy}
            onToggleDone={onToggleDone}
          />
        ))
      )}
    </div>
  )
}
