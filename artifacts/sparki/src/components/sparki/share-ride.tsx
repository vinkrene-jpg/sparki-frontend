import { useEffect, useState } from "react"
import { Share2, Copy, Check, ImageDown, Upload, ExternalLink } from "lucide-react"
import { ACCENT } from "@/components/sparki/ui"
import type { TrainingSession } from "@/lib/athlete-types"
import { useShareInfo, useShareToStrava } from "@/hooks/use-share"

// ── Statistiek-afbeelding met uitsluitend echte waarden ─────────────────────
// Donker Sparki-kaartje (1080×1080) getekend op een canvas. Alleen metingen
// die er echt zijn komen erop — ontbrekende cijfers blijven gewoon weg.
function drawShareImage(session: TrainingSession): HTMLCanvasElement {
  const size = 1080
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")!

  // Achtergrond: cinematografisch blauw-zwart verloop
  const bg = ctx.createLinearGradient(0, 0, 0, size)
  bg.addColorStop(0, "#0a1220")
  bg.addColorStop(1, "#05070e")
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)

  // Accentlijn boven
  ctx.fillStyle = "#7de3f4"
  ctx.fillRect(72, 96, 56, 6)

  // Datum
  const fullDate = new Date(session.sessionDate + "T12:00:00Z").toLocaleDateString(
    "nl-NL",
    { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  )
  ctx.fillStyle = "rgba(125,227,244,0.75)"
  ctx.font = "500 30px Inter, system-ui, sans-serif"
  ctx.fillText(fullDate.toUpperCase(), 72, 172)

  // Titel (max 2 regels)
  ctx.fillStyle = "rgba(255,255,255,0.95)"
  ctx.font = "200 76px Inter, system-ui, sans-serif"
  const title = session.title?.trim() || "Rit"
  const words = title.split(" ")
  let line = ""
  let y = 268
  for (const w of words) {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > size - 144 && line) {
      ctx.fillText(line, 72, y)
      line = w
      y += 88
      if (y > 268 + 88) break
    } else line = test
  }
  if (line && y <= 268 + 88) ctx.fillText(line, 72, y)

  // Metingen — alleen echte waarden
  const stats: Array<[string, string]> = []
  if (session.distanceKm != null && session.distanceKm !== "")
    stats.push([`${session.distanceKm}`, "km"])
  if (session.durationMin != null) {
    const h = Math.floor(session.durationMin / 60)
    const m = session.durationMin % 60
    stats.push([h > 0 ? `${h}u${String(m).padStart(2, "0")}` : `${m}`, h > 0 ? "" : "min"])
  }
  if (session.elevationM != null) stats.push([`${session.elevationM}`, "hoogtemeters"])
  if (session.avgPower != null) stats.push([`${session.avgPower}`, "W gem."])
  if (session.avgHR != null) stats.push([`${session.avgHR}`, "bpm gem."])

  let sy = 520
  for (const [value, unit] of stats.slice(0, 5)) {
    ctx.fillStyle = "rgba(255,255,255,0.92)"
    ctx.font = "300 68px Inter, system-ui, sans-serif"
    ctx.fillText(value, 72, sy)
    if (unit) {
      const w = ctx.measureText(value).width
      ctx.fillStyle = "rgba(255,255,255,0.45)"
      ctx.font = "400 30px Inter, system-ui, sans-serif"
      ctx.fillText(unit, 72 + w + 20, sy)
    }
    sy += 96
  }

  // Merk onderaan
  ctx.fillStyle = "rgba(125,227,244,0.9)"
  ctx.font = "600 34px Inter, system-ui, sans-serif"
  ctx.fillText("SPARKI", 72, size - 84)

  return canvas
}

async function shareImageBlob(session: TrainingSession): Promise<Blob | null> {
  const canvas = drawShareImage(session)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"))
}

