import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { trackScreen } from "@/lib/telemetry"
import {
  Link2,
  Check,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  X,
  ShieldCheck,
  ChevronDown,
} from "lucide-react"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import {
  fetchConnectors,
  syncConnector,
  backfillConnector,
  fetchConnectorRuns,
  beginOauthConnect,
  disconnectConnector,
  revokeConnector,
  dataTypeLabel,
  formatLastSync,
  READINESS_LABELS,
  SYNC_TRIGGER_LABELS,
  CONNECT_STATUS_LABELS,
  type ConnectorItem,
  type ConnectStatus,
  type ReadinessState,
  type SyncRun,
} from "@/lib/connectors"
import {
  shouldGatherAfterOAuth,
  gatherStravaAfterOAuth,
} from "@/lib/onboarding-resume"

function letter(name: string): string {
  return name.charAt(0).toUpperCase()
}

const CATEGORY_LABEL: Record<string, string> = {
  sport: "Sportapp",
  health: "Gezondheidsapp",
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
    border: "var(--color-accent-cyan)",
    bg: "var(--color-accent)",
  },
  testbaar: {
    color: "rgb(196,181,253)",
    border: "rgba(196,181,253,0.22)",
    bg: "rgba(196,181,253,0.07)",
  },
  voorbereid: {
    color: "var(--color-muted-foreground)",
    border: "var(--color-border)",
    bg: "var(--color-muted)",
  },
}

// Kleuren per centrale Sparki Connect-status (zelfde model als onboarding en
// mobiel): groen = echt gekoppeld, cyaan = bezig, amber = actie van de sporter
// nodig, grijs = neutraal/niet gekoppeld.
const CONNECT_STATUS_STYLE: Record<ConnectStatus, { color: string; border: string; bg: string }> = {
  not_connected: { color: "var(--color-muted-foreground)", border: "var(--color-border)", bg: "var(--color-muted)" },
  connecting: { color: ACCENT, border: "var(--color-accent-cyan)", bg: "var(--color-accent)" },
  connected: { color: "rgb(110,231,183)", border: "rgba(110,231,183,0.25)", bg: "rgba(110,231,183,0.08)" },
  sync_in_progress: { color: ACCENT, border: "var(--color-accent-cyan)", bg: "var(--color-accent)" },
  action_required: { color: "rgb(251,191,36)", border: "rgba(251,191,36,0.25)", bg: "rgba(251,191,36,0.08)" },
  temporarily_unavailable: { color: "rgb(251,191,36)", border: "rgba(251,191,36,0.22)", bg: "rgba(251,191,36,0.06)" },
  permission_revoked: { color: "rgb(251,191,36)", border: "rgba(251,191,36,0.25)", bg: "rgba(251,191,36,0.08)" },
  disconnected: { color: "var(--color-muted-foreground)", border: "var(--color-border)", bg: "var(--color-muted)" },
}

