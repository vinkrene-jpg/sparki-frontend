import { useState } from "react"
import { Apple, HeartPulse, Brain, ChevronRight } from "lucide-react"
import { ScreenShell } from "@/components/sparki/screen-shell"
import { SectionLabel, ACCENT } from "@/components/sparki/ui"
import { VoedingScreen } from "@/components/sparki/voeding-screen"
import { HealthStatusControl } from "@/components/sparki/health-status-control"

// Hoofdstuk Lichaam — bundelt de bestaande lichaamssurfaces onder één dak:
// voeding & hydratatie, gezondheid/herstel (ziek/geblesseerd) en een
// gereserveerde plek voor Mentaal (toekomstig werk — geen nep-functionaliteit).
export default function LichaamPage() {
  const [voedingOpen, setVoedingOpen] = useState(false)

  return (
    <ScreenShell section="lichaam">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Lichaam
        </h1>
        <p className="text-sm text-white/55">
          Alles wat je lichaam draaiende houdt — voeding, herstel en gezondheid
          op één plek.
        </p>
      </div>

      <section className="mt-8">
        <SectionLabel title="Voeding" />
        <button
          type="button"
          onClick={() => setVoedingOpen(true)}
          className="mt-4 flex w-full items-center gap-4 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 text-left backdrop-blur-md transition-colors hover:border-cyan-300/30"
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08]"
            style={{ background: "rgba(120,210,230,0.08)" }}
          >
            <Apple className="h-5 w-5" strokeWidth={1.75} style={{ color: ACCENT }} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium text-white/90">
              Voeding &amp; hydratatie
            </span>
            <span className="mt-0.5 block text-[12px] text-white/45">
              Log je voeding en bekijk je fueling-advies
            </span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/25" strokeWidth={1.75} />
        </button>
      </section>

      <section className="mt-8">
        <SectionLabel title="Gezondheid & herstel" />
        <div className="mt-4 rounded-2xl border border-white/[0.08] bg-[#070d16]/[0.82] p-4 backdrop-blur-md">
          <div className="flex items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.08]"
              style={{ background: "rgba(120,210,230,0.08)" }}
            >
              <HeartPulse className="h-5 w-5" strokeWidth={1.75} style={{ color: ACCENT }} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-white/90">
                Hoe voel je je?
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-white/45">
                Ben je ziek of geblesseerd? Geef het door — je schema past zich
                erop aan.
              </p>
              <div className="mt-3">
                <HealthStatusControl />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <SectionLabel title="Mentaal" />
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-[#070d16]/[0.55] p-4 backdrop-blur-md">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/[0.06]"
            style={{ background: "rgba(255,255,255,0.03)" }}
          >
            <Brain className="h-5 w-5 text-white/45" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-white/70">
              Mentaal — binnenkort
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-white/40">
              Hier komt straks je mentale welzijn en veerkracht. Deze plek is
              gereserveerd; er is nog geen functionaliteit om te tonen.
            </p>
          </div>
        </div>
      </section>

      <VoedingScreen open={voedingOpen} onOpenChange={setVoedingOpen} />
    </ScreenShell>
  )
}
