import { useRef, useState } from "react"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import {
  useDocumentAnalyses,
  useUploadDocument,
  useAnswerDocument,
  useLinkDocumentToRace,
  useDeleteDocumentAnalysis,
  fileToBase64,
  type DocumentAnalysis,
  type DocumentAnalysisKind,
} from "@/hooks/use-document-analyses"
import { useRaces } from "@/hooks/use-races"

const KIND_LABEL: Record<DocumentAnalysisKind, string> = {
  technische_gids: "Technische gids",
  wedstrijdgids: "Wedstrijdgids",
  etappeboek: "Etappeboek",
  routekaart: "Routekaart",
  tijdschema: "Tijdschema",
  onbekend: "Onbekend document",
}

const FIELD_LABEL: Record<string, string> = {
  eventName: "Naam wedstrijd",
  date: "Datum",
  startTime: "Starttijd",
  startLocation: "Startlocatie",
  finishLocation: "Finishlocatie",
  distanceKm: "Afstand (km)",
  elevationM: "Hoogtemeters",
  stageType: "Type rit",
  feeding: "Bevoorrading",
  timeSchedule: "Tijdschema",
  specialNotes: "Bijzonderheden",
}

// Which missing field a follow-up question maps to, so an inline answer box can
// post the right key back. Mirrors the backend question templates.
const QUESTION_FIELD: { match: string; key: string }[] = [
  { match: "hoe heet", key: "eventName" },
  { match: "welke datum", key: "date" },
  { match: "hoe laat", key: "startTime" },
  { match: "waar is de start", key: "startLocation" },
  { match: "waar is de finish", key: "finishLocation" },
  { match: "hoeveel kilometer", key: "distanceKm" },
  { match: "hoeveel hoogtemeters", key: "elevationM" },
  { match: "type rit", key: "stageType" },
  { match: "bevoorrading", key: "feeding" },
  { match: "tijdschema", key: "timeSchedule" },
  { match: "bijzonderheden", key: "specialNotes" },
]

function questionToFieldKey(q: string): string | null {
  const lower = q.toLowerCase()
  for (const { match, key } of QUESTION_FIELD) {
    if (lower.includes(match)) return key
  }
  return null
}

function fmtValue(key: string, value: string): string {
  if (key === "distanceKm") return `${value} km`
  if (key === "elevationM") return `${value} hm`
  return value
}

