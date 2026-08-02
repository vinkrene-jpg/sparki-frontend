import { useState } from "react"
import { Loader2, RefreshCw, AlertTriangle, Check } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import { useUserProfile } from "@/contexts/UserContext"
import { useConnectors, useSyncConnector } from "@/hooks/use-connectors"
import type { ConnectorItem } from "@/lib/connectors"

// ─────────────────────────────────────────────────────────────────────────────
// Connector recovery nudge (Today screen).
//
// The onboarding connect step self-heals a failed initial import, but if the
// athlete taps through anyway (connecting is optional) they can land in the app
// with a "connected" platform that imported nothing — or whose last sync failed.
// That would strand them: connected, but no data and no obvious way to retry.
//
// This nudge closes that gap honestly (never a fake green): when a truly-wired,
// connected platform has empty importedDataTypes OR its last sync errored, it
// shows a plain-Dutch, neutral-voice notice with a working "Opnieuw
// synchroniseren" action that runs a real Data Hub sync. It disappears the
// moment real data lands. Permission-revoked platforms are excluded — those need
// a reconnect (handled in Koppelingen), not a resync.
// ─────────────────────────────────────────────────────────────────────────────

type RecoveryKind = "empty" | "error"

function recoveryKind(c: ConnectorItem): RecoveryKind | null {
  if (!c.available) return null
  if (c.permissionRevoked) return null
  // Last sync failed outright.
  if (c.status === "error") return "error"
  // Connected, but nothing was actually imported — a silent failed first import.
  if (c.status === "connected" && c.importedDataTypes.length === 0) return "empty"
  return null
}

function RecoveryRow({ connector }: { connector: ConnectorItem }) {
  const kind = recoveryKind(connector)
  const sync = useSyncConnector()
  const [done, setDone] = useState(false)

  if (!kind) return null

  const message =
    kind === "error"
      ? `${connector.displayName} is gekoppeld, maar de laatste synchronisatie mislukte.`
      : `${connector.displayName} is gekoppeld, maar er zijn nog geen gegevens opgehaald.`

  const onRetry = () => {
    if (sync.isPending) return
    setDone(false)
    sync.mutate(connector.id, {
      onSuccess: (updated) => {
        // Only claim success when data actually landed — otherwise the nudge
        // stays and the error line explains it (honest, never fake-green).
        if (
          updated.status === "connected" &&
          updated.importedDataTypes.length > 0
        ) {
          setDone(true)
        }
      },
    })
  }

  return (
    <div className="flex flex-col gap-2.5">
      <p className="flex items-start gap-1.5 text-pretty text-[13px] leading-relaxed text-muted-foreground">
        <AlertTriangle
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400/80"
          strokeWidth={1.75}
        />
        <span>{message}</span>
      </p>

      <button
        type="button"
        onClick={onRetry}
        disabled={sync.isPending}
        className="inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors hover:bg-muted disabled:opacity-50"
        style={{
          borderColor: "var(--color-accent-cyan)",
          background: "var(--color-muted)",
          color: ACCENT,
        }}
      >
        {sync.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
        )}
        {sync.isPending ? "Ophalen…" : "Opnieuw synchroniseren"}
      </button>

      {done && (
        <p className="flex items-center gap-1.5 font-sans text-[12px] text-emerald-400">
          <Check className="h-3 w-3 shrink-0" />
          Je gegevens zijn opgehaald.
        </p>
      )}
      {sync.isError && (
        <p className="font-sans text-[12px] text-[rgba(255,140,120,0.85)]">
          Ophalen lukte nog niet — probeer het zo opnieuw.
        </p>
      )}
    </div>
  )
}

export function ConnectorRecoveryNudge() {
  const { profile: userProfile } = useUserProfile()
  const { data: connectors, isLoading } = useConnectors()

  // Athlete-scoped surface — coaches and parents have their own home.
  if (userProfile && userProfile.activeRole !== "athlete") return null
  if (isLoading || !connectors) return null

  const needsRecovery = connectors.filter((c) => recoveryKind(c) !== null)
  if (needsRecovery.length === 0) return null

  return (
    <section className="rounded-2xl border border-amber-300/20 bg-card p-5 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{
            background: "rgba(245,200,110,0.9)",
          }}
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[color:var(--color-warning)]">
          Koppeling zonder gegevens
        </span>
      </div>
      <div className="mt-3 flex flex-col gap-4">
        {needsRecovery.map((c) => (
          <RecoveryRow key={c.id} connector={c} />
        ))}
      </div>
    </section>
  )
}
