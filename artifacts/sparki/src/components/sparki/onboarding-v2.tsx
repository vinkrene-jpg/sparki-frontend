import { useState, useCallback } from "react"
import { ArrowLeft, Zap, ChevronRight } from "lucide-react"
import { apiFetch } from "@/lib/api"
import { ConnectionsSection } from "@/components/sparki/connections-section"

// ─────────────────────────────────────────────────────────────────────────────
// Sparki Onboarding V2 — a six-screen narrative.
//
// No forms, no sliders. Sparki introduces himself, asks the one question that
// matters (what kind of athlete do you THINK you are), warns you he probably
// disagrees, and lands you straight in the app — the real plan is generated
// server-side from sensible defaults. Copy is verbatim from the brief; plain
// Dutch throughout; the word "AI" never appears.
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "rgba(120,210,230,1)"
const ACCENT_DIM = "rgba(120,210,230,0.12)"

type SelfType = "diesel" | "sprinter" | "alleskunner" | "geen_idee" | "ik_zie_wel"

const SELF_OPTIONS: Array<{ value: SelfType; label: string }> = [
  { value: "diesel", label: "Diesel" },
  { value: "sprinter", label: "Sprinter" },
  { value: "alleskunner", label: "Alleskunner" },
  { value: "geen_idee", label: "Geen idee" },
  { value: "ik_zie_wel", label: "Ik zie wel" },
]

// Each narrative screen is a stack of lines, revealed as one calm beat.
type Line = { text: string; dim?: boolean }

function TopBar({ onBack, canBack }: { onBack: () => void; canBack: boolean }) {
  return (
    <div className="flex h-12 shrink-0 items-center">
      {canBack ? (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-sm text-white/55 transition-colors hover:text-white/90"
        >
          <ArrowLeft className="h-4 w-4" />
          Terug
        </button>
      ) : (
        <div className="flex items-center gap-2 px-1">
          <Zap className="h-4 w-4" style={{ color: ACCENT }} />
          <span className="font-sans text-[10px] font-medium tracking-[0.25em] text-white/40">
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
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl font-sans text-sm font-semibold tracking-wide text-[#040506] transition-opacity hover:opacity-90 disabled:opacity-40"
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

function GhostBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] font-sans text-sm font-medium text-white/60 transition-colors hover:bg-white/[0.06] hover:text-white/85"
    >
      {children}
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
            style={{ color: line.dim ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.96)" }}
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
  const [step, setStep] = useState(0)
  const [selfType, setSelfType] = useState<SelfType | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      onComplete()
    } catch {
      setError("Kon je profiel niet opslaan. Controleer je verbinding en probeer het opnieuw.")
      setSaving(false)
    }
  }, [selfType, onComplete])

  return (
    <div className="relative min-h-dvh bg-[#05070e]">
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
              { text: "Ah." },
              { text: `Jij bent dus ${name}.` },
              { text: "Ik had op iemand normalers gehoopt.", dim: true },
            ]}
          >
            <PrimaryBtn onClick={next}>Verder</PrimaryBtn>
          </NarrativeScreen>
        )}

        {step === 1 && (
          <NarrativeScreen
            lines={[
              { text: "Ik ben Sparki." },
              { text: "Officieel ben ik een sportplatform." },
              { text: "Onofficieel onderzoek ik sporters.", dim: true },
            ]}
          >
            <PrimaryBtn onClick={next}>Dat klinkt verdacht</PrimaryBtn>
          </NarrativeScreen>
        )}

        {step === 2 && (
          <NarrativeScreen lines={[{ text: "Correct." }]}>
            <PrimaryBtn onClick={next}>Verder</PrimaryBtn>
          </NarrativeScreen>
        )}

        {step === 3 && (
          <div className="flex flex-1 flex-col">
            <div className="flex flex-col gap-2 pb-8 pt-6">
              <h2 className="font-sans text-[1.7rem] font-bold leading-tight tracking-tight text-white">
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
                        : { borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.025)" }
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
                      style={{ color: active ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.78)" }}
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
              { text: "Koppel je sportdata." },
              { text: "Ik doe alsof ik slim ben." },
              { text: "Data helpen daarbij.", dim: true },
            ]}
          >
            {error && <ErrorMsg msg={error} />}
            <PrimaryBtn onClick={next}>
              Koppelen
              <ChevronRight className="h-4 w-4" />
            </PrimaryBtn>
            <GhostBtn onClick={finish}>Later</GhostBtn>
          </NarrativeScreen>
        )}

        {step === 6 && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-col gap-1.5 pt-2">
              <h2 className="font-sans text-[1.5rem] font-bold leading-tight tracking-tight text-white">
                Koppel je sportdata
              </h2>
              <p className="text-pretty text-[13px] leading-relaxed text-white/45">
                Kies wat je nu wilt koppelen. Je kunt dit later altijd aanpassen.
              </p>
            </div>

            <div className="-mx-6 mt-4 flex-1 overflow-y-auto px-6">
              <ConnectionsSection />
            </div>

            <div className="mt-auto flex flex-col gap-3 pb-8 pt-4">
              {error && <ErrorMsg msg={error} />}
              <PrimaryBtn onClick={finish} loading={saving}>
                Klaar — naar Sparki
                <ChevronRight className="h-4 w-4" />
              </PrimaryBtn>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
