import { useState, useCallback, useEffect } from "react"
import { ArrowLeft, Zap, ChevronRight } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { ConnectionsSection } from "@/components/sparki/connections-section"
import { OnboardingGapFill } from "@/components/sparki/onboarding-gap-fill"
import {
  ONBOARDING_STEP_KEY,
  ONBOARDING_SELF_KEY,
  restoreOnboardingState,
  clearOnboardingState,
  type SelfType,
} from "@/lib/onboarding-resume"

// ─────────────────────────────────────────────────────────────────────────────
// Sparki Onboarding V2 — a narrative flow ending in a mandatory connect step.
//
// No forms, no sliders. Sparki introduces himself, asks the one question that
// matters (what kind of athlete do you THINK you are), warns you he probably
// disagrees, then — BEFORE the first plan — runs a mandatory step: connect your
// sport & health apps so Sparki gathers what already exists, and only then asks
// for the genuinely-missing fields (the manual override). The real plan is
// generated server-side. Copy is plain Dutch; the word "AI" never appears.
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "rgba(120,210,230,1)"
const ACCENT_DIM = "rgba(120,210,230,0.12)"

const SELF_OPTIONS: Array<{ value: SelfType; label: string }> = [
  { value: "diesel", label: "Diesel" },
  { value: "sprinter", label: "Sprinter" },
  { value: "alleskunner", label: "Alleskunner" },
  { value: "geen_idee", label: "Geen idee" },
  { value: "ik_zie_wel", label: "Ik zie wel" },
]

// The connect step redirects out to Strava and back via a full page load, so
// onboarding must survive that round-trip. Progress is kept in sessionStorage
// (per-tab) — restore/clamp/clear logic lives in `@/lib/onboarding-resume`.
const sessionStore = typeof window !== "undefined" ? window.sessionStorage : null

// Each narrative screen is a stack of lines, revealed as one calm beat.
type Line = { text: string; dim?: boolean }

function TopBar({ onBack, canBack }: { onBack: () => void; canBack: boolean }) {
  return (
    <div className="flex h-12 shrink-0 items-center">
      {canBack ? (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-sm text-foreground/55 transition-colors hover:text-foreground/90"
        >
          <ArrowLeft className="h-4 w-4" />
          Terug
        </button>
      ) : (
        <div className="flex items-center gap-2 px-1">
          <Zap className="h-4 w-4" style={{ color: ACCENT }} />
          <span className="font-sans text-[10px] font-medium tracking-[0.25em] text-muted-foreground">
            SPARKI
          </span>
        </div>
      )}
    </div>
  )
}

function PrimaryBtn({
  onClick,
  disabled,
  loading,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl font-sans text-sm font-semibold tracking-wide text-[color:var(--color-on-accent)] transition-opacity hover:opacity-90 disabled:opacity-40"
      style={{ background: ACCENT }}
    >
      {loading ? (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
          <path d="M12 2 a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : (
        children
      )}
    </button>
  )
}

