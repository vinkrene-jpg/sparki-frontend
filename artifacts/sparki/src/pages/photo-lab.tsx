import { useRef, useState, useEffect } from "react"
import { useLocation } from "wouter"
import { attachmentUrl } from "@/hooks/use-input-center"
import {
  useStylizePhoto,
  useChoosePhoto,
  type StylizeResponse,
} from "@/hooks/use-photo-style"

// Sparki Photo Lab — isolated, testable photo upload + "Sparki-style" edit flow.
// Reachable as a test surface only (no v0 layout / existing skin touched). The
// athlete uploads a real photo, sees it immediately, gets a Sparki-styled
// version beside it, and chooses what to keep. Honest by contract: if styling
// fails, the original stays usable. Mobile-first.

type Stage = "intro" | "working" | "review" | "kept"

const ACCENT = "oklch(0.82 0.16 200)"

export default function PhotoLabPage() {
  const [, navigate] = useLocation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [stage, setStage] = useState<Stage>("intro")
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [result, setResult] = useState<StylizeResponse | null>(null)
  const [kept, setKept] = useState<"original" | "sparki_style" | null>(null)
  const [error, setError] = useState<string | null>(null)

  const stylize = useStylizePhoto()
  const choose = useChoosePhoto()

  // Release the local object URL when it changes / on unmount.
  useEffect(() => {
    return () => {
      if (originalUrl) URL.revokeObjectURL(originalUrl)
    }
  }, [originalUrl])

  function reset() {
    setResult(null)
    setKept(null)
    setError(null)
    setStage("intro")
    if (originalUrl) URL.revokeObjectURL(originalUrl)
    setOriginalUrl(null)
  }

  function handlePick() {
    fileInputRef.current?.click()
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = "" // allow re-picking the same file
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setError("Kies een foto (afbeelding).")
      return
    }

    // Show the original immediately from a local URL — no upload round-trip.
    const localUrl = URL.createObjectURL(file)
    if (originalUrl) URL.revokeObjectURL(originalUrl)
    setOriginalUrl(localUrl)
    setError(null)
    setResult(null)
    setKept(null)
    setStage("working")

    try {
      const res = await stylize.mutateAsync(file)
      setResult(res)
      setStage("review")
    } catch (err) {
      // Upload itself failed — keep the original visible and let the user retry.
      setError(
        err instanceof Error && err.message
          ? "Uploaden lukte niet. Probeer het opnieuw."
          : "Uploaden lukte niet. Probeer het opnieuw.",
      )
      setStage("review")
    }
  }

  async function handleChoose(variant: "original" | "sparki_style") {
    if (!result) {
      // No persisted session (upload failed before a row existed) — still let the
      // user keep their original locally.
      if (variant === "original") {
        setKept("original")
        setStage("kept")
      }
      return
    }
    try {
      await choose.mutateAsync({ id: result.id, variant })
      setKept(variant)
      setStage("kept")
    } catch {
      setError("Opslaan van je keuze lukte niet. Probeer het opnieuw.")
    }
  }

  const styledFailed = result?.styleStatus === "failed"
  const styledSrc = result?.styledDataUrl
    ? result.styledDataUrl
    : result?.styledPath
      ? attachmentUrl(result.styledPath)
      : null

  return (
    <div className="min-h-dvh bg-[#05070e] text-white">
      {/* Top bar with an always-visible way back. */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/[0.06] bg-[#05070e]/85 px-4 py-3 backdrop-blur-md">
        <button
          type="button"
          onClick={() => navigate("/you")}
          className="flex items-center gap-1.5 text-sm text-white/70 transition hover:text-white"
        >
          <span aria-hidden>←</span> Terug
        </button>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300/60">
          Foto-lab · test
        </span>
        <span className="w-12" />
      </div>

      <div className="mx-auto w-full max-w-md px-4 pb-24 pt-6">
        <h1 className="text-xl font-semibold">Sparki-foto</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-white/55">
          Upload een foto. Sparki maakt er een rustige, donkere lab-versie van —
          dezelfde echte persoon, geen cartoon, geen vervorming. Jij kiest wat je
          houdt.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />

        {/* INTRO — nothing uploaded yet. */}
        {stage === "intro" && (
          <button
            type="button"
            onClick={handlePick}
            className="mt-6 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-6 py-12 text-center transition hover:border-cyan-300/40 hover:bg-white/[0.05]"
          >
            <span className="text-3xl" aria-hidden>
              ↑
            </span>
            <span className="text-sm font-medium text-white/85">
              Kies een foto
            </span>
            <span className="text-xs text-white/45">
              Vanaf je telefoon of camera
            </span>
          </button>
        )}

        {stage === "intro" && (
          <p className="mt-3 text-[11px] leading-relaxed text-white/35">
            Sparki verwerkt je foto met zijn beeldtechniek. Hiervoor wordt geen
            eigen sleutel gebruikt; de verwerking gaat via Sparki en telt mee in
            je tegoed.
          </p>
        )}

        {error && stage !== "working" && (
          <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-amber-100/90">
            {error}
          </p>
        )}

        {/* ORIGINAL preview — shown as soon as a file is chosen. */}
        {originalUrl && stage !== "intro" && (
          <div className="mt-6 space-y-5">
            <figure>
              <figcaption className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                Origineel
              </figcaption>
              <img
                src={originalUrl}
                alt="Jouw originele foto"
                className="w-full rounded-2xl border border-white/8 object-cover"
              />
            </figure>

            {/* SPARKI version — working / styled / honest failure. */}
            <figure>
              <figcaption className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300/70">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: ACCENT }}
                />
                Sparki-versie
              </figcaption>

              {stage === "working" && (
                <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-2xl border border-cyan-300/15 bg-[#070d16]/80">
                  <span
                    className="h-7 w-7 animate-spin rounded-full border-2 border-white/15"
                    style={{ borderTopColor: ACCENT }}
                  />
                  <span className="text-sm text-white/60">
                    Sparki bewerkt je foto…
                  </span>
                </div>
              )}

              {stage !== "working" && styledSrc && (
                <img
                  src={styledSrc}
                  alt="De Sparki-versie van je foto"
                  className="w-full rounded-2xl border border-cyan-300/25 object-cover shadow-[0_0_40px_rgba(120,210,230,0.12)]"
                />
              )}

              {stage !== "working" && !styledSrc && (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] px-4 py-5">
                  <p className="text-sm leading-relaxed text-amber-100/90">
                    {result?.failureReason ??
                      "Sparki kon de sfeer nu niet toepassen. Je originele foto blijft bruikbaar."}
                  </p>
                </div>
              )}
            </figure>
          </div>
        )}

        {/* REVIEW — choose what to keep / re-upload. */}
        {stage === "review" && (
          <div className="mt-6 flex flex-col gap-2.5">
            {styledSrc && !styledFailed && (
              <button
                type="button"
                disabled={choose.isPending}
                onClick={() => handleChoose("sparki_style")}
                className="rounded-full px-5 py-3 text-sm font-semibold text-[#05070e] transition hover:brightness-110 disabled:opacity-60"
                style={{ background: ACCENT }}
              >
                {choose.isPending ? "Bezig…" : "Sparki-versie gebruiken"}
              </button>
            )}
            <button
              type="button"
              disabled={choose.isPending}
              onClick={() => handleChoose("original")}
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white/85 transition hover:bg-white/5 disabled:opacity-60"
            >
              Origineel houden
            </button>
            <button
              type="button"
              onClick={handlePick}
              className="rounded-full px-5 py-2.5 text-sm text-white/50 transition hover:text-white/80"
            >
              Opnieuw uploaden
            </button>
          </div>
        )}

        {/* KEPT — confirmation. */}
        {stage === "kept" && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-cyan-300/20 bg-[#070d16]/80 px-4 py-4">
              <p className="text-sm text-white/85">
                Bewaard als je{" "}
                <span style={{ color: ACCENT }}>
                  {kept === "sparki_style" ? "Sparki-versie" : "originele foto"}
                </span>
                . Je andere versie blijft ook bewaard.
              </p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-white/15 px-5 py-3 text-sm font-medium text-white/85 transition hover:bg-white/5"
            >
              Nog een foto
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
