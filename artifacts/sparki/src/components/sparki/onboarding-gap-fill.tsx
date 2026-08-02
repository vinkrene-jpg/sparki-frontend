import { useEffect, useRef, useState } from "react"
import { ChevronRight } from "lucide-react"
import { apiFetch } from "@/lib/api"

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding gap-fill — the manual override behind the mandatory connection step.
//
// After the athlete connects (or chooses not to), Sparki looks at what the first
// weekplan needs and only asks for the fields that are STILL genuinely missing
// (GET /api/onboarding/missing-data). Anything a connection already supplied is
// never re-asked. Plain Dutch, no forms-for-forms' sake — only the real gaps.
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT = "rgba(120,210,230,1)"
const ACCENT_DIM = "rgba(120,210,230,0.12)"

type FieldType = "text" | "number" | "select" | "multiselect"

interface RequiredFieldSpec {
  key: string
  label: string
  type: FieldType
  unit?: string
  options?: { value: string; label: string }[]
}

interface MissingDataResult {
  missing: RequiredFieldSpec[]
  present: string[]
  complete: boolean
}

interface OnboardingGapFillProps {
  // Called once the (optional) gap-fill values are saved. The parent then runs
  // complete-v2, which builds the first plan from the now-real profile.
  onComplete: () => void
  // Loading state owned by the parent's finish() call, so the CTA keeps spinning
  // through the final plan build.
  finishing: boolean
}