// A narrative screen: a few lines, building to a single primary action.
function NarrativeScreen({ lines, children }: { lines: Line[]; children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col justify-center gap-3">
        {lines.map((line, i) => (
          <p
            key={i}
            className="font-sans text-[1.7rem] font-bold leading-tight tracking-tight"
            style={{ color: line.dim ? "var(--color-muted-foreground)" : "var(--color-foreground)" }}
          >
            {line.text}
          </p>
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-3 pb-8 pt-6">{children}</div>
    </div>
  )
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 font-sans text-sm text-red-400">
      {msg}
    </p>
  )
}

interface OnboardingV2Props {
  firstName: string | null
  onComplete: () => void
}

export function OnboardingV2({ firstName, onComplete }: OnboardingV2Props) {
  // Restore progress so the Strava OAuth round-trip (a full page load) returns
  // the athlete to the connect step instead of restarting onboarding — otherwise
  // the freshly imported data would never reach the very next gap-fill screen.
  const [restored] = useState(() => restoreOnboardingState(sessionStore))
  const [step, setStep] = useState(restored.step)
  const [selfType, setSelfType] = useState<SelfType | null>(restored.selfType)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // True while a freshly-connected platform is still importing — holds "Verder"
  // so the gap-fill only decides what's missing after the import has landed.
  const [connBusy, setConnBusy] = useState(false)

  useEffect(() => {
    sessionStore?.setItem(ONBOARDING_STEP_KEY, String(step))
  }, [step])
  useEffect(() => {
    if (selfType) sessionStore?.setItem(ONBOARDING_SELF_KEY, selfType)
  }, [selfType])

  const name = firstName?.trim() ? firstName.trim() : "renner"

  const next = useCallback(() => setStep((s) => s + 1), [])
  const back = useCallback(() => {
    setError(null)
    setStep((s) => Math.max(0, s - 1))
  }, [])

  // Finish: persist the self-claim, let the server seed defaults + build the real
  // plan + assign the Founding Athlete number, then drop into the app.
  const finish = useCallback(async () => {
    if (!selfType) return
    setSaving(true)
    setError(null)
    try {
      await apiFetch("/api/onboarding/complete-v2", {
        method: "POST",
        body: JSON.stringify({ selfType }),
      })
      clearOnboardingState(sessionStore)
      onComplete()
    } catch {
      setError("Kon je profiel niet opslaan. Controleer je verbinding en probeer het opnieuw.")
      setSaving(false)
    }
  }, [selfType, onComplete])

  // WP-R1 — echte ouderstart: wie hier als ouder/verzorger binnenkomt, slaat
  // de volledige sporteronboarding over. De server geeft de ouderrol (additief)
  // en markeert de onboarding als afgerond; daarna landt het account direct in
  // de ouderomgeving (kinderen koppelen via Uitnodigen).
  const startAsParent = useCallback(async () => {
    setSaving(true)
    setError(null)
    try {
      await apiFetch("/api/onboarding/parent-start", { method: "POST" })
      clearOnboardingState(sessionStore)
      onComplete()
    } catch {
      setError("Kon de ouderstart niet opslaan. Controleer je verbinding en probeer het opnieuw.")
      setSaving(false)
    }
  }, [onComplete])

  return (
    <div className="relative min-h-dvh bg-card">
      {/* Subtle cinematic glow, matching the app's blue-black language. */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[40vh]"
        style={{ background: "radial-gradient(60% 100% at 50% 0%, rgba(120,210,230,0.10), transparent)" }}
      />
      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-6">
        <TopBar onBack={back} canBack={step > 0} />

        {step === 0 && (
          <NarrativeScreen
            lines={[
              { text: "Hoi." },
              { text: `Jij bent dus ${name}.` },
              { text: "Goed dat je er bent.", dim: true },
            ]}
          >
            <PrimaryBtn onClick={next}>Verder</PrimaryBtn>
            <button
              type="button"
              onClick={() => void startAsParent()}
              disabled={saving}
              data-testid="onboarding-parent-start"
              className="mt-3 w-full text-center font-sans text-[13px] text-muted-foreground underline-offset-4 transition-colors hover:text-foreground/75 hover:underline disabled:opacity-40"
            >
              Ik ben ouder of verzorger — ik sport hier niet zelf
            </button>
            {error && <div className="mt-3"><ErrorMsg msg={error} /></div>}
          </NarrativeScreen>
        )}

        {step === 1 && (
          <NarrativeScreen
            lines={[
              { text: "Ik ben Sparki." },
              { text: "Ik weet nog weinig over je." },
              { text: "Daar gaan we verandering in brengen.", dim: true },
            ]}
          >
            <PrimaryBtn onClick={next}>Verder</PrimaryBtn>
          </NarrativeScreen>
        )}

        {step === 2 && (
          <NarrativeScreen
            lines={[
              { text: "Voordat ik advies geef," },
              { text: "wil ik eerst begrijpen wat voor sporter je bent." },
            ]}
          >
            <PrimaryBtn onClick={next}>Verder</PrimaryBtn>
          </NarrativeScreen>
        )}

        {step === 3 && (
          <div className="flex flex-1 flex-col">
            <div className="flex flex-col gap-2 pb-8 pt-6">
              <h2 className="font-sans text-[1.7rem] font-bold leading-tight tracking-tight text-foreground">
                Wat voor sporter denk jij dat je bent?
              </h2>
            </div>
            <div className="flex flex-1 flex-col gap-2.5">
              {SELF_OPTIONS.map((opt) => {
                const active = selfType === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelfType(opt.value)}
                    className="relative flex w-full items-center overflow-hidden rounded-2xl border px-5 py-4 text-left transition-all"
                    style={
                      active
                        ? { borderColor: "rgba(120,210,230,0.4)", background: ACCENT_DIM }
                        : { borderColor: "var(--color-border)", background: "var(--color-muted)" }
                    }
                  >
                    {active && (
                      <div
                        className="absolute left-0 top-1/2 h-8 w-[3px] -translate-y-1/2 rounded-r-full"
                        style={{ background: ACCENT }}
                      />
                    )}
                    <span
                      className="pl-2 font-sans text-base font-semibold"
                      style={{ color: active ? "var(--color-foreground)" : "var(--color-muted-foreground)" }}
                    >
                      {opt.label}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="mt-auto pb-8 pt-6">
              <PrimaryBtn onClick={next} disabled={selfType === null}>
                Verder
              </PrimaryBtn>
            </div>
          </div>
        )}

        {step === 4 && (
          <NarrativeScreen
            lines={[
              { text: "Interessant." },
              { text: "Ik heb waarschijnlijk een andere theorie." },
              { text: "Maar daarvoor heb ik eerst bewijs nodig.", dim: true },
            ]}
          >
            <PrimaryBtn onClick={next}>Verder</PrimaryBtn>
          </NarrativeScreen>
        )}

        {step === 5 && (
          <NarrativeScreen
            lines={[
              { text: "Koppel je sport- en gezondheidsapps." },
              { text: "Dan haal ik alles op wat er al is." },
              { text: "Daarna vraag ik alleen wat nog ontbreekt.", dim: true },
            ]}
          >
            <PrimaryBtn onClick={next}>
              Koppelen
              <ChevronRight className="h-4 w-4" />
            </PrimaryBtn>
          </NarrativeScreen>
        )}

        {step === 6 && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-col gap-1.5 pt-2">
              <h2 className="font-sans text-[1.5rem] font-bold leading-tight tracking-tight text-foreground">
                Koppel je sport- en gezondheidsapps
              </h2>
              <p className="text-pretty text-[13px] leading-relaxed text-muted-foreground">
                Wat je koppelt, lees ik automatisch uit. Je kunt dit later in
                Instellingen aanpassen.
              </p>
            </div>

            <div className="-mx-6 mt-4 flex-1 overflow-y-auto px-6">
              <ConnectionsSection onImportingChange={setConnBusy} />
            </div>

            <div className="mt-auto flex flex-col gap-3 pb-8 pt-4">
              <PrimaryBtn onClick={next} disabled={connBusy}>
                Verder
                <ChevronRight className="h-4 w-4" />
              </PrimaryBtn>
            </div>
          </div>
        )}

        {step === 7 && (
          <OnboardingGapFill onComplete={finish} finishing={saving} />
        )}

        {step === 7 && error && (
          <div className="pb-8">
            <ErrorMsg msg={error} />
          </div>
        )}
      </div>
    </div>
  )
}
