import { FileText, File as FileIcon, ExternalLink } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"

// F11 — herbruikbare MediaPreview (uit de AttachmentView van SparkiInputCenter
// gelicht, zodat er één weergavecomponent is i.p.v. per-module ad-hoc previews).
// Afbeeldingen tonen als echte thumbnail (owner-gated geserveerd), PDF/overig als
// chip met downloadlink. Toegankelijkheid (spec §4): elke afbeelding krijgt
// alt-tekst en de downloadlink een expliciet aria-label.

export type MediaPreviewProps = {
  // De owner-gated serve-URL (via attachmentUrl / journeyMediaUrl).
  url: string
  name: string
  // "image"/"photo" ⇒ thumbnail; "pdf"/"file"/overig ⇒ chip.
  kind: "image" | "photo" | "pdf" | "file" | string
  size?: number | null
  className?: string
}

function bytesLabel(size: number | null | undefined): string {
  if (size == null) return ""
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} kB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function MediaPreview({ url, name, kind, size, className }: MediaPreviewProps) {
  const isImage = kind === "image" || kind === "photo"
  if (isImage) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open afbeelding ${name} in een nieuw tabblad`}
        className={
          className ??
          "block overflow-hidden rounded-xl border border-white/[0.1]"
        }
      >
        <img
          src={url}
          alt={name}
          loading="lazy"
          className="max-h-64 w-full object-cover"
        />
      </a>
    )
  }
  const Icon = kind === "pdf" ? FileText : FileIcon
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Download bestand ${name}`}
      className={
        className ??
        "group flex items-center gap-2.5 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 py-2.5 transition-colors hover:border-cyan-300/30"
      }
    >
      <Icon className="h-4 w-4 shrink-0" style={{ color: ACCENT }} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] text-white/80">{name}</span>
        {size != null && (
          <span className="block font-mono text-[10px] text-white/35">
            {bytesLabel(size)}
          </span>
        )}
      </span>
      <ExternalLink
        className="h-3 w-3 shrink-0 text-white/25 transition-colors group-hover:text-cyan-300/70"
        aria-hidden="true"
      />
    </a>
  )
}
