// Golf 28 — Publieke juridische pagina's (/privacy en /voorwaarden).
// De inhoud komt uit dezelfde bron als in de app (legal_documents via
// /api/legal/:kind) zodat store-links en de app nooit uiteenlopen.
// Deze pagina's zijn bewust publiek: app-stores vereisen een privacy-URL
// die zonder inloggen leesbaar is.

import { Link } from "wouter"
import { Zap } from "lucide-react"
import { useLegalDocument } from "@/hooks/use-account"

// Minimale, veilige markdown-weergave (alleen wat onze eigen teksten
// gebruiken: #/##-koppen, lijstjes, **vet**). Geen HTML-injectie: alles
// blijft React-tekst.
function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/\*\*(.+?)\*\*/g)
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={`${keyPrefix}-${i}`} className="font-semibold text-white/90">
        {part}
      </strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{part}</span>
    ),
  )
}

function MarkdownBody({ md }: { md: string }) {
  const lines = md.split("\n")
  const blocks: React.ReactNode[] = []
  let list: string[] = []

  const flushList = (key: string) => {
    if (list.length === 0) return
    blocks.push(
      <ul key={key} className="my-2 list-disc space-y-1 pl-5 text-white/65">
        {list.map((item, i) => (
          <li key={i}>{renderInline(item, `${key}-${i}`)}</li>
        ))}
      </ul>,
    )
    list = []
  }

  lines.forEach((raw, idx) => {
    const line = raw.trimEnd()
    const key = `l${idx}`
    if (line.startsWith("- ")) {
      list.push(line.slice(2))
      return
    }
    flushList(`ul-${idx}`)
    if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={key} className="mt-6 text-[15px] font-semibold text-white/90">
          {line.slice(3)}
        </h2>,
      )
    } else if (line.startsWith("# ")) {
      blocks.push(
        <h1 key={key} className="text-xl font-semibold text-white">
          {line.slice(2)}
        </h1>,
      )
    } else if (line.startsWith("*") && line.endsWith("*") && !line.startsWith("**")) {
      blocks.push(
        <p key={key} className="mt-1 text-[12px] italic text-white/45">
          {line.replace(/^\*|\*$/g, "")}
        </p>,
      )
    } else if (line.trim() === "") {
      // lege regel — spacing zit al in de blokken
    } else {
      blocks.push(
        <p key={key} className="mt-2 text-[13px] leading-relaxed text-white/65">
          {renderInline(line, key)}
        </p>,
      )
    }
  })
  flushList("ul-end")
  return <div>{blocks}</div>
}

export default function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  const { data: doc, isLoading, isError } = useLegalDocument(kind)

  return (
    <div className="min-h-screen bg-[#05070e] px-5 py-10">
      <div className="mx-auto max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-2 text-white/80">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-400/15">
            <Zap className="h-4 w-4 text-cyan-300" />
          </span>
          <span className="text-sm font-semibold tracking-wide">SPARKI</span>
        </Link>

        <div className="mt-8">
          {isLoading ? (
            <div className="h-40 animate-pulse rounded-xl bg-white/[0.06]" />
          ) : isError || !doc ? (
            <p className="text-[13px] text-white/60">
              Het document kon niet geladen worden. Probeer het straks opnieuw.
            </p>
          ) : (
            <>
              <MarkdownBody md={doc.bodyMd} />
              <p className="mt-8 text-[11px] text-white/35">
                Versie {doc.version}
                {doc.publishedAt
                  ? ` — gepubliceerd op ${new Date(doc.publishedAt).toLocaleDateString("nl-NL")}`
                  : ""}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