export function OnboardingGapFill({ onComplete, finishing }: OnboardingGapFillProps) {
  const [data, setData] = useState<MissingDataResult | null>(null)
  const [values, setValues] = useState<Record<string, string | string[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Eerlijke fout i.p.v. stil "alles compleet": als deze call faalt weten we
  // NIET wat er mist, dus tonen we dat — met opnieuw proberen en een expliciete
  // doorgaan-keuze (complete-v2 gebruikt dan als schatting gemarkeerde waarden).
  const [fetchFailed, setFetchFailed] = useState(false)
  const [retryTick, setRetryTick] = useState(0)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setFetchFailed(false)
    apiFetch<MissingDataResult>("/api/onboarding/missing-data")
      .then((res) => {
        if (alive) setData(res)
      })
      .catch(() => {
        if (alive) setFetchFailed(true)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [retryTick])

  // Single-flight: één onComplete per finish-cyclus, ook bij snelle dubbelklik
  // (het `finishing`-prop van de parent kan een render achterlopen). De grendel
  // gaat pas weer open wanneer de parent klaar is of faalde (finishing → false).
  const completeGuardRef = useRef(false)
  useEffect(() => {
    if (!finishing) completeGuardRef.current = false
  }, [finishing])
  const fireComplete = () => {
    if (completeGuardRef.current || finishing) return
    completeGuardRef.current = true
    onComplete()
  }

  const setText = (key: string, v: string) =>
    setValues((prev) => ({ ...prev, [key]: v }))

  const toggleMulti = (key: string, v: string) =>
    setValues((prev) => {
      const cur = Array.isArray(prev[key]) ? (prev[key] as string[]) : []
      return {
        ...prev,
        [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v],
      }
    })

  const handleContinue = async () => {
    if (saving || finishing) return
    const missing = data?.missing ?? []
    if (missing.length > 0) {
      setSaving(true)
      setError(null)
      try {
        await apiFetch("/api/onboarding/missing-data", {
          method: "POST",
          body: JSON.stringify({ values }),
        })
      } catch {
        setError("Kon je gegevens niet opslaan. Probeer het opnieuw.")
        setSaving(false)
        return
      }
      setSaving(false)
    }
    fireComplete()
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="font-sans text-sm text-muted-foreground">Even kijken wat er nog mist…</span>
      </div>
    )
  }

  if (fetchFailed && !data) {
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-4">
        <h2 className="font-sans text-[1.5rem] font-bold leading-tight tracking-tight text-foreground">
          Even geen verbinding
        </h2>
        <p className="text-pretty text-[13px] leading-relaxed text-muted-foreground">
          Ik kon niet controleren welke gegevens er nog missen. Probeer het
          opnieuw, of ga toch door — dan bouw ik je eerste schema met
          voorzichtige schattingen (die pas je later makkelijk aan).
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setRetryTick((t) => t + 1)}
            className="rounded-xl border px-3.5 py-2.5 font-sans text-sm"
            style={{ borderColor: "rgba(120,210,230,0.4)", background: ACCENT_DIM, color: "rgba(255,255,255,0.92)" }}
          >
            Opnieuw proberen
          </button>
          <button
            type="button"
            onClick={fireComplete}
            disabled={finishing}
            className="rounded-xl border px-3.5 py-2.5 font-sans text-sm"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.6)" }}
          >
            {finishing ? "Bezig…" : "Toch doorgaan met schattingen"}
          </button>
        </div>
      </div>
    )
  }

  const missing = data?.missing ?? []
  const busy = saving || finishing

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-col gap-1.5 pt-2">
        <h2 className="font-sans text-[1.5rem] font-bold leading-tight tracking-tight text-foreground">
          {missing.length > 0 ? "Nog even dit" : "Alles compleet"}
        </h2>
        <p className="text-pretty text-[13px] leading-relaxed text-muted-foreground">
          {missing.length > 0
            ? "Dit kon ik nergens vinden. Vul het aan, dan bouw ik je eerste schema."
            : "Ik heb alles wat ik nodig heb om je eerste schema te bouwen."}
        </p>
      </div>

      <div className="-mx-6 mt-4 flex-1 space-y-5 overflow-y-auto px-6">
        {missing.map((field) => (
          <div key={field.key} className="flex flex-col gap-2">
            <label className="font-sans text-sm font-medium text-foreground/80">
              {field.label}
            </label>

            {field.type === "select" && field.options ? (
              <div className="flex flex-wrap gap-2">
                {field.options.map((opt) => {
                  const active = values[field.key] === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setText(field.key, opt.value)}
                      className="rounded-xl border px-3.5 py-2.5 font-sans text-sm transition-all"
                      style={
                        active
                          ? { borderColor: "rgba(120,210,230,0.4)", background: ACCENT_DIM, color: "rgba(255,255,255,0.92)" }
                          : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.6)" }
                      }
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            ) : field.type === "multiselect" && field.options ? (
              <div className="flex flex-wrap gap-2">
                {field.options.map((opt) => {
                  const cur = Array.isArray(values[field.key]) ? (values[field.key] as string[]) : []
                  const active = cur.includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleMulti(field.key, opt.value)}
                      className="rounded-xl border px-3.5 py-2.5 font-sans text-sm transition-all"
                      style={
                        active
                          ? { borderColor: "rgba(120,210,230,0.4)", background: ACCENT_DIM, color: "rgba(255,255,255,0.92)" }
                          : { borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)", color: "rgba(255,255,255,0.6)" }
                      }
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <input
                  type={field.type === "number" ? "number" : "text"}
                  value={typeof values[field.key] === "string" ? (values[field.key] as string) : ""}
                  onChange={(e) => setText(field.key, e.target.value)}
                  className="h-11 flex-1 rounded-xl border border-border bg-muted px-3 font-sans text-sm text-foreground/90 placeholder:text-muted-foreground focus:border-border focus:outline-none"
                />
                {field.unit && <span className="font-sans text-sm text-muted-foreground">{field.unit}</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-3 pb-8 pt-4">
        {error && (
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 font-sans text-sm text-red-400">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={handleContinue}
          disabled={busy}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl font-sans text-sm font-semibold tracking-wide text-[#040506] transition-opacity hover:opacity-90 disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          {busy ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
              <path d="M12 2 a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : (
            <>
              Klaar — naar Sparki
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}
