/**
 * /admin/ops — alleen leesbaar operationeel dashboard.
 * Toont de huidige systeemmodus en de laatste admin-acties.
 * Beheerders kunnen de modus wijzigen. Geen verborgen logica:
 * wat je ziet is wat er in de DB staat.
 */

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { HoofdstukTabs } from "@/components/sparki/hoofdstuk-tabs"
import { BeheerSheet } from "@/components/sparki/beheer-popup"
import { Link } from "wouter"

const SYSTEM_MODES = [
  { value: "NORMAL", label: "Normaal", color: "text-emerald-400", bg: "bg-emerald-400/10" },
  { value: "DEGRADED", label: "Beperkt", color: "text-yellow-400", bg: "bg-yellow-400/10" },
  { value: "MAINTENANCE", label: "Onderhoud", color: "text-blue-400", bg: "bg-blue-400/10" },
  { value: "SALES_PAUSED", label: "Verkoop gepauzeerd", color: "text-orange-400", bg: "bg-orange-400/10" },
  { value: "BILLING_PAUSED", label: "Betaling gepauzeerd", color: "text-red-400", bg: "bg-red-400/10" },
  { value: "SERVICE_SHUTDOWN", label: "Dienst gestopt", color: "text-red-600", bg: "bg-red-600/10" },
] as const

type SystemMode = typeof SYSTEM_MODES[number]["value"]

type ModeRow = { mode: SystemMode; reason: string | null; changedAt: string | null }
type OpsLogRow = {
  id: number
  action: string
  actorClerkId: string
  previousState: unknown
  newState: unknown
  reason: string | null
  createdAt: string
}