export function ShareRidePanel({
  session,
  open,
}: {
  session: TrainingSession
  open: boolean
}) {
  const { data: info, isLoading, isError } = useShareInfo(open ? session.id : null)
  const strava = useShareToStrava()
  const [text, setText] = useState("")
  const [copied, setCopied] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)

  // Voorstel-tekst laden zodra hij binnenkomt; renner mag hem aanpassen.
  useEffect(() => {
    if (info?.text) setText(info.text)
  }, [info?.text])
  useEffect(() => {
    setShareError(null)
    strava.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id])

  const canNativeShare = typeof navigator !== "undefined" && !!navigator.share

  const doShare = async () => {
    setShareError(null)
    try {
      const blob = await shareImageBlob(session)
      const file =
        blob != null ? new File([blob], "rit-sparki.png", { type: "image/png" }) : null
      if (
        file &&
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({ text, files: [file] })
      } else if (canNativeShare) {
        await navigator.share({ text })
      }
    } catch (err) {
      // Annuleren is geen fout; echte fouten eerlijk melden.
      if (err instanceof DOMException && err.name === "AbortError") return
      setShareError("Delen is niet gelukt via het deelmenu.")
    }
  }

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setShareError("Kopiëren is niet gelukt.")
    }
  }

  const doDownloadImage = async () => {
    const blob = await shareImageBlob(session)
    if (!blob) {
      setShareError("Afbeelding maken is niet gelukt.")
      return
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "rit-sparki.png"
    a.click()
    URL.revokeObjectURL(url)
  }

  const btn =
    "inline-flex items-center gap-1.5 rounded-full border border-white/[0.14] px-3.5 py-2 font-mono text-[11px] tracking-wide text-white/80 transition-colors hover:border-white/30 hover:text-white disabled:opacity-40"

  return (
    <div className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-4">
      <span className="font-mono text-[10px] tracking-[0.2em] text-white/35">
        DEEL DEZE RIT
      </span>

      {isLoading && (
        <p className="mt-3 text-[13px] text-white/45">Deeltekst wordt opgesteld…</p>
      )}
      {isError && (
        <p className="mt-3 text-[13px] text-white/60">
          De deeltekst kon nu niet worden opgesteld. Probeer het later opnieuw.
        </p>
      )}

      {info && (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            className="mt-3 w-full resize-none rounded-lg border border-white/[0.1] bg-black/30 px-3 py-2.5 text-[13px] leading-relaxed text-white/90 outline-none focus:border-cyan-300/40"
            aria-label="Deeltekst"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            {canNativeShare && (
              <button type="button" onClick={doShare} className={btn} style={{ color: ACCENT, borderColor: "rgba(125,227,244,0.4)" }}>
                <Share2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                Delen…
              </button>
            )}
            <button type="button" onClick={doCopy} className={btn}>
              {copied ? (
                <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
              ) : (
                <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              {copied ? "Gekopieerd" : "Kopieer tekst"}
            </button>
            <button type="button" onClick={doDownloadImage} className={btn}>
              <ImageDown className="h-3.5 w-3.5" strokeWidth={1.75} />
              Afbeelding opslaan
            </button>
          </div>

          {/* Strava — officiële upload of eerlijke reden waarom niet */}
          <div className="mt-4 border-t border-white/[0.06] pt-3.5">
            {info.capabilities.strava.canUpload ? (
              strava.isSuccess ? (
                <a
                  href={strava.data.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-mono text-[12px] tracking-wide"
                  style={{ color: ACCENT }}
                >
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Staat op Strava — bekijk de rit
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    strava.mutate({ sessionId: session.id, description: text })
                  }
                  disabled={strava.isPending}
                  className={btn}
                >
                  <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {strava.isPending ? "Bezig met uploaden…" : "Zet op Strava"}
                </button>
              )
            ) : (
              <p className="text-[12px] leading-relaxed text-white/45">
                {info.capabilities.strava.reason}
              </p>
            )}
            {strava.isError && (
              <p className="mt-2 text-[12px] text-amber-300/80">
                {strava.error instanceof Error
                  ? strava.error.message
                  : "Uploaden naar Strava is niet gelukt."}
              </p>
            )}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-white/35">
            {info.capabilities.platformNote}
          </p>
          {shareError && (
            <p className="mt-2 text-[12px] text-amber-300/80">{shareError}</p>
          )}
        </>
      )}
    </div>
  )
}
