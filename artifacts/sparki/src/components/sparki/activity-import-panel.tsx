import { useRef, useState } from "react"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import {
  useActivityImports,
  useUploadActivity,
  useDeleteActivityImport,
  type ActivityImport,
  type GpxSummary,
} from "@/hooks/use-activity-imports"

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
  return !!v && typeof v === "object" && "pointCount" in v
}

function fmtDuration(sec: number | null): string | null {
  if (sec == null) return null
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}u ${m}m` : `${m}m`
}

function ImportCard({ imp }: { imp: ActivityImport }) {
  const del = useDeleteActivityImport()
  const summary = isGpxSummary(imp.parsedSummary) ? imp.parsedSummary : null
  const stats: string[] = []
  if (summary) {
    if (summary.distanceKm != null) stats.push(`${summary.distanceKm} km`)
    const dur = fmtDuration(summary.durationSec)
    if (dur) stats.push(dur)
    if (summary.elevationGainM != null)
      stats.push(`${summary.elevationGainM} hm`)
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
            {summary?.trackName || imp.fileName}
          </p>
          {stats.length > 0 && (
            <p className="mt-1 font-mono text-[12px] tabular-nums text-cyan-300/80">
              {stats.join(" · ")}
            </p>
          )}
          {imp.status === "failed" && imp.errorMessage && (
            <p className="mt-1 text-[12px] text-[rgba(255,140,120,0.8)]">
              {imp.errorMessage}
            </p>
          )}
          {imp.status === "uploaded" && imp.fileType !== "gpx" && (
            <p className="mt-1 text-[12px] text-white/35">
              Bestand bewaard · verwerking voor {imp.fileType.toUpperCase()} volgt
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
    </div>
  )
}

export function ActivityImportPanel() {
  const { data, isLoading } = useActivityImports()
  const upload = useUploadActivity()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const imports = data?.imports ?? []

  async function onFile(file: File) {
    setError(null)
    if (file.size > 11 * 1024 * 1024) {
      setError("Bestand te groot (max 11 MB)")
      return
    }
    const content = await file.text()
    upload.mutate(
      { fileName: file.name, content },
      { onError: () => setError("Upload mislukt — probeer opnieuw") },
    )
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
        GPX wordt direct geanalyseerd (afstand, duur, hoogtemeters). FIT/TCX/CSV
        worden bewaard voor latere verwerking.
      </p>

      {error && (
        <p className="mt-2 text-[12px] text-[rgba(255,140,120,0.85)]">{error}</p>
      )}

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <div className="h-16 w-full animate-pulse rounded-xl bg-white/[0.06]" />
        ) : imports.length > 0 ? (
          imports.map((imp) => <ImportCard key={imp.id} imp={imp} />)
        ) : (
          <p className="text-[12px] text-white/30">
            Nog geen activiteiten geïmporteerd
          </p>
        )}
      </div>
    </section>
  )
}
