import { useRef, useState, useEffect } from "react"
import { useLocation } from "wouter"
import { ArrowLeft, ArrowUp } from "lucide-react"
import { attachmentUrl } from "@/hooks/use-input-center"
import {
  useStylizePhoto,
  useChoosePhoto,
  useSetPhotoDecor,
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
  const [decorSet, setDecorSet] = useState(false)

  const stylize = useStylizePhoto()
  const choose = useChoosePhoto()
  const setDecor = useSetPhotoDecor()

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
    setDecorSet(false)
    setStage("intro")
    if (originalUrl) URL.revokeObjectURL(originalUrl)
    setOriginalUrl(null)
  }

  async function handleUseAsDecor() {
    if (!result || !kept) return
    try {
      await setDecor.mutateAsync({ id: result.id, variant: kept })
      setDecorSet(true)
    } catch {
      setError("Instellen als sfeerbeeld lukte niet. Probeer het opnieuw.")
    }
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
    <div className="min-h-dvh bg-background text-foreground">
      {/* Top bar with an always-visible way back. */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-4 py-3 backdrop-blur-md">
        <button
          type="button"
          onClick={() => navigate("/you")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Terug
        </button>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent-cyan">
          Foto-lab · test
        </span>
        <span className="w-12" />
      </div>

      <div className="mx-auto w-full max-w-md px-4 pb-24 pt-6">
        <h1 className="text-xl font-semibold">Sparki-foto</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Upload een foto. Er wordt een rustige, donkere lab-versie van gemaakt —
          dezelfde echte persoon, geen cartoon, geen vervorming. Jij kiest wat je
          houdt.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          aria-label="Kies een foto om te bewerken"
        />

        {/* INTRO — nothing uploaded yet. */}
        {stage === "intro" && (
          <button
            type="button"
            onClick={handlePick}
            className="mt-6 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted px-6 py-12 text-center transition hover:border-accent-cyan/40 hover:bg-muted"
          >
            <ArrowUp className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-medium text-foreground/85">
              Kies een foto
            </span>
            <span className="text-xs text-muted-foreground">
              Vanaf je telefoon of camera
            </span>
          </button>
        )}

        {stage === "intro" && (
          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            Je foto wordt verwerkt met AI-beeldtechniek. Hiervoor wordt geen
            eigen API-sleutel gebruikt; de verwerking telt mee in je tegoed.
          </p>
        )}

        {error && stage !== "working" && (
          <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm text-[color:var(--color-warning)]">
            {error}
          </p>
        )}

        {/* ORIGINAL preview — shown as soon as a file is chosen. */}
        {originalUrl && stage !== "intro" && (
          <div className="mt-6 space-y-5">
            <figure>
              <figcaption className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Origineel
              </figcaption>
              <img
                src={originalUrl}
                alt="Jouw originele foto"
                className="w-full rounded-2xl border border-border object-cover"
              />
            </figure>

            {/* SPARKI version — working / styled / honest failure. */}
            <figure>
              <figcaption className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-accent-cyan">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: ACCENT }}
                />
                Sparki-versie
              </figcaption>

              {stage === "working" && (
                <div className="flex aspect-square w-full flex-col items-center justify-center gap-3 rounded-2xl border border-accent-cyan/15 bg-card">
                  <span
                    className="h-7 w-7 animate-spin rounded-full border-2 border-border"
                    style={{ borderTopColor: ACCENT }}
                  />
                  <span className="text-sm text-muted-foreground">
                    Je foto wordt bewerkt…
                  </span>
                </div>
              )}

              {stage !== "working" && styledSrc && (
                <img
                  src={styledSrc}
                  alt="De Sparki-versie van je foto"
                  className="w-full rounded-2xl border border-accent-cyan/25 object-cover shadow-card"
                />
              )}

              {stage !== "working" && !styledSrc && (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] px-4 py-5">
                  <p className="text-sm leading-relaxed text-[color:var(--color-warning)]">
                    {result?.failureReason ??
                      "De sfeer kon nu niet worden toegepast. Je originele foto blijft bruikbaar."}
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
                className="rounded-full px-5 py-3 text-sm font-semibold text-[color:var(--color-on-accent)] transition hover:brightness-110 disabled:opacity-60"
                style={{ background: ACCENT }}
              >
                {choose.isPending ? "Bezig…" : "Sparki-versie gebruiken"}
              </button>
            )}
            <button
              type="button"
              disabled={choose.isPending}
              onClick={() => handleChoose("original")}
              className="rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground/85 transition hover:bg-muted disabled:opacity-60"
            >
              Origineel houden
            </button>
            <button
              type="button"
              onClick={handlePick}
              className="rounded-full px-5 py-2.5 text-sm text-muted-foreground transition hover:text-foreground/80"
            >
              Opnieuw uploaden
            </button>
          </div>
        )}

        {/* KEPT — confirmation. */}
        {stage === "kept" && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-accent-cyan/20 bg-card px-4 py-4">
              <p className="text-sm text-foreground/85">
                Bewaard als je{" "}
                <span style={{ color: ACCENT }}>
                  {kept === "sparki_style" ? "Sparki-versie" : "originele foto"}
                </span>
                . Je andere versie blijft ook bewaard.
              </p>
            </div>

            {/* Use the kept photo to dress up the profile. Only when it was
                persisted (a session row exists) — an offline-only original
                can't be served back, so we don't pretend it can. */}
            {result && !decorSet && (
              <div className="rounded-2xl border border-border bg-card px-4 py-4">
                <p className="text-sm leading-relaxed text-foreground/75">
                  Wil je deze foto als sfeerbeeld op je profiel? Hij komt dan
                  bovenaan je profiel te staan.
                </p>
                <button
                  type="button"
                  disabled={setDecor.isPending}
                  onClick={handleUseAsDecor}
                  className="mt-3 rounded-full px-5 py-3 text-sm font-semibold text-[color:var(--color-on-accent)] transition hover:brightness-110 disabled:opacity-60"
                  style={{ background: ACCENT }}
                >
                  {setDecor.isPending ? "Bezig…" : "Gebruik als sfeerbeeld"}
                </button>
              </div>
            )}

            {decorSet && (
              <div className="rounded-2xl border border-accent-cyan/25 bg-accent-cyan/[0.06] px-4 py-4">
                <p className="text-sm leading-relaxed text-foreground/85">
                  Ingesteld als sfeerbeeld. Je ziet hem bovenaan je profiel.
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/you")}
                  className="mt-3 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground/85 transition hover:bg-muted"
                >
                  Naar je profiel
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-border px-5 py-3 text-sm font-medium text-foreground/85 transition hover:bg-muted"
            >
              Nog een foto
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