function AnalysisCard({ analysis }: { analysis: DocumentAnalysis }) {
  const answer = useAnswerDocument()
  const link = useLinkDocumentToRace()
  const del = useDeleteDocumentAnalysis()
  const { data: races } = useRaces()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [raceSel, setRaceSel] = useState<string>("")

  const fields = analysis.extractedFields ?? {}
  const found = analysis.foundFields ?? []
  const missing = analysis.missingFields ?? []
  const questions = analysis.followUpQuestions ?? []

  if (analysis.status === "failed") {
    return (
      <div className="rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] p-3.5 backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[rgba(255,120,110,0.95)]">
              Mislukt
            </span>
            <p className="mt-1 truncate text-[13px] font-medium text-white/85">
              {analysis.fileName}
            </p>
            <p className="mt-1 text-[12px] text-[rgba(255,140,120,0.8)]">
              {analysis.errorMessage}
            </p>
          </div>
          <button
            type="button"
            onClick={() => del.mutate(analysis.id)}
            disabled={del.isPending}
            className="shrink-0 font-mono text-[10px] text-white/30 transition hover:text-white/60 disabled:opacity-40"
          >
            wis
          </button>
        </div>
      </div>
    )
  }

  const linkedRace = races?.find((r) => r.id === analysis.linkedRaceId)

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] p-3.5 backdrop-blur-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-[9px] uppercase tracking-[0.16em]"
              style={{ color: ACCENT }}
            >
              {KIND_LABEL[analysis.documentKind]}
            </span>
          </div>
          <p className="mt-1 truncate text-[13px] font-medium text-white/85">
            {analysis.fileName}
          </p>
          {analysis.summary && (
            <p className="mt-1 text-[12px] leading-relaxed text-white/45">
              {analysis.summary}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => del.mutate(analysis.id)}
          disabled={del.isPending}
          className="shrink-0 font-mono text-[10px] text-white/30 transition hover:text-white/60 disabled:opacity-40"
        >
          wis
        </button>
      </div>

      {/* Gevonden */}
      {found.length > 0 && (
        <div className="mt-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[rgba(140,230,170,0.85)]">
            Gevonden
          </p>
          <dl className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
            {found.map((key) => {
              const f = fields[key]
              if (!f || f.value == null) return null
              return (
                <div key={key} className="flex items-baseline justify-between gap-2">
                  <dt className="text-[11px] text-white/40">
                    {FIELD_LABEL[key] ?? key}
                  </dt>
                  <dd className="text-right text-[12px] text-white/80">
                    {fmtValue(key, f.value)}
                    {f.confidence === "low" && (
                      <span className="ml-1 text-[10px] text-[rgba(245,200,110,0.85)]">
                        ?
                      </span>
                    )}
                  </dd>
                </div>
              )
            })}
          </dl>
        </div>
      )}

      {/* Ontbreekt */}
      {missing.length > 0 && (
        <div className="mt-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[rgba(245,200,110,0.9)]">
            Ontbreekt nog
          </p>
          <p className="mt-1 text-[12px] text-white/45">
            {missing.map((k) => FIELD_LABEL[k] ?? k).join(" · ")}
          </p>
        </div>
      )}

      {/* Vervolgvragen */}
      {questions.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
            Nog even dit
          </p>
          {questions.map((q, i) => {
            const key = questionToFieldKey(q)
            return (
              <div key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2">
                <p className="text-[12px] text-white/70">{q}</p>
                {key && (
                  <div className="mt-1.5 flex gap-2">
                    <input
                      value={drafts[key] ?? ""}
                      onChange={(e) =>
                        setDrafts((d) => ({ ...d, [key]: e.target.value }))
                      }
                      placeholder="Jouw antwoord"
                      className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-[#05070e]/60 px-2 py-1 text-[12px] text-white/85 outline-none placeholder:text-white/25 focus:border-white/20"
                    />
                    <button
                      type="button"
                      disabled={!drafts[key]?.trim() || answer.isPending}
                      onClick={() => {
                        const value = drafts[key]?.trim()
                        if (!value) return
                        answer.mutate(
                          { id: analysis.id, answers: { [key]: value } },
                          {
                            onSuccess: () =>
                              setDrafts((d) => {
                                const next = { ...d }
                                delete next[key]
                                return next
                              }),
                          },
                        )
                      }}
                      className="shrink-0 rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition disabled:opacity-40"
                      style={{ color: ACCENT, border: `1px solid ${ACCENT}` }}
                    >
                      ok
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Koppelen aan wedstrijd */}
      <div className="mt-3 border-t border-white/[0.06] pt-3">
        {linkedRace ? (
          <p className="text-[12px] text-[rgba(140,230,170,0.85)]">
            Gekoppeld aan: {linkedRace.name}
          </p>
        ) : (races?.length ?? 0) > 0 ? (
          <div className="flex gap-2">
            <select
              value={raceSel}
              onChange={(e) => setRaceSel(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-[#05070e]/60 px-2 py-1 text-[12px] text-white/85 outline-none focus:border-white/20"
            >
              <option value="">Koppel aan wedstrijd…</option>
              {races!.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · {r.raceDate}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!raceSel || link.isPending}
              onClick={() =>
                link.mutate({ id: analysis.id, raceId: Number(raceSel) })
              }
              className="shrink-0 rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] transition disabled:opacity-40"
              style={{ color: ACCENT, border: `1px solid ${ACCENT}` }}
            >
              koppel
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-white/30">
            Voeg eerst een wedstrijd toe om dit document te koppelen.
          </p>
        )}
      </div>
    </div>
  )
}

export function DocumentAnalysisPanel() {
  const { data, isLoading } = useDocumentAnalyses()
  const upload = useUploadDocument()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const analyses = data?.analyses ?? []

  async function onFile(file: File) {
    setError(null)
    if (file.size > 11 * 1024 * 1024) {
      setError("Bestand te groot (max 11 MB)")
      return
    }
    try {
      const dataB64 = await fileToBase64(file)
      upload.mutate(
        {
          fileName: file.name,
          mediaType: file.type || "application/octet-stream",
          data: dataB64,
        },
        { onError: () => setError("Lezen mislukt — probeer opnieuw") },
      )
    } catch {
      setError("Kon bestand niet lezen")
    }
  }

  return (
    <section>
      <SectionLabel n="09" title="Wedstrijdgids lezen" />

      {/* Primary action — a full CTA instead of a small text link, so the main
          step of this panel is unmissable. */}
      <div className="mt-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          className="flex items-center gap-2 rounded-full bg-cyan-400/90 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-[#05070e] shadow-[0_0_24px_rgba(34,211,238,0.25)] transition hover:bg-cyan-300 disabled:opacity-50"
        >
          {upload.isPending ? "Lezen…" : "Document uploaden"}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void onFile(f)
          e.target.value = ""
        }}
      />

      <p className="mt-2 text-[12px] leading-relaxed text-white/35">
        Upload een technische gids, wedstrijdgids, etappeboek, routekaart of
        tijdschema (PDF of foto). De kerninfo wordt eruit gehaald en er wordt
        doorgevraagd wat nog ontbreekt.
      </p>

      {error && (
        <p className="mt-2 text-[12px] text-[rgba(255,140,120,0.85)]">{error}</p>
      )}

      <div className="mt-4 space-y-3">
        {isLoading ? (
          <div className="h-16 w-full animate-pulse rounded-xl bg-white/[0.06]" />
        ) : analyses.length > 0 ? (
          analyses.map((a) => <AnalysisCard key={a.id} analysis={a} />)
        ) : (
          <p className="text-[12px] text-white/30">
            Nog geen documenten gelezen
          </p>
        )}
      </div>
    </section>
  )
}
