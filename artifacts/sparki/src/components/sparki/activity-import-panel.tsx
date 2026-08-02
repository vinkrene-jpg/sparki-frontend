import { useRef, useState } from "react"
import { Route as RouteIcon } from "lucide-react"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import {
  useActivityImports,
  useUploadActivity,
  useDeleteActivityImport,
  useLinkActivityImport,
  type ActivityImport,
  type GpxSummary,
  type FitSummary,
} from "@/hooks/use-activity-imports"
import { useSaveRideAsRoute } from "@/hooks/use-routes"
import { useSessions } from "@/hooks/use-sessions"
import type { TrainingSession } from "@/lib/athlete-types"

const STATUS_LABEL: Record<string, string> = {
  uploaded: "Geüpload",
  parsed: "Verwerkt",
  failed: "Mislukt",
  linked: "Gekoppeld",
}

const STATUS_COLOR: Record<string, string> = {
  uploaded: "rgba(245,200,110,0.9)",
  parsed: "var(--color-accent-cyan)",
  failed: "rgba(255,120,110,0.95)",
  linked: "rgba(140,230,170,0.9)",
}

function isGpxSummary(v: unknown): v is GpxSummary {
  return (
    !!v &&
    typeof v === "object" &&
    "pointCount" in v &&
    (v as { format?: string }).format !== "fit"
  )
}

// Gedetecteerde stops uit de Sparki Traffic Database (bewaard bij de upload).
type RoadStop = {
  stopSec: number
  atSec: number
  candidates: { kind: string; confidence: number }[]
}

const STOP_LABELS: Record<string, string> = {
  traffic_signal: "verkeerslicht",
  railway_crossing: "spoorwegovergang",
  junction: "kruispunt",
  pause: "pauze",
}

function roadStopsOf(v: unknown): RoadStop[] {
  const raw =
    v && typeof v === "object" ? (v as { roadStops?: unknown }).roadStops : null
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (s): s is RoadStop =>
      !!s &&
      typeof s === "object" &&
      typeof (s as RoadStop).stopSec === "number" &&
      Array.isArray((s as RoadStop).candidates),
  )
}

function fmtAt(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}u${String(m).padStart(2, "0")}` : `${m} min`
}

// Ritanalyse: echte stilstanden met de meest waarschijnlijke oorzaak, bv.
// "waarschijnlijk gestopt voor een verkeerslicht (72%)".
function StopsRow({ stops }: { stops: RoadStop[] }) {
  const [open, setOpen] = useState(false)
  const signalCount = stops.filter(
    (s) => s.candidates[0]?.kind === "traffic_signal",
  ).length
  return (
    <div className="mt-2.5 border-t border-border pt-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-mono text-[11px] text-muted-foreground transition hover:text-muted-foreground"
      >
        {stops.length} {stops.length === 1 ? "stop" : "stops"} onderweg
        {signalCount > 0 &&
          ` · ${signalCount}× waarschijnlijk voor een verkeerslicht`}{" "}
        {open ? "▴" : "▾"}
      </button>
      {open && (
        <ul className="mt-2 space-y-1">
          {stops.slice(0, 12).map((s, i) => {
            const top = s.candidates[0]
            return (
              <li
                key={i}
                className="font-mono text-[11px] tabular-nums text-muted-foreground"
              >
                Na {fmtAt(s.atSec)} · {s.stopSec} s stil
                {top && (
                  <>
                    {" — waarschijnlijk "}
                    {STOP_LABELS[top.kind] ?? top.kind} (
                    {Math.round(top.confidence * 100)}%)
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function isFitSummary(v: unknown): v is FitSummary {
  return (
    !!v && typeof v === "object" && (v as { format?: string }).format === "fit"
  )
}

function fmtDuration(sec: number | null): string | null {
  if (sec == null) return null
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}u ${m}m` : `${m}m`
}

const NL_MONTHS = [
  "jan", "feb", "mrt", "apr", "mei", "jun",
  "jul", "aug", "sep", "okt", "nov", "dec",
]

