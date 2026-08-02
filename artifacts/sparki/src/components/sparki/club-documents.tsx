import { useState } from "react"
import { FileText, Download, Lock } from "lucide-react"
import {
  useClubDocuments,
  downloadClubDocument,
  type ClubDocumentRow,
} from "@/hooks/use-club"

// F8 — Clubdocumenten (weergave voor leden/ouders/trainers).
// Toont uitsluitend wat de server teruggeeft: de zichtbaarheid en de
// concept/gepubliceerd-status worden server-side afgedwongen. Downloaden loopt
// via het beveiligde serve-pad (rechten + zichtbaarheid + intrekking).

export const CLUB_DOC_CATEGORY_LABELS: Record<string, string> = {
  gedragscode: "Gedragscode",
  huisregels: "Huisregels",
  ouderafspraken: "Ouderafspraken",
  privacyinformatie: "Privacyinformatie",
  vertrouwenscontactpersoon: "Vertrouwenscontactpersoon",
  noodprocedures: "Noodprocedures",
  clubinstructies: "Clubinstructies",
  reglement: "Reglement",
  overig: "Overig",
}

export const CLUB_DOC_VISIBILITY_LABELS: Record<string, string> = {
  leden_en_ouders: "Leden en ouders",
  trainers_bestuur: "Trainers en bestuur",
}

function formatPublished(iso: string | null): string {
  if (!iso) return "nog niet gepubliceerd"
  return new Date(iso).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

const CARD = "rounded-xl border border-border bg-card px-3.5 py-3 backdrop-blur-md"
const EMPTY = "rounded-xl border border-border bg-card px-3.5 py-3 text-[12px] text-muted-foreground"

function DocumentRow({ clubId, doc }: { clubId: number; doc: ClubDocumentRow }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!doc.current) return null

  const onDownload = async () => {
    setBusy(true)
    setError(null)
    try {
      const ext = doc.current!.mediaType.includes("pdf") ? "pdf" : "bestand"
      await downloadClubDocument(clubId, doc.id, `${doc.title}.${ext}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Downloaden is niet gelukt.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 shrink-0 text-accent-cyan" />
            <p className="truncate text-[13px] text-foreground/85">{doc.title}</p>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {CLUB_DOC_CATEGORY_LABELS[doc.category] ?? doc.category}
            {" · versie "}
            {doc.current.versionNumber}
            {" · gepubliceerd "}
            {formatPublished(doc.current.publishedAt)}
          </p>
          {doc.visibility === "trainers_bestuur" && (
            <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[color:var(--color-warning)]">
              <Lock className="h-2.5 w-2.5" /> Alleen trainers en bestuur
            </p>
          )}
        </div>
        <button
          onClick={onDownload}
          disabled={busy}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-accent-cyan/40 bg-accent-cyan/10 px-2.5 py-1.5 text-[11px] text-accent-cyan disabled:opacity-40"
          data-testid={`download-clubdoc-${doc.id}`}
        >
          <Download className="h-3 w-3" /> {busy ? "Bezig…" : "Openen"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-[11px] text-[color:var(--color-negative)]">{error}</p>}
    </div>
  )
}

// Publieke leeslijst voor leden/ouders/trainers. `clubId` is verplicht.
export function ClubDocumentsList({ clubId }: { clubId: number }) {
  const { data, isLoading, isError } = useClubDocuments(clubId)
  if (isLoading) {
    return <div className="h-16 animate-pulse rounded-xl bg-muted" />
  }
  if (isError) {
    return <p className={EMPTY}>Documenten zijn nu niet beschikbaar.</p>
  }
  // Alleen gepubliceerde documenten met een actieve versie (de server filtert
  // concepten al weg voor niet-beheer; extra defensief hier).
  const docs = (data?.documents ?? []).filter((d) => d.current != null)
  if (docs.length === 0) {
    return (
      <p className={EMPTY}>
        De club heeft nog geen documenten gepubliceerd. Zodra er een gedragscode,
        huisregels of andere afspraken zijn, verschijnen ze hier.
      </p>
    )
  }
  return (
    <div className="space-y-1.5" data-testid="clubdocumenten-lijst">
      {docs.map((doc) => (
        <DocumentRow key={doc.id} clubId={clubId} doc={doc} />
      ))}
    </div>
  )
}
