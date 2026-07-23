import { useState } from "react"
import {
  useRaceExports,
  useCreateRaceExport,
  downloadRaceExport,
  type RaceExportType,
} from "@/hooks/use-race-exports"

// Exportcentrum per wedstrijd: GPX (universeel), Garmin FIT Course
// (bevestigde punten als course points) en FIT Workout (alleen bij een echte
// warming-up of gekoppelde training). Historie toont versie + validatie;
// "verouderd" betekent eerlijk dat punten/route/gids na de export wijzigden.
// Wahoo/Karoo: alleen eerlijke uitleg — geen sync-knoppen.

const TYPE_ORDER: RaceExportType[] = ["gpx", "fit-course", "fit-workout"]

const TYPE_HELP: Record<RaceExportType, string> = {
  gpx: "Universeel routebestand met wedstrijdpunten als waypoints.",
  "fit-course": "Garmin-koersbestand: bevestigde punten verschijnen onderweg op het scherm.",
  "fit-workout": "Warming-up en wedstrijdopdracht als workoutbestand.",
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) +
    " " +
    d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })
}

export function RaceExportCenter({ raceId }: { raceId: number }) {
  const { data, isLoading } = useRaceExports(raceId)
  const create = useCreateRaceExport(raceId)
  const [busyType, setBusyType] = useState<RaceExportType | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  if (isLoading || !data) {
    return (
      <section>
        <h3 className="text-[13px] font-semibold tracking-wide text-white/80">
          Export naar fietscomputer
        </h3>
        <p className="mt-1 text-[11px] text-white/35">Laden…</p>
      </section>
    )
  }

  async function makeExport(type: RaceExportType) {
    setBusyType(type)
    setMessage(null)
    setError(null)
    try {
      const res = await create.mutateAsync(type)
      await downloadRaceExport(raceId, res.export.id, res.export.fileName)
      setMessage(
        `${res.export.fileName} gemaakt (versie ${res.export.version}) en gedownload.` +
          (res.warnings.length > 0 ? ` Let op: ${res.warnings.join(" ")}` : ""),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export mislukt")
    } finally {
      setBusyType(null)
    }
  }

  async function redownload(exportId: number, fileName: string) {
    setError(null)
    try {
      await downloadRaceExport(raceId, exportId, fileName)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download mislukt")
    }
  }

  const blockedByRoute = !data.hasRoute
  const validationBlocked = data.validation != null && !data.validation.ok

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h3 className="text-[13px] font-semibold tracking-wide text-white/80">
          Export naar fietscomputer
        </h3>
        {data.exports.length > 0 && (
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="text-[11px] text-white/40 underline decoration-white/20 underline-offset-2 hover:text-white/60"
          >
            {showHistory ? "Verberg historie" : `Historie (${data.exports.length})`}
          </button>
        )}
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-white/35">
        Ieder bestand wordt vóór het downloaden gecontroleerd en teruggelezen.
        Alleen bevestigde of aangepaste wedstrijdpunten gaan mee.
      </p>

      {data.reconfirmCount > 0 && (
        <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-3">
          <p className="text-[12px] text-amber-200/90">
            Een nieuwe technische gids heeft {data.reconfirmCount} punt(en)
            gewijzigd. Herbevestig die eerst bij Wedstrijdpunten voordat je
            opnieuw exporteert.
          </p>
        </div>
      )}

      {blockedByRoute && (
        <p className="mt-3 text-[12px] text-white/45">
          Er is geen route met opgeslagen parcours gekoppeld — koppel eerst een
          route om te kunnen exporteren.
        </p>
      )}
      {!blockedByRoute && validationBlocked && (
        <div className="mt-3 rounded-xl border border-red-400/25 bg-red-400/[0.06] p-3">
          <p className="text-[12px] font-medium text-red-200/90">
            Export geblokkeerd door de controle vooraf:
          </p>
          <ul className="mt-1 list-disc pl-4 text-[11px] text-red-200/70">
            {data.validation!.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {!blockedByRoute &&
        data.validation != null &&
        data.validation.ok &&
        data.validation.warnings.length > 0 && (
          <ul className="mt-3 list-disc pl-4 text-[11px] text-amber-200/70">
            {data.validation.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}

      <div className="mt-3 space-y-2">
        {TYPE_ORDER.map((type) => {
          const disabled =
            busyType != null ||
            (type !== "fit-workout" &&
              (blockedByRoute || validationBlocked || data.reconfirmCount > 0)) ||
            (type === "fit-workout" && !data.hasWorkoutSource)
          return (
            <div
              key={type}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-[12px] font-medium text-white/80">
                  {data.types[type]}
                </p>
                <p className="mt-0.5 text-[11px] text-white/40">
                  {type === "fit-workout" && !data.hasWorkoutSource
                    ? "Geen warming-up of gekoppelde training — er valt geen workout te maken."
                    : TYPE_HELP[type]}
                </p>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => makeExport(type)}
                className="shrink-0 rounded-lg border border-cyan-400/40 px-3 py-1.5 text-[12px] text-cyan-300 transition-colors hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/25"
              >
                {busyType === type ? "Bezig…" : "Download"}
              </button>
            </div>
          )
        })}
      </div>

      {message && <p className="mt-2 text-[11px] text-emerald-300/80">{message}</p>}
      {error && <p className="mt-2 text-[11px] text-red-300/80">{error}</p>}

      {showHistory && data.exports.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {data.exports.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-[11px] text-white/70">
                  {e.fileName}
                </p>
                <p className="mt-0.5 text-[10px] text-white/35">
                  {formatDateTime(e.createdAt)} · v{e.version} ·{" "}
                  {e.roundTripOk ? "controle geslaagd" : "controle mislukt"}
                  {e.status === "verouderd" && e.staleReason
                    ? ` · ${e.staleReason}`
                    : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {e.status === "verouderd" && (
                  <span className="rounded-full border border-amber-400/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-amber-300/80">
                    verouderd
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => redownload(e.id, e.fileName)}
                  className="text-[11px] text-cyan-300/80 underline decoration-cyan-300/30 underline-offset-2 hover:text-cyan-200"
                >
                  Opnieuw
                </button>
              </div>
            </div>
          ))}
          <p className="text-[10px] leading-relaxed text-white/30">
            "Opnieuw" bouwt het bestand met de huidige punten en route — een
            verouderde registratie levert dus altijd de actuele inhoud.
          </p>
        </div>
      )}

      <p className="mt-3 text-[10px] leading-relaxed text-white/30">
        {data.deviceNote}
      </p>
    </section>
  )
}
