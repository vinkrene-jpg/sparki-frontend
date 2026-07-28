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

function SystemModePanel() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<ModeRow>({
    queryKey: ["/api/admin/system-mode"],
    queryFn: () => apiFetch("/api/admin/system-mode"),
  })

  const [newMode, setNewMode] = useState<SystemMode | "">("")
  const [reason, setReason] = useState("")

  const mutation = useMutation({
    mutationFn: (body: { mode: SystemMode; reason?: string }) =>
      apiFetch<{ ok: boolean }>("/api/admin/system-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["/api/admin/system-mode"] })
      void qc.invalidateQueries({ queryKey: ["/api/admin/ops-log"] })
      setNewMode("")
      setReason("")
    },
  })

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

      {/* Modus wijzigen */}
      <div className="mt-5 border-t border-white/[0.07] pt-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-white/40">
          Modus wijzigen
        </h3>
        <div className="flex flex-wrap gap-2 mb-3">
          {SYSTEM_MODES.map((m) => (
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
            if (newMode === "SERVICE_SHUTDOWN") {
              const ok = window.confirm(
                "SERVICE_SHUTDOWN vereist bevestiging van twee beheerders. Weet je zeker dat je dit wilt activeren?",
              )
              if (!ok) return
            }
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

export default function AdminOpsPage() {
  return (
    <ScreenShell bg={null} section="admin" terug={false}>
      <div className="px-4 pb-24 pt-2">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold text-white">Operationeel beheer</h1>
          <Link href="/admin" className="text-xs text-white/40 hover:text-white/70">
            ← Admin
          </Link>
        </div>
        <p className="mb-6 text-sm text-white/50">
          Systeemmodus en auditlog. De modus is fail-open (NORMAL bij leesfout). Wijzigingen
          worden opgeslagen in de admin-ops-log.
        </p>
        <div className="space-y-5">
          <SystemModePanel />
          <OpsLogPanel />
        </div>
      </div>
    </ScreenShell>
  )
}