function fmtDateNl(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getDate()} ${NL_MONTHS[d.getMonth()]}`
}

function sessionLabel(s: TrainingSession): string {
  const parts: string[] = []
  const date = fmtDateNl(s.sessionDate)
  if (date) parts.push(date)
  parts.push(s.title?.trim() || s.type)
  const dur = fmtDuration(s.durationMin != null ? s.durationMin * 60 : null)
  if (dur) parts.push(dur)
  return parts.join(" · ")
}

// The activity's own date (from parsed GPX/FIT start time) drives a smart
// ordering of candidate sessions; falls back to the upload moment.
function importDateMs(imp: ActivityImport): number {
  const s = imp.parsedSummary as { startTime?: string | null } | null
  const iso = s?.startTime ?? imp.uploadedAt
  const t = iso ? new Date(iso).getTime() : NaN
  return Number.isNaN(t) ? Date.now() : t
}

// Most-likely matches first: sessions closest in time to the activity.
function rankSessions(
  sessions: TrainingSession[],
  imp: ActivityImport,
): TrainingSession[] {
  const ref = importDateMs(imp)
  return [...sessions].sort(
    (a, b) =>
      Math.abs(new Date(a.sessionDate).getTime() - ref) -
      Math.abs(new Date(b.sessionDate).getTime() - ref),
  )
}

// A single decoded FIT metric. `value` is null when the file did not contain it,
// in which case it is shown honestly as "ontbreekt" — never invented.
type FitMetric = { label: string; value: string | null }

function fitMetrics(s: FitSummary): FitMetric[] {
  return [
    { label: "Duur", value: fmtDuration(s.durationSec) },
    { label: "Afstand", value: s.distanceKm != null ? `${s.distanceKm} km` : null },
    {
      label: "Hoogtemeters",
      value: s.elevationGainM != null ? `${s.elevationGainM} hm` : null,
    },
    {
      label: "Vermogen gem.",
      value: s.avgPower != null ? `${s.avgPower} W` : null,
    },
    { label: "Vermogen max.", value: s.maxPower != null ? `${s.maxPower} W` : null },
    {
      label: "Hartslag gem.",
      value: s.avgHeartRate != null ? `${s.avgHeartRate} bpm` : null,
    },
    {
      label: "Hartslag max.",
      value: s.maxHeartRate != null ? `${s.maxHeartRate} bpm` : null,
    },
    {
      label: "Cadans gem.",
      value: s.avgCadence != null ? `${s.avgCadence} rpm` : null,
    },
  ]
}

function FitMetricGrid({ summary }: { summary: FitSummary }) {
  const metrics = fitMetrics(summary)
  return (
    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
      {metrics.map((m) => (
        <div key={m.label} className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            {m.label}
          </span>
          {m.value != null ? (
            <span className="font-mono text-[12px] tabular-nums text-accent-cyan">
              {m.value}
            </span>
          ) : (
            <span className="font-mono text-[10px] italic text-muted-foreground">
              ontbreekt
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function LinkRow({
  imp,
  sessions,
}: {
  imp: ActivityImport
  sessions: TrainingSession[]
}) {
  const link = useLinkActivityImport()
  const [picking, setPicking] = useState(false)

  const linkedSession =
    imp.linkedTrainingSessionId != null
      ? sessions.find((s) => s.id === imp.linkedTrainingSessionId)
      : undefined
  const candidates = rankSessions(sessions, imp).slice(0, 6)

  if (imp.linkedTrainingSessionId != null) {
    return (
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border pt-2.5">
        <span className="min-w-0 truncate text-[12px] text-muted-foreground">
          <span className="text-[rgba(140,230,170,0.9)]">Gekoppeld</span>
          {linkedSession ? ` · ${sessionLabel(linkedSession)}` : ""}
        </span>
        <button
          type="button"
          onClick={() => link.mutate({ id: imp.id, sessionId: null })}
          disabled={link.isPending}
          className="shrink-0 font-mono text-[10px] text-muted-foreground transition hover:text-muted-foreground disabled:opacity-40"
        >
          ontkoppel
        </button>
      </div>
    )
  }

  return (
    <div className="mt-2.5 border-t border-border pt-2.5">
      {!picking ? (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="font-mono text-[10px] uppercase tracking-[0.16em] transition hover:opacity-80"
          style={{ color: ACCENT }}
        >
          + koppel aan training
        </button>
      ) : sessions.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">
          Nog geen trainingen om aan te koppelen — log eerst een training.
        </p>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">
            Kies de bijbehorende training
            <button
              type="button"
              onClick={() => setPicking(false)}
              className="ml-2 font-mono text-[10px] text-muted-foreground transition hover:text-muted-foreground"
            >
              annuleer
            </button>
          </p>
          {candidates.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                link.mutate(
                  { id: imp.id, sessionId: s.id },
                  { onSuccess: () => setPicking(false) },
                )
              }}
              disabled={link.isPending}
              className="block w-full truncate rounded-lg border border-border bg-muted px-2.5 py-1.5 text-left text-[12px] text-muted-foreground transition hover:border-border hover:text-foreground/90 disabled:opacity-40"
            >
              {sessionLabel(s)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ImportCard({
  imp,
  sessions,
}: {
  imp: ActivityImport
  sessions: TrainingSession[]
}) {
  const del = useDeleteActivityImport()
  const saveRoute = useSaveRideAsRoute()
  const [savedRoute, setSavedRoute] = useState(false)
  const gpx = isGpxSummary(imp.parsedSummary) ? imp.parsedSummary : null
  const fit = isFitSummary(imp.parsedSummary) ? imp.parsedSummary : null
  const gpxStats: string[] = []
  if (gpx) {
    if (gpx.distanceKm != null) gpxStats.push(`${gpx.distanceKm} km`)
    const dur = fmtDuration(gpx.durationSec)
    if (dur) gpxStats.push(dur)
    if (gpx.elevationGainM != null) gpxStats.push(`${gpx.elevationGainM} hm`)
  }
  // A ridden GPX keeps its real track shape, so it can be saved as a route to
  // ride back later. Older imports (before tracks were stored) have no geometry
  // and honestly get no button.
  const canSaveAsRoute = (gpx?.route?.geometry?.length ?? 0) > 1

  return (
    <div className="rounded-xl border border-border bg-card p-3.5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-[9px] uppercase tracking-[0.16em]"
              style={{ color: STATUS_COLOR[imp.status] }}
            >
              {STATUS_LABEL[imp.status] ?? imp.status}
            </span>
            <span className="font-mono text-[9px] uppercase text-muted-foreground">
              · {imp.fileType}
            </span>
          </div>
          <p className="mt-1 truncate text-[13px] font-medium text-foreground/85">
            {gpx?.trackName || imp.fileName}
          </p>
          {gpxStats.length > 0 && (
            <p className="mt-1 font-mono text-[12px] tabular-nums text-accent-cyan">
              {gpxStats.join(" · ")}
            </p>
          )}
          {fit && <FitMetricGrid summary={fit} />}
          {imp.status === "failed" && imp.errorMessage && (
            <p className="mt-1 text-[12px] text-[rgba(255,140,120,0.8)]">
              {imp.errorMessage}
            </p>
          )}
          {imp.status === "uploaded" &&
            imp.fileType !== "gpx" &&
            imp.fileType !== "fit" && (
              <p className="mt-1 text-[12px] text-muted-foreground">
                Bestand bewaard · verwerking voor {imp.fileType.toUpperCase()}{" "}
                volgt
              </p>
            )}
        </div>
        <button
          type="button"
          onClick={() => del.mutate(imp.id)}
          disabled={del.isPending}
          className="shrink-0 font-mono text-[10px] text-muted-foreground transition hover:text-muted-foreground disabled:opacity-40"
        >
          wis
        </button>
      </div>
      {canSaveAsRoute && (
        <div className="mt-2.5 border-t border-border pt-2.5">
          {savedRoute ? (
            <p className="flex items-center gap-1.5 text-[12px] text-[rgba(140,230,170,0.9)]">
              <RouteIcon className="h-3.5 w-3.5" />
              Bewaard als route — terug te vinden bij je routes om nog eens te
              rijden.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() =>
                  saveRoute.mutate(
                    { importId: imp.id },
                    { onSuccess: () => setSavedRoute(true) },
                  )
                }
                disabled={saveRoute.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-accent-cyan/25 bg-accent-cyan/[0.06] px-3 py-1.5 text-[12px] font-medium text-accent-cyan transition hover:bg-accent-cyan/[0.12] disabled:opacity-40"
              >
                <RouteIcon className="h-3.5 w-3.5" />
                {saveRoute.isPending ? "Bezig…" : "Bewaar als route"}
              </button>
              {saveRoute.isError && (
                <p className="mt-1 text-[12px] text-[rgba(255,140,120,0.8)]">
                  {saveRoute.error instanceof Error
                    ? saveRoute.error.message
                    : "Kon route niet opslaan"}
                </p>
              )}
            </>
          )}
        </div>
      )}
      {roadStopsOf(imp.parsedSummary).length > 0 && (
        <StopsRow stops={roadStopsOf(imp.parsedSummary)} />
      )}
      {imp.status !== "failed" && <LinkRow imp={imp} sessions={sessions} />}
    </div>
  )
}

export function ActivityImportPanel() {
  const { data, isLoading } = useActivityImports()
  const { data: sessions } = useSessions(30)
  const upload = useUploadActivity()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const imports = data?.imports ?? []
  const sessionList = sessions ?? []

  async function onFile(file: File) {
    setError(null)
    setNotice(null)
    const isFit = file.name.toLowerCase().endsWith(".fit")
    // FIT is sent base64-encoded (binary), which inflates ~33%; the JSON body
    // cap is 12 MB, so hold FIT to 8 MB raw. Text formats keep the 11 MB cap.
    const maxBytes = isFit ? 8 * 1024 * 1024 : 11 * 1024 * 1024
    if (file.size > maxBytes) {
      setError(`Bestand te groot (max ${isFit ? 8 : 11} MB)`)
      return
    }
    // Serverfouten dragen een duidelijke Nederlandse uitleg (bv. "Dit
    // bestandstype wordt niet ondersteund") — toon die, nooit een codemelding.
    const onError = (e: unknown) => {
      // apiFetch geeft de ruwe responsetekst door; de server stuurt
      // {"error":"..."} met een Nederlandse uitleg — haal die eruit.
      let msg: string | null = null
      if (e instanceof Error && e.message) {
        try {
          const parsed = JSON.parse(e.message) as { error?: unknown }
          if (typeof parsed.error === "string") msg = parsed.error
        } catch {
          // geen JSON — val terug op de standaardmelding
        }
      }
      setError(msg ?? "Upload mislukt — probeer opnieuw")
    }
    // Eerlijke duplicaatmelding: hetzelfde bestand (ook hernoemd) wordt niet
    // opnieuw opgeslagen; samengevoegde ritten worden benoemd.
    const onSuccess = (r: {
      duplicate?: boolean
      message?: string
      import?: { dedupeStatus?: string | null }
    }) => {
      if (r.duplicate) {
        setNotice(
          r.message ??
            "Dit bestand is al geïmporteerd — het is niet opnieuw opgeslagen.",
        )
      } else if (r.import?.dedupeStatus === "merged_existing") {
        setNotice(
          "Deze rit bestond al (bijvoorbeeld via een gekoppeld platform) — de gegevens zijn samengevoegd, niet dubbel opgeslagen.",
        )
      }
    }
    if (isFit) {
      const buf = await file.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let binary = ""
      for (let i = 0; i < bytes.length; i++)
        binary += String.fromCharCode(bytes[i]!)
      const contentBase64 = btoa(binary)
      upload.mutate({ fileName: file.name, contentBase64 }, { onError, onSuccess })
      return
    }
    const content = await file.text()
    upload.mutate({ fileName: file.name, content }, { onError, onSuccess })
  }

  return (
    <section>
      <SectionLabel n="08" title="Activiteit importeren" />

      {/* Primary action — a full CTA instead of a small text link, so the main
          step of this panel is unmissable. */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          className="flex items-center gap-2 rounded-full bg-accent-cyan/90 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[color:var(--color-on-accent)] shadow-card transition hover:bg-accent-cyan disabled:opacity-50"
        >
          {upload.isPending ? "Uploaden…" : "Bestand uploaden"}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".gpx,.fit,.tcx,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onFile(f)
          e.target.value = ""
        }}
      />

      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
        FIT, GPX en TCX worden direct geanalyseerd — FIT en TCX bevatten ook je
        echte vermogen, hartslag en cadans. Hetzelfde bestand twee keer uploaden
        kan geen kwaad: duplicaten worden automatisch overgeslagen.
      </p>

      {error && (
        <p className="mt-2 text-[12px] text-[rgba(255,140,120,0.85)]">{error}</p>
      )}
      {notice && (
        <p className="mt-2 text-[12px] text-[rgba(245,200,110,0.9)]">{notice}</p>
      )}

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <div className="h-16 w-full animate-pulse rounded-xl bg-muted" />
        ) : imports.length > 0 ? (
          imports.map((imp) => (
            <ImportCard key={imp.id} imp={imp} sessions={sessionList} />
          ))
        ) : (
          <div className="rounded-xl border border-border bg-muted p-4 text-center">
            <p className="text-[12px] text-muted-foreground">
              Nog geen activiteiten geïmporteerd
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={upload.isPending}
              className="mt-2.5 rounded-lg border border-accent-cyan/30 bg-accent-cyan/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-accent-cyan transition hover:bg-accent-cyan/20 disabled:opacity-50"
            >
              {upload.isPending ? "Uploaden…" : "Importeer je eerste bestand"}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
