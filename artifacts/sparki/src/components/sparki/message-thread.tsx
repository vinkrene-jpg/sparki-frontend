// SPARKI_BUILD_01 F7 — herbruikbare berichten-UI met bijlagen.
//
// Wordt gebruikt door de clubberichten én de trainer↔sporter-lijn (coach_link).
// Toont berichten met bijlagen (afbeeldingspreview alléén via het beveiligde
// serve-endpoint, plus downloadknop), een ingetrokken bestand als eerlijke
// "niet meer beschikbaar"-staat (410), en een opstelvak met tekst, bestanden/
// afbeeldingen en links. Client-side voorcontrole op type/grootte, maar de
// server blijft de waarheid: een serverweigering tonen we als nette melding.

import { useEffect, useState } from "react"
import { Paperclip, Link2, X, Download, ImageOff, FileText, Send } from "lucide-react"
import { apiFetchBlob } from "@/lib/api"
import type { MessageAttachment } from "@/hooks/use-club"

// Client-side voorcontrole — een vriendelijke eerste zeef. De server sniff't de
// echte inhoud en blijft de waarheid; dit voorkomt alleen onnodige uploads.
const MAX_FILE_BYTES = 25 * 1024 * 1024 // gelijk aan FILES_MAX_UPLOAD_BYTES-default
const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]

export type PendingFile = { base64: string; name: string; sizeBytes: number; isImage: boolean }
export type PendingLink = { url: string; title: string | null }

function fmtBytes(n: number | null): string {
  if (n == null) return ""
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} kB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

// Afbeeldingspreview: haalt de bytes op via het beveiligde serve-endpoint en
// maakt er een lokale object-URL van. Nooit een <img src=…> rechtstreeks op het
// endpoint (dat serveert als download). Ingetrokken/geweigerd ⇒ eerlijke staat.
function SecureImage({ url, alt }: { url: string; alt: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    let revoked = false
    let created: string | null = null
    setError(null)
    setObjectUrl(null)
    apiFetchBlob(url)
      .then((blob) => {
        if (revoked) return
        created = URL.createObjectURL(blob)
        setObjectUrl(created)
      })
      .catch((e: Error & { status?: number }) => {
        if (revoked) return
        setError(
          e.status === 410
            ? "Deze afbeelding is ingetrokken en niet meer beschikbaar."
            : "De afbeelding kon niet geladen worden.",
        )
      })
    return () => {
      revoked = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [url])
  if (error)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-white/45">
        <ImageOff className="h-3.5 w-3.5" strokeWidth={1.75} /> {error}
      </div>
    )
  if (!objectUrl)
    return <div className="h-32 w-full max-w-[220px] animate-pulse rounded-lg bg-white/[0.05]" />
  return (
    <img
      src={objectUrl}
      alt={alt}
      className="max-h-56 max-w-full rounded-lg border border-white/[0.08] object-contain"
    />
  )
}