function ModeTag({ mode }: { mode: SystemMode }) {
  const m = SYSTEM_MODES.find((s) => s.value === mode) ?? SYSTEM_MODES[0]
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-0.5 text-sm font-semibold ${m.bg} ${m.color}`}>
      {m.label}
    </span>
  )
}

// Niet-destructieve modi staan inline; het stoppen van de dienst is
// destructief en leeft in een apart venster met expliciete bevestiging.
const SAFE_MODES = SYSTEM_MODES.filter((m) => m.value !== "SERVICE_SHUTDOWN")
const SHUTDOWN_MODE = SYSTEM_MODES.find((m) => m.value === "SERVICE_SHUTDOWN")!

function useSetSystemMode() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { mode: SystemMode; reason?: string }) =>
      apiFetch<{ ok: boolean }>("/api/admin/system-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["/api/admin/system-mode"] })
      void qc.invalidateQueries({ queryKey: ["/api/admin/ops-log"] })
    },
  })
}

function SystemModePanel({ onShutdown }: { onShutdown: () => void }) {
  const { data, isLoading } = useQuery<ModeRow>({
    queryKey: ["/api/admin/system-mode"],
    queryFn: () => apiFetch("/api/admin/system-mode"),
  })

  const [newMode, setNewMode] = useState<SystemMode | "">("")
  const [reason, setReason] = useState("")
  const mutation = useSetSystemMode()

  if (isLoading || !data) {
    return <p className="text-sm text-white/40">Modus laden…</p>
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/40">
        Huidige systeemmodus
      </h2>
      <div className="flex items-center gap-3 mt-2">
        <ModeTag mode={data.mode} />
        {data.reason && (
          <span className="text-sm text-white/50">{data.reason}</span>
        )}
      </div>
      {data.changedAt && (
        <p className="mt-1 text-xs text-white/30">
          Gewijzigd: {new Date(data.changedAt).toLocaleString("nl-NL")}
        </p>
      )}

      {/* Modus wijzigen — alleen de niet-destructieve modi inline. */}
      <div className="mt-5 border-t border-white/[0.07] pt-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">
          Modus wijzigen
        </h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {SAFE_MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setNewMode(m.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                newMode === m.value
                  ? `border-white/30 ${m.bg} ${m.color}`
                  : "border-white/[0.08] text-white/40 hover:border-white/20"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Reden (optioneel)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mb-3 w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/25"
        />
        <button
          type="button"
          disabled={!newMode || mutation.isPending}
          onClick={() => {
            if (!newMode) return
            mutation.mutate({ mode: newMode, reason: reason || undefined })
          }}
          className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40 hover:bg-white/15 transition-colors"
        >
          {mutation.isPending ? "Opslaan…" : "Modus instellen"}
        </button>
        {mutation.isError && (
          <p className="mt-2 text-xs text-red-400">Kon modus niet opslaan.</p>
        )}
      </div>

      {/* Destructief: dienst stoppen. Nooit inline naast de gewone modi —
          altijd via een apart venster met expliciete bevestiging. */}
      <div className="mt-5 border-t border-red-400/20 pt-4">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-widest text-red-400/80">
          Dienst stoppen
        </h3>
        <p className="mb-3 text-xs text-white/40">
          {SHUTDOWN_MODE.label} zet de hele dienst stil. Dit opent een apart
          bevestigingsvenster.
        </p>
        <button
          type="button"
          onClick={onShutdown}
          className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/15"
        >
          Dienst stoppen openen
        </button>
      </div>
    </div>
  )
}

// Apart stappenvenster (TUX-27) voor de destructieve shutdown: expliciete
// reden + dubbele bevestiging voordat de dienst wordt stilgezet.
function ShutdownSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [reason, setReason] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const mutation = useSetSystemMode()

  return (
    <BeheerSheet open={open} onOpenChange={onOpenChange} titel="Dienst stoppen">
      <div className="space-y-4">
        <p className="text-sm text-white/60">
          {SHUTDOWN_MODE.label} ({SHUTDOWN_MODE.value}) zet de volledige dienst
          stil en vereist bevestiging van twee beheerders. Er gebeurt niets
          totdat je hieronder expliciet bevestigt.
        </p>
        <input
          type="text"
          placeholder="Reden (verplicht)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/25"
        />
        <label className="flex items-start gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          Ik begrijp dat dit de dienst voor iedereen stilzet.
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={!reason.trim() || !confirmed || mutation.isPending}
            onClick={() => {
              mutation.mutate(
                { mode: "SERVICE_SHUTDOWN", reason: reason.trim() },
                {
                  onSuccess: () => {
                    setReason("")
                    setConfirmed(false)
                    onOpenChange(false)
                  },
                },
              )
            }}
            className="rounded-xl border border-red-500/40 bg-red-500/15 px-5 py-2.5 text-sm font-semibold text-red-200 disabled:opacity-40 hover:bg-red-500/25 transition-colors"
          >
            {mutation.isPending ? "Bezig…" : "Dienst stoppen"}
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border border-white/15 px-5 py-2.5 text-sm text-white/70"
          >
            Annuleren
          </button>
        </div>
        {mutation.isError && (
          <p className="text-xs text-red-400">Kon de dienst niet stoppen.</p>
        )}
      </div>
    </BeheerSheet>
  )
}

type BuildRatingAggregateRow = {
  subjectType: string
  label: string
  count: number
  average: number | null
  recentCount: number
  recentAverage: number | null
  previousAverage: number | null
  trend: "beter" | "slechter" | "gelijk" | null
}

const TREND_LABEL: Record<string, { text: string; color: string }> = {
  beter: { text: "↑ beter", color: "text-emerald-400" },
  slechter: { text: "↓ slechter", color: "text-red-400" },
  gelijk: { text: "→ gelijk", color: "text-white/40" },
}

// Sterren-beoordelingen op gebouwde onderdelen — vaste audit-input. Alleen
// aggregaten (gemiddelde, aantal, trend); zwakste onderdelen bovenaan.
function BuildRatingsPanel() {
  const { data, isLoading } = useQuery<{
    aggregates: BuildRatingAggregateRow[]
    weakSubjectTypes: string[]
  }>({
    queryKey: ["/api/admin/build-ratings"],
    queryFn: () => apiFetch("/api/admin/build-ratings"),
  })

  if (isLoading)
    return <p className="text-sm text-white/40">Beoordelingen laden…</p>

  const rows = data?.aggregates ?? []
  const weak = new Set(data?.weakSubjectTypes ?? [])

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/40">
        Beoordelingen op gebouwde onderdelen
      </h2>
      <p className="mb-3 text-xs text-white/40">
        Sterren van sporters per onderdeel (alleen geaggregeerd). Zwak scorende
        onderdelen (gem. &lt; 3★ bij ≥ 3 beoordelingen) staan bovenaan de
        auditagenda.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-white/30">Nog geen beoordelingen.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => {
            const isWeak = weak.has(row.subjectType)
            const trend = row.trend ? TREND_LABEL[row.trend] : null
            return (
              <div
                key={row.subjectType}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 ${
                  isWeak
                    ? "border-red-400/30 bg-red-400/[0.06]"
                    : "border-white/[0.07] bg-white/[0.03]"
                }`}
              >
                <div className="min-w-0">
                  <span className="text-sm text-white/80">{row.label}</span>
                  {isWeak && (
                    <span className="ml-2 rounded-full bg-red-400/15 px-2 py-0.5 text-[10px] font-semibold text-red-300">
                      Audit-prioriteit
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 font-mono text-xs tabular-nums">
                  <span className="text-amber-300">
                    {row.average != null ? `${row.average.toFixed(2)}★` : "—"}
                  </span>
                  <span className="text-white/40">{row.count}×</span>
                  <span className="text-white/40">
                    30d:{" "}
                    {row.recentAverage != null
                      ? `${row.recentAverage.toFixed(2)}★ (${row.recentCount}×)`
                      : "—"}
                  </span>
                  {trend ? (
                    <span className={trend.color}>{trend.text}</span>
                  ) : (
                    <span className="text-white/25">geen trend</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function OpsLogPanel() {
  const { data, isLoading } = useQuery<{ log: OpsLogRow[] }>({
    queryKey: ["/api/admin/ops-log"],
    queryFn: () => apiFetch("/api/admin/ops-log"),
  })

  if (isLoading) return <p className="text-sm text-white/40">Log laden…</p>

  const rows = data?.log ?? []

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-white/40">
        Recente beheerdersacties
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-white/30">Nog geen acties geregistreerd.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs text-white/70">{row.action}</span>
                <span className="shrink-0 text-xs text-white/30">
                  {new Date(row.createdAt).toLocaleString("nl-NL")}
                </span>
              </div>
              {row.reason && (
                <p className="mt-1 text-xs text-white/50">{row.reason}</p>
              )}
              <p className="mt-1 font-mono text-[10px] text-white/25">
                {row.actorClerkId}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// F9-herindeling: drie échte tabs i.p.v. drie stapelende panelen. De
// hoofdinformatie (systeemmodus) staat in beeld bij openen; de destructieve
// shutdown zit achter een apart bevestigingsvenster (TUX-27).
type OpsTab = "systeem" | "beoordelingen" | "auditlog"

export default function AdminOpsPage() {
  const [tab, setTab] = useState<OpsTab>("systeem")
  const [shutdownOpen, setShutdownOpen] = useState(false)

  const TABS: { id: OpsTab; label: string }[] = [
    { id: "systeem", label: "Systeem" },
    { id: "beoordelingen", label: "Beoordelingen" },
    { id: "auditlog", label: "Auditlog" },
  ]

  return (
    <ScreenShell section="admin" bare terug={false}>
      <div className="flex flex-col gap-5">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-white">Operationeel beheer</h1>
            <p className="mt-1 text-sm text-white/50">
              Systeemmodus en auditlog. De modus is fail-open (NORMAL bij
              leesfout). Wijzigingen worden opgeslagen in de admin-ops-log.
            </p>
          </div>
          <Link
            href="/admin"
            className="shrink-0 text-xs text-white/40 hover:text-white/70"
          >
            ← Admin
          </Link>
        </header>

        <HoofdstukTabs<OpsTab>
          tabs={TABS}
          actief={tab}
          onKies={(id) => setTab(id)}
          ariaLabel="Operationeel-beheer-onderdelen"
        />

        {tab === "systeem" && (
          <SystemModePanel onShutdown={() => setShutdownOpen(true)} />
        )}
        {tab === "beoordelingen" && <BuildRatingsPanel />}
        {tab === "auditlog" && <OpsLogPanel />}
      </div>

      <ShutdownSheet open={shutdownOpen} onOpenChange={setShutdownOpen} />
    </ScreenShell>
  )
}
