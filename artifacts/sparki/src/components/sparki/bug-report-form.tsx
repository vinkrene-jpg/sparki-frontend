import { useState } from "react"
import { useLocation } from "wouter"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { useUserProfile } from "@/contexts/UserContext"
import { useCreateBugReport } from "@/hooks/use-bug-reports"

export function BugReportForm() {
  const [location] = useLocation()
  const { profile } = useUserProfile()
  const create = useCreateBugReport()
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState("")
  const [screenshotUrl, setScreenshotUrl] = useState("")
  const [done, setDone] = useState(false)

  function submit() {
    if (description.trim().length < 3) return
    create.mutate(
      {
        description: description.trim(),
        userRole: profile?.activeRole ?? null,
        pageUrl: typeof window !== "undefined" ? window.location.href : location,
        screenshotUrl: screenshotUrl.trim() || null,
      },
      {
        onSuccess: () => {
          setDescription("")
          setScreenshotUrl("")
          setDone(true)
          setTimeout(() => {
            setDone(false)
            setOpen(false)
          }, 1800)
        },
      },
    )
  }

  const inputCls =
    "w-full rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[13px] text-white/85 placeholder-white/25 outline-none focus:border-cyan-300/40"

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionLabel n="09" title="Feedback & bugs" />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="font-mono text-[10px] uppercase tracking-[0.18em] transition"
          style={{ color: open ? "rgba(255,255,255,0.4)" : ACCENT }}
        >
          {open ? "sluiten" : "+ melden"}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-3 rounded-xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
          <p className="text-[12px] leading-relaxed text-white/40">
            Iets kapot of een idee? De pagina en je rol worden automatisch
            meegestuurd.
          </p>
          <textarea
            className={`${inputCls} min-h-[90px] resize-none`}
            placeholder="Beschrijf wat er gebeurde…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <input
            className={inputCls}
            placeholder="Screenshot-URL (optioneel)"
            value={screenshotUrl}
            onChange={(e) => setScreenshotUrl(e.target.value)}
          />
          <button
            type="button"
            onClick={submit}
            disabled={create.isPending || description.trim().length < 3}
            className="w-full rounded-lg py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-black transition disabled:opacity-50"
            style={{ background: ACCENT }}
          >
            {done
              ? "✓ verzonden"
              : create.isPending
                ? "verzenden…"
                : "Versturen"}
          </button>
        </div>
      )}
    </section>
  )
}