// Downloadknop: haalt de bytes met auth op en biedt ze als bestand aan. Zo blijft
// het serve-endpoint de enige poort (rechten + intrekking) en downloadt de
// browser nooit rechtstreeks vanaf een raw URL.
function DownloadButton({ url, name }: { url: string; name: string | null }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const doDownload = async () => {
    setBusy(true)
    setError(null)
    try {
      const blob = await apiFetchBlob(url)
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = objectUrl
      a.download = name ?? "bijlage"
      a.click()
      URL.revokeObjectURL(objectUrl)
    } catch (e) {
      const err = e as Error & { status?: number }
      setError(
        err.status === 410
          ? "Dit bestand is ingetrokken en niet meer beschikbaar."
          : "Downloaden is niet gelukt.",
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <button
        type="button"
        onClick={() => void doDownload()}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] px-2.5 py-1 text-[12px] text-white/70 hover:bg-white/[0.05] disabled:opacity-40"
      >
        <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
        {busy ? "Bezig…" : "Download"}
      </button>
      {error && <p className="mt-1 text-[11px] text-red-300/80">{error}</p>}
    </div>
  )
}

// Eén bijlage in een gelezen bericht.
function AttachmentView({
  att,
  canRevoke,
  onRevoke,
}: {
  att: MessageAttachment
  canRevoke: boolean
  onRevoke?: (attachmentId: number) => void
}) {
  if (att.kind === "link")
    return (
      <a
        href={att.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-cyan-200/85 hover:bg-white/[0.06]"
      >
        <Link2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        <span className="truncate max-w-[220px]">{att.title || att.url}</span>
      </a>
    )
  // Bestand/afbeelding. Ingetrokken ⇒ eerlijke staat, geen preview/download.
  if (att.revoked)
    return (
      <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-white/40">
        <ImageOff className="h-3.5 w-3.5" strokeWidth={1.75} />
        {att.name ? `“${att.name}” is` : "Deze bijlage is"} ingetrokken en niet meer beschikbaar.
      </div>
    )
  return (
    <div className="space-y-1.5">
      {att.kind === "afbeelding" ? (
        <SecureImage url={att.url} alt={att.name ?? "afbeelding"} />
      ) : (
        <div className="flex items-center gap-1.5 text-[12px] text-white/60">
          <FileText className="h-3.5 w-3.5 text-white/40" strokeWidth={1.75} />
          <span className="truncate max-w-[220px]">{att.name ?? "bestand"}</span>
          {att.sizeBytes != null && <span className="text-white/30">· {fmtBytes(att.sizeBytes)}</span>}
        </div>
      )}
      <div className="flex items-center gap-2">
        <DownloadButton url={att.url} name={att.name} />
        {canRevoke && onRevoke && (
          <button
            type="button"
            onClick={() => onRevoke(att.id)}
            className="text-[11px] text-white/40 underline-offset-2 hover:text-white/70 hover:underline"
          >
            Intrekken
          </button>
        )}
      </div>
    </div>
  )
}

export type ThreadMessage = {
  id: number
  authorClerkId: string
  authorName?: string | null
  body: string
  read: boolean
  createdAt: string
  attachments: MessageAttachment[]
}

// De opstelbalk met bijlagen + links. Geeft een genormaliseerde payload terug.
export function MessageComposer({
  placeholder,
  disabled,
  sending,
  serverError,
  onSend,
}: {
  placeholder: string
  disabled?: boolean
  sending?: boolean
  serverError?: string | null
  onSend: (payload: {
    body: string
    files: PendingFile[]
    links: PendingLink[]
  }) => void
}) {
  const [body, setBody] = useState("")
  const [files, setFiles] = useState<PendingFile[]>([])
  const [links, setLinks] = useState<PendingLink[]>([])
  const [linkDraft, setLinkDraft] = useState("")
  const [clientError, setClientError] = useState<string | null>(null)

  const canSend =
    !disabled && !sending && (body.trim().length > 0 || files.length > 0 || links.length > 0)

  const addFiles = async (list: FileList | null) => {
    if (!list) return
    setClientError(null)
    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE_BYTES) {
        setClientError(`“${file.name}” is te groot (maximaal 25 MB).`)
        continue
      }
      if (file.type && !ALLOWED_MIME.includes(file.type)) {
        setClientError(
          "Alleen afbeeldingen (JPEG, PNG, WEBP, HEIC) en PDF kunnen mee. Andere types worden geweigerd.",
        )
        continue
      }
      const base64 = await fileToBase64(file)
      setFiles((prev) => [
        ...prev,
        { base64, name: file.name, sizeBytes: file.size, isImage: file.type.startsWith("image/") },
      ])
    }
  }

  const addLink = () => {
    const u = linkDraft.trim()
    if (!u) return
    if (!/^https?:\/\//i.test(u)) {
      setClientError("Een link moet met http:// of https:// beginnen.")
      return
    }
    setLinks((prev) => [...prev, { url: u, title: null }])
    setLinkDraft("")
    setClientError(null)
  }

  const submit = () => {
    if (!canSend) return
    onSend({ body: body.trim(), files, links })
  }

  return (
    <div className="mt-2 space-y-2">
      {(files.length > 0 || links.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <span
              key={`f${i}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.12] bg-white/[0.04] px-2 py-1 text-[11px] text-white/70"
            >
              {f.name}
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                aria-label="Bijlage verwijderen"
              >
                <X className="h-3 w-3" strokeWidth={2} />
              </button>
            </span>
          ))}
          {links.map((l, i) => (
            <span
              key={`l${i}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/25 bg-cyan-300/[0.06] px-2 py-1 text-[11px] text-cyan-200/85"
            >
              <Link2 className="h-3 w-3" strokeWidth={1.75} />
              <span className="max-w-[160px] truncate">{l.url}</span>
              <button
                type="button"
                onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
                aria-label="Link verwijderen"
              >
                <X className="h-3 w-3" strokeWidth={2} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-lg border border-white/15 bg-transparent px-3 py-2 text-[13px] text-white/85 placeholder:text-white/30 focus:border-cyan-300/40 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              submit()
              setBody("")
              setFiles([])
              setLinks([])
            }
          }}
        />
        <label
          className="flex cursor-pointer items-center rounded-lg border border-white/15 px-2.5 text-white/60 hover:border-white/30"
          title="Bestand of afbeelding toevoegen"
        >
          <Paperclip className="h-4 w-4" strokeWidth={1.75} />
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              void addFiles(e.target.files)
              e.target.value = ""
            }}
          />
        </label>
        <button
          type="button"
          disabled={!canSend}
          onClick={() => {
            submit()
            setBody("")
            setFiles([])
            setLinks([])
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-300/40 bg-cyan-300/10 px-3 py-2 text-[12px] text-cyan-200 disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" strokeWidth={1.75} />
          Plaats
        </button>
      </div>

      <div className="flex gap-2">
        <input
          value={linkDraft}
          onChange={(e) => setLinkDraft(e.target.value)}
          placeholder="Link toevoegen (https://…)"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-transparent px-3 py-1.5 text-[12px] text-white/70 placeholder:text-white/25 focus:border-cyan-300/30 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              addLink()
            }
          }}
        />
        <button
          type="button"
          onClick={addLink}
          className="rounded-lg border border-white/12 px-2.5 py-1.5 text-[12px] text-white/55 hover:border-white/30"
        >
          Link
        </button>
      </div>

      {clientError && <p className="text-[11px] text-amber-200/85">{clientError}</p>}
      {serverError && <p className="text-[11px] text-red-300/85">{serverError}</p>}
    </div>
  )
}

