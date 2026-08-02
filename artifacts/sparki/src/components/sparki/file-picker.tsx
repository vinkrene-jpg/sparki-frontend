import { useId, useRef } from "react"
import { Paperclip } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"

// F11 — gedeelde FilePicker. Eén plek met een verborgen <input type="file"> +
// lichte client-validatie (type + grootte) vóór de upload. De ECHTE poort blijft
// de server (registerFile: magic-byte-sniff, her-encoding, groottelimiet); deze
// validatie is alleen een vriendelijke voorcontrole zodat de renner niet voor
// niets uploadt. Toegankelijkheid (spec §4): elke knop draagt een expliciet
// aria-label en het verborgen input-veld heeft schermlezertekst.

// Standaardwhitelist gelijk aan de centrale poort: afbeeldingen + PDF.
export const DEFAULT_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
export const DEFAULT_MAX_BYTES = 25 * 1024 * 1024 // 25 MB, gelijk aan FILES_MAX_UPLOAD_BYTES

export type FilePickerProps = {
  onPick: (files: File[]) => void
  // Kommagescheiden accept-lijst; standaard afbeeldingen + PDF.
  accept?: string
  multiple?: boolean
  // Camera direct openen (mobiel) i.p.v. de bestandskiezer.
  capture?: "user" | "environment"
  maxBytes?: number
  disabled?: boolean
  // Zichtbaar label + schermlezertekst voor de knop.
  label?: string
  ariaLabel: string
  // Vriendelijke reden waarom een bestand lokaal is geweigerd (optioneel).
  onReject?: (reason: string) => void
  className?: string
  children?: React.ReactNode
}

function bytesLabel(n: number): string {
  return `${Math.round(n / (1024 * 1024))} MB`
}

export function FilePicker({
  onPick,
  accept = DEFAULT_ACCEPT,
  multiple = false,
  capture,
  maxBytes = DEFAULT_MAX_BYTES,
  disabled = false,
  label,
  ariaLabel,
  onReject,
  className,
  children,
}: FilePickerProps) {
  const ref = useRef<HTMLInputElement>(null)
  const inputId = useId()

  const acceptTypes = accept
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean)

  const validate = (file: File): string | null => {
    if (file.size > maxBytes) {
      return `"${file.name}" is groter dan ${bytesLabel(maxBytes)} en wordt niet geaccepteerd.`
    }
    const type = (file.type || "").toLowerCase()
    // Alleen controleren als een concreet MIME-type bekend is; wildcard-accept
    // (bv. "image/*") en lege types laten we door — de server beslist definitief.
    const hasWildcard = acceptTypes.some((t) => t.endsWith("/*"))
    if (type && !hasWildcard && acceptTypes.length > 0 && !acceptTypes.includes(type)) {
      return `"${file.name}" heeft een niet-ondersteund type. Toegestaan: afbeeldingen en PDF.`
    }
    return null
  }

  const handle = (list: FileList | null) => {
    if (!list || list.length === 0) return
    const accepted: File[] = []
    for (const file of Array.from(list)) {
      const reason = validate(file)
      if (reason) {
        onReject?.(reason)
        continue
      }
      accepted.push(file)
    }
    if (accepted.length > 0) onPick(accepted)
  }

  return (
    <>
      <input
        id={inputId}
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        {...(capture ? { capture } : {})}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          handle(e.target.files)
          e.target.value = ""
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={disabled}
        aria-label={ariaLabel}
        className={
          className ??
          "flex h-9 items-center gap-2 rounded-lg border border-white/[0.1] px-3 text-white/55 transition-colors hover:border-cyan-300/30 hover:text-cyan-200 disabled:opacity-40"
        }
      >
        {children ?? (
          <>
            <Paperclip className="h-4 w-4" style={{ color: ACCENT }} aria-hidden="true" />
            {label ? <span className="text-sm">{label}</span> : null}
          </>
        )}
      </button>
    </>
  )
}