function ConnectStatusBadge({ status }: { status: ConnectStatus }) {
  const s = CONNECT_STATUS_STYLE[status]
  return (
    <span
      className="shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide"
      style={{ color: s.color, borderColor: s.border, background: s.bg }}
    >
      {CONNECT_STATUS_LABELS[status]}
    </span>
  )
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

// Shown for platforms that aren't a direct connection yet (awaiting the
// platform's official approval, native-only, or still in preparation). Honest:
// a single calm "Binnenkort" — never a half-started "koppelen gestart" state.
function UpcomingBadge() {
  const s = READINESS_STYLE.voorbereid
  return (
    <span
      className="shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide"
      style={{ color: s.color, borderColor: s.border, background: s.bg }}
    >
      Binnenkort
    </span>
  )
}

// ── Eerlijke functiestatus per platform (bv. Garmin) ────────────────────────
// De server beoordeelt intern per functie wat de echte staat is; hier vertalen
// we dat naar gewone Nederlandse zinnen. Interne codes of tokens komen nooit
// in beeld.
const CAPABILITY_LABELS: Record<string, string> = {
  activity_import: "Activiteiten ophalen",
  health_data: "Gezondheidsgegevens",
  workout_export: "Trainingen versturen",
  route_export: "Routes versturen",
  webhook_sync: "Automatisch bijwerken",
}

const CAPABILITY_STATUS_TEXT: Record<string, string> = {
  available: "Gekoppeld zodra je verbindt",
  prepared_not_active: "Nog niet beschikbaar",
  awaiting_official_access: "Deze functie wacht nog op goedkeuring",
}

// Toont voor een nog-niet-beschikbaar platform eerlijk welke functies er
// bestaan en waar ze op wachten — nooit een belofte die de code niet waarmaakt.
function CapabilityList({ capabilities }: { capabilities: Record<string, string> }) {
  const rows = Object.entries(CAPABILITY_LABELS)
    .map(([key, label]) => ({
      label,
      text: CAPABILITY_STATUS_TEXT[capabilities[key] ?? "unsupported"],
    }))
    .filter((r): r is { label: string; text: string } => !!r.text)
  if (rows.length === 0) return null
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((r) => (
        <li key={r.label} className="flex items-baseline gap-1.5 text-[11px] leading-snug">
          <span className="text-muted-foreground">{r.label}</span>
          <span className="text-muted-foreground">— {r.text}</span>
        </li>
      ))}
    </ul>
  )
}

// Compact list of the data types Sparki can use from a platform once connected.
function DataTypeChips({ types }: { types: string[] }) {
  if (types.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {types.map((t) => (
        <span
          key={t}
          className="rounded-full border border-border bg-muted px-2 py-0.5 font-sans text-[10px] text-muted-foreground"
        >
          {dataTypeLabel(t)}
        </span>
      ))}
    </div>
  )
}

