// Global feedback & bug reporter, opened from the header on every screen.
// Plain Dutch, dark cinematic Sparki styling, top-anchored "Sluiten". Captures
// the current page + role automatically, lets the reporter choose a type
// (bug / idee / anders) and attach a REAL screenshot (uploaded to storage via
// the presigned-URL flow — never a pasted URL).

import { useRef, useState } from "react"
import { useLocation } from "wouter"
import { X, Bug, Lightbulb, MessageSquare, ImagePlus, Loader2 } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import { useUserProfile } from "@/contexts/UserContext"
import {
  useCreateBugReport,
  uploadBugScreenshot,
  type BugReportKind,
} from "@/hooks/use-bug-reports"

const KINDS: { key: BugReportKind; label: string; icon: typeof Bug }[] = [
  { key: "bug", label: "Bug", icon: Bug },
  { key: "idea", label: "Idee", icon: Lightbulb },
  { key: "other", label: "Anders", icon: MessageSquare },
]

const PLACEHOLDER: Record<BugReportKind, string> = {
  bug: "Wat ging er mis? Wat zag je gebeuren, en wat verwachtte je?",
  idea: "Welk idee heb je? Wat zou Sparki beter of slimmer kunnen doen?",
  other: "Waar wil je het over hebben?",
}

export function FeedbackSheet({ onClose }: { onClose: () => void }) {
  const [location] = useLocation()
  const { profile } = useUserProfile()
  const create = useCreateBugReport()
  const fileRef = useRef<HTMLInputElement>(null)

  const [kind, setKind] = useState<BugReportKind>("bug")
  const [description, setDescription] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const inputCls =
    "w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 placeholder-white/25 outline-none focus:border-cyan-300/40"

  function pickFile(f: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(f)
    setPreviewUrl(f ? URL.createObjectURL(f) : null)
  }

  async function submit() {
    if (description.trim().length < 3) {
      setError("Schrijf eerst even kort wat er aan de hand is.")
      return
    }
    setError(null)
    let screenshotObjectPath: string | null = null
    try {
      if (file) {
        setUploading(true)
        screenshotObjectPath = await uploadBugScreenshot(file)
      }
    } catch {
      setUploading(false)
      setError("De screenshot kon niet geüpload worden. Probeer het opnieuw of verstuur zonder.")
      return
    }
    setUploading(false)

    create.mutate(
      {
        description: description.trim(),
        kind,
        userRole: profile?.activeRole ?? null,
        pageUrl: typeof window !== "undefined" ? window.location.href : location,
        screenshotObjectPath,
      },
      {
        onSuccess: () => {
          setDone(true)
          setTimeout(onClose, 1500)
        },
        onError: (e) =>
          setError(e instanceof Error ? e.message : "Versturen mislukt."),
      },
    )
  }

  const busy = uploading || create.isPending

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Sluiten"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="relative z-10 w-full max-w-md rounded-t-3xl border border-white/[0.1] bg-[#070d16]/95 p-6 backdrop-blur-xl sm:rounded-3xl">
        {/* Top-anchored close — never exit-by-scroll. */}
        <div className="flex items-start justify-between">
          <div>
            <span className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/70">
              FEEDBACK & BUG MELDEN
            </span>
            <h2 className="mt-1 font-sans text-xl font-light tracking-tight text-white/90">
              Help Sparki beter worden
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/15 p-1.5 text-white/60 transition-colors hover:border-cyan-300/40 hover:text-cyan-300"
            aria-label="Sluiten"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="mt-6 rounded-xl border p-5 text-center"
            style={{ borderColor: "rgba(130,220,160,0.3)", background: "rgba(130,220,160,0.06)" }}>
            <p className="text-[14px] font-light text-white/90">
              Verstuurd — bedankt. Sparki neemt het mee.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {KINDS.map(({ key, label, icon: Icon }) => {
                const active = kind === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setKind(key)}
                    className="flex flex-col items-center gap-1.5 rounded-xl border py-3 transition-colors"
                    style={{
                      borderColor: active ? "rgba(120,210,230,0.5)" : "rgba(255,255,255,0.08)",
                      background: active ? "rgba(120,210,230,0.1)" : "rgba(255,255,255,0.02)",
                      color: active ? ACCENT : "rgba(255,255,255,0.55)",
                    }}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em]">{label}</span>
                  </button>
                )
              })}
            </div>

            <textarea
              className={`${inputCls} min-h-[110px] resize-none`}
              placeholder={PLACEHOLDER[kind]}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoFocus
            />

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            {previewUrl ? (
              <div className="flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-2.5">
                <img src={previewUrl} alt="" className="h-12 w-12 rounded object-cover" />
                <span className="flex-1 truncate text-[12px] text-white/55">{file?.name}</span>
                <button
                  type="button"
                  onClick={() => pickFile(null)}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/40 hover:text-white/70"
                >
                  Verwijderen
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-white/[0.14] py-3 text-[12px] text-white/45 transition-colors hover:border-cyan-300/30 hover:text-white/70"
              >
                <ImagePlus className="h-4 w-4" strokeWidth={1.75} />
                Screenshot toevoegen (optioneel)
              </button>
            )}

            <p className="text-[11px] leading-relaxed text-white/35">
              De pagina waar je nu bent en je rol worden automatisch meegestuurd.
            </p>

            {error && <p className="text-[12px] text-red-300/85">{error}</p>}

            <button
              type="button"
              onClick={submit}
              disabled={busy || description.trim().length < 3}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-black transition disabled:opacity-50"
              style={{ background: ACCENT }}
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {uploading ? "Screenshot uploaden…" : create.isPending ? "Versturen…" : "Versturen"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
