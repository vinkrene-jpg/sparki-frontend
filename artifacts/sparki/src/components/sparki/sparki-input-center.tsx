import { useRef, useState } from "react"
import {
  Send,
  Loader2,
  Paperclip,
  Camera,
  Link2,
  X,
  FileText,
  File as FileIcon,
  ExternalLink,
  BookOpen,
} from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import { SparkiCore } from "@/components/sparki/sparki-core"
import {
  useConversation,
  useSendMessage,
  uploadFile,
  kindForFile,
  attachmentUrl,
  type InputAttachment,
  type ConversationTurn,
} from "@/hooks/use-input-center"

// One central, reusable place where the athlete gives Sparki anything — a typed
// question, a photo from the camera, an image/PDF/file upload, or a pasted link.
// Everything is really stored (object storage, tied to the athlete) and the full
// conversation, including the uploaded items, stays visible across sessions.
// There are no scattered upload buttons elsewhere — this is the single composer.

type PendingAttachment = InputAttachment & { uploading?: boolean }

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/[0.06] ${className}`} />
}

function bytesLabel(size: number | null): string {
  if (size == null) return ""
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} kB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

// A single stored attachment rendered inside a conversation turn: images show as
// a real thumbnail (served owner-gated from storage), everything else as a chip
// with a download link.
function AttachmentView({ att }: { att: InputAttachment }) {
  const url = attachmentUrl(att.objectPath)
  if (att.kind === "image" || att.kind === "photo") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block overflow-hidden rounded-xl border border-white/[0.1]"
      >
        <img
          src={url}
          alt={att.name}
          loading="lazy"
          className="max-h-64 w-full object-cover"
        />
      </a>
    )
  }
  const Icon = att.kind === "pdf" ? FileText : FileIcon
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-2.5 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2.5 transition-colors hover:border-cyan-300/30"
    >
      <Icon className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] text-white/80">
          {att.name}
        </span>
        {att.size != null && (
          <span className="block font-mono text-[10px] text-white/35">
            {bytesLabel(att.size)}
          </span>
        )}
      </span>
      <ExternalLink className="h-3 w-3 shrink-0 text-white/25 transition-colors group-hover:text-cyan-300/70" />
    </a>
  )
}

function TurnView({ turn }: { turn: ConversationTurn }) {
  const isSparki = turn.role === "sparki"
  return (
    <div className="flex gap-3">
      <div className="shrink-0 pt-0.5">
        {isSparki ? (
          <SparkiCore size={30} accent={ACCENT} readiness={0.9} variant="orb" />
        ) : (
          <span
            className="flex h-[30px] w-[30px] items-center justify-center rounded-full border text-[11px] font-medium text-white/60"
            style={{
              borderColor: "rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.03)",
            }}
          >
            Jij
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: isSparki ? ACCENT : "rgba(255,255,255,0.4)" }}
        >
          {isSparki ? "Sparki" : "Jouw bericht"}
        </span>

        {turn.attachments && turn.attachments.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {turn.attachments.map((att) => (
              <AttachmentView key={att.objectPath} att={att} />
            ))}
          </div>
        )}

        {turn.link && (
          <a
            href={turn.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group mt-2 flex items-center gap-1.5 break-all text-[12px] text-cyan-200/80 transition-colors hover:text-cyan-100"
          >
            <Link2 className="h-3 w-3 shrink-0" />
            {turn.link}
          </a>
        )}

        {turn.text && (
          <p
            className={`mt-1.5 whitespace-pre-wrap text-pretty text-[13px] leading-relaxed ${
              isSparki ? "text-white/80" : "text-white/90"
            }`}
          >
            {turn.text}
          </p>
        )}

        {turn.sources && turn.sources.length > 0 && (
          <div className="mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-white/35">
              <BookOpen className="h-3 w-3" style={{ color: ACCENT }} />
              Bronnen
            </p>
            <ul className="mt-2 space-y-1.5">
              {turn.sources.map((s) => (
                <li key={s.id}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-1.5 text-[11px] leading-snug text-white/55 transition-colors hover:text-cyan-200/90"
                  >
                    <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-white/25 transition-colors group-hover:text-cyan-300/70" />
                    <span className="text-pretty">
                      {s.title}
                      {s.source ? (
                        <span className="text-white/30"> — {s.source}</span>
                      ) : null}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

export function SparkiInputCenter() {
  const { data, isLoading } = useConversation()
  const send = useSendMessage()

  const [text, setText] = useState("")
  const [pending, setPending] = useState<PendingAttachment[]>([])
  const [showLink, setShowLink] = useState(false)
  const [link, setLink] = useState("")
  const [error, setError] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const turns = data?.turns ?? []
  const uploading = pending.some((p) => p.uploading)
  const busy = send.isPending || uploading

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError(null)
    const list = Array.from(files)
    for (const file of list) {
      const kind = kindForFile(file)
      const placeholder: PendingAttachment = {
        objectPath: `pending-${file.name}-${Date.now()}-${Math.random()}`,
        name: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        kind,
        uploading: true,
      }
      setPending((prev) => [...prev, placeholder])
      try {
        const att = await uploadFile(file, kind)
        setPending((prev) =>
          prev.map((p) =>
            p.objectPath === placeholder.objectPath
              ? { ...att, uploading: false }
              : p,
          ),
        )
      } catch {
        setPending((prev) =>
          prev.filter((p) => p.objectPath !== placeholder.objectPath),
        )
        setError(`Uploaden van "${file.name}" is mislukt. Probeer het opnieuw.`)
      }
    }
  }

  const removePending = (objectPath: string) => {
    setPending((prev) => prev.filter((p) => p.objectPath !== objectPath))
  }

  const canSend =
    !busy &&
    (text.trim().length > 0 ||
      link.trim().length > 0 ||
      pending.some((p) => !p.uploading))

  const handleSend = async () => {
    if (!canSend) return
    setError(null)
    const attachments: InputAttachment[] = pending
      .filter((p) => !p.uploading)
      .map(({ uploading: _uploading, ...att }) => att)
    try {
      await send.mutateAsync({
        text: text.trim() || null,
        link: link.trim() || null,
        attachments,
      })
      setText("")
      setLink("")
      setShowLink(false)
      setPending([])
    } catch {
      setError("Sparki kon niet antwoorden. Probeer het opnieuw.")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* CONVERSATION */}
      <div className="flex flex-col gap-6">
        {isLoading && turns.length === 0 && (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-[30px] w-[30px] shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-4/5" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!isLoading && turns.length === 0 && (
          <div className="rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-5 backdrop-blur-md">
            <div className="mb-2 flex items-center gap-2">
              <SparkiCore size={26} accent={ACCENT} readiness={0.9} variant="orb" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/45">
                Begin hier
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-white/60">
              Geef Sparki een foto, afbeelding, PDF, bestand of link, of stel je
              vraag. Alles wat je deelt blijft hier bewaard, zodat Sparki je beter
              leert kennen.
            </p>
          </div>
        )}

        {turns.map((turn) => (
          <TurnView key={turn.id} turn={turn} />
        ))}

        {/* Thinking indicator while Sparki forms a reply */}
        {send.isPending && (
          <div className="flex gap-3">
            <SparkiCore size={30} accent={ACCENT} readiness={0.9} variant="orb" />
            <div className="flex-1 space-y-2 pt-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                Bezig…
              </span>
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-3.5 w-3/4" />
            </div>
          </div>
        )}
      </div>

      {/* COMPOSER */}
      <div className="sticky bottom-0 rounded-2xl border border-white/[0.1] bg-[#070d16]/[0.92] p-3 backdrop-blur-md">
        {/* Pending attachment chips */}
        {pending.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-2">
            {pending.map((p) => (
              <span
                key={p.objectPath}
                className="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.04] py-1.5 pl-2.5 pr-1.5 text-[11px] text-white/70"
              >
                {p.uploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: ACCENT }} />
                ) : p.kind === "image" || p.kind === "photo" ? (
                  <img
                    src={attachmentUrl(p.objectPath)}
                    alt={p.name}
                    className="h-5 w-5 rounded object-cover"
                  />
                ) : p.kind === "pdf" ? (
                  <FileText className="h-3.5 w-3.5" style={{ color: ACCENT }} />
                ) : (
                  <FileIcon className="h-3.5 w-3.5" style={{ color: ACCENT }} />
                )}
                <span className="max-w-[140px] truncate">{p.name}</span>
                <button
                  type="button"
                  onClick={() => removePending(p.objectPath)}
                  className="flex h-5 w-5 items-center justify-center rounded text-white/40 hover:text-white/80"
                  aria-label={`Verwijder ${p.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Optional link input */}
        {showLink && (
          <div className="mb-2.5 flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.03] px-2.5">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-white/40" />
            <input
              className="flex-1 bg-transparent py-2 text-[13px] text-white/90 placeholder:text-white/25 focus:outline-none"
              placeholder="Plak een link (Sparki kan deze zelf niet openen)"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              inputMode="url"
            />
            <button
              type="button"
              onClick={() => {
                setShowLink(false)
                setLink("")
              }}
              className="flex h-6 w-6 items-center justify-center rounded text-white/40 hover:text-white/80"
              aria-label="Link verwijderen"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {error && (
          <p className="mb-2 text-[11px] text-rose-300/80">{error}</p>
        )}

        <div className="flex items-end gap-2">
          {/* Hidden file/camera inputs */}
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,application/pdf,.gpx,.fit,.tcx,.csv,.txt,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files)
              e.target.value = ""
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files)
              e.target.value = ""
            }}
          />

          {/* Attach controls */}
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.1] text-white/55 transition-colors hover:border-cyan-300/30 hover:text-cyan-200 disabled:opacity-40"
              aria-label="Bestand toevoegen"
              title="Foto, afbeelding, PDF of bestand"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={busy}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.1] text-white/55 transition-colors hover:border-cyan-300/30 hover:text-cyan-200 disabled:opacity-40"
              aria-label="Foto maken"
              title="Foto maken met camera"
            >
              <Camera className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setShowLink((v) => !v)}
              disabled={busy}
              className="flex h-9 w-9 items-center justify-center rounded-lg border text-white/55 transition-colors hover:border-cyan-300/30 hover:text-cyan-200 disabled:opacity-40"
              style={{
                borderColor: showLink
                  ? "rgba(120,210,230,0.5)"
                  : "rgba(255,255,255,0.1)",
                color: showLink ? ACCENT : undefined,
              }}
              aria-label="Link toevoegen"
              title="Link plakken"
            >
              <Link2 className="h-4 w-4" />
            </button>
          </div>

          {/* Text composer */}
          <textarea
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-2.5 font-sans text-[14px] text-white/90 placeholder:text-white/25 focus:border-cyan-300/40 focus:outline-none"
            placeholder="Stel Sparki een vraag of beschrijf wat je deelt…"
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void handleSend()
              }
            }}
            disabled={send.isPending}
          />

          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!canSend}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-opacity disabled:opacity-35"
            style={{ background: ACCENT }}
            aria-label="Versturen naar Sparki"
          >
            {busy ? (
              <Loader2
                className="h-4 w-4 animate-spin"
                style={{ color: "#040506" }}
                strokeWidth={2.5}
              />
            ) : (
              <Send className="h-4 w-4" style={{ color: "#040506" }} strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