// Consent screen shown before any connection is made: which data Sparki will
// use, an honest note about what happens, and a confirm button. Only opens for
// platforms that are wireable today (OAuth → redirect, otherwise direct sync);
// not-yet-wired platforms are purely informational and never reach this dialog.
function ConsentDialog({
  connector,
  busy,
  onCancel,
  onConfirm,
}: {
  connector: ConnectorItem
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const isOauth = connector.available && connector.authType === "oauth"
  const confirmLabel = isOauth
    ? `Ga naar ${connector.displayName}`
    : "Koppel"

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center overflow-y-auto bg-foreground/70 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-3xl border border-border bg-card shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-border p-5">
          <span
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl font-sans text-base font-bold"
            style={{ background: "var(--color-accent)", color: ACCENT }}
          >
            {letter(connector.displayName)}
          </span>
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-semibold tracking-tight text-foreground/90">
              {connector.displayName} koppelen
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {CATEGORY_LABEL[connector.category] ?? connector.category}
            </span>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground/80"
            aria-label="Sluiten"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-2">
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" style={{ color: ACCENT }} />
              Beschikbare gegevens
            </span>
            <DataTypeChips types={connector.provides} />
          </div>

          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {isOauth
              ? `Je wordt doorgestuurd naar ${connector.displayName} om toestemming te geven. Daarna worden je gegevens automatisch opgehaald.`
              : "Na je toestemming worden je gegevens automatisch opgehaald."}
          </p>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={busy}
              className="h-9 rounded-lg px-4 font-sans text-xs font-medium text-muted-foreground transition-colors hover:text-foreground/80 disabled:opacity-40"
            >
              Annuleren
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="flex h-9 items-center gap-1.5 rounded-lg px-4 font-sans text-xs font-semibold text-[color:var(--color-on-accent)] transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: ACCENT }}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Sync-historie per platform: echte sync_runs-rijen (wanneer, hoe getriggerd,
// wat is er opgehaald/aangemaakt, of het lukte). Laadt pas bij openklappen.
function RunsPanel({ connectorId }: { connectorId: string }) {
  const [runs, setRuns] = useState<SyncRun[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    fetchConnectorRuns(connectorId)
      .then((r) => {
        if (alive) setRuns(r)
      })
      .catch(() => {
        if (alive) setFailed(true)
      })
    return () => {
      alive = false
    }
  }, [connectorId])

  if (failed) {
    return (
      <p className="pl-12 text-[11px] text-red-400">
        Kon de synchronisatie-historie niet laden.
      </p>
    )
  }
  if (runs === null) {
    return (
      <p className="flex items-center gap-1.5 pl-12 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Historie laden…
      </p>
    )
  }
  if (runs.length === 0) {
    return (
      <p className="pl-12 text-[11px] text-muted-foreground">
        Nog geen synchronisaties uitgevoerd.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-1.5 pl-12">
      {runs.map((r) => {
        const ok = r.status === "success" || r.status === "partial"
        const created = r.counts?.activities ?? 0
        const merged = r.counts?.merged ?? 0
        return (
          <div key={r.id} className="flex flex-col gap-0.5">
            <span className="font-mono text-[10px] tracking-wide text-muted-foreground">
              {formatLastSync(r.startedAt) ?? r.startedAt} ·{" "}
              {SYNC_TRIGGER_LABELS[r.trigger] ?? r.trigger} ·{" "}
              <span className={ok ? "text-emerald-400/80" : "text-red-400/90"}>
                {ok
                  ? created + merged > 0
                    ? `${created} nieuw, ${merged} samengevoegd`
                    : "geen nieuwe gegevens"
                  : "mislukt"}
              </span>
            </span>
            {!ok && r.error && (
              <span className="text-[10px] leading-snug text-red-400/70">
                {r.error}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ConnectionRow({
  connector,
  busy,
  onConnect,
  onDisconnect,
  onRevoke,
  onSync,
  onBackfill,
}: {
  connector: ConnectorItem
  busy: boolean
  onConnect: (id: string) => void
  onDisconnect: (id: string) => void
  onRevoke: (id: string) => void
  onSync: (id: string) => void
  onBackfill: (id: string) => void
}) {
  const [showRuns, setShowRuns] = useState(false)
  const isAvailable = connector.available
  // Centraal Sparki Connect-statusmodel — zelfde bron als onboarding en mobiel.
  const cs = connector.connect.status
  const isConnected = isAvailable && (cs === "connected" || cs === "sync_in_progress")
  const isError = isAvailable && connector.status === "error"
  // Eén duidelijke herstelactie: opnieuw verbinden bij ingetrokken toestemming
  // of wanneer een actie van de sporter nodig is (bijv. verlopen toegang).
  const needsReconnect =
    isAvailable && (cs === "action_required" || cs === "permission_revoked")
  const lastSync = formatLastSync(
    connector.connect.lastSuccessfulSyncAt ?? connector.lastSyncAt,
  )

  return (
    <div className="flex flex-col gap-3 py-3.5">
      <div className="flex items-center gap-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl font-sans text-sm font-bold"
          style={
            connector.available
              ? { background: "var(--color-accent)", color: ACCENT }
              : { background: "var(--color-muted)", color: "var(--color-muted-foreground)" }
          }
        >
          {letter(connector.displayName)}
        </span>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-[14px] tracking-tight text-foreground/85">
            {connector.displayName}
          </span>
          {isConnected ? (
            <span className="font-mono text-[10px] tracking-wide text-muted-foreground">
              {cs === "sync_in_progress"
                ? "Gegevens worden nu opgehaald…"
                : lastSync
                  ? `Laatst gesynct ${lastSync}`
                  : "Gekoppeld — nog niet gesynct"}
            </span>
          ) : (
            !isAvailable &&
            connector.unavailableReason && (
              <span className="text-[11px] leading-snug text-muted-foreground">
                {connector.unavailableReason}
              </span>
            )
          )}
          {isAvailable && !isConnected && lastSync && cs !== "not_connected" && (
            <span className="font-mono text-[10px] tracking-wide text-muted-foreground">
              Laatst gesynct {lastSync}
            </span>
          )}
          {cs === "permission_revoked" && (
            <span className="font-mono text-[10px] tracking-wide text-amber-400/80">
              Toegang ingetrokken — verbind opnieuw om verder te gaan
            </span>
          )}
          {cs === "action_required" && (
            <span className="font-mono text-[10px] tracking-wide text-amber-400/80">
              {connector.connect.consentExpired
                ? "Toestemming verlopen — verbind opnieuw om te blijven synchroniseren"
                : "Er is een actie nodig — verbind opnieuw"}
            </span>
          )}
          {connector.syncStale && cs !== "action_required" && cs !== "permission_revoked" && (
            <span className="font-mono text-[10px] tracking-wide text-amber-400/80">
              Al meer dan 24 uur geen geslaagde synchronisatie — mogelijk is de
              koppeling stuk. Synchroniseer handmatig of verbind opnieuw.
            </span>
          )}
          {cs === "temporarily_unavailable" && (
            <span className="font-mono text-[10px] tracking-wide text-amber-400/70">
              Tijdelijk niet beschikbaar — er wordt vanzelf opnieuw geprobeerd
            </span>
          )}
        </div>

        {!isAvailable ? (
          <UpcomingBadge />
        ) : isConnected || cs !== "not_connected" ? (
          <ConnectStatusBadge status={cs} />
        ) : (
          <ReadinessBadge state={connector.readiness.state} />
        )}

        {isConnected && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => onSync(connector.id)}
              disabled={busy}
              title="Opnieuw synchroniseren"
              className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground/80 disabled:opacity-40"
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
              className="grid h-8 w-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:text-red-400 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>
        )}

        {isAvailable && !isConnected && (
          <button
            type="button"
            onClick={() => onConnect(connector.id)}
            disabled={busy}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 font-sans text-xs font-semibold text-[color:var(--color-on-accent)] transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : needsReconnect || isError ? (
              "Opnieuw verbinden"
            ) : cs === "temporarily_unavailable" ? (
              "Probeer nu"
            ) : (
              "Koppel"
            )}
          </button>
        )}
      </div>

      {/* What data Sparki can use from this platform. Connected rows show what
          was actually imported; everything else shows the platform's full
          capabilities so the athlete knows what they'd get. */}
      <div className="pl-12">
        {isConnected && connector.importedDataTypes.length > 0 ? (
          <DataTypeChips types={connector.importedDataTypes} />
        ) : !isAvailable &&
          Object.values(connector.capabilities ?? {}).some(
            (s) => s === "awaiting_official_access" || s === "prepared_not_active",
          ) ? (
          // Nog niet beschikbaar platform (bv. Garmin): eerlijk per functie
          // laten zien wat er bestaat en waar het op wacht.
          <CapabilityList capabilities={connector.capabilities} />
        ) : (
          <DataTypeChips types={connector.provides} />
        )}
      </div>

      {isError && connector.errorStatus && (
        <p className="flex items-start gap-1.5 pl-12 font-sans text-[11px] text-red-400">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          {connector.errorStatus}
        </p>
      )}

      {isConnected && (
        <div className="flex flex-wrap items-center gap-3 pl-12">
          <button
            type="button"
            onClick={() => onBackfill(connector.id)}
            disabled={busy}
            className="font-mono text-[9px] tracking-[0.15em] text-muted-foreground transition-colors hover:text-muted-foreground disabled:opacity-40"
            title="Haal oudere activiteiten van dit platform op"
          >
            OUDERE ACTIVITEITEN OPHALEN
          </button>
          <button
            type="button"
            onClick={() => setShowRuns((v) => !v)}
            aria-expanded={showRuns}
            className="font-mono text-[9px] tracking-[0.15em] text-muted-foreground transition-colors hover:text-muted-foreground"
          >
            {showRuns ? "HISTORIE VERBERGEN" : "SYNC-HISTORIE"}
          </button>
        </div>
      )}

      {isConnected && showRuns && <RunsPanel connectorId={connector.id} />}

      {isConnected && (
        <button
          type="button"
          onClick={() => onRevoke(connector.id)}
          disabled={busy}
          className="self-start pl-12 font-mono text-[9px] tracking-[0.15em] text-muted-foreground transition-colors hover:text-muted-foreground disabled:opacity-40"
        >
          TOEGANG VOLLEDIG INTREKKEN
        </button>
      )}
    </div>
  )
}

export function ConnectionsSection({
  // Onboarding passes this so it can hold the "Verder" button while Sparki is
  // still importing a freshly-connected platform — the gap-fill must only decide
  // what's missing AFTER the initial import has landed.
  onImportingChange,
}: {
  onImportingChange?: (importing: boolean) => void
} = {}) {
  const [connectors, setConnectors] = useState<ConnectorItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [consentId, setConsentId] = useState<string | null>(null)
  const [showUpcoming, setShowUpcoming] = useState(false)
  // Honest "we're fetching your data" state right after a connect. Never a fake
  // green: the import is really running (Data Hub sync) before we claim success.
  const [importing, setImporting] = useState(false)

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
    trackScreen("connect")
  }, [])

  const replace = (updated: ConnectorItem) =>
    setConnectors((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))

  // Handle the return from the Strava OAuth round-trip (?strava=connected|denied|
  // error). Strip the param first so a refresh can't re-trigger the flow, load
  // the live state, then — on success — make sure the initial import actually
  // landed before the next gap-fill screen decides what's still missing. The
  // OAuth callback does a best-effort import; if it brought nothing in (or failed
  // silently) we run a real Data Hub sync now, with an honest "ophalen" state.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const result = params.get("strava")
    if (result) {
      params.delete("strava")
      const qs = params.toString()
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`,
      )
    }

    let alive = true
    void (async () => {
      setLoading(true)
      setError(null)
      let list: ConnectorItem[]
      try {
        list = await fetchConnectors()
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : "Kon koppelingen niet laden.")
          setLoading(false)
        }
        return
      }
      if (!alive) return
      setConnectors(list)
      setLoading(false)

      if (result === "denied") {
        setError("Je hebt de koppeling met Strava geannuleerd.")
        return
      }
      if (result === "error") {
        setError("Er ging iets mis bij het koppelen met Strava. Probeer het opnieuw.")
        return
      }
      if (result !== "connected") return

      const strava = list.find((c) => c.id === "strava")
      if (shouldGatherAfterOAuth(result, strava)) {
        // Connected but nothing imported yet — gather it now so the gap-fill
        // reflects real data (FTP/gewicht/activiteiten) instead of asking for it.
        // The helper holds "Verder" (setImporting → onImportingChange) for the
        // full duration of the sync and always releases it once it settles.
        setNotice(null)
        setError(null)
        await gatherStravaAfterOAuth({
          sync: () => syncConnector("strava"),
          setImporting: (v) => {
            setImporting(v)
            onImportingChange?.(v)
          },
          onReplace: replace,
          onNotice: setNotice,
          onError: setError,
          isAlive: () => alive,
        })
      } else {
        setNotice("Strava is gekoppeld.")
      }
    })()

    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The athlete confirmed consent in the dialog. Route to the right action:
  // OAuth platforms (Strava) redirect to the provider; other wireable platforms
  // run a sync; not-yet-wired platforms record an honest "koppelen gestart".
  const handleConfirm = async () => {
    const id = consentId
    if (!id) return
    const connector = connectors.find((c) => c.id === id)
    if (!connector) return
    setBusyId(id)
    setError(null)
    setNotice(null)
    try {
      if (connector.authType === "oauth") {
        const url = await beginOauthConnect(id, window.location.href)
        window.location.href = url
        return // navigating away
      }
      replace(await syncConnector(id))
      setConsentId(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Koppelen mislukt.")
      void load()
      setConsentId(null)
    } finally {
      setBusyId(null)
    }
  }

  const handleSync = async (id: string) => {
    setBusyId(id)
    setError(null)
    try {
      replace(await syncConnector(id))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Synchroniseren mislukt.")
      void load()
    } finally {
      setBusyId(null)
    }
  }

  // Historische import: zelfde Data Hub-pad, maar de adapter haalt diepere
  // historie op. Handmatige correcties blijven altijd staan.
  const handleBackfill = async (id: string) => {
    setBusyId(id)
    setError(null)
    setNotice(null)
    try {
      replace(await backfillConnector(id))
      setNotice("Historische import afgerond.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Historische import mislukt.")
      void load()
    } finally {
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

  // Order: connected → wireable now → awaiting approval / in voorbereiding.
  // Unavailable platforms are purely informational (a calm "Binnenkort"); they
  // can never be "connected" and no longer create a half-started pending shell.
  const connected = connectors.filter(
    (c) => c.available && c.status === "connected",
  )
  const available = connectors.filter(
    (c) => c.available && c.status !== "connected",
  )
  const upcoming = connectors.filter((c) => !c.available)
  // Connectable now (real connections) stay open in the main card; the
  // not-yet-available platforms are tucked into a collapsible card so the long
  // "Binnenkort" list doesn't clutter the screen.
  const ready = [...connected, ...available]

  const consentConnector = consentId
    ? connectors.find((c) => c.id === consentId) ?? null
    : null

  return (
    <section className="pt-2">
      <SectionLabel n="04" title="Koppelingen" />
      <p className="mt-2 text-pretty text-[12px] leading-relaxed text-muted-foreground">
        Koppel je sport- en gezondheidsapps — je gegevens worden dan automatisch
        opgehaald. Verbreken of opnieuw synchroniseren kan altijd.
      </p>

      {loading ? (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-8 text-muted-foreground backdrop-blur-md">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="font-sans text-sm">Koppelingen laden…</span>
        </div>
      ) : (
        <>
          {ready.length > 0 && (
            <div className="mt-3 rounded-2xl border border-border bg-card px-4 backdrop-blur-md">
              <div className="divide-y divide-white/[0.06]">
                {ready.map((c) => (
                  <ConnectionRow
                    key={c.id}
                    connector={c}
                    busy={busyId === c.id}
                    onConnect={setConsentId}
                    onDisconnect={handleDisconnect}
                    onRevoke={handleRevoke}
                    onSync={handleSync}
                    onBackfill={handleBackfill}
                  />
                ))}
              </div>
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-card backdrop-blur-md">
              <button
                type="button"
                onClick={() => setShowUpcoming((v) => !v)}
                aria-expanded={showUpcoming}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted"
              >
                <span
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                  style={{ background: "var(--color-muted)" }}
                >
                  <Link2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
                </span>
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-[14px] tracking-tight text-muted-foreground">
                    Binnenkort beschikbaar
                  </span>
                  <span className="text-[11px] leading-snug text-muted-foreground">
                    {upcoming.length} platforms wachten op goedkeuring of zijn nog
                    in voorbereiding
                  </span>
                </div>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                    showUpcoming ? "rotate-180" : ""
                  }`}
                  strokeWidth={1.75}
                />
              </button>

              {showUpcoming && (
                <div className="divide-y divide-white/[0.06] border-t border-border px-4">
                  {upcoming.map((c) => (
                    <ConnectionRow
                      key={c.id}
                      connector={c}
                      busy={busyId === c.id}
                      onConnect={setConsentId}
                      onDisconnect={handleDisconnect}
                      onRevoke={handleRevoke}
                      onSync={handleSync}
                      onBackfill={handleBackfill}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {importing && (
        <p className="mt-2 flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
          <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
          Je gegevens worden opgehaald…
        </p>
      )}

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

      <p className="mt-2 flex items-center gap-1.5 px-1 text-[11px] leading-snug text-muted-foreground">
        <Link2 className="h-3 w-3 shrink-0" />
        Sommige platforms geven externe apps pas toegang na een officieel
        goedkeuringsproces — die koppelingen schakelen we automatisch in zodra
        Sparki is goedgekeurd. Tot die tijd voeg je trainingen toe via een GPX-
        of FIT-bestand (FIT bevat ook je vermogen en hartslag) of een koppeling
        die al werkt.
      </p>

      {consentConnector && (
        <ConsentDialog
          connector={consentConnector}
          busy={busyId === consentConnector.id}
          onCancel={() => setConsentId(null)}
          onConfirm={handleConfirm}
        />
      )}
    </section>
  )
}
