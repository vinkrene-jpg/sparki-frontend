import { useEffect, useState } from "react"
import {
  Link2,
  Check,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Trash2,
} from "lucide-react"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import {
  fetchConnectors,
  syncConnector,
  beginOauthConnect,
  disconnectConnector,
  revokeConnector,
  dataTypeLabel,
  formatLastSync,
  READINESS_LABELS,
  type ConnectorItem,
  type ReadinessState,
} from "@/lib/connectors"

function letter(name: string): string {
  return name.charAt(0).toUpperCase()
}

// Visual treatment per readiness state — honest about what's live vs. prepared.
const READINESS_STYLE: Record<
  ReadinessState,
  { color: string; border: string; bg: string }
> = {
  actief: {
    color: "rgb(110,231,183)",
    border: "rgba(110,231,183,0.25)",
    bg: "rgba(110,231,183,0.08)",
  },
  beschikbaar: {
    color: ACCENT,
    border: "rgba(120,210,230,0.25)",
    bg: "rgba(120,210,230,0.08)",
  },
  testbaar: {
    color: "rgb(196,181,253)",
    border: "rgba(196,181,253,0.22)",
    bg: "rgba(196,181,253,0.07)",
  },
  voorbereid: {
    color: "rgba(255,255,255,0.4)",
    border: "rgba(255,255,255,0.1)",
    bg: "rgba(255,255,255,0.03)",
  },
}

function ReadinessBadge({ state }: { state: ReadinessState }) {
  const s = READINESS_STYLE[state]
  return (
    <span
      className="shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide"
      style={{ color: s.color, borderColor: s.border, background: s.bg }}
    >
      {READINESS_LABELS[state]}
    </span>
  )
}

function ConnectionRow({
  connector,
  busy,
  onConnect,
  onBeginConnect,
  onDisconnect,
  onRevoke,
}: {
  connector: ConnectorItem
  busy: boolean
  onConnect: (id: string) => void
  onBeginConnect: (id: string) => void
  onDisconnect: (id: string) => void
  onRevoke: (id: string) => void
}) {
  const isConnected = connector.status === "connected"
  const isError = connector.status === "error"
  // OAuth platforms (e.g. Strava) connect by redirecting to the provider's
  // consent screen — not by triggering a data sync.
  const connectAction =
    connector.authType === "oauth" ? onBeginConnect : onConnect

  return (
    <div className="flex flex-col gap-3 py-3.5">
      <div className="flex items-center gap-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl font-sans text-sm font-bold"
          style={
            connector.available
              ? { background: "rgba(120,210,230,0.1)", color: ACCENT }
              : { background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.35)" }
          }
        >
          {letter(connector.displayName)}
        </span>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-[14px] tracking-tight text-white/85">
            {connector.displayName}
          </span>
          {!connector.available && connector.unavailableReason && (
            <span className="text-[11px] leading-snug text-white/35">
              {connector.unavailableReason}
            </span>
          )}
          {connector.available && isConnected && (
            <span className="font-mono text-[10px] tracking-wide text-white/40">
              {formatLastSync(connector.lastSyncAt)
                ? `Laatst gesynct ${formatLastSync(connector.lastSyncAt)}`
                : "Gekoppeld"}
            </span>
          )}
          {connector.available && connector.permissionRevoked && (
            <span className="font-mono text-[10px] tracking-wide text-amber-400/80">
              Toegang ingetrokken — opnieuw koppelen
            </span>
          )}
        </div>

        {!isConnected && <ReadinessBadge state={connector.readiness.state} />}

        {connector.available && isConnected && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => onConnect(connector.id)}
              disabled={busy}
              title="Opnieuw synchroniseren"
              className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-white/55 transition-colors hover:text-white/80 disabled:opacity-40"
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
            </button>
            <button
              type="button"
              onClick={() => onDisconnect(connector.id)}
              disabled={busy}
              title="Koppeling verwijderen"
              className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-white/45 transition-colors hover:text-red-400 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>
        )}

        {connector.available && !isConnected && (
          <button
            type="button"
            onClick={() => connectAction(connector.id)}
            disabled={busy}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 font-sans text-xs font-semibold text-[#040506] transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : isError ? (
              "Opnieuw"
            ) : (
              "Koppel"
            )}
          </button>
        )}
      </div>

      {connector.available && isConnected && connector.importedDataTypes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pl-12">
          {connector.importedDataTypes.map((t) => (
            <span
              key={t}
              className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-sans text-[10px] text-white/55"
            >
              {dataTypeLabel(t)}
            </span>
          ))}
        </div>
      )}

      {connector.available && isError && connector.errorStatus && (
        <p className="flex items-start gap-1.5 pl-12 font-sans text-[11px] text-red-400">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {connector.errorStatus}
        </p>
      )}

      {connector.available && isConnected && (
        <button
          type="button"
          onClick={() => onRevoke(connector.id)}
          disabled={busy}
          className="self-start pl-12 font-mono text-[9px] tracking-[0.15em] text-white/25 transition-colors hover:text-white/45 disabled:opacity-40"
        >
          TOEGANG VOLLEDIG INTREKKEN
        </button>
      )}
    </div>
  )
}

