import { useRef, useState } from "react"
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
  parsed: "rgba(120,210,230,0.9)",
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
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-white/35">
            {m.label}
          </span>
          {m.value != null ? (
            <span className="font-mono text-[12px] tabular-nums text-cyan-300/80">
              {m.value}
            </span>
          ) : (
            <span className="font-mono text-[10px] italic text-white/25">
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
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
        <span className="min-w-0 truncate text-[12px] text-white/55">
          <span className="text-[rgba(140,230,170,0.9)]">Gekoppeld</span>
          {linkedSession ? ` · ${sessionLabel(linkedSession)}` : ""}
        </span>
        <button
          type="button"
          onClick={() => link.mutate({ id: imp.id, sessionId: null })}
          disabled={link.isPending}
          className="shrink-0 font-mono text-[10px] text-white/30 transition hover:text-white/60 disabled:opacity-40"
        >
          ontkoppel
        </button>
      </div>
    )
  }

  return (
    <div className="mt-2.5 border-t border-white/[0.06] pt-2.5">
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
        <p className="text-[12px] text-white/35">
          Nog geen trainingen om aan te koppelen — log eerst een training.
        </p>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[11px] text-white/35">
            Kies de bijbehorende training
            <button
              type="button"
              onClick={() => setPicking(false)}
              className="ml-2 font-mono text-[10px] text-white/30 transition hover:text-white/60"
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
              className="block w-full truncate rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-left text-[12px] text-white/70 transition hover:border-white/20 hover:text-white/90 disabled:opacity-40"
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
  const gpx = isGpxSummary(imp.parsedSummary) ? imp.parsedSummary : null
  const fit = isFitSummary(imp.parsedSummary) ? imp.parsedSummary : null
  const gpxStats: string[] = []
  if (gpx) {
    if (gpx.distanceKm != null) gpxStats.push(`${gpx.distanceKm} km`)
    const dur = fmtDuration(gpx.durationSec)
    if (dur) gpxStats.push(dur)
    if (gpx.elevationGainM != null) gpxStats.push(`${gpx.elevationGainM} hm`)
  }

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] p-3.5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-[9px] uppercase tracking-[0.16em]"
              style={{ color: STATUS_COLOR[imp.status] }}
            >
              {STATUS_LABEL[imp.status] ?? imp.status}
            </span>
            <span className="font-mono text-[9px] uppercase text-white/25">
              · {imp.fileType}
            </span>
          </div>
          <p className="mt-1 truncate text-[13px] font-medium text-white/85">
            {gpx?.trackName || imp.fileName}
          </p>
          {gpxStats.length > 0 && (
            <p className="mt-1 font-mono text-[12px] tabular-nums text-cyan-300/80">
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
              <p className="mt-1 text-[12px] text-white/35">
                Bestand bewaard · verwerking voor {imp.fileType.toUpperCase()}{" "}
                volgt
              </p>
            )}
        </div>
        <button
          type="button"
          onClick={() => del.mutate(imp.id)}
          disabled={del.isPending}
          className="shrink-0 font-mono text-[10px] text-white/30 transition hover:text-white/60 disabled:opacity-40"
        >
          wis
        </button>
      </div>
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

  const imports = data?.imports ?? []
  const sessionList = sessions ?? []

  async function onFile(file: File) {
    setError(null)
    const isFit = file.name.toLowerCase().endsWith(".fit")
    // FIT is sent base64-encoded (binary), which inflates ~33%; the JSON body
    // cap is 12 MB, so hold FIT to 8 MB raw. Text formats keep the 11 MB cap.
    const maxBytes = isFit ? 8 * 1024 * 1024 : 11 * 1024 * 1024
    if (file.size > maxBytes) {
      setError(`Bestand te groot (max ${isFit ? 8 : 11} MB)`)
      return
    }
    const onError = () => setError("Upload mislukt — probeer opnieuw")
    if (isFit) {
      const buf = await file.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let binary = ""
      for (let i = 0; i < bytes.length; i++)
        binary += String.fromCharCode(bytes[i]!)
      const contentBase64 = btoa(binary)
      upload.mutate({ fileName: file.name, contentBase64 }, { onError })
      return
    }
    const content = await file.text()
    upload.mutate({ fileName: file.name, content }, { onError })
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionLabel n="08" title="Activiteit importeren" />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          className="font-mono text-[10px] uppercase tracking-[0.18em] transition disabled:opacity-50"
          style={{ color: ACCENT }}
        >
          {upload.isPending ? "uploaden…" : "+ bestand"}
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

      <p className="mt-2 text-[12px] leading-relaxed text-white/35">
        GPX en FIT worden direct geanalyseerd — FIT bevat ook je echte vermogen,
        hartslag en cadans. TCX/CSV worden bewaard voor latere verwerking.
      </p>

      {error && (
        <p className="mt-2 text-[12px] text-[rgba(255,140,120,0.85)]">{error}</p>
      )}

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <div className="h-16 w-full animate-pulse rounded-xl bg-white/[0.06]" />
        ) : imports.length > 0 ? (
          imports.map((imp) => (
            <ImportCard key={imp.id} imp={imp} sessions={sessionList} />
          ))
        ) : (
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-center">
            <p className="text-[12px] text-white/40">
              Nog geen activiteiten geïmporteerd
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={upload.isPending}
              className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.16em] transition hover:opacity-80 disabled:opacity-50"
              style={{ color: ACCENT }}
            >
              {upload.isPending ? "uploaden…" : "+ importeer je eerste bestand"}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