// Eén bericht met zijn bijlagen.
export function MessageBubble({
  message,
  mine,
  currentClerkId,
  onRevoke,
  onSeen,
}: {
  message: ThreadMessage
  mine: boolean
  currentClerkId: string | null
  onRevoke?: (attachmentId: number) => void
  onSeen?: () => void
}) {
  const canRevoke = message.authorClerkId === currentClerkId
  return (
    <div
      className={`rounded-xl border px-3.5 py-3 backdrop-blur-md ${
        message.read ? "border-white/[0.08]" : "border-cyan-300/25"
      } bg-[#070d16]/[0.82]`}
      onClick={() => {
        if (!message.read && onSeen) onSeen()
      }}
    >
      <p className="text-[11px] text-white/40">
        {message.authorName ?? (mine ? "Jij" : "Verstuurd")} ·{" "}
        {new Date(message.createdAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}
        {!message.read && <span className="ml-1.5 text-cyan-300/85">nieuw</span>}
      </p>
      {message.body && (
        <p className="mt-0.5 whitespace-pre-wrap text-[13px] text-white/85">{message.body}</p>
      )}
      {message.attachments.length > 0 && (
        <div className="mt-2 space-y-2">
          {message.attachments.map((att) => (
            <AttachmentView
              key={att.id}
              att={att}
              canRevoke={canRevoke}
              onRevoke={onRevoke}
            />
          ))}
        </div>
      )}
    </div>
  )
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  let binary = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}