export function ConnectionsSection() {
  const [connectors, setConnectors] = useState<ConnectorItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setConnectors(await fetchConnectors())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kon koppelingen niet laden.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  // Handle the return from the Strava OAuth round-trip (?strava=connected|denied|
  // error). Show the result, refresh the live state, then strip the param so a
  // refresh doesn't re-trigger the message.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const result = params.get("strava")
    if (!result) return
    if (result === "connected") {
      setNotice("Strava is gekoppeld.")
      setError(null)
    } else if (result === "denied") {
      setError("Je hebt de koppeling met Strava geannuleerd.")
    } else {
      setError("Er ging iets mis bij het koppelen met Strava. Probeer het opnieuw.")
    }
    params.delete("strava")
    const qs = params.toString()
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`,
    )
    void load()
  }, [])

  const replace = (updated: ConnectorItem) =>
    setConnectors((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))

  const handleConnect = async (id: string) => {
    setBusyId(id)
    setError(null)
    try {
      replace(await syncConnector(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Koppelen mislukt.")
      void load()
    } finally {
      setBusyId(null)
    }
  }

  // Start the OAuth round-trip: fetch the provider consent URL, then send the
  // browser there. We pass the current URL so the callback can return the user
  // to exactly this page. No `finally` reset — the page is navigating away.
  const handleBeginConnect = async (id: string) => {
    setBusyId(id)
    setError(null)
    setNotice(null)
    try {
      const url = await beginOauthConnect(id, window.location.href)
      window.location.href = url
    } catch (e) {
      setError(e instanceof Error ? e.message : "Koppelen mislukt.")
      setBusyId(null)
    }
  }

  const handleDisconnect = async (id: string) => {
    setBusyId(id)
    setError(null)
    try {
      replace(await disconnectConnector(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verwijderen mislukt.")
    } finally {
      setBusyId(null)
    }
  }

  const handleRevoke = async (id: string) => {
    setBusyId(id)
    setError(null)
    try {
      replace(await revokeConnector(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Intrekken mislukt.")
    } finally {
      setBusyId(null)
    }
  }

  const connected = connectors.filter((c) => c.status === "connected")
  const available = connectors.filter((c) => c.available && c.status !== "connected")
  const upcoming = connectors.filter((c) => !c.available)

  return (
    <section className="pt-2">
      <SectionLabel n="04" title="Koppelingen" />
      <p className="mt-2 text-pretty text-[12px] leading-relaxed text-white/35">
        Koppel je sport- en gezondheidsapps zodat Sparki je gegevens automatisch
        ophaalt. Verbreken of opnieuw synchroniseren kan altijd.
      </p>

      <div className="mt-3 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] px-4 backdrop-blur-md">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-white/40">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="font-sans text-sm">Koppelingen laden…</span>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {connected.map((c) => (
              <ConnectionRow
                key={c.id}
                connector={c}
                busy={busyId === c.id}
                onConnect={handleConnect}
                onBeginConnect={handleBeginConnect}
                onDisconnect={handleDisconnect}
                onRevoke={handleRevoke}
              />
            ))}
            {available.map((c) => (
              <ConnectionRow
                key={c.id}
                connector={c}
                busy={busyId === c.id}
                onConnect={handleConnect}
                onBeginConnect={handleBeginConnect}
                onDisconnect={handleDisconnect}
                onRevoke={handleRevoke}
              />
            ))}
            {upcoming.map((c) => (
              <ConnectionRow
                key={c.id}
                connector={c}
                busy={busyId === c.id}
                onConnect={handleConnect}
                onBeginConnect={handleBeginConnect}
                onDisconnect={handleDisconnect}
                onRevoke={handleRevoke}
              />
            ))}
          </div>
        )}
      </div>

      {notice && (
        <p className="mt-2 flex items-center gap-1.5 px-1 text-[11px] text-emerald-400">
          <Check className="h-3 w-3 shrink-0" />
          {notice}
        </p>
      )}

      {error && (
        <p className="mt-2 flex items-center gap-1.5 px-1 text-[11px] text-red-400">
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}

      <p className="mt-2 flex items-center gap-1.5 px-1 text-[11px] leading-snug text-white/30">
        <Link2 className="h-3 w-3 shrink-0" />
        Platforms zonder koppeling komen binnenkort beschikbaar. Tot die tijd vul
        je ontbrekende gegevens handmatig aan.
      </p>
    </section>
  )
}
